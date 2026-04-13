import { afterEach, describe, expect, it, vi } from 'vitest';

const fs = require('node:fs/promises');

const { installExtensionFromIpc } = require('../extension-ipc-install');

describe('extension IPC install policy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a TypeError-style message when stage adapter is non-callable', async () => {
    const getApprovedPermissions = vi.fn(() => ['audit.write']);
    const extensionHost = {
      install: vi.fn(() => ({ ok: true })),
    };

    const result = await installExtensionFromIpc({
      args: { packagePath: '/incoming/pkg' },
      stageExtensionPackage: null,
      getApprovedPermissions,
      extensionHost,
    });

    expect(result).toEqual({
      ok: false,
      error: 'TypeError: stageExtensionPackage must be a function',
    });
    expect(getApprovedPermissions).not.toHaveBeenCalled();
    expect(extensionHost.install).not.toHaveBeenCalled();
  });

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
    const rmSpy = vi.spyOn(fs, 'rm').mockResolvedValue(undefined);

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
    expect(rmSpy).toHaveBeenCalledWith('/safe/staged/pkg', {
      recursive: true,
      force: true,
    });
    expect(result).toEqual({ ok: true, id: 'demo.safe' });
  });

  it('still returns install result when staged-package cleanup fails', async () => {
    const stageExtensionPackage = vi.fn(async () => '/safe/staged/pkg');
    const getApprovedPermissions = vi.fn(() => ['proxy.intercept.read']);
    const extensionHost = {
      install: vi.fn(() => ({ ok: true, id: 'demo.safe' })),
    };
    vi.spyOn(fs, 'rm').mockRejectedValue(new Error('cleanup failed'));

    const result = await installExtensionFromIpc({
      args: { packagePath: '/incoming/pkg' },
      stageExtensionPackage,
      getApprovedPermissions,
      extensionHost,
    });

    expect(result).toEqual({ ok: true, id: 'demo.safe' });
  });

  it('supports staging adapters that return stagedPath and cleanup handler', async () => {
    const cleanup = vi.fn(async () => undefined);
    const stageExtensionPackage = vi.fn(async () => ({
      stagedPath: '/safe/staged/pkg',
      cleanup,
    }));
    const getApprovedPermissions = vi.fn(() => ['proxy.intercept.read']);
    const extensionHost = {
      install: vi.fn(() => ({ ok: true, id: 'demo.safe' })),
    };
    const rmSpy = vi.spyOn(fs, 'rm').mockResolvedValue(undefined);

    const result = await installExtensionFromIpc({
      args: { packagePath: '/incoming/pkg' },
      stageExtensionPackage,
      getApprovedPermissions,
      extensionHost,
    });

    expect(extensionHost.install).toHaveBeenCalledWith({
      packagePath: '/safe/staged/pkg',
      approvedPermissions: ['proxy.intercept.read'],
    });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(rmSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, id: 'demo.safe' });
  });

  it('returns a TypeError-style message when staged package path is missing', async () => {
    const stageExtensionPackage = vi.fn(async () => ({ cleanup: vi.fn(async () => undefined) }));
    const getApprovedPermissions = vi.fn(() => ['proxy.intercept.read']);
    const extensionHost = {
      install: vi.fn(() => ({ ok: true, id: 'demo.safe' })),
    };

    const result = await installExtensionFromIpc({
      args: { packagePath: '/incoming/pkg' },
      stageExtensionPackage,
      getApprovedPermissions,
      extensionHost,
    });

    expect(result).toEqual({
      ok: false,
      error: 'stageExtensionPackage must return a staged package path.',
    });
    expect(getApprovedPermissions).not.toHaveBeenCalled();
    expect(extensionHost.install).not.toHaveBeenCalled();
  });
});
