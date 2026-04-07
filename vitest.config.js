import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.js'],
    exclude: [...configDefaults.exclude, '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/main/preload.js',
        'src/renderer/js/theme.js'
      ],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/**/__tests__/**/*.{js,jsx}',
        'node_modules/',
        'dist/'
      ],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
