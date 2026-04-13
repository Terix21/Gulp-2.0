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

const buildInfoModules = import.meta.glob('../../../contracts/build-info.json', { eager: true });
const generatedBuildInfo = buildInfoModules['../../../contracts/build-info.json']?.default ?? {};

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

  if (theme.mode === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }

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
  const buildInfoSource = [
    globalThis.window?.buildInfo,
    globalThis.window?.electronInfo?.build,
    generatedBuildInfo,
  ].find((candidate) => candidate?.version || candidate?.default?.version) ?? {};
  const buildInfo = buildInfoSource?.default ?? buildInfoSource;
  const buildVersion = buildInfo?.version && buildInfo?.git?.commitCount
    ? `${buildInfo.version}+${buildInfo.git.commitCount}`
    : buildInfo?.version || 'unknown';

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
                as='div'
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
              <Text>Build <Code {...shellCodeProps}>{buildVersion}</Code></Text>
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
