import React from 'react';
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
    const sentinel = window.sentinel;
    if (!sentinel || !sentinel.decoder) {
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

      setResult(String(payload.result || ''));
      setSteps(Array.isArray(payload.detailedSteps) ? payload.detailedSteps : []);
    } catch (error) {
      setErrorText(error && error.message ? error.message : 'Unable to process decoder chain.');
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
    <Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='sm' borderColor='border.default'>
      <VStack align='stretch' spacing={3}>
        <Flex justify='space-between' align='center' pb='3' borderBottomWidth='1px' borderColor='border.default'>
          <Text fontWeight='medium' fontSize='sm'>Decoder</Text>
          <HStack gap='2'>
            <Button size='xs' variant='outline' onClick={runDecoder}>Run</Button>
          </HStack>
        </Flex>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2}>Input</Text>
          <Textarea
            rows={7}
            value={input}
            onChange={event => setInput(event.target.value)}
            placeholder='Paste encoded/decoded text here...'
          />
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm'>Operation Chain</Text>
            <Code>{operations.length} steps</Code>
          </HStack>

          {operations.map((operation, index) => (
            <HStack key={operation.id} mb={2}>
              <Code minW='80px'>{index + 1}</Code>
              <Input
                value={operation.op}
                onChange={event => updateOperation(index, event.target.value)}
                placeholder='operation'
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
            />
            <Button size='sm' variant={reverse ? 'solid' : 'outline'} onClick={() => setReverse(prev => !prev)}>
              Reverse Chain
            </Button>
            <Button size='sm' colorPalette='blue' onClick={runDecoder}>Run</Button>
          </HStack>
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2}>Output</Text>
          <Textarea rows={7} value={result} readOnly />
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <Text fontWeight='semibold' fontSize='sm' mb={2}>Intermediate Steps</Text>
          {steps.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>Run a chain to see intermediate outputs.</Text>
          ) : steps.map((step, index) => (
            <Box key={index} borderWidth='1px' borderRadius='sm' borderColor='border.default' p={2} mb={2}>
              <Text fontSize='sm'><Code>{step.pass}.{index + 1}</Code> {step.operation}</Text>
              <Text fontSize='xs' color='fg.muted'>Input: <Code>{String(step.input || '').slice(0, 120)}</Code></Text>
              <Text fontSize='xs' color='fg.muted'>Output: <Code>{String(step.output || '').slice(0, 120)}</Code></Text>
            </Box>
          ))}
        </Box>

        {errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
      </VStack>
    </Box>
  );
}

export default DecoderPanel;
