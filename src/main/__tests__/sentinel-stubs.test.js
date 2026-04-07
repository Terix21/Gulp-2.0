import { describe, it, expect } from 'vitest';
import path from 'node:path';

const PROXY_DIR = path.resolve(__dirname, '../proxy');
const DB_DIR    = path.resolve(__dirname, '../db');
const CERT_DIR  = path.resolve(__dirname, '../certs');

describe('Sentinel Service Stubs', () => {
  describe('Proxy Services', () => {
    const proxyModules = [
      'intercept-engine',
      'history-log',
      'protocol-support',
      'rules-engine',
      'repeater-service',
      'intruder-engine',
      'target-mapper',
      'scanner-engine',
      'oob-service',
      'sequencer-service',
      'decoder-service',
      'extension-host',
      'embedded-browser-service',
    ];

    proxyModules.forEach((mod) => {
      it(`${mod} loads and exports an object`, () => {
        const loaded = require(path.join(PROXY_DIR, mod));
        expect(typeof loaded).toBe('object');
        expect(loaded).not.toBeNull();
      });
    });

    it('all 13 proxy service modules are loadable', () => {
      expect(proxyModules.length).toBe(13);
      proxyModules.forEach((mod) => {
        expect(() => require(path.join(PROXY_DIR, mod))).not.toThrow();
      });
    });
  });

  describe('Database Services', () => {
    it('project-store loads and exports a ProjectStore class', () => {
      const mod = require(path.join(DB_DIR, 'project-store'));
      expect(typeof mod.ProjectStore).toBe('function');
    });
  });

  describe('Certificate Services', () => {
    it('ca-manager loads and exports an object', () => {
      const mod = require(path.join(CERT_DIR, 'ca-manager'));
      expect(typeof mod).toBe('object');
      expect(mod).not.toBeNull();
    });
  });
});
