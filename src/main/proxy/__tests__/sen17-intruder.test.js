import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const { createIntruderEngine } = require('../intruder-engine');

function startUpstreamServer(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function waitForAttack(engine, attackId, timeoutMs = 5000) {
  const started = Date.now();
  while ((Date.now() - started) < timeoutMs) {
    const listed = await engine.list();
    const attack = listed.items.find(item => item.id === attackId);
    if (attack && attack.status !== 'running') {
      return attack;
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for attack ${attackId}`);
}

describe('SEN-017 Intruder engine', () => {
  const cleanup = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const fn = cleanup.pop();
      await fn();
    }
  });

  it('runs a sniper attack against a real upstream using dictionary payloads', async () => {
    const server = await startUpstreamServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const payload = url.searchParams.get('q') || '';
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`payload=${payload}`);
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const engine = createIntruderEngine();
    const configured = await engine.configure({
      config: {
        requestTemplate: {
          method: 'GET',
          url: `http://127.0.0.1:${port}/search?q=§term§`,
          headers: { host: `127.0.0.1:${port}` },
        },
        attackType: 'sniper',
        positions: [
          { source: { type: 'dictionary', items: ['admin', 'guest', 'root'] } },
        ],
      },
    });

    const started = await engine.start({ configId: configured.configId });
    const completed = await waitForAttack(engine, started.attackId);
    const results = await engine.results({ attackId: started.attackId, page: 0, pageSize: 20 });

    expect(completed.status).toBe('completed');
    expect(results.total).toBe(3);
    expect(results.results[0].data.requestSummary).toContain('/search');
    expect(results.results.some(result => result.payload.includes('admin'))).toBe(true);
  });

  it('supports pitchfork attacks with per-position payload sources', async () => {
    const seen = [];
    const server = await startUpstreamServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      seen.push(`${url.searchParams.get('u')}:${url.searchParams.get('p')}`);
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const engine = createIntruderEngine();
    const configured = await engine.configure({
      config: {
        requestTemplate: {
          method: 'GET',
          url: `http://127.0.0.1:${port}/login?u=§user§&p=§pass§`,
          headers: { host: `127.0.0.1:${port}` },
        },
        attackType: 'pitchfork',
        positions: [
          { source: { type: 'dictionary', items: ['alice', 'bob'] } },
          { source: { type: 'dictionary', items: ['pw1', 'pw2'] } },
        ],
      },
    });

    const started = await engine.start({ configId: configured.configId });
    await waitForAttack(engine, started.attackId);

    expect(seen).toEqual(['alice:pw1', 'bob:pw2']);
  });

  it('supports cluster-bomb attacks with cartesian payload expansion', async () => {
    const seen = [];
    const server = await startUpstreamServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      seen.push(`${url.searchParams.get('x')}:${url.searchParams.get('y')}`);
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const engine = createIntruderEngine();
    const configured = await engine.configure({
      config: {
        requestTemplate: {
          method: 'GET',
          url: `http://127.0.0.1:${port}/combo?x=§x§&y=§y§`,
          headers: { host: `127.0.0.1:${port}` },
        },
        attackType: 'cluster-bomb',
        positions: [
          { source: { type: 'dictionary', items: ['1', '2'] } },
          { source: { type: 'dictionary', items: ['A', 'B'] } },
        ],
      },
    });

    const started = await engine.start({ configId: configured.configId });
    await waitForAttack(engine, started.attackId);
    const results = await engine.results({ attackId: started.attackId, page: 0, pageSize: 20 });

    expect(results.total).toBe(4);
    expect(seen).toEqual(['1:A', '1:B', '2:A', '2:B']);
  });

  it('builds brute-force payloads from a charset', async () => {
    const seen = [];
    const server = await startUpstreamServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      seen.push(url.searchParams.get('k'));
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const engine = createIntruderEngine();
    const configured = await engine.configure({
      config: {
        requestTemplate: {
          method: 'GET',
          url: `http://127.0.0.1:${port}/brute?k=§key§`,
          headers: { host: `127.0.0.1:${port}` },
        },
        attackType: 'sniper',
        positions: [
          { source: { type: 'bruteforce', charset: 'ab', minLength: 1, maxLength: 2 } },
        ],
      },
    });

    const started = await engine.start({ configId: configured.configId });
    await waitForAttack(engine, started.attackId);

    expect(seen).toEqual(['a', 'b', 'aa', 'ab', 'ba', 'bb']);
  });

  it('builds sequential numeric payloads', async () => {
    const seen = [];
    const server = await startUpstreamServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      seen.push(url.searchParams.get('id'));
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const engine = createIntruderEngine();
    const configured = await engine.configure({
      config: {
        requestTemplate: {
          method: 'GET',
          url: `http://127.0.0.1:${port}/seq?id=§id§`,
          headers: { host: `127.0.0.1:${port}` },
        },
        positions: [
          { source: { type: 'sequential', start: 3, end: 7, step: 2, padTo: 2 } },
        ],
      },
    });

    const started = await engine.start({ configId: configured.configId });
    await waitForAttack(engine, started.attackId);

    expect(seen).toEqual(['03', '05', '07']);
  });

  it('reads dictionary payloads from a file path', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-intruder-'));
    const dictPath = path.join(tmpDir, 'payloads.txt');
    fs.writeFileSync(dictPath, 'one\ntwo\nthree\n', 'utf8');
    cleanup.push(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const server = await startUpstreamServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(url.searchParams.get('v') || '');
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const engine = createIntruderEngine();
    const configured = await engine.configure({
      config: {
        requestTemplate: {
          method: 'GET',
          url: `http://127.0.0.1:${port}/dict?v=§value§`,
          headers: { host: `127.0.0.1:${port}` },
        },
        positions: [
          { source: { type: 'dictionary', filePath: dictPath } },
        ],
      },
    });

    const started = await engine.start({ configId: configured.configId });
    await waitForAttack(engine, started.attackId);
    const results = await engine.results({ attackId: started.attackId, page: 0, pageSize: 10 });

    expect(results.total).toBe(3);
  });

  it('emits progress events and flags anomalous responses against baseline', async () => {
    const progress = [];
    const server = await startUpstreamServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const payload = url.searchParams.get('q');
      if (payload === 'bad') {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('server error');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const engine = createIntruderEngine();
    engine.on('progress', payload => progress.push(payload));

    const configured = await engine.configure({
      config: {
        requestTemplate: {
          method: 'GET',
          url: `http://127.0.0.1:${port}/check?q=§term§`,
          headers: { host: `127.0.0.1:${port}` },
        },
        positions: [
          { source: { type: 'dictionary', items: ['ok', 'bad'] } },
        ],
      },
    });

    const started = await engine.start({ configId: configured.configId });
    await waitForAttack(engine, started.attackId);
    const results = await engine.results({ attackId: started.attackId, page: 0, pageSize: 10 });

    expect(progress.length).toBeGreaterThanOrEqual(2);
    expect(results.results.some(result => result.isAnomalous)).toBe(true);
    expect(results.results.some(result => result.statusCode === 500)).toBe(true);
  });

  it('gracefully stops a running attack', async () => {
    const server = await startUpstreamServer((req, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('slow');
      }, 40);
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const engine = createIntruderEngine();
    let stopRequested = false;
    engine.on('progress', async (payload) => {
      if (!stopRequested && payload.lastResult) {
        stopRequested = true;
        await engine.stop({ attackId: payload.attackId });
      }
    });

    const configured = await engine.configure({
      config: {
        requestTemplate: {
          method: 'GET',
          url: `http://127.0.0.1:${port}/slow?q=§term§`,
          headers: { host: `127.0.0.1:${port}` },
        },
        positions: [
          { source: { type: 'dictionary', items: ['a', 'b', 'c', 'd'] } },
        ],
      },
    });

    const started = await engine.start({ configId: configured.configId });
    const completed = await waitForAttack(engine, started.attackId);
    const results = await engine.results({ attackId: started.attackId, page: 0, pageSize: 10 });

    expect(completed.status).toBe('stopped');
    expect(results.total).toBeGreaterThan(0);
    expect(results.total).toBeLessThan(4);
  });
});
