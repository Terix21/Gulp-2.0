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
  VStack,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

const LOOPBACK_PATTERN = /^https?:\/\/(127\.\d+\.\d+\.\d+|::1|\[::1\]|localhost)(:\d+)?\//i;

function isLoopbackUrl(url) {
  return typeof url === 'string' && LOOPBACK_PATTERN.test(url);
}

function OobPanel({ themeId }) {
  const sentinel = typeof window !== 'undefined' ? window.sentinel : null;
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
    if (!sentinel || !sentinel.oob || !sentinel.oob.onHit) {
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
    if (!sentinel || !sentinel.oob) {
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
      setErrorText(error && error.message ? error.message : 'Unable to create OOB payload.');
    }
  }

  async function loadHits(payloadId = selectedPayloadId) {
    if (!sentinel || !sentinel.oob || !payloadId) {
      return;
    }

    setErrorText('');
    try {
      const result = await sentinel.oob.listHits({ id: payloadId, page: 0, pageSize: 200 });
      setHits(Array.isArray(result.hits) ? result.hits : []);
      setStatusText(`Loaded callbacks for payload ${payloadId}`);
    } catch (error) {
      setErrorText(error && error.message ? error.message : 'Unable to load OOB callbacks.');
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

export default OobPanel;
