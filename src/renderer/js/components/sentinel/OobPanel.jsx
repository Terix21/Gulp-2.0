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
          <Text fontWeight='medium' fontSize='sm'>OOB</Text>
          <HStack gap='2'>
            <Button size='xs' variant='outline' onClick={createPayload}>Generate Payload</Button>
            <Button size='xs' variant='outline' onClick={() => loadHits()}>Refresh Hits</Button>
          </HStack>
        </Flex>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2}>Payload Generator</Text>
          <HStack>
            <Input value={payloadType} onChange={event => setPayloadType(event.target.value)} placeholder='Type: http | dns | smtp' maxW='180px' />
            <Input value={sourceRequestId} onChange={event => setSourceRequestId(event.target.value)} placeholder='Source request ID (optional)' />
          </HStack>
          <HStack mt={2}>
            <Input value={sourceScanId} onChange={event => setSourceScanId(event.target.value)} placeholder='Source scan ID (optional)' />
            <Input value={targetUrl} onChange={event => setTargetUrl(event.target.value)} placeholder='Target URL (optional)' />
          </HStack>
          <Button mt={3} size='sm' colorPalette='blue' onClick={createPayload}>Create Payload</Button>
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm'>Generated Payloads</Text>
            <Code>{payloads.length}</Code>
          </HStack>
          {payloads.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>No payloads generated yet.</Text>
          ) : payloads.map((payload) => (
            <Box key={payload.id} borderWidth='1px' borderRadius='sm' borderColor='border.default' p={2} mb={2}>
              <HStack justify='space-between'>
                <Code>{payload.id}</Code>
                <Badge>{payload.kind || payloadType}</Badge>
              </HStack>
              <Text fontSize='sm' color='fg.muted'>{payload.url}</Text>
              {isLoopbackUrl(payload.url) ? (
                // Loopback listener — external targets cannot reach 127.x / ::1 addresses.
                <Text fontSize='xs' color='severity.high' mt={1}>
                  Listener is bound to a loopback address. External targets cannot deliver callbacks to this URL. Configure a routable listener host to receive out-of-band interactions.
                </Text>
              ) : null}
              <Text fontSize='xs' color='fg.muted'>Domain marker: <Code>{payload.domain}</Code></Text>
              <Button mt={2} size='xs' variant='outline' onClick={() => {
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
            <Text fontWeight='semibold' fontSize='sm'>Callbacks</Text>
            <Code>{hits.length}</Code>
          </HStack>
          {hits.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>No callbacks recorded for the selected payload.</Text>
          ) : hits.map((hit) => (
            <Box key={hit.id} borderWidth='1px' borderRadius='sm' borderColor='border.default' p={2} mb={2}>
              <HStack justify='space-between'>
                <Code>{hit.id}</Code>
                <Badge colorPalette='green'>{hit.kind || 'http'}</Badge>
              </HStack>
              <Text fontSize='sm'>Source: <Code>{hit.source || 'unknown'}</Code></Text>
              <Text fontSize='sm'>Path: <Code>{hit.requestPath || '/'}</Code></Text>
              {hit.correlation ? (
                <Text fontSize='xs' color='fg.muted'>
                  Correlation: request=<Code>{hit.correlation.sourceRequestId || 'n/a'}</Code>,
                  scan=<Code>{hit.correlation.sourceScanId || 'n/a'}</Code>
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
