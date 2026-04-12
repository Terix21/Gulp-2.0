import { describe, it, expect } from 'vitest';
const { mapRendererConsoleSeverity, normalizeRendererConsoleMessageArgs } = require('../renderer-console');

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

describe('normalizeRendererConsoleMessageArgs', () => {
  it('handles legacy (event, level, message, line, sourceId) shape', () => {
    const result = normalizeRendererConsoleMessageArgs([{}, 2, 'hello', 10, 'app.js']);
    expect(result).toEqual({ level: 2, message: 'hello', line: 10, sourceId: 'app.js' });
  });

  it('handles new (event, payload) shape where second arg is a payload object', () => {
    const payload = { level: 'error', message: 'boom', lineNumber: 42, sourceId: 'main.js' };
    const result = normalizeRendererConsoleMessageArgs([{}, payload]);
    expect(result).toEqual({ level: 'error', message: 'boom', line: 42, sourceId: 'main.js' });
  });

  it('falls back to payload.line when lineNumber is absent', () => {
    const payload = { level: 'warn', message: 'oops', line: 7, sourceId: 'ui.js' };
    const result = normalizeRendererConsoleMessageArgs([{}, payload]);
    expect(result).toEqual({ level: 'warn', message: 'oops', line: 7, sourceId: 'ui.js' });
  });

  it('handles single-arg payload shape', () => {
    const payload = { level: 'info', message: 'hello', lineNumber: 1, sourceId: 'x.js' };
    const result = normalizeRendererConsoleMessageArgs([payload]);
    expect(result).toEqual({ level: 'info', message: 'hello', line: 1, sourceId: 'x.js' });
  });

  it('falls back to legacy shape when second arg is a primitive level', () => {
    const result = normalizeRendererConsoleMessageArgs([{}, 3, 'error msg', 5, 'src.js']);
    expect(result).toEqual({ level: 3, message: 'error msg', line: 5, sourceId: 'src.js' });
  });
});