import { afterEach, describe, expect, it } from 'vitest';

const { createOobService } = require('../oob-service');

describe('SEN-022 oob service', () => {
  const services = [];

  afterEach(async () => {
    while (services.length > 0) {
      const service = services.pop();
      if (service && service.server) {
        await new Promise(resolve => service.server.close(resolve));
      }
    }
  });

  it('creates unique payload urls and records correlated hits', async () => {
    const persisted = [];
    const service = createOobService({
      persistInteraction: async hit => persisted.push(hit),
    });
    services.push(service);

    const payload = await service.createPayload({
      type: 'http',
      sourceRequestId: 'req-1',
      sourceScanId: 'scan-1',
      targetUrl: 'https://app.test/x',
    });

    expect(payload.id).toBeTruthy();
    expect(payload.url.includes('http://')).toBe(true);
    expect(payload.domain.includes('.oob.sentinel.local')).toBe(true);

    const recorded = await service.recordHit({
      payloadId: payload.id,
      kind: 'http',
      source: '127.0.0.1',
      token: 'abc',
      requestPath: '/abc',
      correlation: {
        sourceRequestId: 'req-1',
        sourceScanId: 'scan-1',
      },
    });

    expect(recorded.ok).toBe(true);
    expect(recorded.hit.correlation.sourceRequestId).toBe('req-1');
    expect(persisted.length).toBe(1);

    const listed = await service.listHits({ id: payload.id, page: 0, pageSize: 20 });
    expect(listed.total).toBe(1);
    expect(listed.hits[0].source).toBe('127.0.0.1');
  });
});
