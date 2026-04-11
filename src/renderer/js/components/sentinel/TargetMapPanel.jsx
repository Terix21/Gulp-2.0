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
    const sentinel = window.sentinel;
    if (!sentinel || !sentinel.scope) {
      return;
    }
    const payload = await sentinel.scope.get();
    setRules(Array.isArray(payload.rules) ? payload.rules : []);
  }, []);

  const loadSitemap = React.useCallback(async () => {
    const sentinel = window.sentinel;
    if (!sentinel || !sentinel.target) {
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
    const sentinel = window.sentinel;
    if (!sentinel || !sentinel.scope) {
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
      setErrorText(error && error.message ? error.message : 'Unable to save scope rule.');
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
      const sentinel = window.sentinel;
      if (!sentinel || !sentinel.scope) {
        setImportResult({ kind: 'error', message: 'Scope API unavailable.', warnings: [] });
        return;
      }
      const result = await sentinel.scope.importBurp({});
      if (!result || result.ok === false) {
        setImportResult({ kind: 'cancelled', message: 'Burp import cancelled.', warnings: [] });
        return;
      }
      await loadScope();
      await loadSitemap();
      setImportResult({
        kind: 'success',
        message: `Imported ${result.imported || 0} Burp scope ${result.imported === 1 ? 'entry' : 'entries'}.`,
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
      });
    } catch (error) {
      const msg = error && error.message ? error.message : 'Unknown error';
      setImportResult({ kind: 'error', message: `Burp import failed: ${msg}`, warnings: [] });
    } finally {
      setImportBurpLoading(false);
    }
  }

  async function importCsv() {
    setImportResult(null);
    setImportCsvLoading(true);
    try {
      const sentinel = window.sentinel;
      if (!sentinel || !sentinel.scope) {
        setImportResult({ kind: 'error', message: 'Scope API unavailable.', warnings: [] });
        return;
      }
      const result = await sentinel.scope.importCsv({ format: csvFormat });
      if (!result || result.ok === false) {
        setImportResult({ kind: 'cancelled', message: 'CSV import cancelled.', warnings: [] });
        return;
      }
      await loadScope();
      await loadSitemap();
      setImportResult({
        kind: 'success',
        message: `Imported ${result.imported || 0} ${csvFormat === 'hackerone' ? 'HackerOne' : 'CSV'} scope ${result.imported === 1 ? 'entry' : 'entries'}.`,
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
      });
    } catch (error) {
      const msg = error && error.message ? error.message : 'Unknown error';
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
            {importResult ? (
              <Box
                mt={1}
                p={2}
                borderRadius='sm'
                borderWidth='1px'
                borderColor={
                  importResult.kind === 'success' ? 'green.500'
                  : importResult.kind === 'error' ? 'red.500'
                  : 'border.default'
                }
                bg={
                  importResult.kind === 'success' ? 'rgba(34,197,94,0.08)'
                  : importResult.kind === 'error' ? 'rgba(239,68,68,0.08)'
                  : 'bg.subtle'
                }
              >
                <Text
                  fontSize='sm'
                  color={
                    importResult.kind === 'success' ? getStatusTextColor('success', themeId)
                    : importResult.kind === 'error' ? getStatusTextColor('error', themeId)
                    : 'fg.muted'
                  }
                >
                  {importResult.message}
                </Text>
                {importResult.warnings && importResult.warnings.length > 0 ? (
                  <VStack align='stretch' spacing={0} mt={1}>
                    {importResult.warnings.map((warning, index) => (
                      <Text key={index} fontSize='xs' color={getStatusTextColor('warn', themeId)}>
                        ⚠ {warning}
                      </Text>
                    ))}
                  </VStack>
                ) : null}
              </Box>
            ) : null}
          </VStack>
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm'>Scope Rules</Text>
            <Code color='fg.default' bg='bg.subtle'>{rules.length} rules</Code>
          </HStack>
          {rules.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>No scope rules configured.</Text>
          ) : rules.map(rule => (
            <HStack key={rule.id} justify='space-between' borderWidth='1px' borderRadius='sm' borderColor='border.default' p={2} mb={2}>
              <HStack>
                  <Badge 
                    variant='outline' 
                    color='var(--sentinel-fg-default)' 
                    borderColor={rule.kind === 'include' ? 'green.500' : 'red.500'} 
                    bg={rule.kind === 'include' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}
                  >
                    {rule.kind}
                  </Badge>
                <Text fontSize='sm' color='fg.default'>
                  {rule.host || rule.ip || rule.cidr || 'unknown'}
                  {rule.path ? ` ${rule.path}` : ''}
                </Text>
              </HStack>
              <Button size='xs' variant='ghost' onClick={() => removeRule(rule.id)} color='fg.muted' _hover={{ color: 'fg.default', bg: 'bg.subtle' }}>Remove</Button>
            </HStack>
          ))}
        </Box>

        <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p={3}>
          <HStack justify='space-between' mb={2}>
            <Text fontWeight='semibold' fontSize='sm' color='fg.default'>Site Map</Text>
            <Button size='xs' variant='outline' onClick={loadSitemap} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Refresh</Button>
          </HStack>
          {sitemapRows.length === 0 ? (
            <Text fontSize='sm' color='fg.muted'>No observed traffic yet.</Text>
          ) : sitemapRows.map(row => (
            <HStack key={row.id} pl={`${row.depth * 16}px`} spacing={2}>
                <Badge 
                  variant='outline' 
                  color='var(--sentinel-fg-default)' 
                  borderColor={row.inScope ? 'green.500' : 'orange.500'} 
                  bg={row.inScope ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)'}
                >
                {row.inScope ? 'in-scope' : 'out-of-scope'}
              </Badge>
              <Text fontSize='sm'>{row.type === 'host' ? row.label : `/${row.label}`}</Text>
            </HStack>
          ))}
        </Box>

        {statusText ? <Text color={getStatusTextColor('success', themeId)} fontSize='sm'>{statusText}</Text> : null}
        {errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
      </VStack>
    </Box>
  );
}

export default TargetMapPanel;
