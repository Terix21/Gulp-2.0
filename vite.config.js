const path = require('node:path');
const { defineConfig } = require('vite');
const electronSimple = require('vite-plugin-electron/simple');
const reactPlugin = require('@vitejs/plugin-react');
const staticCopyPlugin = require('vite-plugin-static-copy');

const electron = electronSimple.default || electronSimple;
const react = reactPlugin.default || reactPlugin;
const viteStaticCopy = staticCopyPlugin.viteStaticCopy || staticCopyPlugin.default || staticCopyPlugin;

module.exports = defineConfig({
  root: path.resolve(__dirname, 'src', 'renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist', 'renderer'),
    emptyOutDir: true,
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: path.resolve(__dirname, 'src', 'main', 'index.js'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist', 'main'),
          },
        },
      },
      preload: {
        input: path.resolve(__dirname, 'src', 'main', 'preload.js'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist', 'main'),
          },
        },
      },
      renderer: {},
    }),
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(__dirname, 'src', 'contracts', '*'),
          dest: '../contracts',
        },
        {
          src: path.resolve(__dirname, 'instructions', 'END_USER_GUIDE.md'),
          dest: '..',
        },
      ],
    }),
  ],
});
