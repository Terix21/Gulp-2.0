import { describe, expect, it } from 'vitest';

const { createSequencerService } = require('../sequencer-service');

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
});
