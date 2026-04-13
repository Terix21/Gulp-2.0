/*
Shared HTTP utility helpers used across proxy service modules.
Centralises frequently duplicated primitives to keep individual services focused.
*/

'use strict';

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

function normalizeHeaders(headers = {}) {
	const out = {};
	for (const [name, value] of Object.entries(headers || {})) {
		const key = String(name || '').toLowerCase();
		if (Array.isArray(value)) {
			out[key] = value.join(', ');
		} else {
			out[key] = toText(value);
		}
	}
	return out;
}

function splitLines(text) {
	return String(text || '')
		.split(/\r?\n/g)
		.map(line => line.trim())
		.filter(Boolean);
}

function asString(value) {
	if (value === null || value === undefined) {
		return '';
	}
	return String(value);
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
	return String(value || '').trim();
}

// Returns true when the character is a valid RFC 6265 cookie-name token character.
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

// Returns true when the substring at `index` looks like the start of a cookie name=value pair.
// Used to distinguish cookie-separating commas from commas inside attribute values (e.g. Expires).
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

// Splits a single Set-Cookie header line on cookie-separating commas only.
// Commas inside attribute values (e.g. Expires=Wed, 21 Oct …) are left intact.
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

module.exports = {
	clone,
	toText,
	normalizeHeaders,
	splitLines,
	asString,
	asArray,
	normalizeText,
	isCookieNameChar,
	canStartCookiePair,
	splitCookieLine,
};
