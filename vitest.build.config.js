import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'build-validation',
    globals: true,
    environment: 'node',
    include: ['build-validation/**/*.smoke.js'],
    exclude: ['**/node_modules/**'],
    reporters: ['default'],
  },
});
