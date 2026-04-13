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
