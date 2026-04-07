/*
SEN-020 Embedded browser service
- Creates embedded browser sessions managed by main process.
- Coordinates Chromium-backed navigation state and session metadata.
- Leaves actual page loading to the Electron WebContentsView host layer.
*/

'use strict';

const { URL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');

const DEFAULT_BROWSER_HOST_MODEL = 'WebContentsView';
const DEFAULT_ALLOWED_SCHEMES = ['http:', 'https:'];
const DEFAULT_SECURITY_PREFERENCES = Object.freeze({
	contextIsolation: true,
	nodeIntegration: false,
	sandbox: true,
});

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function clampNumber(value, fallback = 0) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) {
		return fallback;
	}
	return Math.max(0, Math.trunc(numeric));
}

function normalizeBounds(bounds = {}) {
	return {
		x: clampNumber(bounds.x, 0),
		y: clampNumber(bounds.y, 0),
		width: clampNumber(bounds.width, 0),
		height: clampNumber(bounds.height, 0),
	};
}

function hasExplicitScheme(value) {
	return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

function normalizeTargetUrl(input) {
	const rawValue = String(input || '').trim();
	if (!rawValue) {
		throw new Error('embedded browser URL is required');
	}

	const candidate = hasExplicitScheme(rawValue) ? rawValue : `http://${rawValue}`;

	let targetUrl;
	try {
		targetUrl = new URL(candidate);
	} catch {
		throw new Error('embedded browser URL is invalid');
	}

	if (!['http:', 'https:'].includes(targetUrl.protocol)) {
		throw new Error('embedded browser only supports http/https URLs');
	}

	return targetUrl;
}

class EmbeddedBrowserService extends EventEmitter {
	constructor(options = {}) {
		super();
		this.sessions = new Map();
		this.getProxyStatus = options.getProxyStatus;
		this.startProxy = options.startProxy;
		this.hostModel = String(options.hostModel || DEFAULT_BROWSER_HOST_MODEL);
		this.allowedSchemes = Array.isArray(options.allowedSchemes) && options.allowedSchemes.length > 0
			? options.allowedSchemes.map(value => String(value || '').toLowerCase())
			: [...DEFAULT_ALLOWED_SCHEMES];
		this.securityPreferences = {
			...DEFAULT_SECURITY_PREFERENCES,
			...(options.securityPreferences || {}),
		};
	}

	buildSessionSnapshot(session) {
		return {
			id: session.id,
			name: session.name,
			currentUrl: session.currentUrl,
			statusCode: session.statusCode,
			contentType: session.contentType,
			bodyPreview: session.bodyPreview,
			updatedAt: session.updatedAt,
			title: session.title,
			loading: session.loading,
			visible: session.visible,
			focused: session.focused,
			canGoBack: session.canGoBack,
			canGoForward: session.canGoForward,
			lastError: session.lastError,
			bounds: clone(session.bounds),
			hostModel: session.hostModel,
			hostPartition: session.hostPartition,
			security: clone(session.security),
		};
	}

	applyRuntimeState({ sessionId, reason = 'runtime:update', title, currentUrl, loading, lastError } = {}) {
		const session = this.getSessionRecord(sessionId);
		if (typeof title === 'string') {
			session.title = title;
		}
		if (typeof currentUrl === 'string') {
			session.currentUrl = currentUrl;
		}
		if (typeof loading === 'boolean') {
			session.loading = loading;
		}
		if (typeof lastError === 'string') {
			session.lastError = lastError;
		}
		session.updatedAt = Date.now();
		this.sessions.set(sessionId, session);
		this.emitSessionState(session, reason);
		return { session: this.buildSessionSnapshot(session) };
	}

	emitSessionState(session, reason, extra = {}) {
		this.emit('state', {
			reason,
			session: this.buildSessionSnapshot(session),
			...clone(extra),
		});
	}

	getSessionRecord(sessionId) {
		if (!sessionId || !this.sessions.has(sessionId)) {
			throw new Error('embedded browser session not found');
		}
		return this.sessions.get(sessionId);
	}

	updateHistoryState(session) {
		session.canGoBack = session.historyIndex > 0;
		session.canGoForward = session.historyIndex >= 0 && session.historyIndex < session.history.length - 1;
	}

	setActiveHistoryEntry(session, url, mode = 'push') {
		const normalizedUrl = String(url || '');
		if (!normalizedUrl) {
			return;
		}

		if (mode === 'push') {
			if (session.historyIndex < session.history.length - 1) {
				session.history = session.history.slice(0, session.historyIndex + 1);
			}
			if (session.history[session.history.length - 1] !== normalizedUrl) {
				session.history.push(normalizedUrl);
			}
			session.historyIndex = session.history.length - 1;
		} else if (mode === 'replace-current') {
			if (session.historyIndex < 0) {
				session.history = [normalizedUrl];
				session.historyIndex = 0;
			} else {
				session.history[session.historyIndex] = normalizedUrl;
			}
		}

		this.updateHistoryState(session);
	}

	prepareSessionForNavigation(session, url, options = {}) {
		const historyMode = options.historyMode || 'push';
		session.currentUrl = url;
		session.statusCode = null;
		session.contentType = '';
		session.bodyPreview = '';
		if (historyMode === 'push') {
			session.title = '';
		}
		session.loading = true;
		session.lastError = '';
		this.setActiveHistoryEntry(session, url, historyMode);
		session.updatedAt = Date.now();
		this.sessions.set(session.id, session);
		this.emit('navigate:start', {
			sessionId: session.id,
			url,
			session: this.buildSessionSnapshot(session),
		});
		this.emitSessionState(session, 'navigate:start');
	}

	buildPendingResponse() {
		return {
			statusCode: null,
			statusMessage: 'Chromium navigation delegated to WebContentsView host',
			headers: {},
			contentType: '',
			body: null,
			bodyLength: 0,
		};
	}

	completeRuntimeNavigation({ sessionId, proxyPort = 0, currentUrl, title, statusCode = null, contentType = '' } = {}) {
		const session = this.getSessionRecord(sessionId);
		if (typeof currentUrl === 'string' && currentUrl) {
			session.currentUrl = currentUrl;
			this.setActiveHistoryEntry(session, currentUrl, 'replace-current');
		}
		if (typeof title === 'string') {
			session.title = title;
		}
		session.statusCode = statusCode;
		session.contentType = String(contentType || '');
		session.loading = false;
		session.lastError = '';
		session.updatedAt = Date.now();
		this.updateHistoryState(session);
		this.sessions.set(session.id, session);

		if (session.title) {
			this.emit('title:updated', { sessionId: session.id, title: session.title });
		}

		const response = this.buildPendingResponse();
		response.statusCode = session.statusCode;
		response.contentType = session.contentType;

		const payload = {
			session: this.buildSessionSnapshot(session),
			response: clone(response),
			proxy: { port: proxyPort },
		};

		this.emit('navigate:complete', payload);
		this.emitSessionState(session, 'navigate:complete', { proxy: { port: proxyPort } });
		return payload;
	}

	failRuntimeNavigation({ sessionId, url, error } = {}) {
		const session = this.getSessionRecord(sessionId);
		session.loading = false;
		session.lastError = error && error.message ? error.message : 'Navigation failed.';
		if (typeof url === 'string' && url) {
			session.currentUrl = url;
		}
		session.updatedAt = Date.now();
		this.sessions.set(session.id, session);
		this.emit('navigate:error', {
			sessionId: session.id,
			url: String(url || session.currentUrl || ''),
			error: session.lastError,
		});
		this.emitSessionState(session, 'navigate:error');
		return { session: this.buildSessionSnapshot(session) };
	}

	beginHistoryNavigation(session, historyIndex) {
		if (!Number.isInteger(historyIndex) || historyIndex < 0 || historyIndex >= session.history.length) {
			return { session: this.buildSessionSnapshot(session), skipped: true };
		}

		const nextUrl = session.history[historyIndex];
		session.historyIndex = historyIndex;
		this.prepareSessionForNavigation(session, nextUrl, { historyMode: 'replace-current' });
		return { session: this.buildSessionSnapshot(session) };
	}

	getArchitecture() {
		return {
			hostModel: this.hostModel,
			allowedSchemes: [...this.allowedSchemes],
			security: clone(this.securityPreferences),
		};
	}

	setProxyAdapters({ getProxyStatus, startProxy } = {}) {
		if (typeof getProxyStatus === 'function') {
			this.getProxyStatus = getProxyStatus;
		}
		if (typeof startProxy === 'function') {
			this.startProxy = startProxy;
		}
	}

	async ensureProxyReady() {
		if (typeof this.getProxyStatus !== 'function' || typeof this.startProxy !== 'function') {
			throw new Error('Embedded browser proxy adapters are not configured');
		}

		const status = await this.getProxyStatus();
		if (status && status.running && Number.isInteger(status.port) && status.port > 0) {
			return status.port;
		}

		// Use port 0 so the OS assigns any available port, avoiding EADDRINUSE conflicts
		// when port 8080 is already in use by another service.
		const started = await this.startProxy({ port: 0 });
		return started.port;
	}

	createSession({ name } = {}) {
		const id = randomUUID();
		const session = {
			id,
			name: String(name || `Session ${this.sessions.size + 1}`),
			currentUrl: '',
			statusCode: null,
			contentType: '',
			bodyPreview: '',
			title: '',
			loading: false,
			visible: true,
			focused: this.sessions.size === 0,
			canGoBack: false,
			canGoForward: false,
			lastError: '',
			bounds: normalizeBounds(),
			hostModel: this.hostModel,
			hostPartition: `sentinel-browser-${id}`,
			security: clone(this.securityPreferences),
			history: [],
			historyIndex: -1,
			updatedAt: Date.now(),
		};

		for (const existing of this.sessions.values()) {
			existing.focused = false;
			this.sessions.set(existing.id, existing);
		}

		this.sessions.set(id, session);
		this.emitSessionState(session, 'session:create', { architecture: this.getArchitecture() });
		return this.buildSessionSnapshot(session);
	}

	listSessions() {
		return {
			items: [...this.sessions.values()]
				.sort((left, right) => right.updatedAt - left.updatedAt)
				.map(session => this.buildSessionSnapshot(session)),
		};
	}

	getSession({ sessionId } = {}) {
		const session = this.getSessionRecord(sessionId);
		return { session: this.buildSessionSnapshot(session) };
	}

	focusSession({ sessionId } = {}) {
		const session = this.getSessionRecord(sessionId);
		for (const record of this.sessions.values()) {
			record.focused = record.id === session.id;
			record.updatedAt = Date.now();
			this.sessions.set(record.id, record);
			this.emitSessionState(record, record.focused ? 'session:focus' : 'session:blur');
		}
		return { session: this.buildSessionSnapshot(session) };
	}

	closeSession({ sessionId } = {}) {
		const session = this.getSessionRecord(sessionId);
		this.sessions.delete(sessionId);
		this.emit('state', {
			reason: 'session:close',
			session: this.buildSessionSnapshot(session),
			closed: true,
		});

		if (session.focused && this.sessions.size > 0) {
			const [next] = this.sessions.values();
			next.focused = true;
			next.updatedAt = Date.now();
			this.sessions.set(next.id, next);
			this.emitSessionState(next, 'session:focus');
		}

		return { ok: true, sessionId };
	}

	showView({ sessionId } = {}) {
		const session = this.getSessionRecord(sessionId);
		session.visible = true;
		session.updatedAt = Date.now();
		this.sessions.set(sessionId, session);
		this.emitSessionState(session, 'view:show');
		return { session: this.buildSessionSnapshot(session) };
	}

	hideView({ sessionId } = {}) {
		const session = this.getSessionRecord(sessionId);
		session.visible = false;
		session.updatedAt = Date.now();
		this.sessions.set(sessionId, session);
		this.emitSessionState(session, 'view:hide');
		return { session: this.buildSessionSnapshot(session) };
	}

	setViewBounds({ sessionId, bounds } = {}) {
		const session = this.getSessionRecord(sessionId);
		session.bounds = normalizeBounds(bounds);
		session.updatedAt = Date.now();
		this.sessions.set(sessionId, session);
		this.emitSessionState(session, 'view:set-bounds');
		return { session: this.buildSessionSnapshot(session) };
	}

	async navigate({ sessionId, url } = {}) {
		const session = this.getSessionRecord(sessionId);
		const targetUrl = normalizeTargetUrl(url);
		if (!this.allowedSchemes.includes(targetUrl.protocol.toLowerCase())) {
			throw new Error('embedded browser URL scheme is blocked by navigation policy');
		}

		const proxyPort = await this.ensureProxyReady();
		this.prepareSessionForNavigation(session, targetUrl.toString(), { historyMode: 'push' });
		return {
			session: this.buildSessionSnapshot(session),
			response: this.buildPendingResponse(),
			proxy: { port: proxyPort },
		};
	}

	async back({ sessionId } = {}) {
		const session = this.getSessionRecord(sessionId);
		return this.beginHistoryNavigation(session, session.historyIndex - 1);
	}

	async forward({ sessionId } = {}) {
		const session = this.getSessionRecord(sessionId);
		return this.beginHistoryNavigation(session, session.historyIndex + 1);
	}

	async reload({ sessionId } = {}) {
		const session = this.getSessionRecord(sessionId);
		if (!session.currentUrl) {
			return { session: this.buildSessionSnapshot(session), skipped: true };
		}
		this.prepareSessionForNavigation(session, session.currentUrl, { historyMode: 'replace-current' });
		return { session: this.buildSessionSnapshot(session) };
	}

	stop({ sessionId } = {}) {
		const session = this.getSessionRecord(sessionId);
		session.loading = false;
		session.updatedAt = Date.now();
		this.sessions.set(sessionId, session);
		this.emitSessionState(session, 'navigate:stop');
		return { session: this.buildSessionSnapshot(session) };
	}
}

function createEmbeddedBrowserService(options = {}) {
	return new EmbeddedBrowserService(options);
}

const defaultEmbeddedBrowserService = createEmbeddedBrowserService();

module.exports = defaultEmbeddedBrowserService;
module.exports.EmbeddedBrowserService = EmbeddedBrowserService;
module.exports.createEmbeddedBrowserService = createEmbeddedBrowserService;
