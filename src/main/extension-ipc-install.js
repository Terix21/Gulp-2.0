'use strict';

async function installExtensionFromIpc({ args = {}, stageExtensionPackage, getApprovedPermissions, extensionHost }) {
	if (typeof args.script === 'string') {
		return { ok: false, error: 'Script installs are disabled via renderer IPC.' };
	}

	try {
		const stagedPackagePath = await stageExtensionPackage(args.packagePath);
		const approvedPermissions = getApprovedPermissions();
		return extensionHost.install({
			packagePath: stagedPackagePath,
			approvedPermissions,
		});
	} catch (error) {
		return {
			ok: false,
			error: error?.message || 'Extension install failed',
		};
	}
}

module.exports = {
	installExtensionFromIpc,
};
