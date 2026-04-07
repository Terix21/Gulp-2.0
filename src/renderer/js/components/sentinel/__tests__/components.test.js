import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Static imports so Vite's JSX transform is applied to all panel components
import DashboardShell from '../DashboardShell.jsx';
import ProxyPanel from '../ProxyPanel.jsx';
import HistoryPanel from '../HistoryPanel.jsx';
import RepeaterPanel from '../RepeaterPanel.jsx';
import IntruderPanel from '../IntruderPanel.jsx';
import ScannerPanel from '../ScannerPanel.jsx';
import DecoderPanel from '../DecoderPanel.jsx';
import OobPanel from '../OobPanel.jsx';
import SequencerPanel from '../SequencerPanel.jsx';
import TargetMapPanel from '../TargetMapPanel.jsx';
import ExtensionsPanel from '../ExtensionsPanel.jsx';
import EmbeddedBrowserPanel from '../EmbeddedBrowserPanel.jsx';

// Use CJS require so ChakraProvider shares the same module instance as the
// panel components (which also use CJS require). ESM/CJS module splitting
// otherwise creates two separate React Context objects.
const { ChakraProvider, defaultSystem } = require('@chakra-ui/react');

// Wrap renders with ChakraProvider so Chakra's context hooks resolve correctly.
function renderWithChakra(ui) {
  return render(React.createElement(ChakraProvider, { value: defaultSystem }, ui));
}

const originalResizeObserver = global.ResizeObserver;
const originalSentinel = global.window ? global.window.sentinel : undefined;

function createBrowserApi() {
  return {
    createSession: vi.fn(async () => ({
      session: {
        id: 'sess-1',
        name: 'Session 1',
        currentUrl: '',
        statusCode: null,
        contentType: '',
        title: '',
        loading: false,
        visible: true,
        focused: true,
        canGoBack: false,
        canGoForward: false,
        lastError: '',
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        hostPartition: 'sentinel-browser-sess-1',
        updatedAt: 2,
      },
    })),
    listSessions: vi.fn(async () => ({
      items: [{
        id: 'sess-1',
        name: 'Session 1',
        currentUrl: 'https://example.com',
        statusCode: 200,
        contentType: 'text/html',
        title: 'Example',
        loading: false,
        visible: true,
        focused: true,
        canGoBack: false,
        canGoForward: false,
        lastError: '',
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        hostPartition: 'sentinel-browser-sess-1',
        updatedAt: 1,
      }],
    })),
    navigate: vi.fn(async ({ sessionId, url }) => ({
      session: {
        id: sessionId,
        name: 'Session 1',
        currentUrl: url,
        statusCode: 200,
        contentType: 'text/html',
        title: 'Example',
        loading: false,
        visible: true,
        focused: true,
        canGoBack: true,
        canGoForward: false,
        lastError: '',
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        hostPartition: 'sentinel-browser-sess-1',
        updatedAt: 3,
      },
      proxy: { port: 8080 },
    })),
    back: vi.fn(async ({ sessionId }) => ({ session: { id: sessionId, name: 'Session 1', updatedAt: 4 } })),
    forward: vi.fn(async ({ sessionId }) => ({ session: { id: sessionId, name: 'Session 1', updatedAt: 5 } })),
    reload: vi.fn(async ({ sessionId }) => ({ session: { id: sessionId, name: 'Session 1', updatedAt: 6 } })),
    stop: vi.fn(async ({ sessionId }) => ({ session: { id: sessionId, name: 'Session 1', updatedAt: 7 } })),
    closeSession: vi.fn(async () => ({ ok: true, sessionId: 'sess-1' })),
    focusSession: vi.fn(async ({ sessionId }) => ({ session: { id: sessionId, focused: true } })),
    showView: vi.fn(async ({ sessionId }) => ({ session: { id: sessionId, visible: true } })),
    hideView: vi.fn(async ({ sessionId }) => ({ session: { id: sessionId, visible: false } })),
    setBounds: vi.fn(async ({ sessionId, bounds }) => ({ session: { id: sessionId, bounds } })),
    onState: vi.fn(handler => {
      createBrowserApi.stateHandler = handler;
      return () => {};
    }),
    onNavigateStart: vi.fn(() => () => {}),
    onNavigateComplete: vi.fn(() => () => {}),
    onNavigateError: vi.fn(() => () => {}),
    onTitleUpdated: vi.fn(() => () => {}),
  };
}

describe('Sentinel UI Panel Components', () => {
  beforeEach(() => {
    global.ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    if (global.window) {
      if (typeof originalSentinel === 'undefined') {
        delete global.window.sentinel;
      } else {
        global.window.sentinel = originalSentinel;
      }
    }
    global.ResizeObserver = originalResizeObserver;
    vi.restoreAllMocks();
  });

  describe('DashboardShell', () => {
    it('exports a function component', () => {
      expect(typeof DashboardShell).toBe('function');
    });

    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(DashboardShell))).not.toThrow();
    });

    it('displays Dashboard heading', () => {
      renderWithChakra(React.createElement(DashboardShell));
      expect(screen.getByText('Dashboard')).toBeTruthy();
    });
  });

  describe('ProxyPanel', () => {
    it('exports a function component', () => {
      expect(typeof ProxyPanel).toBe('function');
    });

    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(ProxyPanel))).not.toThrow();
    });

    it('displays Proxy heading', () => {
      renderWithChakra(React.createElement(ProxyPanel));
      expect(screen.getByText('Proxy')).toBeTruthy();
    });
  });

  describe('HistoryPanel', () => {
    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(HistoryPanel))).not.toThrow();
    });

    it('displays History heading', () => {
      renderWithChakra(React.createElement(HistoryPanel));
      expect(screen.getByText('History')).toBeTruthy();
    });
  });

  describe('RepeaterPanel', () => {
    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(RepeaterPanel))).not.toThrow();
    });

    it('displays Repeater heading', () => {
      renderWithChakra(React.createElement(RepeaterPanel));
      expect(screen.getByText('Repeater')).toBeTruthy();
    });
  });

  describe('IntruderPanel', () => {
    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(IntruderPanel))).not.toThrow();
    });

    it('displays Intruder heading', () => {
      renderWithChakra(React.createElement(IntruderPanel));
      expect(screen.getByText('Intruder')).toBeTruthy();
    });
  });

  describe('ScannerPanel', () => {
    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(ScannerPanel))).not.toThrow();
    });

    it('displays Scanner heading', () => {
      renderWithChakra(React.createElement(ScannerPanel));
      expect(screen.getByText('Scanner')).toBeTruthy();
    });
  });

  describe('DecoderPanel', () => {
    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(DecoderPanel))).not.toThrow();
    });

    it('displays Decoder heading', () => {
      renderWithChakra(React.createElement(DecoderPanel));
      expect(screen.getByText('Decoder')).toBeTruthy();
    });
  });

  describe('OobPanel', () => {
    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(OobPanel))).not.toThrow();
    });

    it('displays OOB heading', () => {
      renderWithChakra(React.createElement(OobPanel));
      expect(screen.getByText('OOB')).toBeTruthy();
    });
  });

  describe('SequencerPanel', () => {
    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(SequencerPanel))).not.toThrow();
    });

    it('displays Sequencer heading', () => {
      renderWithChakra(React.createElement(SequencerPanel));
      expect(screen.getByText('Sequencer')).toBeTruthy();
    });
  });

  describe('TargetMapPanel', () => {
    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(TargetMapPanel))).not.toThrow();
    });

    it('displays Target Map heading', () => {
      renderWithChakra(React.createElement(TargetMapPanel));
      expect(screen.getByText('Target Map')).toBeTruthy();
    });
  });

  describe('ExtensionsPanel', () => {
    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(ExtensionsPanel))).not.toThrow();
    });

    it('displays Extensions heading', () => {
      renderWithChakra(React.createElement(ExtensionsPanel));
      expect(screen.getByText('Extensions')).toBeTruthy();
    });
  });

  describe('EmbeddedBrowserPanel', () => {
    it('renders without throwing', () => {
      expect(() => renderWithChakra(React.createElement(EmbeddedBrowserPanel))).not.toThrow();
    });

    it('displays Embedded Browser heading', () => {
      renderWithChakra(React.createElement(EmbeddedBrowserPanel));
      expect(screen.getByText('Embedded Browser')).toBeTruthy();
    });

    it('loads sessions, syncs bounds, and drives browser controls through preload API', async () => {
      const browserApi = createBrowserApi();
      window.sentinel = { browser: browserApi };

      const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
        left: 11,
        top: 22,
        width: 640,
        height: 320,
        right: 651,
        bottom: 342,
      }));

      renderWithChakra(React.createElement(EmbeddedBrowserPanel));

      await waitFor(() => expect(browserApi.listSessions).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(browserApi.focusSession).toHaveBeenCalledWith({ sessionId: 'sess-1' }));
      await waitFor(() => expect(browserApi.showView).toHaveBeenCalledWith({ sessionId: 'sess-1' }));
      await waitFor(() => expect(browserApi.setBounds).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        bounds: { x: 11, y: 22, width: 640, height: 320 },
      }));

      fireEvent.change(screen.getByPlaceholderText('https://target.example'), {
        target: { value: 'https://sentinel.test' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Go' }));

      await waitFor(() => expect(browserApi.navigate).toHaveBeenCalledWith({
        sessionId: 'sess-1',
        url: 'https://sentinel.test',
      }));

      fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
      await waitFor(() => expect(browserApi.reload).toHaveBeenCalledWith({ sessionId: 'sess-1' }));

      rectSpy.mockRestore();
    });
  });

  it('all 12 panel components are functions', () => {
    const panels = [
      DashboardShell, ProxyPanel, HistoryPanel, RepeaterPanel,
      IntruderPanel, TargetMapPanel, ScannerPanel, OobPanel,
      SequencerPanel, DecoderPanel, ExtensionsPanel, EmbeddedBrowserPanel,
    ];
    expect(panels.length).toBe(12);
    panels.forEach((Panel) => {
      expect(typeof Panel).toBe('function');
    });
  });
});
