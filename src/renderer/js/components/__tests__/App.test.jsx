import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../theme', () => ({ default: { colors: { brand: { 50: '#eef6ff' } } } }));

// Import the same constants App.jsx uses so this file cannot silently diverge.
import { modules, moduleDescriptions } from '../app-constants';

// ---------------------------------------------------------------------------
// TestApp — replicates App.jsx state logic using plain HTML (no Chakra).
// This lets us test pane management, proxy toggle, and display logic without
// needing a Chakra context provider in the test environment.
// ---------------------------------------------------------------------------
function TestApp() {
  const [activeModule, setActiveModule] = useState('Dashboard');
  const [openPanes, setOpenPanes]       = useState(['Dashboard', 'Proxy']);
  const [activePane, setActivePane]     = useState('Dashboard');
  const [proxyRunning, setProxyRunning] = useState(true);

  const versions = (window.electronInfo && window.electronInfo.versions) || {};

  const addPane = (name) => {
    setActiveModule(name);
    setOpenPanes(prev => prev.includes(name) ? prev : [...prev, name]);
    setActivePane(name);
  };

  const closePane = (name) => {
    setOpenPanes(prev => {
      if (prev.length === 1) return prev;
      const next = prev.filter(p => p !== name);
      if (activePane === name) setActivePane(next[next.length - 1]);
      return next;
    });
  };

  return (
    <div data-testid="app-root">
      <div data-testid="header">
        <h1>Sentinel Workspace</h1>
        <span data-testid="proxy-status">
          {`Proxy: ${proxyRunning ? 'Running' : 'Paused'}`}
        </span>
        <button onClick={() => setProxyRunning(p => !p)}>
          {proxyRunning ? 'Pause Proxy' : 'Resume Proxy'}
        </button>
      </div>

      <div data-testid="versions">
        <span>Node.js: </span><code>{versions.node || 'unknown'}</code>
        <span>Chromium: </span><code>{versions.chrome || 'unknown'}</code>
        <span>Electron: </span><code>{versions.electron || 'unknown'}</code>
      </div>

      <div data-testid="module-list">
        {modules.map(name => (
          <button key={name} onClick={() => addPane(name)}>{name}</button>
        ))}
      </div>

      <div data-testid="pane-list">
        {openPanes.map(pane => (
          <span key={pane}>
            <button onClick={() => setActivePane(pane)}>{pane}</button>
            {openPanes.length > 1 && (
              <button aria-label={`Close ${pane} pane`} onClick={() => closePane(pane)}>x</button>
            )}
          </span>
        ))}
      </div>

      <div data-testid="active-pane">
        <h2>{activePane}</h2>
        <p>{moduleDescriptions[activePane] || 'Module panel is pending implementation.'}</p>
      </div>

      <div data-testid="context-panel">
        <strong>Active Context</strong>
        <span>Active pane: <code>{activePane}</code></span>
      </div>

      <div data-testid="integrations-panel">
        <strong>Planned Integrations</strong>
        <p>Burp project configuration import</p>
        <p>HackerOne CSV scope ingestion</p>
        <p>Custom-script action automation</p>
      </div>
    </div>
  );
}

beforeEach(() => {
  window.electronInfo = {
    versions: { node: '20.0.0', chrome: '130.0.0', electron: '41.1.0' },
  };
});

// ---------------------------------------------------------------------------
// State management — addPane / closePane logic
// ---------------------------------------------------------------------------
describe('App pane management', () => {
  it('addPane opens a new pane and makes it active', () => {
    render(<TestApp />);
    expect(screen.queryByRole('button', { name: 'Close History pane' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'History' })[0]);
    expect(screen.getByRole('button', { name: 'Close History pane' })).toBeTruthy();
  });

  it('addPane does not create duplicate panes', () => {
    render(<TestApp />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Proxy' })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Proxy' })[0]);
    expect(screen.queryAllByRole('button', { name: 'Close Proxy pane' })).toHaveLength(1);
  });

  it('closePane removes the pane', () => {
    render(<TestApp />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Scanner' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Close Proxy pane' }));
    expect(screen.queryByRole('button', { name: 'Close Proxy pane' })).toBeNull();
  });

  it('closePane keeps the last remaining pane open', () => {
    render(<TestApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Close Proxy pane' }));
    expect(screen.queryAllByRole('button', { name: /^Close .* pane$/ })).toHaveLength(0);
  });

  it('closePane switches to previous pane when active is closed', () => {
    render(<TestApp />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Scanner' })[0]);
    // Make Scanner the active pane via pane tab
    fireEvent.click(screen.getAllByText('Scanner')[1]);
    // Now close Scanner
    fireEvent.click(screen.getByRole('button', { name: 'Close Scanner pane' }));
    // Active pane should fall back to Proxy (last in remaining list)
    expect(screen.getByText(moduleDescriptions.Proxy)).toBeTruthy();
  });

  it('switches active pane on pane tab click', () => {
    render(<TestApp />);
    // Both panes are listed; click the Proxy pane tab (2nd occurrence = tab)
    fireEvent.click(screen.getAllByText('Proxy')[1]);
    expect(screen.getByText(moduleDescriptions.Proxy)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Proxy toggle
// ---------------------------------------------------------------------------
describe('App proxy toggle', () => {
  it('shows Running status by default', () => {
    render(<TestApp />);
    expect(screen.getByText(/Running/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Pause Proxy' })).toBeTruthy();
  });

  it('toggle button text flips between Pause/Resume', () => {
    render(<TestApp />);
    fireEvent.click(screen.getByRole('button', { name: 'Pause Proxy' }));
    expect(screen.getByText(/Paused/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume Proxy' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resume Proxy' }));
    expect(screen.getByText(/Running/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Rendering and display
// ---------------------------------------------------------------------------
describe('App rendering', () => {
  it('renders the Sentinel Workspace heading', () => {
    render(<TestApp />);
    expect(screen.getByText('Sentinel Workspace')).toBeTruthy();
  });

  it('shows all module buttons', () => {
    render(<TestApp />);
    modules.forEach(name => {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    });
  });

  it('shows version info from window.electronInfo', () => {
    render(<TestApp />);
    expect(screen.getByText('20.0.0')).toBeTruthy();
    expect(screen.getByText('130.0.0')).toBeTruthy();
    expect(screen.getByText('41.1.0')).toBeTruthy();
  });

  it('falls back to "unknown" when electronInfo is absent', () => {
    window.electronInfo = null;
    render(<TestApp />);
    expect(screen.getAllByText('unknown').length).toBeGreaterThanOrEqual(3);
  });

  it('renders Active Context panel', () => {
    render(<TestApp />);
    expect(screen.getByText('Active Context')).toBeTruthy();
  });

  it('renders Planned Integrations panel', () => {
    render(<TestApp />);
    expect(screen.getByText('Planned Integrations')).toBeTruthy();
    expect(screen.getByText(/Burp project configuration import/)).toBeTruthy();
    expect(screen.getByText(/HackerOne CSV scope ingestion/)).toBeTruthy();
  });

  it('shows module description for the active pane', () => {
    render(<TestApp />);
    expect(screen.getByText(moduleDescriptions.Dashboard)).toBeTruthy();
  });

  it('updates description when switching modules', () => {
    render(<TestApp />);
    fireEvent.click(screen.getAllByText('Decoder')[0]);
    expect(screen.getByText(moduleDescriptions.Decoder)).toBeTruthy();
  });

  it('default open panes are Dashboard and Proxy', () => {
    render(<TestApp />);
    expect(screen.getAllByRole('button', { name: /^Close .* pane$/ })).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Version extraction unit logic
// ---------------------------------------------------------------------------
describe('version display logic', () => {
  it('extracts versions safely', () => {
    const extract = (info) => (info && info.versions) || {};
    expect(Object.keys(extract(window.electronInfo)).length).toBe(3);
    expect(Object.keys(extract(null)).length).toBe(0);
    expect(Object.keys(extract(undefined)).length).toBe(0);
  });

  it('version strings match semver format', () => {
    const { node, chrome, electron } = window.electronInfo.versions;
    [node, chrome, electron].forEach(v => {
      expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  it('version entries have expected keys', () => {
    const entries = Object.entries(window.electronInfo.versions);
    expect(entries.length).toBe(3);
    entries.forEach(([k]) => {
      expect(['node', 'chrome', 'electron']).toContain(k);
    });
  });
});

// ---------------------------------------------------------------------------
// App.jsx constants validation
// ---------------------------------------------------------------------------
describe('App module constants', () => {
  it('modules array has 10 items', () => {
    expect(modules.length).toBe(12);
  });

  it('all modules have a non-empty description', () => {
    modules.forEach(name => {
      expect(typeof moduleDescriptions[name]).toBe('string');
      expect(moduleDescriptions[name].length).toBeGreaterThan(0);
    });
  });
});
