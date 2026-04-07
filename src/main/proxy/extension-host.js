/*
SEN-024/SEN-025 Extension host runtime
- Loads extensions from a designated directory with explicit permission approval.
- Executes extension code in a VM sandbox with timeout watchdog.
- Supports event subscriptions for proxy intercept, scanner finding, and scope transition.
- Maintains structured audit logs for extension and automation activity.
*/

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');

const MAX_AUDIT_ITEMS = 500;
const DEFAULT_TIMEOUT_MS = 150;
const DEFAULT_ALLOWED_PERMISSIONS = [
	'proxy.intercept.read',
	'scanner.finding.read',
	'scope.transition.read',
	'emit.finding',
	'audit.write',
];
const DEFAULT_ALLOWED_EVENTS = [
	'proxy.intercept',
	'scanner.finding',
	'scope.transition',
];

function toText(value) {
	if (typeof value === 'string') {
		return value;
	}
	if (value == null) {
		return '';
	}
	return String(value);
}

const EXTENSION_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

function validateExtensionId(id, label) {
	if (!EXTENSION_ID_PATTERN.test(id)) {
		throw new Error(`${label} contains invalid characters. Use only alphanumeric characters, dots, hyphens, and underscores, starting and ending with an alphanumeric character.`);
	}
}

function asArray(value) {
	return Array.isArray(value) ? value : [];
}

function clone(value) {
	return JSON.parse(JSON.stringify(value));
}

function ensureDir(targetPath) {
	fs.mkdirSync(targetPath, { recursive: true });
}

function normalizePermissions(permissions) {
	return [...new Set(asArray(permissions).map(item => toText(item).trim()).filter(Boolean))].sort();
}

function sanitizeManifest(manifest = {}, fallbackId = '') {
	const id = toText(manifest.id || fallbackId || '').trim();
	const name = toText(manifest.name || id || 'Unnamed Extension').trim();
	const version = toText(manifest.version || '0.0.0').trim();
	const main = toText(manifest.main || 'index.js').trim();
	const permissions = normalizePermissions(manifest.permissions);
	return {
		id,
		name,
		version,
		main,
		permissions,
	};
}

function hasPermission(permissionSet, permissionName) {
	return permissionSet.has(permissionName);
}

class ExtensionHost extends EventEmitter {
	constructor(options = {}) {
		super();
		this.extensionsDir = path.resolve(options.extensionsDir || path.join(process.cwd(), 'extensions'));
		this.executionTimeoutMs = Number(options.executionTimeoutMs || DEFAULT_TIMEOUT_MS);
		this.allowedPermissions = new Set(options.allowedPermissions || DEFAULT_ALLOWED_PERMISSIONS);
		this.allowedEvents = new Set(options.allowedEvents || DEFAULT_ALLOWED_EVENTS);
		this.extensions = new Map();
		this.auditLog = [];
	}

	configure(options = {}) {
		if (typeof options.extensionsDir === 'string' && options.extensionsDir.trim()) {
			this.extensionsDir = path.resolve(options.extensionsDir);
		}
		if (Number.isFinite(options.executionTimeoutMs) && Number(options.executionTimeoutMs) > 0) {
			this.executionTimeoutMs = Number(options.executionTimeoutMs);
		}
		if (Array.isArray(options.allowedPermissions)) {
			this.allowedPermissions = new Set(options.allowedPermissions.map(item => toText(item).trim()).filter(Boolean));
		}
		if (Array.isArray(options.allowedEvents)) {
			this.allowedEvents = new Set(options.allowedEvents.map(item => toText(item).trim()).filter(Boolean));
		}

		ensureDir(this.extensionsDir);
		return { ok: true, extensionsDir: this.extensionsDir };
	}

	addAudit(entry = {}) {
		const next = {
			id: randomUUID(),
			at: Date.now(),
			extensionId: toText(entry.extensionId || 'system'),
			type: toText(entry.type || 'info') || 'info',
			action: toText(entry.action || 'event') || 'event',
			status: toText(entry.status || 'ok') || 'ok',
			message: toText(entry.message || ''),
			data: entry.data ? clone(entry.data) : null,
		};
		this.auditLog.unshift(next);
		if (this.auditLog.length > MAX_AUDIT_ITEMS) {
			this.auditLog.length = MAX_AUDIT_ITEMS;
		}
		return next;
	}

	list() {
		return {
			extensionsDir: this.extensionsDir,
			extensions: Array.from(this.extensions.values()).map(ext => ({
				id: ext.id,
				name: ext.name,
				version: ext.version,
				enabled: ext.enabled,
				sourceType: ext.sourceType,
				permissions: ext.permissions,
				approvedPermissions: ext.approvedPermissions,
				subscriptions: Array.from(new Set(ext.subscriptions.values())).sort(),
				installPath: ext.installPath,
			})),
			auditLog: this.auditLog.slice(0, 200),
		};
	}

	validatePermissions(requiredPermissions, approvedPermissions) {
		const required = normalizePermissions(requiredPermissions);
		const approved = new Set(normalizePermissions(approvedPermissions));

		for (const permission of required) {
			if (!this.allowedPermissions.has(permission)) {
				return { ok: false, error: `Unsupported permission requested: ${permission}` };
			}
			if (!approved.has(permission)) {
				return { ok: false, error: `Permission not approved: ${permission}` };
			}
		}

		return { ok: true };
	}

	readPackagedExtension(packagePath) {
		const sourcePath = path.resolve(toText(packagePath).trim());
		const stat = fs.statSync(sourcePath);
		const sourceDir = stat.isDirectory() ? sourcePath : path.dirname(sourcePath);

		const manifestPath = path.join(sourceDir, 'extension.json');
		if (!fs.existsSync(manifestPath)) {
			throw new Error('Missing extension.json manifest in package directory.');
		}

		const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
		const manifest = sanitizeManifest(JSON.parse(manifestRaw), path.basename(sourceDir));
		if (!manifest.id) {
			throw new Error('Extension manifest is missing a valid id.');
		}

		const extensionId = toText(manifest.id).trim();
		validateExtensionId(extensionId, 'Extension manifest id');

		const extensionsRoot = path.resolve(this.extensionsDir);
		const installPath = path.resolve(extensionsRoot, extensionId);
		const installRelativePath = path.relative(extensionsRoot, installPath);
		if (
			installRelativePath.startsWith('..') ||
			path.isAbsolute(installRelativePath)
		) {
			throw new Error('Extension manifest id resolves outside the extensions directory.');
		}

		fs.rmSync(installPath, { recursive: true, force: true });
		ensureDir(installPath);
		fs.cpSync(sourceDir, installPath, { recursive: true });

		const mainPath = path.join(installPath, manifest.main);
		if (!fs.existsSync(mainPath)) {
			throw new Error(`Extension main file not found: ${manifest.main}`);
		}

		const code = fs.readFileSync(mainPath, 'utf8');
		return {
			sourceType: 'package',
			id: manifest.id,
			name: manifest.name,
			version: manifest.version,
			permissions: manifest.permissions,
			installPath,
			code,
		};
	}

	buildScriptExtension(args = {}) {
		const name = toText(args.name || 'Custom Script').trim() || 'Custom Script';
		const defaultId = `script.${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${Date.now()}`;
		const id = toText(args.id || defaultId).trim();
		validateExtensionId(id, 'Script extension id');
		const version = toText(args.version || '1.0.0');
		const permissions = normalizePermissions(args.permissions);
		const triggers = asArray(args.triggers).map(item => toText(item).trim()).filter(Boolean);
		const script = toText(args.script || '').trim();
		if (!script) {
			throw new Error('Script source is required for script install.');
		}

		for (const trigger of triggers) {
			if (!this.allowedEvents.has(trigger)) {
				throw new Error(`Unsupported trigger: ${trigger}`);
			}
		}

		const wrappedCode = [
			'module.exports.activate = function(api) {',
			`  const triggers = ${JSON.stringify(triggers)};`,
			'  const run = function(payload) {',
			script,
			'  };',
			'  triggers.forEach(function(triggerName) { api.on(triggerName, run); });',
			'};',
		].join('\n');

		const installPath = path.join(this.extensionsDir, id);
		ensureDir(installPath);
		fs.writeFileSync(path.join(installPath, 'script.js'), script, 'utf8');

		return {
			sourceType: 'script',
			id,
			name,
			version,
			permissions,
			installPath,
			code: wrappedCode,
		};
	}

	createRuntime(extensionMeta, approvedPermissions) {
		const permissions = new Set(normalizePermissions(approvedPermissions));
		const sandbox = {
			// Shadow host-process globals so they are inaccessible by name inside the extension context.
			// vm.createContext does not provide process isolation — see extension-host security notes.
			process: undefined,
			require: undefined,
			global: undefined,
			globalThis: undefined,
			__dirname: undefined,
			__filename: undefined,
			Buffer: undefined,
			setImmediate: undefined,
			clearImmediate: undefined,
			setInterval: undefined,
			clearInterval: undefined,
			setTimeout: undefined,
			clearTimeout: undefined,
			module: { exports: {} },
			exports: {},
			__handlers: {},
			__payload: null,
			console: {
				log: (...args) => {
					this.addAudit({
						extensionId: extensionMeta.id,
						type: 'log',
						action: 'console.log',
						status: 'ok',
						message: args.map(arg => toText(arg)).join(' '),
					});
				},
			},
		};
		sandbox.exports = sandbox.module.exports;

		const context = vm.createContext(sandbox, {
			codeGeneration: {
				strings: false,
				wasm: false,
			},
		});

		// Run a safety preamble before any extension code. This freezes Object.prototype
		// within the vm context (isolated from the host) to block prototype-chain escape:
		// ({}).constructor.constructor('return process')() — codeGeneration.strings:false
		// already blocks new Function(string), but freezing closes the Object.prototype
		// route early and prevents dynamic property injection on built-in prototypes.
		const safetyPreamble = new vm.Script(`(function() {
			'use strict';
			Object.freeze(Object.prototype);
			Object.freeze(Function.prototype);
		}());`, { filename: '<extension-safety-preamble>' });
		safetyPreamble.runInContext(context, { timeout: this.executionTimeoutMs });
		const subscriptions = new Map();
		let handlerSeq = 0;

		const api = {
			on: (eventName, handler) => {
				const normalizedEvent = toText(eventName).trim();
				if (!this.allowedEvents.has(normalizedEvent)) {
					throw new Error(`Unsupported event subscription: ${normalizedEvent}`);
				}
				if (typeof handler !== 'function') {
					throw new Error('Subscription handler must be a function.');
				}

				const permissionByEvent = {
					'proxy.intercept': 'proxy.intercept.read',
					'scanner.finding': 'scanner.finding.read',
					'scope.transition': 'scope.transition.read',
				};
				const requiredPermission = permissionByEvent[normalizedEvent];
				if (requiredPermission && !hasPermission(permissions, requiredPermission)) {
					throw new Error(`Missing permission for event subscription: ${requiredPermission}`);
				}

				const handlerId = String(++handlerSeq);
				sandbox.__handlers[handlerId] = handler;
				subscriptions.set(handlerId, normalizedEvent);
				this.addAudit({
					extensionId: extensionMeta.id,
					type: 'subscription',
					action: 'subscribe',
					status: 'ok',
					message: `Subscribed to ${normalizedEvent}`,
				});
				return { ok: true, handlerId };
			},
			audit: (action, data) => {
				if (!hasPermission(permissions, 'audit.write')) {
					return { ok: false };
				}
				this.addAudit({
					extensionId: extensionMeta.id,
					type: 'extension',
					action: toText(action || 'audit'),
					status: 'ok',
					data: data || null,
				});
				return { ok: true };
			},
			emitFinding: (finding) => {
				if (!hasPermission(permissions, 'emit.finding')) {
					return { ok: false };
				}
				const payload = finding && typeof finding === 'object' ? clone(finding) : { message: toText(finding) };
				this.addAudit({
					extensionId: extensionMeta.id,
					type: 'extension',
					action: 'emit.finding',
					status: 'ok',
					data: payload,
				});
				this.emit('finding', {
					extensionId: extensionMeta.id,
					finding: payload,
				});
				return { ok: true };
			},
		};

		sandbox.api = api;

		const installScript = new vm.Script(extensionMeta.code, {
			filename: `${extensionMeta.id}.js`,
		});
		installScript.runInContext(context, { timeout: this.executionTimeoutMs });

		const exportsObj = sandbox.module.exports || {};
		if (typeof exportsObj.activate === 'function') {
			sandbox.__activateResult = null;
			sandbox.__activationError = null;
			sandbox.__activate = exportsObj.activate;
			const activateScript = new vm.Script(`
				try {
					__activateResult = __activate(api) || null;
				} catch (err) {
					__activationError = err && err.message ? err.message : String(err);
				}
			`);
			activateScript.runInContext(context, { timeout: this.executionTimeoutMs });
			if (sandbox.__activationError) {
				throw new Error(sandbox.__activationError);
			}
		}

		return {
			context,
			sandbox,
			subscriptions,
			deactivate: typeof exportsObj.deactivate === 'function' ? exportsObj.deactivate : null,
		};
	}

	install(args = {}) {
		try {
			ensureDir(this.extensionsDir);
			const approvedPermissions = normalizePermissions(args.approvedPermissions);
			const extensionMeta = typeof args.script === 'string'
				? this.buildScriptExtension(args)
				: this.readPackagedExtension(args.packagePath);

			const validation = this.validatePermissions(extensionMeta.permissions, approvedPermissions);
			if (!validation.ok) {
				return { ok: false, id: extensionMeta.id, error: validation.error };
			}

			if (this.extensions.has(extensionMeta.id)) {
				this.uninstall({ id: extensionMeta.id });
			}

			const runtime = this.createRuntime(extensionMeta, approvedPermissions);
			this.extensions.set(extensionMeta.id, {
				id: extensionMeta.id,
				name: extensionMeta.name,
				version: extensionMeta.version,
				sourceType: extensionMeta.sourceType,
				installPath: extensionMeta.installPath,
				permissions: extensionMeta.permissions,
				approvedPermissions,
				enabled: true,
				runtime,
				subscriptions: runtime.subscriptions,
			});

			this.addAudit({
				extensionId: extensionMeta.id,
				type: 'lifecycle',
				action: 'install',
				status: 'ok',
				message: `${extensionMeta.name} installed`,
			});

			return { ok: true, id: extensionMeta.id };
		} catch (error) {
			this.addAudit({
				extensionId: toText(args.id || 'unknown'),
				type: 'lifecycle',
				action: 'install',
				status: 'error',
				message: error && error.message ? error.message : 'Install failed',
			});
			return { ok: false, id: toText(args.id || ''), error: error && error.message ? error.message : 'Install failed' };
		}
	}

	uninstall(args = {}) {
		const id = toText(args.id).trim();
		if (!id || !this.extensions.has(id)) {
			return { ok: false };
		}
		const extension = this.extensions.get(id);
		this.extensions.delete(id);

		try {
			if (extension && extension.runtime && typeof extension.runtime.deactivate === 'function') {
				extension.runtime.sandbox.__deactivate = extension.runtime.deactivate;
				const deactivateScript = new vm.Script('__deactivate();');
				deactivateScript.runInContext(extension.runtime.context, { timeout: this.executionTimeoutMs });
			}
		} catch {
			// Ignore deactivate errors during uninstall and continue cleanup.
		}

		if (extension && extension.installPath && extension.installPath.startsWith(this.extensionsDir)) {
			fs.rmSync(extension.installPath, { recursive: true, force: true });
		}

		this.addAudit({
			extensionId: id,
			type: 'lifecycle',
			action: 'uninstall',
			status: 'ok',
			message: 'Extension removed',
		});

		return { ok: true };
	}

	toggle(args = {}) {
		const id = toText(args.id).trim();
		const enabled = Boolean(args.enabled);
		const extension = this.extensions.get(id);
		if (!extension) {
			return { ok: false };
		}
		extension.enabled = enabled;
		this.addAudit({
			extensionId: id,
			type: 'lifecycle',
			action: 'toggle',
			status: 'ok',
			message: enabled ? 'Enabled' : 'Disabled',
		});
		return { ok: true };
	}

	emitEvent(eventName, payload = {}) {
		const normalizedEvent = toText(eventName).trim();
		if (!this.allowedEvents.has(normalizedEvent)) {
			return { ok: false, delivered: 0 };
		}

		let delivered = 0;
		const safePayload = payload && typeof payload === 'object' ? clone(payload) : { value: payload };

		for (const extension of this.extensions.values()) {
			if (!extension.enabled) {
				continue;
			}

			for (const [handlerId, subscribedEvent] of extension.subscriptions.entries()) {
				if (subscribedEvent !== normalizedEvent) {
					continue;
				}

				try {
					extension.runtime.sandbox.__payload = safePayload;
					const dispatchScript = new vm.Script(`
						if (typeof __handlers[${JSON.stringify(handlerId)}] === 'function') {
							__handlers[${JSON.stringify(handlerId)}](__payload);
						}
					`);
					dispatchScript.runInContext(extension.runtime.context, { timeout: this.executionTimeoutMs });
					delivered += 1;
					this.addAudit({
						extensionId: extension.id,
						type: 'event',
						action: normalizedEvent,
						status: 'ok',
						message: 'Event processed',
					});
				} catch (error) {
					this.addAudit({
						extensionId: extension.id,
						type: 'event',
						action: normalizedEvent,
						status: 'error',
						message: error && error.message ? error.message : 'Event execution failed',
					});
				}
			}
		}

		return { ok: true, delivered };
	}
}

function createExtensionHost(options) {
	return new ExtensionHost(options);
}

const defaultExtensionHost = createExtensionHost();

module.exports = defaultExtensionHost;
module.exports.ExtensionHost = ExtensionHost;
module.exports.createExtensionHost = createExtensionHost;
