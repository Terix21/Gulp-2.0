/*
SEN-017 Intruder attack engine
- Builds payload sets from dictionary, brute-force, and sequential sources.
- Runs sniper, pitchfork, and cluster-bomb attacks against marked request templates.
- Streams progress events and stores sortable result metadata with anomaly flags.
*/

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');
const { forwardRequest } = require('./protocol-support');

const MAX_GENERATED_PAYLOADS = 250;
const MAX_ATTACK_REQUESTS = 500;
const MAX_DICTIONARY_FILE_BYTES = 2 * 1024 * 1024;
// Only plain-text line-based formats are valid dictionary sources.
const DICTIONARY_EXTENSIONS = new Set(['.txt', '.csv', '.lst', '.log', '']);
const MARKER_REGEX = /§([^§]*)§/g;

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function splitLines(text) {
	return String(text || '')
		.split(/\r?\n/g)
		.map(line => line.trim())
		.filter(Boolean);
}

function normalizeRequestTemplate(request = {}) {
	if (!request || typeof request !== 'object') {
		throw new Error('intruder requires a request template');
	}

	return {
		method: String(request.method || 'GET').toUpperCase(),
		url: request.url ? String(request.url) : undefined,
		path: request.path ? String(request.path) : undefined,
		headers: clone(request.headers || {}),
		body: request.body == null ? null : String(request.body),
		tls: Boolean(request.tls),
		host: request.host ? String(request.host) : undefined,
		port: request.port,
	};
}

function collectMarkersFromString(field, value, extra = {}) {
	const markers = [];
	if (typeof value !== 'string' || value.length === 0) {
		return markers;
	}

	let match;
	let index = 0;
	while ((match = MARKER_REGEX.exec(value)) !== null) {
		markers.push({
			field,
			index,
			token: match[0],
			defaultValue: match[1],
			...extra,
		});
		index += 1;
	}
	MARKER_REGEX.lastIndex = 0;
	return markers;
}

function detectTemplatePositions(requestTemplate) {
	const markers = [];
	markers.push(...collectMarkersFromString('url', requestTemplate.url));
	markers.push(...collectMarkersFromString('path', requestTemplate.path));
	markers.push(...collectMarkersFromString('body', requestTemplate.body));

	for (const [headerName, headerValue] of Object.entries(requestTemplate.headers || {})) {
		markers.push(...collectMarkersFromString('header', String(headerValue), { headerName }));
	}

	return markers.map((marker, index) => ({
		id: `position-${index + 1}`,
		...marker,
	}));
}

function buildBruteForcePayloads(source = {}) {
	const charset = String(source.charset || '').trim();
	const minLength = Math.max(1, Number(source.minLength) || 1);
	const maxLength = Math.max(minLength, Number(source.maxLength) || minLength);
	const limit = Math.min(MAX_GENERATED_PAYLOADS, Number(source.limit) || MAX_GENERATED_PAYLOADS);
	if (!charset) {
		throw new Error('brute-force payload source requires a charset');
	}

	const values = [];
	function walk(prefix, remaining) {
		if (values.length >= limit) {
			return;
		}
		if (remaining === 0) {
			values.push(prefix);
			return;
		}
		for (const char of charset) {
			if (values.length >= limit) {
				return;
			}
			walk(prefix + char, remaining - 1);
		}
	}

	for (let length = minLength; length <= maxLength; length += 1) {
		walk('', length);
		if (values.length >= limit) {
			break;
		}
	}

	return values;
}

function buildSequentialPayloads(source = {}) {
	const start = Number(source.start);
	const end = Number(source.end);
	const step = Number(source.step) || 1;
	const padTo = Math.max(0, Number(source.padTo) || 0);
	if (!Number.isFinite(start) || !Number.isFinite(end) || step <= 0) {
		throw new Error('sequential payload source requires numeric start/end/step');
	}

	const values = [];
	for (let current = start; current <= end && values.length < MAX_GENERATED_PAYLOADS; current += step) {
		const asText = String(current);
		values.push(padTo > 0 ? asText.padStart(padTo, '0') : asText);
	}
	return values;
}

function buildDictionaryPayloads(source = {}) {
	if (Array.isArray(source.items) && source.items.length > 0) {
		return source.items.map(item => String(item));
	}

	if (source.filePath) {
		const resolvedPath = path.resolve(String(source.filePath));
		const ext = path.extname(resolvedPath).toLowerCase();
		if (!DICTIONARY_EXTENSIONS.has(ext)) {
			throw new Error(`dictionary file has unsupported extension: ${ext || 'none'}`);
		}
		const stat = fs.statSync(resolvedPath);
		if (!stat.isFile()) {
			throw new Error('dictionary filePath must point to a file');
		}
		if (stat.size > MAX_DICTIONARY_FILE_BYTES) {
			throw new Error(`dictionary file exceeds ${MAX_DICTIONARY_FILE_BYTES} byte limit`);
		}
		const fileText = fs.readFileSync(resolvedPath, 'utf8');
		const items = splitLines(fileText);
		if (items.length === 0) {
			throw new Error('dictionary file does not contain any payloads');
		}
		return items;
	}

	if (source.text) {
		const items = splitLines(source.text);
		if (items.length > 0) {
			return items;
		}
	}

	throw new Error('dictionary payload source requires items, text, or filePath');
}

function buildPayloadList(source = {}) {
	const type = String(source.type || 'dictionary');
	if (type === 'dictionary') {
		return buildDictionaryPayloads(source);
	}
	if (type === 'bruteforce') {
		return buildBruteForcePayloads(source);
	}
	if (type === 'sequential') {
		return buildSequentialPayloads(source);
	}
	throw new Error(`unknown intruder payload source type: ${type}`);
}

function summarizeRequest(template) {
	return `${template.method || 'GET'} ${template.url || template.path || '/'}`;
}

function replaceMarkers(value, tokens, assignments) {
	if (typeof value !== 'string' || value.length === 0) {
		return value;
	}

	let markerIndex = 0;
	return value.replace(MARKER_REGEX, (_fullMatch, inner) => {
		const token = tokens[markerIndex];
		markerIndex += 1;
		if (token && Object.prototype.hasOwnProperty.call(assignments, token.id)) {
			return String(assignments[token.id]);
		}
		return inner;
	});
}

function applyAssignmentsToRequest(requestTemplate, positions, assignments) {
	const nextRequest = normalizeRequestTemplate(requestTemplate);
	const grouped = {
		url: positions.filter(position => position.field === 'url'),
		path: positions.filter(position => position.field === 'path'),
		body: positions.filter(position => position.field === 'body'),
		header: positions.filter(position => position.field === 'header'),
	};

	nextRequest.url = replaceMarkers(nextRequest.url, grouped.url, assignments);
	nextRequest.path = replaceMarkers(nextRequest.path, grouped.path, assignments);
	nextRequest.body = replaceMarkers(nextRequest.body, grouped.body, assignments);

	for (const position of grouped.header) {
		const headerName = position.headerName;
		const currentValue = nextRequest.headers[headerName];
		nextRequest.headers[headerName] = replaceMarkers(String(currentValue || ''), [position], assignments);
	}

	return nextRequest;
}

function buildAnomaly(result, baseline) {
	if (!baseline || result.data.error) {
		return { isAnomalous: Boolean(result.data.error), reasons: result.data.error ? ['request failed'] : [] };
	}

	const reasons = [];
	if (result.statusCode !== baseline.statusCode) {
		reasons.push('status changed');
	}
	if (Math.abs(result.length - baseline.length) >= Math.max(50, Math.ceil(baseline.length * 0.2))) {
		reasons.push('length deviated');
	}
	if (result.duration >= Math.max(baseline.duration * 2, baseline.duration + 100)) {
		reasons.push('timing deviated');
	}

	return {
		isAnomalous: reasons.length > 0,
		reasons,
	};
}

function createVirtualPosition(rawConfig = {}) {
	const payloads = Array.isArray(rawConfig.payloads) && rawConfig.payloads.length > 0
		? rawConfig.payloads.map(value => String(value))
		: ['default'];

	return [{
		id: 'position-1',
		field: 'virtual',
		index: 0,
		token: null,
		defaultValue: '',
		source: {
			type: 'dictionary',
			items: payloads,
		},
	}];
}

function normalizeAttackConfig(rawConfig = {}) {
	const requestTemplate = normalizeRequestTemplate(rawConfig.requestTemplate || rawConfig);
	const detectedPositions = detectTemplatePositions(requestTemplate);
	let normalizedPositions = [];
	const simulateOnly = detectedPositions.length === 0
		&& Array.isArray(rawConfig.payloads)
		&& rawConfig.payloads.length > 0
		&& !rawConfig.requestTemplate;

	if (detectedPositions.length > 0) {
		normalizedPositions = detectedPositions.map((position, index) => {
			const rawPosition = Array.isArray(rawConfig.positions) ? rawConfig.positions[index] || {} : {};
			const fallbackItems = Array.isArray(rawConfig.payloads) && rawConfig.payloads.length > 0
				? rawConfig.payloads.map(value => String(value))
				: [position.defaultValue || 'test'];
			const source = rawPosition.source || { type: 'dictionary', items: fallbackItems };
			return {
				...position,
				source: clone(source),
			};
		});
	} else {
		normalizedPositions = createVirtualPosition(rawConfig);
	}

	const attackType = String(rawConfig.attackType || rawConfig.mode || 'sniper').toLowerCase();
	const supportedAttackTypes = new Set(['sniper', 'pitchfork', 'cluster-bomb']);
	if (!supportedAttackTypes.has(attackType)) {
		throw new Error(`unsupported intruder attack type: ${attackType}`);
	}

	const payloadLists = normalizedPositions.map(position => buildPayloadList(position.source));
	payloadLists.forEach((payloads, index) => {
		if (!Array.isArray(payloads) || payloads.length === 0) {
			throw new Error(`position ${index + 1} has no payloads`);
		}
	});

	return {
		requestTemplate,
		attackType,
		positions: normalizedPositions,
		payloadLists,
		simulateOnly,
	};
}

function buildAttackAssignments(config) {
	const defaults = Object.fromEntries(
		config.positions.map(position => [position.id, position.defaultValue || ''])
	);

	if (config.attackType === 'sniper') {
		const variants = [];
		for (let index = 0; index < config.positions.length; index += 1) {
			const position = config.positions[index];
			for (const payload of config.payloadLists[index]) {
				variants.push({
					assignments: { ...defaults, [position.id]: payload },
					payloadSummary: `${position.id}=${payload}`,
				});
				if (variants.length >= MAX_ATTACK_REQUESTS) {
					return variants;
				}
			}
		}
		return variants;
	}

	if (config.attackType === 'pitchfork') {
		const total = Math.min(...config.payloadLists.map(payloads => payloads.length), MAX_ATTACK_REQUESTS);
		const variants = [];
		for (let index = 0; index < total; index += 1) {
			const assignments = { ...defaults };
			const pairs = [];
			config.positions.forEach((position, positionIndex) => {
				const payload = config.payloadLists[positionIndex][index];
				assignments[position.id] = payload;
				pairs.push(`${position.id}=${payload}`);
			});
			variants.push({ assignments, payloadSummary: pairs.join(' | ') });
		}
		return variants;
	}

	const variants = [];
	function walk(positionIndex, assignments, parts) {
		if (variants.length >= MAX_ATTACK_REQUESTS) {
			return;
		}
		if (positionIndex >= config.positions.length) {
			variants.push({ assignments: { ...assignments }, payloadSummary: parts.join(' | ') });
			return;
		}

		const position = config.positions[positionIndex];
		for (const payload of config.payloadLists[positionIndex]) {
			assignments[position.id] = payload;
			parts.push(`${position.id}=${payload}`);
			walk(positionIndex + 1, assignments, parts);
			parts.pop();
			if (variants.length >= MAX_ATTACK_REQUESTS) {
				return;
			}
		}
	}

	walk(0, { ...defaults }, []);
	return variants;
}

class IntruderEngine extends EventEmitter {
	constructor(options = {}) {
		super();
		this.forwardRequest = options.forwardRequest || forwardRequest;
		this.scopeEvaluator = typeof options.scopeEvaluator === 'function' ? options.scopeEvaluator : null;
		this.configById = new Map();
		this.attackById = new Map();
		this.resultsByAttackId = new Map();
	}

	setScopeEvaluator(evaluator) {
		this.scopeEvaluator = typeof evaluator === 'function' ? evaluator : null;
		return { ok: true };
	}

	async configure({ config } = {}) {
		if (!config || typeof config !== 'object') {
			throw new Error('intruder:configure requires a config object');
		}

		const normalizedConfig = normalizeAttackConfig(config);
		const configId = randomUUID();
		this.configById.set(configId, clone(normalizedConfig));
		return { ok: true, configId };
	}

	async start({ configId } = {}) {
		const config = this.configById.get(configId);
		if (!config) {
			throw new Error(`intruder:start received unknown configId ${configId}`);
		}

		const attackId = randomUUID();
		const variants = buildAttackAssignments(config);
		const attack = {
			id: attackId,
			configId,
			status: 'running',
			attackType: config.attackType,
			positionCount: config.positions.length,
			requestSummary: summarizeRequest(config.requestTemplate),
			sent: 0,
			total: variants.length,
			anomalousCount: 0,
			startedAt: Date.now(),
			updatedAt: Date.now(),
			stopRequested: false,
		};

		this.attackById.set(attackId, attack);
		this.resultsByAttackId.set(attackId, []);
		void this.runAttack(attackId, clone(config), variants);
		return { attackId };
	}

	async runAttack(attackId, config, variants) {
		let baseline = null;
		for (let index = 0; index < variants.length; index += 1) {
			const attack = this.attackById.get(attackId);
			if (!attack || attack.stopRequested) {
				break;
			}

			const variant = variants[index];
			const request = applyAssignmentsToRequest(config.requestTemplate, config.positions, variant.assignments);
			const startedAt = Date.now();
			let result;

			if (this.scopeEvaluator && !this.scopeEvaluator(request)) {
				result = {
					id: randomUUID(),
					attackId,
					position: index,
					payload: variant.payloadSummary,
					payloads: clone(variant.assignments),
					statusCode: 0,
					length: 0,
					duration: 0,
					isAnomalous: false,
					anomalyReasons: ['out-of-scope'],
					data: {
						requestSummary: summarizeRequest(request),
						skipped: true,
						reason: 'out-of-scope',
					},
				};
			} else {

			try {
				const response = config.simulateOnly
					? {
						statusCode: 200,
						statusMessage: 'Simulated',
						bodyLength: 0,
						contentType: 'text/plain',
						timings: { total: 0 },
					}
					: await this.forwardRequest({
						id: randomUUID(),
						connectionId: randomUUID(),
						...request,
					});

				const baseMetrics = baseline || {
					statusCode: response.statusCode,
					length: response.bodyLength,
					duration: response.timings ? response.timings.total : (Date.now() - startedAt),
				};
				const anomaly = buildAnomaly({
					statusCode: response.statusCode,
					length: response.bodyLength,
					duration: response.timings ? response.timings.total : (Date.now() - startedAt),
					data: {},
				}, baseline);

				result = {
					id: randomUUID(),
					attackId,
					position: index,
					payload: variant.payloadSummary,
					payloads: clone(variant.assignments),
					statusCode: response.statusCode,
					length: response.bodyLength,
					duration: response.timings ? response.timings.total : (Date.now() - startedAt),
					isAnomalous: anomaly.isAnomalous,
					anomalyReasons: anomaly.reasons,
					data: {
						requestSummary: summarizeRequest(request),
						contentType: response.contentType,
						statusMessage: response.statusMessage,
						baseline: baseMetrics,
					},
				};

				if (!baseline) {
					baseline = baseMetrics;
					result.isAnomalous = false;
					result.anomalyReasons = [];
				}
			} catch (error) {
				result = {
					id: randomUUID(),
					attackId,
					position: index,
					payload: variant.payloadSummary,
					payloads: clone(variant.assignments),
					statusCode: 0,
					length: 0,
					duration: Date.now() - startedAt,
					isAnomalous: true,
					anomalyReasons: ['request failed'],
					data: {
						requestSummary: summarizeRequest(request),
						error: error.message,
					},
				};
			}
			}

			const results = this.resultsByAttackId.get(attackId) || [];
			results.push(result);
			this.resultsByAttackId.set(attackId, results);

			attack.sent = results.length;
			attack.updatedAt = Date.now();
			attack.anomalousCount = results.filter(item => item.isAnomalous).length;
			this.attackById.set(attackId, attack);

			this.emit('progress', {
				attackId,
				sent: attack.sent,
				total: attack.total,
				lastResult: clone(result),
			});
		}

		const attack = this.attackById.get(attackId);
		if (!attack) {
			return;
		}

		attack.status = attack.stopRequested ? 'stopped' : 'completed';
		attack.updatedAt = Date.now();
		this.attackById.set(attackId, attack);
		this.emit('progress', {
			attackId,
			sent: attack.sent,
			total: attack.total,
			lastResult: null,
			status: attack.status,
		});
	}

	async stop({ attackId } = {}) {
		if (!this.attackById.has(attackId)) {
			return { ok: false };
		}

		const attack = this.attackById.get(attackId);
		attack.stopRequested = true;
		attack.updatedAt = Date.now();
		this.attackById.set(attackId, attack);
		return { ok: true };
	}

	async list() {
		return {
			items: [...this.attackById.values()]
				.sort((left, right) => right.updatedAt - left.updatedAt)
				.map(attack => clone({
					id: attack.id,
					configId: attack.configId,
					status: attack.status,
					attackType: attack.attackType,
					positionCount: attack.positionCount,
					requestSummary: attack.requestSummary,
					sent: attack.sent,
					total: attack.total,
					anomalousCount: attack.anomalousCount,
					startedAt: attack.startedAt,
					updatedAt: attack.updatedAt,
				})),
		};
	}

	async results({ attackId, page = 0, pageSize = 50 } = {}) {
		const all = this.resultsByAttackId.get(attackId) || [];
		const safePage = Math.max(0, Number(page) || 0);
		const safePageSize = Math.max(1, Number(pageSize) || 50);
		const offset = safePage * safePageSize;
		const items = all.slice(offset, offset + safePageSize);
		return { results: clone(items), total: all.length };
	}
}

function createIntruderEngine(options) {
	return new IntruderEngine(options);
}

const defaultIntruderEngine = createIntruderEngine();

module.exports = defaultIntruderEngine;
module.exports.IntruderEngine = IntruderEngine;
module.exports.createIntruderEngine = createIntruderEngine;
