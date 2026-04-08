'use strict';

/**
 * Shared module-list and description constants consumed by App.jsx and its
 * tests.  Extracting them here ensures tests cannot silently diverge from the
 * strings actually rendered in the UI.
 */

const modules = [
  'Dashboard',
  'Proxy',
  'History',
  'Repeater',
  'Intruder',
  'Target',
  'Scanner',
  'OOB',
  'Sequencer',
  'Decoder',
  'Embedded Browser',
  'Extensions',
];

const moduleDescriptions = {
  Dashboard:  'Program overview, findings summary, and workflow shortcuts.',
  Proxy:      'Intercept, inspect, and forward HTTP/S traffic.',
  History:    'Search and filter previously captured traffic.',
  Repeater:   'Modify and replay requests for manual testing.',
  Intruder:   'Run payload attacks with baseline anomaly analysis.',
  Target:     'Manage scope and navigate discovered surface area.',
  Scanner:    'Run passive/active checks and review findings.',
  OOB:        'Track out-of-band callback payloads and correlated hits.',
  Sequencer:  'Capture token samples and evaluate randomness metrics.',
  Decoder:    'Encode/decode payloads and inspect transformed values.',
  'Embedded Browser': 'Browse targets through Sentinel proxy without external browser setup.',
  Extensions: 'Manage custom tools and extension-provided workflows.',
};

export { modules, moduleDescriptions };
