import { describe, it, expect } from 'vitest';
import path from 'node:path';

const DB_DIR   = path.resolve(__dirname, '../db');
const CERT_DIR = path.resolve(__dirname, '../certs');

describe('Sentinel Database and Certificate Services', () => {
  describe('project-store module', () => {
    it('loads without throwing', () => {
      expect(() => require(path.join(DB_DIR, 'project-store'))).not.toThrow();
    });

    it('exports an object with expected API surface', () => {
      const mod = require(path.join(DB_DIR, 'project-store'));
      expect(typeof mod).toBe('object');
      expect(mod).not.toBeNull();
    });

    it('exports ProjectStore class', () => {
      const mod = require(path.join(DB_DIR, 'project-store'));
      expect(typeof mod.ProjectStore).toBe('function');
    });

    it('exports key singleton entry points', () => {
      const mod = require(path.join(DB_DIR, 'project-store'));
      expect(typeof mod.openProject).toBe('function');
      expect(typeof mod.closeProject).toBe('function');
      expect(typeof mod.getProjectMeta).toBe('function');
    });
  });

  describe('ca-manager module', () => {
    it('loads without throwing', () => {
      expect(() => require(path.join(CERT_DIR, 'ca-manager'))).not.toThrow();
    });

    it('exports an object', () => {
      const mod = require(path.join(CERT_DIR, 'ca-manager'));
      expect(typeof mod).toBe('object');
      expect(mod).not.toBeNull();
    });

    it('exposes the primary certificate lifecycle entry points', () => {
      const mod = require(path.join(CERT_DIR, 'ca-manager'));
      expect(typeof mod.ensureCaArtifacts).toBe('function');
      expect(typeof mod.getCaCertificatePem).toBe('function');
      expect(typeof mod.getLeafCertificate).toBe('function');
      expect(typeof mod.rotateCa).toBe('function');
    });
  });
});
