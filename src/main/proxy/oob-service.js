/*
SEN-022 OOB callback tracking
- Generates unique callback payload URLs per probe.
- Runs lightweight listener to capture callback hits.
- Correlates hits to originating scan/intruder metadata.
*/

'use strict';

const http = require('node:http');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function normalizeKind(kind) {
	const value = String(kind || 'http').toLowerCase();
	if (value === 'dns' || value === 'smtp') {
		return value;
	}
	return 'http';
}

function tokenFromPath(pathname) {
	const clean = String(pathname || '').replace(/^\/+/, '');
	const [first] = clean.split('/');
	return first || '';
}

class OobService extends EventEmitter {
	constructor(options = {}) {
		super();
		this.payloadDomain = String(options.payloadDomain || 'oob.sentinel.local');
		this.listenerHost = String(options.listenerHost || '127.0.0.1');
		this.listenerPort = Number(options.listenerPort) || 0;
		this.persistInteraction = typeof options.persistInteraction === 'function'
			? options.persistInteraction
			: null;
		this.listPersistedInteractions = typeof options.listPersistedInteractions === 'function'
			? options.listPersistedInteractions
			: null;
		this.server = null;
		this.payloads = new Map();
		this.hitsByPayloadId = new Map();
	}

	setAdapters(options = {}) {
		if (typeof options.persistInteraction === 'function') {
			this.persistInteraction = options.persistInteraction;
		}
		if (typeof options.listPersistedInteractions === 'function') {
			this.listPersistedInteractions = options.listPersistedInteractions;
		}
		return { ok: true };
	}

	async ensureListener() {
		if (this.server) {
			return this.listenerPort;
		}

		this.server = http.createServer((req, res) => {
			const token = tokenFromPath(req.url || '/');
			const payload = [...this.payloads.values()].find(item => item.token === token) || null;

			if (payload) {
				this.recordHit({
					payloadId: payload.id,
					kind: payload.kind,
					token,
					source: req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown',
					requestPath: req.url || '/',
					requestMethod: req.method || 'GET',
					correlation: payload.correlation || {},
				}).catch(() => {});
			}

			res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
			res.end('ok');
		});

		await new Promise((resolve, reject) => {
			this.server.once('error', reject);
			this.server.listen(this.listenerPort, this.listenerHost, () => resolve());
		});

		const address = this.server.address();
		this.listenerPort = address && typeof address === 'object' ? address.port : this.listenerPort;
		return this.listenerPort;
	}

	async createPayload(args = {}) {
		const kind = normalizeKind(args.type);
		const id = randomUUID();
		const token = randomUUID().replace(/-/g, '').slice(0, 18);
		const port = await this.ensureListener();
		const url = `http://${this.listenerHost}:${port}/${token}`;

		const payload = {
			id,
			kind,
			token,
			url,
			domain: `${token}.${this.payloadDomain}`,
			createdAt: Date.now(),
			correlation: {
				sourceRequestId: args.sourceRequestId || null,
				sourceScanId: args.sourceScanId || null,
				sourceAttackId: args.sourceAttackId || null,
				targetUrl: args.targetUrl || null,
			},
		};

		this.payloads.set(id, payload);
		if (!this.hitsByPayloadId.has(id)) {
			this.hitsByPayloadId.set(id, []);
		}

		return {
			id: payload.id,
			url: payload.url,
			domain: payload.domain,
			kind: payload.kind,
			listenerPort: this.listenerPort,
		};
	}

	async recordHit(args = {}) {
		if (!args.payloadId) {
			return { ok: false };
		}

		const hit = {
			id: randomUUID(),
			payloadId: args.payloadId,
			kind: normalizeKind(args.kind),
			timestamp: Date.now(),
			source: args.source || 'unknown',
			token: args.token || '',
			requestPath: args.requestPath || '/',
			requestMethod: args.requestMethod || 'GET',
			correlation: clone(args.correlation || {}),
		};

		const current = this.hitsByPayloadId.get(hit.payloadId) || [];
		current.unshift(hit);
		this.hitsByPayloadId.set(hit.payloadId, current);

		if (this.persistInteraction) {
			try {
				await this.persistInteraction(clone(hit));
			} catch {
				// Keep in-memory hit capture available when persistence fails.
			}
		}

		this.emit('hit', clone(hit));
		return { ok: true, hit: clone(hit) };
	}

	async listHits({ id, page = 0, pageSize = 200 } = {}) {
		const safePage = Math.max(0, Number(page) || 0);
		const safePageSize = Math.max(1, Number(pageSize) || 200);
		const offset = safePage * safePageSize;

		let hits = this.hitsByPayloadId.get(id) || [];
		if (hits.length === 0 && this.listPersistedInteractions) {
			try {
				const persisted = await this.listPersistedInteractions({ payloadId: id, page: 0, pageSize: 5000 });
				hits = Array.isArray(persisted.hits) ? persisted.hits : [];
			} catch {
				hits = [];
			}
		}

		return {
			hits: clone(hits.slice(offset, offset + safePageSize)),
			total: hits.length,
		};
	}
}

function createOobService(options = {}) {
	return new OobService(options);
}

const defaultOobService = createOobService();

module.exports = defaultOobService;
module.exports.OobService = OobService;
module.exports.createOobService = createOobService;
