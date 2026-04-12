import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Code,
  Flex,
  Grid,
  HStack,
  Input,
  Stack,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

function splitCsvList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function ExtensionsPanel(props) {
  const { themeId } = props;
  const [extensions, setExtensions] = React.useState([]);
  const [auditLog, setAuditLog] = React.useState([]);
  const [extensionsDir, setExtensionsDir] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [mode, setMode] = React.useState('package');
  const [packagePath, setPackagePath] = React.useState('');
  const [scriptName, setScriptName] = React.useState('Quick Automation Script');
  const [scriptTriggers, setScriptTriggers] = React.useState('proxy.intercept');
  const [scriptSource, setScriptSource] = React.useState('api.audit("script.run", { method: payload && payload.request ? payload.request.method : "UNKNOWN" });');
  const [permissionsText, setPermissionsText] = React.useState('proxy.intercept.read,audit.write');

  const refresh = React.useCallback(async () => {
    const extensionsApi = globalThis?.window?.sentinel?.extensions;
    if (typeof extensionsApi?.list !== 'function') {
      return;
    }

    try {
      const result = await extensionsApi.list();
      setExtensions(Array.isArray(result?.extensions) ? result.extensions : []);
      setAuditLog(Array.isArray(result?.auditLog) ? result.auditLog : []);
      setExtensionsDir(String(result?.extensionsDir || ''));
      setErrorText('');
    } catch (error) {
      setErrorText(error?.message || 'Failed to load extension state.');
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const installExtension = async () => {
    const extensionsApi = globalThis?.window?.sentinel?.extensions;
    if (typeof extensionsApi?.install !== 'function') {
      return;
    }

    const approvedPermissions = splitCsvList(permissionsText);
    const args = mode === 'script'
      ? {
          name: scriptName,
          script: scriptSource,
          triggers: splitCsvList(scriptTriggers),
          permissions: approvedPermissions,
          approvedPermissions,
        }
      : {
          packagePath,
          approvedPermissions,
        };

    try {
      const result = await extensionsApi.install(args);
      if (result?.ok) {
        setErrorText('');
      } else {
        setErrorText(result?.error || 'Install failed.');
      }
      await refresh();
    } catch (error) {
      setErrorText(error?.message || 'Install failed.');
    }
  };

  const uninstallExtension = async (id) => {
    const extensionsApi = globalThis?.window?.sentinel?.extensions;
    if (typeof extensionsApi?.uninstall !== 'function') {
      return;
    }

    try {
      const result = await extensionsApi.uninstall({ id });
      if (!result?.ok) {
        setErrorText(result?.error || 'Uninstall failed.');
        return;
      }

      setErrorText('');
      await refresh();
    } catch (error) {
      setErrorText(error?.message || 'Uninstall failed.');
    }
  };

  const toggleExtension = async (id, enabled) => {
    const extensionsApi = globalThis?.window?.sentinel?.extensions;
    if (typeof extensionsApi?.toggle !== 'function') {
      return;
    }

    const action = enabled ? 'enable' : 'disable';

    try {
      const result = await extensionsApi.toggle({ id, enabled });
      if (result?.ok === false) {
        setErrorText(
          result.error ||
          `Failed to ${action} extension.`
        );
        return;
      }

      setErrorText('');
      await refresh();
    } catch (error) {
      setErrorText(error?.message || `Failed to ${action} extension.`);
    }
  };

  return (
    <Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='sm' borderColor='border.default'>
      <VStack align='stretch' gap='4'>
      <Flex align='center' justify='space-between'>
        <Text fontWeight='medium' fontSize='sm'>Extensions</Text>
        <HStack gap='2'>
          <Button size='sm' variant='outline' onClick={refresh}>Reload</Button>
        </HStack>
      </Flex>

      <Text fontSize='sm' color='fg.muted'>
        Managed directory: <Code color='fg.default' bg='bg.subtle'>{extensionsDir || 'unavailable'}</Code>
      </Text>

      {errorText ? (
        <Text fontSize='sm' color={getStatusTextColor('error', themeId)}>{errorText}</Text>
      ) : null}

      <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p='3'>
        <Text fontWeight='semibold' fontSize='sm' mb='3'>Install</Text>
        <Grid templateColumns='1fr 1fr' gap='3'>
          <Box>
            <Text fontSize='xs' mb='1'>Mode</Text>
            <Flex gap='2'>
              <Button
                size='sm'
                variant={mode === 'package' ? 'solid' : 'outline'}
                onClick={() => setMode('package')}
              >
                Package
              </Button>
              <Button
                size='sm'
                variant={mode === 'script' ? 'solid' : 'outline'}
                onClick={() => setMode('script')}
              >
                Automation Script
              </Button>
            </Flex>
          </Box>
          <Box>
            <Text fontSize='xs' mb='1'>Approved Permissions (comma-separated)</Text>
            <Input
              size='sm'
              value={permissionsText}
              onChange={(event) => setPermissionsText(event.target.value)}
              placeholder='proxy.intercept.read,audit.write'
            />
          </Box>
        </Grid>

        {mode === 'script' ? (
          <Stack mt='3' gap='3'>
            <Input
              size='sm'
              value={scriptName}
              onChange={(event) => setScriptName(event.target.value)}
              placeholder='Script name'
            />
            <Input
              size='sm'
              value={scriptTriggers}
              onChange={(event) => setScriptTriggers(event.target.value)}
              placeholder='proxy.intercept,scanner.finding'
            />
            <Textarea
              size='sm'
              minH='120px'
              value={scriptSource}
              onChange={(event) => setScriptSource(event.target.value)}
              placeholder='JavaScript snippet executed for each trigger payload'
            />
          </Stack>
        ) : (
          <Input
            mt='3'
            size='sm'
            value={packagePath}
            onChange={(event) => setPackagePath(event.target.value)}
            placeholder='Path to extension folder containing extension.json'
          />
        )}

        <Button mt='3' size='sm' colorPalette='blue' onClick={installExtension}>Install</Button>
      </Box>

      <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p='3'>
        <Text fontWeight='semibold' fontSize='sm' mb='2'>Installed Extensions</Text>
        {extensions.length === 0 ? (
          <Text fontSize='sm' color='fg.muted'>No extensions installed.</Text>
        ) : (
          <Stack gap='2'>
            {extensions.map((extension) => (
              <Box key={extension.id} borderWidth='1px' borderRadius='sm' borderColor='border.default' p='2'>
                <Flex align='center' justify='space-between' gap='3'>
                  <Box>
                    <Text fontSize='sm' fontWeight='semibold'>{extension.name}</Text>
                    <Text fontSize='xs' color='fg.muted'>
                      <Code color='fg.default' bg='bg.subtle'>{extension.id}</Code> v{extension.version}
                    </Text>
                    <Text fontSize='xs' color='fg.muted'>
                      Permissions: {(extension.permissions || []).join(', ') || 'none'}
                    </Text>
                    <Text fontSize='xs' color='fg.muted'>
                      Subscriptions: {(extension.subscriptions || []).join(', ') || 'none'}
                    </Text>
                  </Box>
                  <Stack direction='row' align='center'>
                    <Button
                      size='xs'
                      variant='outline'
                      onClick={() => toggleExtension(extension.id, !extension.enabled)}
                    >
                      {extension.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button size='xs' variant='outline' colorPalette='red' onClick={() => uninstallExtension(extension.id)}>
                      Remove
                    </Button>
                  </Stack>
                </Flex>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      <Box borderWidth='1px' borderRadius='sm' borderColor='border.default' p='3'>
        <Text fontWeight='semibold' fontSize='sm' mb='2'>Audit Log</Text>
        {auditLog.length === 0 ? (
          <Text fontSize='sm' color='fg.muted'>No audit events recorded yet.</Text>
        ) : (
          <Stack maxH='320px' overflowY='auto' gap='1'>
            {auditLog.slice(0, 100).map((entry) => (
              <Box key={entry.id} borderWidth='1px' borderRadius='sm' p='2'>
                <Text fontSize='xs'>
                  <Code color='fg.default' bg='bg.subtle'>{entry.extensionId}</Code> {entry.action} ({entry.status})
                </Text>
                {entry.message ? <Text fontSize='xs' color='fg.muted'>{entry.message}</Text> : null}
              </Box>
            ))}
          </Stack>
        )}
      </Box>
      </VStack>
    </Box>
  );
}

ExtensionsPanel.propTypes = {
  themeId: PropTypes.string,
};

export default ExtensionsPanel;
