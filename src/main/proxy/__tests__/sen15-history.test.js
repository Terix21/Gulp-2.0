import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const { createProjectStore } = require('../../db/project-store');
const { createHistoryLog } = require('../history-log');
const { createRepeaterService } = require('../repeater-service');
const { createIntruderEngine } = require('../intruder-engine');

function removeSqliteArtifacts(dbPath) {
  const files = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  for (const file of files) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

function startUpstreamServer(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function waitForAttack(engine, attackId, timeoutMs = 3000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    const listed = await engine.list();
    const attack = listed.items.find(item => item.id === attackId);
    if (attack && attack.status !== 'running') {
      return attack;
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for attack ${attackId}`);
}

describe('SEN-15 history persistence and tool handoff', () => {
  const cleanupTasks = [];

  afterEach(async () => {
    while (cleanupTasks.length > 0) {
      const task = cleanupTasks.pop();
      await task();
    }
  });

  it('stores every request/response pair and supports host/path/method/status filters', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-sen15-'));
    const dbPath = path.join(tempDir, 'project.sentinel.db');
    const store = createProjectStore();

    await store.open(dbPath, { projectName: 'SEN-15 Filter Test' });
    cleanupTasks.push(async () => {
      await store.close();
      removeSqliteArtifacts(dbPath);
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const historyLog = createHistoryLog({ projectStore: store });

    await historyLog.logTraffic({
      id: 'item-1',
      kind: 'http',
      timestamp: 1000,
      request: { method: 'GET', host: 'api.test', path: '/users' },
      response: { statusCode: 200 },
    });
    await historyLog.logTraffic({
      id: 'item-2',
      kind: 'http',
      timestamp: 2000,
      request: { method: 'POST', host: 'api.test', path: '/users/create' },
      response: { statusCode: 201 },
    });
    await historyLog.logTraffic({
      id: 'item-3',
      kind: 'http',
      timestamp: 3000,
      request: { method: 'GET', host: 'admin.test', path: '/admin' },
      response: { statusCode: 404 },
    });

    const hostFiltered = await historyLog.query({ page: 0, pageSize: 25, filter: { host: 'api.test' } });
    expect(hostFiltered.total).toBe(2);

    const pathFiltered = await historyLog.query({ page: 0, pageSize: 25, filter: { path: '/users' } });
    expect(pathFiltered.total).toBe(2);

    const methodFiltered = await historyLog.query({ page: 0, pageSize: 25, filter: { method: 'POST' } });
    expect(methodFiltered.total).toBe(1);
    expect(methodFiltered.items[0].id).toBe('item-2');

    const statusFiltered = await historyLog.query({ page: 0, pageSize: 25, filter: { statusCode: 404 } });
    expect(statusFiltered.total).toBe(1);
    expect(statusFiltered.items[0].id).toBe('item-3');
  });

  it('persists history across store reopen (restart simulation)', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-sen15-'));
    const dbPath = path.join(tempDir, 'project.sentinel.db');

    const writerStore = createProjectStore();
    await writerStore.open(dbPath, { projectName: 'SEN-15 Persistence Test' });

    const writerHistory = createHistoryLog({ projectStore: writerStore });
    await writerHistory.logTraffic({
      id: 'persisted-item',
      kind: 'http',
      timestamp: 1111,
      request: { method: 'GET', host: 'persist.test', path: '/saved' },
      response: { statusCode: 200 },
    });

    await writerStore.close();

    const readerStore = createProjectStore();
    await readerStore.open(dbPath, { projectName: 'SEN-15 Persistence Test' });
    cleanupTasks.push(async () => {
      await readerStore.close();
      removeSqliteArtifacts(dbPath);
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const readerHistory = createHistoryLog({ projectStore: readerStore });
    const rows = await readerHistory.query({ page: 0, pageSize: 25, filter: { host: 'persist.test' } });

    expect(rows.total).toBe(1);
    expect(rows.items[0].id).toBe('persisted-item');
  });

  it('clear removes persisted history and prevents reappearance after reopen', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-sen15-'));
    const dbPath = path.join(tempDir, 'project.sentinel.db');

    const writerStore = createProjectStore();
    await writerStore.open(dbPath, { projectName: 'SEN-15 Clear Persistence Test' });

    const writerHistory = createHistoryLog({ projectStore: writerStore });
    await writerHistory.logTraffic({
      id: 'clear-item',
      kind: 'http',
      timestamp: 2222,
      request: { method: 'GET', host: 'clear.test', path: '/gone' },
      response: { statusCode: 200 },
    });

    const beforeClear = await writerHistory.query({ page: 0, pageSize: 25, filter: {} });
    expect(beforeClear.total).toBe(1);

    await writerHistory.clear();
    const afterClear = await writerHistory.query({ page: 0, pageSize: 25, filter: {} });
    expect(afterClear.total).toBe(0);

    await writerStore.close();

    const readerStore = createProjectStore();
    await readerStore.open(dbPath, { projectName: 'SEN-15 Clear Persistence Test' });
    cleanupTasks.push(async () => {
      await readerStore.close();
      removeSqliteArtifacts(dbPath);
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    const readerHistory = createHistoryLog({ projectStore: readerStore });
    const rows = await readerHistory.query({ page: 0, pageSize: 25, filter: { host: 'clear.test' } });
    expect(rows.total).toBe(0);
  });

  it('can send history request items to repeater and intruder', async () => {
    const historyLog = createHistoryLog();
    const repeater = createRepeaterService();
    const intruder = createIntruderEngine();
    const server = await startUpstreamServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`resource:${url.searchParams.get('attack') || 'none'}`);
    });
    cleanupTasks.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const item = await historyLog.logTraffic({
      id: 'handoff-item',
      kind: 'http',
      timestamp: Date.now(),
      request: {
        method: 'GET',
        url: `http://127.0.0.1:${port}/resource`,
        host: `127.0.0.1:${port}`,
        path: '/resource',
        headers: { host: `127.0.0.1:${port}` },
        body: null,
      },
      response: { statusCode: 200 },
    });

    const loaded = await historyLog.get(item.id);
    const repeaterResult = await repeater.send({ request: loaded.request });
    expect(repeaterResult.entry.request.path).toBe('/resource');
    expect(repeaterResult.response.bodyLength).toBe(
      Buffer.byteLength(repeaterResult.response.body, 'utf8')
    );

    const configured = await intruder.configure({
      config: {
        requestTemplate: {
          method: loaded.request.method,
          url: `http://127.0.0.1:${port}/resource?attack=§test§`,
          headers: loaded.request.headers,
          body: loaded.request.body,
        },
        positions: [
          {
            source: {
              type: 'dictionary',
              items: ['alpha'],
            },
          },
        ],
      },
    });
    const started = await intruder.start({ configId: configured.configId });
    await waitForAttack(intruder, started.attackId);
    const results = await intruder.results({ attackId: started.attackId, page: 0, pageSize: 10 });

    expect(results.total).toBe(1);
    expect(results.results[0].data.requestSummary).toContain('/resource');
  });
});
