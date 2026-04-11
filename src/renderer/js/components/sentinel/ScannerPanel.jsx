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
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

function ScannerPanel({ themeId }) {
  const sentinel = typeof window !== 'undefined' ? window.sentinel : null;
  const [targetsText, setTargetsText] = React.useState('https://example.com/search');
  const [scopeHosts, setScopeHosts] = React.useState('');
  const [historyIds, setHistoryIds] = React.useState('');
  const [activeScanId, setActiveScanId] = React.useState('');
  const [findings, setFindings] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [statusText, setStatusText] = React.useState('Idle');
  const [errorText, setErrorText] = React.useState('');

  const parseTextList = React.useCallback((value) => {
    return String(value || '')
      .split(/[\n,]/g)
      .map(item => item.trim())
      .filter(Boolean);
  }, []);

  const loadResults = React.useCallback(async (scanId) => {
    if (!sentinel || !sentinel.scanner || !scanId) {
      return;
    }
    const result = await sentinel.scanner.results({ scanId, page: 0, pageSize: 500 });
    setFindings(Array.isArray(result.findings) ? result.findings : []);
  }, [sentinel]);

  React.useEffect(() => {
    if (!sentinel || !sentinel.scanner || !sentinel.scanner.onProgress) {
      return undefined;
    }

    const unsubscribe = sentinel.scanner.onProgress((payload) => {
      if (!payload || !payload.scanId) {
        return;
      }
      if (payload.scanId !== activeScanId && payload.scanId !== 'passive') {
        return;
      }

      setStatusText(`Progress: ${payload.pct || 0}%`);
      if (payload.finding) {
        setFindings(prev => [payload.finding, ...prev]);
      }
    });

    return unsubscribe;
  }, [activeScanId, sentinel]);

  async function startActiveScan() {
    if (!sentinel || !sentinel.scanner) {
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
      setErrorText(error && error.message ? error.message : 'Unable to start scanner job.');
      setStatusText('Scanner failed');
    } finally {
      setLoading(false);
    }
  }

  async function loadPassiveFindings() {
    if (!sentinel || !sentinel.scanner) {
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      setActiveScanId('passive');
      await loadResults('passive');
      setStatusText('Loaded passive findings from captured traffic.');
    } catch (error) {
      setErrorText(error && error.message ? error.message : 'Unable to load passive findings.');
    } finally {
      setLoading(false);
    }
  }

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
          {findings.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>No findings loaded yet.</Text>
          ) : findings.map((finding, index) => (
            <Box key={finding.id || `${finding.name}-${index}`} borderWidth='1px' borderRadius='sm' borderColor='border.default' p={2} mb={2}>
              <HStack justify='space-between'>
                <Text fontWeight='medium' color='fg.default'>{finding.name || 'Finding'}</Text>
                <Badge 
                  variant='outline'
                  color='var(--sentinel-fg-default)'
                  borderColor={
                    finding.severity === 'critical' || finding.severity === 'high' ? 'red.500'
                    : finding.severity === 'medium' ? 'orange.500'
                    : finding.severity === 'low' ? 'yellow.500' : 'blue.500'
                  }
                  bg={
                    finding.severity === 'critical' || finding.severity === 'high' ? 'rgba(239,68,68,0.1)'
                    : finding.severity === 'medium' ? 'rgba(249,115,22,0.1)'
                    : finding.severity === 'low' ? 'rgba(234,179,8,0.1)' : 'rgba(59,130,246,0.1)'
                  }
                >
                  {finding.severity || 'info'}
                </Badge>
              </HStack>
              <Text fontSize='sm' color='fg.muted'>{finding.description || 'No description provided.'}</Text>
              {finding.evidence ? (
                <Text fontSize='xs' color='fg.muted'>
                  Evidence: <Code color='fg.default' bg='bg.subtle'>{finding.evidence.method || 'GET'}</Code> <Code color='fg.default' bg='bg.subtle'>{finding.evidence.path || '/'}</Code>{' '}
                  <Code color='fg.default' bg='bg.subtle'>{String(finding.evidence.statusCode || '')}</Code>
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

export default ScannerPanel;
