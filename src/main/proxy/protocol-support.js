/*
SEN-014 Protocol support
- HTTP/1.1 interception runtime on a configurable port.
- Integration with intercept engine, rules engine, and history logging.
*/

'use strict';

const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');
const { URL } = require('node:url');
const { randomUUID } = require('node:crypto');
const interceptEngineModule = require('./intercept-engine');
const historyLogModule = require('./history-log');
const rulesEngineModule = require('./rules-engine');
const caManager = require('../certs/ca-manager');

const MAX_REQUEST_BYTES = 25 * 1024 * 1024; // 25 MB
const DEFAULT_TOOL_IDENTIFIER_HEADER = 'X-Sentinel-Tool';
const DEFAULT_TOOL_IDENTIFIER_VALUE = 'Gulp-Sentinel';

let forwardRuntimeConfig = {
	customHeaders: {},
	toolIdentifier: {
		enabled: false,
		headerName: DEFAULT_TOOL_IDENTIFIER_HEADER,
		value: DEFAULT_TOOL_IDENTIFIER_VALUE,
	},
	staticIpAddresses: [],
};
let staticIpCursor = 0;

function normalizeHeaderName(name) {
	const normalized = String(name || '').trim();
	return normalized;
}

function normalizeStaticIpAddresses(items) {
	if (!Array.isArray(items)) {
		return [];
	}

	const out = [];
	for (const item of items) {
		const candidate = String(item || '').trim();
		if (!candidate) {
			continue;
		}
		if (net.isIP(candidate) === 0) {
			continue;
		}
		if (!out.includes(candidate)) {
			out.push(candidate);
		}
	}
	return out;
}

function normalizeForwardRuntimeConfig(config = {}) {
	const customHeaders = {};
	const rawCustomHeaders = config && typeof config.customHeaders === 'object' && config.customHeaders
		? config.customHeaders
		: {};
	for (const [name, value] of Object.entries(rawCustomHeaders)) {
		const key = normalizeHeaderName(name);
		if (!key) {
			continue;
		}
		customHeaders[key] = String(value == null ? '' : value);
	}

	const rawTool = config && typeof config.toolIdentifier === 'object' && config.toolIdentifier
		? config.toolIdentifier
		: {};
	const toolHeaderName = normalizeHeaderName(rawTool.headerName || DEFAULT_TOOL_IDENTIFIER_HEADER) || DEFAULT_TOOL_IDENTIFIER_HEADER;
	const toolValue = String(rawTool.value == null ? DEFAULT_TOOL_IDENTIFIER_VALUE : rawTool.value);

	return {
		customHeaders,
		toolIdentifier: {
			enabled: Boolean(rawTool.enabled),
			headerName: toolHeaderName,
			value: toolValue,
		},
		staticIpAddresses: normalizeStaticIpAddresses(config.staticIpAddresses),
	};
}

function selectStaticLocalAddress() {
	const ips = forwardRuntimeConfig.staticIpAddresses;
	if (!Array.isArray(ips) || ips.length === 0) {
		return '';
	}
	const selected = ips[staticIpCursor % ips.length];
	staticIpCursor = (staticIpCursor + 1) % ips.length;
	return selected;
}

function setForwardRuntimeConfig(config = {}) {
	forwardRuntimeConfig = normalizeForwardRuntimeConfig(config);
	if (staticIpCursor >= forwardRuntimeConfig.staticIpAddresses.length) {
		staticIpCursor = 0;
	}
	return getForwardRuntimeConfig();
}

function getForwardRuntimeConfig() {
	return structuredClone(forwardRuntimeConfig);
}

function normalizeHeaders(rawHeaders = {}) {
	const normalized = {};
	for (const [name, value] of Object.entries(rawHeaders || {})) {
		const key = String(name).toLowerCase();
		if (Array.isArray(value)) {
			normalized[key] = value.join(', ');
		} else {
			normalized[key] = value === undefined ? '' : String(value);
		}
	}
	return normalized;
}

function isTextualContentType(contentType = '') {
	const value = String(contentType || '').toLowerCase();
	if (!value) {
		return false;
	}

	return (
		value.startsWith('text/') ||
		value.includes('json') ||
		value.includes('xml') ||
		value.includes('javascript') ||
		value.includes('x-www-form-urlencoded')
	);
}

function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let accumulated = 0;
		req.on('data', chunk => {
			accumulated += chunk.length;
			if (accumulated > MAX_REQUEST_BYTES) {
				req.destroy(new Error('Request body exceeds 25 MB size limit'));
				return;
			}
			chunks.push(Buffer.from(chunk));
		});
		req.on('end', () => resolve(Buffer.concat(chunks)));
		req.on('error', reject);
	});
}

function parsePort(value) {
	const port = Number(value);
	return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

function parseBracketHostAndPort(raw, defaultPort) {
	if (!raw.startsWith('[')) {
		return null;
	}

	const end = raw.indexOf(']');
	if (end <= 0) {
		return null;
	}

	const host = raw.slice(1, end);
	const rest = raw.slice(end + 1);
	if (!rest.startsWith(':')) {
		return { host, port: defaultPort };
	}

	const port = parsePort(rest.slice(1));
	return { host, port: port === null ? defaultPort : port };
}

function parseSingleColonHostAndPort(raw) {
	const colonCount = (raw.match(/:/g) || []).length;
	if (colonCount !== 1) {
		return null;
	}

	const separator = raw.lastIndexOf(':');
	const host = raw.slice(0, separator);
	const port = parsePort(raw.slice(separator + 1));
	if (!host || port === null) {
		return null;
	}

	return { host, port };
}

function parseHostAndPort(hostHeader = '', protocol = 'http:') {
	const raw = String(hostHeader || '').trim();
	const defaultPort = protocol === 'https:' ? 443 : 80;

	if (!raw) {
		return { host: 'localhost', port: defaultPort };
	}

	const bracket = parseBracketHostAndPort(raw, defaultPort);
	if (bracket) {
		return bracket;
	}

	const singleColon = parseSingleColonHostAndPort(raw);
	if (singleColon) {
		return singleColon;
	}

	return { host: raw, port: defaultPort };
}

function formatAuthority(host, port, protocol = 'http:') {
	const defaultPort = protocol === 'https:' ? 443 : 80;
	let name = String(host || 'localhost');

	if (name.includes(':') && !name.startsWith('[') && !name.endsWith(']')) {
		name = `[${name}]`;
	}

	if (Number.isInteger(port) && port > 0 && port !== defaultPort) {
		return `${name}:${port}`;
	}

	return name;
}

function buildResolvedUrl(protocol, host, port, pathValue) {
	const authority = formatAuthority(host, port, protocol);
	return `${protocol}//${authority}${pathValue}`;
}

function resolveHttpTarget(req, context, normalizedHeaders) {
	const isTls = Boolean(context.tls);
	const contextHost = String(context.host || '');
	const defaultPort = isTls ? 443 : 80;
	const contextPort = Number(context.port || defaultPort);
	const hasContextPort = context.port !== undefined;
	const protocol = isTls ? 'https:' : 'http:';
	const target = /^https?:\/\//i.test(req.url || '') ? new URL(req.url) : null;
	const parsedHost = parseHostAndPort(normalizedHeaders.host || contextHost, protocol);
	const resolvedHost = target ? target.hostname : (contextHost || parsedHost.host);

	let resolvedPort = parsedHost.port;
	if (target) {
		const targetDefaultPort = target.protocol === 'https:' ? 443 : 80;
		resolvedPort = Number(target.port || targetDefaultPort);
	} else if (hasContextPort) {
		resolvedPort = contextPort;
	}

	const resolvedPath = target ? `${target.pathname || '/'}${target.search || ''}` : (req.url || '/');
	const resolvedUrl = target
		? target.toString()
		: buildResolvedUrl(protocol, resolvedHost, resolvedPort, resolvedPath);
	const queryString = target ? String(target.search || '').replaceAll(/^\?/g, '') : '';
	let requestProtocol = isTls ? 'https' : 'http';
	if (target) {
		requestProtocol = target.protocol.replaceAll(':', '');
	}

	return {
		isTls,
		protocol,
		target,
		resolvedHost,
		resolvedPort,
		resolvedPath,
		resolvedUrl,
		queryString,
		requestProtocol,
	};
}

function resolveTargetUrl(request) {
	if (request.url && /^https?:\/\//i.test(request.url)) {
		return new URL(request.url);
	}

	const protocol = request.tls ? 'https:' : 'http:';
	const parsedHost = parseHostAndPort(request.headers?.host, protocol);
	const host = request.host || parsedHost.host;
	const port = request.port || parsedHost.port;
	const authority = formatAuthority(host, port, protocol);
	const path = request.path || '/';
	return new URL(`${protocol}//${authority}${path}`);
}

/**
 * Standalone HTTP forwarder.  Used by both ProtocolSupport and RepeaterService.
 * Returns a response object that includes a `rawBody` Buffer and `rawBodyBase64`
 * for callers that need raw bytes (hex viewer, binary replay).
 *
 * @param {object} request - Canonical HttpRequest model.
 * @returns {Promise<object>} Canonical HttpResponse plus `rawBody` Buffer.
 */
const FORWARD_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024; // 25 MB

async function forwardRequest(request, log) {
	const requestStart = Date.now();
	const targetUrl = resolveTargetUrl(request);
	const client = targetUrl.protocol === 'https:' ? https : http;
	const headers = normalizeHeaders(request.headers || {});
	const runtimeConfig = getForwardRuntimeConfig();
	if (typeof log === 'function') {
		log('info', 'forward:start', {
			requestId: request?.id,
			method: request?.method,
			url: targetUrl.toString(),
			timeoutMs: FORWARD_TIMEOUT_MS,
		});
	}

	delete headers['proxy-connection'];
	headers.host = targetUrl.host;

	// Strip hop-by-hop headers (RFC 2616 §13.5.1) so they are not forwarded upstream.
	const perConnectionHeaders = String(headers['connection'] || '')
		.split(',')
		.map(h => h.trim().toLowerCase())
		.filter(Boolean);
	const hopByHopNames = [
		'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
		'te', 'trailer', 'upgrade', ...perConnectionHeaders,
	];
	for (const name of hopByHopNames) {
		delete headers[name];
	}

	for (const [name, value] of Object.entries(runtimeConfig.customHeaders || {})) {
		headers[String(name).toLowerCase()] = String(value);
	}

	if (runtimeConfig.toolIdentifier?.enabled) {
		headers[String(runtimeConfig.toolIdentifier.headerName || DEFAULT_TOOL_IDENTIFIER_HEADER).toLowerCase()] = String(
			runtimeConfig.toolIdentifier.value || DEFAULT_TOOL_IDENTIFIER_VALUE
		);
	}

	let bodyBuffer = Buffer.alloc(0);
	if (typeof request.body === 'string') {
		bodyBuffer = Buffer.from(request.body, 'utf8');
	} else if (typeof request.rawBodyBase64 === 'string' && request.rawBodyBase64.length > 0) {
		try {
			bodyBuffer = Buffer.from(request.rawBodyBase64, 'base64');
		} catch {
			bodyBuffer = Buffer.alloc(0);
		}
	}

	delete headers['content-length'];
	delete headers['transfer-encoding'];
	if (bodyBuffer.length > 0) {
		headers['content-length'] = String(bodyBuffer.length);
	}

	return new Promise((resolve, reject) => {
		const localAddress = selectStaticLocalAddress();
		const upstreamReq = client.request({
			protocol: targetUrl.protocol,
			hostname: targetUrl.hostname,
			port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
			method: request.method || 'GET',
			path: `${targetUrl.pathname}${targetUrl.search}`,
			headers,
			timeout: FORWARD_TIMEOUT_MS,
			localAddress: localAddress || undefined,
		}, upstreamRes => {
			if (typeof log === 'function') {
				log('info', 'forward:response', {
					requestId: request?.id,
					statusCode: upstreamRes?.statusCode,
					statusMessage: upstreamRes?.statusMessage,
					contentType: upstreamRes?.headers?.['content-type'] || '',
				});
			}
			const ttfb = Date.now() - requestStart;
			const chunks = [];
			let accumulated = 0;

			upstreamRes.on('data', chunk => {
				accumulated += chunk.length;
				if (accumulated > MAX_RESPONSE_BYTES) {
					upstreamReq.destroy(new Error('Upstream response exceeds 25 MB size limit'));
					return;
				}
				chunks.push(Buffer.from(chunk));
			});
			upstreamRes.on('end', () => {
				const rawBody = Buffer.concat(chunks);
				const contentType = String(upstreamRes.headers['content-type'] || '').split(';')[0] || '';
				const decodedBody = isTextualContentType(contentType)
					? rawBody.toString('utf8')
					: null;
				const timestamp = Date.now();
				resolve({
					id: randomUUID(),
					requestId: request.id,
					connectionId: request.connectionId,
					timestamp,
					statusCode: upstreamRes.statusCode || 502,
					statusMessage: upstreamRes.statusMessage || 'Bad Gateway',
					headers: normalizeHeaders(upstreamRes.headers),
					contentType,
					body: decodedBody,
					bodyLength: rawBody.length,
					rawBodyBase64: rawBody.length > 0 ? rawBody.toString('base64') : null,
					timings: {
						sendStart: 0,
						ttfb,
						total: timestamp - requestStart,
					},
					rawBody,
				});
			});
		});

		upstreamReq.on('error', (error) => {
			if (typeof log === 'function') {
				log('error', 'forward:error', {
					requestId: request?.id,
					message: error?.message || String(error),
				});
			}
			reject(error);
		});
		upstreamReq.on('timeout', () => {
			if (typeof log === 'function') {
				log('warn', 'forward:timeout', {
					requestId: request?.id,
					timeoutMs: FORWARD_TIMEOUT_MS,
					url: targetUrl.toString(),
				});
			}
			upstreamReq.destroy(new Error(`Upstream request timed out after ${FORWARD_TIMEOUT_MS / 1000} seconds`));
		});

		if (bodyBuffer.length > 0) {
			upstreamReq.write(bodyBuffer);
		}
		upstreamReq.end();
	});
}

class ProtocolSupport {
	constructor(options = {}) {
		this.interceptEngine = options.interceptEngine || interceptEngineModule;
		this.historyLog = options.historyLog || historyLogModule;
		this.rulesEngine = options.rulesEngine || rulesEngineModule;
		this.scopeEvaluator = typeof options.scopeEvaluator === 'function' ? options.scopeEvaluator : null;
		this.logger = typeof options.logger === 'function' ? options.logger : null;
		this.server = null;
		this.port = 0;
	}

	setLogger(logger) {
		this.logger = typeof logger === 'function' ? logger : null;
		return { ok: true };
	}

	log(level, stage, detail) {
		if (typeof this.logger !== 'function') {
			return;
		}

		this.logger({
			level: String(level || 'info'),
			stage: String(stage || 'protocol'),
			detail,
		});
	}

	setScopeEvaluator(evaluator) {
		this.scopeEvaluator = typeof evaluator === 'function' ? evaluator : null;
		return { ok: true };
	}

	async start({ port = 8080 } = {}) {
		if (this.server) {
			this.log('info', 'proxy:start:already-running', { port: this.port });
			return { port: this.port, status: 'running' };
		}

		this.log('info', 'proxy:start:requested', { port });

		this.server = http.createServer((req, res) => {
			this.handleHttpRequest(req, res).catch(async error => {
				this.log('error', 'proxy:http:handler-error', {
					method: req?.method,
					url: req?.url,
					error: error?.message || String(error),
				});
				const fallbackStatus = 502;
				res.writeHead(fallbackStatus, { 'content-type': 'text/plain; charset=utf-8' });
				res.end('Sentinel proxy upstream error');

				try {
					await this.historyLog.logTraffic({
						kind: 'http',
						request: {
							id: randomUUID(),
							connectionId: randomUUID(),
							timestamp: Date.now(),
							method: req.method || 'GET',
							url: req.url || '/',
							host: String(req.headers.host || ''),
							port,
							path: req.url || '/',
							queryString: '',
							headers: normalizeHeaders(req.headers || {}),
							body: null,
							protocol: 'HTTP/1.1',
							tls: false,
							tags: [],
							comment: `forwarding failed: ${error.message}`,
							inScope: false,
						},
						response: {
							id: randomUUID(),
							requestId: '',
							connectionId: '',
							timestamp: Date.now(),
							statusCode: fallbackStatus,
							statusMessage: 'Bad Gateway',
							headers: { 'content-type': 'text/plain; charset=utf-8' },
							contentType: 'text/plain',
							body: 'Sentinel proxy upstream error',
							bodyLength: 28,
							timings: { sendStart: 0, ttfb: 0, total: 0 },
						},
					});
				} catch {
					// Ignore history write failures in fallback path.
				}
			});
		});

		// Handle HTTPS CONNECT tunnels for MITM interception.
		this.server.on('connect', (req, socket, head) => {
			this.log('info', 'proxy:connect:received', {
				url: req?.url,
				headBytes: head?.length || 0,
			});
			this.handleConnect(req, socket, head).catch(() => {
				try { socket.destroy(); } catch {
					// ignore cleanup failure
				}
			});
		});

		await new Promise((resolve, reject) => {
			this.server.once('error', reject);
			this.server.listen(port, '127.0.0.1', () => resolve());
		});

		const address = this.server.address();
		this.port = address && typeof address === 'object' ? address.port : port;
		this.log('info', 'proxy:start:ready', { port: this.port });
		return { port: this.port, status: 'running' };
	}

	async stop() {
		if (!this.server) {
			this.log('info', 'proxy:stop:already-stopped');
			return { status: 'stopped' };
		}

		const server = this.server;
		this.server = null;
		this.port = 0;

		await new Promise((resolve, reject) => {
			server.close(error => (error ? reject(error) : resolve()));
		});

		this.log('info', 'proxy:stop:complete');

		return { status: 'stopped' };
	}

	getStatus() {
		return {
			running: !!this.server,
			port: this.port,
			intercepting: typeof this.interceptEngine.isEnabled === 'function'
				? this.interceptEngine.isEnabled()
				: !!this.interceptEngine.interceptEnabled,
		};
	}

	async handleConnect(req, clientSocket, head) {
		const url = req.url || '';
		const colonIdx = url.lastIndexOf(':');
		const targetHost = colonIdx >= 0 ? url.slice(0, colonIdx) : url;
		const targetPort = colonIdx >= 0 ? Number(url.slice(colonIdx + 1)) : 443;

		this.log('info', 'proxy:connect:target', {
			targetHost,
			targetPort,
		});

		if (!targetHost) {
			this.log('warn', 'proxy:connect:missing-host');
			clientSocket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
			clientSocket.destroy();
			return;
		}

		// Acknowledge the tunnel before the browser starts the TLS handshake.
		clientSocket.write('HTTP/1.1 200 Connection Established\r\nProxy-agent: Sentinel\r\n\r\n');

		// Push back any bytes the HTTP parser already consumed before handing us the socket.
		if (head && head.length > 0) {
			clientSocket.unshift(head);
		}

		// Obtain a per-host leaf cert signed by the Sentinel CA for MITM.
		let leaf;
		try {
			leaf = caManager.getLeafCertificate(targetHost);
		} catch {
			this.log('error', 'proxy:connect:leaf-cert-failed', { targetHost });
			clientSocket.destroy();
			return;
		}

		// Wrap the raw socket in TLS, presenting the forged cert to the browser.
		const tlsSocket = new tls.TLSSocket(clientSocket, {
			isServer: true,
			cert: leaf.certPem,
			key: leaf.keyPem,
		});

		// Use a transient HTTP server to parse decrypted requests off the TLS socket.
		const tmpServer = http.createServer();
		tmpServer.on('request', (innerReq, innerRes) => {
			this.log('info', 'proxy:connect:tunnel-request', {
				method: innerReq?.method,
				url: innerReq?.url,
				targetHost,
				targetPort,
			});
			this.handleHttpRequest(innerReq, innerRes, {
				tls: true,
				host: targetHost,
				port: targetPort,
			}).catch(() => {
				if (!innerRes.headersSent) {
					innerRes.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
					innerRes.end('Sentinel proxy upstream error');
				}
			});
		});

		// Feed the TLS socket as a connection into the transient HTTP server.
		tmpServer.emit('connection', tlsSocket);

		const cleanup = () => {
			this.log('info', 'proxy:connect:cleanup', { targetHost, targetPort });
			try { tlsSocket.destroy(); } catch { /* ignore */ }
			tmpServer.close();
		};
		tlsSocket.once('close', cleanup);
		tlsSocket.once('error', cleanup);
	}

	async handleDroppedRequest(result, resolvedUrl, res) {
		this.log('warn', 'proxy:http:dropped', {
			requestId: result?.request?.id || '',
			url: result?.request?.url || resolvedUrl,
		});
		await this.historyLog.logTraffic({
			kind: 'http',
			request: result.request,
			response: null,
		});

		res.writeHead(499, { 'content-type': 'text/plain; charset=utf-8' });
		res.end('Request dropped by Sentinel proxy');
	}

	async handleForwardedRequest(result, res) {
		const responseModel = result.response;
		this.log('info', 'proxy:http:response', {
			requestId: result?.request?.id || '',
			statusCode: responseModel?.statusCode,
			statusMessage: responseModel?.statusMessage,
			contentType: responseModel?.contentType,
			bodyLength: responseModel?.bodyLength,
		});

		await this.historyLog.logTraffic({
			kind: 'http',
			request: result.request,
			response: {
				...responseModel,
				rawBody: undefined,
			},
		});

		res.writeHead(responseModel.statusCode, responseModel.statusMessage, responseModel.headers || {});
		res.end(responseModel.rawBody || Buffer.from(responseModel.body || '', 'utf8'));
	}

	async handleHttpRequest(req, res, context = {}) {
		const bodyBuffer = await readBody(req);
		const timestamp = Date.now();
		const connectionId = randomUUID();
		const normalizedHeaders = normalizeHeaders(req.headers || {});
		const contentType = normalizedHeaders['content-type'] || '';
		const bodyText = bodyBuffer.length > 0 && isTextualContentType(contentType)
			? bodyBuffer.toString('utf8')
			: null;
		const rawBodyBase64 = bodyBuffer.length > 0 ? bodyBuffer.toString('base64') : null;
		const targetInfo = resolveHttpTarget(req, context, normalizedHeaders);
		const { isTls, resolvedHost, resolvedPort, resolvedPath, resolvedUrl, queryString, requestProtocol } = targetInfo;

		this.log('info', 'proxy:http:captured', {
			method: (req.method || 'GET').toUpperCase(),
			url: resolvedUrl,
			tls: isTls,
			host: resolvedHost,
			port: resolvedPort,
		});

		const requestModel = {
			id: randomUUID(),
			connectionId,
			timestamp,
			method: (req.method || 'GET').toUpperCase(),
			url: resolvedUrl,
			host: resolvedHost,
			port: resolvedPort,
			path: resolvedPath,
			queryString,
			headers: normalizedHeaders,
			body: bodyText,
			rawBodyBase64,
			protocol: 'HTTP/1.1',
			tls: isTls,
			tags: [],
			comment: '',
			inScope: this.scopeEvaluator ? this.scopeEvaluator({
				protocol: requestProtocol,
				host: resolvedHost,
				port: resolvedPort,
				path: resolvedPath,
			}) : false,
		};

		const embeddedBrowserHeader = String(normalizedHeaders['x-sentinel-embedded-browser'] || '').trim();
		const bypassInterceptQueue = embeddedBrowserHeader === '1';
		if (bypassInterceptQueue) {
			this.log('info', 'proxy:http:bypass-intercept', {
				requestId: requestModel.id,
				url: requestModel.url,
				reason: 'embedded-browser',
			});
		}

		const result = await this.interceptEngine.captureRequest(requestModel, async forwardedRequest => {
			return this.forwardHttpRequest(forwardedRequest);
		}, { bypassQueue: bypassInterceptQueue });

		if (result.action === 'dropped') {
			await this.handleDroppedRequest(result, resolvedUrl, res);
			return;
		}

		await this.handleForwardedRequest(result, res);
	}

	async forwardHttpRequest(request) {
		return forwardRequest(request, (level, stage, detail) => {
			this.log(level, stage, detail);
		});
	}
}

function createProtocolSupport(options = {}) {
	return new ProtocolSupport(options);
}

const defaultProtocolSupport = createProtocolSupport();

module.exports = defaultProtocolSupport;
module.exports.ProtocolSupport = ProtocolSupport;
module.exports.createProtocolSupport = createProtocolSupport;
module.exports.forwardRequest = forwardRequest;
module.exports.setForwardRuntimeConfig = setForwardRuntimeConfig;
module.exports.getForwardRuntimeConfig = getForwardRuntimeConfig;
module.exports.normalizeForwardRuntimeConfig = normalizeForwardRuntimeConfig;
module.exports.DEFAULT_TOOL_IDENTIFIER_HEADER = DEFAULT_TOOL_IDENTIFIER_HEADER;
module.exports.DEFAULT_TOOL_IDENTIFIER_VALUE = DEFAULT_TOOL_IDENTIFIER_VALUE;
