const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function runGit(command) {
  try {
    return cp.execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`build-metadata: failed to read ${filePath} — ${error.message}`);
  }
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const workspaceRoot = path.resolve(__dirname, '..', '..');
const packageJsonPath = path.join(workspaceRoot, 'package.json');
const pkg = readJson(packageJsonPath);

const argOut = process.argv.find(arg => arg.startsWith('--out='));
const outPath = argOut
  ? path.resolve(workspaceRoot, argOut.slice('--out='.length))
  : path.resolve(workspaceRoot, 'src', 'contracts', 'build-info.json');

const metadata = {
  appName: String(pkg.name || 'unknown'),
  version: String(pkg.version || '0.0.0'),
  git: {
    commit: runGit('git rev-parse HEAD'),
    shortCommit: runGit('git rev-parse --short HEAD'),
    branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || runGit('git rev-parse --abbrev-ref HEAD'),
    commitCount: runGit('git rev-list --count HEAD')
  },
  build: {
    timestampUtc: new Date().toISOString(),
    source: process.env.GITHUB_ACTIONS ? 'github-actions' : 'local',
    runId: process.env.GITHUB_RUN_ID || 'local',
    runNumber: process.env.GITHUB_RUN_NUMBER || 'local'
  }
};

ensureDirectory(path.dirname(outPath));
fs.writeFileSync(outPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');

console.log(`build-metadata: wrote ${path.relative(workspaceRoot, outPath)}`);
