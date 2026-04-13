import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';

const { createInterceptEngine } = require('../intercept-engine');
const { createRulesEngine } = require('../rules-engine');
const { createHistoryLog } = require('../history-log');
const {
  createProtocolSupport,
  setForwardRuntimeConfig,
} = require('../protocol-support');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readResponseBody(response) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    response.on('data', chunk => chunks.push(Buffer.from(chunk)));
    response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    response.on('error', reject);
  });
}

function requestViaProxy(proxyPort, targetUrl) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: proxyPort,
      method: 'GET',
      path: targetUrl,
      headers: {
        host: new URL(targetUrl).host,
      },
    }, async (res) => {
      const body = await readResponseBody(res);
      resolve({ statusCode: res.statusCode, body });
    });

    req.on('error', reject);
    req.end();
  });
}

function requestBinaryViaProxy(proxyPort, targetUrl, payload) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: proxyPort,
      method: 'POST',
      path: targetUrl,
      headers: {
        host: new URL(targetUrl).host,
        'content-type': 'application/octet-stream',
        'content-length': payload.length,
      },
    }, async (res) => {
      const body = await readResponseBody(res);
      resolve({ statusCode: res.statusCode, body });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function requestOriginFormViaProxy(proxyPort, hostHeader, requestPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: proxyPort,
      method: 'GET',
      path: requestPath,
      headers: {
        host: hostHeader,
      },
    }, async (res) => {
      const body = await readResponseBody(res);
      resolve({ statusCode: res.statusCode, body });
    });

    req.on('error', reject);
    req.end();
  });
}

describe('SEN-14 proxy core', () => {
  const cleanup = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const fn = cleanup.pop();
      await fn();
    }
  });

  it('queues intercepted requests, supports edit, and forwards modified traffic', async () => {
    const rulesEngine = createRulesEngine([
      {
        id: 'replace-path',
        priority: 1,
        enabled: true,
        match: { path: { operator: 'contains', value: '/old' } },
        actions: [{ type: 'replace', target: 'path', find: '/old', replace: '/new' }],
      },
    ]);
    const interceptEngine = createInterceptEngine({ rulesEngine, interceptEnabled: true });

    let forwarded = null;
    const captured = interceptEngine.captureRequest({
      id: 'req-1',
      method: 'POST',
      host: 'example.test',
      path: '/old',
      headers: { 'content-type': 'text/plain' },
      body: 'alpha',
    }, async (request) => {
      forwarded = request;
      return { statusCode: 200, body: 'ok' };
    });

    expect(interceptEngine.getQueue()).toHaveLength(1);

    interceptEngine.edit('req-1', { path: '/old?q=1', body: 'beta' });
    await interceptEngine.forward('req-1');

    const result = await captured;
    expect(result.action).toBe('forwarded');
    expect(forwarded.path).toBe('/new?q=1');
    expect(forwarded.body).toBe('beta');
    expect(interceptEngine.getQueue()).toHaveLength(0);
  });

  it('drops intercepted requests without forwarding upstream', async () => {
    const interceptEngine = createInterceptEngine({ interceptEnabled: true });
    let forwardedCount = 0;

    const captured = interceptEngine.captureRequest({
      id: 'req-drop',
      method: 'GET',
      host: 'drop.test',
      path: '/drop',
      headers: {},
      body: null,
    }, async () => {
      forwardedCount += 1;
      return { statusCode: 200 };
    });

    const result = interceptEngine.drop('req-drop');
    expect(result.ok).toBe(true);

    const dropped = await captured;
    expect(dropped.action).toBe('dropped');
    expect(forwardedCount).toBe(0);
  });

  it('keeps queued request on forward failure and emits forward-error', async () => {
    const interceptEngine = createInterceptEngine({ interceptEnabled: true });

    const events = [];
    interceptEngine.on('forward-error', payload => {
      events.push(payload);
    });

    interceptEngine.captureRequest({
      id: 'req-fail',
      method: 'GET',
      host: 'fail.test',
      path: '/fail',
      headers: {},
      body: null,
    }, async () => {
      throw new Error('upstream unavailable');
    });

    await expect(interceptEngine.forward('req-fail')).rejects.toThrow('upstream unavailable');
    expect(interceptEngine.getQueue()).toHaveLength(1);
    expect(interceptEngine.getQueue()[0].id).toBe('req-fail');
    expect(events).toHaveLength(1);
    expect(events[0].requestId).toBe('req-fail');
    expect(events[0].error).toContain('upstream unavailable');
  });

  it('global pause holds requests and resume forwards all when interception is disabled', async () => {
    const interceptEngine = createInterceptEngine({ interceptEnabled: false });
    interceptEngine.pause();

    const forwardedIds = [];
    const first = interceptEngine.captureRequest({
      id: 'pause-1',
      method: 'GET',
      host: 'pause.test',
      path: '/one',
      headers: {},
      body: null,
    }, async (request) => {
      forwardedIds.push(request.id);
      return { statusCode: 200 };
    });

    const second = interceptEngine.captureRequest({
      id: 'pause-2',
      method: 'GET',
      host: 'pause.test',
      path: '/two',
      headers: {},
      body: null,
    }, async (request) => {
      forwardedIds.push(request.id);
      return { statusCode: 200 };
    });

    expect(interceptEngine.getQueue()).toHaveLength(2);

    interceptEngine.resume();
    await first;
    await second;

    expect(forwardedIds).toEqual(['pause-1', 'pause-2']);
    expect(interceptEngine.getQueue()).toHaveLength(0);
  });

  it('resumeQueued continues after failures and returns a summary', async () => {
    const interceptEngine = createInterceptEngine({ interceptEnabled: true });

    const failCapture = interceptEngine.captureRequest({
      id: 'resume-fail',
      method: 'GET',
      host: 'resume.test',
      path: '/fail',
      headers: {},
      body: null,
    }, async () => {
      throw new Error('boom');
    });

    const okCapture = interceptEngine.captureRequest({
      id: 'resume-ok',
      method: 'GET',
      host: 'resume.test',
      path: '/ok',
      headers: {},
      body: null,
    }, async () => ({ statusCode: 200 }));

    const summary = await interceptEngine.resumeQueued();
    expect(summary).toEqual({
      attempted: 2,
      succeeded: 1,
      failed: 1,
      failures: ['resume-fail'],
    });

    const okResult = await okCapture;
    expect(okResult.action).toBe('forwarded');
    expect(interceptEngine.getQueue().map(item => item.id)).toEqual(['resume-fail']);

    interceptEngine.drop('resume-fail');
    await failCapture;
  });

  it('logs traffic history and supports filter/query semantics', async () => {
    const history = createHistoryLog({ maxItems: 2 });

    await history.logTraffic({
      id: 'hist-1',
      kind: 'http',
      timestamp: 1,
      request: { method: 'GET', host: 'a.test', path: '/one' },
      response: { statusCode: 200 },
    });
    await history.logTraffic({
      id: 'hist-2',
      kind: 'http',
      timestamp: 2,
      request: { method: 'POST', host: 'b.test', path: '/two' },
      response: { statusCode: 201 },
    });
    await history.logTraffic({
      id: 'hist-3',
      kind: 'http',
      timestamp: 3,
      request: { method: 'GET', host: 'a.test', path: '/three' },
      response: { statusCode: 404 },
    });

    const all = await history.query({ page: 0, pageSize: 10, filter: {} });
    expect(all.total).toBe(2);
    expect(all.items.map(item => item.id)).toEqual(['hist-3', 'hist-2']);

    const filtered = await history.query({ page: 0, pageSize: 10, filter: { host: 'a.test', method: 'GET' } });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0].id).toBe('hist-3');
  });

  it('treats invalid regex rules as non-match without throwing', async () => {
    const rulesEngine = createRulesEngine([
      {
        id: 'bad-regex',
        priority: 1,
        enabled: true,
        match: {
          host: { operator: 'regex', value: '[invalid', flags: 'z' },
        },
        actions: [{ type: 'replace', target: 'path', value: '/should-not-apply' }],
      },
    ]);

    expect(() => rulesEngine.applyToRequest({
      id: 'req-regex',
      method: 'GET',
      host: 'example.test',
      path: '/original',
      headers: {},
      body: null,
    })).not.toThrow();

    const result = rulesEngine.applyToRequest({
      id: 'req-regex-2',
      method: 'GET',
      host: 'example.test',
      path: '/original',
      headers: {},
      body: null,
    });

    expect(result.path).toBe('/original');
  });

  it('treats empty-string find in replace action as no-op', async () => {
    const rulesEngine = createRulesEngine([
      {
        id: 'empty-find',
        priority: 1,
        enabled: true,
        match: { path: '/api' },
        actions: [{ type: 'replace', target: 'path', find: '', replace: 'X' }],
      },
    ]);

    const result = rulesEngine.applyToRequest({
      id: 'req-empty-find',
      method: 'GET',
      host: 'example.test',
      path: '/api/v1/users',
      headers: {},
      body: null,
    });

    expect(result.path).toBe('/api/v1/users');
  });

  it('intercepts HTTP/1.1 proxy traffic, applies rules, and logs request/response pairs', async () => {
    const upstreamServer = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`upstream:${req.url}`);
    });

    await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstreamServer.address().port;
    cleanup.push(async () => {
      await new Promise(resolve => upstreamServer.close(resolve));
    });

    const rulesEngine = createRulesEngine([
      {
        id: 'rewrite-url',
        priority: 1,
        enabled: true,
        match: { host: '127.0.0.1' },
        actions: [{ type: 'replace', target: 'url', find: '/original', replace: '/rewritten' }],
      },
    ]);
    const historyLog = createHistoryLog();
    const interceptEngine = createInterceptEngine({ rulesEngine, interceptEnabled: false });
    const protocolSupport = createProtocolSupport({ rulesEngine, historyLog, interceptEngine });

    const started = await protocolSupport.start({ port: 0 });
    cleanup.push(async () => {
      await protocolSupport.stop();
    });

    const targetUrl = `http://127.0.0.1:${upstreamPort}/original?q=1`;
    const proxied = await requestViaProxy(started.port, targetUrl);

    expect(proxied.statusCode).toBe(200);
    expect(proxied.body).toContain('/rewritten?q=1');

    await delay(20);
    const traffic = await historyLog.query({ page: 0, pageSize: 10, filter: {} });

    expect(traffic.total).toBe(1);
    expect(traffic.items[0].request.method).toBe('GET');
    expect(traffic.items[0].response.statusCode).toBe(200);
  });

  it('forwards binary request payloads without utf8 corruption', async () => {
    let upstreamBodyHex = '';
    const upstreamServer = http.createServer((req, res) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        upstreamBodyHex = Buffer.concat(chunks).toString('hex');
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('ok');
      });
    });

    await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstreamServer.address().port;
    cleanup.push(async () => {
      await new Promise(resolve => upstreamServer.close(resolve));
    });

    const rulesEngine = createRulesEngine([]);
    const historyLog = createHistoryLog();
    const interceptEngine = createInterceptEngine({ rulesEngine, interceptEnabled: false });
    const protocolSupport = createProtocolSupport({ rulesEngine, historyLog, interceptEngine });

    const started = await protocolSupport.start({ port: 0 });
    cleanup.push(async () => {
      await protocolSupport.stop();
    });

    const payload = Buffer.from([0xff, 0x00, 0x01, 0x80, 0x41, 0x42, 0x43, 0x00]);
    const targetUrl = `http://127.0.0.1:${upstreamPort}/upload`;
    const proxied = await requestBinaryViaProxy(started.port, targetUrl, payload);

    expect(proxied.statusCode).toBe(200);
    expect(upstreamBodyHex).toBe(payload.toString('hex'));
  });

  it('stores binary upstream response with null body and accurate bodyLength', async () => {
    const binaryResponse = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x01, 0x02]);
    const upstreamServer = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(binaryResponse);
    });

    await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstreamServer.address().port;
    cleanup.push(async () => {
      await new Promise(resolve => upstreamServer.close(resolve));
    });

    const rulesEngine = createRulesEngine([]);
    const historyLog = createHistoryLog();
    const interceptEngine = createInterceptEngine({ rulesEngine, interceptEnabled: false });
    const protocolSupport = createProtocolSupport({ rulesEngine, historyLog, interceptEngine });

    const started = await protocolSupport.start({ port: 0 });
    cleanup.push(async () => {
      await protocolSupport.stop();
    });

    const targetUrl = `http://127.0.0.1:${upstreamPort}/bin-response`;
    const proxied = await requestViaProxy(started.port, targetUrl);
    expect(proxied.statusCode).toBe(200);

    await delay(20);
    const traffic = await historyLog.query({ page: 0, pageSize: 10, filter: {} });
    expect(traffic.total).toBe(1);
    expect(traffic.items[0].response.contentType).toBe('application/octet-stream');
    expect(traffic.items[0].response.body).toBeNull();
    expect(traffic.items[0].response.bodyLength).toBe(binaryResponse.length);
  });

  it('recomputes content-length when forwarded body differs from original headers', async () => {
    let observedContentLength = '';
    let observedTransferEncoding = '';
    let observedBody = '';

    const upstreamServer = http.createServer((req, res) => {
      const chunks = [];
      observedContentLength = String(req.headers['content-length'] || '');
      observedTransferEncoding = String(req.headers['transfer-encoding'] || '');
      req.on('data', chunk => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        observedBody = Buffer.concat(chunks).toString('utf8');
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('ok');
      });
    });

    await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstreamServer.address().port;
    cleanup.push(async () => {
      await new Promise(resolve => upstreamServer.close(resolve));
    });

    const protocolSupport = createProtocolSupport();
    const response = await protocolSupport.forwardHttpRequest({
      method: 'POST',
      host: '127.0.0.1',
      url: `http://127.0.0.1:${upstreamPort}/submit`,
      headers: {
        'content-length': '999',
        'transfer-encoding': 'chunked',
        'content-type': 'text/plain; charset=utf-8',
      },
      body: 'edited-body',
    });

    expect(response.statusCode).toBe(200);
    expect(observedBody).toBe('edited-body');
    expect(observedContentLength).toBe(String(Buffer.byteLength('edited-body', 'utf8')));
    expect(observedTransferEncoding).toBe('');
  });

  it('routes origin-form requests using explicit Host header port', async () => {
    const upstreamServer = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`origin:${req.url}`);
    });

    await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstreamServer.address().port;
    cleanup.push(async () => {
      await new Promise(resolve => upstreamServer.close(resolve));
    });

    const protocolSupport = createProtocolSupport({
      rulesEngine: createRulesEngine([]),
      historyLog: createHistoryLog(),
      interceptEngine: createInterceptEngine({ interceptEnabled: false }),
    });

    const started = await protocolSupport.start({ port: 0 });
    cleanup.push(async () => {
      await protocolSupport.stop();
    });

    const proxied = await requestOriginFormViaProxy(
      started.port,
      `127.0.0.1:${upstreamPort}`,
      '/origin-form?mode=host-header'
    );

    expect(proxied.statusCode).toBe(200);
    expect(proxied.body).toBe('origin:/origin-form?mode=host-header');
  });

  it('applies non-idempotent append rule exactly once in proxy pipeline', async () => {
    const upstreamServer = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`path:${req.url}`);
    });

    await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstreamServer.address().port;
    cleanup.push(async () => {
      await new Promise(resolve => upstreamServer.close(resolve));
    });

    const rulesEngine = createRulesEngine([
      {
        id: 'append-once',
        priority: 1,
        enabled: true,
        match: { host: '127.0.0.1' },
        actions: [{ type: 'append', target: 'url', value: '&once=1' }],
      },
    ]);
    const historyLog = createHistoryLog();
    const interceptEngine = createInterceptEngine({ rulesEngine, interceptEnabled: false });
    const protocolSupport = createProtocolSupport({ rulesEngine, historyLog, interceptEngine });

    const started = await protocolSupport.start({ port: 0 });
    cleanup.push(async () => {
      await protocolSupport.stop();
    });

    const targetUrl = `http://127.0.0.1:${upstreamPort}/double-check?x=1`;
    const proxied = await requestViaProxy(started.port, targetUrl);

    expect(proxied.statusCode).toBe(200);
    expect(proxied.body).toBe('path:/double-check?x=1&once=1');
  });

  it('applies configured custom headers and tool identifier header to forwarded traffic', async () => {
    let observedHeaders = {};
    const upstreamServer = http.createServer((req, res) => {
      observedHeaders = { ...req.headers };
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
    });

    await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstreamServer.address().port;
    cleanup.push(async () => {
      await new Promise(resolve => upstreamServer.close(resolve));
    });

    setForwardRuntimeConfig({
      customHeaders: {
        'X-Test-Header': 'alpha',
      },
      toolIdentifier: {
        enabled: true,
        headerName: 'X-Tool-Id',
        value: 'sentinel-suite',
      },
      staticIpAddresses: [],
    });

    try {
      const protocolSupport = createProtocolSupport();
      const response = await protocolSupport.forwardHttpRequest({
        method: 'GET',
        url: `http://127.0.0.1:${upstreamPort}/headers`,
        host: '127.0.0.1',
        headers: {
          accept: 'text/plain',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(observedHeaders['x-test-header']).toBe('alpha');
      expect(observedHeaders['x-tool-id']).toBe('sentinel-suite');
    } finally {
      setForwardRuntimeConfig({});
    }
  });

  it('passes selected static source IP as localAddress when forwarding', async () => {
    const upstreamServer = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
    });

    await new Promise(resolve => upstreamServer.listen(0, '127.0.0.1', resolve));
    const upstreamPort = upstreamServer.address().port;
    cleanup.push(async () => {
      await new Promise(resolve => upstreamServer.close(resolve));
    });

    const originalRequest = http.request;
    let capturedLocalAddress = '';
    http.request = function wrappedRequest(options, callback) {
      capturedLocalAddress = options?.localAddress ? String(options.localAddress) : '';
      return originalRequest.call(http, options, callback);
    };

    setForwardRuntimeConfig({
      customHeaders: {},
      toolIdentifier: {
        enabled: false,
      },
      staticIpAddresses: ['127.0.0.1'],
    });

    try {
      const protocolSupport = createProtocolSupport();
      const response = await protocolSupport.forwardHttpRequest({
        method: 'GET',
        url: `http://127.0.0.1:${upstreamPort}/local-address`,
        host: '127.0.0.1',
        headers: {},
      });
      expect(response.statusCode).toBe(200);
      expect(capturedLocalAddress).toBe('127.0.0.1');
    } finally {
      http.request = originalRequest;
      setForwardRuntimeConfig({});
    }
  });
});
