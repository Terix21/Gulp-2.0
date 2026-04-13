'use strict';

const fs = require('node:fs/promises');

function getNonCallableAdapterError(name, value) {
	if (typeof value === 'function') {
		return null;
	}

	return `TypeError: ${name} must be a function`;
}

function createCleanupFromPath(stagedPackagePath) {
	return async () => {
		if (stagedPackagePath) {
			await fs.rm(stagedPackagePath, { recursive: true, force: true });
		}
	};
}

function resolveStagedPackage(stagedPackage) {
	if (typeof stagedPackage === 'string') {
		return {
			stagedPackagePath: stagedPackage,
			cleanupStagedPackage: createCleanupFromPath(stagedPackage),
		};
	}

	const stagedPackagePath = typeof stagedPackage?.stagedPath === 'string' ? stagedPackage.stagedPath : '';
	const cleanupStagedPackage = typeof stagedPackage?.cleanup === 'function'
		? stagedPackage.cleanup
		: createCleanupFromPath(stagedPackagePath);

	return {
		stagedPackagePath,
		cleanupStagedPackage,
	};
}

async function installExtensionFromIpc({ args = {}, stageExtensionPackage, getApprovedPermissions, extensionHost }) {
	const adapterError =
		getNonCallableAdapterError('stageExtensionPackage', stageExtensionPackage) ||
		getNonCallableAdapterError('getApprovedPermissions', getApprovedPermissions) ||
		getNonCallableAdapterError('extensionHost.install', extensionHost?.install);

	if (adapterError) {
		return { ok: false, error: adapterError };
	}

	if (typeof args.script === 'string') {
		return { ok: false, error: 'Script installs are disabled via renderer IPC.' };
	}

	let stagedPackagePath;
	let cleanupStagedPackage = null;

	try {
		const stagedPackage = await stageExtensionPackage(args.packagePath);
		const stageResolution = resolveStagedPackage(stagedPackage);
		stagedPackagePath = stageResolution.stagedPackagePath;
		cleanupStagedPackage = stageResolution.cleanupStagedPackage;

		if (!stagedPackagePath) {
			throw new TypeError('stageExtensionPackage must return a staged package path.');
		}

		const approvedPermissions = getApprovedPermissions();
		const installResult = await extensionHost.install({
			packagePath: stagedPackagePath,
			approvedPermissions,
		});

		return installResult;
	} catch (error) {
		return {
			ok: false,
			error: error?.message || 'Extension install failed',
		};
	} finally {
		if (cleanupStagedPackage) {
			try {
				await cleanupStagedPackage();
			} catch {
				// Best-effort cleanup: do not mask install outcome with cleanup failure.
			}
		}
	}
}

module.exports = {
	installExtensionFromIpc,
};
