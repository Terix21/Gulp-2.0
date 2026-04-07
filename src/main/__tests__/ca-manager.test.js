import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { createCaManager } = require('../certs/ca-manager');

describe('ca-manager (SEN-013)', () => {
  let tempDir;
  let manager;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-ca-manager-'));
    manager = createCaManager({ baseDir: tempDir });
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('generates and persists CA artifacts on first use', () => {
    const first = manager.ensureCaArtifacts();
    const certPath = path.join(tempDir, 'ca-cert.pem');
    const keyPath = path.join(tempDir, 'ca-key.pem');

    expect(first.generated).toBe(true);
    expect(fs.existsSync(certPath)).toBe(true);
    expect(fs.existsSync(keyPath)).toBe(true);

    const certFromApi = manager.getCaCertificatePem();
    const certFromDisk = fs.readFileSync(certPath, 'utf8');
    expect(certFromApi).toBe(certFromDisk);

    const managerReloaded = createCaManager({ baseDir: tempDir });
    const second = managerReloaded.ensureCaArtifacts();
    expect(second.generated).toBe(false);
    expect(second.fingerprint).toBe(first.fingerprint);
  });

  it('exports CA certificate for trust-store installation', () => {
    manager.ensureCaArtifacts();

    const exportPath = path.join(tempDir, 'exports', 'sentinel-ca.pem');
    const result = manager.exportCaCertificate(exportPath);

    expect(result.ok).toBe(true);
    expect(result.path).toBe(exportPath);
    expect(fs.existsSync(exportPath)).toBe(true);
    expect(fs.readFileSync(exportPath, 'utf8')).toContain('BEGIN CERTIFICATE');
  });

  it('rejects relative paths in exportCaCertificate', () => {
    manager.ensureCaArtifacts();

    expect(() => {
      manager.exportCaCertificate('relative/path/cert.pem');
    }).toThrow('must be an absolute path');
  });

  it('rejects path traversal in exportCaCertificate', () => {
    manager.ensureCaArtifacts();

    const traversalPath = `${tempDir}/subdir/../../escaped.pem`;
    expect(() => {
      manager.exportCaCertificate(traversalPath);
    }).toThrow('must not contain path traversal');
  });

  it('generates per-host leaf certs on demand and caches them', () => {
    manager.ensureCaArtifacts();

    const firstLeaf = manager.getLeafCertificate('api.example.com');
    const secondLeaf = manager.getLeafCertificate('api.example.com');

    expect(firstLeaf.fromCache).toBe(false);
    expect(secondLeaf.fromCache).toBe(true);
    expect(firstLeaf.certPem).toBe(secondLeaf.certPem);
    expect(firstLeaf.keyPem).toBe(secondLeaf.keyPem);

    const certCachePath = path.join(tempDir, 'leaf-cache', 'api.example.com.cert.pem');
    const keyCachePath = path.join(tempDir, 'leaf-cache', 'api.example.com.key.pem');
    expect(fs.existsSync(certCachePath)).toBe(true);
    expect(fs.existsSync(keyCachePath)).toBe(true);
  });

  it('rotates CA and invalidates cached leaf certificates', () => {
    manager.ensureCaArtifacts();

    const oldCaSummary = manager.getSummary();
    const oldLeaf = manager.getLeafCertificate('portal.example.com');

    const rotation = manager.rotateCa();
    const newCaSummary = manager.getSummary();
    const newLeaf = manager.getLeafCertificate('portal.example.com');

    expect(rotation.ok).toBe(true);
    expect(rotation.generation).toBeGreaterThan(oldCaSummary.generation);
    expect(newCaSummary.fingerprint).not.toBe(oldCaSummary.fingerprint);
    expect(newLeaf.certPem).not.toBe(oldLeaf.certPem);
    expect(newLeaf.caFingerprint).toBe(newCaSummary.fingerprint);
  });

  it('returns OS-specific trust installation guidance payloads', () => {
    manager.ensureCaArtifacts();

    const windows = manager.getTrustInstallGuidance('win32');
    const macos = manager.getTrustInstallGuidance('darwin');
    const linux = manager.getTrustInstallGuidance('linux');

    expect(windows.platform).toBe('win32');
    expect(macos.platform).toBe('darwin');
    expect(linux.platform).toBe('linux');

    for (const guidance of [windows, macos, linux]) {
      expect(guidance.title).toBeTruthy();
      expect(Array.isArray(guidance.steps)).toBe(true);
      expect(guidance.steps.length).toBeGreaterThan(2);
      expect(guidance.certPathHint).toContain('ca-cert.pem');
    }
  });
});
