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
