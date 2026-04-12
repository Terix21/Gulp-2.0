# Sentinel UI Overview

This document provides a comprehensive overview of the UI components in the Sentinel workspace.

## File: src\renderer\js\components\app-constants.js

\javascript
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

\\n
## File: src\renderer\js\components\App.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Heading,
  Input,
  Stack,
  Text,
  Textarea,
  VStack
} from '@chakra-ui/react';
import {
  FiHome,
  FiShield,
  FiClock,
  FiRepeat,
  FiCrosshair,
  FiMap,
  FiSearch,
  FiRadio,
  FiBarChart2,
  FiCode,
  FiMonitor,
  FiPackage,
  FiChevronsLeft,
  FiChevronsRight,
  FiTerminal,
  FiChevronDown,
  FiChevronUp,
  FiTrash2,
  FiSettings,
} from 'react-icons/fi';
import DashboardShell from './sentinel/DashboardShell';
import ProxyPanel from './sentinel/ProxyPanel';
import HistoryPanel from './sentinel/HistoryPanel';
import RepeaterPanel from './sentinel/RepeaterPanel';
import IntruderPanel from './sentinel/IntruderPanel';
import TargetMapPanel from './sentinel/TargetMapPanel';
import ScannerPanel from './sentinel/ScannerPanel';
import OobPanel from './sentinel/OobPanel';
import SequencerPanel from './sentinel/SequencerPanel';
import DecoderPanel from './sentinel/DecoderPanel';
import EmbeddedBrowserPanel from './sentinel/EmbeddedBrowserPanel';
import ExtensionsPanel from './sentinel/ExtensionsPanel';
import { modules, moduleDescriptions } from './app-constants';
import { getOverlayScrim } from './sentinel/theme-utils';

const panelStatusFields = {
  Dashboard: [
    { label: 'Open issues', key: 'openIssues' },
    { label: 'Critical findings', key: 'criticalFindings' },
    { label: 'Active sessions', key: 'activeSessions' }
  ],
  Proxy: [
    { label: 'Queue depth', key: 'queueCount' },
    { label: 'Intercept mode', key: 'interceptMode' },
    { label: 'Listener port', key: 'listenerPort' }
  ],
  History: [
    { label: 'Requests captured', key: 'requestCount' },
    { label: 'Visible (filtered)', key: 'filteredCount' },
    { label: 'Active filter', key: 'activeFilter' }
  ],
  Repeater: [
    { label: 'Saved requests', key: 'savedRequests' },
    { label: 'Last target', key: 'lastTarget' }
  ],
  Intruder: [
    { label: 'Attack positions', key: 'positions' },
    { label: 'Payload count', key: 'payloadCount' },
    { label: 'Attack status', key: 'attackStatus' }
  ],
  Target: [
    { label: 'Scope entries', key: 'scopeEntries' },
    { label: 'Discovered hosts', key: 'discoveredHosts' },
    { label: 'Scope mode', key: 'scopeMode' }
  ],
  Scanner: [
    { label: 'Findings', key: 'findings' },
    { label: 'Active scans', key: 'activeScans' },
    { label: 'Last scan target', key: 'lastScanTarget' }
  ],
  OOB: [
    { label: 'Payloads', key: 'payloads' },
    { label: 'Callbacks', key: 'callbacks' },
    { label: 'Last callback source', key: 'lastSource' }
  ],
  Sequencer: [
    { label: 'Samples', key: 'samples' },
    { label: 'Entropy score', key: 'entropy' },
    { label: 'Rating', key: 'rating' }
  ],
  Decoder: [
    { label: 'Encoding chain', key: 'encodingType' },
    { label: 'Chain steps', key: 'chainLength' }
  ],
  'Embedded Browser': [
    { label: 'Open sessions', key: 'openSessions' },
    { label: 'Last URL', key: 'lastUrl' },
    { label: 'Proxy route', key: 'proxyRoute' }
  ],
  Extensions: [
    { label: 'Loaded', key: 'loadedCount' },
    { label: 'Active', key: 'activeCount' }
  ]
};

const defaultPanelStatus = {
  Dashboard: { openIssues: 0, criticalFindings: 0, activeSessions: 0 },
  Proxy: { queueCount: 0, interceptMode: 'All requests', listenerPort: 8080 },
  History: { requestCount: 0, filteredCount: 0, activeFilter: 'None' },
  Repeater: { savedRequests: 0, lastTarget: '\u2014' },
  Intruder: { positions: 0, payloadCount: 0, attackStatus: 'Idle' },
  Target: { scopeEntries: 0, discoveredHosts: 0, scopeMode: 'in-scope-only' },
  Scanner: { findings: 0, activeScans: 0, lastScanTarget: '\u2014' },
  OOB: { payloads: 0, callbacks: 0, lastSource: '\u2014' },
  Sequencer: { samples: 0, entropy: '\u2014', rating: 'pending' },
  Decoder: { encodingType: 'URL', chainLength: 1 },
  'Embedded Browser': { openSessions: 0, lastUrl: '\u2014', proxyRoute: 'auto' },
  Extensions: { loadedCount: 0, activeCount: 0 }
};

const modulePanels = {
  Dashboard: DashboardShell,
  Proxy: ProxyPanel,
  History: HistoryPanel,
  Repeater: RepeaterPanel,
  Intruder: IntruderPanel,
  Target: TargetMapPanel,
  Scanner: ScannerPanel,
  OOB: OobPanel,
  Sequencer: SequencerPanel,
  Decoder: DecoderPanel,
  'Embedded Browser': EmbeddedBrowserPanel,
  Extensions: ExtensionsPanel
};

const moduleIcons = {
  Dashboard: FiHome,
  Proxy: FiShield,
  History: FiClock,
  Repeater: FiRepeat,
  Intruder: FiCrosshair,
  Target: FiMap,
  Scanner: FiSearch,
  OOB: FiRadio,
  Sequencer: FiBarChart2,
  Decoder: FiCode,
  'Embedded Browser': FiMonitor,
  Extensions: FiPackage
};

function formatMemoryUsageMb() {
  if (globalThis.performance?.memory?.usedJSHeapSize) {
    return `${Math.round(globalThis.performance.memory.usedJSHeapSize / (1024 * 1024))} MB`;
  }
  if (globalThis.navigator?.deviceMemory) {
    return `~${globalThis.navigator.deviceMemory} GB device`;
  }
  return 'n/a';
}

// Mirrors the semantic token values from theme.js for use in inline-style contexts.
const THEME_REGISTRY = {
  'dark-steel': {
    label: 'Dark Steel',
    description: 'Deep blue-gray shell with crisp neutral contrast.',
    group: 'dark',
    mode: 'dark',
    colors: {
      fgDefault: '#f0f4f8',
      fgMuted: '#cad7e2',
      bgCanvas: '#0e141c',
      bgPanel: '#111821',
      bgSurface: '#1a2531',
      bgSubtle: '#202d3a',
      bgElevated: '#0b1118',
      borderDefault: '#2a3948',
      borderSubtle: '#34485b',
    }
  },
  'dark-graphite': {
    label: 'Dark Graphite',
    description: 'Neutral graphite palette with restrained highlights.',
    group: 'dark',
    mode: 'dark',
    colors: {
      fgDefault: '#f5f7fa',
      fgMuted: '#d3dae4',
      bgCanvas: '#101215',
      bgPanel: '#161a1f',
      bgSurface: '#1d232b',
      bgSubtle: '#252d36',
      bgElevated: '#0d1014',
      borderDefault: '#313b46',
      borderSubtle: '#3e4a57',
    }
  },
  'dark-ocean': {
    label: 'Dark Ocean',
    description: 'Cool navy surfaces tuned for long scanning sessions.',
    group: 'dark',
    mode: 'dark',
    colors: {
      fgDefault: '#eef6ff',
      fgMuted: '#c7d9eb',
      bgCanvas: '#09131d',
      bgPanel: '#0f1c28',
      bgSurface: '#162636',
      bgSubtle: '#1d3146',
      bgElevated: '#071019',
      borderDefault: '#284259',
      borderSubtle: '#35546f',
    }
  },
  'dark-ember': {
    label: 'Dark Ember',
    description: 'Warm charcoal surfaces with amber-leaning accents.',
    group: 'dark',
    mode: 'dark',
    colors: {
      fgDefault: '#faf2e8',
      fgMuted: '#dfcdb9',
      bgCanvas: '#17110d',
      bgPanel: '#211914',
      bgSurface: '#2a211b',
      bgSubtle: '#342820',
      bgElevated: '#120d0a',
      borderDefault: '#4a372d',
      borderSubtle: '#5a4337',
    }
  },
  'dark-circuit': {
    label: 'Dark Circuit',
    description: 'Black-green console styling for analysis-heavy workflows.',
    group: 'dark',
    mode: 'dark',
    colors: {
      fgDefault: '#edfdf5',
      fgMuted: '#c6e7d7',
      bgCanvas: '#0a120f',
      bgPanel: '#101915',
      bgSurface: '#15231d',
      bgSubtle: '#1c2d26',
      bgElevated: '#08100d',
      borderDefault: '#284236',
      borderSubtle: '#345547',
    }
  },
  'light-paper': {
    label: 'Light Paper',
    description: 'Warm bright canvas with neutral panel contrast.',
    group: 'light',
    mode: 'light',
    colors: {
      fgDefault: '#18212b',
      fgMuted: '#506171',
      bgCanvas: '#f6f4ef',
      bgPanel: '#ffffff',
      bgSurface: '#f2ede4',
      bgSubtle: '#e6e0d5',
      bgElevated: '#ede7dc',
      borderDefault: '#c6bcae',
      borderSubtle: '#d7cfc3',
    }
  },
  'light-stone': {
    label: 'Light Stone',
    description: 'Cool neutral theme with calm contrast and low glare.',
    group: 'light',
    mode: 'light',
    colors: {
      fgDefault: '#1d2731',
      fgMuted: '#5a6977',
      bgCanvas: '#edf1f4',
      bgPanel: '#ffffff',
      bgSurface: '#e4eaef',
      bgSubtle: '#d7dfe6',
      bgElevated: '#e8edf2',
      borderDefault: '#b8c3ce',
      borderSubtle: '#cad3dc',
    }
  },
  'light-blueprint': {
    label: 'Light Blueprint',
    description: 'Pale blue engineering surfaces with strong ink text.',
    group: 'light',
    mode: 'light',
    colors: {
      fgDefault: '#142538',
      fgMuted: '#4d657d',
      bgCanvas: '#eef5fb',
      bgPanel: '#ffffff',
      bgSurface: '#dfeaf5',
      bgSubtle: '#d0e0ee',
      bgElevated: '#e7f0f8',
      borderDefault: '#aec6da',
      borderSubtle: '#c1d4e4',
    }
  },
  'light-sage': {
    label: 'Light Sage',
    description: 'Soft green-gray workbench with readable status contrast.',
    group: 'light',
    mode: 'light',
    colors: {
      fgDefault: '#1b2922',
      fgMuted: '#58695f',
      bgCanvas: '#eef3ee',
      bgPanel: '#ffffff',
      bgSurface: '#e0e9e1',
      bgSubtle: '#d0ddd1',
      bgElevated: '#e6ede7',
      borderDefault: '#b1c0b2',
      borderSubtle: '#c4d0c4',
    }
  },
  'light-signal': {
    label: 'Light Signal',
    description: 'Clean amber-tinted daylight theme for review work.',
    group: 'light',
    mode: 'light',
    colors: {
      fgDefault: '#2a2116',
      fgMuted: '#6d5d46',
      bgCanvas: '#fbf4e8',
      bgPanel: '#fffdf8',
      bgSurface: '#f3e6cf',
      bgSubtle: '#ead9b9',
      bgElevated: '#f7eddc',
      borderDefault: '#d3bc92',
      borderSubtle: '#e0cdac',
    }
  }
};

const FALLBACK_THEME = THEME_REGISTRY['dark-steel'];
const THEME_GROUPS = [
  { id: 'dark', label: 'Dark themes' },
  { id: 'light', label: 'Light themes' }
];

function getInitialThemeId() {
  const storedThemeId = globalThis.window?.localStorage?.getItem('sentinel-theme-id');
  if (storedThemeId && THEME_REGISTRY[storedThemeId]) {
    return storedThemeId;
  }
  return 'dark-steel';
}

function applyThemeToDocument(themeId) {
  if (typeof document === 'undefined' || !document.documentElement) {
    return;
  }

  const theme = THEME_REGISTRY[themeId] || FALLBACK_THEME;
  const root = document.documentElement;
  const body = document.body;

  root.dataset.theme = theme.mode;
  root.dataset.sentinelThemeId = themeId;
  root.style.colorScheme = theme.mode;

  Object.entries(theme.colors).forEach(([token, value]) => {
    const cssName = token.replaceAll(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    root.style.setProperty(`--sentinel-${cssName}`, value);
  });

  if (body) {
    body.style.backgroundColor = theme.colors.bgCanvas;
    body.style.color = theme.colors.fgDefault;
  }

  globalThis.window?.localStorage?.setItem('sentinel-theme-id', themeId);
}

function renderConsoleExportLine(entry) {
  const timestamp = Number(entry?.timestamp);
  const level = String(entry?.level ?? 'info').toUpperCase();
  const source = String(entry?.source ?? 'app');
  const message = String(entry?.message ?? '');
  const detailValue = entry?.detail;
  let detail = '';
  if (detailValue !== undefined && detailValue !== null) {
    detail = ` | ${String(detailValue)}`;
  }
  const renderedTimestamp = Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : new Date().toISOString();

  return `${renderedTimestamp} [${level}] [${source}] ${message}${detail}`;
}

function downloadConsoleLogs(entries) {
  if (typeof document === 'undefined' || globalThis.window === undefined || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }

  const records = Array.isArray(entries) ? entries : [];
  const content = `${records.map(renderConsoleExportLine).join('\n')}\n`;
  const blob = new globalThis.window.Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().replaceAll(/[.:]/g, '-');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `sentinel-app-log-${stamp}.log`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return true;
}

function parseHeadersText(text) {
  const map = {};
  for (const rawLine of String(text || '').split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    const separator = line.indexOf(':');
    if (separator <= 0) {
      continue;
    }
    const name = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!name) {
      continue;
    }
    map[name] = value;
  }
  return map;
}

function parseStaticIpsText(text) {
  const out = [];
  const seen = new Set();
  for (const token of String(text || '').split(/\r?\n|,/g)) {
    const ip = token.trim();
    if (!ip || seen.has(ip)) {
      continue;
    }
    seen.add(ip);
    out.push(ip);
  }
  return out;
}

function getFilterBadgePalette(lvl) {
  if (lvl === 'error') return 'red';
  if (lvl === 'warn') return 'orange';
  return 'blue';
}

function ConsoleDrawer(props) {
  const {
    isOpen,
    logs,
    filter,
    autoScroll,
    endRef,
    theme,
    onFilterChange,
    onAutoScrollToggle,
    onClear,
    onExport,
  } = props;
  const levelColor = { info: theme.colors.fgDefault, warn: 'orange.600', error: 'red.600' };
  const levelBg = {
    info: 'transparent',
    warn: 'rgba(221, 107, 32, 0.10)',
    error: 'rgba(229, 62, 62, 0.10)'
  };
  const filteredLogs = filter === 'all' ? logs : logs.filter(e => e.level === filter);
  return (
    <Box
      borderTopWidth='1px'
      borderColor={theme.colors.borderDefault}
      bg={theme.colors.bgElevated}
      style={{ transition: 'height 0.2s ease' }}
      h={isOpen ? '200px' : '0px'}
      overflow='hidden'
      display='flex'
      flexDirection='column'
    >
      {isOpen ? (
        <Flex direction='column' h='100%'>
          <Flex
            px='3'
            py='1'
            borderBottomWidth='1px'
            borderColor={theme.colors.borderSubtle}
            align='center'
            gap='2'
            flex='0 0 auto'
            bg={theme.colors.bgPanel}
          >
            <HStack gap='1' flex='0 0 auto'>
              <Box w='6px' h='6px' borderRadius='full' bg='green.400' />
              <Text fontSize='xs' color={theme.colors.fgMuted}>Live Output</Text>
            </HStack>
            <HStack gap='1' flex='1'>
              {['all', 'info', 'warn', 'error'].map(lvl => {
                const isActive = filter === lvl;
                let countBadge = null;
                if (lvl === 'info' || lvl === 'warn' || lvl === 'error') {
                  const badgeColors = {
                    info: { border: 'blue.500', bg: 'rgba(59,130,246,0.1)' },
                    warn: { border: 'orange.500', bg: 'rgba(249,115,22,0.1)' },
                    error: { border: 'red.500', bg: 'rgba(239,68,68,0.1)' }
                  };
                  countBadge = (
                    <Badge ml='1' variant='outline' color='var(--sentinel-fg-default)' borderColor={badgeColors[lvl].border} bg={badgeColors[lvl].bg} size='xs'>
                      {logs.filter(e => e.level === lvl).length}
                    </Badge>
                  );
                }
                return (
                  <Button
                    key={lvl}
                    size='xs'
                    variant={isActive ? 'solid' : 'ghost'}
                    colorPalette={getFilterBadgePalette(lvl)}
                    onClick={() => onFilterChange(lvl)}
                  >
                    {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    {countBadge}
                  </Button>
                );
              })}
            </HStack>
            <Button
              size='xs'
              variant='ghost'
              color={autoScroll ? theme.colors.fgDefault : theme.colors.fgMuted}
              _hover={{ bg: theme.colors.bgSubtle }}
              onClick={onAutoScrollToggle}
              title={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
              aria-label={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
            >
              {autoScroll ? 'Pause Auto-Scroll' : 'Resume Auto-Scroll'}
            </Button>
            <Button
              size='xs'
              variant='ghost'
              color={theme.colors.fgMuted}
              _hover={{ bg: theme.colors.bgSubtle }}
              onClick={onExport}
              title='Export console logs'
              aria-label='Export console logs'
            >
              Export Logs
            </Button>
            <Button
              size='xs'
              variant='ghost'
              color={theme.colors.fgMuted}
              _hover={{ bg: theme.colors.bgSubtle }}
              onClick={onClear}
              title='Clear console'
              aria-label='Clear console'
            >
              <FiTrash2 size={12} />
            </Button>
          </Flex>
          <Box flex='1' overflowY='auto' overflowX='hidden' wordBreak='break-word' px='2' py='1' fontFamily="'IBM Plex Mono', monospace" fontSize='11px'>
            {filteredLogs.length === 0 ? (
              <Text color={theme.colors.fgMuted} fontSize='11px' py='2' px='1'>Waiting for app output stream...</Text>
            ) : filteredLogs.map(entry => (
              <Flex
                key={entry.id}
                gap='2'
                py='1px'
                px='1'
                borderRadius='sm'
                bg={levelBg[entry.level] || 'transparent'}
                align='baseline'
              >
                <Text flex='0 0 auto' color={theme.colors.fgMuted} fontSize='10px' style={{ userSelect: 'none' }}>
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </Text>
                <Text flex='0 0 auto' color={levelColor[entry.level] || theme.colors.fgMuted} fontWeight='600' fontSize='10px' minW='36px' style={{ userSelect: 'none' }}>
                  {String(entry.level || 'info').toUpperCase()}
                </Text>
                <Text flex='0 0 auto' color={theme.colors.fgMuted} fontSize='10px' minW='60px' style={{ userSelect: 'none' }}>
                  [{entry.source}]
                </Text>
                <Text color={levelColor[entry.level] || theme.colors.fgDefault} flex='1'>
                  {entry.message}
                  {entry.detail ? (
                    <Text as='span' color={theme.colors.fgMuted}> — {entry.detail}</Text>
                  ) : null}
                </Text>
              </Flex>
            ))}
            <Box ref={endRef} />
          </Box>
        </Flex>
      ) : null}
    </Box>
  );
}

ConsoleDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  logs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    level: PropTypes.string,
    source: PropTypes.string,
    message: PropTypes.string,
    detail: PropTypes.string,
    timestamp: PropTypes.number,
  })).isRequired,
  filter: PropTypes.string.isRequired,
  autoScroll: PropTypes.bool.isRequired,
  endRef: PropTypes.shape({ current: PropTypes.any }),
  theme: PropTypes.shape({
    colors: PropTypes.shape({
      fgDefault: PropTypes.string,
      fgMuted: PropTypes.string,
      bgElevated: PropTypes.string,
      borderDefault: PropTypes.string,
      borderSubtle: PropTypes.string,
      bgPanel: PropTypes.string,
      bgSubtle: PropTypes.string,
    }).isRequired,
  }).isRequired,
  onFilterChange: PropTypes.func.isRequired,
  onAutoScrollToggle: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  onExport: PropTypes.func.isRequired,
};

let consoleLogIdCounter = 0;

function createConsoleLogId() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }

  consoleLogIdCounter += 1;
  return `log-${Date.now()}-${consoleLogIdCounter}`;
}

function useConsoleManager() {
  const [consoleLogs, setConsoleLogs] = React.useState([]);
  const [consoleOpen, setConsoleOpen] = React.useState(false);
  const [consoleAutoScroll, setConsoleAutoScroll] = React.useState(true);
  const [consoleFilter, setConsoleFilter] = React.useState('all');
  const [unreadErrors, setUnreadErrors] = React.useState(0);
  const consoleEndRef = React.useRef(null);
  const MAX_CONSOLE_ENTRIES = 500;

  const pushLog = React.useCallback((level, source, message, detail) => {
    const detailText = detail === undefined || detail === null ? undefined : String(detail);
    const entry = {
      id: createConsoleLogId(),
      level: String(level || 'info'),
      source: String(source || 'app'),
      message: String(message || ''),
      detail: detailText,
      timestamp: Date.now(),
    };
    setConsoleLogs(prev => {
      const next = [...prev, entry];
      return next.length > MAX_CONSOLE_ENTRIES ? next.slice(next.length - MAX_CONSOLE_ENTRIES) : next;
    });
    if (level === 'error' || level === 'warn') {
      setUnreadErrors(prev => prev + 1);
    }
  }, []);

  const exportConsoleLogs = React.useCallback(async () => {
    const api = globalThis.window?.sentinel?.console;
    if (!api || typeof api.export !== 'function') {
      pushLog('error', 'renderer', 'Console export is unavailable in this build.');
      return;
    }

    try {
      const result = await api.export({ entries: consoleLogs });
      if (result?.ok && result?.filePath) {
        pushLog('info', 'app', 'Console log export completed.', result.filePath);
        return;
      }
      if (!result?.canceled) {
        pushLog('warn', 'app', 'Console log export did not complete.');
      }
    } catch (error) {
      const message = error?.message ?? String(error);
      if (message.includes("No handler registered for 'console:export'")) {
        const downloaded = downloadConsoleLogs(consoleLogs);
        if (downloaded) {
          pushLog('warn', 'app', 'Console export handler unavailable. Downloaded log via renderer fallback.');
          return;
        }
      }
      pushLog('error', 'app', 'Console log export failed.', message);
    }
  }, [consoleLogs, pushLog]);

  React.useEffect(() => {
    if (consoleOpen && consoleAutoScroll) {
      consoleEndRef.current?.scrollIntoView?.({ block: 'end' });
    }
  }, [consoleLogs, consoleOpen, consoleAutoScroll]);

  React.useEffect(() => {
    if (consoleOpen) {
      setUnreadErrors(0);
    }
  }, [consoleOpen]);

  React.useEffect(() => {
    const api = globalThis.window?.sentinel?.console;
    if (!api || typeof api.onLog !== 'function') {
      return undefined;
    }
    const unsub = api.onLog(payload => {
      if (!payload) return;
      pushLog(payload.level, payload.source, payload.message, payload.detail);
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [pushLog]);

  React.useEffect(() => {
    const handleError = (event) => {
      const msg = event.message || event.error?.message || 'Unknown error';
      const detail = event.filename ? `${event.filename}:${event.lineno || 0}` : undefined;
      pushLog('error', 'renderer', msg, detail);
    };
    const handleRejection = (event) => {
      const reason = event.reason;
      const msg = reason instanceof Error ? reason.message : String(reason || 'Unhandled rejection');
      pushLog('error', 'renderer', msg);
    };
    globalThis.window.addEventListener('error', handleError);
    globalThis.window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      globalThis.window.removeEventListener('error', handleError);
      globalThis.window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [pushLog]);

  return {
    consoleLogs,
    setConsoleLogs,
    consoleOpen,
    setConsoleOpen,
    consoleAutoScroll,
    setConsoleAutoScroll,
    consoleFilter,
    setConsoleFilter,
    unreadErrors,
    consoleEndRef,
    pushLog,
    exportConsoleLogs,
  };
}

function useProxySettings(settingsOpen, pushLog) {
  const [proxyHeadersText, setProxyHeadersText] = React.useState('');
  const [proxyToolHeaderEnabled, setProxyToolHeaderEnabled] = React.useState(false);
  const [proxyToolHeaderName, setProxyToolHeaderName] = React.useState('X-Sentinel-Tool');
  const [proxyToolHeaderValue, setProxyToolHeaderValue] = React.useState('Gulp-Sentinel');
  const [proxyStaticIpsText, setProxyStaticIpsText] = React.useState('');
  const [proxySettingsLoading, setProxySettingsLoading] = React.useState(false);
  const [proxySettingsSaving, setProxySettingsSaving] = React.useState(false);

  const loadProxyRuntimeSettings = React.useCallback(async () => {
    const api = globalThis.window?.sentinel?.proxy?.config;
    if (!api || typeof api.get !== 'function') {
      return;
    }

    setProxySettingsLoading(true);
    try {
      const config = await api.get();
      const headersText = Object.entries(config?.customHeaders ?? {})
        .map(([name, value]) => `${name}: ${value}`)
        .join('\n');
      setProxyHeadersText(headersText);
      setProxyToolHeaderEnabled(Boolean(config?.toolIdentifier?.enabled));
      setProxyToolHeaderName(String(config?.toolIdentifier?.headerName ?? 'X-Sentinel-Tool'));
      setProxyToolHeaderValue(String(config?.toolIdentifier?.value ?? 'Gulp-Sentinel'));
      setProxyStaticIpsText(Array.isArray(config?.staticIpAddresses) ? config.staticIpAddresses.join('\n') : '');
    } catch (error) {
      pushLog('error', 'app', 'Failed to load proxy runtime settings.', error?.message ?? String(error));
    } finally {
      setProxySettingsLoading(false);
    }
  }, [pushLog]);

  const saveProxyRuntimeSettings = React.useCallback(async () => {
    const api = globalThis.window?.sentinel?.proxy?.config;
    if (!api || typeof api.set !== 'function') {
      pushLog('error', 'app', 'Proxy runtime settings are unavailable in this build.');
      return;
    }

    setProxySettingsSaving(true);
    try {
      const config = {
        customHeaders: parseHeadersText(proxyHeadersText),
        toolIdentifier: {
          enabled: proxyToolHeaderEnabled,
          headerName: proxyToolHeaderName,
          value: proxyToolHeaderValue,
        },
        staticIpAddresses: parseStaticIpsText(proxyStaticIpsText),
      };
      await api.set({ config });
      pushLog('info', 'app', 'Proxy runtime settings saved from Preferences.');
    } catch (error) {
      pushLog('error', 'app', 'Failed to save proxy runtime settings.', error?.message ?? String(error));
    } finally {
      setProxySettingsSaving(false);
    }
  }, [proxyHeadersText, proxyStaticIpsText, proxyToolHeaderEnabled, proxyToolHeaderName, proxyToolHeaderValue, pushLog]);

  React.useEffect(() => {
    if (settingsOpen) {
      loadProxyRuntimeSettings();
    }
  }, [settingsOpen, loadProxyRuntimeSettings]);

  return {
    proxyHeadersText,
    setProxyHeadersText,
    proxyToolHeaderEnabled,
    setProxyToolHeaderEnabled,
    proxyToolHeaderName,
    setProxyToolHeaderName,
    proxyToolHeaderValue,
    setProxyToolHeaderValue,
    proxyStaticIpsText,
    setProxyStaticIpsText,
    proxySettingsLoading,
    proxySettingsSaving,
    saveProxyRuntimeSettings,
  };
}

function useWorkspaceShortcuts(addPane, setCommandPaletteOpen, setSettingsOpen, setMemoryUsage) {
  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if (event.key === 'Escape') {
        setCommandPaletteOpen(false);
        setSettingsOpen(false);
      }
    };

    const handleNavigate = (event) => {
      const moduleName = event?.detail?.moduleName ?? '';
      if (moduleName && modules.includes(moduleName)) {
        addPane(moduleName);
      }
    };

    globalThis.window.addEventListener('keydown', handleKeyDown);
    globalThis.window.addEventListener('sentinel:navigate-module', handleNavigate);

    const timer = globalThis.window.setInterval(() => {
      setMemoryUsage(formatMemoryUsageMb());
    }, 2000);

    return () => {
      globalThis.window.removeEventListener('keydown', handleKeyDown);
      globalThis.window.removeEventListener('sentinel:navigate-module', handleNavigate);
      globalThis.window.clearInterval(timer);
    };
  }, [addPane, setCommandPaletteOpen, setSettingsOpen, setMemoryUsage]);
}

function useContextRailBehavior(contextCollapsed, contextRailContentRef, contextToggleButtonRef, quickActionButtonRefs, lastQuickActionIndexRef) {
  const contextRailScrollTopRef = React.useRef(0);
  const previousContextCollapsedRef = React.useRef(false);

  React.useEffect(() => {
    const wasCollapsed = previousContextCollapsedRef.current;

    if (contextCollapsed !== wasCollapsed) {
      if (contextCollapsed) {
        if (contextRailContentRef.current) {
          contextRailScrollTopRef.current = contextRailContentRef.current.scrollTop;
        }
        const activeElement = globalThis.document?.activeElement ?? null;
        if (
          activeElement &&
          contextRailContentRef.current?.contains(activeElement) &&
          contextToggleButtonRef.current
        ) {
          contextToggleButtonRef.current.focus();
        }
      } else {
        globalThis.window.requestAnimationFrame(() => {
          if (contextRailContentRef.current) {
            contextRailContentRef.current.scrollTop = contextRailScrollTopRef.current;
          }
          quickActionButtonRefs.current[lastQuickActionIndexRef.current]?.focus();
        });
      }
    }

    previousContextCollapsedRef.current = contextCollapsed;
  }, [contextCollapsed, contextRailContentRef, contextToggleButtonRef, quickActionButtonRefs, lastQuickActionIndexRef]);
}

class PanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Unknown panel render error',
    };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, info);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const panelName = this.props.panelName || 'panel';
    return (
      <Flex h='100%' w='100%' align='center' justify='center' p='6'>
        <VStack maxW='640px' spacing='3' align='stretch' borderWidth='1px' borderColor='border.default' borderRadius='sm' bg='bg.panel' p='4'>
          <Text fontWeight='semibold'>Unable to render {panelName}</Text>
          <Text fontSize='sm' color='fg.muted'>The panel hit a runtime error. Use Reload Pane to remount this view.</Text>
          <Code fontSize='xs' whiteSpace='pre-wrap' color='fg.default' bg='bg.subtle'>{this.state.message}</Code>
          <HStack justify='flex-end'>
            <Button size='xs' onClick={this.handleReload}>Reload Pane</Button>
          </HStack>
        </VStack>
      </Flex>
    );
  }
}

PanelErrorBoundary.propTypes = {
  children: PropTypes.node,
  panelName: PropTypes.string,
  onError: PropTypes.func,
};

// eslint-disable-next-line sonarjs/cognitive-complexity
function App() {
  const [sidebarExpanded, setSidebarExpanded] = React.useState(false);
  const [openPanes, setOpenPanes] = React.useState(['Dashboard', 'Proxy']);
  const [activePane, setActivePane] = React.useState('Dashboard');
  const [proxyRunning, setProxyRunning] = React.useState(true);
  const [panelStatus] = React.useState(defaultPanelStatus);
  const [contextCollapsed, setContextCollapsed] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [commandQuery, setCommandQuery] = React.useState('');
  const [memoryUsage, setMemoryUsage] = React.useState(formatMemoryUsageMb());
  const [selectedThemeId, setSelectedThemeId] = React.useState(getInitialThemeId);
  const selectedTheme = THEME_REGISTRY[selectedThemeId] || FALLBACK_THEME;
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const contextToggleButtonRef = React.useRef(null);
  const contextRailContentRef = React.useRef(null);
  const quickActionButtonRefs = React.useRef([]);
  const lastQuickActionIndexRef = React.useRef(null);

  const {
    consoleLogs,
    setConsoleLogs,
    consoleOpen,
    setConsoleOpen,
    consoleAutoScroll,
    setConsoleAutoScroll,
    consoleFilter,
    setConsoleFilter,
    unreadErrors,
    consoleEndRef,
    pushLog,
    exportConsoleLogs,
  } = useConsoleManager();

  const {
    proxyHeadersText,
    setProxyHeadersText,
    proxyToolHeaderEnabled,
    setProxyToolHeaderEnabled,
    proxyToolHeaderName,
    setProxyToolHeaderName,
    proxyToolHeaderValue,
    setProxyToolHeaderValue,
    proxyStaticIpsText,
    setProxyStaticIpsText,
    proxySettingsLoading,
    proxySettingsSaving,
    saveProxyRuntimeSettings,
  } = useProxySettings(settingsOpen, pushLog);

  const versions = globalThis.window?.electronInfo?.versions ?? {};

  const addPane = React.useCallback((moduleName) => {
    setOpenPanes((prev) => {
      if (prev.includes(moduleName)) {
        return prev;
      }
      return [...prev, moduleName];
    });
    setActivePane(moduleName);
  }, []);

  const closePane = React.useCallback((moduleName) => {
    setOpenPanes((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      const next = prev.filter((pane) => pane !== moduleName);
      if (activePane === moduleName) {
        setActivePane(next[next.length - 1]);
      }
      return next;
    });
  }, [activePane]);

  React.useEffect(() => {
    applyThemeToDocument(selectedThemeId);
  }, [selectedThemeId]);

  useWorkspaceShortcuts(addPane, setCommandPaletteOpen, setSettingsOpen, setMemoryUsage);

  const filteredCommands = modules.filter((moduleName) => {
    const query = String(commandQuery || '').trim().toLowerCase();
    if (!query) {
      return true;
    }
    return moduleName.toLowerCase().includes(query) || String(moduleDescriptions[moduleName] || '').toLowerCase().includes(query);
  });

  const contextQuickActions = React.useMemo(() => ([
    {
      id: 'open-command-palette',
      label: 'Open Command Palette',
      description: 'Search modules and commands instantly.',
      run: () => setCommandPaletteOpen(true)
    },
    {
      id: 'jump-proxy',
      label: 'Jump to Proxy',
      description: 'Review intercept queue and routing state.',
      run: () => addPane('Proxy')
    },
    {
      id: 'jump-history',
      label: 'Jump to History',
      description: 'Inspect captured traffic and replay handoff.',
      run: () => addPane('History')
    },
    {
      id: 'jump-scanner',
      label: 'Jump to Scanner',
      description: 'Review active scans and finding severity.',
      run: () => addPane('Scanner')
    },
    {
      id: 'toggle-engine',
      label: proxyRunning ? 'Pause Engine' : 'Resume Engine',
      description: 'Toggle proxy runtime without leaving the workspace.',
      run: () => setProxyRunning((prev) => !prev)
    }
  ]), [addPane, proxyRunning]);

  const focusQuickAction = React.useCallback((index) => {
    const total = contextQuickActions.length;
    if (total) {
      const wrapped = (index + total) % total;
      quickActionButtonRefs.current[wrapped]?.focus();
    }
  }, [contextQuickActions.length]);

  const handleQuickActionKeyDown = React.useCallback((event, index) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusQuickAction(index + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusQuickAction(index - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusQuickAction(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusQuickAction(contextQuickActions.length - 1);
    }
  }, [contextQuickActions.length, focusQuickAction]);

  useContextRailBehavior(
    contextCollapsed,
    contextRailContentRef,
    contextToggleButtonRef,
    quickActionButtonRefs,
    lastQuickActionIndexRef
  );

  const ActivePanel = modulePanels[activePane] || DashboardShell;
  const activeTheme = selectedTheme;
  const shellCodeProps = {
    bg: 'bg.surface',
    color: 'fg.default',
    borderWidth: '1px',
    borderColor: 'border.default',
    borderRadius: 'sm',
    px: '1.5',
    py: '0.5',
    fontSize: 'xs',
    fontFamily: 'mono'
  };
  const settingsOverlayScrim = getOverlayScrim(selectedThemeId);

  const commandPaletteOverlayScrim = getOverlayScrim(selectedThemeId);

  return (
    <Flex h='100vh' overflow='hidden' bg='bg.canvas' color='fg.default' direction='row' fontFamily='body'>

      {/* Left Activity Bar */}
      <VStack
        w={sidebarExpanded ? '220px' : '60px'}
        minW={sidebarExpanded ? '220px' : '60px'}
        bg='bg.elevated'
        borderRightWidth='1px'
        borderColor='border.default'
        py='3'
        gap='1'
        align='stretch'
        overflowY='auto'
        overflowX='hidden'
        transition='width 0.2s ease, min-width 0.2s ease'
      >
        <Button
          size='sm'
          variant='ghost'
          color='fg.muted'
          _hover={{ bg: 'bg.surface', color: 'fg.default' }}
          mx={sidebarExpanded ? '2' : '0'}
          minW='0'
          h='40px'
          justifyContent={sidebarExpanded ? 'flex-start' : 'center'}
          onClick={() => setSidebarExpanded((prev) => !prev)}
          aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <HStack gap='2' w='100%' justify={sidebarExpanded ? 'flex-start' : 'center'}>
            {sidebarExpanded ? <FiChevronsLeft size={16} /> : <FiChevronsRight size={16} />}
            {sidebarExpanded ? <Text fontSize='sm'>Modules</Text> : null}
          </HStack>
        </Button>
        {modules.map((moduleName) => {
          const IconComp = moduleIcons[moduleName] || FiPackage;
          const isActive = activePane === moduleName;
          const proxyStatusBg = proxyRunning ? 'green.400' : 'orange.400';
          return (
            <Box key={moduleName} position='relative' mx={sidebarExpanded ? '2' : '0'}>
              <Button
                size='sm'
                variant='ghost'
                color={isActive ? 'fg.default' : 'fg.muted'}
                bg={isActive ? 'bg.subtle' : 'transparent'}
                _hover={{ bg: 'bg.surface', color: 'fg.default' }}
                opacity={isActive ? 1 : 0.88}
                w={sidebarExpanded ? '100%' : '44px'}
                h='44px'
                px={sidebarExpanded ? '3' : '0'}
                minW='0'
                onClick={() => addPane(moduleName)}
                aria-label={moduleName}
                title={`${moduleName}: ${moduleDescriptions[moduleName] || ''}`}
                borderRadius='md'
                justifyContent={sidebarExpanded ? 'flex-start' : 'center'}
              >
                <HStack gap='2'>
                  <IconComp size={18} />
                  {sidebarExpanded ? <Text fontSize='sm'>{moduleName}</Text> : null}
                </HStack>
              </Button>
              {moduleName === 'Proxy' ? (
                <Box
                  position='absolute'
                  top='6px'
                  right={sidebarExpanded ? '8px' : '4px'}
                  w='7px'
                  h='7px'
                  borderRadius='full'
                  bg={proxyStatusBg}
                  pointerEvents='none'
                />
              ) : null}
            </Box>
          );
        })}
      </VStack>

      {/* Main content column */}
      <Flex flex='1' direction='column' overflow='hidden'>
        <Box borderBottomWidth='1px' borderColor='border.default' bg='bg.elevated'>
          <Flex px='4' py='3' justify='space-between' align='center' gap='4'>
            <Box>
              <Heading size='sm' fontFamily='heading' letterSpacing='0.01em'>Sentinel Workspace</Heading>
              <Text fontSize='sm' color='fg.muted' fontFamily='body'>Workbench shell for concurrent security workflows.</Text>
            </Box>
            <HStack gap='3' wrap='wrap' justify='flex-end'>
              <Badge 
                variant='outline' 
                color='fg.default'
                borderColor='border.default'
                bg='bg.surface'
              >
                <HStack gap='1'>
                  <Box w='6px' h='6px' borderRadius='full' bg={proxyRunning ? 'green.400' : 'orange.400'} />
                  <Text fontSize='xs'>Proxy {proxyRunning ? 'running' : 'paused'}</Text>
                </HStack>
              </Badge>
              <Button size='xs' variant='outline' color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }} onClick={() => setSettingsOpen(true)}>
                <HStack gap='1'>
                  <FiSettings size={12} />
                  <Text fontSize='xs'>Settings</Text>
                </HStack>
              </Button>
              <Text fontSize='xs' color='fg.default' fontFamily='body'>Project <Code {...shellCodeProps}>sentinel-dev</Code></Text>
              <Text fontSize='xs' color='fg.default' fontFamily='body'>Electron <Code {...shellCodeProps}>{versions.electron || 'unknown'}</Code></Text>
              <Button size='xs' variant='outline' onClick={() => setProxyRunning((prev) => !prev)}>
                {proxyRunning ? 'Pause' : 'Resume'}
              </Button>
              <Button size='xs' variant='outline' onClick={() => setCommandPaletteOpen(true)} title='Command palette'>
                Ctrl+K
              </Button>
            </HStack>
          </Flex>
        </Box>

        <Flex flex='1' direction='column' overflow='hidden'>
          <Flex px='3' py='2' align='center' gap='2' borderBottomWidth='1px' borderColor='border.default' bg='bg.panel'>
            <HStack gap='2' flex='1' overflowX='auto'>
              {openPanes.map((pane) => (
                <HStack key={pane} gap='1' flex='0 0 auto'>
                  <Button
                    size='sm'
                    variant={activePane === pane ? 'solid' : 'outline'}
                    color={activePane === pane ? 'fg.default' : 'fg.muted'}
                    bg={activePane === pane ? 'bg.subtle' : 'transparent'}
                    borderColor={activePane === pane ? 'transparent' : 'border.default'}
                    _hover={{ bg: 'bg.surface', color: 'fg.default' }}
                    onClick={() => setActivePane(pane)}
                  >
                    {pane}
                  </Button>
                  {openPanes.length > 1 ? (
                    <Button size='xs' variant='ghost' aria-label={`Close ${pane} pane`} onClick={() => closePane(pane)}>
                      ×
                    </Button>
                  ) : null}
                </HStack>
              ))}
            </HStack>
            <Button ref={contextToggleButtonRef} size='xs' variant='outline' onClick={() => setContextCollapsed((prev) => !prev)}>
              {contextCollapsed ? 'Show Context' : 'Hide Context'}
            </Button>
          </Flex>

          <Flex flex='1' overflow='hidden' p='3' gap='3'>
            <Box flex='1' minW='0' h='100%' borderWidth='1px' borderColor='border.subtle' borderRadius='sm' bg='bg.surface' overflow='hidden'>
              <PanelErrorBoundary
                key={activePane}
                panelName={activePane}
                onError={(error, info) => {
                  const detail = [error?.stack, info?.componentStack].filter(Boolean).join('\n');
                  pushLog('error', 'renderer', `Module pane crashed: ${activePane}`, detail || error?.message || 'Unknown panel error');
                }}
              >
                <ActivePanel themeId={selectedThemeId} />
              </PanelErrorBoundary>
            </Box>

            <Box
              w={contextCollapsed ? '0px' : '320px'}
              minW={contextCollapsed ? '0px' : '320px'}
              opacity={contextCollapsed ? 0 : 1}
              transform={contextCollapsed ? 'translateX(20px)' : 'translateX(0px)'}
              transition='width 0.22s ease, min-width 0.22s ease, opacity 0.22s ease, transform 0.22s ease'
              overflow='hidden'
              pointerEvents={contextCollapsed ? 'none' : 'auto'}
              aria-hidden={contextCollapsed}
              bg='bg.elevated'
              borderLeftWidth={contextCollapsed ? '0px' : '1px'}
              borderColor='border.default'
            >
              <VStack ref={contextRailContentRef} w='320px' minW='320px' align='stretch' gap='3' overflowY='auto' overflowX='hidden' p='3'>
                <Box p='4' borderWidth='1px' borderColor='border.default' borderRadius='sm' bg='bg.panel'>
                  <Text fontWeight='semibold' mb='2' fontSize='sm' fontFamily='heading' color='fg.default'>Active Context</Text>
                  <Text fontSize='sm' mb='2' fontFamily='body' color='fg.muted'>Pane <Code {...shellCodeProps}>{activePane}</Code></Text>
                  {(panelStatusFields[activePane] || []).map((field) => (
                    <Text key={field.key} fontSize='sm' fontFamily='body' color='fg.muted'>
                      {field.label}: <Code {...shellCodeProps}>{String(panelStatus[activePane]?.[field.key] ?? '\u2014')}</Code>
                    </Text>
                  ))}
                </Box>
                <Box p='4' borderWidth='1px' borderColor='border.default' borderRadius='sm' bg='bg.panel'>
                  <Text fontWeight='semibold' mb='2' fontSize='sm' fontFamily='heading' color='fg.default'>Quick Actions</Text>
                  <Stack gap='2'>
                    {contextQuickActions.map((action, index) => (
                      <Button
                        key={action.id}
                        ref={(node) => {
                          quickActionButtonRefs.current[index] = node;
                        }}
                        size='sm'
                        justifyContent='flex-start'
                        variant='outline'
                        color='fg.default'
                        bg='bg.surface'
                        _hover={{ bg: 'bg.subtle' }}
                        onClick={action.run}
                        onFocus={() => {
                          lastQuickActionIndexRef.current = index;
                        }}
                        onKeyDown={(event) => handleQuickActionKeyDown(event, index)}
                      >
                        <Box textAlign='left'>
                          <Text fontSize='sm' fontFamily='body'>{action.label}</Text>
                          <Text fontSize='xs' color='fg.muted' fontFamily='body'>{action.description}</Text>
                        </Box>
                      </Button>
                    ))}
                  </Stack>
                </Box>
              </VStack>
            </Box>
          </Flex>

          {/* Console Drawer */}
          <ConsoleDrawer
            isOpen={consoleOpen}
            logs={consoleLogs}
            filter={consoleFilter}
            autoScroll={consoleAutoScroll}
            endRef={consoleEndRef}
            theme={selectedTheme}
            onFilterChange={setConsoleFilter}
            onAutoScrollToggle={() => setConsoleAutoScroll(prev => !prev)}
            onClear={() => setConsoleLogs([])}
            onExport={exportConsoleLogs}
          />

          <Flex px='3' py='2' borderTopWidth='1px' borderColor='border.default' bg='bg.elevated' justify='space-between' align='center' fontSize='xs' fontFamily='body'>
            <HStack gap='3'>
              <Text>Engine <Code {...shellCodeProps}>{proxyRunning ? 'running' : 'paused'}</Code></Text>
              <Text>Tabs <Code {...shellCodeProps}>{openPanes.length}</Code></Text>
              <Text>Scope <Code {...shellCodeProps}>in-scope-only</Code></Text>
            </HStack>
            <HStack gap='3'>
              <Button
                size='xs'
                variant='ghost'
                color={selectedTheme.colors.fgMuted}
                _hover={{ bg: selectedTheme.colors.bgSubtle }}
                onClick={() => setConsoleOpen(prev => !prev)}
                title={consoleOpen ? 'Hide console' : 'Show console'}
              >
                <HStack gap='1'>
                  <FiTerminal size={12} />
                  <Text fontSize='xs'>Console</Text>
                  {unreadErrors > 0 && !consoleOpen ? (
                    <Badge colorPalette='red' size='xs'>{unreadErrors}</Badge>
                  ) : null}
                  {consoleOpen ? <FiChevronDown size={12} /> : <FiChevronUp size={12} />}
                </HStack>
              </Button>
              <Text>Memory <Code {...shellCodeProps}>{memoryUsage}</Code></Text>
              <Text>Node <Code {...shellCodeProps}>{versions.node || 'unknown'}</Code></Text>
              <Text>Electron <Code {...shellCodeProps}>{versions.electron || 'unknown'}</Code></Text>
            </HStack>
          </Flex>
        </Flex>
      </Flex>

      {settingsOpen ? (
        <Flex
          position='fixed'
          inset='0'
          bg={settingsOverlayScrim}
          justify='flex-end'
          zIndex='1050'
          role='presentation'
          onClick={() => setSettingsOpen(false)}
        >
          <Box
            w='380px'
            maxW='calc(100vw - 24px)'
            h='100%'
            bg='bg.panel'
            borderLeftWidth='1px'
            borderColor='border.default'
            px='4'
            py='4'
            overflowY='auto'
            onClick={(event) => event.stopPropagation()}
            role='dialog'
            aria-modal='true'
            aria-label='Preferences'
          >
            <Flex justify='space-between' align='flex-start' mb='4' gap='3'>
              <Box>
                <Heading size='sm'>Preferences</Heading>
                <Text fontSize='sm' color='fg.muted' mt='1'>
                  Theme options apply across shell surfaces, panel controls, status messages, and overlays.
                </Text>
              </Box>
              <Button size='xs' variant='ghost' onClick={() => setSettingsOpen(false)}>
                Close
              </Button>
            </Flex>

            <Box borderWidth='1px' borderColor='border.default' borderRadius='sm' bg='bg.surface' p='3'>
              <Text fontWeight='semibold' fontSize='sm'>Theme Options</Text>
              <Text fontSize='xs' color='fg.muted' mt='1'>
                Active theme <Code>{activeTheme.label}</Code>
              </Text>

              <VStack align='stretch' gap='4' mt='4'>
                {THEME_GROUPS.map((group) => (
                  <Box key={group.id}>
                    <Text fontSize='xs' color='fg.muted' textTransform='uppercase' letterSpacing='wider' mb='2'>
                      {group.label}
                    </Text>
                    <VStack align='stretch' gap='2'>
                      {Object.entries(THEME_REGISTRY)
                        .filter(([, theme]) => theme.group === group.id)
                        .map(([themeId, theme]) => (
                          <Button
                            key={themeId}
                            variant={selectedThemeId === themeId ? 'solid' : 'outline'}
                            justifyContent='space-between'
                            h='auto'
                            py='3'
                            px='3'
                            onClick={() => setSelectedThemeId(themeId)}
                            aria-pressed={selectedThemeId === themeId}
                          >
                            <Box textAlign='left'>
                              <Text fontSize='sm' fontWeight='semibold'>{theme.label}</Text>
                              <Text fontSize='xs' color={selectedThemeId === themeId ? 'fg.default' : 'fg.muted'}>
                                {theme.description}
                              </Text>
                            </Box>
                            <HStack gap='1' flexShrink='0'>
                              <Box w='10px' h='10px' borderRadius='full' bg={theme.colors.bgCanvas} borderWidth='1px' borderColor={theme.colors.borderDefault} />
                              <Box w='10px' h='10px' borderRadius='full' bg={theme.colors.bgSurface} borderWidth='1px' borderColor={theme.colors.borderDefault} />
                              <Box w='10px' h='10px' borderRadius='full' bg={theme.colors.fgDefault} borderWidth='1px' borderColor={theme.colors.borderDefault} />
                            </HStack>
                          </Button>
                        ))}
                    </VStack>
                  </Box>
                ))}
              </VStack>
            </Box>

            <Box borderWidth='1px' borderColor='border.default' borderRadius='sm' bg='bg.surface' p='3' mt='4'>
              <Flex justify='space-between' align='center' mb='2' gap='2'>
                <Text fontWeight='semibold' fontSize='sm'>Proxy Runtime Settings</Text>
                <Button size='xs' variant='outline' onClick={saveProxyRuntimeSettings} loading={proxySettingsSaving} disabled={proxySettingsLoading}>
                  Save
                </Button>
              </Flex>
              <Text fontSize='xs' color='fg.muted' mb='2'>
                Configure global headers, tool identifier header, and static source IP pool for outbound proxy traffic.
              </Text>

              <VStack align='stretch' gap='2'>
                <Text fontSize='xs' color='fg.muted'>Custom headers (one per line: <Code>Header-Name: value</Code>)</Text>
                <Textarea
                  size='sm'
                  minH='80px'
                  value={proxyHeadersText}
                  onChange={(event) => setProxyHeadersText(event.target.value)}
                  placeholder={'X-Customer-ID: acme\nX-Environment: production'}
                  fontFamily='mono'
                  disabled={proxySettingsLoading || proxySettingsSaving}
                  color='fg.default'
                  bg='bg.surface'
                  borderColor='border.default'
                  _placeholder={{ color: 'fg.muted' }}
                />

                <HStack align='center' gap='2' wrap='wrap'>
                  <Button
                    size='xs'
                    variant={proxyToolHeaderEnabled ? 'solid' : 'outline'}
                    onClick={() => setProxyToolHeaderEnabled(prev => !prev)}
                    disabled={proxySettingsLoading || proxySettingsSaving}
                  >
                    {proxyToolHeaderEnabled ? 'Tool Header Enabled' : 'Tool Header Disabled'}
                  </Button>
                  <Input
                    size='sm'
                    value={proxyToolHeaderName}
                    onChange={(event) => setProxyToolHeaderName(event.target.value)}
                    placeholder='Header name'
                    maxW='170px'
                    fontFamily='mono'
                    disabled={proxySettingsLoading || proxySettingsSaving}
                    color='fg.default'
                    bg='bg.surface'
                    borderColor='border.default'
                    _placeholder={{ color: 'fg.muted' }}
                  />
                  <Input
                    size='sm'
                    value={proxyToolHeaderValue}
                    onChange={(event) => setProxyToolHeaderValue(event.target.value)}
                    placeholder='Header value'
                    maxW='170px'
                    fontFamily='mono'
                    disabled={proxySettingsLoading || proxySettingsSaving}
                    color='fg.default'
                    bg='bg.surface'
                    borderColor='border.default'
                    _placeholder={{ color: 'fg.muted' }}
                  />
                </HStack>

                <Text fontSize='xs' color='fg.muted'>Static source IPs (one per line or comma-separated; rotated per request)</Text>
                <Textarea
                  size='sm'
                  minH='64px'
                  value={proxyStaticIpsText}
                  onChange={(event) => setProxyStaticIpsText(event.target.value)}
                  placeholder={'192.0.2.10\n192.0.2.11'}
                  fontFamily='mono'
                  disabled={proxySettingsLoading || proxySettingsSaving}
                  color='fg.default'
                  bg='bg.surface'
                  borderColor='border.default'
                  _placeholder={{ color: 'fg.muted' }}
                />
              </VStack>
            </Box>
          </Box>
        </Flex>
      ) : null}

      {commandPaletteOpen ? (
        <Flex
          position='fixed'
          inset='0'
          bg={commandPaletteOverlayScrim}
          align='flex-start'
          justify='center'
          pt='16'
          zIndex='1000'
          role='presentation'
        >
          <Box
            w='560px'
            maxW='calc(100vw - 32px)'
            borderWidth='1px'
            borderColor='border.default'
            borderRadius='sm'
            bg='bg.panel'
            p='3'
            role='dialog'
            aria-modal='true'
            aria-label='Command palette'
          >
            <Input
              autoFocus
              placeholder='Jump to module...'
              aria-label='Search modules'
              value={commandQuery}
              onChange={(event) => setCommandQuery(event.target.value)}
              mb='3'
              color='fg.default'
              bg='bg.surface'
              borderColor='border.default'
              _placeholder={{ color: 'fg.muted' }}
            />
            <Stack gap='2' maxH='320px' overflowY='auto'>
              {filteredCommands.map((moduleName) => (
                <Button
                  key={moduleName}
                  justifyContent='flex-start'
                  variant='ghost'
                  onClick={() => {
                    addPane(moduleName);
                    setCommandQuery('');
                    setCommandPaletteOpen(false);
                  }}
                >
                  <Box textAlign='left'>
                    <Text>{moduleName}</Text>
                    <Text fontSize='xs' color='fg.muted'>{moduleDescriptions[moduleName]}</Text>
                  </Box>
                </Button>
              ))}
              {filteredCommands.length === 0 ? (
                <Text fontSize='sm' color='fg.muted'>No modules matched your search.</Text>
              ) : null}
            </Stack>
          </Box>
        </Flex>
      ) : null}
    </Flex>
  );
}

export default App;

\\n
## File: src\renderer\js\components\sentinel\DashboardShell.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Code, Flex, Grid, Heading, Text, VStack } from '@chakra-ui/react';

// Reusable metric card widget for the 3-column dashboard grid.
function MetricWidget(props) {
	const { title, metrics } = props;

	return (
		<Box p='4' borderWidth='1px' borderColor='border.default' borderRadius='sm' bg='bg.panel' h='100%'>
			<Text fontWeight='semibold' mb='3' fontSize='xs' color='fg.default' textTransform='uppercase' letterSpacing='wider'>
				{title}
			</Text>
			<VStack align='stretch' gap='2'>
				{metrics.map(({ label, value }) => (
					<Flex key={label} justify='space-between' align='center'>
						<Text fontSize='sm' color='fg.muted'>{label}</Text>
						<Code fontSize='sm' color='fg.default' bg='bg.subtle'>{String(value)}</Code>
					</Flex>
				))}
			</VStack>
		</Box>
	);
}

MetricWidget.propTypes = {
	title: PropTypes.string.isRequired,
	metrics: PropTypes.arrayOf(
		PropTypes.shape({
			label: PropTypes.string.isRequired,
			value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
		})
	).isRequired,
};

function DashboardShell() {
	const [guidance, setGuidance] = React.useState(null);
	const [guidanceOpen, setGuidanceOpen] = React.useState(false);

	// Live metric state — populated on mount and updated via push subscriptions.
	const [requestTotal, setRequestTotal] = React.useState(0);
	const [scopeEntries, setScopeEntries] = React.useState(0);
	const [discoveredHosts, setDiscoveredHosts] = React.useState(0);
	const [findingsTotal, setFindingsTotal] = React.useState(0);
	const [findingsCritical, setFindingsCritical] = React.useState(0);

	React.useEffect(() => {
		let cancelled = false;

		async function loadGuidance() {
			const sentinel = globalThis.window?.sentinel;
			if (typeof sentinel?.ca?.trustGuidance !== 'function') {
				return;
			}

			try {
				const payload = await sentinel.ca.trustGuidance();
				if (!cancelled && payload?.guidance) {
					setGuidance(payload.guidance);
				}
			} catch {
				// Guidance is optional in early boot and should not break dashboard render.
			}
		}

		loadGuidance();
		return () => {
			cancelled = true;
		};
	}, []);

	React.useEffect(() => {
		const sentinel = globalThis.window?.sentinel ?? null;
		if (sentinel == null) {
			return undefined;
		}

		let cancelled = false;

		async function loadMetrics() {
			try {
				const [historyResult, scopeResult, sitemapResult] = await Promise.all([
					sentinel.history.query({ page: 0, pageSize: 1 }),
					sentinel.scope.get(),
					sentinel.target.sitemap(),
				]);
				if (cancelled) {
					return;
				}
				if (typeof historyResult?.total === 'number') {
					setRequestTotal(historyResult.total);
				}
				if (Array.isArray(scopeResult?.rules)) {
					setScopeEntries(scopeResult.rules.length);
				}
				if (Array.isArray(sitemapResult?.tree)) {
					setDiscoveredHosts(sitemapResult.tree.length);
				}
			} catch {
				// Metric load failure is non-fatal; leave values at their defaults.
			}
		}

		loadMetrics();

		const unsubHistory = sentinel.history.onPush(() => {
			if (cancelled) {
				return;
			}
			setRequestTotal(prev => prev + 1);
		});

		const unsubScanner = sentinel.scanner.onProgress((payload) => {
			if (cancelled || payload?.finding == null) {
				return;
			}
			setFindingsTotal(prev => prev + 1);
			if (String(payload.finding.severity ?? '').toLowerCase() === 'critical') {
				setFindingsCritical(prev => prev + 1);
			}
		});

		return () => {
			cancelled = true;
			unsubHistory();
			unsubScanner();
		};
	}, []);

	const securityMetrics = [
		{ label: 'Critical findings', value: findingsCritical },
		{ label: 'Open issues', value: findingsTotal },
		{ label: 'Active sessions', value: 0 }
	];

	const trafficMetrics = [
		{ label: 'Requests captured', value: requestTotal },
		{ label: 'Visible (filtered)', value: requestTotal },
		{ label: 'Active filter', value: 'None' }
	];

	const targetMetrics = [
		{ label: 'Discovered hosts', value: discoveredHosts },
		{ label: 'Scope entries', value: scopeEntries },
		{ label: 'Scope mode', value: 'in-scope-only' }
	];

	return (
		<Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' bg='bg.canvas' color='fg.default'>
			<Heading size='sm' mb='4' color='fg.default'>Dashboard</Heading>
			<Grid templateColumns='repeat(3, 1fr)' gap='4' mb='4'>
				<MetricWidget title='Security Metrics' metrics={securityMetrics} />
				<MetricWidget title='Recent Traffic' metrics={trafficMetrics} />
				<MetricWidget title='Target Discovery' metrics={targetMetrics} />
			</Grid>

			{guidance ? (
				<Box borderWidth='1px' borderColor='border.default' borderRadius='sm' bg='bg.surface' overflow='hidden'>
					<Flex
						px='4'
						py='3'
						justify='space-between'
						align='center'
						borderBottomWidth={guidanceOpen ? '1px' : '0'}
						borderColor='border.default'
					>
						<Text fontWeight='semibold' fontSize='sm' color='fg.default'>CA Trust Guidance</Text>
						<Button size='xs' variant='outline' onClick={() => setGuidanceOpen((prev) => !prev)}>
							{guidanceOpen ? 'Hide' : 'Show'}
						</Button>
					</Flex>
					{guidanceOpen ? (
						<Box px='4' py='3'>
							<Text fontSize='sm' color='fg.default' mb='1'>{guidance.title}</Text>
							<Text fontSize='sm' mb='1'>Certificate path: <Code color='fg.default' bg='bg.subtle'>{guidance.certPathHint}</Code></Text>
							{guidance.steps.slice(0, 2).map((step, index) => (
								<Text key={`${index}-${step}`} fontSize='sm' color='fg.default'>
									{index + 1}. {step}
								</Text>
							))}
							{guidance.steps.length > 2 ? (
								<Text fontSize='sm' color='fg.muted' mt='2'>
									+{guidance.steps.length - 2} more steps — see full guidance in documentation.
								</Text>
							) : null}
						</Box>
					) : null}
				</Box>
			) : null}
		</Box>
	);
}

export default DashboardShell;

\\n
## File: src\renderer\js\components\sentinel\DecoderPanel.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Input,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

const availableOps = [
  'base64:encode',
  'base64:decode',
  'url:encode',
  'url:decode',
  'html:encode',
  'html:decode',
  'hex:encode',
  'hex:decode',
  'gzip:encode',
  'gzip:decode',
];

function createOperationEntry(op, idCounterRef) {
  const nextId = `op-${idCounterRef.current}`;
  idCounterRef.current += 1;
  return {
    id: nextId,
    op,
  };
}

function DecoderPanel({ themeId }) {
  const operationIdCounterRef = React.useRef(1);
  const [input, setInput] = React.useState('');
  const [operations, setOperations] = React.useState(() => [createOperationEntry('base64:decode', operationIdCounterRef)]);
  const [recursiveDepth, setRecursiveDepth] = React.useState('1');
  const [reverse, setReverse] = React.useState(false);
  const [result, setResult] = React.useState('');
  const [steps, setSteps] = React.useState([]);
  const [errorText, setErrorText] = React.useState('');

  async function runDecoder() {
      const sentinel = globalThis.window?.sentinel;
      if (!sentinel?.decoder) {
      return;
    }

    setErrorText('');
    try {
      const payload = await sentinel.decoder.process({
        input,
        operations: operations.map(item => item.op),
        reverse,
        recursiveDepth: Number(recursiveDepth) || 1,
      });

      setResult(String(payload?.result ?? ''));
      setSteps(Array.isArray(payload?.detailedSteps) ? payload.detailedSteps : []);
    } catch (error) {
      setErrorText(error?.message ?? 'Unable to process decoder chain.');
    }
  }

  function updateOperation(index, op) {
    setOperations(prev => prev.map((current, currentIndex) => (currentIndex === index
      ? { ...current, op }
      : current)));
  }

  function addOperation(op) {
    setOperations(prev => [...prev, createOperationEntry(op, operationIdCounterRef)]);
  }

  function removeOperation(index) {
    setOperations(prev => prev.filter((_item, currentIndex) => currentIndex !== index));
  }

  return (
    <Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.panel' color='fg.default'>
      <VStack align='stretch' spacing={3}>
        <Flex justify='space-between' align='center' pb='3' borderBottomWidth='1px' borderColor='border.default'>
          <Text fontWeight='medium' fontSize='sm'>Decoder</Text>
          <HStack gap='2'>
            <Button size='xs' variant='outline' onClick={runDecoder}>Run</Button>
          </HStack>
        </Flex>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2}>Input</Text>
          <Textarea
            rows={7}
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder='Paste encoded/decoded text here...'
            color='fg.default'
            bg='bg.surface'
            borderColor='border.default'
            _placeholder={{ color: 'fg.muted' }}
          />
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm'>Operation Chain</Text>
            <Code color='fg.default' bg='bg.subtle'>{operations.length} steps</Code>
          </HStack>

          {operations.map((operation, index) => (
            <HStack key={operation.id} mb={2}>
              <Code minW='80px' color='fg.default' bg='bg.subtle'>{index + 1}</Code>
              <Input
                value={operation.op}
                onChange={event => updateOperation(index, event.target.value)}
                placeholder='operation'
                color='fg.default'
                bg='bg.surface'
                borderColor='border.default'
                _placeholder={{ color: 'fg.muted' }}
              />
              <Button size='xs' variant='ghost' onClick={() => removeOperation(index)} disabled={operations.length <= 1}>Remove</Button>
            </HStack>
          ))}

          <HStack wrap='wrap' mt={2}>
            {availableOps.map(op => (
              <Button key={op} size='xs' variant='outline' onClick={() => addOperation(op)}>{op}</Button>
            ))}
          </HStack>

          <HStack mt={3}>
            <Input
              maxW='180px'
              value={recursiveDepth}
              onChange={event => setRecursiveDepth(event.target.value)}
              placeholder='recursive depth'
              color='fg.default'
              bg='bg.surface'
              borderColor='border.default'
              _placeholder={{ color: 'fg.muted' }}
            />
            <Button size='sm' variant={reverse ? 'solid' : 'outline'} onClick={() => setReverse(prev => !prev)}>
              Reverse Chain
            </Button>
            <Button size='sm' colorPalette='blue' onClick={runDecoder}>Run</Button>
          </HStack>
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2}>Output</Text>
          <Textarea
            rows={7}
            value={result}
            readOnly
            color='fg.default'
            bg='bg.surface'
            borderColor='border.default'
          />
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2}>Intermediate Steps</Text>
          {steps.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>Run a chain to see intermediate outputs.</Text>
          ) : steps.map((step, index) => (
            <Box key={`${step.pass}-${step.operation}-${String(step.input ?? '').slice(0, 16)}-${String(step.output ?? '').slice(0, 16)}`} borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.panel' p={2} mb={2}>
              <Text fontSize='sm'><Code color='fg.default' bg='bg.subtle'>{step.pass}.{index + 1}</Code> {step.operation}</Text>
              <Text fontSize='xs' color='fg.muted'>Input: <Code color='fg.default' bg='bg.subtle'>{String(step.input || '').slice(0, 120)}</Code></Text>
              <Text fontSize='xs' color='fg.muted'>Output: <Code color='fg.default' bg='bg.subtle'>{String(step.output || '').slice(0, 120)}</Code></Text>
            </Box>
          ))}
        </Box>

        {errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
      </VStack>
    </Box>
  );
}

DecoderPanel.propTypes = {
  themeId: PropTypes.string,
};

export default DecoderPanel;

\\n
## File: src\renderer\js\components\sentinel\EmbeddedBrowserPanel.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Input,
  Text,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

function mergeSession(currentItems, nextSession) {
  if (!nextSession?.id) {
    return currentItems;
  }

  const existingIndex = currentItems.findIndex(item => item.id === nextSession.id);
  if (existingIndex === -1) {
    return [nextSession, ...currentItems];
  }

  return currentItems.map(item => (item.id === nextSession.id ? nextSession : item));
}

function sortSessions(items) {
  return [...items].sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
}

function removeSessionById(items, sessionId) {
  const remaining = [];
  for (const item of items) {
    if (item.id !== sessionId) {
      remaining.push(item);
    }
  }
  return remaining;
}

function buildBoundsFromRect(rect) {
  // Electron view bounds use the same logical pixel coordinate space as the renderer.
  // Multiplying by devicePixelRatio causes hosted Chromium content to overflow on HiDPI displays.
  return {
    x: Math.max(0, Math.round(rect.left || 0)),
    y: Math.max(0, Math.round(rect.top || 0)),
    width: Math.max(0, Math.round(rect.width || 0)),
    height: Math.max(0, Math.round(rect.height || 0)),
  };
}

function getBrowserApi() {
  return globalThis.window?.sentinel?.browser ?? null;
}

function buildBrowserUnsubscribers({
  browser,
  activeSessionId,
  setSessions,
  setAddress,
  setLastProxyPort,
  setStatusText,
  setErrorText,
  setActiveSessionId,
}) {
  const onState = (payload) => {
    const session = payload?.session ?? null;
    if (!session) {
      return;
    }

    setSessions(currentItems => {
      if (payload?.closed) {
        return removeSessionById(currentItems, session.id);
      }
      return sortSessions(mergeSession(currentItems, session));
    });

    if (session.currentUrl) {
      setAddress(session.currentUrl);
    }

    if (payload?.proxy?.port) {
      setLastProxyPort(String(payload.proxy.port));
    }

    if (payload?.closed && activeSessionId === session.id) {
      setActiveSessionId('');
    }
  };

  const onNavigateStart = (payload) => {
    if (payload?.url) {
      setAddress(payload.url);
    }
    setStatusText('Loading page in Chromium browser...');
    setErrorText('');
  };

  const onNavigateComplete = (payload) => {
    if (payload?.proxy?.port) {
      setLastProxyPort(String(payload.proxy.port));
    }
    setStatusText(`Chromium browser routed through proxy port ${payload?.proxy?.port ?? 'unknown'}.`);
    setErrorText('');
  };

  const onNavigateError = (payload) => {
    setErrorText(payload?.error ?? 'Navigation failed.');
    setStatusText('');
  };

  const onTitleUpdated = (payload) => {
    if (payload?.title) {
      setStatusText(`Loaded: ${payload.title}`);
    }
  };

  const unsubscribers = [];
  const addUnsubscriber = (unsubscribe) => {
    if (typeof unsubscribe === 'function') {
      unsubscribers.push(unsubscribe);
    }
  };

  if (typeof browser.onState === 'function') {
    addUnsubscriber(browser.onState(onState));
  }
  if (typeof browser.onNavigateStart === 'function') {
    addUnsubscriber(browser.onNavigateStart(onNavigateStart));
  }
  if (typeof browser.onNavigateComplete === 'function') {
    addUnsubscriber(browser.onNavigateComplete(onNavigateComplete));
  }
  if (typeof browser.onNavigateError === 'function') {
    addUnsubscriber(browser.onNavigateError(onNavigateError));
  }
  if (typeof browser.onTitleUpdated === 'function') {
    addUnsubscriber(browser.onTitleUpdated(onTitleUpdated));
  }

  return unsubscribers;
}

function EmbeddedBrowserPanel({ themeId }) {
  const [sessions, setSessions] = React.useState([]);
  const [activeSessionId, setActiveSessionId] = React.useState('');
  const [address, setAddress] = React.useState('https://example.com');
  const [statusText, setStatusText] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [lastProxyPort, setLastProxyPort] = React.useState('unknown');
  const hostRef = React.useRef(null);

  const activeSession = sessions.find(session => session.id === activeSessionId) || null;

  const loadSessions = React.useCallback(async () => {
    const browser = getBrowserApi();
    if (!browser) {
      return;
    }

    const listed = await browser.listSessions();
    const items = Array.isArray(listed?.items) ? listed.items : [];
    const sorted = sortSessions(items);
    setSessions(sorted);
    setActiveSessionId(currentId => {
      if (currentId && sorted.some(item => item.id === currentId)) {
        return currentId;
      }
      return sorted[0] ? sorted[0].id : '';
    });
  }, [activeSessionId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSessions();
      } catch {
        if (!cancelled) {
          setErrorText('Unable to load embedded browser sessions.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSessions]);

  const syncActiveBounds = React.useCallback(async (sessionIdOverride) => {
    const browser = getBrowserApi();
    const targetSessionId = sessionIdOverride ?? activeSessionId;
    const element = hostRef.current;
    if (!browser || !targetSessionId || !element || typeof element.getBoundingClientRect !== 'function') {
      return;
    }

    const rect = element.getBoundingClientRect();
    const bounds = buildBoundsFromRect(rect);
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    await browser.setBounds({ sessionId: targetSessionId, bounds });
  }, [activeSessionId]);

  React.useEffect(() => {
    const browser = getBrowserApi();
    if (!browser) {
      return undefined;
    }

    const unsubscribers = buildBrowserUnsubscribers({
      browser,
      activeSessionId,
      setSessions,
      setAddress,
      setLastProxyPort,
      setStatusText,
      setErrorText,
      setActiveSessionId,
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [activeSessionId]);

  React.useEffect(() => {
    const browser = getBrowserApi();
    if (!browser || !activeSessionId) {
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        await browser.focusSession({ sessionId: activeSessionId });
        await browser.showView({ sessionId: activeSessionId });
        await syncActiveBounds(activeSessionId);
      } catch {
        if (!cancelled) {
          setErrorText('Unable to attach Chromium browser surface.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, syncActiveBounds]);

  React.useEffect(() => {
    const browser = getBrowserApi();
    if (!browser || !activeSessionId) {
      return undefined;
    }

    const handleResize = () => {
      syncActiveBounds(activeSessionId).catch(() => {
        // Ignore bounds sync failures triggered by layout sync events.
      });
    };

    let resizeObserver = null;
    let intervalId = null;
    if (typeof ResizeObserver === 'function' && hostRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(hostRef.current);
    }

    const runtimeWindow = globalThis.window;
    if (typeof runtimeWindow?.addEventListener === 'function') {
      runtimeWindow.addEventListener('resize', handleResize);
      runtimeWindow.addEventListener('scroll', handleResize, true);
      intervalId = globalThis.setInterval(() => {
        handleResize();
      }, 250);
    }

    handleResize();

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (intervalId != null) {
        globalThis.clearInterval(intervalId);
      }
      if (typeof runtimeWindow?.removeEventListener === 'function') {
        runtimeWindow.removeEventListener('resize', handleResize);
        runtimeWindow.removeEventListener('scroll', handleResize, true);
      }
    };
  }, [activeSessionId, syncActiveBounds]);

  React.useEffect(() => {
    const browser = getBrowserApi();
    return () => {
      if (browser && activeSessionId && typeof browser.hideView === 'function') {
        browser.hideView({ sessionId: activeSessionId }).catch(() => {
          // Ignore detach failures on panel unmount.
        });
      }
    };
  }, [activeSessionId]);

  async function createSession() {
    const browser = getBrowserApi();
    if (!browser) {
      return;
    }

    setErrorText('');
    setStatusText('');
    try {
      const created = await browser.createSession({});
      const session = created?.session ?? null;
      if (!session) {
        throw new Error('No session returned from browser service.');
      }

      setSessions(prev => sortSessions(mergeSession(prev, session)));
      setActiveSessionId(session.id);
      setAddress(session.currentUrl ?? address);
      setStatusText('Chromium browser session opened.');
    } catch (error) {
      setErrorText(error?.message ?? 'Unable to create browser session.');
    }
  }

  async function runNavigation(methodName, args = {}) {
    const browser = getBrowserApi();
    if (!browser || !activeSessionId || typeof browser[methodName] !== 'function') {
      return;
    }

    setErrorText('');
    setStatusText('');
    try {
      const response = await browser[methodName]({ sessionId: activeSessionId, ...args });
      const session = response?.session ?? null;
      if (session) {
        setSessions(prev => sortSessions(mergeSession(prev, session)));
        if (session.currentUrl) {
          setAddress(session.currentUrl);
        }
      }
      if (response?.proxy?.port) {
        setLastProxyPort(String(response.proxy.port));
      }
    } catch (error) {
      setErrorText(error?.message ?? 'Navigation failed.');
    }
  }

  async function navigate() {
    return runNavigation('navigate', { url: address });
  }

  async function closeActiveSession() {
    const browser = getBrowserApi();
    if (!browser || !activeSessionId || typeof browser.closeSession !== 'function') {
      return;
    }

    setErrorText('');
    setStatusText('');
    try {
      await browser.closeSession({ sessionId: activeSessionId });
      setSessions(prev => prev.filter(item => item.id !== activeSessionId));
      const nextActive = sessions.find(item => item.id !== activeSessionId);
      setActiveSessionId(nextActive?.id ?? '');
      setStatusText('Chromium browser session closed.');
    } catch (error) {
      setErrorText(error?.message ?? 'Unable to close browser session.');
    }
  }

  return (
    <Flex direction='column' h='100%' overflow='hidden' p='3' gap='2'>
      {/* Panel header */}
      <Flex flex='0 0 auto' align='center' justify='space-between' pb='2' borderBottomWidth='1px' borderColor='border.default'>
        <Text fontWeight='semibold' fontSize='sm'>Embedded Browser</Text>
        <HStack gap='2'>
          <Badge 
            variant='outline' 
            color='var(--sentinel-fg-default)' 
            borderColor={activeSession?.loading ? 'orange.500' : 'green.500'} 
            bg={activeSession?.loading ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)'}
          >
            {activeSession?.loading ? 'Loading' : 'Ready'}
          </Badge>
          <Button size='xs' variant='outline' onClick={loadSessions}>Refresh</Button>
          <Button size='xs' variant='outline' onClick={createSession}>New Session</Button>
        </HStack>
      </Flex>

      {/* Session tabs */}
      <HStack flex='0 0 auto' gap='1' overflowX='auto' overflowY='hidden' minH='6'>
        {sessions.length === 0 ? (
          <Text fontSize='xs' color='fg.muted'>No sessions yet — click New Session to begin.</Text>
        ) : sessions.map(session => (
          <Button
            key={session.id}
            size='xs'
            flex='0 0 auto'
            variant={activeSessionId === session.id ? 'solid' : 'ghost'}
            onClick={() => setActiveSessionId(session.id)}
          >
            {session.name}
          </Button>
        ))}
      </HStack>

      {/* Address bar + nav controls */}
      <HStack flex='0 0 auto' gap='1'>
        <Button size='xs' variant='ghost' onClick={() => runNavigation('back')} disabled={!activeSession?.canGoBack}>&#8592;</Button>
        <Button size='xs' variant='ghost' onClick={() => runNavigation('forward')} disabled={!activeSession?.canGoForward}>&#8594;</Button>
        <Button size='xs' variant='ghost' onClick={() => runNavigation('reload')} disabled={!activeSession}>&#8635;</Button>
        <Button size='xs' variant='ghost' onClick={() => runNavigation('stop')} disabled={!activeSession?.loading}>&#x2715;</Button>
        <Input
          flex='1'
          size='xs'
          value={address}
          onChange={event => setAddress(event.target.value)}
          placeholder='https://target.example'
          color='fg.default'
          bg='bg.subtle'
          borderColor='border.default'
          _placeholder={{ color: 'fg.muted' }}
        />
        <Button size='xs' colorPalette='blue' onClick={navigate} disabled={!activeSessionId}>Go</Button>
        <Button size='xs' variant='outline' colorPalette='red' onClick={closeActiveSession} disabled={!activeSessionId}>Close</Button>
      </HStack>

      {/* Compact session metadata */}
      {activeSession ? (
        <HStack flex='0 0 auto' gap='2' overflow='hidden'>
          <Text fontSize='xs' color='fg.muted' flex='1' overflow='hidden'>
            <Code fontSize='xs' color='fg.default' bg='bg.subtle'>{activeSession.name}</Code>
            {' · '}
            <Code fontSize='xs' color='fg.default' bg='bg.subtle'>{activeSession.currentUrl || 'pending'}</Code>
            {' · Proxy '}
            <Code fontSize='xs' color='fg.default' bg='bg.subtle'>{lastProxyPort}</Code>
          </Text>
        </HStack>
      ) : null}

      {/* Chromium surface — flex:1 ensures this always fills available height within the panel */}
      <Box
        flex='1'
        minH='0'
        borderWidth='1px'
        borderColor='border.default'
        borderRadius='sm'
        overflow='hidden'
        bg='bg.canvas'
        position='relative'
      >
        <Box
          ref={hostRef}
          data-testid='embedded-browser-host'
          position='absolute'
          inset='1px'
          bg='bg.subtle'
        />
        <Flex
          position='absolute'
          inset='1px'
          align='center'
          justify='center'
          direction='column'
          gap='2'
          pointerEvents='none'
          color='fg.muted'
          textAlign='center'
          bg='linear-gradient(180deg, rgba(8, 17, 26, 0.16) 0%, rgba(8, 17, 26, 0.02) 100%)'
        >
          <Text fontWeight='semibold'>Chromium WebContentsView Host</Text>
          <Text fontSize='sm' maxW='md'>
            The live browser surface is attached by Electron main process to this viewport region.
          </Text>
        </Flex>
      </Box>

      {/* Status / error strip */}
      {(statusText || errorText) ? (
        <Box flex='0 0 auto'>
          {statusText ? <Text fontSize='xs' color={getStatusTextColor('success', themeId)}>{statusText}</Text> : null}
          {errorText ? <Text fontSize='xs' color={getStatusTextColor('error', themeId)}>{errorText}</Text> : null}
        </Box>
      ) : null}
    </Flex>
  );
}

EmbeddedBrowserPanel.propTypes = {
  themeId: PropTypes.string,
};

export default EmbeddedBrowserPanel;

\\n
## File: src\renderer\js\components\sentinel\ExtensionsPanel.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Code,
  Flex,
  Grid,
  HStack,
  Input,
  Stack,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

function splitCsvList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function ExtensionsPanel(props) {
  const { themeId } = props;
  const [extensions, setExtensions] = React.useState([]);
  const [auditLog, setAuditLog] = React.useState([]);
  const [extensionsDir, setExtensionsDir] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [mode, setMode] = React.useState('package');
  const [packagePath, setPackagePath] = React.useState('');
  const [scriptName, setScriptName] = React.useState('Quick Automation Script');
  const [scriptTriggers, setScriptTriggers] = React.useState('proxy.intercept');
  const [scriptSource, setScriptSource] = React.useState('api.audit("script.run", { method: payload && payload.request ? payload.request.method : "UNKNOWN" });');
  const [permissionsText, setPermissionsText] = React.useState('proxy.intercept.read,audit.write');

  const refresh = React.useCallback(async () => {
    const extensionsApi = globalThis?.window?.sentinel?.extensions;
    if (typeof extensionsApi?.list !== 'function') {
      return;
    }

    try {
      const result = await extensionsApi.list();
      setExtensions(Array.isArray(result?.extensions) ? result.extensions : []);
      setAuditLog(Array.isArray(result?.auditLog) ? result.auditLog : []);
      setExtensionsDir(String(result?.extensionsDir || ''));
      setErrorText('');
    } catch (error) {
      setErrorText(error?.message || 'Failed to load extension state.');
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const installExtension = async () => {
    const extensionsApi = globalThis?.window?.sentinel?.extensions;
    if (typeof extensionsApi?.install !== 'function') {
      return;
    }

    const approvedPermissions = splitCsvList(permissionsText);
    const args = mode === 'script'
      ? {
          name: scriptName,
          script: scriptSource,
          triggers: splitCsvList(scriptTriggers),
          permissions: approvedPermissions,
          approvedPermissions,
        }
      : {
          packagePath,
          approvedPermissions,
        };

    try {
      const result = await extensionsApi.install(args);
      if (result?.ok) {
        setErrorText('');
      } else {
        setErrorText(result?.error || 'Install failed.');
      }
      await refresh();
    } catch (error) {
      setErrorText(error?.message || 'Install failed.');
    }
  };

  const uninstallExtension = async (id) => {
    const extensionsApi = globalThis?.window?.sentinel?.extensions;
    if (typeof extensionsApi?.uninstall !== 'function') {
      return;
    }

    try {
      const result = await extensionsApi.uninstall({ id });
      if (!result?.ok) {
        setErrorText(result?.error || 'Uninstall failed.');
        return;
      }

      setErrorText('');
      await refresh();
    } catch (error) {
      setErrorText(error?.message || 'Uninstall failed.');
    }
  };

  const toggleExtension = async (id, enabled) => {
    const extensionsApi = globalThis?.window?.sentinel?.extensions;
    if (typeof extensionsApi?.toggle !== 'function') {
      return;
    }

    const action = enabled ? 'enable' : 'disable';

    try {
      const result = await extensionsApi.toggle({ id, enabled });
      if (result?.ok === false) {
        setErrorText(
          result.error ||
          `Failed to ${action} extension.`
        );
        return;
      }

      setErrorText('');
      await refresh();
    } catch (error) {
      setErrorText(error?.message || `Failed to ${action} extension.`);
    }
  };

  return (
    <Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='sm' borderColor='border.default'>
      <VStack align='stretch' gap='4'>
      <Flex align='center' justify='space-between'>
        <Text fontWeight='medium' fontSize='sm'>Extensions</Text>
        <HStack gap='2'>
          <Button size='sm' variant='outline' onClick={refresh}>Reload</Button>
        </HStack>
      </Flex>

      <Text fontSize='sm' color='fg.muted'>
        Managed directory: <Code color='fg.default' bg='bg.subtle'>{extensionsDir || 'unavailable'}</Code>
      </Text>

      {errorText ? (
        <Text fontSize='sm' color={getStatusTextColor('error', themeId)}>{errorText}</Text>
      ) : null}

      <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p='3'>
        <Text fontWeight='semibold' fontSize='sm' mb='3'>Install</Text>
        <Grid templateColumns='1fr 1fr' gap='3'>
          <Box>
            <Text fontSize='xs' mb='1'>Mode</Text>
            <Flex gap='2'>
              <Button
                size='sm'
                variant={mode === 'package' ? 'solid' : 'outline'}
                onClick={() => setMode('package')}
              >
                Package
              </Button>
              <Button
                size='sm'
                variant={mode === 'script' ? 'solid' : 'outline'}
                onClick={() => setMode('script')}
              >
                Automation Script
              </Button>
            </Flex>
          </Box>
          <Box>
            <Text fontSize='xs' mb='1'>Approved Permissions (comma-separated)</Text>
            <Input
              size='sm'
              value={permissionsText}
              onChange={(event) => setPermissionsText(event.target.value)}
              placeholder='proxy.intercept.read,audit.write'
            />
          </Box>
        </Grid>

        {mode === 'script' ? (
          <Stack mt='3' gap='3'>
            <Input
              size='sm'
              value={scriptName}
              onChange={(event) => setScriptName(event.target.value)}
              placeholder='Script name'
            />
            <Input
              size='sm'
              value={scriptTriggers}
              onChange={(event) => setScriptTriggers(event.target.value)}
              placeholder='proxy.intercept,scanner.finding'
            />
            <Textarea
              size='sm'
              minH='120px'
              value={scriptSource}
              onChange={(event) => setScriptSource(event.target.value)}
              placeholder='JavaScript snippet executed for each trigger payload'
            />
          </Stack>
        ) : (
          <Input
            mt='3'
            size='sm'
            value={packagePath}
            onChange={(event) => setPackagePath(event.target.value)}
            placeholder='Path to extension folder containing extension.json'
          />
        )}

        <Button mt='3' size='sm' colorPalette='blue' onClick={installExtension}>Install</Button>
      </Box>

      <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p='3'>
        <Text fontWeight='semibold' fontSize='sm' mb='2'>Installed Extensions</Text>
        {extensions.length === 0 ? (
          <Text fontSize='sm' color='fg.muted'>No extensions installed.</Text>
        ) : (
          <Stack gap='2'>
            {extensions.map((extension) => (
              <Box key={extension.id} borderWidth='1px' borderRadius='sm' borderColor='border.default' p='2'>
                <Flex align='center' justify='space-between' gap='3'>
                  <Box>
                    <Text fontSize='sm' fontWeight='semibold'>{extension.name}</Text>
                    <Text fontSize='xs' color='fg.muted'>
                      <Code color='fg.default' bg='bg.subtle'>{extension.id}</Code> v{extension.version}
                    </Text>
                    <Text fontSize='xs' color='fg.muted'>
                      Permissions: {(extension.permissions || []).join(', ') || 'none'}
                    </Text>
                    <Text fontSize='xs' color='fg.muted'>
                      Subscriptions: {(extension.subscriptions || []).join(', ') || 'none'}
                    </Text>
                  </Box>
                  <Stack direction='row' align='center'>
                    <Button
                      size='xs'
                      variant='outline'
                      onClick={() => toggleExtension(extension.id, !extension.enabled)}
                    >
                      {extension.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size='xs' variant='outline' colorPalette='red' onClick={() => uninstallExtension(extension.id)}>
                      Remove
                    </Button>
                  </Stack>
                </Flex>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p='3'>
        <Text fontWeight='semibold' fontSize='sm' mb='2'>Audit Log</Text>
        {auditLog.length === 0 ? (
          <Text fontSize='sm' color='fg.muted'>No audit events recorded yet.</Text>
        ) : (
          <Stack maxH='320px' overflowY='auto' gap='1'>
            {auditLog.slice(0, 100).map((entry) => (
              <Box key={entry.id} borderWidth='1px' borderRadius='sm' p='2'>
                <Text fontSize='xs'>
                  <Code color='fg.default' bg='bg.subtle'>{entry.extensionId}</Code> {entry.action} ({entry.status})
                </Text>
                {entry.message ? <Text fontSize='xs' color='fg.muted'>{entry.message}</Text> : null}
              </Box>
            ))}
          </Stack>
        )}
      </Box>
      </VStack>
    </Box>
  );
}

ExtensionsPanel.propTypes = {
  themeId: PropTypes.string,
};

export default ExtensionsPanel;

\\n
## File: src\renderer\js\components\sentinel\HistoryPanel.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
	Box,
	Button,
	Code,
	Flex,
	HStack,
	Input,
	Separator,
	Text,
	VStack,
} from '@chakra-ui/react';
import MonacoEditor from '@monaco-editor/react';
import { FixedSizeList } from 'react-window';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { getMonacoTheme, getStatusTextColor } from './theme-utils';

const columnHelper = createColumnHelper();
const ROW_HEIGHT = 34;

function toHex(base64) {
	if (!base64) {
		return '';
	}
	try {
		const raw = atob(base64);
		const parts = [];
		for (let index = 0; index < raw.length; index += 1) {
			parts.push((raw.codePointAt(index) ?? 0).toString(16).padStart(2, '0'));
		}
		return parts.join(' ');
	} catch {
		return '';
	}
}

function buildQueryFilter(rawFilters) {
	const hostValue = String(rawFilters.host || '').trim();
	const pathValue = String(rawFilters.path || '').trim();
	const methodValue = String(rawFilters.method || '').trim().toUpperCase();
	const statusCodeValue = String(rawFilters.statusCode || '').trim();
	const parsedStatus = statusCodeValue ? Number(statusCodeValue) : null;

	return {
		host: hostValue || undefined,
		path: pathValue || undefined,
		method: methodValue || undefined,
		statusCode: Number.isFinite(parsedStatus) ? parsedStatus : undefined,
	};
}

function matchesActiveFilters(item, filter) {
	const request = item?.request || {};
	const response = item?.response || {};

	if (filter.method && String(request.method || '').toUpperCase() !== String(filter.method).toUpperCase()) {
		return false;
	}

	if (filter.host && !String(request.host || '').toLowerCase().includes(String(filter.host).toLowerCase())) {
		return false;
	}

	if (filter.path && !String(request.path || '').startsWith(String(filter.path))) {
		return false;
	}

	if (typeof filter.statusCode === 'number' && response.statusCode !== filter.statusCode) {
		return false;
	}

	return true;
}

function mergeBufferedItems(previousItems, pendingItems, limit) {
	const mergedById = new Map();
	for (const collection of [pendingItems, previousItems]) {
		for (const item of collection) {
			if (!item || mergedById.has(item.id)) {
				continue;
			}
			mergedById.set(item.id, item);
		}
	}
	return Array.from(mergedById.values()).slice(0, limit);
}

function getInspectorTabLabel(tabName) {
	if (tabName === 'raw') {
		return 'Raw';
	}
	if (tabName === 'preview') {
		return 'Preview';
	}
	if (tabName === 'hex') {
		return 'Hex';
	}
	return 'Headers';
}

function buildRawRequest(request = {}) {
	const headers = Object.entries(request.headers || {})
		.map(([key, value]) => `${key}: ${value}`)
		.join('\n');
	return [
		`${request.method || 'GET'} ${request.path || '/'} ${request.protocol || 'HTTP/1.1'}`,
		headers,
		'',
		request.body || '',
	].join('\n');
}

function buildRawResponse(response = {}) {
	const headers = Object.entries(response.headers || {})
		.map(([key, value]) => `${key}: ${value}`)
		.join('\n');
	return [
		`${response.statusCode || 0} ${response.statusMessage || ''}`,
		headers,
		'',
		response.body || '',
	].join('\n');
}

function InspectorSection({ item, inspectorTab, setInspectorTab, onSendToRepeater, onSendToIntruder, themeId }) {
	if (!item) {
		return (
			<Box p={4} h='100%'>
				<Text color='fg.muted' fontSize='sm'>Select a history row to inspect request and response details.</Text>
			</Box>
		);
	}

	const request = item.request || {};
	const response = item.response || {};
	const headersEntries = Object.entries(response.headers || request.headers || {});
	const previewHtml = response.contentType && String(response.contentType).includes('html') ? response.body : null;
	let hexText = '';
	if (response.rawBodyBase64) {
		hexText = toHex(response.rawBodyBase64);
	} else if (request.rawBodyBase64) {
		hexText = toHex(request.rawBodyBase64);
	}
	const rawText = response.statusCode ? buildRawResponse(response) : buildRawRequest(request);
	const previewFallbackText = response.body || request.body || '[No previewable content]';
	const previewContent = previewHtml
		? <Box as='iframe' sandbox='' srcDoc={previewHtml} title='Preview' w='100%' h='100%' border='0' />
		: <Box as='pre' p='3' fontSize='xs' fontFamily='mono' whiteSpace='pre-wrap' overflow='auto' h='100%'>{previewFallbackText}</Box>;

	return (
		<VStack align='stretch' h='100%' gap='3' p='3'>
			<HStack justify='space-between' wrap='wrap'>
				<Box>
					<Text fontWeight='semibold' color='fg.default'>{request.method || 'GET'} {request.host || 'unknown-host'}{request.path || '/'}</Text>
					<Text fontSize='xs' color='fg.muted'>Status <Code color='fg.default' bg='bg.subtle'>{String(response.statusCode || 'pending')}</Code></Text>
				</Box>
				<HStack>
					<Button size='xs' variant='outline' onClick={onSendToRepeater} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Send to Repeater</Button>
					<Button size='xs' variant='outline' onClick={onSendToIntruder} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Send to Intruder</Button>
				</HStack>
			</HStack>
			<HStack>
				{['headers', 'raw', 'preview', 'hex'].map((tabName) => (
					<Button
						key={tabName}
						size='xs'
						variant={inspectorTab === tabName ? 'solid' : 'outline'}
						onClick={() => setInspectorTab(tabName)}
						color={inspectorTab === tabName ? 'fg.default' : 'fg.muted'}
						bg={inspectorTab === tabName ? 'bg.subtle' : 'bg.surface'}
						borderColor='border.default'
						_hover={{ bg: 'bg.subtle', color: 'fg.default' }}
					>
						{getInspectorTabLabel(tabName)}
					</Button>
				))}
			</HStack>
			<Box flex='1' minH='0' borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' overflow='hidden'>
				{inspectorTab === 'headers' ? (
					<VStack align='stretch' gap='1' p='3' overflowY='auto' h='100%'>
						{headersEntries.length === 0 ? <Text fontSize='sm' color='fg.muted'>No headers available.</Text> : null}
						{headersEntries.map(([key, value]) => (
							<Flex key={key} justify='space-between' gap='3' fontSize='sm'>
								<Code color='fg.default' bg='bg.subtle'>{key}</Code>
								<Text color='fg.muted' textAlign='right'>{String(value)}</Text>
							</Flex>
						))}
					</VStack>
				) : null}
				{inspectorTab === 'raw' ? (
					<MonacoEditor
						height='100%'
						defaultLanguage='http'
						theme={getMonacoTheme(themeId)}
						value={rawText}
						options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', fontSize: 12 }}
					/>
				) : null}
				{inspectorTab === 'preview' ? (
					previewContent
				) : null}
				{inspectorTab === 'hex' ? (
					<Box as='pre' p='3' fontSize='xs' fontFamily='mono' whiteSpace='pre-wrap' overflow='auto' h='100%'>
						{hexText || '[No binary data]'}
					</Box>
				) : null}
			</Box>
		</VStack>
	);
}

function VirtualizedHistoryTable({ table, selectedId, onSelect }) {
	const rows = table.getRowModel().rows;

	return (
		<Box h='100%' display='flex' flexDirection='column'>
			<Flex px='2' py='2' borderBottomWidth='1px' borderColor='border.default' fontSize='xs' color='fg.muted' fontFamily='mono'>
				{table.getFlatHeaders().map((header) => (
					<Box key={header.id} flex={header.column.columnDef.meta?.flex || '1'} px='2'>
						{flexRender(header.column.columnDef.header, header.getContext())}
					</Box>
				))}
			</Flex>
			<Box flex='1'>
				<FixedSizeList
					height={420}
					itemCount={rows.length}
					itemSize={ROW_HEIGHT}
					width='100%'
				>
					{({ index, style }) => {
						const row = rows[index];
						const isSelected = row.original.id === selectedId;
						return (
							<Flex
								style={style}
								px='2'
								align='center'
								bg={isSelected ? 'bg.subtle' : 'transparent'}
								borderBottomWidth='1px'
								borderColor='border.default'
								fontFamily='mono'
								fontSize='xs'
								cursor='pointer'
								onClick={() => onSelect(row.original.id)}
							>
								{row.getVisibleCells().map((cell) => (
									<Box key={cell.id} flex={cell.column.columnDef.meta?.flex || '1'} px='2' overflow='hidden' textOverflow='ellipsis' whiteSpace='nowrap'>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</Box>
								))}
							</Flex>
						);
					}}
				</FixedSizeList>
			</Box>
		</Box>
	);
}

function HistoryPanel({ themeId }) {
	const [items, setItems] = React.useState([]);
	const [loading, setLoading] = React.useState(true);
	const [errorText, setErrorText] = React.useState('');
	const [noticeText, setNoticeText] = React.useState('');
	const [page, setPage] = React.useState(0);
	const [pageSize] = React.useState(250);
	const [total, setTotal] = React.useState(0);
	const [selectedId, setSelectedId] = React.useState('');
	const [inspectorTab, setInspectorTab] = React.useState('headers');
	const [filters, setFilters] = React.useState({
		host: '',
		path: '',
		method: '',
		statusCode: '',
	});
	const loadHistoryRef = React.useRef(null);
	const refreshTimerRef = React.useRef(null);
	const refreshPendingRef = React.useRef(false);
	const bufferedItemsRef = React.useRef([]);
	const itemsRef = React.useRef([]);
	const knownIdsRef = React.useRef(new Set());
	const activeFilterRef = React.useRef({});
	const pageRef = React.useRef(0);
	const pageSizeRef = React.useRef(250);

	const loadHistory = React.useCallback(async (nextPage = 0) => {
		const sentinel = globalThis?.window?.sentinel;
		if (!sentinel?.history) {
			setLoading(false);
			return;
		}

		setErrorText('');
		setNoticeText('');
		setLoading(true);
		try {
			const queryFilter = buildQueryFilter(filters);

			const result = await sentinel.history.query({
				page: nextPage,
				pageSize,
				filter: queryFilter,
			});

			const loadedItems = Array.isArray(result.items) ? result.items : [];
			if (nextPage === 0) {
				bufferedItemsRef.current = [];
			}
			knownIdsRef.current = new Set(loadedItems.map(item => item?.id).filter(Boolean));
			setItems(loadedItems);
			setTotal(Number(result.total) || 0);
			setPage(Number(result.page) || 0);
		} catch {
			setErrorText('Unable to load traffic history.');
		} finally {
			setLoading(false);
		}
	}, [filters, pageSize]);

	React.useEffect(() => {
		loadHistoryRef.current = loadHistory;
	}, [loadHistory]);

	React.useEffect(() => {
		itemsRef.current = items;
	}, [items]);

	React.useEffect(() => {
		activeFilterRef.current = buildQueryFilter(filters);
		pageRef.current = page;
		pageSizeRef.current = pageSize;
	}, [filters, page, pageSize]);

	const columns = React.useMemo(() => ([
		columnHelper.accessor(row => row.request?.method || 'GET', {
			id: 'method',
			header: 'METHOD',
			cell: info => info.getValue(),
			meta: { flex: '0 0 72px' },
		}),
		columnHelper.accessor(row => row.request?.host || 'unknown-host', {
			id: 'host',
			header: 'HOST',
			cell: info => info.getValue(),
			meta: { flex: '0 0 180px' },
		}),
		columnHelper.accessor(row => row.request?.path || '/', {
			id: 'path',
			header: 'PATH',
			cell: info => info.getValue(),
			meta: { flex: '1' },
		}),
		columnHelper.accessor(row => row.response?.statusCode || '...', {
			id: 'status',
			header: 'STATUS',
			cell: info => String(info.getValue()),
			meta: { flex: '0 0 72px' },
		}),
		columnHelper.accessor(row => new Date(row.timestamp).toLocaleTimeString(), {
			id: 'time',
			header: 'TIME',
			cell: info => info.getValue(),
			meta: { flex: '0 0 100px' },
		}),
	]), []);

	const table = useReactTable({
		data: items,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	React.useEffect(() => {
		let cancelled = false;
		const sentinel = globalThis?.window?.sentinel;
		if (!sentinel?.history) {
			setLoading(false);
			return undefined;
		}

		if (loadHistoryRef.current) {
			loadHistoryRef.current(0);
		}

		const scheduleRefresh = () => {
			refreshPendingRef.current = true;
			if (refreshTimerRef.current) {
				return;
			}

			refreshTimerRef.current = setTimeout(() => {
				refreshTimerRef.current = null;
				if (cancelled) {
					return;
				}

				const pendingItems = bufferedItemsRef.current.splice(0);
				if (pageRef.current === 0 && pendingItems.length > 0) {
					const mergedItems = mergeBufferedItems(itemsRef.current, pendingItems, pageSizeRef.current);
					itemsRef.current = mergedItems;
					setItems(mergedItems);
				}

				if (refreshPendingRef.current && loadHistoryRef.current) {
					refreshPendingRef.current = false;
					loadHistoryRef.current(0);
				}
			}, 150);
		};

		const unsubscribe = sentinel.history.onPush((item) => {
			if (cancelled || !item) {
				return;
			}

			if (pageRef.current === 0 && matchesActiveFilters(item, activeFilterRef.current)) {
				const isInBuffer = bufferedItemsRef.current.some(existing => existing?.id === item.id);
				if (!isInBuffer && !knownIdsRef.current.has(item.id)) {
					bufferedItemsRef.current.unshift(item);
					knownIdsRef.current.add(item.id);
					setTotal(prevTotal => prevTotal + 1);
				}
			}

			scheduleRefresh();
		});

		return () => {
			cancelled = true;
			refreshPendingRef.current = false;
			if (refreshTimerRef.current) {
				clearTimeout(refreshTimerRef.current);
				refreshTimerRef.current = null;
			}
			bufferedItemsRef.current = [];
			if (typeof unsubscribe === 'function') {
				unsubscribe();
			}
		};
	}, []);

	async function clearHistory() {
		const sentinel = globalThis?.window?.sentinel;
		if (!sentinel?.history) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			await sentinel.history.clear();
			setItems([]);
			setTotal(0);
			setPage(0);
		} catch {
			setErrorText('Unable to clear history.');
		}
	}

	async function sendToIntruder(itemId) {
		const sentinel = globalThis?.window?.sentinel;
		if (!sentinel?.history || !sentinel?.intruder) {
			return;
		}

		setErrorText('');
		setNoticeText('');
		try {
			const item = await sentinel.history.get({ id: itemId });
			if (!item?.request) {
				throw new Error('Selected history item has no request payload.');
			}

			const request = item.request;
			const scheme = request.tls ? 'https' : 'http';
			const authority = request.host || request.headers?.host || 'localhost';
			const originalUrl = request.url || `${scheme}://${authority}${request.path || '/'}`;
			const separator = originalUrl.includes('?') ? '&' : '?';
			const templateUrl = `${originalUrl}${separator}attack=§injection§`;

			const configured = await sentinel.intruder.configure({
				config: {
					requestTemplate: {
						method: request.method,
						url: templateUrl,
						headers: request.headers,
						body: request.body,
					},
					attackType: 'sniper',
					positions: [
						{
							source: {
								type: 'dictionary',
								items: ['test', 'admin', "' or 1=1 --"],
							},
						},
					],
				},
			});

			await sentinel.intruder.start({ configId: configured.configId });
			setNoticeText('Sent to Intruder.');
		} catch {
			setErrorText('Unable to send item to Intruder.');
		}
	}

	function sendToRepeaterInspector(item) {
		const appWindow = globalThis?.window;
		if (!appWindow) {
			return;
		}
		appWindow.dispatchEvent(new CustomEvent('sentinel:repeater-handoff', {
			detail: {
				request: item.request,
			},
		}));
		appWindow.dispatchEvent(new CustomEvent('sentinel:navigate-module', {
			detail: { moduleName: 'Repeater' },
		}));
		setNoticeText('Loaded selected request into Repeater tab.');
	}

	const selectedItem = items.find(item => item?.id === selectedId) || null;
 
	const handleSendToRepeater = React.useCallback(() => {
		if (selectedItem) {
			sendToRepeaterInspector(selectedItem);
		}
	}, [selectedItem]);

	const handleSendToIntruder = React.useCallback(() => {
		if (selectedItem) {
			sendToIntruder(selectedItem.id);
		}
	}, [selectedItem]);

	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	function onFilterChange(key, value) {
		setFilters(prev => ({ ...prev, [key]: value }));
	}

	return (
		<Flex h='100%' overflow='hidden' direction='column'>
			<Flex px='3' py='2' borderBottomWidth='1px' borderColor='border.default' bg='bg.elevated' align='center' justify='space-between' flexShrink='0'>
				<Text fontWeight='medium' fontSize='sm' color='fg.default'>History</Text>
				<HStack gap='2'>
					<Button size='xs' variant='outline' onClick={() => loadHistory(page)} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Refresh</Button>
					<Button size='xs' variant='outline' color='fg.default' borderColor='border.default' onClick={clearHistory} bg='bg.surface' _hover={{ bg: 'bg.subtle' }}>Clear</Button>
				</HStack>
			</Flex>
			<VStack align='stretch' spacing={3} p='4' flex='1' overflow='hidden'>

				<HStack wrap='wrap'>
					<Input
						size='xs'
						placeholder='Host'
						value={filters.host}
						onChange={event => onFilterChange('host', event.target.value)}
						color='fg.default'
						bg='bg.surface'
						borderColor='border.default'
						_placeholder={{ color: 'fg.muted' }}
						maxW='180px'
					/>
					<Input
						size='xs'
						placeholder='Path prefix'
						value={filters.path}
						onChange={event => onFilterChange('path', event.target.value)}
						color='fg.default'
						bg='bg.surface'
						borderColor='border.default'
						_placeholder={{ color: 'fg.muted' }}
						maxW='180px'
					/>
					<Input
						size='xs'
						placeholder='Method (GET)'
						value={filters.method}
						onChange={event => onFilterChange('method', event.target.value)}
						color='fg.default'
						bg='bg.surface'
						borderColor='border.default'
						_placeholder={{ color: 'fg.muted' }}
						maxW='140px'
					/>
					<Input
						size='xs'
						type='number'
						placeholder='Status (200)'
						value={filters.statusCode}
						onChange={event => onFilterChange('statusCode', event.target.value)}
						color='fg.default'
						bg='bg.surface'
						borderColor='border.default'
						_placeholder={{ color: 'fg.muted' }}
						maxW='140px'
					/>
					<Button size='xs' variant='outline' onClick={() => loadHistory(0)} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Apply</Button>
				</HStack>

				<Text fontSize='sm' color='fg.muted'>
					Page <Code color='fg.default' bg='bg.subtle'>{page + 1}</Code> / <Code color='fg.default' bg='bg.subtle'>{totalPages}</Code> · Showing <Code color='fg.default' bg='bg.subtle'>{items.length}</Code> of <Code color='fg.default' bg='bg.subtle'>{total}</Code>
				</Text>
				<Text fontSize='xs' color='fg.muted'>Buffered stream flush cadence <Code color='fg.default' bg='bg.subtle'>150ms</Code></Text>

				<Flex flex='1' minH='0' gap='3' overflow='hidden'>
					<Box flex='1' minW='0' borderWidth='1px' borderRadius='sm' borderColor='border.default' overflow='hidden'>
						{loading && items.length === 0 ? <Text fontSize='sm' color='fg.muted' p='3'>Loading history...</Text> : null}
						{!loading && items.length === 0 ? <Text fontSize='sm' color='fg.muted' p='3'>No traffic captured yet.</Text> : null}
						{items.length > 0 ? (
							<VirtualizedHistoryTable table={table} selectedId={selectedId} onSelect={setSelectedId} />
						) : null}
					</Box>
					<Box w='44%' minW='360px' borderWidth='1px' borderRadius='sm' borderColor='border.default' overflow='hidden'>
						<InspectorSection
							item={selectedItem}
							inspectorTab={inspectorTab}
							setInspectorTab={setInspectorTab}
							onSendToRepeater={handleSendToRepeater}
							onSendToIntruder={handleSendToIntruder}
							themeId={themeId}
						/>
					</Box>
				</Flex>

				<Separator />
				<HStack justify='space-between'>
					<Button
						size='xs'
						variant='outline'
						onClick={() => loadHistory(Math.max(0, page - 1))}
						disabled={page <= 0}
						color='fg.default'
						bg='bg.surface'
						borderColor='border.default'
						_hover={{ bg: 'bg.subtle' }}
					>
						Previous
					</Button>
					<Button
						size='xs'
						variant='outline'
						onClick={() => loadHistory(page + 1)}
						disabled={(page + 1) >= totalPages}
						color='fg.default'
						bg='bg.surface'
						borderColor='border.default'
						_hover={{ bg: 'bg.subtle' }}
					>
						Next
					</Button>
				</HStack>

				{errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
				{noticeText ? <Text color={getStatusTextColor('success', themeId)} fontSize='sm'>{noticeText}</Text> : null}
			</VStack>
		</Flex>
	);
}

InspectorSection.propTypes = {
	item: PropTypes.shape({
		id: PropTypes.string,
		request: PropTypes.shape({
			method: PropTypes.string,
			host: PropTypes.string,
			path: PropTypes.string,
			protocol: PropTypes.string,
			body: PropTypes.string,
			rawBodyBase64: PropTypes.string,
			headers: PropTypes.objectOf(PropTypes.any),
		}),
		response: PropTypes.shape({
			statusCode: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
			statusMessage: PropTypes.string,
			contentType: PropTypes.string,
			body: PropTypes.string,
			rawBodyBase64: PropTypes.string,
			headers: PropTypes.objectOf(PropTypes.any),
		}),
	}),
	inspectorTab: PropTypes.string.isRequired,
	setInspectorTab: PropTypes.func.isRequired,
	onSendToRepeater: PropTypes.func.isRequired,
	onSendToIntruder: PropTypes.func.isRequired,
	themeId: PropTypes.string,
};

VirtualizedHistoryTable.propTypes = {
	table: PropTypes.shape({
		getRowModel: PropTypes.func.isRequired,
		getFlatHeaders: PropTypes.func.isRequired,
	}).isRequired,
	selectedId: PropTypes.string.isRequired,
	onSelect: PropTypes.func.isRequired,
};

HistoryPanel.propTypes = {
	themeId: PropTypes.string,
};

export default HistoryPanel;

\\n
## File: src\renderer\js\components\sentinel\IntruderPanel.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Input,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

const MARKER_REGEX = /§([^§]*)§/g;

function headersObjectToText(headers) {
  if (!headers || typeof headers !== 'object') {
    return '';
  }
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

function headersTextToObject(text) {
  const headers = {};
  for (const line of String(text || '').split('\n')) {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) {
      headers[key] = value;
    }
  }
  return headers;
}

function collectMarkers(field, value) {
  const markers = [];
  if (typeof value !== 'string' || value.length === 0) {
    return markers;
  }

  let match;
  let index = 0;
  while ((match = MARKER_REGEX.exec(value)) !== null) {
    markers.push({
      id: `position-${field}-${index + 1}`,
      field,
      label: `${field} #${index + 1}`,
      defaultValue: match[1] || 'payload',
    });
    index += 1;
  }
  MARKER_REGEX.lastIndex = 0;
  return markers;
}

function detectMarkers({ url, headersText, body }) {
  return [
    ...collectMarkers('url', url),
    ...collectMarkers('headers', headersText),
    ...collectMarkers('body', body),
  ];
}

function buildDefaultSource(marker) {
  return {
    type: 'dictionary',
    text: [marker.defaultValue || 'admin', 'test', 'guest'].join('\n'),
    filePath: '',
    charset: 'abc123',
    minLength: 1,
    maxLength: 2,
    start: 1,
    end: 10,
    step: 1,
    padTo: 0,
  };
}

function estimateSourceCount(source) {
  if (!source) {
    return 0;
  }

  if (source.type === 'dictionary') {
    if (source.filePath) {
        return null;
    }
    return String(source.text || '')
      .split(/\r?\n/g)
      .map(line => line.trim())
      .filter(Boolean)
      .length;
  }

  if (source.type === 'bruteforce') {
    const charsetLength = String(source.charset || '').length;
    const minLength = Math.max(1, Number(source.minLength) || 1);
    const maxLength = Math.max(minLength, Number(source.maxLength) || minLength);
    let total = 0;
    for (let length = minLength; length <= maxLength; length += 1) {
      total += charsetLength ** length;
    }
    return total;
  }

  if (source.type === 'sequential') {
    const start = Number(source.start);
    const end = Number(source.end);
    const step = Number(source.step) || 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || step <= 0 || end < start) {
      return 0;
    }
    return Math.floor((end - start) / step) + 1;
  }

  return 0;
}

function estimateAttackTotal(attackType, sources) {
  const counts = sources
    .map(source => estimateSourceCount(source))
    .filter(count => count !== null && Number.isFinite(count));
  if (counts.length === 0) {
    return 'unknown';
  }
  if (attackType === 'sniper') {
    return counts.reduce((sum, value) => sum + value, 0);
  }
  if (attackType === 'pitchfork') {
    return Math.min(...counts);
  }
  return counts.reduce((total, value) => total * value, 1);
}

function insertMarker(ref, value, setValue, fallbackLabel) {
  const node = ref.current;
  if (!node) {
    setValue(prev => `${prev}§${fallbackLabel}§`);
    return;
  }

  const start = typeof node.selectionStart === 'number' ? node.selectionStart : value.length;
  const end = typeof node.selectionEnd === 'number' ? node.selectionEnd : start;
  const selected = value.slice(start, end) || fallbackLabel;
  const nextValue = `${value.slice(0, start)}§${selected}§${value.slice(end)}`;
  setValue(nextValue);
  requestAnimationFrame(() => {
    node.focus();
    const cursor = start + selected.length + 2;
    node.setSelectionRange(cursor, cursor);
  });
}

function sortResults(results, sortBy, sortDirection) {
  const sorted = [...results];
  sorted.sort((left, right) => {
    const leftCandidate = left?.[sortBy];
    const rightCandidate = right?.[sortBy];
    const leftValue = leftCandidate == null ? 0 : leftCandidate;
    const rightValue = rightCandidate == null ? 0 : rightCandidate;
    if (leftValue === rightValue) {
      return 0;
    }
    if (sortDirection === 'asc') {
      return leftValue > rightValue ? 1 : -1;
    }
    return leftValue < rightValue ? 1 : -1;
  });
  return sorted;
}

function buildAttackFromProgress(payload, context) {
  return {
    id: payload.attackId,
    status: payload.status || 'running',
    attackType: context.attackType,
    positionCount: context.markersLength,
    requestSummary: `${context.method} ${context.url}`,
    sent: payload.sent,
    total: payload.total,
    anomalousCount: payload.lastResult?.isAnomalous ? 1 : 0,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function updateAttacksWithProgress(previousAttacks, payload, context) {
  const next = previousAttacks.map(item => {
    if (item.id !== payload.attackId) {
      return item;
    }
    return {
      ...item,
      sent: payload.sent,
      total: payload.total,
      status: payload.status || (payload.sent >= payload.total ? 'completed' : item.status),
      updatedAt: Date.now(),
      anomalousCount: item.anomalousCount + (payload.lastResult?.isAnomalous ? 1 : 0),
    };
  });

  const exists = next.some(item => item.id === payload.attackId);
  if (exists) {
    return next;
  }
  return [buildAttackFromProgress(payload, context), ...next];
}

function appendLastResultIfMissing(previousResults, lastResult) {
  const normalized = normalizeIntruderResult(lastResult);
  if (!normalized) {
    return previousResults;
  }
  const exists = previousResults.some(item => item.id === normalized.id);
  if (exists) {
    return previousResults;
  }
  return [...previousResults, normalized];
}

function normalizeIntruderResult(result) {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const anomalyReasons = Array.isArray(result.anomalyReasons)
    ? result.anomalyReasons.map(reason => String(reason || '')).filter(Boolean)
    : [];

  const id = result.id ? String(result.id) : `result-${result.attackId || 'unknown'}-${result.position || 0}-${result.payload || ''}`;
  return {
    ...result,
    id,
    payload: result.payload == null ? '' : String(result.payload),
    statusCode: Number.isFinite(Number(result.statusCode)) ? Number(result.statusCode) : 0,
    length: Number.isFinite(Number(result.length)) ? Number(result.length) : 0,
    duration: Number.isFinite(Number(result.duration)) ? Number(result.duration) : 0,
    isAnomalous: Boolean(result.isAnomalous),
    anomalyReasons,
  };
}

function getProgressBadgeStyle(status) {
  if (status === 'completed') {
    return { borderColor: 'green.500', bg: 'rgba(34,197,94,0.1)' };
  }
  if (status === 'stopped') {
    return { borderColor: 'orange.500', bg: 'rgba(249,115,22,0.1)' };
  }
  return { borderColor: 'blue.500', bg: 'rgba(59,130,246,0.1)' };
}

function filterResults(results, filters) {
  return results.filter(result => {
    if (filters.statusCode && Number(result.statusCode) !== Number(filters.statusCode)) {
      return false;
    }
    if (filters.maxLength && Number(result.length) > Number(filters.maxLength)) {
      return false;
    }
    if (filters.maxDuration && Number(result.duration) > Number(filters.maxDuration)) {
      return false;
    }
    if (filters.anomaliesOnly && !result.isAnomalous) {
      return false;
    }
    return true;
  });
}

function IntruderPanel({ themeId }) {
  const sentinel = globalThis?.window?.sentinel || null;
  const urlRef = React.useRef(null);
  const headersRef = React.useRef(null);
  const bodyRef = React.useRef(null);

  const [attacks, setAttacks] = React.useState([]);
  const [selectedAttackId, setSelectedAttackId] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [loadingResults, setLoadingResults] = React.useState(false);
  const [noticeText, setNoticeText] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [progress, setProgress] = React.useState({ sent: 0, total: 0, status: 'idle' });

  const [method, setMethod] = React.useState('GET');
  const [url, setUrl] = React.useState('https://example.com/search?q=§payload§');
  const [headersText, setHeadersText] = React.useState('host: example.com\nuser-agent: Sentinel Intruder');
  const [body, setBody] = React.useState('');
  const [attackType, setAttackType] = React.useState('sniper');
  const [positionSources, setPositionSources] = React.useState([]);

  const [sortBy, setSortBy] = React.useState('duration');
  const [sortDirection, setSortDirection] = React.useState('desc');
  const [filters, setFilters] = React.useState({
    statusCode: '',
    maxLength: '',
    maxDuration: '',
    anomaliesOnly: false,
  });

  const markers = detectMarkers({ url, headersText, body });

  React.useEffect(() => {
    setPositionSources(prev => markers.map((marker, index) => ({
      marker,
      source: prev[index]?.source || buildDefaultSource(marker),
    })));
  }, [url, headersText, body]);

  const loadAttacks = React.useCallback(async () => {
    if (typeof sentinel?.intruder?.list !== 'function') {
      return;
    }
    const result = await sentinel.intruder.list();
    const items = Array.isArray(result.items) ? result.items : [];
    setAttacks(items);
    if (!selectedAttackId && items.length > 0) {
      setSelectedAttackId(items[0].id);
    }
  }, [sentinel, selectedAttackId]);

  const loadResults = React.useCallback(async (attackId) => {
    if (!attackId || !sentinel?.intruder) {
      return;
    }
    setLoadingResults(true);
    setErrorText('');
    try {
      const result = await sentinel.intruder.results({ attackId, page: 0, pageSize: 500 });
      setResults(prev => {
        const fetched = Array.isArray(result.results)
          ? result.results.map(item => normalizeIntruderResult(item)).filter(Boolean)
          : [];
        if (fetched.length === 0) {
          return prev;
        }
        const merged = [...fetched];
        for (const item of prev) {
          if (!merged.some(existing => existing.id === item.id)) {
            merged.push(item);
          }
        }
        return merged;
      });
      const attack = attacks.find(item => item.id === attackId);
      if (attack) {
        setProgress({ sent: attack.sent, total: attack.total, status: attack.status });
      }
    } catch {
      setErrorText('Unable to load intruder results.');
    } finally {
      setLoadingResults(false);
    }
  }, [attacks, sentinel]);

  React.useEffect(() => {
    if (!sentinel?.intruder) {
      return undefined;
    }

    loadAttacks().catch(() => {});
    const progressContext = {
      attackType,
      markersLength: markers.length,
      method,
      url,
    };

    if (typeof sentinel.intruder.onProgress !== 'function') {
      return undefined;
    }

    const unsubscribe = sentinel.intruder.onProgress((payload) => {
      if (!payload?.attackId) {
        return;
      }

      setAttacks(prev => updateAttacksWithProgress(prev, payload, progressContext));

      if (payload.attackId === selectedAttackId) {
        setProgress({ sent: payload.sent, total: payload.total, status: payload.status || 'running' });
        setResults(prev => appendLastResultIfMissing(prev, payload.lastResult));
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [attackType, loadAttacks, markers.length, method, selectedAttackId, sentinel, url]);

  React.useEffect(() => {
    if (selectedAttackId) {
      loadResults(selectedAttackId).catch(() => {});
    }
  }, [selectedAttackId, loadResults]);

  function updatePositionSource(index, patch) {
    setPositionSources(prev => prev.map((entry, entryIndex) => {
      if (entryIndex !== index) {
        return entry;
      }
      return {
        ...entry,
        source: {
          ...entry.source,
          ...patch,
        },
      };
    }));
  }

  async function startAttack() {
    if (!sentinel?.intruder) {
      return;
    }
    if (markers.length === 0) {
      setErrorText('Mark at least one payload position using §markers§ before starting an attack.');
      return;
    }

    setErrorText('');
    setNoticeText('');
    setResults([]);
    try {
      const config = {
        requestTemplate: {
          method,
          url,
          headers: headersTextToObject(headersText),
          body: body || null,
        },
        attackType,
        positions: positionSources.map(entry => {
          const source = { ...entry.source };
          if (source.type === 'dictionary') {
            if (!source.filePath) {
              source.text = source.text || '';
            }
          }
          return { source };
        }),
      };

      const configured = await sentinel.intruder.configure({ config });
      const started = await sentinel.intruder.start({ configId: configured.configId });
      setSelectedAttackId(started.attackId);
      setProgress({ sent: 0, total: 0, status: 'running' });
      setNoticeText('Intruder attack started.');
      await loadAttacks();
    } catch (error) {
      setErrorText(error?.message || 'Unable to start intruder attack.');
    }
  }

  async function stopSelectedAttack() {
    if (!sentinel?.intruder || !selectedAttackId) {
      return;
    }
    setErrorText('');
    setNoticeText('');
    try {
      await sentinel.intruder.stop({ attackId: selectedAttackId });
      setNoticeText('Stop requested for intruder attack.');
      await loadAttacks();
    } catch {
      setErrorText('Unable to stop intruder attack.');
    }
  }

  const filteredResults = filterResults(sortResults(results, sortBy, sortDirection), filters);
  const selectedAttack = attacks.find(item => item.id === selectedAttackId) || null;
  const estimatedTotal = estimateAttackTotal(attackType, positionSources.map(entry => entry.source));
  const progressBadgeStyle = getProgressBadgeStyle(progress.status);

  return (
    <Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='sm' borderColor='border.default'>
      <VStack align='stretch' spacing={4}>
        <Flex justify='space-between' align='center' mb='1' pb='3' borderBottomWidth='1px' borderColor='border.default'>
          <Text fontWeight='medium' fontSize='sm'>Intruder</Text>
          <HStack gap='2'>
            <Button size='xs' variant='outline' onClick={() => loadAttacks().catch(() => {})}>Refresh</Button>
            <Button size='xs' variant='outline' colorPalette='red' onClick={stopSelectedAttack} disabled={!selectedAttackId}>Stop Attack</Button>
          </HStack>
        </Flex>

        <HStack align='flex-start' spacing={4} wrap='wrap'>
          <Box minW='220px' flex='0 0 220px'>
            <Text fontWeight='semibold' fontSize='sm' mb={2}>Attacks</Text>
            <VStack align='stretch' spacing={1} maxH='360px' overflowY='auto'>
              {attacks.length === 0 ? <Text fontSize='xs' color='fg.muted'>No attacks yet.</Text> : null}
              {attacks.map(attack => (
                <Button
                  key={attack.id}
                  size='xs'
                  variant={selectedAttackId === attack.id ? 'solid' : 'ghost'}
                  textAlign='left'
                  height='auto'
                  py={2}
                  onClick={() => {
                    setResults([]);
                    setSelectedAttackId(attack.id);
                  }}
                >
                  <VStack align='start' spacing={0}>
                    <Text fontSize='xs' fontFamily='mono'>{attack.requestSummary}</Text>
                    <Text fontSize='xs' color='fg.muted'>
                      {attack.attackType} · {attack.sent}/{attack.total} · {attack.status}
                    </Text>
                  </VStack>
                </Button>
              ))}
            </VStack>
          </Box>

          <Box flex='1' minW='320px'>
            <VStack align='stretch' spacing={3}>
              <HStack wrap='wrap'>
                <Input value={method} onChange={event => setMethod(event.target.value.toUpperCase())} maxW='100px' fontFamily='mono' size='sm' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                <Input ref={urlRef} value={url} onChange={event => setUrl(event.target.value)} placeholder='https://target/path?x=§payload§' fontFamily='mono' size='sm' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                <Button size='xs' variant='outline' onClick={() => insertMarker(urlRef, url, setUrl, 'payload')}>Mark URL</Button>
              </HStack>

              <Textarea ref={headersRef} value={headersText} onChange={event => setHeadersText(event.target.value)} rows={4} fontFamily='mono' fontSize='xs' placeholder='host: example.com' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
              <HStack justify='space-between' wrap='wrap'>
                <Text fontSize='xs' color='fg.muted'>Header values can also contain <Code color='fg.default' bg='bg.subtle'>§markers§</Code>.</Text>
                <Button size='xs' variant='outline' onClick={() => insertMarker(headersRef, headersText, setHeadersText, 'header-value')}>Mark Headers</Button>
              </HStack>

              <Textarea ref={bodyRef} value={body} onChange={event => setBody(event.target.value)} rows={6} fontFamily='mono' fontSize='xs' placeholder='Request body with §payload§ markers' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
              <HStack justify='space-between' wrap='wrap'>
                <Text fontSize='xs' color='fg.muted'>Detected positions: <Code color='fg.default' bg='bg.subtle'>{markers.length}</Code> · Estimated requests: <Code color='fg.default' bg='bg.subtle'>{String(estimatedTotal)}</Code></Text>
                <Button size='xs' variant='outline' onClick={() => insertMarker(bodyRef, body, setBody, 'payload')}>Mark Body</Button>
              </HStack>

              <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
                <Text fontWeight='semibold' fontSize='sm' mb={2}>Attack Profile</Text>
                <Box
                  as='select'
                  size='xs'
                  value={attackType}
                  onChange={event => setAttackType(event.target.value)}
                  color='fg.default'
                  bg='bg.surface'
                  borderColor='border.default'
                  borderWidth='1px'
                  borderRadius='sm'
                  px='2'
                  h='1.75rem'
                >
                  <option value='sniper'>Single-point / Sniper</option>
                  <option value='pitchfork'>Pitchfork</option>
                  <option value='cluster-bomb'>Cluster Bomb</option>
                </Box>
              </Box>

              <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
                <Text fontWeight='semibold' fontSize='sm' mb={2}>Payload Sources</Text>
                <VStack align='stretch' spacing={3}>
                {positionSources.length === 0 ? <Text fontSize='xs' color='fg.muted'>Add at least one <Code color='fg.default' bg='bg.subtle'>§marker§</Code> in URL, headers, or body.</Text> : null}
                  {positionSources.map((entry, index) => {
                    const source = entry.source;
                    return (
                      <Box key={entry.marker.id} borderWidth='1px' borderRadius='sm' borderColor='border.default' p={2}>
                      <Text fontSize='xs' fontWeight='semibold' mb={2}>{entry.marker.label} · default <Code color='fg.default' bg='bg.subtle'>{entry.marker.defaultValue}</Code></Text>
                        <Box
                          as='select'
                          size='xs'
                          value={source.type}
                          onChange={event => updatePositionSource(index, { type: event.target.value })}
                          mb={2}
                          color='fg.default'
                          bg='bg.surface'
                          borderColor='border.default'
                          borderWidth='1px'
                          borderRadius='sm'
                          px='2'
                          h='1.75rem'
                        >
                          <option value='dictionary'>Dictionary</option>
                          <option value='bruteforce'>Brute-force charset</option>
                          <option value='sequential'>Sequential numeric</option>
                        </Box>

                        {source.type === 'dictionary' ? (
                          <VStack align='stretch' spacing={2}>
                            <Input size='xs' placeholder='Optional dictionary file path' value={source.filePath || ''} onChange={event => updatePositionSource(index, { filePath: event.target.value })} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                            <Textarea size='xs' rows={4} placeholder='Or inline payloads, one per line' value={source.text || ''} onChange={event => updatePositionSource(index, { text: event.target.value })} fontFamily='mono' fontSize='xs' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                          </VStack>
                        ) : null}

                        {source.type === 'bruteforce' ? (
                          <HStack wrap='wrap'>
                            <Input size='xs' maxW='160px' placeholder='Charset' value={source.charset || ''} onChange={event => updatePositionSource(index, { charset: event.target.value })} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                            <Input size='xs' maxW='100px' type='number' placeholder='Min' value={source.minLength} onChange={event => updatePositionSource(index, { minLength: event.target.value })} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                            <Input size='xs' maxW='100px' type='number' placeholder='Max' value={source.maxLength} onChange={event => updatePositionSource(index, { maxLength: event.target.value })} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                          </HStack>
                        ) : null}

                        {source.type === 'sequential' ? (
                          <HStack wrap='wrap'>
                            <Input size='xs' maxW='100px' type='number' placeholder='Start' value={source.start} onChange={event => updatePositionSource(index, { start: event.target.value })} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                            <Input size='xs' maxW='100px' type='number' placeholder='End' value={source.end} onChange={event => updatePositionSource(index, { end: event.target.value })} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                            <Input size='xs' maxW='100px' type='number' placeholder='Step' value={source.step} onChange={event => updatePositionSource(index, { step: event.target.value })} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                            <Input size='xs' maxW='100px' type='number' placeholder='Pad' value={source.padTo} onChange={event => updatePositionSource(index, { padTo: event.target.value })} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                          </HStack>
                        ) : null}
                      </Box>
                    );
                  })}
                </VStack>
              </Box>

              <HStack justify='space-between' wrap='wrap'>
                <Text fontSize='xs' color='fg.muted'>Selected attack: <Code color='fg.default' bg='bg.subtle'>{selectedAttack ? selectedAttack.requestSummary : 'none'}</Code></Text>
                <Button size='sm' colorPalette='red' onClick={startAttack}>Start Attack</Button>
              </HStack>

              <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
                <HStack justify='space-between' wrap='wrap' mb={2}>
                  <Text fontWeight='semibold' fontSize='sm'>Live Results</Text>
                  <HStack>
                <Badge 
                  variant='outline' 
                  color='var(--sentinel-fg-default)' 
                  borderColor={progressBadgeStyle.borderColor} 
                  bg={progressBadgeStyle.bg}
                >
                  {progress.status}
                </Badge>
                    <Text fontSize='xs' color='fg.muted'>{progress.sent} / {progress.total || (selectedAttack ? selectedAttack.total : 0)} sent</Text>
                  </HStack>
                </HStack>

                <HStack wrap='wrap' mb={2}>
                  <Input size='xs' maxW='120px' placeholder='Status' value={filters.statusCode} onChange={event => setFilters(prev => ({ ...prev, statusCode: event.target.value }))} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                  <Input size='xs' maxW='140px' placeholder='Max length' value={filters.maxLength} onChange={event => setFilters(prev => ({ ...prev, maxLength: event.target.value }))} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                  <Input size='xs' maxW='160px' placeholder='Max duration ms' value={filters.maxDuration} onChange={event => setFilters(prev => ({ ...prev, maxDuration: event.target.value }))} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
                  <Button size='xs' variant={filters.anomaliesOnly ? 'solid' : 'outline'} onClick={() => setFilters(prev => ({ ...prev, anomaliesOnly: !prev.anomaliesOnly }))}>Anomalies Only</Button>
                  <Box as='select' size='xs' value={sortBy} onChange={event => setSortBy(event.target.value)} color='fg.default' bg='bg.surface' borderColor='border.default' borderWidth='1px' borderRadius='sm' px='2' h='1.75rem'>
                    <option value='duration'>Sort by Duration</option>
                    <option value='statusCode'>Sort by Status</option>
                    <option value='length'>Sort by Length</option>
                  </Box>
                  <Box as='select' size='xs' value={sortDirection} onChange={event => setSortDirection(event.target.value)} color='fg.default' bg='bg.surface' borderColor='border.default' borderWidth='1px' borderRadius='sm' px='2' h='1.75rem'>
                    <option value='desc'>Desc</option>
                    <option value='asc'>Asc</option>
                  </Box>
                </HStack>

                {loadingResults ? <Text fontSize='xs' color='fg.muted'>Loading results...</Text> : null}
                {!loadingResults && filteredResults.length === 0 ? <Text fontSize='xs' color='fg.muted'>No results for the selected attack.</Text> : null}
                {filteredResults.length > 0 ? (
                  <Box overflowX='auto'>
                    <Box as='table' w='100%' fontSize='xs' css={{ borderCollapse: 'collapse' }}>
                      <Box as='thead'>
                        <Box as='tr'>
                          <Box as='th' textAlign='left' p={1.5} color='fg.muted'>Payload</Box>
                          <Box as='th' textAlign='left' p={1.5} color='fg.muted'>Status</Box>
                          <Box as='th' textAlign='left' p={1.5} color='fg.muted'>Length</Box>
                          <Box as='th' textAlign='left' p={1.5} color='fg.muted'>Time</Box>
                          <Box as='th' textAlign='left' p={1.5} color='fg.muted'>Anomaly</Box>
                        </Box>
                      </Box>
                      <Box as='tbody'>
                        {filteredResults.map(result => (
                          <Box as='tr' key={result.id} borderTopWidth='1px' borderColor='border.default'>
                            <Box as='td' p={1.5} fontFamily='mono'>{result.payload}</Box>
                            <Box as='td' p={1.5}><Code color='fg.default' bg='bg.subtle'>{result.statusCode}</Code></Box>
                            <Box as='td' p={1.5}>{result.length}</Box>
                            <Box as='td' p={1.5}>{result.duration}ms</Box>
                            <Box as='td' p={1.5}>
                              {result.isAnomalous ? (
                                <Badge variant='outline' color='var(--sentinel-fg-default)' borderColor='orange.500' bg='rgba(249,115,22,0.1)'>{result.anomalyReasons.join(', ') || 'anomalous'}</Badge>
                              ) : (
                                <Badge variant='outline' color='var(--sentinel-fg-default)' borderColor='green.500' bg='rgba(34,197,94,0.1)'>baseline</Badge>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                ) : null}
              </Box>

              {errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
              {noticeText ? <Text color={getStatusTextColor('success', themeId)} fontSize='sm'>{noticeText}</Text> : null}
            </VStack>
          </Box>
        </HStack>
      </VStack>
    </Box>
  );
}

IntruderPanel.propTypes = {
  themeId: PropTypes.string,
};

export default IntruderPanel;

\\n
## File: src\renderer\js\components\sentinel\OobPanel.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

const LOOPBACK_PATTERN = /^https?:\/\/(127\.\d+\.\d+\.\d+|::1|\[::1\]|localhost)(:\d+)?\//i;

function isLoopbackUrl(url) {
  return typeof url === 'string' && LOOPBACK_PATTERN.test(url);
}

function OobPanel({ themeId }) {
  const sentinel = globalThis?.window?.sentinel || null;
  const [payloadType, setPayloadType] = React.useState('http');
  const [sourceRequestId, setSourceRequestId] = React.useState('');
  const [sourceScanId, setSourceScanId] = React.useState('');
  const [targetUrl, setTargetUrl] = React.useState('');
  const [payloads, setPayloads] = React.useState([]);
  const [selectedPayloadId, setSelectedPayloadId] = React.useState('');
  const [hits, setHits] = React.useState([]);
  const [statusText, setStatusText] = React.useState('Idle');
  const [errorText, setErrorText] = React.useState('');

  React.useEffect(() => {
    if (typeof sentinel?.oob?.onHit !== 'function') {
      return undefined;
    }

    const unsubscribe = sentinel.oob.onHit((hit) => {
      if (!hit) {
        return;
      }
      setHits(prev => [hit, ...prev]);
      setStatusText(`Callback received from ${hit.source || 'unknown source'}`);
    });

    return unsubscribe;
  }, [sentinel]);

  async function createPayload() {
    if (!sentinel?.oob) {
      return;
    }

    setErrorText('');
    try {
      const payload = await sentinel.oob.createPayload({
        type: payloadType,
        sourceRequestId: sourceRequestId || undefined,
        sourceScanId: sourceScanId || undefined,
        targetUrl: targetUrl || undefined,
      });

      setPayloads(prev => [payload, ...prev]);
      setSelectedPayloadId(payload.id);
      setStatusText('New OOB payload generated.');
      await loadHits(payload.id);
    } catch (error) {
      setErrorText(error?.message || 'Unable to create OOB payload.');
    }
  }

  async function loadHits(payloadId = selectedPayloadId) {
    if (!sentinel?.oob || !payloadId) {
      return;
    }

    setErrorText('');
    try {
      const result = await sentinel.oob.listHits({ id: payloadId, page: 0, pageSize: 200 });
      setHits(Array.isArray(result.hits) ? result.hits : []);
      setStatusText(`Loaded callbacks for payload ${payloadId}`);
    } catch (error) {
      setErrorText(error?.message || 'Unable to load OOB callbacks.');
    }
  }

  return (
    <Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='sm' borderColor='border.default'>
      <VStack align='stretch' spacing={3}>
        <Flex justify='space-between' align='center' pb='3' borderBottomWidth='1px' borderColor='border.default'>
          <Text fontWeight='medium' fontSize='sm' color='fg.default'>OOB</Text>
          <HStack gap='2'>
            <Button size='xs' variant='outline' onClick={createPayload} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Generate Payload</Button>
            <Button size='xs' variant='outline' onClick={() => loadHits()} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Refresh Hits</Button>
          </HStack>
        </Flex>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2} color='fg.default'>Payload Generator</Text>
          <HStack>
            <Input value={payloadType} onChange={event => setPayloadType(event.target.value)} placeholder='Type: http | dns | smtp' maxW='180px' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
            <Input value={sourceRequestId} onChange={event => setSourceRequestId(event.target.value)} placeholder='Source request ID (optional)' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
          </HStack>
          <HStack mt={2}>
            <Input value={sourceScanId} onChange={event => setSourceScanId(event.target.value)} placeholder='Source scan ID (optional)' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
            <Input value={targetUrl} onChange={event => setTargetUrl(event.target.value)} placeholder='Target URL (optional)' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
          </HStack>
          <Button mt={3} size='sm' colorPalette='blue' onClick={createPayload}>Create Payload</Button>
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm' color='fg.default'>Generated Payloads</Text>
            <Code color='fg.default' bg='bg.subtle'>{payloads.length}</Code>
          </HStack>
          {payloads.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>No payloads generated yet.</Text>
          ) : payloads.map((payload) => (
            <Box key={payload.id} borderWidth='1px' borderRadius='sm' borderColor='border.default' p={2} mb={2}>
              <HStack justify='space-between'>
                <Code color='fg.default' bg='bg.subtle'>{payload.id}</Code>
                <Badge variant='outline' color='var(--sentinel-fg-default)' borderColor='border.default' bg='bg.subtle'>{payload.kind || payloadType}</Badge>
              </HStack>
              <Text fontSize='sm' color='fg.muted'>{payload.url}</Text>
              {isLoopbackUrl(payload.url) ? (
                // Loopback listener — external targets cannot reach 127.x / ::1 addresses.
                <Text fontSize='xs' color='severity.high' mt={1}>
                  Listener is bound to a loopback address. External targets cannot deliver callbacks to this URL. Configure a routable listener host to receive out-of-band interactions.
                </Text>
              ) : null}
              <Text fontSize='xs' color='fg.muted'>Domain marker: <Code color='fg.default' bg='bg.subtle'>{payload.domain}</Code></Text>
              <Button mt={2} size='xs' variant='outline' color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }} onClick={() => {
                setSelectedPayloadId(payload.id);
                loadHits(payload.id).catch(() => {});
              }}>
                View Callbacks
              </Button>
            </Box>
          ))}
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm' color='fg.default'>Callbacks</Text>
            <Code color='fg.default' bg='bg.subtle'>{hits.length}</Code>
          </HStack>
          {hits.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>No callbacks recorded for the selected payload.</Text>
          ) : hits.map((hit) => (
            <Box key={hit.id} borderWidth='1px' borderRadius='sm' borderColor='border.default' p={2} mb={2}>
              <HStack justify='space-between'>
                <Code color='fg.default' bg='bg.subtle'>{hit.id}</Code>
                <Badge variant='outline' color='var(--sentinel-fg-default)' borderColor='green.500' bg='rgba(34,197,94,0.1)'>{hit.kind || 'http'}</Badge>
              </HStack>
              <Text fontSize='sm' color='fg.default'>Source: <Code color='fg.default' bg='bg.subtle'>{hit.source || 'unknown'}</Code></Text>
              <Text fontSize='sm' color='fg.default'>Path: <Code color='fg.default' bg='bg.subtle'>{hit.requestPath || '/'}</Code></Text>
              {hit.correlation ? (
                <Text fontSize='xs' color='fg.muted'>
                  Correlation: request=<Code color='fg.default' bg='bg.subtle'>{hit.correlation.sourceRequestId || 'n/a'}</Code>,
                  scan=<Code color='fg.default' bg='bg.subtle'>{hit.correlation.sourceScanId || 'n/a'}</Code>
                </Text>
              ) : null}
            </Box>
          ))}
        </Box>

        <Text fontSize='sm' color={getStatusTextColor('info', themeId)}>{statusText}</Text>
        {errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
      </VStack>
    </Box>
  );
}

OobPanel.propTypes = {
  themeId: PropTypes.string,
};

export default OobPanel;

\\n
## File: src\renderer\js\components\sentinel\ProxyPanel.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
	Badge,
	Box,
	Button,
	Code,
	Flex,
	HStack,
	Input,
	Separator,
	Text,
	VStack,
} from '@chakra-ui/react';
import MonacoEditor from '@monaco-editor/react';
import { FixedSizeList } from 'react-window';
import { getMonacoTheme, getStatusTextColor } from './theme-utils';

const ROW_HEIGHT = 34;

function buildRawRequest(pathOverride, bodyOverride, request = {}) {
	const safeRequest = request;
	const headers = Object.entries(safeRequest.headers || {})
		.map(([key, value]) => `${key}: ${value}`)
		.join('\n');
	let renderedBody = safeRequest.body || '';
	if (bodyOverride !== undefined && bodyOverride !== null) {
		renderedBody = bodyOverride;
	}
	const renderedPath = pathOverride || safeRequest.path || '/';
	return [
		`${safeRequest.method || 'GET'} ${renderedPath} ${safeRequest.protocol || 'HTTP/1.1'}`,
		headers,
		'',
		renderedBody,
	].join('\n');
}

function enqueueRequest(previousQueue, request) {
	if (previousQueue.some(item => item.id === request.id)) {
		return previousQueue;
	}
	return [request, ...previousQueue];
}

function removeQueueRequest(previousQueue, requestId) {
	return previousQueue.filter(item => item.id !== requestId);
}

function ProxyQueue(props) {
	const { queue, selectedId, onSelect } = props;
	const renderRow = ({ index, style }) => {
		const item = queue[index];
		const isSelected = item.id === selectedId;
		return (
			<Flex
				style={style}
				px='2'
				align='center'
				bg={isSelected ? 'bg.subtle' : 'transparent'}
				borderBottomWidth='1px'
				borderColor='border.default'
				fontFamily='mono'
				fontSize='xs'
				cursor='pointer'
				onClick={() => onSelect(item.id)}
			>
				<Box flex='0 0 64px' px='2'>{item.method || 'GET'}</Box>
				<Box flex='0 0 180px' px='2' overflow='hidden' textOverflow='ellipsis' whiteSpace='nowrap'>{item.host || 'unknown-host'}</Box>
				<Box flex='1' px='2' overflow='hidden' textOverflow='ellipsis' whiteSpace='nowrap'>{item.path || '/'}</Box>
			</Flex>
		);
	};

	return (
		<FixedSizeList height={420} itemCount={queue.length} itemSize={ROW_HEIGHT} width='100%'>
			{renderRow}
		</FixedSizeList>
	);
}

function ProxyInspector(props) {
	const {
		selected,
		editPath,
		setEditPath,
		editBody,
		setEditBody,
		inspectorTab,
		setInspectorTab,
		themeId,
		rawRequest,
		forwardSelected,
		sendSelectedToRepeater,
		dropSelected,
	} = props;

	const isEditMode = inspectorTab === 'edit';
	const rawButtonVariant = inspectorTab === 'raw' ? 'solid' : 'outline';
	const rawButtonColor = inspectorTab === 'raw' ? 'fg.default' : 'fg.muted';
	const rawButtonBg = inspectorTab === 'raw' ? 'bg.subtle' : 'bg.surface';
	const editButtonVariant = isEditMode ? 'solid' : 'outline';
	const editButtonColor = isEditMode ? 'fg.default' : 'fg.muted';
	const editButtonBg = isEditMode ? 'bg.subtle' : 'bg.surface';

	if (!selected) {
		return (
			<Box p='4'>
				<Text color='fg.muted' fontSize='sm'>Select a paused request to inspect or edit it before forwarding.</Text>
			</Box>
		);
	}

	return (
		<VStack align='stretch' spacing={3} p='3' h='100%'>
			<HStack justify='space-between' wrap='wrap'>
				<Box>
					<Text fontWeight='semibold'>{selected.method} {selected.host}{selected.path}</Text>
					<Text fontSize='xs' color='fg.muted'>Request ID <Code color='fg.default' bg='bg.subtle'>{selected.id}</Code></Text>
				</Box>
				<HStack>
					<Button size='xs' variant={rawButtonVariant} onClick={() => setInspectorTab('raw')} color={rawButtonColor} bg={rawButtonBg} borderColor='border.default' _hover={{ bg: 'bg.subtle', color: 'fg.default' }}>Raw</Button>
					<Button size='xs' variant={editButtonVariant} onClick={() => setInspectorTab('edit')} color={editButtonColor} bg={editButtonBg} borderColor='border.default' _hover={{ bg: 'bg.subtle', color: 'fg.default' }}>Edit</Button>
				</HStack>
			</HStack>
			{isEditMode ? (
				<VStack align='stretch' spacing={2}>
					<Input size='sm' value={editPath} onChange={event => setEditPath(event.target.value)} placeholder='Path' fontFamily='mono' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
					<Box flex='1' minH='240px' borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' overflow='hidden'>
						<MonacoEditor
							height='240px'
							defaultLanguage='text'
							theme={getMonacoTheme(themeId)}
							value={editBody}
							onChange={value => setEditBody(value || '')}
							options={{ minimap: { enabled: false }, wordWrap: 'on', fontSize: 12 }}
						/>
					</Box>
				</VStack>
			) : (
				<Box flex='1' minH='240px' borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' overflow='hidden'>
					<MonacoEditor
						height='240px'
						defaultLanguage='http'
						theme={getMonacoTheme(themeId)}
						value={rawRequest}
						options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', fontSize: 12 }}
					/>
				</Box>
			)}
			<Separator />
			<HStack>
				<Button size='sm' colorPalette='green' onClick={forwardSelected}>Forward</Button>
				<Button size='sm' variant='outline' onClick={sendSelectedToRepeater} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Send to Repeater</Button>
				<Button size='sm' colorPalette='red' variant='outline' onClick={dropSelected} bg='bg.surface' _hover={{ bg: 'bg.subtle' }}>Drop</Button>
			</HStack>
		</VStack>
	);
}

function ProxyPanel(props) {
	const { themeId } = props;
	const [status, setStatus] = React.useState({ running: false, port: 8080, intercepting: true });
	const [queue, setQueue] = React.useState([]);
	const [selectedId, setSelectedId] = React.useState('');
	const [editPath, setEditPath] = React.useState('');
	const [editBody, setEditBody] = React.useState('');
	const [errorText, setErrorText] = React.useState('');
	const [noticeText, setNoticeText] = React.useState('');
	const [inspectorTab, setInspectorTab] = React.useState('raw');
	const queueRef = React.useRef([]);

	const setQueueAndRef = React.useCallback((nextQueue) => {
		queueRef.current = nextQueue;
		setQueue(nextQueue);
	}, []);

	React.useEffect(() => {
		queueRef.current = queue;
	}, [queue]);

	const selected = queue.find(item => item.id === selectedId) || null;

	React.useEffect(() => {
		let cancelled = false;
		const sentinel = globalThis?.window?.sentinel;
		const proxyApi = sentinel?.proxy;
		if (!proxyApi) {
			return undefined;
		}

		async function bootstrap() {
			try {
				const currentStatus = await proxyApi.status();
				if (!cancelled) {
					setStatus(currentStatus);
				}
			} catch {
				if (!cancelled) {
					setErrorText('Unable to load proxy status.');
				}
			}
		}

		bootstrap();

		const unsubscribe = proxyApi.intercept.onRequest((request) => {
			if (cancelled || !request?.id) {
				return;
			}
			const nextQueue = enqueueRequest(queueRef.current, request);
			setQueueAndRef(nextQueue);
		});

		const unsubscribeResponse = proxyApi.intercept.onResponse((response) => {
			if (cancelled || !response?.requestId) {
				return;
			}

			const nextQueue = removeQueueRequest(queueRef.current, response.requestId);
			setQueueAndRef(nextQueue);
			setSelectedId(prev => (prev === response.requestId ? '' : prev));
		});

		const unsubscribeError = proxyApi.intercept.onError((payload) => {
			if (cancelled || !payload) {
				return;
			}

			const requestId = payload.requestId || '';
			const message = payload.error || 'Unable to forward selected request.';
			setErrorText(requestId ? `Forward failed for ${requestId}: ${message}` : message);
		});

		return () => {
			cancelled = true;
			if (typeof unsubscribe === 'function') {
				unsubscribe();
			}
			if (typeof unsubscribeResponse === 'function') {
				unsubscribeResponse();
			}
			if (typeof unsubscribeError === 'function') {
				unsubscribeError();
			}
		};
	}, [setQueueAndRef]);

	React.useEffect(() => {
		if (!selected) {
			setEditPath('');
			setEditBody('');
			return;
		}

		setEditPath(selected.path || '/');
		setEditBody(selected.body || '');
	}, [selectedId]);

	async function startProxy() {
		const sentinel = globalThis?.window?.sentinel;
		const proxyApi = sentinel?.proxy;
		if (!proxyApi) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			const running = await proxyApi.start({ port: status.port || 8080 });
			setStatus(prev => ({ ...prev, running: true, port: running.port }));
		} catch {
			setErrorText('Unable to start proxy listener.');
		}
	}

	async function stopProxy() {
		const sentinel = globalThis?.window?.sentinel;
		const proxyApi = sentinel?.proxy;
		if (!proxyApi) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			await proxyApi.stop();
			setStatus(prev => ({ ...prev, running: false }));
		} catch {
			setErrorText('Unable to stop proxy listener.');
		}
	}

	async function toggleIntercept() {
		const sentinel = globalThis?.window?.sentinel;
		const proxyApi = sentinel?.proxy;
		if (!proxyApi) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			const next = await proxyApi.intercept.toggle({ enabled: !status.intercepting });
			setStatus(prev => ({ ...prev, intercepting: next.intercepting }));
		} catch {
			setErrorText('Unable to toggle intercept mode.');
		}
	}

	async function forwardSelected() {
		const sentinel = globalThis?.window?.sentinel;
		const proxyApi = sentinel?.proxy;
		if (!proxyApi || !selected) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			await proxyApi.intercept.forward({
				requestId: selected.id,
				editedRequest: {
					path: editPath,
					body: editBody,
				},
			});
			const afterForward = queueRef.current.filter(item => item.id !== selected.id);
			setQueueAndRef(afterForward);
			setSelectedId('');
			setNoticeText('Forwarded selected request.');
		} catch {
			setErrorText('Unable to forward selected request.');
		}
	}

	async function dropSelected() {
		const sentinel = globalThis?.window?.sentinel;
		const proxyApi = sentinel?.proxy;
		if (!proxyApi || !selected) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			await proxyApi.intercept.drop({ requestId: selected.id });
			const afterDrop = queueRef.current.filter(item => item.id !== selected.id);
			setQueueAndRef(afterDrop);
			setSelectedId('');
			setNoticeText('Dropped selected request.');
		} catch {
			setErrorText('Unable to drop selected request.');
		}
	}

	function sendSelectedToRepeater() {
		if (!selected) {
			return;
		}
		const appWindow = globalThis?.window;
		if (!appWindow) {
			return;
		}
		appWindow.dispatchEvent(new CustomEvent('sentinel:repeater-handoff', {
			detail: {
				request: {
					...selected,
					path: editPath || selected.path,
					body: editBody,
				},
			},
		}));
		appWindow.dispatchEvent(new CustomEvent('sentinel:navigate-module', {
			detail: { moduleName: 'Repeater' },
		}));
		setNoticeText('Queued request loaded into Repeater.');
	}

	const rawRequest = selected ? buildRawRequest(editPath, editBody, selected) : '';

	return (
		<Flex h='100%' overflow='hidden' direction='column'>
			<Flex px='3' py='2' borderBottomWidth='1px' borderColor='border.default' bg='bg.elevated' align='center' justify='space-between' flexShrink='0' wrap='wrap' gap='2'>
				<HStack gap='3'>
					<Text fontWeight='medium' fontSize='sm' color='fg.default'>Proxy</Text>
					<Badge variant='outline' color='fg.default' borderColor='border.default' bg='bg.surface'>
						<HStack gap='1'>
							<Box w='6px' h='6px' borderRadius='full' bg={status.running ? 'green.400' : 'orange.400'} />
							<Text fontSize='xs'>{status.running ? 'Running' : 'Stopped'}</Text>
						</HStack>
					</Badge>
					<Badge variant='outline' color='fg.default' borderColor='border.default' bg='bg.surface'>
						<HStack gap='1'>
							<Box w='6px' h='6px' borderRadius='full' bg={status.intercepting ? 'green.400' : 'orange.400'} />
							<Text fontSize='xs'>Intercept {status.intercepting ? 'On' : 'Off'}</Text>
						</HStack>
					</Badge>
					<Text fontSize='xs' color='fg.muted'>Port <Code color='fg.default' bg='bg.subtle'>{status.port}</Code></Text>
				</HStack>
				<HStack gap='2'>
					<Button size='xs' variant='outline' onClick={status.running ? stopProxy : startProxy} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>
						{status.running ? 'Stop' : 'Start'}
					</Button>
					<Button size='xs' variant='outline' onClick={toggleIntercept} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>
						{status.intercepting ? 'Resume All' : 'Pause All'}
					</Button>
				</HStack>
			</Flex>
			<VStack align='stretch' spacing={3} p='4' flex='1' overflow='hidden'>
				<Text color='fg.muted' fontSize='sm'>
					Intercept queue depth: <Code color='fg.default' bg='bg.subtle'>{queue.length}</Code> · Inspector mode <Code color='fg.default' bg='bg.subtle'>{inspectorTab.toUpperCase()}</Code>
				</Text>

				<Flex flex='1' minH='0' gap='3' overflow='hidden'>
					<Box flex='1' minW='0' borderWidth='1px' borderRadius='sm' borderColor='border.default' overflow='hidden'>
						<Flex px='2' py='2' borderBottomWidth='1px' borderColor='border.default' fontSize='xs' color='fg.muted' fontFamily='mono'>
							<Box flex='0 0 64px' px='2'>METHOD</Box>
							<Box flex='0 0 180px' px='2'>HOST</Box>
							<Box flex='1' px='2'>PATH</Box>
						</Flex>
						{queue.length === 0 ? <Text color='fg.muted' fontSize='sm' p='3'>No paused requests.</Text> : <ProxyQueue queue={queue} selectedId={selectedId} onSelect={setSelectedId} />}
					</Box>
					<Box w='44%' minW='360px' borderWidth='1px' borderRadius='sm' borderColor='border.default' overflow='hidden'>
						<ProxyInspector
							selected={selected}
							editPath={editPath}
							setEditPath={setEditPath}
							editBody={editBody}
							setEditBody={setEditBody}
							inspectorTab={inspectorTab}
							setInspectorTab={setInspectorTab}
							themeId={themeId}
							rawRequest={rawRequest}
							forwardSelected={forwardSelected}
							sendSelectedToRepeater={sendSelectedToRepeater}
							dropSelected={dropSelected}
						/>
					</Box>
				</Flex>

				{errorText ? (
					<Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text>
				) : null}
				{noticeText ? (
					<Text color={getStatusTextColor('success', themeId)} fontSize='sm'>{noticeText}</Text>
				) : null}
			</VStack>
		</Flex>
	);
}

ProxyQueue.propTypes = {
	queue: PropTypes.arrayOf(PropTypes.shape({
		id: PropTypes.string,
		method: PropTypes.string,
		host: PropTypes.string,
		path: PropTypes.string,
	})).isRequired,
	selectedId: PropTypes.string.isRequired,
	onSelect: PropTypes.func.isRequired,
};

ProxyInspector.propTypes = {
	selected: PropTypes.shape({
		id: PropTypes.string,
		method: PropTypes.string,
		host: PropTypes.string,
		path: PropTypes.string,
	}),
	editPath: PropTypes.string.isRequired,
	setEditPath: PropTypes.func.isRequired,
	editBody: PropTypes.string.isRequired,
	setEditBody: PropTypes.func.isRequired,
	inspectorTab: PropTypes.string.isRequired,
	setInspectorTab: PropTypes.func.isRequired,
	themeId: PropTypes.string,
	rawRequest: PropTypes.string.isRequired,
	forwardSelected: PropTypes.func.isRequired,
	sendSelectedToRepeater: PropTypes.func.isRequired,
	dropSelected: PropTypes.func.isRequired,
};

ProxyPanel.propTypes = {
	themeId: PropTypes.string,
};

export default ProxyPanel;

\\n
## File: src\renderer\js\components\sentinel\RepeaterPanel.jsx

\javascript
/*
SEN-016 Repeater Panel
AC 1: Load any history item into an editable entry.
AC 2: Edit method, path, headers, and body before sending.
AC 3: Response in Raw, Hex, and Rendered tabs.
AC 4: Each send stored in the entry's local history.
AC 5: Side-by-side compare between two sends.
*/

import React from 'react';
import PropTypes from 'prop-types';
import {
	Badge,
	Box,
	Button,
	Code,
	Flex,
	HStack,
	Input,
	Text,
	Textarea,
	VStack,
} from '@chakra-ui/react';
import MonacoEditor from '@monaco-editor/react';
import { getStatusTextColor, getMonacoTheme } from './theme-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headersObjectToText(headers) {
	if (!headers || typeof headers !== 'object') {
		return '';
	}
	return Object.entries(headers)
		.map(([k, v]) => `${k}: ${v}`)
		.join('\n');
}

function headersTextToObject(text) {
	const result = {};
	for (const line of String(text || '').split('\n')) {
		const idx = line.indexOf(':');
		if (idx > 0) {
			const key = line.slice(0, idx).trim().toLowerCase();
			const value = line.slice(idx + 1).trim();
			if (key) {
				result[key] = value;
			}
		}
	}
	return result;
}

function toHex(base64) {
	if (!base64) {
		return '';
	}
	try {
		const bytes = Buffer.from(base64, 'base64');
		const pairs = [];
		for (let i = 0; i < bytes.length; i++) {
			pairs.push(bytes[i].toString(16).padStart(2, '0'));
			if ((i + 1) % 16 === 0) {
				pairs.push('\n');
			} else if ((i + 1) % 8 === 0) {
				pairs.push('  ');
			} else {
				pairs.push(' ');
			}
		}
		return pairs.join('').trim();
	} catch {
		return '';
	}
}

function labelForSend(send) {
	if (!send) {
		return '';
	}
	return `${send.request.method} ${send.request.path || send.request.url || '/'} — ${new Date(send.sentAt).toLocaleTimeString()}`;
}

function bodyOfSend(send) {
	if (!send?.response) {
		return '[none]';
	}
	if (send.response.body !== undefined && send.response.body !== null) {
		return String(send.response.body);
	}
	if (send.response.rawBodyBase64) {
		return `[binary ${send.response.bodyLength} bytes]`;
	}
	return '[empty]';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ResponseViewer(props) {
	const { response, themeId } = props;
	const [view, setView] = React.useState('raw');

	if (!response) {
		return (
			<Box borderWidth='1px' borderRadius='md' p={3}>
				<Text color='fg.muted' fontSize='sm'>No response yet. Click Send.</Text>
			</Box>
		);
	}

	let statusColor = 'red';
	if (response.statusCode < 300) {
		statusColor = 'green';
	} else if (response.statusCode < 400) {
		statusColor = 'blue';
	}

	let rawText = '[empty body]';
	if (response.body !== undefined && response.body !== null) {
		rawText = String(response.body);
	} else if (response.rawBodyBase64) {
		rawText = `[binary ${response.bodyLength || 0} bytes]`;
	}

	const hexText = toHex(response.rawBodyBase64);
	const renderedHtml = response.contentType?.includes('html') && response.body
		? response.body
		: null;
	const hasTiming = Number.isFinite(response.timings?.total);
	const timingText = hasTiming ? ` · ${response.timings.total}ms` : '';

	const statusColorMap = {
		green: { border: 'green.500', bg: 'rgba(34,197,94,0.1)' },
		blue: { border: 'blue.500', bg: 'rgba(59,130,246,0.1)' },
		red: { border: 'red.500', bg: 'rgba(239,68,68,0.1)' }
	};
	const badgeStyles = statusColorMap[statusColor] || statusColorMap.blue;

	return (
		<Box borderWidth='1px' borderRadius='md' p={3}>
			<HStack mb={2} wrap='wrap'>
				<Badge variant='outline' color='var(--sentinel-fg-default)' borderColor={badgeStyles.border} bg={badgeStyles.bg}>
					{response.statusCode} {response.statusMessage}
				</Badge>
				<Text fontSize='xs' color='fg.muted'>
					{response.contentType || 'unknown'} · {response.bodyLength || 0} bytes
					{timingText}
				</Text>
			</HStack>
			<HStack mb={2}>
				{['raw', 'hex', 'rendered'].map(mode => (
					<Button
						key={mode}
						size='xs'
						variant={view === mode ? 'solid' : 'ghost'}
						onClick={() => setView(mode)}
						color={view === mode ? 'fg.default' : 'fg.muted'}
						bg={view === mode ? 'bg.subtle' : 'bg.surface'}
						borderColor='border.default'
						_hover={{ bg: 'bg.subtle', color: 'fg.default' }}
					>
						{mode.charAt(0).toUpperCase() + mode.slice(1)}
					</Button>
				))}
			</HStack>
			{view === 'raw' && (
				<Box flex='1' minH='240px' borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' overflow='hidden'>
					<MonacoEditor
						height='240px'
						defaultLanguage='http'
						theme={getMonacoTheme(themeId)}
						value={rawText}
						options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', fontSize: 12 }}
					/>
				</Box>
			)}
			{view === 'hex' && (
				<Box
					as='pre'
					fontSize='xs'
					fontFamily='mono'
					whiteSpace='pre-wrap'
					overflowY='auto'
					maxH='240px'
					p={2}
					borderWidth='1px'
					borderRadius='sm'
				>
					{hexText || '[no binary data]'}
				</Box>
			)}
			{view === 'rendered' && (
				renderedHtml ? (
					/* Render in a sandboxed iframe so server-controlled HTML/JS cannot
					   reach window.sentinel or any other renderer globals.
					   sandbox="" with no tokens: no scripts, no forms, no top-navigation. */
					<Box
						as='iframe'
						sandbox=''
						srcDoc={renderedHtml}
						title='Rendered response'
						borderWidth='1px'
						borderColor='border.default'
						style={{ width: '100%', height: '240px' }}
					/>
				) : (
					<Box
						as='pre'
						fontSize='xs'
						fontFamily='mono'
						whiteSpace='pre-wrap'
						overflowY='auto'
						maxH='240px'
						p={2}
						borderWidth='1px'
						borderRadius='sm'
					>
						{rawText}
					</Box>
				)
			)}
		</Box>
	);
}

ResponseViewer.propTypes = {
	response: PropTypes.shape({
		statusCode: PropTypes.number,
		statusMessage: PropTypes.string,
		body: PropTypes.any,
		rawBodyBase64: PropTypes.string,
		bodyLength: PropTypes.number,
		contentType: PropTypes.string,
		timings: PropTypes.shape({
			total: PropTypes.number,
		}),
	}),
	themeId: PropTypes.string,
};

// ---------------------------------------------------------------------------
// CompareView – AC 5
// ---------------------------------------------------------------------------

function CompareView(props) {
	const { sends } = props;
	const [idA, setIdA] = React.useState('');
	const [idB, setIdB] = React.useState('');

	if (sends.length < 2) {
		return (
			<Box borderWidth='1px' borderRadius='md' p={3}>
				<Text color='fg.muted' fontSize='sm'>Send at least 2 requests to compare.</Text>
			</Box>
		);
	}

	const sendA = sends.find(s => s.id === idA);
	const sendB = sends.find(s => s.id === idB);

	return (
		<Box borderWidth='1px' borderRadius='md' p={3}>
			<Text fontWeight='semibold' fontSize='sm' mb={2}>Compare Sends</Text>
			<HStack mb={3} align='flex-start' wrap='wrap'>
				<Box flex='1' minW='200px'>
					<Text fontSize='xs' color='fg.muted' mb={1}>Send A</Text>
					<Box
						as='select'
						size='xs'
						value={idA}
						onChange={e => setIdA(e.target.value)}
						color='fg.default'
						bg='bg.surface'
						borderColor='border.default'
						borderWidth='1px'
						borderRadius='sm'
						px='2'
						h='1.75rem'
					>
						<option value=''>— pick a send —</option>
						{sends.map(s => (
							<option key={s.id} value={s.id}>{labelForSend(s)}</option>
						))}
					</Box>
				</Box>
				<Box flex='1' minW='200px'>
					<Text fontSize='xs' color='fg.muted' mb={1}>Send B</Text>
					<Box
						as='select'
						size='xs'
						value={idB}
						onChange={e => setIdB(e.target.value)}
						color='fg.default'
						bg='bg.surface'
						borderColor='border.default'
						borderWidth='1px'
						borderRadius='sm'
						px='2'
						h='1.75rem'
					>
						<option value=''>— pick a send —</option>
						{sends.map(s => (
							<option key={s.id} value={s.id}>{labelForSend(s)}</option>
						))}
					</Box>
				</Box>
			</HStack>
			{(idA || idB) && (
				<HStack align='flex-start' spacing={4} wrap='wrap'>
					<Box flex='1' minW='280px'>
						{sendA && (
							<>
								<Text fontSize='xs' fontWeight='semibold' mb={1}>
									A — {sendA.response && `${sendA.response.statusCode} · ${sendA.response.bodyLength}b · ${sendA.response.timings ? sendA.response.timings.total + 'ms' : ''}`}
								</Text>
								<Box as='pre' fontSize='xs' fontFamily='mono' whiteSpace='pre-wrap' overflowY='auto' maxH='200px' p={2} borderWidth='1px' borderRadius='sm'>
									{bodyOfSend(sendA)}
								</Box>
							</>
						)}
					</Box>
					<Box flex='1' minW='280px'>
						{sendB && (
							<>
								<Text fontSize='xs' fontWeight='semibold' mb={1}>
									B — {sendB.response && `${sendB.response.statusCode} · ${sendB.response.bodyLength}b · ${sendB.response.timings ? sendB.response.timings.total + 'ms' : ''}`}
								</Text>
								<Box as='pre' fontSize='xs' fontFamily='mono' whiteSpace='pre-wrap' overflowY='auto' maxH='200px' p={2} borderWidth='1px' borderRadius='sm'>
									{bodyOfSend(sendB)}
								</Box>
							</>
						)}
					</Box>
				</HStack>
			)}
		</Box>
	);
}

CompareView.propTypes = {
	sends: PropTypes.arrayOf(PropTypes.shape({
		id: PropTypes.string,
		sentAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
		request: PropTypes.shape({
			method: PropTypes.string,
			path: PropTypes.string,
			url: PropTypes.string,
		}),
		response: PropTypes.shape({
			statusCode: PropTypes.number,
			bodyLength: PropTypes.number,
			body: PropTypes.any,
			rawBodyBase64: PropTypes.string,
			timings: PropTypes.shape({
				total: PropTypes.number,
			}),
		}),
	})).isRequired,
};

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

function RepeaterPanel(props) {
	const { themeId } = props;
	// Sidebar
	const [entries, setEntries] = React.useState([]);
	const [selectedEntryId, setSelectedEntryId] = React.useState('');
	const [activeSends, setActiveSends] = React.useState([]);
	const [compareOpen, setCompareOpen] = React.useState(false);

	// Editor
	const [editMethod, setEditMethod] = React.useState('GET');
	const [editUrl, setEditUrl] = React.useState('');
	const [editHeaders, setEditHeaders] = React.useState('');
	const [editBody, setEditBody] = React.useState('');

	// Response
	const [response, setResponse] = React.useState(null);
	const [sending, setSending] = React.useState(false);
	const [errorText, setErrorText] = React.useState('');

	const sentinel = globalThis?.window?.sentinel || null;

	// Load sidebar entries on mount
	React.useEffect(() => {
		if (!sentinel?.repeater) {
			return;
		}
		sentinel.repeater.historyList().then(result => {
			setEntries(Array.isArray(result.items) ? result.items : []);
		}).catch(() => {});
	}, []);

	React.useEffect(() => {
		const appWindow = globalThis?.window;
		if (!appWindow) {
			return undefined;
		}

		function handleHandoff(event) {
			const request = event?.detail?.request || null;
			if (!request) {
				return;
			}
			setSelectedEntryId('');
			setEditMethod((request.method || 'GET').toUpperCase());
			setEditUrl(request.url || `${request.scheme || 'http'}://${request.host || 'localhost'}${request.path || '/'}`);
			setEditHeaders(headersObjectToText(request.headers));
			setEditBody(request.body || '');
			setResponse(null);
			setActiveSends([]);
			setCompareOpen(false);
			setErrorText('');
		}

		appWindow.addEventListener('sentinel:repeater-handoff', handleHandoff);
		return () => {
			appWindow.removeEventListener('sentinel:repeater-handoff', handleHandoff);
		};
	}, []);

	async function loadEntry(id) {
		if (!sentinel?.repeater) {
			return;
		}
		try {
			const entry = await sentinel.repeater.get({ id });
			if (!entry) {
				return;
			}
			setSelectedEntryId(entry.id);
			setEditMethod(entry.request.method || 'GET');
			setEditUrl(entry.request.url || (entry.request.path || '/'));
			setEditHeaders(headersObjectToText(entry.request.headers));
			setEditBody(entry.request.body || '');
			setResponse(entry.response || null);
			setActiveSends(Array.isArray(entry.sends) ? entry.sends : []);
			setCompareOpen(false);
		} catch {
			setErrorText('Unable to load entry.');
		}
	}

	async function handleSend() {
		if (!sentinel?.repeater) {
			return;
		}
		setErrorText('');
		setSending(true);
		try {
			const request = {
				method: editMethod.toUpperCase(),
				url: editUrl,
				headers: headersTextToObject(editHeaders),
				body: editBody || null,
			};
			const args = selectedEntryId ? { request, entryId: selectedEntryId } : { request };
			const result = await sentinel.repeater.send(args);
			setResponse(result.response);

			// Refresh the entry sidebar and sends list
			const listResult = await sentinel.repeater.historyList();
			setEntries(Array.isArray(listResult.items) ? listResult.items : []);

			const entryId = result.entry?.id || selectedEntryId;
			if (entryId) {
				setSelectedEntryId(entryId);
				const fullEntry = await sentinel.repeater.get({ id: entryId });
				if (fullEntry) {
					setActiveSends(Array.isArray(fullEntry.sends) ? fullEntry.sends : []);
				}
			}
		} catch (error) {
			setErrorText(error?.message || 'Send failed.');
		} finally {
			setSending(false);
		}
	}

	function clearEditor() {
		setSelectedEntryId('');
		setEditMethod('GET');
		setEditUrl('');
		setEditHeaders('');
		setEditBody('');
		setResponse(null);
		setActiveSends([]);
		setCompareOpen(false);
		setErrorText('');
	}

	return (
		<Box p={4} h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='md'>
			<VStack align='stretch' spacing={3}>
				<Flex justify='space-between' align='center' mb='3' pb='3' borderBottomWidth='1px' borderColor='border.default'>
					<Text fontWeight='medium' fontSize='sm' color='fg.default'>Repeater</Text>
					<HStack gap='2'>
						<Button size='xs' variant='outline' onClick={clearEditor} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>New Request</Button>
					</HStack>
				</Flex>

				<HStack align='flex-start' spacing={4} wrap='wrap'>
					{/* Sidebar — entry list */}
					<Box minW='180px' flex='0 0 180px'>
						<Text fontWeight='semibold' fontSize='sm' mb={2}>Sessions</Text>
						<VStack align='stretch' spacing={1}>
							{entries.length === 0 ? (
								<Text fontSize='xs' color='fg.muted'>No sessions yet.</Text>
							) : entries.map(entry => (
								<Button
									key={entry.id}
									size='xs'
									variant={selectedEntryId === entry.id ? 'solid' : 'ghost'}
									textAlign='left'
									whiteSpace='nowrap'
									overflow='hidden'
									textOverflow='ellipsis'
									onClick={() => loadEntry(entry.id)}
								>
									{entry.request?.method || 'GET'}{' '}
									{entry.request?.url || entry.request?.path || '/'}
								</Button>
							))}
						</VStack>
					</Box>

					{/* Editor + Response */}
					<Box flex='1' minW='300px'>
						<VStack align='stretch' spacing={2}>
							{/* Method + URL row */}
							<HStack>
								<Input
									size='sm'
									value={editMethod}
									onChange={e => setEditMethod(e.target.value)}
									maxW='100px'
									placeholder='GET'
									fontFamily='mono'
									textTransform='uppercase'
									color='fg.default'
									bg='bg.surface'
									borderColor='border.default'
									_placeholder={{ color: 'fg.muted' }}
								/>
								<Input
									size='sm'
									flex='1'
									value={editUrl}
									onChange={e => setEditUrl(e.target.value)}
									placeholder='https://example.com/path'
									fontFamily='mono'
									color='fg.default'
									bg='bg.surface'
									borderColor='border.default'
									_placeholder={{ color: 'fg.muted' }}
								/>
								<Button
									size='sm'
									colorPalette='green'
									onClick={handleSend}
									loading={sending}
									disabled={sending || !editUrl.trim()}
								>
									Send
								</Button>
							</HStack>

							{/* Headers */}
							<Textarea
								size='sm'
								value={editHeaders}
								onChange={e => setEditHeaders(e.target.value)}
								placeholder={'host: example.com\ncontent-type: application/json'}
								rows={4}
								fontFamily='mono'
								fontSize='xs'
								color='fg.default'
								bg='bg.surface'
								borderColor='border.default'
								_placeholder={{ color: 'fg.muted' }}
							/>

							{/* Body */}
							<Textarea
								size='sm'
								value={editBody}
								onChange={e => setEditBody(e.target.value)}
								placeholder='Request body (optional)'
								rows={5}
								fontFamily='mono'
								fontSize='xs'
								color='fg.default'
								bg='bg.surface'
								borderColor='border.default'
								_placeholder={{ color: 'fg.muted' }}
							/>

							{errorText && <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text>}

							{/* Response viewer — AC 3 */}
							<ResponseViewer response={response} themeId={themeId} />

							{/* Send history for this entry — AC 4 */}
							{activeSends.length > 0 && (
								<Box borderWidth='1px' borderRadius='md' p={3}>
									<HStack justify='space-between' mb={2}>
										<Text fontWeight='semibold' fontSize='sm'>
											Send History ({activeSends.length})
										</Text>
										<Button
											size='xs'
											variant='outline'
											onClick={() => setCompareOpen(prev => !prev)}
											color='fg.default'
											bg='bg.surface'
											borderColor='border.default'
											_hover={{ bg: 'bg.subtle' }}
										>
											{compareOpen ? 'Hide Compare' : 'Compare…'}
										</Button>
									</HStack>
									<VStack align='stretch' spacing={1} maxH='160px' overflowY='auto'>
										{activeSends.map(send => (
											<HStack key={send.id} justify='space-between'>
												<Text fontSize='xs' fontFamily='mono'>
													{send.request.method}{' '}
													{send.request.path || send.request.url || '/'}{' '}
													→{' '}
													<Code fontSize='xs' color='fg.default' bg='bg.subtle'>
														{send.response?.statusCode}
													</Code>
												</Text>
												<Text fontSize='xs' color='fg.muted'>
													{send.response?.bodyLength}b
													{' '}
													{send.response?.timings
														? `${send.response.timings.total}ms`
														: ''}
												</Text>
											</HStack>
										))}
									</VStack>
								</Box>
							)}

							{/* Compare view — AC 5 */}
							{compareOpen && <CompareView sends={activeSends} />}
						</VStack>
					</Box>
				</HStack>
			</VStack>
		</Box>
	);
}

RepeaterPanel.propTypes = {
	themeId: PropTypes.string,
};

export default RepeaterPanel;

\\n
## File: src\renderer\js\components\sentinel\ScannerPanel.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Input,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

function getSeverityBadgeStyle(severity) {
  if (severity === 'critical' || severity === 'high') {
    return { borderColor: 'red.500', bg: 'rgba(239,68,68,0.1)' };
  }
  if (severity === 'medium') {
    return { borderColor: 'orange.500', bg: 'rgba(249,115,22,0.1)' };
  }
  if (severity === 'low') {
    return { borderColor: 'yellow.500', bg: 'rgba(234,179,8,0.1)' };
  }
  return { borderColor: 'blue.500', bg: 'rgba(59,130,246,0.1)' };
}

function renderFindingCard(finding, index) {
  const severityStyle = getSeverityBadgeStyle(finding.severity);
  const key = finding.id || `${finding.name}-${index}`;
  const hasEvidence = Boolean(finding.evidence);

  return (
    <Box key={key} borderWidth='1px' borderRadius='sm' borderColor='border.default' p={2} mb={2}>
      <HStack justify='space-between'>
        <Text fontWeight='medium' color='fg.default'>{finding.name || 'Finding'}</Text>
        <Badge
          variant='outline'
          color='var(--sentinel-fg-default)'
          borderColor={severityStyle.borderColor}
          bg={severityStyle.bg}
        >
          {finding.severity || 'info'}
        </Badge>
      </HStack>
      <Text fontSize='sm' color='fg.muted'>{finding.description || 'No description provided.'}</Text>
      {hasEvidence ? (
        <Text fontSize='xs' color='fg.muted'>
          Evidence: <Code color='fg.default' bg='bg.subtle'>{finding.evidence.method || 'GET'}</Code> <Code color='fg.default' bg='bg.subtle'>{finding.evidence.path || '/'}</Code>{' '}
          <Code color='fg.default' bg='bg.subtle'>{String(finding.evidence.statusCode || '')}</Code>
        </Text>
      ) : null}
    </Box>
  );
}

function ScannerPanel(props) {
  const themeId = props.themeId;
  const sentinel = globalThis?.window?.sentinel || null;
  const [targetsText, setTargetsText] = React.useState('https://example.com/search');
  const [scopeHosts, setScopeHosts] = React.useState('');
  const [historyIds, setHistoryIds] = React.useState('');
  const [activeScanId, setActiveScanId] = React.useState('');
  const [findings, setFindings] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [statusText, setStatusText] = React.useState('Idle');
  const [errorText, setErrorText] = React.useState('');

  const parseTextList = React.useCallback((value) => {
    return String(value ?? '')
      .split(/[\n,]/g)
      .map(item => item.trim())
      .filter(Boolean);
  }, []);

  const loadResults = React.useCallback(async (scanId) => {
    if (!sentinel?.scanner || !scanId) {
      return;
    }
    const result = await sentinel.scanner.results({ scanId, page: 0, pageSize: 500 });
    setFindings(Array.isArray(result?.findings) ? result.findings : []);
  }, [sentinel]);

  React.useEffect(() => {
    if (typeof sentinel?.scanner?.onProgress !== 'function') {
      return undefined;
    }

    const unsubscribe = sentinel.scanner.onProgress((payload) => {
      if (!payload?.scanId) {
        return;
      }
      if (payload.scanId !== activeScanId && payload.scanId !== 'passive') {
        return;
      }

      setStatusText(`Progress: ${payload.pct ?? 0}%`);
      if (payload?.finding) {
        setFindings(prev => [payload.finding, ...prev]);
      }
    });

    return unsubscribe;
  }, [activeScanId, sentinel]);

  async function startActiveScan() {
    if (!sentinel?.scanner) {
      return;
    }

    setLoading(true);
    setErrorText('');
    setStatusText('Starting active scan...');
    try {
      const started = await sentinel.scanner.start({
        targets: parseTextList(targetsText),
        config: {
          mode: 'active',
          itemIds: parseTextList(historyIds),
          scopeHosts: parseTextList(scopeHosts),
        },
      });
      setActiveScanId(started.scanId);
      await loadResults(started.scanId);
      setStatusText(`Active scan completed: ${started.scanId}`);
    } catch (error) {
      setErrorText(error?.message || 'Unable to start scanner job.');
      setStatusText('Scanner failed');
    } finally {
      setLoading(false);
    }
  }

  async function loadPassiveFindings() {
    if (!sentinel?.scanner) {
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      setActiveScanId('passive');
      await loadResults('passive');
      setStatusText('Loaded passive findings from captured traffic.');
    } catch (error) {
      setErrorText(error?.message || 'Unable to load passive findings.');
    } finally {
      setLoading(false);
    }
  }

  const hasFindings = findings.length > 0;
  const findingsContent = hasFindings
    ? findings.map((finding, index) => renderFindingCard(finding, index))
    : <Text fontSize='sm' color='fg.muted'>No findings loaded yet.</Text>;

  return (
    <Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='sm' borderColor='border.default'>
      <VStack align='stretch' spacing={3}>
        <Flex justify='space-between' align='center' pb='3' borderBottomWidth='1px' borderColor='border.default'>
          <Text fontWeight='medium' fontSize='sm' color='fg.default'>Scanner</Text>
          <HStack gap='2'>
            <Button size='xs' variant='outline' onClick={startActiveScan} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Active Scan</Button>
            <Button size='xs' variant='outline' onClick={loadPassiveFindings} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Passive Findings</Button>
          </HStack>
        </Flex>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2} color='fg.default'>Active Scan Inputs</Text>
          <Text fontSize='sm' color='fg.muted' mb={1}>Targets (comma or newline separated)</Text>
          <Textarea rows={3} value={targetsText} onChange={event => setTargetsText(event.target.value)} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
          <HStack mt={2}>
            <Input
              value={scopeHosts}
              onChange={event => setScopeHosts(event.target.value)}
              placeholder='Optional scope hosts from history (comma separated)'
              color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }}
            />
            <Input
              value={historyIds}
              onChange={event => setHistoryIds(event.target.value)}
              placeholder='Optional history item IDs (comma separated)'
              color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }}
            />
          </HStack>
          <HStack mt={3}>
            <Button colorPalette='blue' size='sm' onClick={startActiveScan} loading={loading}>Start Active Scan</Button>
            <Button size='sm' variant='outline' onClick={loadPassiveFindings} loading={loading} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Load Passive Findings</Button>
            <Code color='fg.default' bg='bg.subtle'>{activeScanId || 'no scan selected'}</Code>
          </HStack>
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm' color='fg.default'>Findings</Text>
            <Code color='fg.default' bg='bg.subtle'>{findings.length}</Code>
          </HStack>
          {findingsContent}
        </Box>

        <Text fontSize='sm' color={getStatusTextColor('info', themeId)}>{statusText}</Text>
        {errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
      </VStack>
    </Box>
  );
}

ScannerPanel.propTypes = {
  themeId: PropTypes.string,
};

export default ScannerPanel;

\\n
## File: src\renderer\js\components\sentinel\SequencerPanel.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

function SequencerPanel(props) {
  const { themeId } = props;
  const sentinel = globalThis?.window?.sentinel;
  const [requestId, setRequestId] = React.useState('');
  const [sampleSize, setSampleSize] = React.useState('20');
  const [tokenSource, setTokenSource] = React.useState('cookie');
  const [tokenKey, setTokenKey] = React.useState('session');
  const [sessionId, setSessionId] = React.useState('');
  const [report, setReport] = React.useState(null);
  const [statusText, setStatusText] = React.useState('Idle');
  const [errorText, setErrorText] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function startCapture() {
    if (!sentinel?.sequencer) {
      return;
    }

    setLoading(true);
    setErrorText('');
    setReport(null);
    setStatusText('Capturing token samples...');
    try {
      const result = await sentinel.sequencer.captureStart({
        config: {
          requestId: requestId || undefined,
          sampleSize: Number(sampleSize) || 20,
          tokenField: {
            source: tokenSource,
            key: tokenKey,
          },
        },
      });

      setSessionId(result?.sessionId || '');
      setStatusText(`Capture finished with ${result?.sampleCount || 0} samples.`);
    } catch (error) {
      setErrorText(error?.message || 'Unable to start sequencer capture.');
      setStatusText('Capture failed');
    } finally {
      setLoading(false);
    }
  }

  async function stopCapture() {
    if (!sentinel?.sequencer || !sessionId) {
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      const result = await sentinel.sequencer.captureStop({ sessionId });
      setStatusText(`Capture stopped with ${result?.sampleCount || 0} samples.`);
    } catch (error) {
      setErrorText(error?.message || 'Unable to stop capture session.');
    } finally {
      setLoading(false);
    }
  }

  async function analyzeSession() {
    if (!sentinel?.sequencer || !sessionId) {
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      const result = await sentinel.sequencer.analyze({ sessionId });
      setReport(result?.report || null);
      setStatusText('Entropy analysis completed.');
    } catch (error) {
      setErrorText(error?.message || 'Unable to analyze sequencer session.');
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!report?.exportCsv) {
      return;
    }

    const blob = new globalThis.Blob([report.exportCsv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = globalThis.document.createElement('a');
    link.href = url;
    link.download = `sequencer-${sessionId || 'session'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='sm' borderColor='border.default'>
      <VStack align='stretch' spacing={3}>
        <Flex justify='space-between' align='center' pb='3' borderBottomWidth='1px' borderColor='border.default'>
          <Text fontWeight='medium' fontSize='sm' color='fg.default'>Sequencer</Text>
          <HStack gap='2'>
            <Button size='xs' variant='outline' onClick={startCapture} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Start Capture</Button>
            <Button size='xs' variant='outline' onClick={stopCapture} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Stop</Button>
            <Button size='xs' variant='outline' onClick={analyzeSession} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Analyze</Button>
          </HStack>
        </Flex>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2} color='fg.default'>Capture Configuration</Text>
          <HStack>
            <Input value={requestId} onChange={event => setRequestId(event.target.value)} placeholder='History request ID' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
            <Input value={sampleSize} onChange={event => setSampleSize(event.target.value)} placeholder='Sample size' maxW='160px' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
          </HStack>
          <HStack mt={2}>
            <Input value={tokenSource} onChange={event => setTokenSource(event.target.value)} placeholder='Token source: cookie|header|body' maxW='240px' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
            <Input value={tokenKey} onChange={event => setTokenKey(event.target.value)} placeholder='Token field key' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
          </HStack>
          <HStack mt={3}>
            <Button size='sm' colorPalette='blue' onClick={startCapture} loading={loading}>Start Capture</Button>
            <Button size='sm' variant='outline' onClick={stopCapture} disabled={!sessionId || loading} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Stop</Button>
            <Button size='sm' variant='outline' onClick={analyzeSession} disabled={!sessionId || loading} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Analyze</Button>
            <Code color='fg.default' bg='bg.subtle'>{sessionId || 'no session'}</Code>
          </HStack>
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm' color='fg.default'>Analysis Report</Text>
            {report ? (
              <Badge 
                variant='outline' 
                color='var(--sentinel-fg-default)' 
                borderColor={report.rating === 'pass' ? 'green.500' : 'red.500'} 
                bg={report.rating === 'pass' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}
              >
                {report.rating}
              </Badge>
            ) : null}
          </HStack>

          {report ? (
            <VStack align='stretch' spacing={2}>
              <Text fontSize='sm'>Samples: <Code color='fg.default' bg='bg.subtle'>{report.sampleCount}</Code></Text>
              <Text fontSize='sm'>Avg length: <Code color='fg.default' bg='bg.subtle'>{report.averageLength}</Code></Text>
              <Text fontSize='sm'>Entropy bits/char: <Code color='fg.default' bg='bg.subtle'>{report.entropyBitsPerChar}</Code></Text>
              <Text fontSize='sm'>Bit strength estimate: <Code color='fg.default' bg='bg.subtle'>{report.bitStrengthEstimate}</Code></Text>
              <Text fontSize='sm'>Monobit pass: <Code color='fg.default' bg='bg.subtle'>{String(report?.fips140_2?.monobit?.pass)}</Code></Text>
              <Text fontSize='sm'>Runs pass: <Code color='fg.default' bg='bg.subtle'>{String(report?.fips140_2?.runs?.pass)}</Code></Text>
              <Text fontSize='sm' color='fg.muted'>{report.summary}</Text>
              <Button size='sm' variant='outline' onClick={exportCsv} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Export CSV</Button>
            </VStack>
          ) : (
            <Text fontSize='sm' color='fg.muted'>Run Analyze to generate entropy metrics.</Text>
          )}
        </Box>

        <Text fontSize='sm' color={getStatusTextColor('info', themeId)}>{statusText}</Text>
        {errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
      </VStack>
    </Box>
  );
}

SequencerPanel.propTypes = {
  themeId: PropTypes.string,
};

export default SequencerPanel;

\\n
## File: src\renderer\js\components\sentinel\TargetMapPanel.jsx

\javascript
import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

function flattenTree(nodes = [], depth = 0, rows = []) {
  for (const node of nodes) {
    rows.push({
      id: node.id,
      label: node.label,
      depth,
      inScope: Boolean(node.inScope),
      type: node.type,
    });
    if (Array.isArray(node.children) && node.children.length > 0) {
      flattenTree(node.children, depth + 1, rows);
    }
  }
  return rows;
}

function getImportResultStyles(importResult, themeId) {
  let borderColor = 'border.default';
  let bg = 'bg.subtle';
  let textColor = 'fg.muted';

  if (importResult?.kind === 'success') {
    borderColor = 'green.500';
    bg = 'rgba(34,197,94,0.08)';
    textColor = getStatusTextColor('success', themeId);
  } else if (importResult?.kind === 'error') {
    borderColor = 'red.500';
    bg = 'rgba(239,68,68,0.08)';
    textColor = getStatusTextColor('error', themeId);
  }

  return { borderColor, bg, textColor };
}

function ImportResultNotice({ importResult, themeId }) {
  if (!importResult) {
    return null;
  }

  const styles = getImportResultStyles(importResult, themeId);
  const warnings = Array.isArray(importResult?.warnings) ? importResult.warnings : [];

  return (
    <Box mt={1} p={2} borderRadius='sm' borderWidth='1px' borderColor={styles.borderColor} bg={styles.bg}>
      <Text fontSize='sm' color={styles.textColor}>{importResult?.message}</Text>
      {warnings.length > 0 ? (
        <VStack align='stretch' spacing={0} mt={1}>
          {warnings.map(warning => (
            <Text key={`${importResult?.kind || 'notice'}-${warning}`} fontSize='xs' color={getStatusTextColor('warn', themeId)}>
              {`⚠ ${warning}`}
            </Text>
          ))}
        </VStack>
      ) : null}
    </Box>
  );
}

function ScopeRulesList({ rules, onRemoveRule }) {
  if (rules.length === 0) {
    return <Text fontSize='sm' color='fg.muted'>No scope rules configured.</Text>;
  }

  return rules.map(rule => {
    const isInclude = rule.kind === 'include';
    const badgeBorderColor = isInclude ? 'green.500' : 'red.500';
    const badgeBackground = isInclude ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
    return (
      <HStack key={rule.id} justify='space-between' borderWidth='1px' borderRadius='sm' borderColor='border.default' p={2} mb={2}>
        <HStack>
          <Badge variant='outline' color='var(--sentinel-fg-default)' borderColor={badgeBorderColor} bg={badgeBackground}>
            {rule.kind}
          </Badge>
          <Text fontSize='sm' color='fg.default'>
            {rule.host || rule.ip || rule.cidr || 'unknown'}
            {rule.path ? ` ${rule.path}` : ''}
          </Text>
        </HStack>
        <Button size='xs' variant='ghost' onClick={() => onRemoveRule(rule.id)} color='fg.muted' _hover={{ color: 'fg.default', bg: 'bg.subtle' }}>Remove</Button>
      </HStack>
    );
  });
}

function SiteMapList({ sitemapRows }) {
  if (sitemapRows.length === 0) {
    return <Text fontSize='sm' color='fg.muted'>No observed traffic yet.</Text>;
  }

  return sitemapRows.map(row => {
    const inScopeBorderColor = row.inScope ? 'green.500' : 'orange.500';
    const inScopeBackground = row.inScope ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)';
    const typeLabel = row.type === 'host' ? row.label : `/${row.label}`;
    return (
      <HStack key={row.id} pl={`${row.depth * 16}px`} spacing={2}>
        <Badge variant='outline' color='var(--sentinel-fg-default)' borderColor={inScopeBorderColor} bg={inScopeBackground}>
          {row.inScope ? 'in-scope' : 'out-of-scope'}
        </Badge>
        <Text fontSize='sm'>{typeLabel}</Text>
      </HStack>
    );
  });
}

function TargetMapPanel({ themeId }) {
  const [rules, setRules] = React.useState([]);
  const [sitemapRows, setSitemapRows] = React.useState([]);
  const [form, setForm] = React.useState({
    kind: 'include',
    host: '',
    path: '/',
    protocol: '',
    port: '',
    cidr: '',
    ip: '',
  });
  const [csvFormat, setCsvFormat] = React.useState('hackerone');
  const [statusText, setStatusText] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [importBurpLoading, setImportBurpLoading] = React.useState(false);
  const [importCsvLoading, setImportCsvLoading] = React.useState(false);
  // { kind: 'success'|'error'|'cancelled', message: string, warnings: string[] }
  const [importResult, setImportResult] = React.useState(null);

  const loadScope = React.useCallback(async () => {
    const sentinel = globalThis?.window?.sentinel;
    if (!sentinel?.scope) {
      return;
    }
    const payload = await sentinel.scope.get();
    setRules(Array.isArray(payload.rules) ? payload.rules : []);
  }, []);

  const loadSitemap = React.useCallback(async () => {
    const sentinel = globalThis?.window?.sentinel;
    if (!sentinel?.target) {
      return;
    }
    const payload = await sentinel.target.sitemap();
    const rows = flattenTree(Array.isArray(payload.tree) ? payload.tree : []);
    setSitemapRows(rows);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await Promise.all([loadScope(), loadSitemap()]);
      } catch {
        if (!cancelled) {
          setErrorText('Unable to load target map data.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadScope, loadSitemap]);

  async function saveRules(nextRules) {
    const sentinel = globalThis?.window?.sentinel;
    if (!sentinel?.scope) {
      return;
    }
    await sentinel.scope.set({ rules: nextRules });
    setRules(nextRules);
  }

  async function addRule() {
    setErrorText('');
    setStatusText('');
    try {
      if (!form.host && !form.cidr && !form.ip) {
        throw new Error('Host, CIDR, or IP is required.');
      }

      const nextRules = [...rules, {
        id: `scope-${Date.now()}`,
        kind: form.kind,
        host: form.host || null,
        path: form.path || '/',
        protocol: form.protocol || null,
        port: form.port ? Number(form.port) : null,
        cidr: form.cidr || null,
        ip: form.ip || null,
      }];

      await saveRules(nextRules);
      setForm({ kind: 'include', host: '', path: '/', protocol: '', port: '', cidr: '', ip: '' });
      setStatusText('Scope rule saved.');
      await loadSitemap();
    } catch (error) {
      setErrorText(error?.message || 'Unable to save scope rule.');
    }
  }

  async function removeRule(ruleId) {
    setErrorText('');
    setStatusText('');
    try {
      const nextRules = rules.filter(rule => rule.id !== ruleId);
      await saveRules(nextRules);
      setStatusText('Scope rule removed.');
      await loadSitemap();
    } catch {
      setErrorText('Unable to remove scope rule.');
    }
  }

  async function importBurp() {
    setImportResult(null);
    setImportBurpLoading(true);
    try {
      const sentinel = globalThis?.window?.sentinel;
      if (!sentinel?.scope) {
        setImportResult({ kind: 'error', message: 'Scope API unavailable.', warnings: [] });
        return;
      }
      const result = await sentinel.scope.importBurp({});
      if (result?.ok === false || !result) {
        setImportResult({ kind: 'cancelled', message: 'Burp import cancelled.', warnings: [] });
        return;
      }

      const imported = result?.imported || 0;
      const entryLabel = imported === 1 ? 'entry' : 'entries';
      await loadScope();
      await loadSitemap();
      setImportResult({
        kind: 'success',
        message: `Imported ${imported} Burp scope ${entryLabel}.`,
        warnings: Array.isArray(result?.warnings) ? result.warnings : [],
      });
    } catch (error) {
      const msg = error?.message || 'Unknown error';
      setImportResult({ kind: 'error', message: `Burp import failed: ${msg}`, warnings: [] });
    } finally {
      setImportBurpLoading(false);
    }
  }

  async function importCsv() {
    setImportResult(null);
    setImportCsvLoading(true);
    try {
      const sentinel = globalThis?.window?.sentinel;
      if (!sentinel?.scope) {
        setImportResult({ kind: 'error', message: 'Scope API unavailable.', warnings: [] });
        return;
      }
      const result = await sentinel.scope.importCsv({ format: csvFormat });
      if (result?.ok === false || !result) {
        setImportResult({ kind: 'cancelled', message: 'CSV import cancelled.', warnings: [] });
        return;
      }

      const imported = result?.imported || 0;
      const formatLabel = csvFormat === 'hackerone' ? 'HackerOne' : 'CSV';
      const entryLabel = imported === 1 ? 'entry' : 'entries';
      await loadScope();
      await loadSitemap();
      setImportResult({
        kind: 'success',
        message: `Imported ${imported} ${formatLabel} scope ${entryLabel}.`,
        warnings: Array.isArray(result?.warnings) ? result.warnings : [],
      });
    } catch (error) {
      const msg = error?.message || 'Unknown error';
      setImportResult({ kind: 'error', message: `CSV import failed: ${msg}`, warnings: [] });
    } finally {
      setImportCsvLoading(false);
    }
  }

  return (
    <Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='sm' borderColor='border.default'>
      <VStack align='stretch' spacing={3}>
        <Flex justify='space-between' align='center' pb='3' borderBottomWidth='1px' borderColor='border.default'>
          <Text fontWeight='medium' fontSize='sm' color='fg.default'>Target Map</Text>
          <HStack gap='2'>
            <Button size='xs' variant='outline' onClick={loadScope} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Refresh Scope</Button>
          </HStack>
        </Flex>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2}>Add Scope Rule</Text>
          <VStack align='stretch' spacing={2}>
            <HStack>
              <Button
                size='sm'
                variant={form.kind === 'include' ? 'solid' : 'outline'}
                onClick={() => setForm(prev => ({ ...prev, kind: 'include' }))}
              >
                Include
              </Button>
              <Button
                size='sm'
                variant={form.kind === 'exclude' ? 'solid' : 'outline'}
                onClick={() => setForm(prev => ({ ...prev, kind: 'exclude' }))}
              >
                Exclude
              </Button>
              <Input placeholder='host (example.com)' value={form.host} onChange={event => setForm(prev => ({ ...prev, host: event.target.value }))} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
              <Input placeholder='path (/api)' value={form.path} onChange={event => setForm(prev => ({ ...prev, path: event.target.value }))} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
            </HStack>
            <HStack>
              <Input placeholder='protocol (http/https)' value={form.protocol} onChange={event => setForm(prev => ({ ...prev, protocol: event.target.value }))} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
              <Input placeholder='port (443)' value={form.port} onChange={event => setForm(prev => ({ ...prev, port: event.target.value }))} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
              <Input placeholder='cidr (10.0.0.0/24)' value={form.cidr} onChange={event => setForm(prev => ({ ...prev, cidr: event.target.value }))} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
              <Input placeholder='ip (192.168.1.15)' value={form.ip} onChange={event => setForm(prev => ({ ...prev, ip: event.target.value }))} color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
              <Button size='sm' onClick={addRule} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Add</Button>
            </HStack>
          </VStack>
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2}>Import Scope Rules</Text>
          <VStack align='stretch' spacing={2}>
            <HStack>
              <Text fontSize='sm' color='fg.muted' flex='1'>Choose a Burp XML/JSON file in the system file picker.</Text>
              <Button
                size='sm'
                variant='outline'
                onClick={importBurp}
                loading={importBurpLoading}
                disabled={importBurpLoading || importCsvLoading}
              color='fg.default'
              bg='bg.surface'
              borderColor='border.default'
              _hover={{ bg: 'bg.subtle' }}
              >
                Import Burp
              </Button>
            </HStack>
            <HStack>
              <Text fontSize='sm' color='fg.muted' flex='1'>Choose a CSV file in the system file picker.</Text>
              <Button
                size='sm'
                variant={csvFormat === 'hackerone' ? 'solid' : 'outline'}
                onClick={() => setCsvFormat('hackerone')}
                disabled={importBurpLoading || importCsvLoading}
              color={csvFormat === 'hackerone' ? 'fg.default' : 'fg.muted'}
              bg={csvFormat === 'hackerone' ? 'bg.subtle' : 'bg.surface'}
              borderColor='border.default'
              _hover={{ bg: 'bg.subtle', color: 'fg.default' }}
              >
                HackerOne
              </Button>
              <Button
                size='sm'
                variant={csvFormat === 'generic' ? 'solid' : 'outline'}
                onClick={() => setCsvFormat('generic')}
                disabled={importBurpLoading || importCsvLoading}
              color={csvFormat === 'generic' ? 'fg.default' : 'fg.muted'}
              bg={csvFormat === 'generic' ? 'bg.subtle' : 'bg.surface'}
              borderColor='border.default'
              _hover={{ bg: 'bg.subtle', color: 'fg.default' }}
              >
                Generic
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={importCsv}
                loading={importCsvLoading}
                disabled={importBurpLoading || importCsvLoading}
              color='fg.default'
              bg='bg.surface'
              borderColor='border.default'
              _hover={{ bg: 'bg.subtle' }}
              >
                Import CSV
              </Button>
            </HStack>
            <ImportResultNotice importResult={importResult} themeId={themeId} />
          </VStack>
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm'>Scope Rules</Text>
            <Code color='fg.default' bg='bg.subtle'>{rules.length} rules</Code>
          </HStack>
          <ScopeRulesList rules={rules} onRemoveRule={removeRule} />
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm' color='fg.default'>Site Map</Text>
            <Button size='xs' variant='outline' onClick={loadSitemap} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Refresh</Button>
          </HStack>
          <SiteMapList sitemapRows={sitemapRows} />
        </Box>

        {statusText ? <Text color={getStatusTextColor('success', themeId)} fontSize='sm'>{statusText}</Text> : null}
        {errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
      </VStack>
    </Box>
  );
}

ImportResultNotice.propTypes = {
  importResult: PropTypes.shape({
    kind: PropTypes.string,
    message: PropTypes.string,
    warnings: PropTypes.arrayOf(PropTypes.string),
  }),
  themeId: PropTypes.string,
};

ScopeRulesList.propTypes = {
  rules: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    kind: PropTypes.string,
    host: PropTypes.string,
    ip: PropTypes.string,
    cidr: PropTypes.string,
    path: PropTypes.string,
  })).isRequired,
  onRemoveRule: PropTypes.func.isRequired,
};

SiteMapList.propTypes = {
  sitemapRows: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    depth: PropTypes.number,
    inScope: PropTypes.bool,
    type: PropTypes.string,
    label: PropTypes.string,
  })).isRequired,
};

TargetMapPanel.propTypes = {
  themeId: PropTypes.string,
};

export default TargetMapPanel;

\\n
## File: src\renderer\js\components\sentinel\theme-utils.js

\javascript
function resolveThemeId(explicitThemeId) {
  if (explicitThemeId) {
    return String(explicitThemeId);
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    const fromDom = document.documentElement.getAttribute('data-sentinel-theme-id');
    if (fromDom) {
      return String(fromDom);
    }
  }

  return 'dark-steel';
}

function isDarkTheme(explicitThemeId) {
  return resolveThemeId(explicitThemeId).startsWith('dark-');
}

function getMonacoTheme(explicitThemeId) {
  return isDarkTheme(explicitThemeId) ? 'vs-dark' : 'vs';
}

function getStatusTextColor(statusType, explicitThemeId) {
  const normalized = String(statusType || 'default').toLowerCase();

  if (normalized === 'error') {
    return 'severity.critical';
  }

  if (normalized === 'warning') {
    return 'severity.high';
  }

  if (normalized === 'success') {
    return isDarkTheme(explicitThemeId) ? 'green.300' : 'green.700';
  }

  if (normalized === 'info') {
    return 'severity.info';
  }

  return 'fg.default';
}

function getOverlayScrim(explicitThemeId) {
  return isDarkTheme(explicitThemeId)
    ? 'rgba(5, 10, 16, 0.65)'
    : 'rgba(232, 238, 247, 0.82)';
}

export {
  isDarkTheme,
  getMonacoTheme,
  getStatusTextColor,
  getOverlayScrim,
};

\\n
