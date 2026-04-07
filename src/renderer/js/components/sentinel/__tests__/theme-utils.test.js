import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isDarkTheme, getMonacoTheme, getStatusTextColor, getOverlayScrim } from '../theme-utils.js';

describe('theme-utils', () => {
  describe('isDarkTheme', () => {
    it('returns true for dark-* theme IDs', () => {
      expect(isDarkTheme('dark-steel')).toBe(true);
      expect(isDarkTheme('dark-midnight')).toBe(true);
      expect(isDarkTheme('dark-forest')).toBe(true);
    });

    it('returns false for light-* theme IDs', () => {
      expect(isDarkTheme('light-clean')).toBe(false);
      expect(isDarkTheme('light-warm')).toBe(false);
    });

    it('defaults to dark-steel (dark) when no explicit ID is given', () => {
      expect(isDarkTheme(undefined)).toBe(true);
      expect(isDarkTheme(null)).toBe(true);
      expect(isDarkTheme('')).toBe(true);
    });
  });

  describe('getMonacoTheme', () => {
    it('returns vs-dark for dark theme IDs', () => {
      expect(getMonacoTheme('dark-steel')).toBe('vs-dark');
      expect(getMonacoTheme('dark-midnight')).toBe('vs-dark');
    });

    it('returns vs for light theme IDs', () => {
      expect(getMonacoTheme('light-clean')).toBe('vs');
      expect(getMonacoTheme('light-warm')).toBe('vs');
    });

    it('defaults to vs-dark when no explicit ID is given', () => {
      expect(getMonacoTheme(undefined)).toBe('vs-dark');
    });
  });

  describe('getStatusTextColor', () => {
    it('returns severity.critical for error status', () => {
      expect(getStatusTextColor('error')).toBe('severity.critical');
    });

    it('returns severity.high for warning status', () => {
      expect(getStatusTextColor('warning')).toBe('severity.high');
    });

    it('returns green.300 for success on dark themes', () => {
      expect(getStatusTextColor('success', 'dark-steel')).toBe('green.300');
      expect(getStatusTextColor('success', 'dark-midnight')).toBe('green.300');
    });

    it('returns green.700 for success on light themes', () => {
      expect(getStatusTextColor('success', 'light-clean')).toBe('green.700');
      expect(getStatusTextColor('success', 'light-warm')).toBe('green.700');
    });

    it('returns green.300 for success when no theme ID given (defaults to dark)', () => {
      expect(getStatusTextColor('success', undefined)).toBe('green.300');
    });

    it('returns severity.info for info status', () => {
      expect(getStatusTextColor('info')).toBe('severity.info');
    });

    it('returns fg.default for unknown status types', () => {
      expect(getStatusTextColor('unknown')).toBe('fg.default');
      expect(getStatusTextColor('default')).toBe('fg.default');
    });

    it('returns fg.default when status is undefined or null', () => {
      expect(getStatusTextColor(undefined)).toBe('fg.default');
      expect(getStatusTextColor(null)).toBe('fg.default');
    });

    it('is case-insensitive for status type', () => {
      expect(getStatusTextColor('ERROR')).toBe('severity.critical');
      expect(getStatusTextColor('Warning')).toBe('severity.high');
      expect(getStatusTextColor('INFO')).toBe('severity.info');
    });
  });

  describe('getOverlayScrim', () => {
    it('returns dark scrim for dark theme IDs', () => {
      expect(getOverlayScrim('dark-steel')).toBe('rgba(5, 10, 16, 0.65)');
      expect(getOverlayScrim('dark-midnight')).toBe('rgba(5, 10, 16, 0.65)');
    });

    it('returns light scrim for light theme IDs', () => {
      expect(getOverlayScrim('light-clean')).toBe('rgba(232, 238, 247, 0.82)');
      expect(getOverlayScrim('light-warm')).toBe('rgba(232, 238, 247, 0.82)');
    });

    it('defaults to dark scrim when no explicit ID is given', () => {
      expect(getOverlayScrim(undefined)).toBe('rgba(5, 10, 16, 0.65)');
    });
  });

  describe('DOM attribute fallback for resolveThemeId', () => {
    beforeEach(() => {
      document.documentElement.removeAttribute('data-sentinel-theme-id');
    });

    afterEach(() => {
      document.documentElement.removeAttribute('data-sentinel-theme-id');
    });

    it('falls back to dark-steel when no explicit ID and no DOM attribute', () => {
      expect(isDarkTheme(undefined)).toBe(true);
      expect(getMonacoTheme(undefined)).toBe('vs-dark');
      expect(getOverlayScrim(undefined)).toBe('rgba(5, 10, 16, 0.65)');
    });

    it('reads theme from DOM data-sentinel-theme-id attribute', () => {
      document.documentElement.setAttribute('data-sentinel-theme-id', 'light-clean');
      expect(isDarkTheme(undefined)).toBe(false);
      expect(getMonacoTheme(undefined)).toBe('vs');
      expect(getOverlayScrim(undefined)).toBe('rgba(232, 238, 247, 0.82)');
    });

    it('explicit theme ID takes precedence over DOM attribute', () => {
      document.documentElement.setAttribute('data-sentinel-theme-id', 'light-clean');
      expect(isDarkTheme('dark-steel')).toBe(true);
      expect(getMonacoTheme('dark-steel')).toBe('vs-dark');
    });

    it('DOM dark theme resolves correctly for status colors', () => {
      document.documentElement.setAttribute('data-sentinel-theme-id', 'dark-midnight');
      expect(getStatusTextColor('success', undefined)).toBe('green.300');
    });

    it('DOM light theme resolves correctly for status colors', () => {
      document.documentElement.setAttribute('data-sentinel-theme-id', 'light-warm');
      expect(getStatusTextColor('success', undefined)).toBe('green.700');
    });
  });
});
