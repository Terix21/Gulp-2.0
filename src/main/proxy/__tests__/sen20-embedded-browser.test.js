import { describe, expect, it, vi } from 'vitest';

const { createEmbeddedBrowserService } = require('../embedded-browser-service');

describe('SEN-020 embedded browser service', () => {
  it('creates sessions and prepares Chromium navigation through the configured proxy', async () => {
    const browser = createEmbeddedBrowserService({
      getProxyStatus: vi.fn(async () => ({ running: true, port: 8088 })),
      startProxy: vi.fn(async () => ({ port: 8088 })),
    });

    const created = browser.createSession({ name: 'M6 Session' });
    expect(created.name).toBe('M6 Session');

    const navigated = await browser.navigate({
      sessionId: created.id,
      url: 'http://127.0.0.1:9090/page',
    });

    expect(navigated.session.currentUrl).toContain('/page');
    expect(navigated.session.loading).toBe(true);
    expect(navigated.response.statusCode).toBeNull();
    expect(navigated.proxy.port).toBe(8088);
  });

  it('supports browser-managed history state for back, forward, and reload scaffolding', async () => {
    const browser = createEmbeddedBrowserService({
      getProxyStatus: vi.fn(async () => ({ running: true, port: 8090 })),
      startProxy: vi.fn(async () => ({ port: 8090 })),
    });

    const session = browser.createSession({});
    await browser.navigate({ sessionId: session.id, url: 'http://127.0.0.1:9010/one' });
    browser.completeRuntimeNavigation({ sessionId: session.id, currentUrl: 'http://127.0.0.1:9010/one', proxyPort: 8090 });

    await browser.navigate({ sessionId: session.id, url: 'http://127.0.0.1:9010/two' });
    browser.completeRuntimeNavigation({ sessionId: session.id, currentUrl: 'http://127.0.0.1:9010/two', proxyPort: 8090 });

    const back = await browser.back({ sessionId: session.id });
    expect(back.session.currentUrl).toContain('/one');
    expect(back.session.loading).toBe(true);
    browser.completeRuntimeNavigation({ sessionId: session.id, currentUrl: 'http://127.0.0.1:9010/one', proxyPort: 8090 });

    const forward = await browser.forward({ sessionId: session.id });
    expect(forward.session.currentUrl).toContain('/two');
    browser.completeRuntimeNavigation({ sessionId: session.id, currentUrl: 'http://127.0.0.1:9010/two', proxyPort: 8090 });

    const reloaded = await browser.reload({ sessionId: session.id });
    expect(reloaded.session.currentUrl).toContain('/two');

    const listed = browser.listSessions();
    expect(listed.items.length).toBe(1);
    expect(listed.items[0].currentUrl).toContain('/two');
    expect(listed.items[0].canGoBack).toBe(true);
  });

  it('normalizes host-only addresses to http before navigating', async () => {
    const browser = createEmbeddedBrowserService({
      getProxyStatus: vi.fn(async () => ({ running: true, port: 8077 })),
      startProxy: vi.fn(async () => ({ port: 8077 })),
    });

    const session = browser.createSession({});
    const navigated = await browser.navigate({
      sessionId: session.id,
      url: '127.0.0.1:4567/normalized',
    });

    expect(navigated.session.currentUrl).toBe('http://127.0.0.1:4567/normalized');
    expect(navigated.response.statusCode).toBeNull();
  });

  it('scaffolds Chromium session state controls for focus, bounds, visibility, and close', () => {
    const browser = createEmbeddedBrowserService();

    const first = browser.createSession({ name: 'One' });
    const second = browser.createSession({ name: 'Two' });

    expect(first.hostModel).toBe('WebContentsView');
    expect(first.hostPartition).toBe(`sentinel-browser-${first.id}`);
    expect(first.security.contextIsolation).toBe(true);
    expect(first.focused).toBe(true);
    expect(second.focused).toBe(false);

    const focused = browser.focusSession({ sessionId: second.id });
    const hidden = browser.hideView({ sessionId: second.id });
    const bounded = browser.setViewBounds({
      sessionId: second.id,
      bounds: { x: 12, y: 24, width: 800, height: 600 },
    });
    const fetched = browser.getSession({ sessionId: second.id });
    const closed = browser.closeSession({ sessionId: second.id });

    expect(focused.session.focused).toBe(true);
    expect(hidden.session.visible).toBe(false);
    expect(bounded.session.bounds).toEqual({ x: 12, y: 24, width: 800, height: 600 });
    expect(fetched.session.name).toBe('Two');
    expect(closed).toEqual({ ok: true, sessionId: second.id });
    expect(browser.listSessions().items).toHaveLength(1);
  });

  it('applies runtime Chromium state updates to a session snapshot', () => {
    const browser = createEmbeddedBrowserService();
    const created = browser.createSession({ name: 'Runtime' });

    const updated = browser.applyRuntimeState({
      sessionId: created.id,
      title: 'Runtime Title',
      currentUrl: 'https://example.com/runtime',
      loading: true,
      lastError: '',
      reason: 'chromium:did-start-loading',
    });

    expect(updated.session.title).toBe('Runtime Title');
    expect(updated.session.currentUrl).toBe('https://example.com/runtime');
    expect(updated.session.loading).toBe(true);
  });
});
