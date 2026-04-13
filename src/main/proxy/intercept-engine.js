/*
SEN-014 Intercept engine
- Queue/pause/forward/drop/edit flow for intercepted requests.
- Global pause gate that can stop forwarding and resume in bulk.
- Event emission for renderer updates via main-process IPC push channels.
*/

'use strict';

const { EventEmitter } = require('node:events');

function clone(value) {
  return structuredClone(value);
}

function mergeRequestEdits(baseRequest, editedRequest = {}) {
  const next = clone(baseRequest || {});
  for (const [key, value] of Object.entries(editedRequest || {})) {
    if (key === 'headers' && value && typeof value === 'object') {
      next.headers = { ...(next.headers || {}), ...value };
      continue;
    }
    next[key] = value;
  }
  return next;
}

class InterceptEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.rulesEngine = options.rulesEngine || null;
    this.interceptEnabled = options.interceptEnabled !== false;
    this.globalPaused = false;
    this.pendingById = new Map();
    this.queueOrder = [];
  }

  isEnabled() {
    return this.interceptEnabled;
  }

  isGloballyPaused() {
    return this.globalPaused;
  }

  setInterceptEnabled(enabled) {
    this.interceptEnabled = !!enabled;
    if (!this.interceptEnabled && !this.globalPaused) {
      this.resumeQueued();
    }
    this.emit('state', {
      interceptEnabled: this.interceptEnabled,
      globalPaused: this.globalPaused,
      queueDepth: this.queueOrder.length,
    });
    return { intercepting: this.interceptEnabled };
  }

  setGlobalPause(paused) {
    this.globalPaused = !!paused;
    if (!this.globalPaused && !this.interceptEnabled) {
      this.resumeQueued();
    }
    this.emit('state', {
      interceptEnabled: this.interceptEnabled,
      globalPaused: this.globalPaused,
      queueDepth: this.queueOrder.length,
    });
    return { paused: this.globalPaused };
  }

  pause() {
    return this.setGlobalPause(true);
  }

  resume() {
    return this.setGlobalPause(false);
  }

  getQueue() {
    return this.queueOrder.map(requestId => {
      const pending = this.pendingById.get(requestId);
      return pending ? clone(pending.request) : null;
    }).filter(Boolean);
  }

  async captureRequest(request, forwarder, options = {}) {
    if (typeof forwarder !== 'function') {
      throw new TypeError('captureRequest requires a forwarder(request) function');
    }

    const queuedRequest = clone(request || {});
    const bypassQueue = !!options?.bypassQueue;

    if (bypassQueue || (!this.interceptEnabled && !this.globalPaused)) {
      const finalRequest = this.applyRules(queuedRequest);
      const response = await forwarder(finalRequest);
      this.emit('forwarded', { request: clone(finalRequest), response: clone(response) });
      return { action: 'forwarded', request: finalRequest, response };
    }

    return new Promise((resolve, reject) => {
      const requestId = queuedRequest.id;
      if (!requestId) {
        reject(new Error('captureRequest requires request.id for queue operations'));
        return;
      }

      this.pendingById.set(requestId, {
        request: queuedRequest,
        forwarder,
        resolve,
        reject,
      });
      this.queueOrder.push(requestId);

      this.emit('request', clone(queuedRequest));
      this.emit('queue', this.getQueue());
    });
  }

  edit(requestId, editedRequest = {}) {
    const pending = this.pendingById.get(requestId);
    if (!pending) {
      throw new Error(`No queued request found for id ${requestId}`);
    }

    pending.request = mergeRequestEdits(pending.request, editedRequest);
    this.emit('edited', clone(pending.request));
    this.emit('queue', this.getQueue());
    return { ok: true, request: clone(pending.request) };
  }

  async forward(requestId, editedRequest = null) {
    const pending = this.pendingById.get(requestId);
    if (!pending) {
      throw new Error(`No queued request found for id ${requestId}`);
    }

    const queued = editedRequest ? mergeRequestEdits(pending.request, editedRequest) : pending.request;
    const finalRequest = this.applyRules(queued);

    try {
      const response = await pending.forwarder(finalRequest);
      this.removeFromQueue(requestId);
      pending.resolve({ action: 'forwarded', request: finalRequest, response });
      this.emit('forwarded', { request: clone(finalRequest), response: clone(response) });
      return { ok: true, request: clone(finalRequest), response: clone(response) };
    } catch (error) {
      pending.request = clone(finalRequest);
      this.emit('forward-error', {
        requestId,
        request: clone(finalRequest),
        error: error?.message || 'Forward failed',
      });
      this.emit('queue', this.getQueue());
      throw error;
    }
  }

  drop(requestId) {
    const pending = this.pendingById.get(requestId);
    if (!pending) {
      throw new Error(`No queued request found for id ${requestId}`);
    }

    this.removeFromQueue(requestId);
    pending.resolve({ action: 'dropped', request: clone(pending.request), response: null });
    this.emit('dropped', clone(pending.request));
    return { ok: true };
  }

  async resumeQueued() {
    const ids = [...this.queueOrder];
    const summary = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      failures: [],
    };

    for (const requestId of ids) {
      if (!this.pendingById.has(requestId)) {
        continue;
      }

      summary.attempted += 1;
      try {
        await this.forward(requestId);
        summary.succeeded += 1;
      } catch {
        summary.failed += 1;
        summary.failures.push(requestId);
        // Keep remaining queued requests eligible for resume attempts.
      }
    }

    return summary;
  }

  applyRules(request) {
    if (!this.rulesEngine || typeof this.rulesEngine.applyToRequest !== 'function') {
      return clone(request);
    }
    return this.rulesEngine.applyToRequest(request);
  }

  removeFromQueue(requestId) {
    this.pendingById.delete(requestId);
    this.queueOrder = this.queueOrder.filter(id => id !== requestId);
    this.emit('queue', this.getQueue());
  }
}

function createInterceptEngine(options = {}) {
  return new InterceptEngine(options);
}

const defaultInterceptEngine = createInterceptEngine();

module.exports = defaultInterceptEngine;
module.exports.InterceptEngine = InterceptEngine;
module.exports.createInterceptEngine = createInterceptEngine;
