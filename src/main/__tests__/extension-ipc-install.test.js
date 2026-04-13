import { describe, expect, it, vi } from 'vitest';

const { installExtensionFromIpc } = require('../extension-ipc-install');

describe('extension IPC install policy', () => {
  it('rejects script payloads and never calls install adapters', async () => {
    const stageExtensionPackage = vi.fn();
    const getApprovedPermissions = vi.fn(() => ['audit.write']);
    const extensionHost = {
      install: vi.fn(() => ({ ok: true })),
    };

    const result = await installExtensionFromIpc({
      args: {
        name: 'Blocked Script',
        script: 'api.audit("blocked", {});',
        triggers: ['proxy.intercept'],
      },
      stageExtensionPackage,
      getApprovedPermissions,
      extensionHost,
    });

    expect(result).toEqual({
      ok: false,
      error: 'Script installs are disabled via renderer IPC.',
    });
    expect(stageExtensionPackage).not.toHaveBeenCalled();
    expect(getApprovedPermissions).not.toHaveBeenCalled();
    expect(extensionHost.install).not.toHaveBeenCalled();
  });

  it('stages package install and applies server-approved permissions', async () => {
    const stageExtensionPackage = vi.fn(async () => '/safe/staged/pkg');
    const getApprovedPermissions = vi.fn(() => ['proxy.intercept.read', 'audit.write']);
    const extensionHost = {
      install: vi.fn(() => ({ ok: true, id: 'demo.safe' })),
    };

    const result = await installExtensionFromIpc({
      args: { packagePath: '/incoming/pkg' },
      stageExtensionPackage,
      getApprovedPermissions,
      extensionHost,
    });

    expect(stageExtensionPackage).toHaveBeenCalledWith('/incoming/pkg');
    expect(getApprovedPermissions).toHaveBeenCalledTimes(1);
    expect(extensionHost.install).toHaveBeenCalledWith({
      packagePath: '/safe/staged/pkg',
      approvedPermissions: ['proxy.intercept.read', 'audit.write'],
    });
    expect(result).toEqual({ ok: true, id: 'demo.safe' });
  });
});
