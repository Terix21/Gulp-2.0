import { vi } from 'vitest';

// Mock Electron
vi.mock('electron', () => ({
  app: {
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    quit: vi.fn()
  },
  BrowserWindow: vi.fn(() => ({
    loadFile: vi.fn(),
    getAllWindows: vi.fn(() => [])
  }))
}));

// Mock window.electronInfo for renderer tests
Object.defineProperty(window, 'electronInfo', {
  value: {
    versions: {
      node: '20.0.0',
      chrome: '130.0.0',
      electron: '41.1.0'
    }
  },
  writable: true
});
