/*
SEN-014 Rules engine
- Match host/path/method/header/body conditions.
- Apply deterministic request rewrite actions before forwarding.
*/

'use strict';

const MAX_REGEX_LENGTH = 512;
const SAFE_FLAGS_PATTERN = /^[imsu]{0,4}$/;
const { clone } = require('./http-utils');

function asString(value) {
	if (value === null || value === undefined) {
		return '';
	}
	return String(value);
}

function matchesText(actual, condition) {
	const text = asString(actual);

	if (typeof condition === 'string') {
		return text.toLowerCase().includes(condition.toLowerCase());
	}

	if (!condition || typeof condition !== 'object') {
		return false;
	}

	const operator = condition.operator || 'contains';
	const value = asString(condition.value);
	if (!value) {
		return false;
	}

	if (operator === 'equals') {
		return text.toLowerCase() === value.toLowerCase();
	}
	if (operator === 'startsWith') {
		return text.toLowerCase().startsWith(value.toLowerCase());
	}
	if (operator === 'regex') {
		const flags = condition.flags || 'i';
		try {
			return new RegExp(value, flags).test(text);
		} catch {
			// Invalid regex patterns or flags are treated as non-matches.
			return false;
		}
	}
	return text.toLowerCase().includes(value.toLowerCase());
}

function matchesHeaders(headers = {}, headerRule = {}) {
	if (!headerRule || typeof headerRule !== 'object') {
		return true;
	}

	const entries = Object.entries(headerRule);
	for (const [headerName, condition] of entries) {
		const actual = headers[String(headerName).toLowerCase()];
		if (!matchesText(actual, condition)) {
			return false;
		}
	}
	return true;
}

function matchesRule(rule, request) {
	if (!rule || rule.enabled === false) {
		return false;
	}

	const match = rule.match || {};

	if (match.method && asString(match.method).toUpperCase() !== asString(request.method).toUpperCase()) {
		return false;
	}

	if (match.host && !matchesText(request.host, match.host)) {
		return false;
	}

	if (match.path && !matchesText(request.path, match.path)) {
		return false;
	}

	if (match.url && !matchesText(request.url, match.url)) {
		return false;
	}

	if (match.body && !matchesText(request.body, match.body)) {
		return false;
	}

	if (match.headers && !matchesHeaders(request.headers, match.headers)) {
		return false;
	}

	return true;
}

function replaceInField(value, find, replaceWith) {
	const source = asString(value);
	const findValue = asString(find);
	if (!findValue) {
		return source;
	}
	return source.split(findValue).join(asString(replaceWith));
}

function applyAction(request, action = {}) {
	const next = clone(request);
	const type = action.type || 'replace';
	const target = action.target || 'path';

	if (target === 'header') {
		const key = asString(action.key || action.header).toLowerCase();
		next.headers = { ...(next.headers || {}) };

		if (!key) {
			return next;
		}

		if (type === 'remove') {
			delete next.headers[key];
			return next;
		}

		if (type === 'append') {
			next.headers[key] = asString(next.headers[key]) + asString(action.value || '');
			return next;
		}

		next.headers[key] = asString(action.value);
		return next;
	}

	if (target === 'method') {
		next.method = asString(action.value || next.method).toUpperCase();
		return next;
	}

	const current = asString(next[target]);
	if (type === 'append') {
		next[target] = current + asString(action.value || '');
		return next;
	}

	if (type === 'replace') {
		const hasFind = Object.hasOwn(action ?? {}, 'find');
		if (hasFind) {
			next[target] = replaceInField(current, action.find, action.replace);
			return next;
		}
		next[target] = asString(action.value || '');
		return next;
	}

	return next;
}

function isRegexConditionSafe(condition) {
	if (!condition || typeof condition !== 'object' || condition.operator !== 'regex') {
		return true;
	}
	const pattern = asString(condition.value);
	const flags = asString(condition.flags || 'i');
	if (pattern.length > MAX_REGEX_LENGTH) {
		return false;
	}
	if (!SAFE_FLAGS_PATTERN.test(flags)) {
		return false;
	}
	try {
		// eslint-disable-next-line no-new
		new RegExp(pattern, flags);
		return true;
	} catch {
		return false;
	}
}

function validateRuleConditions(rule) {
	const match = rule?.match ?? {};
	const fieldConditions = [match?.host, match?.path, match?.url, match?.body].filter(Boolean);
	for (const cond of fieldConditions) {
		if (!isRegexConditionSafe(cond)) {
			return false;
		}
	}
	const headerConditions = Object.values(match?.headers || {});
	for (const cond of headerConditions) {
		if (!isRegexConditionSafe(cond)) {
			return false;
		}
	}
	return true;
}

class RulesEngine {
	constructor(initialRules = []) {
		this.rules = [];
		this.scopeEvaluator = null;
		this.setRules(initialRules);
	}

	setScopeEvaluator(evaluator) {
		if (typeof evaluator === 'function') {
			this.scopeEvaluator = evaluator;
			return { ok: true };
		}
		this.scopeEvaluator = null;
		return { ok: true };
	}

	setRules(rules = []) {
		if (!Array.isArray(rules)) {
			throw new TypeError('setRules requires an array of rule definitions');
		}
		const accepted = [];
		const rejected = [];
		for (const rule of rules) {
			if (validateRuleConditions(rule)) {
				accepted.push(rule);
			} else {
				rejected.push(rule);
			}
		}
		this.rules = accepted
			.map(rule => clone(rule))
			.sort((a, b) => (a.priority || 0) - (b.priority || 0));
		if (rejected.length > 0) {
			return {
				ok: false,
				count: this.rules.length,
				rejectedCount: rejected.length,
				reason: 'invalid_regex_condition',
			};
		}
		return { ok: true, count: this.rules.length };
	}

	getRules() {
		return clone(this.rules);
	}

	getActions(rule) {
		if (Array.isArray(rule.actions)) {
			return rule.actions;
		}
		if (rule.action) {
			return [rule.action];
		}
		return [];
	}

	applyToRequest(request) {
		let next = clone(request || {});

		if (this.scopeEvaluator && !this.scopeEvaluator(next)) {
			return next;
		}

		for (const rule of this.rules) {
			if (!matchesRule(rule, next)) {
				continue;
			}

			const actions = this.getActions(rule);

			for (const action of actions) {
				next = applyAction(next, action);
			}
		}

		return next;
	}
}

function createRulesEngine(initialRules = []) {
	return new RulesEngine(initialRules);
}

const defaultRulesEngine = createRulesEngine();

module.exports = defaultRulesEngine;
module.exports.RulesEngine = RulesEngine;
module.exports.createRulesEngine = createRulesEngine;
