import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

function executePreload() {
  const preloadPath = path.resolve(__dirname, '..', 'preload.js');
  const source = fs.readFileSync(preloadPath, 'utf8');

  const exposed = {};
  const exposeInMainWorld = vi.fn((name, api) => {
    exposed[name] = api;
  });
  const ipcOn = vi.fn();
  const ipcInvoke = vi.fn();
  const ipcRemoveListener = vi.fn();

  const sandbox = {
    module: { exports: {} },
    exports: {},
    require: (id) => {
      if (id === 'electron') {
        return {
          contextBridge: { exposeInMainWorld },
          ipcRenderer: {
            on: ipcOn,
            invoke: ipcInvoke,
            removeListener: ipcRemoveListener,
          },
        };
      }
      if (id === 'node:fs') {
        return fs;
      }
      if (id === 'node:path') {
        return path;
      }
      if (id === '../contracts/build-info.json') {
        return {
          appName: 'gulp',
          version: '1.0.0',
          git: { commitCount: '64' },
        };
      }
      throw new Error(`Unexpected module in preload test: ${id}`);
    },
    process: {
      versions: {
        node: '20.11.1',
        chrome: '130.0.1',
        electron: '41.1.0',
      },
    },
    __dirname: path.dirname(preloadPath),
    __filename: preloadPath,
    console,
  };

  // Safe: vm.runInNewContext with trusted codebase source in isolated sandbox.
  // Source is from preload.js (trusted); sandbox has no untrusted input.
  // NOSONAR S1522 — Dynamic code execution is necessary for preload testing.
  vm.runInNewContext(source, sandbox, { filename: preloadPath });  // NOSONAR

  return {
    exposed,
    exposeInMainWorld,
    ipcOn,
    ipcInvoke,
    ipcRemoveListener,
  };
}

describe('Preload Bridge API Surface', () => {
  it('exposes sentinel, electronInfo, and buildInfo through contextBridge', () => {
    const { exposed, exposeInMainWorld } = executePreload();

    expect(exposeInMainWorld).toHaveBeenCalledTimes(3);
    expect(Object.keys(exposed).sort((a, b) => a.localeCompare(b))).toEqual(['buildInfo', 'electronInfo', 'sentinel']);
  });

  it('exposes sentinel namespaces expected by the IPC contract', () => {
    const { exposed } = executePreload();
    const sentinel = exposed.sentinel;

    expect(sentinel).toBeDefined();
    expect(Object.keys(sentinel).sort((a, b) => a.localeCompare(b))).toEqual([
      'browser',
      'ca',
      'console',
      'decoder',
      'extensions',
      'history',
      'intruder',
      'oob',
      'project',
      'proxy',
      'repeater',
      'rules',
      'scanner',
      'scope',
      'sequencer',
      'target',
    ]);
  });

  it('routes invoke APIs through ipcRenderer.invoke with expected channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { sentinel } = exposed;

    sentinel.proxy.start({ port: 8080 });
    sentinel.history.query({ page: 0, pageSize: 25 });
    sentinel.project.meta();
    sentinel.ca.trustGuidance();

    expect(ipcInvoke).toHaveBeenCalledWith('proxy:start', { port: 8080 });
    expect(ipcInvoke).toHaveBeenCalledWith('history:query', { page: 0, pageSize: 25 });
    expect(ipcInvoke).toHaveBeenCalledWith('project:meta', {});
    expect(ipcInvoke).toHaveBeenCalledWith('ca:trust:guidance', {});
  });

  it('push subscriptions return unsubscribe and remove wrapped listeners', () => {
    const { exposed, ipcOn, ipcRemoveListener } = executePreload();
    const { sentinel } = exposed;
    const handler = vi.fn();

    const unsubscribe = sentinel.history.onPush(handler);

    expect(ipcOn).toHaveBeenCalledWith('history:push', expect.any(Function));
    expect(typeof unsubscribe).toBe('function');

    const wrappedListener = ipcOn.mock.calls[0][1];
    wrappedListener({}, { id: 'history-1' });
    expect(handler).toHaveBeenCalledWith({ id: 'history-1' });

    unsubscribe();
    expect(ipcRemoveListener).toHaveBeenCalledWith('history:push', wrappedListener);
  });

  it('electronInfo exposes version strings from process.versions', () => {
    const { exposed } = executePreload();

    expect(exposed.electronInfo.versions).toEqual({
      node: '20.11.1',
      chrome: '130.0.1',
      electron: '41.1.0',
    });
  });

  it('buildInfo exposes generated build metadata when available', () => {
    const { exposed } = executePreload();

    expect(typeof exposed.buildInfo).toBe('object');
    expect(typeof exposed.buildInfo.version).toBe('string');
  });
});

describe('Preload Bridge - all invoke channels', () => {
  it('proxy namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { proxy } = exposed.sentinel;

    proxy.start({ port: 9090 });
    proxy.stop();
    proxy.status();
    proxy.intercept.toggle({ enabled: true });
    proxy.intercept.forward({ requestId: 'req-1' });
    proxy.intercept.drop({ requestId: 'req-1' });

    expect(ipcInvoke).toHaveBeenCalledWith('proxy:start', { port: 9090 });
    expect(ipcInvoke).toHaveBeenCalledWith('proxy:stop', {});
    expect(ipcInvoke).toHaveBeenCalledWith('proxy:status', {});
    expect(ipcInvoke).toHaveBeenCalledWith('proxy:intercept:toggle', { enabled: true });
    expect(ipcInvoke).toHaveBeenCalledWith('proxy:intercept:forward', { requestId: 'req-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('proxy:intercept:drop', { requestId: 'req-1' });
  });

  it('history namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { history } = exposed.sentinel;

    history.query({ page: 0, pageSize: 10 });
    history.get({ id: 'item-1' });
    history.clear();

    expect(ipcInvoke).toHaveBeenCalledWith('history:query', { page: 0, pageSize: 10 });
    expect(ipcInvoke).toHaveBeenCalledWith('history:get', { id: 'item-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('history:clear', {});
  });

  it('rules namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { rules } = exposed.sentinel;

    rules.list();
    rules.save({ rules: [{ id: 'r1' }] });

    expect(ipcInvoke).toHaveBeenCalledWith('rules:list', {});
    expect(ipcInvoke).toHaveBeenCalledWith('rules:save', { rules: [{ id: 'r1' }] });
  });

  it('repeater namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { repeater } = exposed.sentinel;

    repeater.send({ request: { method: 'GET', url: 'https://example.com/' } });
    repeater.historyList();
    repeater.get({ id: 'entry-1' });

    expect(ipcInvoke).toHaveBeenCalledWith('repeater:send', { request: { method: 'GET', url: 'https://example.com/' } });
    expect(ipcInvoke).toHaveBeenCalledWith('repeater:history:list', {});
    expect(ipcInvoke).toHaveBeenCalledWith('repeater:get', { id: 'entry-1' });
  });

  it('intruder namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { intruder } = exposed.sentinel;

    intruder.configure({ config: { mode: 'sniper' } });
    intruder.start({ configId: 'cfg-1' });
    intruder.stop({ attackId: 'atk-1' });
    intruder.list();
    intruder.results({ attackId: 'atk-1', page: 0, pageSize: 25 });

    expect(ipcInvoke).toHaveBeenCalledWith('intruder:configure', { config: { mode: 'sniper' } });
    expect(ipcInvoke).toHaveBeenCalledWith('intruder:start', { configId: 'cfg-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('intruder:stop', { attackId: 'atk-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('intruder:list', {});
    expect(ipcInvoke).toHaveBeenCalledWith('intruder:results', { attackId: 'atk-1', page: 0, pageSize: 25 });
  });

  it('target and scope namespaces use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { target, scope } = exposed.sentinel;

    target.sitemap();
    scope.get();
    scope.set({ rules: [{ host: 'x.com' }] });
    scope.importBurp({});
    scope.importCsv({ format: 'hackerone' });

    expect(ipcInvoke).toHaveBeenCalledWith('target:sitemap', {});
    expect(ipcInvoke).toHaveBeenCalledWith('scope:get', {});
    expect(ipcInvoke).toHaveBeenCalledWith('scope:set', { rules: [{ host: 'x.com' }] });
    expect(ipcInvoke).toHaveBeenCalledWith('scope:import:burp', {});
    expect(ipcInvoke).toHaveBeenCalledWith('scope:import:csv', { format: 'hackerone' });
  });

  it('scope import always delegates file selection to the native dialog', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { scope } = exposed.sentinel;

    scope.importCsv({ format: 'generic' });
    scope.importBurp({});

    expect(ipcInvoke).toHaveBeenCalledWith('scope:import:csv', { format: 'generic' });
    expect(ipcInvoke).toHaveBeenCalledWith('scope:import:burp', {});
  });

  it('scanner namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { scanner } = exposed.sentinel;

    scanner.start({ targets: ['https://example.com'], config: {} });
    scanner.stop({ scanId: 'scan-1' });
    scanner.results({ scanId: 'scan-1', page: 0, pageSize: 25 });

    expect(ipcInvoke).toHaveBeenCalledWith('scanner:start', { targets: ['https://example.com'], config: {} });
    expect(ipcInvoke).toHaveBeenCalledWith('scanner:stop', { scanId: 'scan-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('scanner:results', { scanId: 'scan-1', page: 0, pageSize: 25 });
  });

  it('decoder namespace uses correct channel', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { decoder } = exposed.sentinel;

    decoder.process({ input: 'aGVsbG8=', operations: [{ op: 'base64:decode' }] });

    expect(ipcInvoke).toHaveBeenCalledWith('decoder:process', { input: 'aGVsbG8=', operations: [{ op: 'base64:decode' }] });
  });

  it('browser namespace uses correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { browser } = exposed.sentinel;

    browser.createSession({ name: 'Primary' });
    browser.getSession({ sessionId: 'sess-1' });
    browser.focusSession({ sessionId: 'sess-1' });
    browser.listSessions();
    browser.showView({ sessionId: 'sess-1' });
    browser.hideView({ sessionId: 'sess-1' });
    browser.setBounds({ sessionId: 'sess-1', bounds: { x: 10, y: 20, width: 640, height: 480 } });
    browser.navigate({ sessionId: 'sess-1', url: 'https://example.com' });
    browser.back({ sessionId: 'sess-1' });
    browser.forward({ sessionId: 'sess-1' });
    browser.reload({ sessionId: 'sess-1' });
    browser.stop({ sessionId: 'sess-1' });
    browser.closeSession({ sessionId: 'sess-1' });

    expect(ipcInvoke).toHaveBeenCalledWith('browser:session:create', { name: 'Primary' });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:session:get', { sessionId: 'sess-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:session:focus', { sessionId: 'sess-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:sessions:list', {});
    expect(ipcInvoke).toHaveBeenCalledWith('browser:view:show', { sessionId: 'sess-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:view:hide', { sessionId: 'sess-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:view:set-bounds', { sessionId: 'sess-1', bounds: { x: 10, y: 20, width: 640, height: 480 } });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:navigate', { sessionId: 'sess-1', url: 'https://example.com' });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:back', { sessionId: 'sess-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:forward', { sessionId: 'sess-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:reload', { sessionId: 'sess-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:stop', { sessionId: 'sess-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('browser:session:close', { sessionId: 'sess-1' });
  });

  it('browser namespace push subscriptions unsubscribe cleanly', () => {
    const { exposed, ipcOn, ipcRemoveListener } = executePreload();
    const { browser } = exposed.sentinel;
    const handler = vi.fn();

    const unsubscribeState = browser.onState(handler);
    const unsubscribeStart = browser.onNavigateStart(handler);
    const unsubscribeComplete = browser.onNavigateComplete(handler);
    const unsubscribeError = browser.onNavigateError(handler);
    const unsubscribeTitle = browser.onTitleUpdated(handler);

    expect(ipcOn).toHaveBeenCalledWith('browser:state', expect.any(Function));
    expect(ipcOn).toHaveBeenCalledWith('browser:navigate:start', expect.any(Function));
    expect(ipcOn).toHaveBeenCalledWith('browser:navigate:complete', expect.any(Function));
    expect(ipcOn).toHaveBeenCalledWith('browser:navigate:error', expect.any(Function));
    expect(ipcOn).toHaveBeenCalledWith('browser:title:updated', expect.any(Function));

    const wrappedState = ipcOn.mock.calls.find(call => call[0] === 'browser:state')[1];
    wrappedState({}, { reason: 'session:create' });
    expect(handler).toHaveBeenCalledWith({ reason: 'session:create' });

    unsubscribeState();
    unsubscribeStart();
    unsubscribeComplete();
    unsubscribeError();
    unsubscribeTitle();

    expect(ipcRemoveListener).toHaveBeenCalledWith('browser:state', wrappedState);
    expect(ipcRemoveListener).toHaveBeenCalledWith('browser:navigate:start', expect.any(Function));
    expect(ipcRemoveListener).toHaveBeenCalledWith('browser:navigate:complete', expect.any(Function));
    expect(ipcRemoveListener).toHaveBeenCalledWith('browser:navigate:error', expect.any(Function));
    expect(ipcRemoveListener).toHaveBeenCalledWith('browser:title:updated', expect.any(Function));
  });

  it('oob namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { oob } = exposed.sentinel;

    oob.createPayload({ type: 'dns' });
    oob.listHits({ id: 'p1' });

    expect(ipcInvoke).toHaveBeenCalledWith('oob:payload:create', { type: 'dns' });
    expect(ipcInvoke).toHaveBeenCalledWith('oob:hits:list', { id: 'p1' });
  });

  it('sequencer namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { sequencer } = exposed.sentinel;

    sequencer.captureStart({ config: { requestId: 'req-1' } });
    sequencer.captureStop({ sessionId: 'sess-1' });
    sequencer.analyze({ sessionId: 'sess-1' });

    expect(ipcInvoke).toHaveBeenCalledWith('sequencer:capture:start', { config: { requestId: 'req-1' } });
    expect(ipcInvoke).toHaveBeenCalledWith('sequencer:capture:stop', { sessionId: 'sess-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('sequencer:analyze', { sessionId: 'sess-1' });
  });

  it('extensions namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { extensions } = exposed.sentinel;
    const extPath = path.join(os.tmpdir(), 'ext.zip');

    extensions.list();
    extensions.install({ packagePath: extPath });
    extensions.uninstall({ id: 'ext-1' });
    extensions.toggle({ id: 'ext-1', enabled: false });

    expect(ipcInvoke).toHaveBeenCalledWith('extensions:list', {});
    expect(ipcInvoke).toHaveBeenCalledWith('extensions:install', { packagePath: extPath });
    expect(ipcInvoke).toHaveBeenCalledWith('extensions:uninstall', { id: 'ext-1' });
    expect(ipcInvoke).toHaveBeenCalledWith('extensions:toggle', { id: 'ext-1', enabled: false });
  });

  it('project namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { project } = exposed.sentinel;
    const projectPath = path.join(os.tmpdir(), 'project.db');
    const projPath = path.join(os.tmpdir(), 'proj.db');

    project.new({ name: 'New Project', filePath: projectPath });
    project.open({ filePath: projPath });
    project.save();
    project.close();
    project.meta();

    expect(ipcInvoke).toHaveBeenCalledWith('project:new', { name: 'New Project', filePath: projectPath });
    expect(ipcInvoke).toHaveBeenCalledWith('project:open', { filePath: projPath });
    expect(ipcInvoke).toHaveBeenCalledWith('project:save', {});
    expect(ipcInvoke).toHaveBeenCalledWith('project:close', {});
    expect(ipcInvoke).toHaveBeenCalledWith('project:meta', {});
  });

  it('ca namespace: all invoke methods use correct channels', () => {
    const { exposed, ipcInvoke } = executePreload();
    const { ca } = exposed.sentinel;
    const caPath = path.join(os.tmpdir(), 'ca.pem');

    ca.get();
    ca.export({ destPath: caPath });
    ca.rotate();

    expect(ipcInvoke).toHaveBeenCalledWith('ca:get', {});
    expect(ipcInvoke).toHaveBeenCalledWith('ca:export', { destPath: caPath });
    expect(ipcInvoke).toHaveBeenCalledWith('ca:rotate', {});
  });
});

describe('Preload Bridge - all push channels', () => {
  it('proxy intercept onRequest registers a push listener and delivers events', () => {
    const { exposed, ipcOn, ipcRemoveListener } = executePreload();
    const handler = vi.fn();

    const unsub = exposed.sentinel.proxy.intercept.onRequest(handler);

    expect(ipcOn).toHaveBeenCalledWith('proxy:intercept:request', expect.any(Function));
    const wrapped = ipcOn.mock.calls[0][1];
    wrapped({}, { id: 'req-1', method: 'POST' });
    expect(handler).toHaveBeenCalledWith({ id: 'req-1', method: 'POST' });

    unsub();
    expect(ipcRemoveListener).toHaveBeenCalledWith('proxy:intercept:request', wrapped);
  });

  it('proxy intercept onResponse registers a push listener and delivers events', () => {
    const { exposed, ipcOn, ipcRemoveListener } = executePreload();
    const handler = vi.fn();

    const unsub = exposed.sentinel.proxy.intercept.onResponse(handler);

    expect(ipcOn).toHaveBeenCalledWith('proxy:intercept:response', expect.any(Function));
    const wrapped = ipcOn.mock.calls[0][1];
    wrapped({}, { id: 'res-1', statusCode: 200 });
    expect(handler).toHaveBeenCalledWith({ id: 'res-1', statusCode: 200 });

    unsub();
    expect(ipcRemoveListener).toHaveBeenCalledWith('proxy:intercept:response', wrapped);
  });

  it('intruder onProgress registers a push listener and delivers progress events', () => {
    const { exposed, ipcOn, ipcRemoveListener } = executePreload();
    const handler = vi.fn();

    const unsub = exposed.sentinel.intruder.onProgress(handler);

    expect(ipcOn).toHaveBeenCalledWith('intruder:progress', expect.any(Function));
    const wrapped = ipcOn.mock.calls[0][1];
    wrapped({}, { attackId: 'atk-1', sent: 50, total: 100, lastResult: null });
    expect(handler).toHaveBeenCalledWith({ attackId: 'atk-1', sent: 50, total: 100, lastResult: null });

    unsub();
    expect(ipcRemoveListener).toHaveBeenCalledWith('intruder:progress', wrapped);
  });

  it('scanner onProgress registers a push listener and delivers progress events', () => {
    const { exposed, ipcOn, ipcRemoveListener } = executePreload();
    const handler = vi.fn();

    const unsub = exposed.sentinel.scanner.onProgress(handler);

    expect(ipcOn).toHaveBeenCalledWith('scanner:progress', expect.any(Function));
    const wrapped = ipcOn.mock.calls[0][1];
    wrapped({}, { scanId: 'scan-1', pct: 10 });
    expect(handler).toHaveBeenCalledWith({ scanId: 'scan-1', pct: 10 });

    unsub();
    expect(ipcRemoveListener).toHaveBeenCalledWith('scanner:progress', wrapped);
  });

  it('oob onHit registers a push listener and delivers hit events', () => {
    const { exposed, ipcOn, ipcRemoveListener } = executePreload();
    const handler = vi.fn();

    const unsub = exposed.sentinel.oob.onHit(handler);

    expect(ipcOn).toHaveBeenCalledWith('oob:hit', expect.any(Function));
    const wrapped = ipcOn.mock.calls[0][1];
    wrapped({}, { payloadId: 'p1', source: '127.0.0.1' });
    expect(handler).toHaveBeenCalledWith({ payloadId: 'p1', source: '127.0.0.1' });

    unsub();
    expect(ipcRemoveListener).toHaveBeenCalledWith('oob:hit', wrapped);
  });

  it('multiple simultaneous push subscribers are independent', () => {
    const { exposed, ipcOn, ipcRemoveListener } = executePreload();
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    const unsubA = exposed.sentinel.history.onPush(handlerA);
    const unsubB = exposed.sentinel.history.onPush(handlerB);

    const wrappedA = ipcOn.mock.calls[0][1];
    const wrappedB = ipcOn.mock.calls[1][1];

    wrappedA({}, { id: 'item-1' });
    wrappedB({}, { id: 'item-2' });

    expect(handlerA).toHaveBeenCalledWith({ id: 'item-1' });
    expect(handlerB).toHaveBeenCalledWith({ id: 'item-2' });

    unsubA();
    expect(ipcRemoveListener).toHaveBeenCalledWith('history:push', wrappedA);
    unsubB();
    expect(ipcRemoveListener).toHaveBeenCalledWith('history:push', wrappedB);
  });
});
