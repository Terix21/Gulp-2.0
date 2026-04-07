import { describe, expect, it } from 'vitest';

const { createScannerEngine } = require('../scanner-engine');

describe('SEN-021 scanner engine', () => {
  it('records passive findings from observed traffic', async () => {
    const persisted = [];
    const scanner = createScannerEngine({
      persistFinding: async finding => {
        persisted.push(finding);
      },
    });

    await scanner.observeTraffic({
      id: 'hist-1',
      request: {
        method: 'GET',
        host: 'app.test',
        path: '/account',
        body: 'api_key="abcd1234"',
      },
      response: {
        statusCode: 200,
        headers: {
          server: 'nginx',
          'set-cookie': 'sid=abc123; Path=/',
        },
        body: 'ok',
      },
    });

    expect(persisted.length).toBeGreaterThan(0);
    expect(persisted.some(item => item.type === 'passive')).toBe(true);
    expect(persisted.some(item => item.name.includes('cookie') || item.name.includes('Cookie'))).toBe(true);
  });

  it('runs active checks and generates findings for SQLi/XSS/SSRF heuristics', async () => {
    const findings = [];
    const scanner = createScannerEngine({
      forwardRequest: async request => {
        const url = String(request.url || '');
        if (url.includes('sntl_sqli')) {
          return {
            statusCode: 500,
            headers: { 'content-type': 'text/plain' },
            body: 'SQL syntax error near ...',
          };
        }
        if (url.includes('sntl_xss')) {
          return {
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            body: decodeURIComponent(url),
          };
        }
        return {
          statusCode: 200,
          headers: { location: 'http://sentinel-token.oob.invalid/' },
          body: 'redirect sentinel-token.oob.invalid',
        };
      },
      persistFinding: async finding => {
        findings.push(finding);
      },
    });

    const started = await scanner.start({
      targets: ['https://app.test/search'],
      config: { mode: 'active' },
    });

    const result = await scanner.results({ scanId: started.scanId, page: 0, pageSize: 200 });
    expect(result.total).toBeGreaterThanOrEqual(2);
    expect(result.findings.some(item => item.type === 'active:sqli')).toBe(true);
    expect(result.findings.some(item => item.type === 'active:xss')).toBe(true);
    expect(findings.length).toBe(result.total);
  });

  it('filters out-of-scope targets from active execution', async () => {
    let sentCount = 0;
    const scanner = createScannerEngine({
      forwardRequest: async () => {
        sentCount += 1;
        return { statusCode: 200, headers: {}, body: 'ok' };
      },
    });

    scanner.setScopeEvaluator(target => String(target.url || '').includes('allowed.test'));

    await scanner.start({
      targets: ['https://allowed.test/a', 'https://blocked.test/b'],
      config: { mode: 'active' },
    });

    expect(sentCount).toBeGreaterThan(0);
    const jobs = [...scanner.jobs.values()];
    expect(jobs[0].targets).toEqual(['https://allowed.test/a']);
    expect(jobs[0].skippedTargets).toEqual(['https://blocked.test/b']);
  });
});
