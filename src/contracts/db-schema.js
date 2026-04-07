/**
 * @file db-schema.js
 * Sentinel Project File Schema and Migration Strategy — Milestone 0 (Architecture Baseline)
 *
 * Defines the SQLite-backed project database schema and the monotonic
 * migration chain that allows older project files to be upgraded in place.
 *
 * Rules:
 *   1. CURRENT_VERSION is the only integer requiring a bump when schema changes.
 *   2. Every migration MUST be append-only — never mutate or remove earlier entries.
 *   3. Migration `up` functions receive a minimal migration adapter that supports
 *      `db.exec(sql)` only. Migrations must be DDL/SQL-statement driven and
 *      must not call `prepare()` or `transaction()`.
 *   4. All DDL uses IF NOT EXISTS / ADD COLUMN to remain idempotent.
 *
 * Schema version: 1
 */

'use strict';

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

/** Current schema version.  Increment when adding any migration. */
const CURRENT_VERSION = 1;

// ---------------------------------------------------------------------------
// Table definitions (DDL reference — authoritative column list)
// ---------------------------------------------------------------------------

/**
 * DDL strings for the canonical schema at version 1.
 * These are the statements that `migrations[0].up` executes.
 *
 * @type {string[]}
 */
const DDL_V1 = [
  // ---- project metadata ------------------------------------------------
  `CREATE TABLE IF NOT EXISTS project_meta (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    schema_ver   INTEGER NOT NULL DEFAULT 1
  )`,

  // ---- traffic history -------------------------------------------------
  // Stores serialised TrafficItem JSON blobs for fast retrieval.
  `CREATE TABLE IF NOT EXISTS traffic_history (
    id           TEXT PRIMARY KEY,
    kind         TEXT NOT NULL CHECK(kind IN ('http', 'websocket')),
    timestamp    INTEGER NOT NULL,
    method       TEXT,
    host         TEXT,
    port         INTEGER,
    path         TEXT,
    status_code  INTEGER,
    in_scope     INTEGER NOT NULL DEFAULT 0,
    data         TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_history_timestamp ON traffic_history(timestamp DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_history_host      ON traffic_history(host)`,
  `CREATE INDEX IF NOT EXISTS idx_history_status    ON traffic_history(status_code)`,

  // ---- intercept / rewrite rules ---------------------------------------
  `CREATE TABLE IF NOT EXISTS rules (
    id         TEXT PRIMARY KEY,
    priority   INTEGER NOT NULL DEFAULT 0,
    enabled    INTEGER NOT NULL DEFAULT 1,
    name       TEXT NOT NULL DEFAULT '',
    data       TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority ASC)`,

  // ---- scope rules -----------------------------------------------------
  `CREATE TABLE IF NOT EXISTS scope_rules (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL CHECK(kind IN ('include', 'exclude')),
    host       TEXT,
    path       TEXT,
    protocol   TEXT,
    port       INTEGER,
    data       TEXT NOT NULL
  )`,

  // ---- repeater history ------------------------------------------------
  `CREATE TABLE IF NOT EXISTS repeater_entries (
    id           TEXT PRIMARY KEY,
    created_at   INTEGER NOT NULL,
    request_data TEXT NOT NULL,
    response_data TEXT
  )`,

  // ---- intruder attacks -----------------------------------------------
  `CREATE TABLE IF NOT EXISTS intruder_attacks (
    id         TEXT PRIMARY KEY,
    status     TEXT NOT NULL CHECK(status IN ('configured', 'running', 'stopped', 'completed')),
    config     TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS intruder_results (
    id         TEXT PRIMARY KEY,
    attack_id  TEXT NOT NULL REFERENCES intruder_attacks(id),
    position   INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    status_code INTEGER,
    length     INTEGER,
    duration   INTEGER,
    data       TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_intruder_results_attack ON intruder_results(attack_id)`,

  // ---- scanner findings ------------------------------------------------
  `CREATE TABLE IF NOT EXISTS scanner_findings (
    id         TEXT PRIMARY KEY,
    scan_id    TEXT NOT NULL,
    severity   TEXT NOT NULL CHECK(severity IN ('info', 'low', 'medium', 'high', 'critical')),
    name       TEXT NOT NULL,
    host       TEXT,
    path       TEXT,
    created_at INTEGER NOT NULL,
    data       TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_scanner_findings_scan ON scanner_findings(scan_id)`,

  // ---- OOB sessions ----------------------------------------------------
  `CREATE TABLE IF NOT EXISTS oob_interactions (
    id         TEXT PRIMARY KEY,
    payload_id TEXT NOT NULL,
    kind       TEXT NOT NULL CHECK(kind IN ('http', 'dns', 'smtp')),
    received_at INTEGER NOT NULL,
    source_ip  TEXT,
    data       TEXT NOT NULL
  )`,

  // ---- sequencer sessions ----------------------------------------------
  `CREATE TABLE IF NOT EXISTS sequencer_sessions (
    id         TEXT PRIMARY KEY,
    status     TEXT NOT NULL CHECK(status IN ('capturing', 'stopped', 'analyzed')),
    config     TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sequencer_tokens (
    id         TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sequencer_sessions(id),
    position   INTEGER NOT NULL,
    token      TEXT NOT NULL,
    captured_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_seq_tokens_session ON sequencer_tokens(session_id)`,

  // ---- module state (UI / config persistence per module) ---------------
  `CREATE TABLE IF NOT EXISTS module_state (
    module  TEXT PRIMARY KEY,
    data    TEXT NOT NULL
  )`,
];

// ---------------------------------------------------------------------------
// Migration chain
// ---------------------------------------------------------------------------

/**
 * @typedef {object} MigrationExecAdapter
 * @property {(sql: string) => void} exec - Appends a SQL statement to the migration batch.
 */

/**
 * @typedef {object} Migration
 * @property {number}   fromVersion - Schema version this migration upgrades FROM.
 * @property {number}   toVersion   - Schema version this migration upgrades TO.
 * @property {string}   description - Human-readable summary of the change.
 * @property {(db: MigrationExecAdapter) => void} up - Migration body using exec-only adapter.
 */

/** @type {Migration[]} */
const MIGRATIONS = [
  {
    fromVersion: 0,
    toVersion:   1,
    description: 'Initial schema: all base tables for M0 contract alignment.',
    up(db) {
      for (const ddl of DDL_V1) {
        db.exec(ddl);
      }
      db.exec(`
        INSERT OR IGNORE INTO project_meta (id, name, created_at, updated_at, schema_ver)
        VALUES ('default', 'Unnamed Project', ${Date.now()}, ${Date.now()}, 1)
      `);
    },
  },

  // Future migrations appended here, e.g.:
  // {
  //   fromVersion: 1,
  //   toVersion:   2,
  //   description: 'Add tls_hostname column to traffic_history.',
  //   up(db) {
  //     db.exec('ALTER TABLE traffic_history ADD COLUMN tls_hostname TEXT');
  //   },
  // },
];

// ---------------------------------------------------------------------------
// Migration runner (to be called by project-store on open)
// ---------------------------------------------------------------------------

/**
 * Reads the stored schema_ver from project_meta, then runs all pending
 * migrations in order.  Aborts and rethrows on any error.
 *
 * @param {import('better-sqlite3').Database} db  - Open database connection.
 * @returns {number} The schema version after migration.
 */
function runMigrations(db) {
  // Bootstrap with the canonical v1 project_meta DDL to avoid schema drift.
  db.exec(DDL_V1[0]);

  const row = db.prepare('SELECT schema_ver FROM project_meta WHERE id = ?').get('default');
  let currentVer = row ? row.schema_ver : 0;

  const pending = MIGRATIONS.filter(m => m.fromVersion >= currentVer);
  for (const migration of pending) {
    if (migration.fromVersion !== currentVer) continue;

    const apply = db.transaction(() => {
      migration.up(db);
      db.prepare('UPDATE project_meta SET schema_ver = ?, updated_at = ? WHERE id = ?')
        .run(migration.toVersion, Date.now(), 'default');
    });
    apply();
    currentVer = migration.toVersion;
  }

  return currentVer;
}

// ---------------------------------------------------------------------------
// ProjectMeta shape
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ProjectMeta
 * @property {string}  id         - UUID v4 or 'default'.
 * @property {string}  name       - User-visible project name.
 * @property {number}  createdAt  - Unix epoch ms.
 * @property {number}  updatedAt  - Unix epoch ms.
 * @property {number}  schemaVer  - Schema version stored in the project file.
 */

/**
 * Maps a project_meta DB row to a ProjectMeta object.
 *
 * @param {{ id: string, name: string, created_at: number, updated_at: number, schema_ver: number }} row
 * @returns {ProjectMeta}
 */
function rowToProjectMeta(row) {
  return {
    id:        row.id,
    name:      row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schemaVer: row.schema_ver,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  CURRENT_VERSION,
  DDL_V1,
  MIGRATIONS,
  runMigrations,
  rowToProjectMeta,
};
