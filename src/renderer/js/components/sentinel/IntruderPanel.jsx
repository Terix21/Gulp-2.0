import React from 'react';
import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Input,
  Text,
  Select,
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
      return 'file';
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
    .filter(count => typeof count === 'number');
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
    const leftValue = left && left[sortBy] != null ? left[sortBy] : 0;
    const rightValue = right && right[sortBy] != null ? right[sortBy] : 0;
    if (leftValue === rightValue) {
      return 0;
    }
    return sortDirection === 'asc'
      ? (leftValue > rightValue ? 1 : -1)
      : (leftValue < rightValue ? 1 : -1);
  });
  return sorted;
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
  const sentinel = typeof window !== 'undefined' ? window.sentinel : null;
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
      source: prev[index] && prev[index].source ? prev[index].source : buildDefaultSource(marker),
    })));
  }, [url, headersText, body]);

  const loadAttacks = React.useCallback(async () => {
    if (!sentinel || !sentinel.intruder || !sentinel.intruder.list) {
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
    if (!sentinel || !sentinel.intruder || !attackId) {
      return;
    }
    setLoadingResults(true);
    setErrorText('');
    try {
      const result = await sentinel.intruder.results({ attackId, page: 0, pageSize: 500 });
      setResults(prev => {
        const fetched = Array.isArray(result.results) ? result.results : [];
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
    if (!sentinel || !sentinel.intruder) {
      return undefined;
    }

    loadAttacks().catch(() => {});
    const unsubscribe = sentinel.intruder.onProgress((payload) => {
      if (!payload || !payload.attackId) {
        return;
      }

      setAttacks(prev => {
        const next = prev.map(item => item.id === payload.attackId
          ? {
            ...item,
            sent: payload.sent,
            total: payload.total,
            status: payload.status || (payload.sent >= payload.total ? 'completed' : item.status),
            updatedAt: Date.now(),
            anomalousCount: item.anomalousCount + (payload.lastResult && payload.lastResult.isAnomalous ? 1 : 0),
          }
          : item);
        const exists = next.some(item => item.id === payload.attackId);
        if (!exists) {
          return [
            {
              id: payload.attackId,
              status: payload.status || 'running',
              attackType: attackType,
              positionCount: markers.length,
              requestSummary: `${method} ${url}`,
              sent: payload.sent,
              total: payload.total,
              anomalousCount: payload.lastResult && payload.lastResult.isAnomalous ? 1 : 0,
              startedAt: Date.now(),
              updatedAt: Date.now(),
            },
            ...next,
          ];
        }
        return next;
      });

      if (payload.attackId === selectedAttackId) {
        setProgress({ sent: payload.sent, total: payload.total, status: payload.status || 'running' });
        if (payload.lastResult) {
          setResults(prev => {
            const exists = prev.some(item => item.id === payload.lastResult.id);
            return exists ? prev : [...prev, payload.lastResult];
          });
        }
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
    if (!sentinel || !sentinel.intruder) {
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
      setErrorText(error && error.message ? error.message : 'Unable to start intruder attack.');
    }
  }

  async function stopSelectedAttack() {
    if (!sentinel || !sentinel.intruder || !selectedAttackId) {
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
                <Select
                  size='xs'
                  value={attackType}
                  onChange={event => setAttackType(event.target.value)}
                  color='fg.default'
                  bg='bg.surface'
                  borderColor='border.default'
                >
                  <option value='sniper'>Single-point / Sniper</option>
                  <option value='pitchfork'>Pitchfork</option>
                  <option value='cluster-bomb'>Cluster Bomb</option>
                </Select>
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
                        <Select
                          size='xs'
                          value={source.type}
                          onChange={event => updatePositionSource(index, { type: event.target.value })}
                          mb={2}
                          color='fg.default'
                          bg='bg.surface'
                          borderColor='border.default'
                        >
                          <option value='dictionary'>Dictionary</option>
                          <option value='bruteforce'>Brute-force charset</option>
                          <option value='sequential'>Sequential numeric</option>
                        </Select>

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
                  borderColor={progress.status === 'completed' ? 'green.500' : progress.status === 'stopped' ? 'orange.500' : 'blue.500'} 
                  bg={progress.status === 'completed' ? 'rgba(34,197,94,0.1)' : progress.status === 'stopped' ? 'rgba(249,115,22,0.1)' : 'rgba(59,130,246,0.1)'}
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
                  <Select size='xs' value={sortBy} onChange={event => setSortBy(event.target.value)} color='fg.default' bg='bg.surface' borderColor='border.default'>
                    <option value='duration'>Sort by Duration</option>
                    <option value='statusCode'>Sort by Status</option>
                    <option value='length'>Sort by Length</option>
                  </Select>
                  <Select size='xs' value={sortDirection} onChange={event => setSortDirection(event.target.value)} color='fg.default' bg='bg.surface' borderColor='border.default'>
                    <option value='desc'>Desc</option>
                    <option value='asc'>Asc</option>
                  </Select>
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

export default IntruderPanel;
