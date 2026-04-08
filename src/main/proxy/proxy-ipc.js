'use strict';

const { BrowserWindow, dialog } = require('electron');

// ---------------------------------------------------------------------------
// Dialog helper — file path must always come from the native picker so the
// renderer cannot direct reads at arbitrary host filesystem locations.
// ---------------------------------------------------------------------------

async function pickImportFile({ title, filters }) {
  const focusedWindow = BrowserWindow.getFocusedWindow() || (BrowserWindow.getAllWindows()[0] || null);
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

// ---------------------------------------------------------------------------
// IPC registration
// ---------------------------------------------------------------------------

/**
 * Registers proxy, history, rules, repeater, intruder, target, scope,
 * scanner, OOB, sequencer, and decoder IPC handlers plus their push-event
 * subscriptions. Must be called once during app.whenReady().
 *
 * @param {Electron.IpcMain} ipcMain
 * @param {{
 *   protocolSupport: object,
 *   interceptEngine: object,
 *   historyLog: object,
 *   rulesEngine: object,
 *   repeaterService: object,
 *   intruderEngine: object,
 *   targetMapper: object,
 *   projectStore: object,
 *   scannerEngine: object,
 *   oobService: object,
 *   sequencerService: object,
 *   decoderService: object,
 *   extensionHost: object,
 *   normalizeProxyRuntimeConfig: Function,
 *   DEFAULT_PROXY_RUNTIME_CONFIG: object,
 *   sendConsoleLog: Function,
 *   sendToRenderer: Function,
 * }} deps
 */
function registerProxyHandlers(ipcMain, {
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
}) {
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

  // --- Push event subscriptions -----------------------------------------

  interceptEngine.on('request', request => {
    const eventPayload = {
      request,
      requestId: request?.id || '',
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
    sendConsoleLog('warn', 'proxy', `Forward error: ${payload?.requestId || ''}`, payload?.error ? String(payload.error) : undefined);
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
    if (payload?.finding) {
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

module.exports = { registerProxyHandlers };
