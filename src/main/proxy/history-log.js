/*
SEN-014 History logging
- Records request/response pairs in-memory for fast panel updates.
- Persists each traffic item to project-store when available.
*/

'use strict';

const { EventEmitter } = require('node:events');
const { randomUUID } = require('node:crypto');

function clone(value) {
	return structuredClone(value);
}

function matchesFilter(item, filter = {}) {
	const request = item.request || {};
	const response = item.response || {};

	if (filter.method && String(request.method || '').toUpperCase() !== String(filter.method).toUpperCase()) {
		return false;
	}

	if (filter.host && !String(request.host || '').toLowerCase().includes(String(filter.host).toLowerCase())) {
		return false;
	}

	if (filter.path && !String(request.path || '').startsWith(String(filter.path))) {
		return false;
	}

	if (typeof filter.statusCode === 'number' && response.statusCode !== filter.statusCode) {
		return false;
	}

	if (filter.search) {
		const haystack = [
			request.url,
			request.path,
			request.body,
			response.body,
			request.host,
		].map(v => String(v || '').toLowerCase()).join('\n');

		if (!haystack.includes(String(filter.search).toLowerCase())) {
			return false;
		}
	}

	return true;
}

class HistoryLog extends EventEmitter {
	constructor(options = {}) {
		super();
		this.items = [];
		this.maxItems = Number.isInteger(options.maxItems) && options.maxItems > 0 ? options.maxItems : 5000;
		this.projectStore = options.projectStore || null;
	}

	setProjectStore(projectStore) {
		this.projectStore = projectStore || null;
	}

	async logTraffic(payload = {}) {
		const item = {
			id: payload.id || randomUUID(),
			kind: payload.kind || 'http',
			timestamp: payload.timestamp || Date.now(),
			request: payload.request || null,
			response: payload.response || null,
			wsEvent: payload.wsEvent || null,
		};

		this.items.push(item);
		if (this.items.length > this.maxItems) {
			this.items.splice(0, this.items.length - this.maxItems);
		}

		if (this.projectStore && typeof this.projectStore.upsertTrafficItem === 'function') {
			try {
				await this.projectStore.upsertTrafficItem(item);
			} catch {
				// Continue with in-memory history if persistence layer is unavailable.
			}
		}

		this.emit('push', clone(item));
		return clone(item);
	}

	async query(options = {}) {
		const page = Number.isInteger(options.page) && options.page >= 0 ? options.page : 0;
		const pageSize = Number.isInteger(options.pageSize) && options.pageSize > 0 ? options.pageSize : 50;
		const filter = options.filter || {};

		if (this.projectStore && typeof this.projectStore.queryTraffic === 'function') {
			try {
				return await this.projectStore.queryTraffic({ page, pageSize, filter });
			} catch {
				// Fallback to in-memory history when persistent store is unavailable.
			}
		}

		const filtered = this.items.filter(item => matchesFilter(item, filter));
		filtered.sort((a, b) => b.timestamp - a.timestamp);
		const offset = page * pageSize;
		const pageItems = filtered.slice(offset, offset + pageSize);

		return {
			items: clone(pageItems),
			total: filtered.length,
			page,
			pageSize,
		};
	}

	async get(id) {
		if (!id) {
			return null;
		}

		if (this.projectStore && typeof this.projectStore.getTrafficItem === 'function') {
			try {
				return await this.projectStore.getTrafficItem(id);
			} catch {
				// Fallback to in-memory history when persistent store is unavailable.
			}
		}

		const match = this.items.find(item => item.id === id) || null;
		return match ? clone(match) : null;
	}

	async clear() {
		this.items = [];
		if (this.projectStore && typeof this.projectStore.clearTrafficHistory === 'function') {
			try {
				await this.projectStore.clearTrafficHistory();
			} catch {
				// Keep in-memory clear semantics even if persistent clear fails.
			}
		}
		return { ok: true };
	}
}

function createHistoryLog(options = {}) {
	return new HistoryLog(options);
}

const defaultHistoryLog = createHistoryLog();

module.exports = defaultHistoryLog;
module.exports.HistoryLog = HistoryLog;
module.exports.createHistoryLog = createHistoryLog;
