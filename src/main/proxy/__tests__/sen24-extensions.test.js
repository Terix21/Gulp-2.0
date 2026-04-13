import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const extensionHostModule = require('../extension-host');
const { createExtensionHost } = extensionHostModule;

function writeExtensionPackage(baseDir, manifest, code) {
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(path.join(baseDir, 'extension.json'), JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(baseDir, manifest.main || 'index.js'), code, 'utf8');
}

describe('SEN-024 extension host', () => {
  let tempRoot;
  let host;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ext-host-'));
    host = createExtensionHost({
      extensionsDir: path.join(tempRoot, 'installed'),
      executionTimeoutMs: 25,
    });
    host.configure({});
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('installs from package path and lists installed extension', () => {
    const packageDir = path.join(tempRoot, 'demo-ext');
    writeExtensionPackage(
      packageDir,
      {
        id: 'demo.audit',
        name: 'Demo Audit',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['proxy.intercept.read', 'audit.write'],
      },
      `
      module.exports.activate = function(api) {
        api.on('proxy.intercept', function(payload) {
          api.audit('proxy.intercept', { requestId: payload && payload.requestId ? payload.requestId : '' });
        });
      };
      `
    );

    const installed = host.install({
      packagePath: packageDir,
      approvedPermissions: ['proxy.intercept.read', 'audit.write'],
    });

    expect(installed.ok).toBe(true);

    const listed = host.list();
    expect(Array.isArray(listed.extensions)).toBe(true);
    expect(listed.extensions.length).toBe(1);
    expect(listed.extensions[0].id).toBe('demo.audit');

    host.emitEvent('proxy.intercept', { requestId: 'req-1', request: { id: 'req-1' } });
    const updated = host.list();
    expect(updated.auditLog.some(entry => entry.action === 'proxy.intercept')).toBe(true);
  });

  it('rejects install when required permissions are not approved', () => {
    const packageDir = path.join(tempRoot, 'needs-permission');
    writeExtensionPackage(
      packageDir,
      {
        id: 'demo.denied',
        name: 'Denied Extension',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['scanner.finding.read'],
      },
      'module.exports.activate = function() {};' 
    );

    const installed = host.install({
      packagePath: packageDir,
      approvedPermissions: [],
    });

    expect(installed.ok).toBe(false);
    expect(String(installed.error || '')).toContain('Permission not approved');
  });

  it('enforces execution timeout and records watchdog errors', () => {
    const packageDir = path.join(tempRoot, 'timeout-ext');
    writeExtensionPackage(
      packageDir,
      {
        id: 'demo.timeout',
        name: 'Timeout Extension',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['proxy.intercept.read'],
      },
      `
      module.exports.activate = function(api) {
        api.on('proxy.intercept', function() {
          while (true) {
            // Intentional loop to trigger timeout watchdog.
          }
        });
      };
      `
    );

    const installed = host.install({
      packagePath: packageDir,
      approvedPermissions: ['proxy.intercept.read'],
    });
    expect(installed.ok).toBe(true);

    host.emitEvent('proxy.intercept', { requestId: 'req-timeout' });

    const listed = host.list();
    expect(listed.auditLog.some(entry => entry.extensionId === 'demo.timeout' && entry.status === 'error')).toBe(true);
  });

  it('supports script automation runtime with trigger subscriptions', () => {
    const installed = host.install({
      name: 'Header Script',
      script: 'api.audit("script.exec", { hasRequest: !!(payload && payload.request) });',
      triggers: ['proxy.intercept'],
      permissions: ['proxy.intercept.read', 'audit.write'],
      approvedPermissions: ['proxy.intercept.read', 'audit.write'],
    });

    expect(installed.ok).toBe(true);

    host.emitEvent('proxy.intercept', { request: { method: 'GET' } });
    const listed = host.list();
    expect(listed.auditLog.some(entry => entry.action === 'script.exec')).toBe(true);
  });

  it('rejects package install outside trusted roots when configured', () => {
    host.configure({ trustedPackageRoots: [path.join(tempRoot, 'trusted')] });

    const packageDir = path.join(tempRoot, 'outside-root-ext');
    writeExtensionPackage(
      packageDir,
      {
        id: 'demo.untrusted',
        name: 'Untrusted Extension',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['audit.write'],
      },
      'module.exports.activate = function() {};' 
    );

    const installed = host.install({
      packagePath: packageDir,
      approvedPermissions: ['audit.write'],
    });

    expect(installed.ok).toBe(false);
    expect(String(installed.error || '')).toContain('trusted package roots');
  });

  it('rejects package install when symlink inside trusted root points outside', () => {
    const trustedDir = path.join(tempRoot, 'trusted');
    const outsideDir = path.join(tempRoot, 'outside-symlink-target');
    writeExtensionPackage(
      outsideDir,
      {
        id: 'demo.symlink.bypass',
        name: 'Symlink Bypass Extension',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['audit.write'],
      },
      'module.exports.activate = function() {};'
    );
    fs.mkdirSync(trustedDir, { recursive: true });
    // Symlink inside trusted root → points to outside directory
    const symlinkPath = path.join(trustedDir, 'evil-link');
    fs.symlinkSync(outsideDir, symlinkPath);
    host.configure({ trustedPackageRoots: [trustedDir] });

    const installed = host.install({
      packagePath: symlinkPath,
      approvedPermissions: ['audit.write'],
    });

    expect(installed.ok).toBe(false);
    expect(String(installed.error || '')).toContain('trusted package roots');
  });

  it('drops extension events when per-window rate limit is exceeded', () => {
    host.configure({ eventWindowMs: 1000, eventBudgetPerWindow: 1 });

    const installed = host.install({
      name: 'Rate Limited Script',
      script: 'api.audit("rate.limit.hit", { id: payload && payload.id ? payload.id : "" });',
      triggers: ['proxy.intercept'],
      permissions: ['proxy.intercept.read', 'audit.write'],
      approvedPermissions: ['proxy.intercept.read', 'audit.write'],
    });
    expect(installed.ok).toBe(true);

    host.emitEvent('proxy.intercept', { id: 'first' });
    host.emitEvent('proxy.intercept', { id: 'second' });

    const listed = host.list();
    const processed = listed.auditLog.filter(entry => entry.action === 'rate.limit.hit').length;
    expect(processed).toBe(1);
    expect(
      listed.auditLog.some(entry => entry.message === 'Event dropped due to extension rate limit.')
    ).toBe(true);
  });

  it('uninstall removes extension and dangling subscriptions', () => {
    const packageDir = path.join(tempRoot, 'remove-ext');
    writeExtensionPackage(
      packageDir,
      {
        id: 'demo.remove',
        name: 'Remove Extension',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['proxy.intercept.read', 'audit.write'],
      },
      `
      module.exports.activate = function(api) {
        api.on('proxy.intercept', function() {
          api.audit('run.before.remove', {});
        });
      };
      `
    );

    const installed = host.install({
      packagePath: packageDir,
      approvedPermissions: ['proxy.intercept.read', 'audit.write'],
    });
    expect(installed.ok).toBe(true);

    host.emitEvent('proxy.intercept', { requestId: 'before' });
    const beforeCount = host.list().auditLog.filter(entry => entry.action === 'run.before.remove').length;
    expect(beforeCount).toBeGreaterThan(0);

    const removed = host.uninstall({ id: 'demo.remove' });
    expect(removed.ok).toBe(true);

    host.emitEvent('proxy.intercept', { requestId: 'after' });
    const afterCount = host.list().auditLog.filter(entry => entry.action === 'run.before.remove').length;
    expect(afterCount).toBe(beforeCount);
  });
});
