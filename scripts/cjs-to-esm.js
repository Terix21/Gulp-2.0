#!/usr/bin/env node
'use strict';

const fs = require('fs');

const files = [
  'src/renderer/js/theme.js',
  'src/renderer/js/components/app-constants.js',
  'src/renderer/js/components/App.jsx',
  'src/renderer/js/components/sentinel/DashboardShell.jsx',
  'src/renderer/js/components/sentinel/DecoderPanel.jsx',
  'src/renderer/js/components/sentinel/EmbeddedBrowserPanel.jsx',
  'src/renderer/js/components/sentinel/ExtensionsPanel.jsx',
  'src/renderer/js/components/sentinel/HistoryPanel.jsx',
  'src/renderer/js/components/sentinel/IntruderPanel.jsx',
  'src/renderer/js/components/sentinel/OobPanel.jsx',
  'src/renderer/js/components/sentinel/ProxyPanel.jsx',
  'src/renderer/js/components/sentinel/RepeaterPanel.jsx',
  'src/renderer/js/components/sentinel/ScannerPanel.jsx',
  'src/renderer/js/components/sentinel/SequencerPanel.jsx',
  'src/renderer/js/components/sentinel/TargetMapPanel.jsx',
  'src/renderer/js/components/sentinel/theme-utils.js',
];

for (const file of files) {
  const orig = fs.readFileSync(file, 'utf8');
  let code = orig;

  // const X = require('pkg').default; -> import X from 'pkg';
  code = code.replace(
    /^const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*require\('([^']+)'\)\.default\s*;/gm,
    (_, id, pkg) => `import ${id} from '${pkg}';`
  );

  // const { A, B } = require('pkg'); -> import { A, B } from 'pkg';
  code = code.replace(
    /^const\s+\{([^}]+)\}\s*=\s*require\('([^']+)'\)\s*;/gm,
    (_, bindings, pkg) => `import {${bindings}} from '${pkg}';`
  );

  // const X = require('pkg'); -> import X from 'pkg';
  code = code.replace(
    /^const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*require\('([^']+)'\)\s*;/gm,
    (_, id, pkg) => `import ${id} from '${pkg}';`
  );

  // module.exports = { A, B }; -> export { A, B };
  code = code.replace(
    /^module\.exports\s*=\s*\{([^}]+)\}\s*;/gm,
    (_, body) => `export {${body}};`
  );

  // module.exports = X; -> export default X;
  code = code.replace(
    /^module\.exports\s*=\s*([A-Za-z_$][A-Za-z0-9_$]+)\s*;/gm,
    (_, id) => `export default ${id};`
  );

  // Drop trailing module.exports.foo = ... synonym lines (export bridges added in debugging)
  code = code.replace(/^module\.exports\.[^\n]+\n/gm, '');

  if (code !== orig) {
    fs.writeFileSync(file, code, 'utf8');
    console.log('converted:', file);
  }
}

console.log('cjs-to-esm done');
