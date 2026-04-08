const electron = require('electron');
const { app, BrowserWindow, ipcMain, dialog } = electron;
const fs = require('node:fs/promises');
const path = require('node:path');
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
const { registerProxyHandlers } = require('./proxy/proxy-ipc');
const { registerBrowserHandlers } = require('./proxy/browser-ipc');

function configureElectronStoragePaths() {
  try {
    app.setName('Sentinel');
    const userDataRoot = path.join(app.getPath('appData'), 'Sentinel');
    app.setPath('userData', userDataRoot);
    app.setPath('sessionData', path.join(userDataRoot, 'Session'));
    app.setPath('cache', path.join(userDataRoot, 'Cache'));
  } catch {
    // Fall back to Electron defaults when path overrides are unavailable.
  }
}

configureElectronStoragePaths();

let mainWindowRef = null;
let shutdownInProgress = null;
// browserHooks is set during app.whenReady() and used by createWindow/shutdownServices.
let browserHooks = null;
const pendingConsoleLogs = [];
const MAX_PENDING_CONSOLE_LOGS = 500;
const persistedConsoleLogHistory = [];
const MAX_CONSOLE_LOG_HISTORY = 5000;
const processOutputBuffers = {
  stdout: '',
  stderr: '',
};
const NATIVE_REBUILD_MARKER_PATH = path.join(__dirname, '..', '..', 'node_modules', '.cache', 'sentinel', 'electron-rebuild.json');
const PACKAGE_LOCK_PATH = path.join(__dirname, '..', '..', 'package-lock.json');
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

function getActiveWindow() {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    return mainWindowRef;
  }

  const [firstWindow] = BrowserWindow.getAllWindows();
  return firstWindow || null;
}

function sendToRenderer(channel, payload) {
  const target = getActiveWindow();
  if (!target?.webContents) {
    return;
  }
  target.webContents.send(channel, payload);
}

function flushPendingConsoleLogs() {
  const target = getActiveWindow();
  if (!target?.webContents || pendingConsoleLogs.length === 0) {
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

  const normalized = text.replaceAll('\r\n', '\n');
  const buffered = `${processOutputBuffers[source] || ''}${normalized}`;
  const lines = buffered.split('\n');
  processOutputBuffers[source] = lines.pop() || '';

  lines
    .map(line => line.replaceAll('\r', ''))
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

async function warnIfNativeModulesNeedRebuild() {
  if (app.isPackaged) {
    return;
  }

  let marker = null;
  try {
    marker = JSON.parse(await fs.readFile(NATIVE_REBUILD_MARKER_PATH, 'utf8'));
  } catch {
    sendConsoleLog(
      'warn',
      'app',
      'Native modules may not be rebuilt for this install',
      'Run npm run rebuild:native before launching Electron if sqlite3 or other native bindings fail to load.',
    );
    return;
  }

  try {
    const packageLockStat = await fs.stat(PACKAGE_LOCK_PATH);
    if (Number(marker.packageLockMtimeMs) < packageLockStat.mtimeMs) {
      sendConsoleLog(
        'warn',
        'app',
        'Native rebuild marker is stale',
        'Dependencies changed after the last electron-rebuild. Run npm run rebuild:native before launching Electron.',
      );
    }
  } catch {
    // Ignore package-lock checks when the lockfile is unavailable.
  }
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
    detail: detail === undefined ? undefined : stringifyLogValue(detail),
    timestamp: Date.now(),
  };

  persistedConsoleLogHistory.push(payload);
  if (persistedConsoleLogHistory.length > MAX_CONSOLE_LOG_HISTORY) {
    persistedConsoleLogHistory.splice(0, persistedConsoleLogHistory.length - MAX_CONSOLE_LOG_HISTORY);
  }

  const target = getActiveWindow();
  if (target?.webContents) {
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
  const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
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

function registerConsoleHandlers() {
  ipcMain.handle('console:export', async (_event, args = {}) => {
    return exportConsoleEntries(args?.entries);
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
    if (proxyState?.runtimeConfig) {
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
    return { extensions: Array.isArray(result?.extensions) ? result.extensions : [] };
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
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    sendConsoleLog(
      'error',
      'renderer',
      'Renderer failed to load',
      `code=${code} mainFrame=${Boolean(isMainFrame)} url=${url || 'n/a'} reason=${description || 'unknown'}`,
    );
  });
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    let severity = 'info';
    if (level >= 2) {
      severity = 'error';
    } else if (level === 1) {
      severity = 'warn';
    }

    sendConsoleLog(
      severity,
      'renderer',
      message,
      `source=${sourceId || 'unknown'} line=${Number.isFinite(line) ? line : 'n/a'}`,
    );
  });
  mainWindow.webContents.once('did-finish-load', () => {
    sendConsoleLog('info', 'app', 'Sentinel workspace loaded', `Electron ${process.versions.electron || 'unknown'} · Node ${process.versions.node || 'unknown'}`);
  });
  mainWindow.on('resize', () => {
    if (browserHooks) browserHooks.syncHost();
  });
  mainWindow.on('closed', () => {
    mainWindowRef = null;
    if (browserHooks) browserHooks.destroyAllViews();
  });
  mainWindowRef = mainWindow;
  if (browserHooks) browserHooks.syncHost();
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

    if (browserHooks) browserHooks.destroyAllViews();
  })();

  return shutdownInProgress;
}

app.whenReady().then(() => {
  installProcessOutputStreaming();
  installRuntimeLogHooks();
  registerConsoleHandlers();
  warnIfNativeModulesNeedRebuild().catch(() => {
    // Ignore preflight warning failures; startup should continue.
  });

  extensionHost.configure({
    extensionsDir: path.join(app.getPath('userData'), 'extensions'),
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
  browserHooks = registerBrowserHandlers(ipcMain, { getActiveWindow, sendConsoleLog, sendToRenderer, caManager });
  registerProxyHandlers(ipcMain, {
    protocolSupport,
    interceptEngine,
    historyLog,
    rulesEngine,
    repeaterService,
    intruderEngine,
    targetMapper,
    projectStore,
    scannerEngine,
    oobService,
    sequencerService,
    decoderService,
    extensionHost,
    normalizeProxyRuntimeConfig,
    DEFAULT_PROXY_RUNTIME_CONFIG,
    sendConsoleLog,
    sendToRenderer,
  });
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
