/*
SEN-019 Decoder transformations
- Supports Base64, URL, HTML entities, Hex, and GZIP encode/decode.
- Applies chained operations with optional recursive replay.
- Supports reverse execution through inferred inverse operations.
*/

'use strict';

const zlib = require('node:zlib');

function clone(value) {
	return structuredClone(value);
}

function encodeHtmlEntities(input) {
	return String(input || '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function decodeHtmlEntities(input) {
	return String(input || '')
		.replaceAll('&#39;', "'")
		.replaceAll('&quot;', '"')
		.replaceAll('&gt;', '>')
		.replaceAll('&lt;', '<')
		.replaceAll('&amp;', '&');
}

function normalizeHex(value) {
	return String(value || '').replaceAll(/\s+/g, '').toLowerCase();
}

function ensureEvenHex(hexText) {
	if (hexText.length % 2 !== 0) {
		throw new Error('hex input must have an even number of characters');
	}
}

function gzipEncode(input) {
	const compressed = zlib.gzipSync(Buffer.from(String(input || ''), 'utf8'));
	return compressed.toString('base64');
}

function gzipDecode(input) {
	const compressed = Buffer.from(String(input || ''), 'base64');
	const inflated = zlib.gunzipSync(compressed);
	return inflated.toString('utf8');
}

function applyOperation(input, operationName) {
	const op = String(operationName || '').toLowerCase();

	if (op === 'base64:encode') {
		return Buffer.from(String(input || ''), 'utf8').toString('base64');
	}
	if (op === 'base64:decode') {
		return Buffer.from(String(input || ''), 'base64').toString('utf8');
	}
	if (op === 'url:encode') {
		return encodeURIComponent(String(input || ''));
	}
	if (op === 'url:decode') {
		return decodeURIComponent(String(input || ''));
	}
	if (op === 'html:encode') {
		return encodeHtmlEntities(input);
	}
	if (op === 'html:decode') {
		return decodeHtmlEntities(input);
	}
	if (op === 'hex:encode') {
		return Buffer.from(String(input || ''), 'utf8').toString('hex');
	}
	if (op === 'hex:decode') {
		const normalized = normalizeHex(input);
		ensureEvenHex(normalized);
		return Buffer.from(normalized, 'hex').toString('utf8');
	}
	if (op === 'gzip:encode') {
		return gzipEncode(input);
	}
	if (op === 'gzip:decode') {
		return gzipDecode(input);
	}

	throw new Error(`unsupported decoder operation: ${operationName}`);
}

function inverseOperation(operationName) {
	const op = String(operationName || '').toLowerCase();
	const pairs = {
		'base64:encode': 'base64:decode',
		'base64:decode': 'base64:encode',
		'url:encode': 'url:decode',
		'url:decode': 'url:encode',
		'html:encode': 'html:decode',
		'html:decode': 'html:encode',
		'hex:encode': 'hex:decode',
		'hex:decode': 'hex:encode',
		'gzip:encode': 'gzip:decode',
		'gzip:decode': 'gzip:encode',
	};
	if (!pairs[op]) {
		throw new Error(`unsupported decoder operation: ${operationName}`);
	}
	return pairs[op];
}

function normalizeOperations(operations = []) {
	if (!Array.isArray(operations) || operations.length === 0) {
		throw new Error('decoder requires at least one operation');
	}

	return operations.map(item => {
		if (typeof item === 'string') {
			return item;
		}
		if (item && typeof item === 'object' && item.op) {
			return String(item.op);
		}
		throw new Error('invalid decoder operation entry');
	});
}

class DecoderService {
	process({ input = '', operations = [], reverse = false, recursiveDepth = 1 } = {}) {
		const normalizedOps = normalizeOperations(operations);
		const runOps = reverse
			? [...normalizedOps].reverse().map(op => inverseOperation(op))
			: normalizedOps;
		const depth = Math.max(1, Number(recursiveDepth) || 1);

		const detailedSteps = [];
		let current = String(input || '');

		for (let pass = 0; pass < depth; pass += 1) {
			let changedInPass = false;
			for (const op of runOps) {
				const before = current;
				const after = applyOperation(before, op);
				if (after !== before) {
					changedInPass = true;
				}
				detailedSteps.push({
					pass: pass + 1,
					operation: op,
					input: before,
					output: after,
				});
				current = after;
			}

			if (!changedInPass) {
				break;
			}
		}

		return {
			result: current,
			steps: detailedSteps.map(step => `${step.pass}:${step.operation}`),
			detailedSteps,
			operationOrder: clone(runOps),
			reverseApplied: Boolean(reverse),
			recursiveDepth: depth,
		};
	}
}

function createDecoderService() {
	return new DecoderService();
}

const defaultDecoderService = createDecoderService();

module.exports = defaultDecoderService;
module.exports.DecoderService = DecoderService;
module.exports.createDecoderService = createDecoderService;
