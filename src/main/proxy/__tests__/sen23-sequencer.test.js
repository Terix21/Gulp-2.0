import { describe, expect, it } from 'vitest';

const { createSequencerService } = require('../sequencer-service');

// Access extractToken indirectly via captureStart to test extractBodyToken path.
// We use a forwardRequest that returns a response body and verify the captured token.
function makeBodySequencer(body) {
  return createSequencerService({
    forwardRequest: async () => ({
      statusCode: 200,
      headers: {},
      body,
    }),
  });
}

describe('SEN-023 sequencer service', () => {
  it('captures token samples and computes entropy report', async () => {
    let counter = 0;
    const sequencer = createSequencerService({
      forwardRequest: async () => {
        counter += 1;
        return {
          statusCode: 200,
          headers: { 'set-cookie': `session=token-${counter}; Path=/; HttpOnly` },
          body: 'ok',
        };
      },
    });

    const started = await sequencer.captureStart({
      config: {
        sampleSize: 12,
        tokenField: { source: 'cookie', key: 'session' },
        requestTemplate: {
          method: 'GET',
          url: 'https://app.test/login',
          host: 'app.test',
          path: '/login',
          headers: { host: 'app.test' },
          tls: true,
        },
      },
    });

    expect(started.sessionId).toBeTruthy();
    expect(started.sampleCount).toBe(12);

    const analyzed = await sequencer.analyze({ sessionId: started.sessionId });
    expect(analyzed.report.sampleCount).toBe(12);
    expect(typeof analyzed.report.entropyBitsPerChar).toBe('number');
    expect(analyzed.report.fips140_2).toBeTruthy();
    expect(analyzed.report.exportCsv.includes('position,token')).toBe(true);
  });

  it('extracts token from response body using deterministic key scan', async () => {
    const sequencer = makeBodySequencer('csrf_token = abc123XYZ');
    const started = await sequencer.captureStart({
      config: {
        sampleSize: 5,
        tokenField: { source: 'body', key: 'csrf_token' },
        requestTemplate: {
          method: 'GET', url: 'https://app.test/', host: 'app.test',
          path: '/', headers: { host: 'app.test' }, tls: true,
        },
      },
    });
    // sampleSize min is 5; all responses return the same body so all 5 tokens are captured
    expect(started.sampleCount).toBe(5);
    const report = await sequencer.analyze({ sessionId: started.sessionId });
    // Token "abc123XYZ" should have been captured
    expect(report.report.exportCsv).toMatch('abc123XYZ');
  });

  it('does not treat regex metacharacters in key as a pattern', async () => {
    // Key contains regex metacharacters — must not throw and must not match spuriously.
    const sequencer = makeBodySequencer('value = safe999');
    const started = await sequencer.captureStart({
      config: {
        sampleSize: 5,
        tokenField: { source: 'body', key: '.*[^]' },
        requestTemplate: {
          method: 'GET', url: 'https://app.test/', host: 'app.test',
          path: '/', headers: { host: 'app.test' }, tls: true,
        },
      },
    });
    // Key literal ".*[^]" not found in body — no tokens captured, no throw
    expect(started.sampleCount).toBe(0);
  });

  it('truncates keys longer than 256 characters and still extracts a value', async () => {
    const longKey = 'a'.repeat(300);
    const shortKey = 'a'.repeat(256);
    // Body uses the 256-char key (which is what the truncated key will scan for)
    const body = `${shortKey} = truncated_ok`;
    const sequencer = makeBodySequencer(body);
    const started = await sequencer.captureStart({
      config: {
        sampleSize: 5,
        tokenField: { source: 'body', key: longKey },
        requestTemplate: {
          method: 'GET', url: 'https://app.test/', host: 'app.test',
          path: '/', headers: { host: 'app.test' }, tls: true,
        },
      },
    });
    // Key is truncated to 256 chars; body matches — 5 tokens captured
    expect(started.sampleCount).toBe(5);
    const report = await sequencer.analyze({ sessionId: started.sessionId });
    expect(report.report.exportCsv).toMatch('truncated_ok');
  });

  it('supports capture using a history request id resolver', async () => {
    const sequencer = createSequencerService({
      getTrafficItem: async () => ({
        request: {
          method: 'GET',
          url: 'https://api.test/session',
          host: 'api.test',
          path: '/session',
          headers: { host: 'api.test' },
          tls: true,
        },
      }),
      forwardRequest: async () => ({
        statusCode: 200,
        headers: { authorization: 'Bearer abcdef123456' },
        body: 'ok',
      }),
    });

    const started = await sequencer.captureStart({
      config: {
        requestId: 'history-1',
        sampleSize: 6,
        tokenField: { source: 'header', key: 'authorization' },
      },
    });

    expect(started.sampleCount).toBe(6);
    const report = await sequencer.analyze({ sessionId: started.sessionId });
    expect(report.report.averageLength).toBeGreaterThan(0);
  });

  it('parses Set-Cookie lines with Expires commas and multiple cookie pairs', async () => {
    const sequencer = createSequencerService({
      forwardRequest: async () => ({
        statusCode: 200,
        headers: {
          'set-cookie': 'foo=bar; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/, session=token-xyz; Path=/; HttpOnly',
        },
        body: 'ok',
      }),
    });

    const started = await sequencer.captureStart({
      config: {
        sampleSize: 5,
        tokenField: { source: 'cookie', key: 'session' },
        requestTemplate: {
          method: 'GET',
          url: 'https://app.test/login',
          host: 'app.test',
          path: '/login',
          headers: { host: 'app.test' },
          tls: true,
        },
      },
    });

    expect(started.sampleCount).toBe(5);
    const analyzed = await sequencer.analyze({ sessionId: started.sessionId });
    expect(analyzed.report.exportCsv).toMatch('token-xyz');
  });
});
