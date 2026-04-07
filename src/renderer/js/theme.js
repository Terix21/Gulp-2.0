const { createSystem, defaultConfig, defineConfig } = require('@chakra-ui/react');

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        body: { value: "'IBM Plex Sans', 'Segoe UI', sans-serif" },
        heading: { value: "'IBM Plex Sans', 'Segoe UI', sans-serif" },
        mono: { value: "'IBM Plex Mono', 'Consolas', 'Courier New', monospace" }
      },
      radii: {
        sm: { value: '4px' },
        md: { value: '6px' },
        lg: { value: '8px' }
      },
      colors: {
        brand: {
          50: { value: '#edf6ff' },
          100: { value: '#cfe3ff' },
          200: { value: '#9fc6ff' },
          300: { value: '#6ca7ff' },
          400: { value: '#3f89ff' },
          500: { value: '#216de6' },
          600: { value: '#1854b3' },
          700: { value: '#143f84' },
          800: { value: '#122f61' },
          900: { value: '#101f40' }
        },
        workbench: {
          50: { value: '#f3f6f8' },
          100: { value: '#d8e0e6' },
          200: { value: '#afbdc8' },
          300: { value: '#8699aa' },
          400: { value: '#5f7589' },
          500: { value: '#495d70' },
          600: { value: '#334252' },
          700: { value: '#242f3c' },
          800: { value: '#171f29' },
          900: { value: '#0e141c' }
        }
      }
    },
    semanticTokens: {
      colors: {
        'bg.canvas': { value: 'var(--sentinel-bg-canvas, #0e141c)' },
        'bg.panel': { value: 'var(--sentinel-bg-panel, #111821)' },
        'bg.surface': { value: 'var(--sentinel-bg-surface, #1a2531)' },
        'bg.subtle': { value: 'var(--sentinel-bg-subtle, #202d3a)' },
        'bg.elevated': { value: 'var(--sentinel-bg-elevated, #0b1118)' },
        'fg.default': { value: 'var(--sentinel-fg-default, #f0f4f8)' },
        'fg.muted': { value: 'var(--sentinel-fg-muted, #cad7e2)' },
        'border.default': { value: 'var(--sentinel-border-default, #2a3948)' },
        'border.subtle': { value: 'var(--sentinel-border-subtle, #34485b)' },
        'severity.critical': { value: '#e53e3e' },
        'severity.high': { value: '#ed8936' },
        'severity.medium': { value: '#ecc94b' },
        'severity.low': { value: '#63b3ed' },
        'severity.info': { value: '#b4c4d2' }
      }
    },
    recipes: {
      button: {
        base: {
          borderRadius: 'sm',
          fontWeight: '500'
        },
        variants: {
          variant: {
            solid: {
              bg: 'brand.600',
              color: 'white',
              _hover: {
                bg: 'brand.500'
              }
            },
            outline: {
              color: 'fg.default',
              borderColor: 'border.default',
              bg: 'transparent',
              _hover: {
                bg: 'bg.subtle'
              }
            },
            ghost: {
              color: 'fg.default',
              bg: 'transparent',
              _hover: {
                bg: 'bg.subtle'
              }
            }
          }
        }
      }
    }
  }
});

const system = createSystem(defaultConfig, config);
system.rawConfig = config;

module.exports = system;
