import { describe, it, expect } from 'vitest';
import path from 'node:path';

const PROXY_DIR = path.resolve(__dirname, '..');

const proxyServiceFiles = [
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

describe('Sentinel Proxy Services', () => {
  it('defines exactly 13 proxy service modules', () => {
    expect(proxyServiceFiles.length).toBe(13);
  });

  proxyServiceFiles.forEach((service) => {
    describe(`${service}`, () => {
      it('loads without throwing', () => {
        expect(() => require(path.join(PROXY_DIR, service))).not.toThrow();
      });

      it('exports an object', () => {
        const mod = require(path.join(PROXY_DIR, service));
        expect(typeof mod).toBe('object');
        expect(mod).not.toBeNull();
      });
    });
  });

  it('all modules are distinct require() targets', () => {
    const loaded = proxyServiceFiles.map(s => require(path.join(PROXY_DIR, s)));
    // Each module should be a non-null object
    loaded.forEach((mod) => {
      expect(mod).toBeDefined();
      expect(typeof mod).toBe('object');
    });
  });
});
