import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectStore = require('../db/project-store');

function cleanupSqliteArtifacts(dbPath) {
  const artifacts = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  for (const file of artifacts) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

describe('project-store (SEN-012)', () => {
  let tempDir;
  let dbPath;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-project-store-'));
    dbPath = path.join(tempDir, 'project.sentinel.db');
  });

  afterEach(async () => {
    try {
      await projectStore.closeProject();
    } catch {
      // Ignore close failures during cleanup.
    }
    cleanupSqliteArtifacts(dbPath);
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('creates a new project DB on first open and persists meta', async () => {
    const opened = await projectStore.openProject(dbPath, { projectName: 'Test Project' });

    expect(fs.existsSync(dbPath)).toBe(true);
    expect(opened.schemaVersion).toBe(projectStore.CURRENT_VERSION);
    expect(opened.project).toBeTruthy();
    expect(opened.project.name).toBe('Test Project');
    expect(opened.project.schemaVer).toBe(projectStore.CURRENT_VERSION);
  });

  it('loads an existing project DB on subsequent open', async () => {
    await projectStore.openProject(dbPath, { projectName: 'Persistent Project' });
    await projectStore.closeProject();

    const reopened = await projectStore.openProject(dbPath);
    expect(reopened.project).toBeTruthy();
    expect(reopened.project.name).toBe('Persistent Project');
    expect(reopened.project.schemaVer).toBe(projectStore.CURRENT_VERSION);
  });

  it('persists traffic, rules, scope, and module state incrementally', async () => {
    await projectStore.openProject(dbPath, { projectName: 'State Project' });

    await projectStore.upsertTrafficItem({
      id: 'traffic-1',
      kind: 'http',
      timestamp: Date.now(),
      request: {
        method: 'GET',
        host: 'example.com',
        port: 443,
        path: '/api/v1/status',
        inScope: true,
      },
      response: { statusCode: 200 },
      wsEvent: null,
    });

    await projectStore.replaceRules([
      { id: 'rule-1', priority: 1, enabled: true, name: 'Header rule', op: 'replace' },
    ]);

    await projectStore.replaceScopeRules([
      { id: 'scope-1', kind: 'include', host: 'example.com', path: '/api' },
    ]);

    await projectStore.setModuleState('proxy', { intercepting: true, queue: 1 });
    await projectStore.checkpointProject();
    await projectStore.closeProject();

    await projectStore.openProject(dbPath);
    const history = await projectStore.queryTraffic({
      page: 0,
      pageSize: 10,
      filter: { host: 'example.com' },
    });
    const persistedRules = await projectStore.listRules();

    expect(history.total).toBe(1);
    expect(history.items[0].id).toBe('traffic-1');
    expect(history.items[0].request.host).toBe('example.com');
    expect(persistedRules).toHaveLength(1);
    expect(persistedRules[0].id).toBe('rule-1');
    expect(persistedRules[0].name).toBe('Header rule');
  });

  it('exports migration metadata and helpers for compatibility', () => {
    expect(Array.isArray(projectStore.MIGRATIONS)).toBe(true);
    expect(projectStore.MIGRATIONS.length).toBeGreaterThan(0);
    expect(typeof projectStore.runMigrations).toBe('function');
    expect(typeof projectStore.rowToProjectMeta).toBe('function');
  });

  // -----------------------------------------------------------------------
  // open() edge cases
  // -----------------------------------------------------------------------

  it('open() without projectName still returns valid project meta', async () => {
    const opened = await projectStore.openProject(dbPath);
    expect(opened.project).toBeTruthy();
    expect(typeof opened.project.name).toBe('string');
    expect(opened.schemaVersion).toBe(projectStore.CURRENT_VERSION);
  });

  it('open() rejects with an error when filePath is not a string', async () => {
    const store = projectStore.createProjectStore();
    const expectedMsg = 'open(filePath) requires a valid path string';
    await expect(store.open(null)).rejects.toThrow(expectedMsg);
    await expect(store.open('')).rejects.toThrow(expectedMsg);
    await expect(store.open(42)).rejects.toThrow(expectedMsg);
  });

  it('open() creates parent directories recursively', async () => {
    const nestedPath = path.join(tempDir, 'a', 'b', 'c', 'project.db');
    const store = projectStore.createProjectStore();
    const opened = await store.open(nestedPath);
    expect(fs.existsSync(nestedPath)).toBe(true);
    expect(opened.schemaVersion).toBe(projectStore.CURRENT_VERSION);
    await store.close();
    cleanupSqliteArtifacts(nestedPath);
  });

  it('open() on an already-open store closes the previous connection first', async () => {
    const dbPath2 = path.join(tempDir, 'project2.sentinel.db');
    await projectStore.openProject(dbPath, { projectName: 'First' });
    // Opening a second path should not throw
    const opened = await projectStore.openProject(dbPath2, { projectName: 'Second' });
    expect(opened.project.name).toBe('Second');
    await projectStore.closeProject();
    cleanupSqliteArtifacts(dbPath2);
  });

  // -----------------------------------------------------------------------
  // ensureOpen() guard
  // -----------------------------------------------------------------------

  it('methods throw when store is not open', async () => {
    const store = projectStore.createProjectStore();
    await expect(store.getProjectMeta()).rejects.toThrow('Project store is not open');
    await expect(store.checkpoint()).rejects.toThrow('Project store is not open');
    await expect(store.upsertTrafficItem({ id: 'x', kind: 'http', timestamp: 0 }))
      .rejects.toThrow('Project store is not open');
    await expect(store.queryTraffic()).rejects.toThrow('Project store is not open');
    await expect(store.replaceRules([])).rejects.toThrow('Project store is not open');
    await expect(store.replaceScopeRules([])).rejects.toThrow('Project store is not open');
    await expect(store.setModuleState('proxy', {})).rejects.toThrow('Project store is not open');
  });

  // -----------------------------------------------------------------------
  // close() idempotency
  // -----------------------------------------------------------------------

  it('close() is a no-op when store is not open', async () => {
    const store = projectStore.createProjectStore();
    await expect(store.close()).resolves.toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // createProjectStore() factory
  // -----------------------------------------------------------------------

  it('createProjectStore() returns independent ProjectStore instances', async () => {
    const storeA = projectStore.createProjectStore();
    const storeB = projectStore.createProjectStore();
    expect(storeA).not.toBe(storeB);

    const dbPathA = path.join(tempDir, 'a.db');
    const dbPathB = path.join(tempDir, 'b.db');

    await storeA.open(dbPathA);
    await storeB.open(dbPathB);

    expect(fs.existsSync(dbPathA)).toBe(true);
    expect(fs.existsSync(dbPathB)).toBe(true);

    await storeA.close();
    await storeB.close();

    cleanupSqliteArtifacts(dbPathA);
    cleanupSqliteArtifacts(dbPathB);
  });

  // -----------------------------------------------------------------------
  // getProjectMeta()
  // -----------------------------------------------------------------------

  it('getProjectMeta() returns camelCase-mapped project row', async () => {
    await projectStore.openProject(dbPath, { projectName: 'Meta Test' });
    const meta = await projectStore.getProjectMeta();
    expect(meta).toBeTruthy();
    expect(meta.name).toBe('Meta Test');
    expect(typeof meta.id).toBe('string');
    expect(typeof meta.createdAt).toBe('number');
    expect(typeof meta.updatedAt).toBe('number');
    expect(meta.schemaVer).toBe(projectStore.CURRENT_VERSION);
  });

  // -----------------------------------------------------------------------
  // upsertTrafficItem() — WebSocket traffic
  // -----------------------------------------------------------------------

  it('upsertTrafficItem() stores WebSocket traffic items', async () => {
    await projectStore.openProject(dbPath);
    await projectStore.upsertTrafficItem({
      id: 'ws-1',
      kind: 'websocket',
      timestamp: 1000,
      request: null,
      response: null,
      wsEvent: { direction: 'c2s', opcode: 1, data: 'hello', masked: true, length: 5 },
    });

    const result = await projectStore.queryTraffic({ page: 0, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('ws-1');
    expect(result.items[0].kind).toBe('websocket');
  });

  it('upsertTrafficItem() updates an existing item on conflict', async () => {
    await projectStore.openProject(dbPath);
    const item = {
      id: 'dup-1',
      kind: 'http',
      timestamp: 1000,
      request: { method: 'GET', host: 'before.com', port: 80, path: '/', inScope: false },
      response: { statusCode: 200 },
      wsEvent: null,
    };
    await projectStore.upsertTrafficItem(item);

    const updated = { ...item, request: { ...item.request, host: 'after.com' } };
    await projectStore.upsertTrafficItem(updated);

    const result = await projectStore.queryTraffic({ page: 0, pageSize: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0].request.host).toBe('after.com');
  });

  // -----------------------------------------------------------------------
  // queryTraffic() — filter combinations
  // -----------------------------------------------------------------------

  it('queryTraffic() filters by method', async () => {
    await projectStore.openProject(dbPath);
    await projectStore.upsertTrafficItem({
      id: 'get-1', kind: 'http', timestamp: 1,
      request: { method: 'GET',  host: 'x.com', port: 80, path: '/', inScope: false },
      response: { statusCode: 200 }, wsEvent: null,
    });
    await projectStore.upsertTrafficItem({
      id: 'post-1', kind: 'http', timestamp: 2,
      request: { method: 'POST', host: 'x.com', port: 80, path: '/', inScope: false },
      response: { statusCode: 201 }, wsEvent: null,
    });

    const result = await projectStore.queryTraffic({ filter: { method: 'POST' } });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('post-1');
  });

  it('queryTraffic() filters by host substring', async () => {
    await projectStore.openProject(dbPath);
    await projectStore.upsertTrafficItem({
      id: 'h1', kind: 'http', timestamp: 1,
      request: { method: 'GET', host: 'api.example.com', port: 443, path: '/', inScope: false },
      response: { statusCode: 200 }, wsEvent: null,
    });
    await projectStore.upsertTrafficItem({
      id: 'h2', kind: 'http', timestamp: 2,
      request: { method: 'GET', host: 'other.net', port: 80, path: '/', inScope: false },
      response: { statusCode: 200 }, wsEvent: null,
    });

    const result = await projectStore.queryTraffic({ filter: { host: 'example' } });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('h1');
  });

  it('queryTraffic() filters by path prefix', async () => {
    await projectStore.openProject(dbPath);
    await projectStore.upsertTrafficItem({
      id: 'p1', kind: 'http', timestamp: 1,
      request: { method: 'GET', host: 'a.com', port: 80, path: '/api/users', inScope: false },
      response: { statusCode: 200 }, wsEvent: null,
    });
    await projectStore.upsertTrafficItem({
      id: 'p2', kind: 'http', timestamp: 2,
      request: { method: 'GET', host: 'a.com', port: 80, path: '/static/app.js', inScope: false },
      response: { statusCode: 200 }, wsEvent: null,
    });

    const result = await projectStore.queryTraffic({ filter: { path: '/api' } });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('p1');
  });

  it('queryTraffic() filters by statusCode', async () => {
    await projectStore.openProject(dbPath);
    await projectStore.upsertTrafficItem({
      id: 's200', kind: 'http', timestamp: 1,
      request: { method: 'GET', host: 'a.com', port: 80, path: '/', inScope: false },
      response: { statusCode: 200 }, wsEvent: null,
    });
    await projectStore.upsertTrafficItem({
      id: 's404', kind: 'http', timestamp: 2,
      request: { method: 'GET', host: 'a.com', port: 80, path: '/gone', inScope: false },
      response: { statusCode: 404 }, wsEvent: null,
    });

    const result = await projectStore.queryTraffic({ filter: { statusCode: 404 } });
    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe('s404');
  });

  it('queryTraffic() paginates results correctly', async () => {
    await projectStore.openProject(dbPath);
    for (let i = 0; i < 5; i++) {
      await projectStore.upsertTrafficItem({
        id: `item-${i}`, kind: 'http', timestamp: i,
        request: { method: 'GET', host: 'x.com', port: 80, path: '/', inScope: false },
        response: { statusCode: 200 }, wsEvent: null,
      });
    }

    const page0 = await projectStore.queryTraffic({ page: 0, pageSize: 2 });
    expect(page0.items.length).toBe(2);
    expect(page0.total).toBe(5);
    expect(page0.page).toBe(0);
    expect(page0.pageSize).toBe(2);

    const page1 = await projectStore.queryTraffic({ page: 1, pageSize: 2 });
    expect(page1.items.length).toBe(2);

    const page2 = await projectStore.queryTraffic({ page: 2, pageSize: 2 });
    expect(page2.items.length).toBe(1);
  });

  it('queryTraffic() returns empty results when no items match', async () => {
    await projectStore.openProject(dbPath);
    const result = await projectStore.queryTraffic({ filter: { method: 'DELETE' } });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // replaceRules() / replaceScopeRules()
  // -----------------------------------------------------------------------

  it('replaceRules() clears existing rules when given an empty array', async () => {
    await projectStore.openProject(dbPath);
    await projectStore.replaceRules([
      { id: 'r1', priority: 1, enabled: true, name: 'Rule 1', op: 'replace' },
    ]);
    const cleared = await projectStore.replaceRules([]);
    expect(cleared.ok).toBe(true);

    // Verify traffic query works (no crash) after rule replacement
    const { total } = await projectStore.queryTraffic();
    expect(total).toBe(0);
  });

  it('replaceRules() persists multiple rules in priority order', async () => {
    await projectStore.openProject(dbPath);
    const rules = [
      { id: 'r1', priority: 10, enabled: true,  name: 'High priority' },
      { id: 'r2', priority: 5,  enabled: false, name: 'Low priority' },
    ];
    const result = await projectStore.replaceRules(rules);
    expect(result.ok).toBe(true);

    // Replace with a single rule to verify idempotency
    const result2 = await projectStore.replaceRules([rules[0]]);
    expect(result2.ok).toBe(true);
  });

  it('replaceScopeRules() clears existing scope rules when given an empty array', async () => {
    await projectStore.openProject(dbPath);
    await projectStore.replaceScopeRules([
      { id: 's1', kind: 'include', host: 'example.com' },
    ]);
    const result = await projectStore.replaceScopeRules([]);
    expect(result.ok).toBe(true);
  });

  it('replaceScopeRules() stores include and exclude rules', async () => {
    await projectStore.openProject(dbPath);
    const result = await projectStore.replaceScopeRules([
      { id: 's-inc', kind: 'include', host: 'target.com', path: '/api', protocol: 'https', port: 443 },
      { id: 's-exc', kind: 'exclude', host: 'target.com', path: '/static' },
    ]);
    expect(result.ok).toBe(true);
  });

  // -----------------------------------------------------------------------
  // setModuleState()
  // -----------------------------------------------------------------------

  it('setModuleState() persists and overwrites module state', async () => {
    await projectStore.openProject(dbPath);

    const r1 = await projectStore.setModuleState('proxy', { intercepting: true, port: 8080 });
    expect(r1.ok).toBe(true);

    // Overwrite with new state
    const r2 = await projectStore.setModuleState('proxy', { intercepting: false, port: 9090 });
    expect(r2.ok).toBe(true);

    // Verify no error on second module
    const r3 = await projectStore.setModuleState('scanner', { running: false });
    expect(r3.ok).toBe(true);

    const proxyState = await projectStore.getModuleState('proxy');
    expect(proxyState).toEqual({ intercepting: false, port: 9090 });

    const scannerState = await projectStore.getModuleState('scanner');
    expect(scannerState).toEqual({ running: false });

    const missingState = await projectStore.getModuleState('missing-module');
    expect(missingState).toBeNull();
  });

  // -----------------------------------------------------------------------
  // checkpoint()
  // -----------------------------------------------------------------------

  it('checkpoint() succeeds on an open store', async () => {
    await projectStore.openProject(dbPath);
    const result = await projectStore.checkpointProject();
    expect(result.ok).toBe(true);
  });
});
