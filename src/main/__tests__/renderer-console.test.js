import { describe, it, expect } from 'vitest';
const { mapRendererConsoleSeverity } = require('../renderer-console');
describe('mapRendererConsoleSeverity', () => {
  it('preserves Electron numeric console-message severity semantics', () => {
    // Electron levels: 0=verbose, 1=info, 2=warning, 3=error
    expect(mapRendererConsoleSeverity(0)).toBe('info');
    expect(mapRendererConsoleSeverity(1)).toBe('info');
    expect(mapRendererConsoleSeverity(2)).toBe('warn');
    expect(mapRendererConsoleSeverity(3)).toBe('error');
  });

  it('continues to normalize string levels', () => {
    expect(mapRendererConsoleSeverity('warning')).toBe('warn');
    expect(mapRendererConsoleSeverity('error')).toBe('error');
    expect(mapRendererConsoleSeverity('verbose')).toBe('debug');
    expect(mapRendererConsoleSeverity('log')).toBe('info');
  });
});