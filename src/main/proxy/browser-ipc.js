'use strict';

const { WebContentsView, session: electronSession } = require('electron');
const forge = require('node-forge');
const embeddedBrowserService = require('./embedded-browser-service');
const protocolSupport = require('./protocol-support');

// ---------------------------------------------------------------------------
// Module-owned state — the embedded browser view map and active session ID
// live here so index.js is not burdened with Chromium host lifecycle details.
// ---------------------------------------------------------------------------

const embeddedBrowserViews = new Map();
let activeEmbeddedBrowserSessionId = '';

// Injected once by registerBrowserHandlers; used by all internal helpers.
let _sendConsoleLog;
let _sendToRenderer;
let _getActiveWindow;
let _caManager;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Cryptographically verifies that the TLS certificate presented by the remote
// server was issued and signed by the Sentinel CA. Returns true only when
// forge can successfully verify the cert chain against the in-memory CA cert.
// Any cert that fails (not issued by Sentinel, expired, or tampered) is rejected
// so that traffic which escapes the proxy does not get a free trust elevation.
function _verifyLeafAgainstSentinelCa(request) {
  if (!_caManager || typeof _caManager.getCaCertificatePem !== 'function') {
    return false;
  }

  const certPem = request && request.certificate && request.certificate.data;
  if (!certPem || typeof certPem !== 'string') {
    return false;
  }

  let caCertPem;
  try {
    caCertPem = _caManager.getCaCertificatePem();
  } catch {
    return false;
  }

  if (!caCertPem) {
    return false;
  }

  try {
    const caCert = forge.pki.certificateFromPem(caCertPem);
    const leafCert = forge.pki.certificateFromPem(certPem);
    const caStore = forge.pki.createCaStore([caCert]);
    forge.pki.verifyCertificateChain(caStore, [leafCert]);
    return true;
  } catch {
    return false;
  }
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

  const targetWindow = _getActiveWindow();
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

  // Only trust TLS certificates issued by the Sentinel CA. All HTTPS traffic routes through
  // the MITM proxy which presents leaf certs signed by our CA. Isolated partitions don't
  // inherit the system trust store, so we perform an explicit forge chain verification.
  // Certs that did not originate from Sentinel are rejected (ERR_FAILED / -2) to prevent
  // silent trust elevation if traffic somehow escapes the proxy.
  if (isolatedSession && typeof isolatedSession.setCertificateVerifyProc === 'function') {
    isolatedSession.setCertificateVerifyProc((request, callback) => {
      if (_verifyLeafAgainstSentinelCa(request)) {
        callback(0);
      } else {
        _sendConsoleLog(
          'warn',
          'browser',
          'TLS cert rejected — failed Sentinel CA verification',
          `host: ${String(request && request.hostname || 'unknown')}`,
        );
        callback(-2);
      }
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
    _sendConsoleLog('info', 'browser', 'Chromium did-start-loading', `session: ${sessionState.name || sessionState.id} · url: ${url || 'about:blank'}`);
  });

  view.webContents.on('did-stop-loading', () => {
    const currentUrl = typeof view.webContents.getURL === 'function' ? view.webContents.getURL() : '';
    const title = typeof view.webContents.getTitle === 'function' ? view.webContents.getTitle() : '';
    _sendConsoleLog('info', 'browser', 'Chromium did-stop-loading', `session: ${sessionState.name || sessionState.id} · url: ${currentUrl || 'about:blank'}`);
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
      _sendConsoleLog('warn', 'browser', 'Chromium did-fail-load (ignored abort)', `code: ${errorCode} · ${String(description || 'n/a')} · url: ${String(validatedUrl || '')}`);
      return;
    }
    _sendConsoleLog('error', 'browser', 'Chromium did-fail-load', `code: ${errorCode} · ${String(description || 'n/a')} · url: ${String(validatedUrl || '')}`);
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
  const targetWindow = _getActiveWindow();
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
    _sendConsoleLog(
      'info',
      'browser',
      'Chromium loadURL start',
      `session: ${sessionState.name || sessionState.id} · url: ${sessionState.currentUrl} · proxyPort: ${proxyPort || 'none'} · partition: ${entry.partition || 'n/a'}`,
    );
    try {
      await entry.view.webContents.loadURL(sessionState.currentUrl);
      _sendConsoleLog('info', 'browser', 'Chromium loadURL resolved', `session: ${sessionState.name || sessionState.id} · url: ${sessionState.currentUrl}`);
    } catch (error) {
      // Electron may reject loadURL with ERR_ABORTED for normal redirect/cancel flow.
      if (!isNavigationAbortError(error)) {
        _sendConsoleLog('error', 'browser', 'Chromium loadURL rejected', error);
        throw error;
      }
      _sendConsoleLog('warn', 'browser', 'Chromium loadURL aborted (ignored)', error);
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

// ---------------------------------------------------------------------------
// IPC registration
// ---------------------------------------------------------------------------

/**
 * Registers all browser:* IPC handlers and embedded-browser push subscriptions.
 * Must be called once during app.whenReady().
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {{ getActiveWindow: Function, sendConsoleLog: Function, sendToRenderer: Function, caManager: object }} deps - `caManager` is required for Sentinel CA TLS verification; omitting it disables chain verification.
 * @returns {{ syncHost: Function, destroyAllViews: Function }}
 */
function registerBrowserHandlers(ipcMain, { getActiveWindow, sendConsoleLog, sendToRenderer, caManager }) {
  _getActiveWindow = getActiveWindow;
  _sendConsoleLog = sendConsoleLog;
  _sendToRenderer = sendToRenderer;
  _caManager = caManager || null;

  // Wire the proxy status/start adapters so the browser service can auto-start
  // the proxy and route traffic through it when opening a session.
  embeddedBrowserService.setProxyAdapters({
    getProxyStatus: async () => protocolSupport.getStatus(),
    startProxy: async (args = {}) => protocolSupport.start(args),
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
      sendConsoleLog('error', 'browser', 'Navigate request rejected before load', navError);
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
        sendConsoleLog('warn', 'browser', 'Navigate load aborted (ignored)', error);
        syncEmbeddedBrowserHost();
        return result;
      }
      sendConsoleLog('error', 'browser', 'Navigate load failed', error);
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

  // --- Push event subscriptions -----------------------------------------

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

  return {
    syncHost: syncEmbeddedBrowserHost,
    destroyAllViews: () => {
      for (const sessionId of Array.from(embeddedBrowserViews.keys())) {
        destroyEmbeddedBrowserView(sessionId);
      }
    },
  };
}

module.exports = { registerBrowserHandlers };
