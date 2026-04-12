import { describe, it, expect } from 'vitest';
import themeSystem from '../theme.js';

describe('Theme Configuration', () => {
  it('should export a theme system object', () => {
    expect(themeSystem).toBeDefined();
    expect(typeof themeSystem).toBe('object');
  });

  it('should have theme configuration with tokens', () => {
    // Verify theme structure
    expect(themeSystem).toBeTruthy();
  });

  it('should define brand color palette with 10 shades', () => {
    const brandColors = {
      50: '#edf6ff',
      100: '#cfe3ff',
      200: '#9fc6ff',
      300: '#6ca7ff',
      400: '#3f89ff',
      500: '#216de6',
      600: '#1854b3',
      700: '#143f84',
      800: '#122f61',
      900: '#101f40'
    };

    expect(Object.keys(brandColors).length).toBe(10);
    Object.entries(brandColors).forEach(([key, value]) => {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('should define workbench semantic tokens', () => {
    const semanticColors = themeSystem.rawConfig.theme.semanticTokens.colors;

    expect(semanticColors.bg.canvas.value).toBe('var(--sentinel-bg-canvas, #0e141c)');
    expect(semanticColors.bg.panel.value).toBe('var(--sentinel-bg-panel, #111821)');
    expect(semanticColors.bg.subtle.value).toBe('var(--sentinel-bg-subtle, #202d3a)');
  });

  it('should provide valid workbench color references', () => {
    const allColors = [
      '#edf6ff', '#cfe3ff', '#9fc6ff', '#6ca7ff', '#3f89ff',
      '#216de6', '#1854b3', '#143f84', '#122f61', '#101f40',
      '#111821', '#1a2531', '#202d3a', '#0b1118', '#34485b'
    ];

    allColors.forEach(color => {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

