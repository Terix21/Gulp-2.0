import { describe, expect, it } from 'vitest';

const { createDecoderService } = require('../decoder-service');

describe('SEN-019 decoder service', () => {
  it('supports base64 encode/decode chain', () => {
    const service = createDecoderService();
    const encoded = service.process({
      input: 'hello',
      operations: ['base64:encode'],
    });

    const decoded = service.process({
      input: encoded.result,
      operations: ['base64:decode'],
    });

    expect(encoded.result).toBe('aGVsbG8=');
    expect(decoded.result).toBe('hello');
  });

  it('supports html/url/hex transforms with step outputs', () => {
    const service = createDecoderService();
    const result = service.process({
      input: '<a b="1">',
      operations: ['html:encode', 'url:encode', 'url:decode', 'html:decode', 'hex:encode', 'hex:decode'],
    });

    expect(result.result).toBe('<a b="1">');
    expect(Array.isArray(result.steps)).toBe(true);
    expect(result.steps.length).toBe(6);
    expect(result.detailedSteps.length).toBe(6);
  });

  it('supports gzip encode/decode', () => {
    const service = createDecoderService();
    const compressed = service.process({
      input: 'payload-data',
      operations: ['gzip:encode'],
    });

    const restored = service.process({
      input: compressed.result,
      operations: ['gzip:decode'],
    });

    expect(restored.result).toBe('payload-data');
  });

  it('supports reverse chain execution', () => {
    const service = createDecoderService();
    const encoded = service.process({
      input: 'reverse-me',
      operations: ['url:encode', 'base64:encode'],
    });

    const reversed = service.process({
      input: encoded.result,
      operations: ['url:encode', 'base64:encode'],
      reverse: true,
    });

    expect(reversed.result).toBe('reverse-me');
    expect(reversed.reverseApplied).toBe(true);
  });

  it('supports recursive decode passes', () => {
    const service = createDecoderService();
    const nested = Buffer.from(Buffer.from('nested', 'utf8').toString('base64'), 'utf8').toString('base64');
    const output = service.process({
      input: nested,
      operations: ['base64:decode'],
      recursiveDepth: 2,
    });

    expect(output.result).toBe('nested');
  });
});
