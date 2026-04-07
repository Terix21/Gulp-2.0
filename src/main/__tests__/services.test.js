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

    it('should verify ca-manager exposes lifecycle API', () => {
      const caManager = require('../certs/ca-manager');

      expect(caManager).toBeTruthy();
      expect(typeof caManager.ensureCaArtifacts).toBe('function');
      expect(typeof caManager.getCaCertificatePem).toBe('function');
      expect(typeof caManager.exportCaCertificate).toBe('function');
      expect(typeof caManager.getLeafCertificate).toBe('function');
      expect(typeof caManager.rotateCa).toBe('function');
      expect(typeof caManager.getTrustInstallGuidance).toBe('function');
    });

    it('exports singleton convenience functions', () => {
      const mod = require(path.join(DB_DIR, 'project-store'));
      expect(typeof mod.openProject).toBe('function');
      expect(typeof mod.closeProject).toBe('function');
      expect(typeof mod.checkpointProject).toBe('function');
      expect(typeof mod.getProjectMeta).toBe('function');
      expect(typeof mod.upsertTrafficItem).toBe('function');
      expect(typeof mod.queryTraffic).toBe('function');
      expect(typeof mod.replaceRules).toBe('function');
      expect(typeof mod.replaceScopeRules).toBe('function');
      expect(typeof mod.setModuleState).toBe('function');
      expect(typeof mod.getModuleState).toBe('function');
    });

    it('exports schema constants and helpers', () => {
      const mod = require(path.join(DB_DIR, 'project-store'));
      expect(typeof mod.CURRENT_VERSION).toBe('number');
      expect(mod.CURRENT_VERSION).toBeGreaterThanOrEqual(1);
      expect(typeof mod.runMigrations).toBe('function');
      expect(typeof mod.rowToProjectMeta).toBe('function');
      expect(Array.isArray(mod.MIGRATIONS)).toBe(true);
      expect(Array.isArray(mod.DDL_V1)).toBe(true);
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
  });
});
