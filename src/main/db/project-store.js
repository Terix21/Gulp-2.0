/**
 * @file project-store.js
 * Sentinel project persistence store (SEN-012).
 *
 * Implements:
 * - SQLite-backed project file creation/open
 * - Crash-safe write mode (WAL + FULL synchronous)
 * - Recovery integrity check on load
 * - Schema bootstrap using canonical DDL_V1 and schema version persistence
 * - Incremental persistence APIs for history/rules/scope/module state
 *
 * See SEN-012 for full acceptance criteria.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const { CURRENT_VERSION, MIGRATIONS, DDL_V1, rowToProjectMeta } = require('../../contracts/db-schema');

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function openDatabase(filePath) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(filePath, err => {
      if (err) return reject(err);
      return resolve(db);
    });
  });
}

function execAsync(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, err => (err ? reject(err) : resolve()));
  });
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      return resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row || null)));
  });
}

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows || [])));
  });
}

function closeAsync(db) {
  return new Promise((resolve, reject) => {
    db.close(err => (err ? reject(err) : resolve()));
  });
}

async function configureCrashSafety(db) {
  await execAsync(db, 'PRAGMA journal_mode = WAL;');
  await execAsync(db, 'PRAGMA synchronous = FULL;');
  await execAsync(db, 'PRAGMA foreign_keys = ON;');
}

async function runMigrations(db) {
  // Canonical bootstrap table definition from DDL_V1[0].
  await execAsync(db, DDL_V1[0]);

  const row = await getAsync(db, 'SELECT schema_ver FROM project_meta WHERE id = ?', ['default']);
  let currentVer = row ? row.schema_ver : 0;
  const orderedMigrations = [...MIGRATIONS].sort(
    (a, b) => (a.fromVersion - b.fromVersion) || (a.toVersion - b.toVersion)
  );

  while (currentVer < CURRENT_VERSION) {
    const migration = orderedMigrations.find(m => m.fromVersion === currentVer);
    if (!migration) {
      throw new Error(`Missing migration path from schema version ${currentVer} to ${CURRENT_VERSION}`);
    }
    if (typeof migration.up !== 'function') {
      throw new Error(`Migration ${migration.fromVersion}->${migration.toVersion} has no up() function`);
    }

    await execAsync(db, 'BEGIN IMMEDIATE TRANSACTION;');
    try {
      const statements = [];
      const migrationDb = {
        exec(sql) {
          if (typeof sql !== 'string' || !sql.trim()) {
            throw new Error(
              `Migration ${migration.fromVersion}->${migration.toVersion} emitted invalid SQL`
            );
          }
          statements.push(sql);
        },
        prepare() {
          throw new Error(
            `Migration ${migration.fromVersion}->${migration.toVersion} uses prepare(), but migration contract is exec()-only`
          );
        },
        transaction() {
          throw new Error(
            `Migration ${migration.fromVersion}->${migration.toVersion} uses transaction(), but migration contract is exec()-only`
          );
        },
      };

      migration.up(migrationDb);
      for (const sql of statements) {
        await execAsync(db, sql);
      }

      const schemaUpdate = await runAsync(
        db,
        'UPDATE project_meta SET schema_ver = ?, updated_at = ? WHERE id = ?',
        [migration.toVersion, Date.now(), 'default']
      );

      if (!schemaUpdate || schemaUpdate.changes === 0) {
        const repair = await runAsync(
          db,
          `INSERT INTO project_meta (id, name, created_at, updated_at, schema_ver)
           VALUES (?, ?, ?, ?, ?)`,
          ['default', 'Unnamed Project', Date.now(), Date.now(), migration.toVersion]
        );

        if (!repair || repair.changes === 0) {
          const error = new Error(
            `Migration ${migration.fromVersion}->${migration.toVersion} could not persist schema version: project_meta default row missing`
          );
          error.code = 'PROJECT_DB_META_MISSING';
          throw error;
        }
      }

      await execAsync(db, 'COMMIT;');
      currentVer = migration.toVersion;
    } catch (error) {
      await execAsync(db, 'ROLLBACK;');
      throw error;
    }
  }

  return currentVer;
}

async function integrityCheck(db) {
  const row = await getAsync(db, 'PRAGMA quick_check;');
  const result = row ? (row.quick_check || Object.values(row)[0]) : null;
  if (result !== 'ok') {
    const error = new Error(`Project database failed integrity check: ${result || 'unknown error'}`);
    error.code = 'PROJECT_DB_CORRUPT';
    throw error;
  }
}

class ProjectStore {
  constructor() {
    this.db = null;
    this.filePath = null;
  }

  async open(filePath, options = {}) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('open(filePath) requires a valid path string');
    }

    if (this.db) {
      await this.close();
    }

    ensureParentDir(filePath);
    const db = await openDatabase(filePath);

    try {
      await configureCrashSafety(db);
      await integrityCheck(db);
      const schemaVer = await runMigrations(db);

      if (options.projectName) {
        await runAsync(
          db,
          'UPDATE project_meta SET name = ?, updated_at = ? WHERE id = ?',
          [options.projectName, Date.now(), 'default']
        );
      }

      const row = await getAsync(
        db,
        'SELECT id, name, created_at, updated_at, schema_ver FROM project_meta WHERE id = ?',
        ['default']
      );

      this.db = db;
      this.filePath = filePath;

      return {
        filePath: this.filePath,
        schemaVersion: schemaVer,
        project: row ? rowToProjectMeta(row) : null,
      };
    } catch (error) {
      try {
        await closeAsync(db);
      } catch {
        // Ignore close errors while unwinding an open failure.
      }
      throw error;
    }
  }

  async close() {
    if (!this.db) return;
    const db = this.db;
    this.db = null;
    this.filePath = null;
    await closeAsync(db);
  }

  ensureOpen() {
    if (!this.db) {
      throw new Error('Project store is not open');
    }
  }

  async checkpoint() {
    this.ensureOpen();
    await execAsync(this.db, 'PRAGMA wal_checkpoint(TRUNCATE);');
    return { ok: true };
  }

  async getProjectMeta() {
    this.ensureOpen();
    const row = await getAsync(
      this.db,
      'SELECT id, name, created_at, updated_at, schema_ver FROM project_meta WHERE id = ?',
      ['default']
    );
    return row ? rowToProjectMeta(row) : null;
  }

  async upsertTrafficItem(item) {
    this.ensureOpen();
    const isHttp = item && item.kind === 'http';
    const req = isHttp ? (item.request || {}) : {};
    const res = isHttp ? (item.response || {}) : {};

    await runAsync(
      this.db,
      `INSERT INTO traffic_history (id, kind, timestamp, method, host, port, path, status_code, in_scope, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         kind = excluded.kind,
         timestamp = excluded.timestamp,
         method = excluded.method,
         host = excluded.host,
         port = excluded.port,
         path = excluded.path,
         status_code = excluded.status_code,
         in_scope = excluded.in_scope,
         data = excluded.data`,
      [
        item.id,
        item.kind,
        item.timestamp,
        req.method || null,
        req.host || null,
        req.port || null,
        req.path || null,
        res.statusCode || null,
        req.inScope ? 1 : 0,
        JSON.stringify(item),
      ]
    );

    return { ok: true };
  }

  async queryTraffic({ page = 0, pageSize = 50, filter = {} } = {}) {
    this.ensureOpen();
    const where = [];
    const params = [];

    if (filter.method) {
      where.push('method = ?');
      params.push(filter.method);
    }
    if (filter.host) {
      where.push('host LIKE ?');
      params.push(`%${filter.host}%`);
    }
    if (filter.path) {
      where.push('path LIKE ?');
      params.push(`${filter.path}%`);
    }
    if (typeof filter.statusCode === 'number') {
      where.push('status_code = ?');
      params.push(filter.statusCode);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = page * pageSize;

    const items = await allAsync(
      this.db,
      `SELECT data FROM traffic_history ${whereSql}
       ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    const totalRow = await getAsync(
      this.db,
      `SELECT COUNT(*) AS count FROM traffic_history ${whereSql}`,
      params
    );

    return {
      items: items.map(r => JSON.parse(r.data)),
      total: totalRow ? totalRow.count : 0,
      page,
      pageSize,
    };
  }

  async getTrafficItem(id) {
    this.ensureOpen();
    if (!id) {
      return null;
    }

    const row = await getAsync(
      this.db,
      'SELECT data FROM traffic_history WHERE id = ? LIMIT 1',
      [id]
    );

    return row ? JSON.parse(row.data) : null;
  }

  async clearTrafficHistory() {
    this.ensureOpen();
    await runAsync(this.db, 'DELETE FROM traffic_history');
    await runAsync(this.db, 'UPDATE project_meta SET updated_at = ? WHERE id = ?', [Date.now(), 'default']);
    return { ok: true };
  }

  async replaceRules(rules = []) {
    this.ensureOpen();
    await execAsync(this.db, 'BEGIN IMMEDIATE TRANSACTION;');
    try {
      await runAsync(this.db, 'DELETE FROM rules');
      for (const rule of rules) {
        await runAsync(
          this.db,
          'INSERT INTO rules (id, priority, enabled, name, data) VALUES (?, ?, ?, ?, ?)',
          [rule.id, rule.priority || 0, rule.enabled === false ? 0 : 1, rule.name || '', JSON.stringify(rule)]
        );
      }
      await runAsync(this.db, 'UPDATE project_meta SET updated_at = ? WHERE id = ?', [Date.now(), 'default']);
      await execAsync(this.db, 'COMMIT;');
      return { ok: true };
    } catch (error) {
      await execAsync(this.db, 'ROLLBACK;');
      throw error;
    }
  }

  async listRules() {
    this.ensureOpen();
    const rows = await allAsync(
      this.db,
      'SELECT data FROM rules ORDER BY priority ASC'
    );
    return rows.map(row => JSON.parse(row.data));
  }

  async replaceScopeRules(rules = []) {
    this.ensureOpen();
    await execAsync(this.db, 'BEGIN IMMEDIATE TRANSACTION;');
    try {
      await runAsync(this.db, 'DELETE FROM scope_rules');
      for (const rule of rules) {
        await runAsync(
          this.db,
          'INSERT INTO scope_rules (id, kind, host, path, protocol, port, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            rule.id,
            rule.kind || 'include',
            rule.host || null,
            rule.path || null,
            rule.protocol || null,
            rule.port || null,
            JSON.stringify(rule),
          ]
        );
      }
      await runAsync(this.db, 'UPDATE project_meta SET updated_at = ? WHERE id = ?', [Date.now(), 'default']);
      await execAsync(this.db, 'COMMIT;');
      return { ok: true };
    } catch (error) {
      await execAsync(this.db, 'ROLLBACK;');
      throw error;
    }
  }

  async listScopeRules() {
    this.ensureOpen();
    const rows = await allAsync(
      this.db,
      'SELECT data FROM scope_rules ORDER BY kind ASC, host ASC, path ASC'
    );
    return rows.map(row => JSON.parse(row.data));
  }

  async upsertScannerFinding(finding) {
    this.ensureOpen();
    await runAsync(
      this.db,
      `INSERT INTO scanner_findings (id, scan_id, severity, name, host, path, created_at, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         scan_id = excluded.scan_id,
         severity = excluded.severity,
         name = excluded.name,
         host = excluded.host,
         path = excluded.path,
         created_at = excluded.created_at,
         data = excluded.data`,
      [
        finding.id,
        finding.scanId,
        finding.severity || 'info',
        finding.name || 'Finding',
        finding.host || null,
        finding.path || null,
        Number.isFinite(finding.createdAt) ? finding.createdAt : Date.now(),
        JSON.stringify(finding),
      ]
    );
    await runAsync(this.db, 'UPDATE project_meta SET updated_at = ? WHERE id = ?', [Date.now(), 'default']);
    return { ok: true };
  }

  async listScannerFindings({ scanId, page = 0, pageSize = 50 } = {}) {
    this.ensureOpen();
    const where = [];
    const params = [];
    if (scanId) {
      where.push('scan_id = ?');
      params.push(scanId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safePage = Math.max(0, Number(page) || 0);
    const safePageSize = Math.max(1, Number(pageSize) || 50);
    const offset = safePage * safePageSize;

    const rows = await allAsync(
      this.db,
      `SELECT data FROM scanner_findings ${whereSql}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, safePageSize, offset]
    );
    const totalRow = await getAsync(
      this.db,
      `SELECT COUNT(*) AS count FROM scanner_findings ${whereSql}`,
      params
    );

    return {
      findings: rows.map(row => JSON.parse(row.data)),
      total: totalRow ? totalRow.count : 0,
    };
  }

  async upsertOobInteraction(interaction) {
    this.ensureOpen();
    await runAsync(
      this.db,
      `INSERT INTO oob_interactions (id, payload_id, kind, received_at, source_ip, data)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         payload_id = excluded.payload_id,
         kind = excluded.kind,
         received_at = excluded.received_at,
         source_ip = excluded.source_ip,
         data = excluded.data`,
      [
        interaction.id,
        interaction.payloadId,
        interaction.kind || 'http',
        Number.isFinite(interaction.timestamp) ? interaction.timestamp : Date.now(),
        interaction.source || null,
        JSON.stringify(interaction),
      ]
    );
    await runAsync(this.db, 'UPDATE project_meta SET updated_at = ? WHERE id = ?', [Date.now(), 'default']);
    return { ok: true };
  }

  async listOobInteractions({ payloadId, page = 0, pageSize = 200 } = {}) {
    this.ensureOpen();
    const where = [];
    const params = [];
    if (payloadId) {
      where.push('payload_id = ?');
      params.push(payloadId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const safePage = Math.max(0, Number(page) || 0);
    const safePageSize = Math.max(1, Number(pageSize) || 200);
    const offset = safePage * safePageSize;

    const rows = await allAsync(
      this.db,
      `SELECT data FROM oob_interactions ${whereSql}
       ORDER BY received_at DESC LIMIT ? OFFSET ?`,
      [...params, safePageSize, offset]
    );

    return {
      hits: rows.map(row => JSON.parse(row.data)),
    };
  }

  async upsertSequencerSession(session) {
    this.ensureOpen();
    await runAsync(
      this.db,
      `INSERT INTO sequencer_sessions (id, status, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         config = excluded.config,
         updated_at = excluded.updated_at`,
      [
        session.id,
        session.status || 'capturing',
        JSON.stringify(session.config || {}),
        Number.isFinite(session.createdAt) ? session.createdAt : Date.now(),
        Number.isFinite(session.updatedAt) ? session.updatedAt : Date.now(),
      ]
    );
    await runAsync(this.db, 'UPDATE project_meta SET updated_at = ? WHERE id = ?', [Date.now(), 'default']);
    return { ok: true };
  }

  async getSequencerSession(sessionId) {
    this.ensureOpen();
    const row = await getAsync(
      this.db,
      'SELECT id, status, config, created_at, updated_at FROM sequencer_sessions WHERE id = ? LIMIT 1',
      [sessionId]
    );
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      status: row.status,
      config: JSON.parse(row.config || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async addSequencerToken({ id, sessionId, position, token, capturedAt }) {
    this.ensureOpen();
    await runAsync(
      this.db,
      `INSERT INTO sequencer_tokens (id, session_id, position, token, captured_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         session_id = excluded.session_id,
         position = excluded.position,
         token = excluded.token,
         captured_at = excluded.captured_at`,
      [id, sessionId, position, token, capturedAt]
    );
    return { ok: true };
  }

  async listSequencerTokens(sessionId) {
    this.ensureOpen();
    const rows = await allAsync(
      this.db,
      `SELECT id, session_id, position, token, captured_at
       FROM sequencer_tokens
       WHERE session_id = ?
       ORDER BY position ASC`,
      [sessionId]
    );

    return rows.map(row => ({
      id: row.id,
      sessionId: row.session_id,
      position: row.position,
      token: row.token,
      capturedAt: row.captured_at,
    }));
  }

  async setModuleState(moduleName, state) {
    this.ensureOpen();
    await runAsync(
      this.db,
      `INSERT INTO module_state (module, data) VALUES (?, ?)
       ON CONFLICT(module) DO UPDATE SET data = excluded.data`,
      [moduleName, JSON.stringify(state)]
    );
    await runAsync(this.db, 'UPDATE project_meta SET updated_at = ? WHERE id = ?', [Date.now(), 'default']);
    return { ok: true };
  }

  async getModuleState(moduleName) {
    this.ensureOpen();
    const row = await getAsync(
      this.db,
      'SELECT data FROM module_state WHERE module = ? LIMIT 1',
      [moduleName]
    );
    return row ? JSON.parse(row.data) : null;
  }
}

const defaultStore = new ProjectStore();

module.exports = {
  CURRENT_VERSION,
  MIGRATIONS,
  DDL_V1,
  runMigrations,
  rowToProjectMeta,

  ProjectStore,
  createProjectStore: () => new ProjectStore(),

  // Convenience singleton for main-process service wiring.
  openProject: (...args) => defaultStore.open(...args),
  closeProject: () => defaultStore.close(),
  checkpointProject: () => defaultStore.checkpoint(),
  getProjectMeta: () => defaultStore.getProjectMeta(),
  upsertTrafficItem: item => defaultStore.upsertTrafficItem(item),
  queryTraffic: args => defaultStore.queryTraffic(args),
  getTrafficItem: id => defaultStore.getTrafficItem(id),
  clearTrafficHistory: () => defaultStore.clearTrafficHistory(),
  listRules: () => defaultStore.listRules(),
  replaceRules: rules => defaultStore.replaceRules(rules),
  listScopeRules: () => defaultStore.listScopeRules(),
  replaceScopeRules: rules => defaultStore.replaceScopeRules(rules),
  upsertScannerFinding: finding => defaultStore.upsertScannerFinding(finding),
  listScannerFindings: args => defaultStore.listScannerFindings(args),
  upsertOobInteraction: interaction => defaultStore.upsertOobInteraction(interaction),
  listOobInteractions: args => defaultStore.listOobInteractions(args),
  upsertSequencerSession: session => defaultStore.upsertSequencerSession(session),
  getSequencerSession: sessionId => defaultStore.getSequencerSession(sessionId),
  addSequencerToken: tokenRow => defaultStore.addSequencerToken(tokenRow),
  listSequencerTokens: sessionId => defaultStore.listSequencerTokens(sessionId),
  setModuleState: (moduleName, state) => defaultStore.setModuleState(moduleName, state),
  getModuleState: moduleName => defaultStore.getModuleState(moduleName),
};
