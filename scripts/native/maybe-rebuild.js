'use strict';

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.join(__dirname, '..', '..');
const markerPath = path.join(rootDir, 'node_modules', '.cache', 'sentinel', 'electron-rebuild.json');

function readPackageJson() {
  return JSON.parse(readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
}

function readPackageLockMtimeMs() {
  const packageLockPath = path.join(rootDir, 'package-lock.json');
  if (!existsSync(packageLockPath)) {
    return 0;
  }

  return require('node:fs').statSync(packageLockPath).mtimeMs;
}

function writeRebuildMarker() {
  const packageJson = readPackageJson();
  mkdirSync(path.dirname(markerPath), { recursive: true });
  writeFileSync(markerPath, `${JSON.stringify({
    rebuiltAt: Date.now(),
    electronVersion: String(packageJson.devDependencies?.electron || ''),
    packageLockMtimeMs: readPackageLockMtimeMs(),
    nodeVersion: process.version,
  }, null, 2)}\n`, 'utf8');
}

function isTruthyEnv(name) {
  return /^(1|true|yes)$/i.test(String(process.env[name] || '').trim());
}

const skipReasons = [];
if (isTruthyEnv('CI')) {
  skipReasons.push('CI detected');
}
if (isTruthyEnv('SENTINEL_SKIP_ELECTRON_REBUILD')) {
  skipReasons.push('SENTINEL_SKIP_ELECTRON_REBUILD set');
}

if (skipReasons.length > 0) {
  console.log(`[postinstall] Skipping electron-rebuild (${skipReasons.join(', ')})`);
  process.exit(0);
}

const executableName = process.platform === 'win32' ? 'electron-rebuild.cmd' : 'electron-rebuild';
const executablePath = path.join(rootDir, 'node_modules', '.bin', executableName);

if (!existsSync(executablePath)) {
  console.log('[postinstall] Skipping electron-rebuild (binary not found)');
  process.exit(0);
}

const result = spawnSync(executablePath, [], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

if (result.status === 0) {
  writeRebuildMarker();
}

process.exit(result.status == null ? 1 : result.status);