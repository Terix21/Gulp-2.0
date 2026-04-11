import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

describe('post-build dist runtime validation', () => {
  it('emits expected dist artifacts', () => {
    const requiredFiles = [
      'dist/main/index.js',
      'dist/main/preload.js',
      'dist/renderer/index.html',
      'dist/renderer/js/app.js',
      'dist/renderer/css/style.css',
    ];

    for (const file of requiredFiles) {
      expect(fs.existsSync(path.join(root, file))).toBe(true);
    }
  });

  it('keeps main process BrowserWindow security flags explicit in built output', () => {
    const builtMain = read('dist/main/index.js');

    // esbuild minifies true → !0 and false → !1
    expect(builtMain).toMatch(/contextIsolation:\s*(?:true|!0)/);
    expect(builtMain).toMatch(/nodeIntegration:\s*(?:false|!1)/);
    expect(builtMain).toMatch(/sandbox:\s*(?:true|!0)/);
  });

  it('keeps preload bridge exports in built output', () => {
    const builtPreload = read('dist/main/preload.js');

    expect(builtPreload).toMatch(/exposeInMainWorld\(["']sentinel["']/);
    expect(builtPreload).toMatch(/exposeInMainWorld\(["']electronInfo["']/);
  });
});
