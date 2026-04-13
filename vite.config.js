const path = require('node:path');
const { defineConfig } = require('vite');
const electronSimple = require('vite-plugin-electron/simple');
const reactPlugin = require('@vitejs/plugin-react');
const staticCopyPlugin = require('vite-plugin-static-copy');

const electron = electronSimple.default || electronSimple;
const react = reactPlugin.default || reactPlugin;
const viteStaticCopy = staticCopyPlugin.viteStaticCopy || staticCopyPlugin.default || staticCopyPlugin;
const toPosixPath = (value) => value.replaceAll('\\', '/');

module.exports = defineConfig({
  root: path.resolve(__dirname, 'src', 'renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist', 'renderer'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Stable entry name expected by the post-build smoke test
        entryFileNames: 'js/app.js',
        chunkFileNames: 'js/[name].js',
        // Route CSS to css/style.css and other assets to assets/
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some((name) => name.endsWith('.css'))) {
            return 'css/style.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: path.resolve(__dirname, 'src', 'main', 'index.js'),
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist', 'main'),
            rollupOptions: {
              external: ['./extension-ipc-install', './renderer-console'],
            },
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
      // Keep renderer bridge enabled. vite-plugin-electron requires
      // vite-plugin-electron-renderer to be installed when this option is used.
      renderer: {},
    }),
    viteStaticCopy({
      targets: [
        {
          src: toPosixPath(path.resolve(__dirname, 'src', 'contracts', '**/*')),
          dest: '../contracts',
        },
        {
          src: toPosixPath(path.resolve(__dirname, 'src', 'main', 'renderer-console.js')),
          dest: '../main',
        },
        {
          src: toPosixPath(path.resolve(__dirname, 'src', 'main', 'extension-ipc-install.js')),
          dest: '../main',
        },
        {
          src: toPosixPath(path.resolve(__dirname, 'src', 'main', 'certs', '**/*')),
          dest: '../main/certs',
        },
        {
          src: toPosixPath(path.resolve(__dirname, 'src', 'main', 'db', '**/*')),
          dest: '../main/db',
        },
        {
          src: toPosixPath(path.resolve(__dirname, 'src', 'main', 'proxy', '**/*')),
          dest: '../main/proxy',
        },
        {
          src: toPosixPath(path.resolve(__dirname, 'instructions', 'END_USER_GUIDE.md')),
          dest: '..',
        },
      ],
    }),
  ],
});
