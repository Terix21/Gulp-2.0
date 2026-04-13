/*
SEN-016 Repeater service
- Loads captured requests into editable entries.
- Sends modified requests to upstream and records per-entry send history.
- Provides Raw, Hex, and Rendered response data for the panel viewer.
*/

'use strict';

const { randomUUID } = require('node:crypto');
const { forwardRequest } = require('./protocol-support');

function clone(value) {
	return structuredClone(value);
}

/**
 * Strip rawBody (Buffer) before storing — keep rawBodyBase64 instead.
 * @param {object} response
 * @returns {object}
 */
function sanitiseResponse(response) {
	if (!response) {
		return null;
	}
	const rest = { ...response };
	delete rest.rawBody;
	return rest;
}

class RepeaterService {
	constructor() {
		this.entries = [];
	}

	/**
	 * Send a request, creating a new entry when no entryId is provided, or
	 * appending a new send record to an existing entry.
	 *
	 * @param {{ request: object, entryId?: string }} args
	 * @returns {Promise<{ response: object, entry: object }>}
	 */
	async send({ request, entryId } = {}) {
		if (!request) {
			throw new Error('repeater:send requires a request payload');
		}

		const requestWithId = {
			id: randomUUID(),
			connectionId: randomUUID(),
			...clone(request),
		};

		const response = sanitiseResponse(await forwardRequest(requestWithId));
		const sentAt = Date.now();
		const sendRecord = {
			id: randomUUID(),
			sentAt,
			request: clone(requestWithId),
			response: clone(response),
		};

		let entry;
		if (entryId) {
			entry = this.entries.find(e => e.id === entryId);
		}

		if (entry) {
			entry.updatedAt = sentAt;
			entry.request = clone(requestWithId);
			entry.response = clone(response);
			entry.sends.unshift(sendRecord);
		} else {
			entry = {
				id: randomUUID(),
				createdAt: sentAt,
				updatedAt: sentAt,
				request: clone(requestWithId),
				response: clone(response),
				sends: [sendRecord],
			};
			this.entries.unshift(entry);
			if (this.entries.length > 200) {
				this.entries.splice(200);
			}
		}

		return {
			response: clone(response),
			entry: this._entryWithoutSends(entry),
		};
	}

	/**
	 * Get a single entry with its full send history.
	 * @param {string} id
	 * @returns {object | null}
	 */
	getEntry(id) {
		const entry = this.entries.find(e => e.id === id);
		return entry ? clone(entry) : null;
	}

	/**
	 * Lightweight entry list for the sidebar (no sends arrays).
	 * @returns {{ items: object[] }}
	 */
	listHistory() {
		return { items: this.entries.map(e => this._entryWithoutSends(e)) };
	}

	_entryWithoutSends(entry) {
		const rest = { ...entry };
		delete rest.sends;
		return clone(rest);
	}
}

function createRepeaterService() {
	return new RepeaterService();
}

const defaultRepeaterService = createRepeaterService();

module.exports = defaultRepeaterService;
module.exports.RepeaterService = RepeaterService;
module.exports.createRepeaterService = createRepeaterService;
