/**
 * @file ipc-contract.js
 * Sentinel IPC Contract Map — Milestone 0 (Architecture Baseline)
 *
 * Authoritative registry of every IPC channel used between the Electron
 * main process and the renderer.  No channel may be added or removed outside
 * of an explicit M0/Architecture amendment.
 *
 * Conventions:
 *   - Channels are namespaced: `<service>:<action>` or `<service>:<sub>:<action>`.
 *   - direction: 'invoke'   = renderer calls main (ipcRenderer.invoke / ipcMain.handle).
 *   - direction: 'push'     = main pushes to renderer (ipcMain.send → ipcRenderer.on).
 *   - payload:  shape of the argument object sent with the call.
 *   - response: shape of the resolved value (invoke channels only).
 *
 * Schema version: 10
 */

'use strict';

/**
 * @typedef {object} ChannelDef
 * @property {string}  channel    - IPC channel name string.
 * @property {'invoke'|'push'} direction
 * @property {string}  payload    - Human-readable payload shape description.
 * @property {string}  response   - Human-readable response shape description (invoke only).
 * @property {string}  notes      - Implementation notes.
 */

/** @type {ChannelDef[]} */
const CHANNELS = [

  // -------------------------------------------------------------------------
  // Proxy — lifecycle
  // -------------------------------------------------------------------------
  {
    channel:   'proxy:start',
    direction: 'invoke',
    payload:   '{ port?: number }',
    response:  '{ port: number, status: "running" }',
    notes:     'Starts the intercepting proxy listener on the given port (default 8080).',
  },
  {
    channel:   'proxy:stop',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ status: "stopped" }',
    notes:     'Gracefully shuts down the proxy listener.',
  },
  {
    channel:   'proxy:status',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ running: boolean, port: number, intercepting: boolean }',
    notes:     'Queries current proxy runtime state.',
  },
  {
    channel:   'proxy:config:get',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ customHeaders: Record<string,string>, toolIdentifier: { enabled: boolean, headerName: string, value: string }, staticIpAddresses: string[] }',
    notes:     'Returns project-level runtime forwarding settings applied to outbound traffic.',
  },
  {
    channel:   'proxy:config:set',
    direction: 'invoke',
    payload:   '{ config: { customHeaders: Record<string,string>, toolIdentifier: { enabled: boolean, headerName: string, value: string }, staticIpAddresses: string[] } }',
    response:  '{ ok: boolean, config: object }',
    notes:     'Persists and applies runtime forwarding settings for headers, tool identity, and static source IP pool.',
  },

  // -------------------------------------------------------------------------
  // Proxy — intercept controls
  // -------------------------------------------------------------------------
  {
    channel:   'proxy:intercept:toggle',
    direction: 'invoke',
    payload:   '{ enabled: boolean }',
    response:  '{ intercepting: boolean }',
    notes:     'Enables or disables the intercept pause gate.',
  },
  {
    channel:   'proxy:intercept:forward',
    direction: 'invoke',
    payload:   '{ requestId: string, editedRequest?: HttpRequest /* may include rawBodyBase64 for binary replay */ }',
    response:  '{ ok: boolean }',
    notes:     'Forwards a paused request, optionally with analyst edits applied.',
  },
  {
    channel:   'proxy:intercept:drop',
    direction: 'invoke',
    payload:   '{ requestId: string }',
    response:  '{ ok: boolean }',
    notes:     'Drops a paused request without forwarding.',
  },

  // -------------------------------------------------------------------------
  // Proxy — push events (main → renderer)
  // -------------------------------------------------------------------------
  {
    channel:   'proxy:intercept:request',
    direction: 'push',
    payload:   'HttpRequest',
    response:  'n/a',
    notes:     'Emitted when a request is paused and awaiting analyst action.',
  },
  {
    channel:   'proxy:intercept:response',
    direction: 'push',
    payload:   'HttpResponse',
    response:  'n/a',
    notes:     'Emitted when a response is paused and awaiting analyst action.',
  },
  {
    channel:   'proxy:intercept:error',
    direction: 'push',
    payload:   '{ requestId: string, request: HttpRequest, error: string }',
    response:  'n/a',
    notes:     'Emitted when forwarding a paused request fails and the item remains queued for retry.',
  },

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------
  {
    channel:   'history:query',
    direction: 'invoke',
    payload:   '{ filter?: { method?, host?, statusCode?, search? }, page: number, pageSize: number }',
    response:  '{ items: TrafficItem[], total: number, page: number, pageSize: number }',
    notes:     'Paginated, filterable history query.  page is 0-based.',
  },
  {
    channel:   'history:get',
    direction: 'invoke',
    payload:   '{ id: string }',
    response:  'TrafficItem | null',
    notes:     'Fetches a single traffic item by UUID.',
  },
  {
    channel:   'history:clear',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ ok: boolean }',
    notes:     'Deletes all history items for the current project.',
  },
  {
    channel:   'history:push',
    direction: 'push',
    payload:   'TrafficItem',
    response:  'n/a',
    notes:     'Emitted in real time as each new traffic item is logged.',
  },

  // -------------------------------------------------------------------------
  // Rules engine
  // -------------------------------------------------------------------------
  {
    channel:   'rules:list',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ rules: Rule[] }',
    notes:     'Returns all active intercept/rewrite rules in their priority order.',
  },
  {
    channel:   'rules:save',
    direction: 'invoke',
    payload:   '{ rules: Rule[] }',
    response:  '{ ok: boolean }',
    notes:     'Replaces the full rule set and persists to the project store.',
  },

  // -------------------------------------------------------------------------
  // Repeater
  // -------------------------------------------------------------------------
  {
    channel:   'repeater:send',
    direction: 'invoke',
    payload:   '{ request: HttpRequest, entryId?: string }',
    response:  '{ response: HttpResponse, entry: RepeaterEntry }',
    notes:     'Sends a request. Creates a new entry when entryId is omitted; appends a send to an existing entry otherwise.',
  },
  {
    channel:   'repeater:get',
    direction: 'invoke',
    payload:   '{ id: string }',
    response:  'RepeaterEntry | null',
    notes:     'Returns a single repeater entry with its full send history.',
  },
  {
    channel:   'repeater:history:list',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ items: RepeaterEntry[] }',
    notes:     'Lists all repeater entries (without sends arrays) for the sidebar.',
  },

  // -------------------------------------------------------------------------
  // Intruder
  // -------------------------------------------------------------------------
  {
    channel:   'intruder:configure',
    direction: 'invoke',
    payload:   '{ config: AttackConfig }',
    response:  '{ ok: boolean, configId: string }',
    notes:     'Saves an attack configuration and returns its assigned ID.',
  },
  {
    channel:   'intruder:start',
    direction: 'invoke',
    payload:   '{ configId: string }',
    response:  '{ attackId: string }',
    notes:     'Starts a configured attack job and returns its runtime ID.',
  },
  {
    channel:   'intruder:stop',
    direction: 'invoke',
    payload:   '{ attackId: string }',
    response:  '{ ok: boolean }',
    notes:     'Gracefully stops a running attack.',
  },
  {
    channel:   'intruder:list',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ items: IntruderAttack[] }',
    notes:     'Lists recent intruder attacks with status and progress metadata.',
  },
  {
    channel:   'intruder:results',
    direction: 'invoke',
    payload:   '{ attackId: string, page: number, pageSize: number }',
    response:  '{ results: AttackResult[], total: number }',
    notes:     'Paginated attack results.',
  },
  {
    channel:   'intruder:progress',
    direction: 'push',
    payload:   '{ attackId: string, sent: number, total: number, lastResult: AttackResult }',
    response:  'n/a',
    notes:     'Real-time progress updates during an active attack.',
  },

  // -------------------------------------------------------------------------
  // Target mapping and scope
  // -------------------------------------------------------------------------
  {
    channel:   'target:sitemap',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ tree: SiteNode[] }',
    notes:     'Returns the full site map tree built from observed traffic.',
  },
  {
    channel:   'scope:get',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ rules: ScopeRule[] }',
    notes:     'Returns the currently active scope rules.',
  },
  {
    channel:   'scope:set',
    direction: 'invoke',
    payload:   '{ rules: ScopeRule[] }',
    response:  '{ ok: boolean }',
    notes:     'Replaces and persists the scope rule set.',
  },
  {
    channel:   'scope:import:burp',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ ok: boolean, imported: number, warnings: string[] }',
    notes:     'Always opens a native file picker to select a Burp config file; renderer-supplied file paths are not accepted.',
  },
  {
    channel:   'scope:import:csv',
    direction: 'invoke',
    payload:   '{ format: "hackerone" | "generic" }',
    response:  '{ ok: boolean, imported: number, warnings: string[] }',
    notes:     'Always opens a native file picker to select a CSV file; renderer-supplied file paths are not accepted.',
  },

  // -------------------------------------------------------------------------
  // Scanner
  // -------------------------------------------------------------------------
  {
    channel:   'scanner:start',
    direction: 'invoke',
    payload:   '{ targets: string[], config: ScanConfig }',
    response:  '{ scanId: string }',
    notes:     'Starts an active scan against the given target URLs.',
  },
  {
    channel:   'scanner:stop',
    direction: 'invoke',
    payload:   '{ scanId: string }',
    response:  '{ ok: boolean }',
    notes:     'Stops a running scan.',
  },
  {
    channel:   'scanner:results',
    direction: 'invoke',
    payload:   '{ scanId: string, page: number, pageSize: number }',
    response:  '{ findings: Finding[], total: number }',
    notes:     'Paginated scan findings.',
  },
  {
    channel:   'scanner:progress',
    direction: 'push',
    payload:   '{ scanId: string, pct: number, finding?: Finding }',
    response:  'n/a',
    notes:     'Real-time scan progress updates.',
  },

  // -------------------------------------------------------------------------
  // Decoder
  // -------------------------------------------------------------------------
  {
    channel:   'decoder:process',
    direction: 'invoke',
    payload:   '{ input: string, operations: DecoderOperation[] }',
    response:  '{ result: string, steps: string[] }',
    notes:     'Applies a pipeline of encode/decode operations and returns each step.',
  },

  // -------------------------------------------------------------------------
  // Embedded browser
  // -------------------------------------------------------------------------
  {
    channel:   'browser:session:create',
    direction: 'invoke',
    payload:   '{ name?: string }',
    response:  '{ session: BrowserSession }',
    notes:     'Creates a browser session for the embedded browser panel.',
  },
  {
    channel:   'browser:session:get',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ session: BrowserSession }',
    notes:     'Returns state for a single embedded browser session.',
  },
  {
    channel:   'browser:session:close',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ ok: boolean, sessionId: string }',
    notes:     'Closes and disposes an embedded browser session.',
  },
  {
    channel:   'browser:session:focus',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ session: BrowserSession }',
    notes:     'Marks a browser session as focused for future Chromium view ownership.',
  },
  {
    channel:   'browser:sessions:list',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ items: BrowserSession[] }',
    notes:     'Lists embedded browser sessions.',
  },
  {
    channel:   'browser:view:show',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ session: BrowserSession }',
    notes:     'Marks the embedded browser view as visible for a session.',
  },
  {
    channel:   'browser:view:hide',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ session: BrowserSession }',
    notes:     'Marks the embedded browser view as hidden for a session.',
  },
  {
    channel:   'browser:view:set-bounds',
    direction: 'invoke',
    payload:   '{ sessionId: string, bounds: { x: number, y: number, width: number, height: number } }',
    response:  '{ session: BrowserSession }',
    notes:     'Stores renderer-reported viewport bounds for a browser session.',
  },
  {
    channel:   'browser:navigate',
    direction: 'invoke',
    payload:   '{ sessionId: string, url: string }',
    response:  '{ session: BrowserSession, response: HttpResponse, proxy: { port: number } }',
    notes:     'Navigates a session URL through the Sentinel proxy.',
  },
  {
    channel:   'browser:back',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ session: BrowserSession, response?: HttpResponse, proxy?: { port: number }, skipped?: boolean }',
    notes:     'Navigates backward within embedded browser session history when available.',
  },
  {
    channel:   'browser:forward',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ session: BrowserSession, response?: HttpResponse, proxy?: { port: number }, skipped?: boolean }',
    notes:     'Navigates forward within embedded browser session history when available.',
  },
  {
    channel:   'browser:reload',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ session: BrowserSession, response?: HttpResponse, proxy?: { port: number }, skipped?: boolean }',
    notes:     'Reloads the current embedded browser session URL when available.',
  },
  {
    channel:   'browser:stop',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ session: BrowserSession }',
    notes:     'Stops the current navigation state for future Chromium-backed sessions.',
  },
  {
    channel:   'browser:state',
    direction: 'push',
    payload:   '{ reason: string, session: BrowserSession, closed?: boolean, proxy?: { port: number } }',
    response:  'n/a',
    notes:     'Emitted when embedded browser session state changes.',
  },
  {
    channel:   'browser:navigate:start',
    direction: 'push',
    payload:   '{ sessionId: string, url: string, session: BrowserSession }',
    response:  'n/a',
    notes:     'Emitted when embedded browser navigation starts.',
  },
  {
    channel:   'browser:navigate:complete',
    direction: 'push',
    payload:   '{ session: BrowserSession, response: HttpResponse, proxy: { port: number } }',
    response:  'n/a',
    notes:     'Emitted when embedded browser navigation completes.',
  },
  {
    channel:   'browser:navigate:error',
    direction: 'push',
    payload:   '{ sessionId: string, url: string, error: string }',
    response:  'n/a',
    notes:     'Emitted when embedded browser navigation fails.',
  },
  {
    channel:   'browser:title:updated',
    direction: 'push',
    payload:   '{ sessionId: string, title: string }',
    response:  'n/a',
    notes:     'Emitted when a page title is derived or updated for an embedded session.',
  },

  // -------------------------------------------------------------------------
  // Out-of-band (OOB) service
  // -------------------------------------------------------------------------
  {
    channel:   'oob:payload:create',
    direction: 'invoke',
    payload:   '{ type: "http" | "dns" | "smtp" }',
    response:  '{ id: string, url: string, domain: string }',
    notes:     'Creates an OOB interaction payload and returns its tracking URL.',
  },
  {
    channel:   'oob:hits:list',
    direction: 'invoke',
    payload:   '{ id: string }',
    response:  '{ hits: OobHit[] }',
    notes:     'Returns recorded OOB interactions for a given payload ID.',
  },
  {
    channel:   'oob:hit',
    direction: 'push',
    payload:   'OobHit',
    response:  'n/a',
    notes:     'Real-time notification when an OOB interaction is received.',
  },

  // -------------------------------------------------------------------------
  // Sequencer
  // -------------------------------------------------------------------------
  {
    channel:   'sequencer:capture:start',
    direction: 'invoke',
    payload:   '{ config: SequencerConfig }',
    response:  '{ sessionId: string }',
    notes:     'Starts a token capture session.',
  },
  {
    channel:   'sequencer:capture:stop',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ ok: boolean, sampleCount: number }',
    notes:     'Stops capture and returns collected sample count.',
  },
  {
    channel:   'sequencer:analyze',
    direction: 'invoke',
    payload:   '{ sessionId: string }',
    response:  '{ report: EntropyReport }',
    notes:     'Runs FIPS 140-2 and custom entropy analysis on captured tokens.',
  },

  // -------------------------------------------------------------------------
  // Extensions
  // -------------------------------------------------------------------------
  {
    channel:   'extensions:list',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ extensions: Extension[] }',
    notes:     'Returns all installed extensions with enabled status.',
  },
  {
    channel:   'extensions:install',
    direction: 'invoke',
    payload:   '{ packagePath: string }',
    response:  '{ ok: boolean, id: string }',
    notes:     'Installs an extension from a local package path.',
  },
  {
    channel:   'extensions:uninstall',
    direction: 'invoke',
    payload:   '{ id: string }',
    response:  '{ ok: boolean }',
    notes:     'Uninstalls and removes an extension.',
  },
  {
    channel:   'extensions:toggle',
    direction: 'invoke',
    payload:   '{ id: string, enabled: boolean }',
    response:  '{ ok: boolean }',
    notes:     'Enables or disables an installed extension without uninstalling.',
  },

  // -------------------------------------------------------------------------
  // Project management
  // -------------------------------------------------------------------------
  {
    channel:   'project:new',
    direction: 'invoke',
    payload:   '{ name: string, filePath: string }',
    response:  '{ ok: boolean, id: string }',
    notes:     'Creates a new project database at filePath.',
  },
  {
    channel:   'project:open',
    direction: 'invoke',
    payload:   '{ filePath: string }',
    response:  '{ ok: boolean, project: ProjectMeta }',
    notes:     'Opens an existing project database; runs migration if needed.',
  },
  {
    channel:   'project:save',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ ok: boolean }',
    notes:     'Forces an explicit checkpoint/flush of the project store.',
  },
  {
    channel:   'project:close',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ ok: boolean }',
    notes:     'Closes the current project and resets runtime state.',
  },
  {
    channel:   'project:meta',
    direction: 'invoke',
    payload:   '{}',
    response:  'ProjectMeta | null',
    notes:     'Returns metadata for the currently open project.',
  },

  // -------------------------------------------------------------------------
  // CA certificate lifecycle
  // -------------------------------------------------------------------------
  {
    channel:   'ca:get',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ cert: string }',
    notes:     'Returns the current CA certificate in PEM format.',
  },
  {
    channel:   'ca:export',
    direction: 'invoke',
    payload:   '{ destPath: string }',
    response:  '{ ok: boolean }',
    notes:     'Writes the CA certificate to destPath as a PEM file.',
  },
  {
    channel:   'ca:rotate',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ ok: boolean }',
    notes:     'Regenerates the CA key pair; invalidates all cached leaf certs.',
  },
  {
    channel:   'ca:trust:guidance',
    direction: 'invoke',
    payload:   '{}',
    response:  '{ guidance: { platform: string, title: string, steps: string[] } }',
    notes:     'Returns OS-specific trust-store installation guidance for the current CA.',
  },

  // -------------------------------------------------------------------------
  // Console — app-level log stream
  // -------------------------------------------------------------------------
  {
    channel:   'console:log',
    direction: 'push',
    payload:   '{ level: "info"|"warn"|"error", source: string, message: string, detail?: string, timestamp: number }',
    response:  'n/a',
    notes:     'Main process pushes structured log entries to the renderer console drawer.',
  },
  {
    channel:   'console:export',
    direction: 'invoke',
    payload:   '{ entries: Array<{ level?: string, source?: string, message?: string, detail?: string, timestamp?: number }> }',
    response:  '{ ok: boolean, canceled?: boolean, filePath?: string }',
    notes:     'Saves console log entries to a user-selected text file via native save dialog.',
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Returns the channel definition for the given name, or undefined.
 *
 * @param {string} name
 * @returns {ChannelDef|undefined}
 */
function getChannel(name) {
  return CHANNELS.find(c => c.channel === name);
}

/**
 * Returns all channels for a given service prefix (e.g. 'proxy', 'history').
 *
 * @param {string} service
 * @returns {ChannelDef[]}
 */
function getChannelsForService(service) {
  return CHANNELS.filter(c => c.channel.startsWith(service + ':'));
}

/**
 * Returns all invoke-direction channels (used to register ipcMain.handle entries).
 *
 * @returns {ChannelDef[]}
 */
function getInvokeChannels() {
  return CHANNELS.filter(c => c.direction === 'invoke');
}

/**
 * Returns all push-direction channels (used to register ipcMain.send entries).
 *
 * @returns {ChannelDef[]}
 */
function getPushChannels() {
  return CHANNELS.filter(c => c.direction === 'push');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  SCHEMA_VERSION: 9,
  CHANNELS,
  getChannel,
  getChannelsForService,
  getInvokeChannels,
  getPushChannels,
};
