/*
SEN-023 Sequencer entropy analysis
- Captures replay token samples from responses.
- Calculates entropy/distribution and FIPS-style checks.
- Produces analyst report with exportable CSV metrics.
*/

'use strict';

const { randomUUID } = require('node:crypto');
const { forwardRequest: defaultForwardRequest } = require('./protocol-support');

// Maximum accepted length for a user-supplied token key to bound regex/parse complexity.
const MAX_TOKEN_KEY_LEN = 256;

function clone(value) {
	return structuredClone(value);
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

function shannonEntropyBitsPerChar(values = []) {
	const text = values.join('');
	if (!text) {
		return 0;
	}

	const counts = new Map();
	for (const char of text) {
		counts.set(char, (counts.get(char) || 0) + 1);
	}

	let entropy = 0;
	for (const count of counts.values()) {
		const p = count / text.length;
		entropy -= p * Math.log2(p);
	}
	return entropy;
}

function bytesToBitString(input) {
	const bytes = Buffer.from(toText(input), 'utf8');
	let bits = '';
	for (const byte of bytes.values()) {
		bits += byte.toString(2).padStart(8, '0');
	}
	return bits;
}

function monobitTest(values = []) {
	const bits = bytesToBitString(values.join(''));
	if (!bits) {
		return { pass: false, ratio: 0, ones: 0, zeros: 0 };
	}

	const ones = bits.split('').filter(bit => bit === '1').length;
	const zeros = bits.length - ones;
	const ratio = Math.abs(ones - zeros) / bits.length;
	return {
		pass: ratio <= 0.1,
		ratio,
		ones,
		zeros,
	};
}

function runsTest(values = []) {
	const bits = bytesToBitString(values.join(''));
	if (bits.length < 2) {
		return { pass: false, runs: 0, expected: 0 };
	}

	let runs = 1;
	for (let i = 1; i < bits.length; i += 1) {
		if (bits[i] !== bits[i - 1]) {
			runs += 1;
		}
	}

	const ones = bits.split('').filter(bit => bit === '1').length;
	const zeros = bits.length - ones;
	const expected = ((2 * ones * zeros) / bits.length) + 1;
	const varianceRatio = expected > 0 ? Math.abs(runs - expected) / expected : 1;

	return {
		pass: varianceRatio <= 0.35,
		runs,
		expected,
		varianceRatio,
	};
}

// Determines whether a character is a valid token-value character.
// Matches the same set as the former regex capture group: [A-Za-z0-9._+/=-].
function isValueChar(ch) {
	return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') ||
		(ch >= '0' && ch <= '9') || ch === '.' || ch === '_' ||
		ch === '+' || ch === '/' || ch === '=' || ch === '-';
}

function skipSpaces(text, start) {
	let i = start;
	while (i < text.length && text[i] === ' ') {
		i += 1;
	}
	return i;
}

function readBodyTokenAt(body, start) {
	let i = skipSpaces(body, start);
	if (i >= body.length || (body[i] !== ':' && body[i] !== '=')) {
		return { token: '', nextPos: start + 1 };
	}

	i += 1;
	i = skipSpaces(body, i);
	// Quotes are delimiters and not part of allowed token characters.
	if (i < body.length && (body[i] === '"' || body[i] === "'")) {
		i += 1;
	}

	const valueStart = i;
	while (i < body.length && isValueChar(body[i])) {
		i += 1;
	}

	if (i <= valueStart) {
		return { token: '', nextPos: start + 1 };
	}

	return {
		token: body.slice(valueStart, i),
		nextPos: start + 1,
	};
}

// Deterministic linear scan for "key = value" or "key : value" patterns in body text.
// Avoids constructing a RegExp from user-supplied key to prevent regex injection and ReDoS.
function extractBodyToken(body, key) {
	const lowerBody = body.toLowerCase();
	const lowerKey = key.toLowerCase();
	let pos = 0;

	while (pos < body.length) {
		const idx = lowerBody.indexOf(lowerKey, pos);
		if (idx === -1) {
			return '';
		}

		const result = readBodyTokenAt(body, idx + lowerKey.length);
		if (result.token) {
			return result.token;
		}
		pos = idx + 1;
	}
	return '';
}

function normalizeHeaders(headers = {}) {
	const out = {};
	for (const [name, value] of Object.entries(headers || {})) {
		out[String(name || '').toLowerCase()] = toText(value);
	}
	return out;
}

function isCookieNameChar(character) {
	if (!character) {
		return false;
	}
	const code = character.codePointAt(0);
	return (
		(code >= 48 && code <= 57)
		|| (code >= 65 && code <= 90)
		|| (code >= 97 && code <= 122)
		|| character === '!'
		|| character === '#'
		|| character === '$'
		|| character === '%'
		|| character === '&'
		|| character === '\''
		|| character === '*'
		|| character === '+'
		|| character === '-'
		|| character === '.'
		|| character === '^'
		|| character === '_'
		|| character === '`'
		|| character === '|'
		|| character === '~'
	);
}

function canStartCookiePair(text, index) {
	let cursor = index;
	while (cursor < text.length && (text[cursor] === ' ' || text[cursor] === '\t')) {
		cursor += 1;
	}

	const start = cursor;
	while (cursor < text.length && isCookieNameChar(text[cursor])) {
		cursor += 1;
	}

	return cursor !== start && cursor < text.length && text[cursor] === '=';
}

function splitCookieLine(line) {
	const segments = [];
	let start = 0;

	for (let i = 0; i < line.length; i += 1) {
		if (line[i] !== ',') {
			continue;
		}

		if (!canStartCookiePair(line, i + 1)) {
			continue;
		}

		segments.push(line.slice(start, i).trim());
		start = i + 1;
	}

	segments.push(line.slice(start).trim());
	return segments.filter(Boolean);
}

function parseCookies(setCookieHeader) {
	const value = toText(setCookieHeader);
	if (!value) {
		return [];
	}

	const normalized = value.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
	const lines = normalized.split('\n');
	const segments = [];
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		segments.push(...splitCookieLine(trimmed));
	}

	return segments.map(cookieLine => {
		const first = cookieLine.split(';')[0] || '';
		const separator = first.indexOf('=');
		if (separator <= 0) {
			return { key: '', value: '' };
		}
		return {
			key: first.slice(0, separator).trim(),
			value: first.slice(separator + 1).trim(),
		};
	});
}

function extractToken(response, tokenField = {}) {
	const source = String(tokenField.source || 'cookie').toLowerCase();
	const key = toText(tokenField.key || '').trim().slice(0, MAX_TOKEN_KEY_LEN);

	if (source === 'header') {
		const headers = normalizeHeaders(response?.headers || {});
		if (!key) {
			return headers['authorization'] || '';
		}
		return headers[key.toLowerCase()] || '';
	}

	if (source === 'body') {
		const body = toText(response?.body || '');
		if (!body) {
			return '';
		}
		if (!key) {
			return body;
		}
		return extractBodyToken(body, key);
	}

	const cookies = parseCookies(response?.headers?.['set-cookie'] || '');
	if (!key && cookies.length > 0) {
		return toText(cookies[0].value);
	}
	const found = cookies.find(cookie => cookie.key.toLowerCase() === key.toLowerCase());
	return found ? toText(found.value) : '';
}

class SequencerService {
	constructor(options = {}) {
		this.forwardRequest = typeof options.forwardRequest === 'function'
			? options.forwardRequest
			: defaultForwardRequest;
		this.getTrafficItem = typeof options.getTrafficItem === 'function' ? options.getTrafficItem : null;
		this.upsertSession = typeof options.upsertSession === 'function' ? options.upsertSession : null;
		this.addTokenRow = typeof options.addTokenRow === 'function' ? options.addTokenRow : null;
		this.getSession = typeof options.getSession === 'function' ? options.getSession : null;
		this.listTokenRows = typeof options.listTokenRows === 'function' ? options.listTokenRows : null;
		this.sessions = new Map();
	}

	setAdapters(options = {}) {
		if (typeof options.forwardRequest === 'function') {
			this.forwardRequest = options.forwardRequest;
		}
		if (typeof options.getTrafficItem === 'function') {
			this.getTrafficItem = options.getTrafficItem;
		}
		if (typeof options.upsertSession === 'function') {
			this.upsertSession = options.upsertSession;
		}
		if (typeof options.addTokenRow === 'function') {
			this.addTokenRow = options.addTokenRow;
		}
		if (typeof options.getSession === 'function') {
			this.getSession = options.getSession;
		}
		if (typeof options.listTokenRows === 'function') {
			this.listTokenRows = options.listTokenRows;
		}
		return { ok: true };
	}

	async _resolveRequestTemplate(config = {}) {
		if (config?.requestTemplate && typeof config.requestTemplate === 'object') {
			return clone(config.requestTemplate);
		}

		if (config?.requestId && this.getTrafficItem) {
			const item = await this.getTrafficItem(config.requestId);
			if (item?.request) {
				return clone(item.request);
			}
		}

		throw new TypeError('sequencer capture requires requestTemplate or requestId');
	}

	async _persistSession(session) {
		if (!this.upsertSession) {
			return;
		}
		try {
			await this.upsertSession(clone(session));
		} catch {
			// Continue with in-memory session state.
		}
	}

	buildCaptureRequest(template) {
		const request = clone(template);
		request.id = randomUUID();
		request.connectionId = randomUUID();
		request.timestamp = Date.now();
		return request;
	}

	async captureTokenSample(session, template, tokenField) {
		const request = this.buildCaptureRequest(template);
		const response = await this.forwardRequest(request);
		const token = extractToken(response, tokenField);

		if (!token) {
			return;
		}

		const tokenRow = {
			id: randomUUID(),
			sessionId: session.id,
			position: session.tokens.length,
			token,
			capturedAt: Date.now(),
		};
		session.tokens.push(tokenRow);

		if (!this.addTokenRow) {
			return;
		}

		try {
			await this.addTokenRow(clone(tokenRow));
		} catch {
			// Keep capture running when persistence fails.
		}
	}

	async captureStart({ config = {} } = {}) {
		const template = await this._resolveRequestTemplate(config);
		const sampleSize = Math.max(5, Number(config.sampleSize) || 20);
		const tokenField = config.tokenField || { source: 'cookie', key: '' };

		const session = {
			id: randomUUID(),
			status: 'capturing',
			createdAt: Date.now(),
			updatedAt: Date.now(),
			config: {
				sampleSize,
				tokenField,
				requestTemplate: template,
			},
			tokens: [],
		};
		this.sessions.set(session.id, session);
		await this._persistSession(session);

		for (let position = 0; position < sampleSize; position += 1) {
			await this.captureTokenSample(session, template, tokenField);
		}

		session.status = 'stopped';
		session.updatedAt = Date.now();
		this.sessions.set(session.id, session);
		await this._persistSession(session);

		return {
			sessionId: session.id,
			sampleCount: session.tokens.length,
		};
	}

	async captureStop({ sessionId } = {}) {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return { ok: false, sampleCount: 0 };
		}

		session.status = 'stopped';
		session.updatedAt = Date.now();
		this.sessions.set(session.id, session);

		if (this.upsertSession) {
			try {
				await this.upsertSession(clone(session));
			} catch {
				// Keep in-memory state even if persistence update fails.
			}
		}

		return { ok: true, sampleCount: session.tokens.length };
	}

	async _loadSession(sessionId) {
		let session = this.sessions.get(sessionId) || null;
		if (!session && this.getSession) {
			try {
				session = await this.getSession(sessionId);
				if (session) {
					session.tokens = [];
					this.sessions.set(sessionId, session);
				}
			} catch {
				session = null;
			}
		}

		if (!session) {
			throw new Error('sequencer session not found');
		}

		if ((!Array.isArray(session.tokens) || session.tokens.length === 0) && this.listTokenRows) {
			try {
				session.tokens = await this.listTokenRows(sessionId);
				this.sessions.set(sessionId, session);
			} catch {
				session.tokens = [];
			}
		}

		return session;
	}

	async analyze({ sessionId } = {}) {
		const session = await this._loadSession(sessionId);
		const tokenValues = (session.tokens || []).map(item => toText(item.token)).filter(Boolean);
		if (tokenValues.length === 0) {
			throw new Error('sequencer session has no captured tokens');
		}

		const entropyPerChar = shannonEntropyBitsPerChar(tokenValues);
		const avgLength = tokenValues.reduce((sum, token) => sum + token.length, 0) / tokenValues.length;
		const monobit = monobitTest(tokenValues);
		const runs = runsTest(tokenValues);

		const charCounts = {};
		for (const token of tokenValues) {
			for (const char of token) {
				charCounts[char] = (charCounts[char] || 0) + 1;
			}
		}

		const pass = entropyPerChar >= 3.5 && monobit.pass && runs.pass;
		const report = {
			sessionId,
			sampleCount: tokenValues.length,
			averageLength: Number(avgLength.toFixed(2)),
			entropyBitsPerChar: Number(entropyPerChar.toFixed(4)),
			bitStrengthEstimate: Number((entropyPerChar * avgLength).toFixed(2)),
			fips140_2: {
				monobit,
				runs,
			},
			characterDistribution: charCounts,
			rating: pass ? 'pass' : 'fail',
			summary: pass
				? 'Token source appears sufficiently random for baseline screening.'
				: 'Token source shows predictability signals and should be investigated.',
			exportCsv: [
				'position,token',
				...session.tokens.map(item => `${item.position},"${String(item.token).replaceAll('"', '""')}"`),
			].join('\n'),
		};

		session.status = 'analyzed';
		session.updatedAt = Date.now();
		this.sessions.set(session.id, session);

		if (this.upsertSession) {
			try {
				await this.upsertSession(clone(session));
			} catch {
				// Keep local analyzed state when persistence fails.
			}
		}

		return { report };
	}
}

function createSequencerService(options = {}) {
	return new SequencerService(options);
}

const defaultSequencerService = createSequencerService();

module.exports = defaultSequencerService;
module.exports.SequencerService = SequencerService;
module.exports.createSequencerService = createSequencerService;
