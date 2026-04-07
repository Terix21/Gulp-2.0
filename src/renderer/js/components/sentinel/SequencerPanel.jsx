const React = require('react');
const {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Input,
  Text,
  VStack,
} = require('@chakra-ui/react');
const { getStatusTextColor } = require('./theme-utils');

function SequencerPanel({ themeId }) {
  const sentinel = typeof window !== 'undefined' ? window.sentinel : null;
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
    if (!sentinel || !sentinel.sequencer) {
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

      setSessionId(result.sessionId || '');
      setStatusText(`Capture finished with ${result.sampleCount || 0} samples.`);
    } catch (error) {
      setErrorText(error && error.message ? error.message : 'Unable to start sequencer capture.');
      setStatusText('Capture failed');
    } finally {
      setLoading(false);
    }
  }

  async function stopCapture() {
    if (!sentinel || !sentinel.sequencer || !sessionId) {
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      const result = await sentinel.sequencer.captureStop({ sessionId });
      setStatusText(`Capture stopped with ${result.sampleCount || 0} samples.`);
    } catch (error) {
      setErrorText(error && error.message ? error.message : 'Unable to stop capture session.');
    } finally {
      setLoading(false);
    }
  }

  async function analyzeSession() {
    if (!sentinel || !sentinel.sequencer || !sessionId) {
      return;
    }

    setLoading(true);
    setErrorText('');
    try {
      const result = await sentinel.sequencer.analyze({ sessionId });
      setReport(result.report || null);
      setStatusText('Entropy analysis completed.');
    } catch (error) {
      setErrorText(error && error.message ? error.message : 'Unable to analyze sequencer session.');
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    if (!report || !report.exportCsv) {
      return;
    }

    const blob = new Blob([report.exportCsv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sequencer-${sessionId || 'session'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='sm' borderColor='border.default'>
      <VStack align='stretch' spacing={3}>
        <Flex justify='space-between' align='center' pb='3' borderBottomWidth='1px' borderColor='border.default'>
          <Text fontWeight='medium' fontSize='sm'>Sequencer</Text>
          <HStack gap='2'>
            <Button size='xs' variant='outline' onClick={startCapture}>Start Capture</Button>
            <Button size='xs' variant='outline' onClick={stopCapture}>Stop</Button>
            <Button size='xs' variant='outline' onClick={analyzeSession}>Analyze</Button>
          </HStack>
        </Flex>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2}>Capture Configuration</Text>
          <HStack>
            <Input value={requestId} onChange={event => setRequestId(event.target.value)} placeholder='History request ID' />
            <Input value={sampleSize} onChange={event => setSampleSize(event.target.value)} placeholder='Sample size' maxW='160px' />
          </HStack>
          <HStack mt={2}>
            <Input value={tokenSource} onChange={event => setTokenSource(event.target.value)} placeholder='Token source: cookie|header|body' maxW='240px' />
            <Input value={tokenKey} onChange={event => setTokenKey(event.target.value)} placeholder='Token field key' />
          </HStack>
          <HStack mt={3}>
            <Button size='sm' colorPalette='blue' onClick={startCapture} loading={loading}>Start Capture</Button>
            <Button size='sm' variant='outline' onClick={stopCapture} disabled={!sessionId || loading}>Stop</Button>
            <Button size='sm' variant='outline' onClick={analyzeSession} disabled={!sessionId || loading}>Analyze</Button>
            <Code>{sessionId || 'no session'}</Code>
          </HStack>
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm'>Analysis Report</Text>
            {report ? (
              <Badge colorPalette={report.rating === 'pass' ? 'green' : 'red'}>{report.rating}</Badge>
            ) : null}
          </HStack>

          {!report ? (
            <Text fontSize='sm' color='fg.muted'>Run Analyze to generate entropy metrics.</Text>
          ) : (
            <VStack align='stretch' spacing={2}>
              <Text fontSize='sm'>Samples: <Code>{report.sampleCount}</Code></Text>
              <Text fontSize='sm'>Avg length: <Code>{report.averageLength}</Code></Text>
              <Text fontSize='sm'>Entropy bits/char: <Code>{report.entropyBitsPerChar}</Code></Text>
              <Text fontSize='sm'>Bit strength estimate: <Code>{report.bitStrengthEstimate}</Code></Text>
              <Text fontSize='sm'>Monobit pass: <Code>{String(report.fips140_2 && report.fips140_2.monobit && report.fips140_2.monobit.pass)}</Code></Text>
              <Text fontSize='sm'>Runs pass: <Code>{String(report.fips140_2 && report.fips140_2.runs && report.fips140_2.runs.pass)}</Code></Text>
              <Text fontSize='sm' color='fg.muted'>{report.summary}</Text>
              <Button size='sm' onClick={exportCsv}>Export CSV</Button>
            </VStack>
          )}
        </Box>

        <Text fontSize='sm' color={getStatusTextColor('info', themeId)}>{statusText}</Text>
        {errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
      </VStack>
    </Box>
  );
}

module.exports = SequencerPanel;
