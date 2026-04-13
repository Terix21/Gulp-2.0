const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

// Resolve git to an absolute path to prevent PATH-hijacking attacks where a
// malicious executable named 'git' is placed earlier in PATH.
// GIT_BIN env var allows explicit pinning in CI or security-hardened environments.
const GIT_BIN = (function resolveGitBin() {
  if (process.env.GIT_BIN) return process.env.GIT_BIN;
  const candidates = process.platform === 'win32'
    ? [String.raw`C:\Program Files\Git\bin\git.exe`, String.raw`C:\Program Files (x86)\Git\bin\git.exe`]
    : ['/usr/bin/git', '/usr/local/bin/git'];
  return candidates.find(p => fs.existsSync(p)) ?? 'git';
}());

function runGit(args) {
  try {
    return cp.execFileSync(GIT_BIN, args, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    }).trim();
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
    commit: runGit(['rev-parse', 'HEAD']),
    shortCommit: runGit(['rev-parse', '--short', 'HEAD']),
    branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || runGit(['rev-parse', '--abbrev-ref', 'HEAD']),
    commitCount: runGit(['rev-list', '--count', 'HEAD'])
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
