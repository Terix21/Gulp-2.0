import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';

const { createRepeaterService } = require('../repeater-service');
const { createProtocolSupport } = require('../protocol-support');
const { createInterceptEngine } = require('../intercept-engine');
const { createHistoryLog } = require('../history-log');
const { createRulesEngine } = require('../rules-engine');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function startUpstreamServer(handler) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handler);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

describe('SEN-16 Repeater service', () => {
  const cleanup = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const fn = cleanup.pop();
      await fn();
    }
  });

  it('sends a request to the upstream and returns a real response', async () => {
    const server = await startUpstreamServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('hello from upstream');
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const repeater = createRepeaterService();
    const result = await repeater.send({
      request: {
        method: 'GET',
        url: `http://127.0.0.1:${port}/hello`,
        headers: { host: `127.0.0.1:${port}` },
      },
    });

    expect(result.response.statusCode).toBe(200);
    expect(result.response.body).toContain('hello from upstream');
    expect(result.response.contentType).toBe('text/plain');
    expect(result.response.bodyLength).toBeGreaterThan(0);
  });

  it('stores rawBodyBase64 for binary responses enabling hex display', async () => {
    const binaryPayload = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const server = await startUpstreamServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(binaryPayload);
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const repeater = createRepeaterService();
    const result = await repeater.send({
      request: {
        method: 'GET',
        url: `http://127.0.0.1:${port}/binary`,
        headers: { host: `127.0.0.1:${port}` },
      },
    });

    expect(result.response.body).toBeNull();
    expect(result.response.bodyLength).toBe(binaryPayload.length);
    expect(typeof result.response.rawBodyBase64).toBe('string');
    const decoded = Buffer.from(result.response.rawBodyBase64, 'base64');
    expect(decoded.equals(binaryPayload)).toBe(true);
  });

  it('creates a new entry with a sends array on first send', async () => {
    const server = await startUpstreamServer((req, res) => {
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const repeater = createRepeaterService();
    const result = await repeater.send({
      request: {
        method: 'POST',
        url: `http://127.0.0.1:${port}/create`,
        headers: { host: `127.0.0.1:${port}`, 'content-type': 'application/json' },
        body: '{"test":true}',
      },
    });

    expect(result.entry.id).toBeTruthy();
    const entryId = result.entry.id;

    // getEntry returns full entry including sends
    const full = repeater.getEntry(entryId);
    expect(full).not.toBeNull();
    expect(Array.isArray(full.sends)).toBe(true);
    expect(full.sends).toHaveLength(1);
    expect(full.sends[0].response.statusCode).toBe(201);
  });

  it('appends to sends history when resending with entryId — AC 4', async () => {
    let callCount = 0;
    const server = await startUpstreamServer((req, res) => {
      callCount += 1;
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`call ${callCount}`);
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const repeater = createRepeaterService();
    const first = await repeater.send({
      request: {
        method: 'GET',
        url: `http://127.0.0.1:${port}/test`,
        headers: { host: `127.0.0.1:${port}` },
      },
    });

    const entryId = first.entry.id;

    await repeater.send({
      request: {
        method: 'GET',
        url: `http://127.0.0.1:${port}/test`,
        headers: { host: `127.0.0.1:${port}` },
      },
      entryId,
    });

    const full = repeater.getEntry(entryId);
    expect(full.sends).toHaveLength(2);
    expect(full.sends[0].response.body).toBe('call 2');
    expect(full.sends[1].response.body).toBe('call 1');
  });

  it('listHistory returns lightweight entries without sends arrays', async () => {
    const server = await startUpstreamServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const repeater = createRepeaterService();
    await repeater.send({
      request: {
        method: 'GET',
        url: `http://127.0.0.1:${port}/a`,
        headers: { host: `127.0.0.1:${port}` },
      },
    });
    await repeater.send({
      request: {
        method: 'POST',
        url: `http://127.0.0.1:${port}/b`,
        headers: { host: `127.0.0.1:${port}` },
      },
    });

    const list = repeater.listHistory();
    expect(list.items).toHaveLength(2);
    for (const item of list.items) {
      expect(item.sends).toBeUndefined();
      expect(item.id).toBeTruthy();
      expect(item.request.method).toBeTruthy();
    }
  });

  it('getEntry returns null for unknown id', () => {
    const repeater = createRepeaterService();
    expect(repeater.getEntry('nonexistent-id')).toBeNull();
  });

  it('does not store rawBody Buffer in persisted entry', async () => {
    const server = await startUpstreamServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('body content');
    });
    cleanup.push(() => new Promise(resolve => server.close(resolve)));
    const port = server.address().port;

    const repeater = createRepeaterService();
    const result = await repeater.send({
      request: {
        method: 'GET',
        url: `http://127.0.0.1:${port}/`,
        headers: { host: `127.0.0.1:${port}` },
      },
    });

    // response returned from send() should not have rawBody Buffer
    expect(result.response.rawBody).toBeUndefined();

    // stored entry should not have rawBody either
    const full = repeater.getEntry(result.entry.id);
    expect(full.response.rawBody).toBeUndefined();
    expect(full.sends[0].response.rawBody).toBeUndefined();
  });

  it('send failure throws without corrupting the entry list', async () => {
    const repeater = createRepeaterService();

    await expect(repeater.send({
      request: {
        method: 'GET',
        url: 'http://127.0.0.1:1/unreachable',
        headers: { host: '127.0.0.1:1' },
      },
    })).rejects.toThrow();

    expect(repeater.listHistory().items).toHaveLength(0);
  });

  it('forwardRequest is accessible as a standalone export from protocol-support', () => {
    const { forwardRequest } = require('../protocol-support');
    expect(typeof forwardRequest).toBe('function');
  });
});
