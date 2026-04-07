const electron = require('electron');
const { app, BrowserWindow, WebContentsView, ipcMain, dialog, session: electronSession } = electron;
const fs = require('node:fs/promises');
const path = require('path');
const caManager = require('./certs/ca-manager');
const projectStore = require('./db/project-store');
const protocolSupport = require('./proxy/protocol-support');
const interceptEngine = require('./proxy/intercept-engine');
const historyLog = require('./proxy/history-log');
const rulesEngine = require('./proxy/rules-engine');
const repeaterService = require('./proxy/repeater-service');
const intruderEngine = require('./proxy/intruder-engine');
const targetMapper = require('./proxy/target-mapper');
const scannerEngine = require('./proxy/scanner-engine');
const oobService = require('./proxy/oob-service');
const sequencerService = require('./proxy/sequencer-service');
const decoderService = require('./proxy/decoder-service');
const extensionHost = require('./proxy/extension-host');
const embeddedBrowserService = require('./proxy/embedded-browser-service');

let mainWindowRef = null;
let shutdownInProgress = null;
const embeddedBrowserViews = new Map();
let activeEmbeddedBrowserSessionId = '';
const pendingConsoleLogs = [];
const MAX_PENDING_CONSOLE_LOGS = 500;
const persistedConsoleLogHistory = [];
const MAX_CONSOLE_LOG_HISTORY = 5000;
const processOutputBuffers = {
  stdout: '',
  stderr: '',
};
let processOutputStreamingInstalled = false;
let runtimeLogHooksInstalled = false;
let consoleLogSequence = 0;
const DEFAULT_PROXY_RUNTIME_CONFIG = {
  customHeaders: {},
  toolIdentifier: {
    enabled: false,
    headerName: 'X-Sentinel-Tool',
    value: 'Gulp-Sentinel',
  },
  staticIpAddresses: [],
};

function normalizeProxyRuntimeConfig(input = {}) {
  const customHeaders = {};
  const rawHeaders = input && typeof input.customHeaders === 'object' && input.customHeaders
    ? input.customHeaders
    : {};
  for (const [name, value] of Object.entries(rawHeaders)) {
    const key = String(name || '').trim();
    if (!key) {
      continue;
    }
    customHeaders[key] = String(value == null ? '' : value);
  }

  const rawTool = input && typeof input.toolIdentifier === 'object' && input.toolIdentifier
    ? input.toolIdentifier
    : {};
  const headerName = String(rawTool.headerName || DEFAULT_PROXY_RUNTIME_CONFIG.toolIdentifier.headerName).trim() || DEFAULT_PROXY_RUNTIME_CONFIG.toolIdentifier.headerName;
  const value = String(rawTool.value == null ? DEFAULT_PROXY_RUNTIME_CONFIG.toolIdentifier.value : rawTool.value);

  const ips = Array.isArray(input.staticIpAddresses)
    ? [...new Set(input.staticIpAddresses.map(ip => String(ip || '').trim()).filter(Boolean))]
    : [];

  return {
    customHeaders,
    toolIdentifier: {
      enabled: Boolean(rawTool.enabled),
      headerName,
      value,
    },
    staticIpAddresses: ips,
  };
}

function hasVisibleBrowserBounds(bounds = {}) {
  return Number(bounds.width) > 0 && Number(bounds.height) > 0;
}

function isNavigationAbortError(error) {
  if (!error) {
    return false;
  }

  const code = typeof error.code === 'string' ? error.code.toUpperCase() : '';
  const errorCode = Number(error.errorCode);
  const message = String(error.message || error.toString() || '').toUpperCase();

  return code === 'ERR_ABORTED'
    || errorCode === -3
    || message.includes('ERR_ABORTED')
    || message.includes('(-3)');
}

function stringifyLogValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  if (value instanceof Error) {
    return value.stack || value.message || value.toString();
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    try {
      return String(value);
    } catch {
      return '[unprintable]';
    }
  }
}

function clampEmbeddedBrowserBounds(targetWindow, bounds = {}) {
  if (!targetWindow || typeof targetWindow.getContentBounds !== 'function') {
    return bounds;
  }

  const contentBounds = targetWindow.getContentBounds();
  const maxWidth = Math.max(0, Number(contentBounds.width) || 0);
  const maxHeight = Math.max(0, Number(contentBounds.height) || 0);
  const x = Math.min(Math.max(0, Number(bounds.x) || 0), maxWidth);
  const y = Math.min(Math.max(0, Number(bounds.y) || 0), maxHeight);

  return {
    x,
    y,
    width: Math.max(0, Math.min(Math.max(0, Number(bounds.width) || 0), maxWidth - x)),
    height: Math.max(0, Math.min(Math.max(0, Number(bounds.height) || 0), maxHeight - y)),
  };
}

function destroyEmbeddedBrowserView(sessionId) {
  const entry = embeddedBrowserViews.get(sessionId);
  if (!entry) {
    return;
  }

  const targetWindow = getActiveWindow();
  if (targetWindow && targetWindow.contentView && entry.attached) {
    try {
      targetWindow.contentView.removeChildView(entry.view);
    } catch {
      // Ignore detach failures during cleanup.
    }
  }

  try {
    if (entry.view && entry.view.webContents && typeof entry.view.webContents.isDestroyed === 'function' && !entry.view.webContents.isDestroyed()) {
      entry.view.webContents.destroy();
    }
  } catch {
    // Ignore view destruction failures during cleanup.
  }

  embeddedBrowserViews.delete(sessionId);
  if (activeEmbeddedBrowserSessionId === sessionId) {
    activeEmbeddedBrowserSessionId = '';
  }
}

function ensureEmbeddedBrowserView(sessionState) {
  if (!WebContentsView || !sessionState || !sessionState.id) {
    return null;
  }

  const existing = embeddedBrowserViews.get(sessionState.id);
  if (existing) {
    return existing;
  }

  const partition = String(sessionState.hostPartition || `sentinel-browser-${sessionState.id}`);
  const isolatedSession = electronSession && typeof electronSession.fromPartition === 'function'
    ? electronSession.fromPartition(partition)
    : null;

  if (isolatedSession && typeof isolatedSession.setPermissionRequestHandler === 'function') {
    isolatedSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false);
    });
  }

  if (isolatedSession && isolatedSession.webRequest && typeof isolatedSession.webRequest.onBeforeSendHeaders === 'function') {
    isolatedSession.webRequest.onBeforeSendHeaders((details, callback) => {
      const nextHeaders = { ...(details.requestHeaders || {}) };
      nextHeaders['X-Sentinel-Embedded-Browser'] = '1';
      callback({ requestHeaders: nextHeaders });
    });
  }

  // Trust all TLS certs in this isolated session — all traffic routes through the Sentinel
  // MITM proxy which presents its own CA-signed certs. Isolated partitions don't inherit
  // the system trust store, so cert verification is delegated to proxy routing intent.
  if (isolatedSession && typeof isolatedSession.setCertificateVerifyProc === 'function') {
    isolatedSession.setCertificateVerifyProc((_request, callback) => {
      callback(0);
    });
  }

  const view = new WebContentsView({
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (view.webContents && typeof view.webContents.setWindowOpenHandler === 'function') {
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  }

  view.webContents.on('did-start-loading', () => {
    const url = typeof view.webContents.getURL === 'function' ? view.webContents.getURL() : '';
    embeddedBrowserService.applyRuntimeState({
      sessionId: sessionState.id,
      loading: true,
      reason: 'chromium:did-start-loading',
    });
    sendConsoleLog('info', 'browser', 'Chromium did-start-loading', `session: ${sessionState.name || sessionState.id} · url: ${url || 'about:blank'}`);
  });

  view.webContents.on('did-stop-loading', () => {
    const currentUrl = typeof view.webContents.getURL === 'function' ? view.webContents.getURL() : '';
    const title = typeof view.webContents.getTitle === 'function' ? view.webContents.getTitle() : '';
    sendConsoleLog('info', 'browser', 'Chromium did-stop-loading', `session: ${sessionState.name || sessionState.id} · url: ${currentUrl || 'about:blank'}`);
    Promise.resolve(protocolSupport.getStatus())
      .then(status => embeddedBrowserService.completeRuntimeNavigation({
        sessionId: sessionState.id,
        proxyPort: status && status.running ? status.port : 0,
        currentUrl,
        title,
      }))
      .catch(() => embeddedBrowserService.completeRuntimeNavigation({
        sessionId: sessionState.id,
        currentUrl,
        title,
      }));
  });

  view.webContents.on('page-title-updated', (_event, title) => {
    embeddedBrowserService.applyRuntimeState({
      sessionId: sessionState.id,
      title: String(title || ''),
      reason: 'chromium:title:updated',
    });
  });

  view.webContents.on('did-fail-load', (_event, errorCode, description, validatedUrl) => {
    // ERR_ABORTED (-3) fires when an in-progress load is cancelled by a new navigation
    // (redirect, reload, programmatic navigate) — not a real failure; ignore it.
    if (isNavigationAbortError({ errorCode, message: description })) {
      sendConsoleLog('warn', 'browser', 'Chromium did-fail-load (ignored abort)', `code: ${errorCode} · ${String(description || 'n/a')} · url: ${String(validatedUrl || '')}`);
      return;
    }
    sendConsoleLog('error', 'browser', 'Chromium did-fail-load', `code: ${errorCode} · ${String(description || 'n/a')} · url: ${String(validatedUrl || '')}`);
    embeddedBrowserService.failRuntimeNavigation({
      sessionId: sessionState.id,
      url: String(validatedUrl || ''),
      error: new Error(String(description || 'Chromium load failed.')),
    });
  });

  const entry = {
    view,
    partition,
    attached: false,
  };
  embeddedBrowserViews.set(sessionState.id, entry);
  return entry;
}

function syncEmbeddedBrowserHost() {
  const targetWindow = getActiveWindow();
  const listed = embeddedBrowserService.listSessions();
  const sessions = Array.isArray(listed.items) ? listed.items : [];
  const activeSession = sessions.find(item => item.focused && item.visible && hasVisibleBrowserBounds(item.bounds)) || null;

  for (const [sessionId, entry] of embeddedBrowserViews.entries()) {
    if (!targetWindow || !activeSession || sessionId !== activeSession.id) {
      if (entry.attached && targetWindow && targetWindow.contentView) {
        try {
          targetWindow.contentView.removeChildView(entry.view);
        } catch {
          // Ignore detach failures when re-syncing the Chromium host.
        }
      }
      entry.attached = false;
    }
  }

  if (!targetWindow || !activeSession) {
    activeEmbeddedBrowserSessionId = '';
    return;
  }

  const entry = ensureEmbeddedBrowserView(activeSession);
  if (!entry) {
    return;
  }

  if (!entry.attached && targetWindow.contentView) {
    targetWindow.contentView.addChildView(entry.view);
    entry.attached = true;
  }

  if (typeof entry.view.setBounds === 'function') {
    entry.view.setBounds(clampEmbeddedBrowserBounds(targetWindow, activeSession.bounds));
  }

  activeEmbeddedBrowserSessionId = activeSession.id;
}

async function loadEmbeddedBrowserIntoHost(sessionState) {
  const entry = ensureEmbeddedBrowserView(sessionState);
  if (!entry || !sessionState || !sessionState.currentUrl) {
    throw new Error('Chromium host view could not be prepared for navigation');
  }

  const status = await protocolSupport.getStatus();
  const proxyPort = status && status.running ? status.port : 0;
  if (proxyPort > 0 && entry.view && entry.view.webContents && entry.view.webContents.session && typeof entry.view.webContents.session.setProxy === 'function') {
    await entry.view.webContents.session.setProxy({
      proxyRules: `http=127.0.0.1:${proxyPort};https=127.0.0.1:${proxyPort}`,
      proxyBypassRules: '<-loopback>',
    });
  }

  if (entry.view && entry.view.webContents && typeof entry.view.webContents.loadURL === 'function') {
    sendConsoleLog(
      'info',
      'browser',
      'Chromium loadURL start',
      `session: ${sessionState.name || sessionState.id} · url: ${sessionState.currentUrl} · proxyPort: ${proxyPort || 'none'} · partition: ${entry.partition || 'n/a'}`,
    );
    try {
      await entry.view.webContents.loadURL(sessionState.currentUrl);
      sendConsoleLog('info', 'browser', 'Chromium loadURL resolved', `session: ${sessionState.name || sessionState.id} · url: ${sessionState.currentUrl}`);
    } catch (error) {
      // Electron may reject loadURL with ERR_ABORTED for normal redirect/cancel flow.
      if (!isNavigationAbortError(error)) {
        sendConsoleLog('error', 'browser', 'Chromium loadURL rejected', stringifyLogValue(error));
        throw error;
      }
      sendConsoleLog('warn', 'browser', 'Chromium loadURL aborted (ignored)', stringifyLogValue(error));
    }
  }

  return entry;
}

async function navigateEmbeddedBrowserView(sessionState) {
  return loadEmbeddedBrowserIntoHost(sessionState);
}

async function goBackEmbeddedBrowserView(sessionState) {
  const entry = ensureEmbeddedBrowserView(sessionState);
  if (!entry || !entry.view || !entry.view.webContents) {
    return null;
  }

  const webContents = entry.view.webContents;
  if (typeof webContents.canGoBack === 'function' && webContents.canGoBack() && typeof webContents.goBack === 'function') {
    webContents.goBack();
    return entry;
  }

  return navigateEmbeddedBrowserView(sessionState);
}

async function goForwardEmbeddedBrowserView(sessionState) {
  const entry = ensureEmbeddedBrowserView(sessionState);
  if (!entry || !entry.view || !entry.view.webContents) {
    return null;
  }

  const webContents = entry.view.webContents;
  if (typeof webContents.canGoForward === 'function' && webContents.canGoForward() && typeof webContents.goForward === 'function') {
    webContents.goForward();
    return entry;
  }

  return navigateEmbeddedBrowserView(sessionState);
}

async function reloadEmbeddedBrowserView(sessionState) {
  const entry = ensureEmbeddedBrowserView(sessionState);
  if (!entry || !entry.view || !entry.view.webContents) {
    return null;
  }

  const webContents = entry.view.webContents;
  if (typeof webContents.reload === 'function') {
    webContents.reload();
    return entry;
  }

  return navigateEmbeddedBrowserView(sessionState);
}

function getActiveWindow() {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    return mainWindowRef;
  }

  const [firstWindow] = BrowserWindow.getAllWindows();
  return firstWindow || null;
}

function sendToRenderer(channel, payload) {
  const target = getActiveWindow();
  if (!target || !target.webContents) {
    return;
  }
  target.webContents.send(channel, payload);
}

function flushPendingConsoleLogs() {
  const target = getActiveWindow();
  if (!target || !target.webContents || pendingConsoleLogs.length === 0) {
    return;
  }

  const queued = pendingConsoleLogs.splice(0, pendingConsoleLogs.length);
  queued.forEach((entry) => {
    target.webContents.send('console:log', entry);
  });
}

function appendProcessOutputChunk(source, level, chunk) {
  const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
  if (!text) {
    return;
  }

  const normalized = text.replace(/\r\n/g, '\n');
  const buffered = `${processOutputBuffers[source] || ''}${normalized}`;
  const lines = buffered.split('\n');
  processOutputBuffers[source] = lines.pop() || '';

  lines
    .map(line => line.replace(/\r/g, ''))
    .filter(line => line.trim().length > 0)
    .forEach(line => sendConsoleLog(level, source, line));
}

function installProcessOutputStreaming() {
  if (processOutputStreamingInstalled) {
    return;
  }
  processOutputStreamingInstalled = true;

  const patchStream = (name, level) => {
    const stream = process[name];
    if (!stream || typeof stream.write !== 'function') {
      return;
    }

    const originalWrite = stream.write.bind(stream);
    stream.write = (...args) => {
      appendProcessOutputChunk(name, level, args[0]);
      return originalWrite(...args);
    };
  };

  patchStream('stdout', 'info');
  patchStream('stderr', 'error');
}

function installRuntimeLogHooks() {
  if (runtimeLogHooksInstalled) {
    return;
  }
  runtimeLogHooksInstalled = true;

  process.on('uncaughtException', (error) => {
    sendConsoleLog('error', 'process', 'Uncaught exception', stringifyLogValue(error));
  });

  process.on('unhandledRejection', (reason) => {
    sendConsoleLog('error', 'process', 'Unhandled promise rejection', stringifyLogValue(reason));
  });

  process.on('warning', (warning) => {
    sendConsoleLog('warn', 'process', 'Runtime warning', stringifyLogValue(warning));
  });

  app.on('render-process-gone', (_event, _webContents, details) => {
    sendConsoleLog('error', 'app', 'Render process gone', stringifyLogValue(details));
  });

  app.on('child-process-gone', (_event, details) => {
    sendConsoleLog('error', 'app', 'Child process gone', stringifyLogValue(details));
  });
}

/**
 * Push a structured log entry to the renderer console drawer.
 * @param {'info'|'warn'|'error'} level
 * @param {string} source  Short label, e.g. 'proxy', 'browser', 'extensions'
 * @param {string} message
 * @param {string} [detail]
 */
function sendConsoleLog(level, source, message, detail) {
  const payload = {
    sequence: ++consoleLogSequence,
    pid: process.pid,
    level: String(level || 'info'),
    source: String(source || 'app'),
    message: String(message || ''),
    detail: detail !== undefined ? stringifyLogValue(detail) : undefined,
    timestamp: Date.now(),
  };

  persistedConsoleLogHistory.push(payload);
  if (persistedConsoleLogHistory.length > MAX_CONSOLE_LOG_HISTORY) {
    persistedConsoleLogHistory.splice(0, persistedConsoleLogHistory.length - MAX_CONSOLE_LOG_HISTORY);
  }

  const target = getActiveWindow();
  if (target && target.webContents) {
    flushPendingConsoleLogs();
    target.webContents.send('console:log', payload);
    return;
  }

  pendingConsoleLogs.push(payload);
  if (pendingConsoleLogs.length > MAX_PENDING_CONSOLE_LOGS) {
    pendingConsoleLogs.splice(0, pendingConsoleLogs.length - MAX_PENDING_CONSOLE_LOGS);
  }
}

function formatConsoleLogEntry(entry = {}) {
  const timestamp = Number(entry.timestamp);
  const level = String(entry.level || 'info').toUpperCase();
  const source = String(entry.source || 'app');
  const sequence = Number(entry.sequence);
  const pid = Number(entry.pid);
  const message = String(entry.message || '');
  const detail = entry.detail !== undefined && entry.detail !== null ? ` | ${String(entry.detail)}` : '';
  const renderedTimestamp = Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : new Date().toISOString();
  const sequenceSegment = Number.isFinite(sequence) ? ` #${sequence}` : '';
  const pidSegment = Number.isFinite(pid) ? ` pid=${pid}` : '';

  return `${renderedTimestamp}${sequenceSegment} [${level}] [${source}]${pidSegment} ${message}${detail}`;
}

async function exportConsoleEntries(entries = []) {
  const targetWindow = BrowserWindow.getFocusedWindow() || getActiveWindow() || null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultPath = path.join(app.getPath('documents'), `sentinel-app-log-${timestamp}.log`);
  const result = await dialog.showSaveDialog(targetWindow, {
    title: 'Export Sentinel App Logs',
    defaultPath,
    filters: [
      { name: 'Log files', extensions: ['log', 'txt'] },
      { name: 'All files', extensions: ['*'] },
    ],
  });

  if (!result || result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }

  const records = Array.isArray(entries) && entries.length > 0
    ? entries
    : persistedConsoleLogHistory;
  const content = `${records.map(formatConsoleLogEntry).join('\n')}\n`;
  await fs.writeFile(result.filePath, content, 'utf8');
  return { ok: true, filePath: result.filePath };
}

async function pickImportFile({ title, filters }) {
  const focusedWindow = BrowserWindow.getFocusedWindow() || getActiveWindow() || null;
  const result = await dialog.showOpenDialog(focusedWindow, {
    title,
    properties: ['openFile'],
    filters,
  });

  if (!result || result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

function registerConsoleHandlers() {
  ipcMain.handle('console:export', async (_event, args = {}) => {
    return exportConsoleEntries(args && args.entries);
  });
}

function registerProxyHandlers() {
  ipcMain.handle('proxy:start', async (_event, args = {}) => {
    const rawPort = Number(args.port);
    const port = Number.isInteger(rawPort) && rawPort >= 1 && rawPort <= 65535 ? rawPort : 8080;
    const started = await protocolSupport.start({ port });
    sendConsoleLog('info', 'proxy', `Proxy started on port ${started.port}`);
    return { port: started.port, status: 'running' };
  });

  ipcMain.handle('proxy:stop', async () => {
    const stopped = await protocolSupport.stop();
    sendConsoleLog('info', 'proxy', 'Proxy stopped');
    return { status: stopped.status };
  });

  ipcMain.handle('proxy:status', async () => {
    const status = protocolSupport.getStatus();
    return {
      running: status.running,
      port: status.port,
      intercepting: status.intercepting,
    };
  });

  ipcMain.handle('proxy:config:get', async () => {
    const current = typeof protocolSupport.getForwardRuntimeConfig === 'function'
      ? protocolSupport.getForwardRuntimeConfig()
      : DEFAULT_PROXY_RUNTIME_CONFIG;
    return normalizeProxyRuntimeConfig(current);
  });

  ipcMain.handle('proxy:config:set', async (_event, args = {}) => {
    const nextConfig = normalizeProxyRuntimeConfig(args.config || {});
    if (typeof protocolSupport.setForwardRuntimeConfig === 'function') {
      protocolSupport.setForwardRuntimeConfig(nextConfig);
    }
    if (typeof projectStore.setModuleState === 'function') {
      await projectStore.setModuleState('proxy', { runtimeConfig: nextConfig });
    }
    return { ok: true, config: nextConfig };
  });

  ipcMain.handle('proxy:intercept:toggle', async (_event, args = {}) => {
    const { enabled } = args;
    return interceptEngine.setInterceptEnabled(enabled);
  });

  ipcMain.handle('proxy:intercept:forward', async (_event, args = {}) => {
    const { requestId, editedRequest } = args;
    const result = await interceptEngine.forward(requestId, editedRequest);
    return { ok: result.ok };
  });

  ipcMain.handle('proxy:intercept:drop', async (_event, args = {}) => {
    const { requestId } = args;
    return interceptEngine.drop(requestId);
  });

  ipcMain.handle('history:query', async (_event, args = {}) => {
    return historyLog.query(args);
  });

  ipcMain.handle('history:get', async (_event, args = {}) => {
    return historyLog.get(args.id);
  });

  ipcMain.handle('history:clear', async () => {
    return historyLog.clear();
  });

  ipcMain.handle('rules:list', async () => {
    return { rules: rulesEngine.getRules() };
  });

  ipcMain.handle('rules:save', async (_event, args = {}) => {
    const nextRules = args.rules || [];
    await projectStore.replaceRules(nextRules);
    const result = rulesEngine.setRules(nextRules);
    return { ok: result.ok };
  });

  ipcMain.handle('repeater:send', async (_event, args = {}) => {
    return repeaterService.send(args);
  });

  ipcMain.handle('repeater:get', async (_event, args = {}) => {
    return repeaterService.getEntry(args.id);
  });

  ipcMain.handle('repeater:history:list', async () => {
    return repeaterService.listHistory();
  });

  ipcMain.handle('intruder:configure', async (_event, args = {}) => {
    return intruderEngine.configure(args);
  });

  ipcMain.handle('intruder:start', async (_event, args = {}) => {
    return intruderEngine.start(args);
  });

  ipcMain.handle('intruder:stop', async (_event, args = {}) => {
    return intruderEngine.stop(args);
  });

  ipcMain.handle('intruder:list', async () => {
    return intruderEngine.list();
  });

  ipcMain.handle('intruder:results', async (_event, args = {}) => {
    return intruderEngine.results(args);
  });

  ipcMain.handle('target:sitemap', async () => {
    // Cap at 2500 and project to minimal shape — buildSiteMap only reads host/path/method/statusCode,
    // so fetching full request/response bodies wastes main-process memory for large histories.
    const result = await historyLog.query({ page: 0, pageSize: 2500, filter: {} });
    const hints = (result.items || []).map(item => ({
      request: item.request
        ? { host: item.request.host, path: item.request.path, method: item.request.method }
        : null,
      response: item.response ? { statusCode: item.response.statusCode } : null,
    }));
    return targetMapper.buildSiteMap(hints);
  });

  ipcMain.handle('scope:get', async () => {
    return { rules: targetMapper.getScopeRules() };
  });

  ipcMain.handle('scope:set', async (_event, args = {}) => {
    const rules = Array.isArray(args.rules) ? args.rules : [];
    targetMapper.setScopeRules(rules);
    await projectStore.replaceScopeRules(targetMapper.getScopeRules());
    extensionHost.emitEvent('scope.transition', {
      rulesCount: rules.length,
      rules,
    });
    return { ok: true };
  });

  // args.filePath is intentionally ignored — the file path must come from the native dialog
  // so that the renderer cannot direct reads at arbitrary paths on the host filesystem.
  ipcMain.handle('scope:import:burp', async () => {
    const selectedPath = await pickImportFile({
      title: 'Import Burp Scope Configuration',
      filters: [
        { name: 'Burp Config', extensions: ['xml', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!selectedPath) {
      return { ok: false, imported: 0, warnings: ['Import cancelled by user.'] };
    }

    const result = await targetMapper.importBurpFromFile(selectedPath);
    await projectStore.replaceScopeRules(result.rules || []);
    return {
      ok: true,
      imported: result.imported,
      warnings: result.warnings || [],
    };
  });

  // args.filePath is intentionally ignored — file path must come from the native dialog.
  ipcMain.handle('scope:import:csv', async (_event, args = {}) => {
    const selectedPath = await pickImportFile({
      title: 'Import CSV Scope Configuration',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (!selectedPath) {
      return { ok: false, imported: 0, warnings: ['Import cancelled by user.'] };
    }

    const result = await targetMapper.importCsvFromFile(selectedPath, args.format || 'generic');
    await projectStore.replaceScopeRules(result.rules || []);
    return {
      ok: true,
      imported: result.imported,
      warnings: result.warnings || [],
    };
  });

  ipcMain.handle('scanner:start', async (_event, args = {}) => {
    return scannerEngine.start(args);
  });

  ipcMain.handle('scanner:stop', async (_event, args = {}) => {
    return scannerEngine.stop(args);
  });

  ipcMain.handle('scanner:results', async (_event, args = {}) => {
    return scannerEngine.results(args);
  });

  ipcMain.handle('oob:payload:create', async (_event, args = {}) => {
    return oobService.createPayload(args);
  });

  ipcMain.handle('oob:hits:list', async (_event, args = {}) => {
    return oobService.listHits(args);
  });

  ipcMain.handle('sequencer:capture:start', async (_event, args = {}) => {
    return sequencerService.captureStart(args);
  });

  ipcMain.handle('sequencer:capture:stop', async (_event, args = {}) => {
    return sequencerService.captureStop(args);
  });

  ipcMain.handle('sequencer:analyze', async (_event, args = {}) => {
    return sequencerService.analyze(args);
  });

  ipcMain.handle('decoder:process', async (_event, args = {}) => {
    return decoderService.process(args);
  });

  ipcMain.handle('browser:session:create', async (_event, args = {}) => {
    const result = { session: embeddedBrowserService.createSession(args) };
    ensureEmbeddedBrowserView(result.session);
    syncEmbeddedBrowserHost();
    return result;
  });

  ipcMain.handle('browser:session:get', async (_event, args = {}) => {
    return embeddedBrowserService.getSession(args);
  });

  ipcMain.handle('browser:session:close', async (_event, args = {}) => {
    const result = embeddedBrowserService.closeSession(args);
    destroyEmbeddedBrowserView(args.sessionId);
    syncEmbeddedBrowserHost();
    return result;
  });

  ipcMain.handle('browser:session:focus', async (_event, args = {}) => {
    const result = embeddedBrowserService.focusSession(args);
    syncEmbeddedBrowserHost();
    return result;
  });

  ipcMain.handle('browser:sessions:list', async () => {
    return embeddedBrowserService.listSessions();
  });

  ipcMain.handle('browser:view:show', async (_event, args = {}) => {
    const result = embeddedBrowserService.showView(args);
    syncEmbeddedBrowserHost();
    return result;
  });

  ipcMain.handle('browser:view:hide', async (_event, args = {}) => {
    const result = embeddedBrowserService.hideView(args);
    syncEmbeddedBrowserHost();
    return result;
  });

  ipcMain.handle('browser:view:set-bounds', async (_event, args = {}) => {
    const result = embeddedBrowserService.setViewBounds(args);
    syncEmbeddedBrowserHost();
    return result;
  });

  ipcMain.handle('browser:navigate', async (_event, args = {}) => {
    sendConsoleLog('info', 'browser', 'Navigate request received', `sessionId: ${String(args.sessionId || 'n/a')} · url: ${String(args.url || '')}`);
    let result;
    try {
      result = await embeddedBrowserService.navigate(args);
    } catch (navError) {
      sendConsoleLog('error', 'browser', 'Navigate request rejected before load', stringifyLogValue(navError));
      // Proxy start failed, URL is invalid, or session not found.
      // Route through failRuntimeNavigation so the renderer gets a
      // navigate:error push event rather than an IPC rejection.
      try {
        embeddedBrowserService.failRuntimeNavigation({
          sessionId: args.sessionId,
          url: String(args.url || ''),
          error: navError instanceof Error ? navError : new Error(String(navError)),
        });
      } catch {
        // Session not found — rethrow original so renderer sees the message.
        throw navError;
      }
      return {};
    }
    try {
      await navigateEmbeddedBrowserView(result.session);
    } catch (error) {
      if (isNavigationAbortError(error)) {
        sendConsoleLog('warn', 'browser', 'Navigate load aborted (ignored)', stringifyLogValue(error));
        syncEmbeddedBrowserHost();
        return result;
      }
      sendConsoleLog('error', 'browser', 'Navigate load failed', stringifyLogValue(error));
      embeddedBrowserService.failRuntimeNavigation({
        sessionId: result.session.id,
        url: result.session.currentUrl,
        error: new Error(error && error.message ? error.message : 'Chromium host navigation failed.'),
      });
    }
    syncEmbeddedBrowserHost();
    return result;
  });

  ipcMain.handle('browser:back', async (_event, args = {}) => {
    const result = await embeddedBrowserService.back(args);
    if (result && result.session && !result.skipped) {
      try {
        await goBackEmbeddedBrowserView(result.session);
      } catch {
        // Runtime state is updated via WebContentsView events or explicit navigate errors.
      }
    }
    syncEmbeddedBrowserHost();
    return result;
  });

  ipcMain.handle('browser:forward', async (_event, args = {}) => {
    const result = await embeddedBrowserService.forward(args);
    if (result && result.session && !result.skipped) {
      try {
        await goForwardEmbeddedBrowserView(result.session);
      } catch {
        // Runtime state is updated via WebContentsView events or explicit navigate errors.
      }
    }
    syncEmbeddedBrowserHost();
    return result;
  });

  ipcMain.handle('browser:reload', async (_event, args = {}) => {
    const result = await embeddedBrowserService.reload(args);
    if (result && result.session && !result.skipped) {
      try {
        await reloadEmbeddedBrowserView(result.session);
      } catch {
        // Runtime state is updated via WebContentsView events or explicit navigate errors.
      }
    }
    syncEmbeddedBrowserHost();
    return result;
  });

  ipcMain.handle('browser:stop', async (_event, args = {}) => {
    const result = embeddedBrowserService.stop(args);
    const entry = embeddedBrowserViews.get(args.sessionId);
    if (entry && entry.view && entry.view.webContents && typeof entry.view.webContents.stop === 'function') {
      entry.view.webContents.stop();
    }
    return result;
  });

  embeddedBrowserService.on('state', payload => {
    sendToRenderer('browser:state', payload);
  });

  embeddedBrowserService.on('navigate:start', payload => {
    sendToRenderer('browser:navigate:start', payload);
    const session = payload && payload.session ? payload.session : null;
    if (session) {
      sendConsoleLog('info', 'browser', `Navigating → ${session.currentUrl || '...'}`, `session: ${session.name || session.id}`);
    }
  });

  embeddedBrowserService.on('navigate:complete', payload => {
    sendToRenderer('browser:navigate:complete', payload);
    const session = payload && payload.session ? payload.session : null;
    if (session) {
      sendConsoleLog('info', 'browser', `Loaded ${session.currentUrl || ''}`, `status: ${session.statusCode || 'n/a'} · proxy port: ${payload && payload.proxy ? payload.proxy.port : 'n/a'}`);
    }
  });

  embeddedBrowserService.on('navigate:error', payload => {
    sendToRenderer('browser:navigate:error', payload);
    sendConsoleLog('error', 'browser', `Navigation failed: ${payload && payload.url ? payload.url : ''}`, payload && payload.error ? String(payload.error) : undefined);
  });

  embeddedBrowserService.on('title:updated', payload => {
    sendToRenderer('browser:title:updated', payload);
  });

  interceptEngine.on('request', request => {
    const eventPayload = {
      request,
      requestId: request && request.id ? request.id : '',
    };

    sendToRenderer('proxy:intercept:request', request);
    setImmediate(() => {
      extensionHost.emitEvent('proxy.intercept', eventPayload);
    });
  });

  interceptEngine.on('forwarded', payload => {
    sendToRenderer('proxy:intercept:response', payload.response);
  });

  interceptEngine.on('forward-error', payload => {
    sendToRenderer('proxy:intercept:error', payload);
    sendConsoleLog('warn', 'proxy', `Forward error: ${payload && payload.requestId ? payload.requestId : ''}`, payload && payload.error ? String(payload.error) : undefined);
  });

  historyLog.on('push', item => {
    sendToRenderer('history:push', item);
    scannerEngine.observeTraffic(item).catch(() => {
      // Ignore passive scan errors to avoid impacting history ingestion.
    });
  });

  intruderEngine.on('progress', payload => {
    sendToRenderer('intruder:progress', payload);
  });

  scannerEngine.on('progress', payload => {
    sendToRenderer('scanner:progress', payload);
    if (payload && payload.finding) {
      const findingPayload = {
        finding: payload.finding,
        scanId: payload.scanId || '',
      };
      sendConsoleLog('warn', 'scanner', `Finding: ${payload.finding.title || payload.finding.type || 'unknown'}`, `severity: ${payload.finding.severity || 'n/a'} · scan: ${payload.scanId || 'n/a'}`);
      setImmediate(() => {
        extensionHost.emitEvent('scanner.finding', findingPayload);
      });
    }
  });

  oobService.on('hit', payload => {
    sendToRenderer('oob:hit', payload);
  });
}

async function loadProjectState() {
  historyLog.setProjectStore(projectStore);

  const persistedRules = await projectStore.listRules();
  rulesEngine.setRules(persistedRules);

  const persistedScopeRules = typeof projectStore.listScopeRules === 'function'
    ? await projectStore.listScopeRules()
    : [];
  targetMapper.setScopeRules(persistedScopeRules || []);

  let proxyRuntimeConfig = DEFAULT_PROXY_RUNTIME_CONFIG;
  if (typeof projectStore.getModuleState === 'function') {
    const proxyState = await projectStore.getModuleState('proxy');
    if (proxyState && proxyState.runtimeConfig) {
      proxyRuntimeConfig = normalizeProxyRuntimeConfig(proxyState.runtimeConfig);
    }
  }
  if (typeof protocolSupport.setForwardRuntimeConfig === 'function') {
    protocolSupport.setForwardRuntimeConfig(proxyRuntimeConfig);
  }

  const scopeEvaluator = requestLike => targetMapper.isInScope(requestLike);
  if (typeof rulesEngine.setScopeEvaluator === 'function') {
    rulesEngine.setScopeEvaluator(scopeEvaluator);
  }
  if (typeof intruderEngine.setScopeEvaluator === 'function') {
    intruderEngine.setScopeEvaluator(scopeEvaluator);
  }
  if (typeof scannerEngine.setScopeEvaluator === 'function') {
    scannerEngine.setScopeEvaluator(scopeEvaluator);
  }

  if (typeof scannerEngine.setAdapters === 'function') {
    scannerEngine.setAdapters({
      persistFinding: finding => projectStore.upsertScannerFinding(finding),
      listPersistedFindings: args => projectStore.listScannerFindings(args),
      getTrafficItem: id => projectStore.getTrafficItem(id),
      queryTraffic: args => projectStore.queryTraffic(args),
    });
  }

  if (typeof oobService.setAdapters === 'function') {
    oobService.setAdapters({
      persistInteraction: interaction => projectStore.upsertOobInteraction(interaction),
      listPersistedInteractions: args => projectStore.listOobInteractions(args),
    });
  }

  if (typeof sequencerService.setAdapters === 'function') {
    sequencerService.setAdapters({
      getTrafficItem: id => projectStore.getTrafficItem(id),
      upsertSession: session => projectStore.upsertSequencerSession(session),
      addTokenRow: tokenRow => projectStore.addSequencerToken(tokenRow),
      getSession: sessionId => projectStore.getSequencerSession(sessionId),
      listTokenRows: sessionId => projectStore.listSequencerTokens(sessionId),
    });
  }

  if (typeof protocolSupport.setScopeEvaluator === 'function') {
    protocolSupport.setScopeEvaluator(scopeEvaluator);
  }
}

async function openDefaultProjectStore() {
  const projectsDir = path.join(app.getPath('userData'), 'projects');
  const defaultProjectPath = path.join(projectsDir, 'default.sentinel.db');
  await projectStore.openProject(defaultProjectPath, { projectName: 'Default Sentinel Project' });
  await loadProjectState();
}

function registerProjectHandlers() {
  ipcMain.handle('project:new', async (_event, args = {}) => {
    const filePath = typeof args.filePath === 'string' ? args.filePath.trim() : '';
    if (!filePath) {
      return { ok: false, id: '' };
    }
    const result = await projectStore.openProject(filePath, { projectName: String(args.name || '') });
    if (!result.project) {
      return { ok: false, id: '' };
    }
    await loadProjectState();
    return { ok: true, id: result.project.id };
  });

  ipcMain.handle('project:open', async (_event, args = {}) => {
    const filePath = typeof args.filePath === 'string' ? args.filePath.trim() : '';
    if (!filePath) {
      return { ok: false, project: null };
    }
    const result = await projectStore.openProject(filePath, {});
    const project = result.project || null;
    await loadProjectState();
    return { ok: Boolean(project), project };
  });

  ipcMain.handle('project:save', async () => {
    return projectStore.checkpointProject();
  });

  ipcMain.handle('project:close', async () => {
    await projectStore.closeProject();
    return { ok: true };
  });

  ipcMain.handle('project:meta', async () => {
    return projectStore.getProjectMeta();
  });
}

function registerExtensionHandlers() {
  ipcMain.handle('extensions:list', async () => {
    const result = extensionHost.list();
    return { extensions: Array.isArray(result && result.extensions) ? result.extensions : [] };
  });

  ipcMain.handle('extensions:install', async (_event, args = {}) => {
    return extensionHost.install(args);
  });

  ipcMain.handle('extensions:uninstall', async (_event, args = {}) => {
    return extensionHost.uninstall(args);
  });

  ipcMain.handle('extensions:toggle', async (_event, args = {}) => {
    return extensionHost.toggle(args);
  });
}

function registerCaHandlers() {
  ipcMain.handle('ca:get', async () => {
    const cert = caManager.getCaCertificatePem();
    return { cert };
  });

  ipcMain.handle('ca:export', async (_event, args = {}) => {
    return caManager.exportCaCertificate(args.destPath);
  });

  ipcMain.handle('ca:rotate', async () => {
    const result = caManager.rotateCa();
    return { ok: true, ...result };
  });

  ipcMain.handle('ca:trust:guidance', async () => {
    const guidance = caManager.getTrustInstallGuidance();
    return { guidance };
  });
}

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  mainWindow.webContents.once('did-finish-load', () => {
    sendConsoleLog('info', 'app', 'Sentinel workspace loaded', `Electron ${process.versions.electron || 'unknown'} · Node ${process.versions.node || 'unknown'}`);
  });
  mainWindow.on('resize', () => {
    syncEmbeddedBrowserHost();
  });
  mainWindow.on('closed', () => {
    mainWindowRef = null;
    for (const sessionId of embeddedBrowserViews.keys()) {
      destroyEmbeddedBrowserView(sessionId);
    }
  });
  mainWindowRef = mainWindow;
  syncEmbeddedBrowserHost();
  return mainWindow;
}

async function shutdownServices() {
  if (shutdownInProgress) {
    return shutdownInProgress;
  }

  shutdownInProgress = (async () => {
    try {
      await protocolSupport.stop();
    } catch {
      // Ignore stop errors during shutdown.
    }

    try {
      await projectStore.closeProject();
    } catch {
      // Ignore close errors during shutdown.
    }

    for (const sessionId of embeddedBrowserViews.keys()) {
      destroyEmbeddedBrowserView(sessionId);
    }
  })();

  return shutdownInProgress;
}

app.whenReady().then(() => {
  installProcessOutputStreaming();
  installRuntimeLogHooks();
  registerConsoleHandlers();

  extensionHost.configure({
    extensionsDir: path.join(app.getPath('userData'), 'extensions'),
  });

  embeddedBrowserService.setProxyAdapters({
    getProxyStatus: async () => protocolSupport.getStatus(),
    startProxy: async (args = {}) => protocolSupport.start(args),
  });

  if (typeof protocolSupport.setLogger === 'function') {
    protocolSupport.setLogger(({ level, stage, detail }) => {
      sendConsoleLog(level || 'info', 'proxy', `Protocol ${stage || 'event'}`, detail || '');
    });
  }

  caManager.ensureCaArtifacts();
  openDefaultProjectStore().catch((error) => {
    console.error('[sentinel] Project store failed to open:', error);
    // Keep runtime usable with in-memory history when persistence is unavailable.
  });
  registerCaHandlers();
  registerProjectHandlers();
  registerExtensionHandlers();
  registerProxyHandlers();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', (event) => {
  if (shutdownInProgress) {
    return;
  }

  event.preventDefault();
  shutdownServices().finally(() => {
    app.quit();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
