/*
SEN-021 scanner engine
- Passive checks run on observed traffic (headers, cookies, disclosure, secrets).
- Active checks probe SQLi, reflected XSS, and SSRF primitives.
- Findings are emitted in real time and can be persisted via adapters.
*/

'use strict';

const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const { URL } = require('node:url');
const { forwardRequest: defaultForwardRequest } = require('./protocol-support');

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function toText(value) {
	if (typeof value === 'string') {
		return value;
	}
	if (value == null) {
		return '';
	}
	return String(value);
}

function normalizeHeaders(headers = {}) {
	const out = {};
	for (const [name, value] of Object.entries(headers || {})) {
		out[String(name || '').toLowerCase()] = toText(value);
	}
	return out;
}

function normalizeBody(body) {
	if (typeof body === 'string') {
		return body;
	}
	if (body == null) {
		return '';
	}
	return toText(body);
}

function buildEvidence(request, response) {
	const method = toText(request && request.method ? request.method : 'GET').toUpperCase();
	const path = toText((request && (request.path || request.url)) || '/');
	const statusCode = Number(response && response.statusCode) || 0;
	return { method, path, statusCode };
}

function parseSetCookieHeader(rawValue) {
	const value = toText(rawValue);
	if (!value) {
		return [];
	}

	const lines = value.split(/\r?\n|,(?=\s*[^;=]+=)/g).map(item => item.trim()).filter(Boolean);
	return lines;
}

function hasSecretPattern(text) {
	const source = toText(text).toLowerCase();
	if (!source) {
		return false;
	}

	const patterns = [
		/api[_-]?key\s*[:=]\s*['"][a-z0-9_\-]{8,}['"]/i,
		/authorization\s*[:=]\s*bearer\s+[a-z0-9\-_.=]{10,}/i,
		/password\s*[:=]\s*['"][^'"\s]{6,}['"]/i,
		/aws_secret_access_key/i,
	];

	return patterns.some(pattern => pattern.test(source));
}

function passiveFindingsForItem(item) {
	const request = item && item.request ? item.request : {};
	const response = item && item.response ? item.response : {};
	const headers = normalizeHeaders(response.headers || {});
	const findings = [];
	const evidence = buildEvidence(request, response);

	const requiredHeaders = [
		{ name: 'strict-transport-security', severity: 'medium', title: 'Missing HSTS header' },
		{ name: 'x-frame-options', severity: 'medium', title: 'Missing X-Frame-Options header' },
		{ name: 'content-security-policy', severity: 'low', title: 'Missing Content-Security-Policy header' },
		{ name: 'x-content-type-options', severity: 'low', title: 'Missing X-Content-Type-Options header' },
	];

	for (const required of requiredHeaders) {
		if (!headers[required.name]) {
			findings.push({
				severity: required.severity,
				name: required.title,
				description: `${required.name} header was not observed in response.`,
				type: 'passive',
				evidence,
			});
		}
	}

	if (headers.server || headers['x-powered-by']) {
		findings.push({
			severity: 'low',
			name: 'Server technology disclosure',
			description: 'Response discloses implementation details via server-identifying headers.',
			type: 'passive',
			evidence,
		});
	}

	const cookies = parseSetCookieHeader(headers['set-cookie']);
	for (const cookie of cookies) {
		const lowered = cookie.toLowerCase();
		const missing = [];
		if (!lowered.includes('secure')) {
			missing.push('Secure');
		}
		if (!lowered.includes('httponly')) {
			missing.push('HttpOnly');
		}
		if (!lowered.includes('samesite=')) {
			missing.push('SameSite');
		}
		if (missing.length > 0) {
			findings.push({
				severity: 'medium',
				name: 'Weak cookie attributes',
				description: `Cookie is missing ${missing.join(', ')} attributes.`,
				type: 'passive',
				evidence,
			});
		}
	}

	const requestBody = normalizeBody(request.body);
	const responseBody = normalizeBody(response.body);
	if (hasSecretPattern(requestBody) || hasSecretPattern(responseBody)) {
		findings.push({
			severity: 'high',
			name: 'Potential secret disclosure in traffic',
			description: 'Traffic body appears to contain credential or token-like material.',
			type: 'passive',
			evidence,
		});
	}

	return findings;
}

function requestModelFromUrl(targetUrl, extraHeaders = {}) {
	const headers = normalizeHeaders(extraHeaders);
	headers.host = targetUrl.host;

	return {
		id: randomUUID(),
		connectionId: randomUUID(),
		timestamp: Date.now(),
		method: 'GET',
		url: targetUrl.toString(),
		host: targetUrl.hostname,
		port: Number(targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80)),
		path: `${targetUrl.pathname}${targetUrl.search}`,
		queryString: targetUrl.search ? targetUrl.search.slice(1) : '',
		headers,
		body: null,
		rawBodyBase64: null,
		protocol: 'HTTP/1.1',
		tls: targetUrl.protocol === 'https:',
		tags: [],
		comment: '',
		inScope: false,
	};
}

function findingShape(base, patch = {}) {
	return {
		id: randomUUID(),
		scanId: patch.scanId || base.scanId || 'passive',
		severity: patch.severity || base.severity || 'info',
		name: patch.name || base.name || 'Scanner finding',
		description: patch.description || base.description || '',
		type: patch.type || base.type || 'passive',
		host: patch.host || base.host || '',
		path: patch.path || base.path || '/',
		createdAt: Date.now(),
		evidence: patch.evidence || base.evidence || null,
		data: patch.data || base.data || {},
	};
}

class ScannerEngine extends EventEmitter {
	constructor(options = {}) {
		super();
		this.scopeEvaluator = typeof options.scopeEvaluator === 'function' ? options.scopeEvaluator : null;
		this.forwardRequest = typeof options.forwardRequest === 'function'
			? options.forwardRequest
			: defaultForwardRequest;
		this.persistFinding = typeof options.persistFinding === 'function' ? options.persistFinding : null;
		this.listPersistedFindings = typeof options.listPersistedFindings === 'function' ? options.listPersistedFindings : null;
		this.getTrafficItem = typeof options.getTrafficItem === 'function' ? options.getTrafficItem : null;
		this.queryTraffic = typeof options.queryTraffic === 'function' ? options.queryTraffic : null;
		this.jobs = new Map();
		this.resultsByScanId = new Map();
	}

	setScopeEvaluator(evaluator) {
		this.scopeEvaluator = typeof evaluator === 'function' ? evaluator : null;
		return { ok: true };
	}

	setAdapters(options = {}) {
		if (typeof options.forwardRequest === 'function') {
			this.forwardRequest = options.forwardRequest;
		}
		if (typeof options.persistFinding === 'function') {
			this.persistFinding = options.persistFinding;
		}
		if (typeof options.listPersistedFindings === 'function') {
			this.listPersistedFindings = options.listPersistedFindings;
		}
		if (typeof options.getTrafficItem === 'function') {
			this.getTrafficItem = options.getTrafficItem;
		}
		if (typeof options.queryTraffic === 'function') {
			this.queryTraffic = options.queryTraffic;
		}
		return { ok: true };
	}

	async observeTraffic(item) {
		if (!item || !item.request || !item.response) {
			return { added: 0 };
		}

		const findings = passiveFindingsForItem(item).map(raw => findingShape(raw, {
			scanId: 'passive',
			host: toText(item.request.host || ''),
			path: toText(item.request.path || '/'),
			data: {
				historyId: item.id,
				request: { method: item.request.method, url: item.request.url || item.request.path },
			},
		}));

		for (const finding of findings) {
			await this._recordFinding('passive', finding);
		}

		return { added: findings.length };
	}

	async _recordFinding(scanId, finding) {
		const list = this.resultsByScanId.get(scanId) || [];
		list.unshift(clone(finding));
		this.resultsByScanId.set(scanId, list);

		if (this.persistFinding) {
			try {
				await this.persistFinding(clone(finding));
			} catch {
				// Keep in-memory findings available when persistence fails.
			}
		}

		this.emit('progress', {
			scanId,
			pct: 100,
			finding: clone(finding),
		});
	}

	async _buildTargetsFromItemIds(itemIds = []) {
		if (!this.getTrafficItem || !Array.isArray(itemIds) || itemIds.length === 0) {
			return [];
		}

		const out = [];
		for (const itemId of itemIds) {
			const item = await this.getTrafficItem(itemId);
			const req = item && item.request ? item.request : null;
			if (!req) {
				continue;
			}
			const protocol = req.tls ? 'https:' : 'http:';
			const authority = req.port ? `${req.host}:${req.port}` : req.host;
			const path = req.path || '/';
			const url = req.url && /^https?:\/\//i.test(req.url)
				? req.url
				: `${protocol}//${authority}${path}`;
			out.push(url);
		}
		return out;
	}

	async _buildTargetsFromScopeHosts(scopeHosts = []) {
		if (!this.queryTraffic || !Array.isArray(scopeHosts) || scopeHosts.length === 0) {
			return [];
		}

		const discovered = [];
		for (const host of scopeHosts) {
			const result = await this.queryTraffic({
				page: 0,
				pageSize: 500,
				filter: { host: String(host || '').trim() },
			});
			for (const item of result && Array.isArray(result.items) ? result.items : []) {
				const req = item && item.request ? item.request : null;
				if (!req || !req.host) {
					continue;
				}
				const protocol = req.tls ? 'https:' : 'http:';
				const authority = req.port ? `${req.host}:${req.port}` : req.host;
				discovered.push(`${protocol}//${authority}${req.path || '/'}`);
			}
		}
		return discovered;
	}

	async _runActiveChecks(scanId, targetUrls = []) {
		let completed = 0;
		const total = Math.max(1, targetUrls.length * 3);

		for (const targetText of targetUrls) {
			let parsed;
			try {
				parsed = new URL(targetText);
			} catch {
				completed += 3;
				continue;
			}

			const token = `sentinel-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
			const probes = [
				{
					name: 'SQL injection heuristic response',
					severity: 'high',
					type: 'active:sqli',
					mutate(url) {
						const next = new URL(url.toString());
						next.searchParams.set('sntl_sqli', "' OR '1'='1");
						return { url: next, headers: {} };
					},
					isFinding(response) {
						const body = normalizeBody(response.body).toLowerCase();
						return response.statusCode >= 500 || /sql syntax|mysql|sqlite|postgres|odbc|ora-\d+/i.test(body);
					},
					description: 'Response behavior suggests SQL parser error handling was triggered.',
				},
				{
					name: 'Reflected XSS payload echo',
					severity: 'high',
					type: 'active:xss',
					payload: `<script>${token}</script>`,
					mutate(url, payload) {
						const next = new URL(url.toString());
						next.searchParams.set('sntl_xss', payload);
						return { url: next, headers: {} };
					},
					isFinding(response, payload) {
						const body = normalizeBody(response.body);
						return body.includes(payload);
					},
					description: 'Injected script marker reflected in response content.',
				},
				{
					name: 'SSRF primitive header reflection',
					severity: 'medium',
					type: 'active:ssrf',
					mutate(url) {
						const next = new URL(url.toString());
						next.searchParams.set('sntl_ssrf', token);
						return {
							url: next,
							headers: {
								'x-forwarded-host': `${token}.oob.invalid`,
								'x-original-url': `http://${token}.oob.invalid/`,
							},
						};
					},
					isFinding(response) {
						const haystack = [
							normalizeBody(response.body),
							toText((response.headers || {})['location']),
						].join('\n').toLowerCase();
						return haystack.includes(token.toLowerCase());
					},
					description: 'Injected out-of-band marker was reflected in routing-related output.',
				},
			];

			for (const probe of probes) {
				const mutated = probe.mutate(parsed, probe.payload);
				const request = requestModelFromUrl(mutated.url, mutated.headers || {});
				try {
					const response = await this.forwardRequest(request);
					const found = probe.isFinding(response, probe.payload);

					if (found) {
						const finding = findingShape({
							scanId,
							severity: probe.severity,
							name: probe.name,
							description: probe.description,
							type: probe.type,
							host: parsed.hostname,
							path: `${mutated.url.pathname}${mutated.url.search}`,
							evidence: buildEvidence(request, response),
							data: {
								target: parsed.toString(),
								probe: probe.type,
							},
						});
						await this._recordFinding(scanId, finding);
					}
				} catch {
					// Continue scanning remaining probes when individual targets are unreachable.
				}

				completed += 1;
				this.emit('progress', {
					scanId,
					pct: Math.min(100, Math.round((completed / total) * 100)),
					finding: null,
				});
			}
		}
	}

	async start({ targets = [], config = {} } = {}) {
		const scanId = randomUUID();
		const targetArgs = Array.isArray(targets)
			? targets.map(target => String(target || '').trim()).filter(Boolean)
			: [];

		const itemTargets = await this._buildTargetsFromItemIds(config.itemIds || []);
		const scopeTargets = await this._buildTargetsFromScopeHosts(config.scopeHosts || []);
		const normalizedTargets = [...new Set([...targetArgs, ...itemTargets, ...scopeTargets])];

		const inScopeTargets = this.scopeEvaluator
			? normalizedTargets.filter(target => this.scopeEvaluator({ url: target }))
			: normalizedTargets;
		const skippedTargets = normalizedTargets.filter(target => !inScopeTargets.includes(target));

		const job = {
			id: scanId,
			status: 'completed',
			startedAt: Date.now(),
			updatedAt: Date.now(),
			config: clone(config),
			targets: inScopeTargets,
			skippedTargets,
		};

		this.jobs.set(scanId, job);
		this.resultsByScanId.set(scanId, []);

		await this._runActiveChecks(scanId, inScopeTargets);

		job.updatedAt = Date.now();
		job.status = 'completed';
		this.jobs.set(scanId, job);
		this.emit('progress', { scanId, pct: 100, finding: null, skippedTargets: clone(skippedTargets) });
		return { scanId };
	}

	async stop({ scanId } = {}) {
		const job = this.jobs.get(scanId);
		if (!job) {
			return { ok: false };
		}
		job.status = 'stopped';
		job.updatedAt = Date.now();
		this.jobs.set(scanId, job);
		return { ok: true };
	}

	async results({ scanId, page = 0, pageSize = 50 } = {}) {
		let all = this.resultsByScanId.get(scanId) || [];
		if (all.length === 0 && this.listPersistedFindings) {
			try {
				const persisted = await this.listPersistedFindings({ scanId, page: 0, pageSize: 5000 });
				all = Array.isArray(persisted.findings) ? persisted.findings : [];
			} catch {
				all = [];
			}
		}
		const safePage = Math.max(0, Number(page) || 0);
		const safePageSize = Math.max(1, Number(pageSize) || 50);
		const offset = safePage * safePageSize;
		return {
			findings: clone(all.slice(offset, offset + safePageSize)),
			total: all.length,
		};
	}
}

function createScannerEngine(options = {}) {
	return new ScannerEngine(options);
}

const defaultScannerEngine = createScannerEngine();

module.exports = defaultScannerEngine;
module.exports.ScannerEngine = ScannerEngine;
module.exports.createScannerEngine = createScannerEngine;
