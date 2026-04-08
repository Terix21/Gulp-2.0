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
} from '@chakra-ui/react';
import { getStatusTextColor } from './theme-utils';

function mergeSession(currentItems, nextSession) {
  if (!nextSession || !nextSession.id) {
    return currentItems;
  }

  const existingIndex = currentItems.findIndex(item => item.id === nextSession.id);
  if (existingIndex === -1) {
    return [nextSession, ...currentItems];
  }

  return currentItems.map(item => (item.id === nextSession.id ? nextSession : item));
}

function sortSessions(items) {
  return [...items].sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0));
}

function buildBoundsFromRect(rect) {
  // Electron view bounds use the same logical pixel coordinate space as the renderer.
  // Multiplying by devicePixelRatio causes hosted Chromium content to overflow on HiDPI displays.
  return {
    x: Math.max(0, Math.round(rect.left || 0)),
    y: Math.max(0, Math.round(rect.top || 0)),
    width: Math.max(0, Math.round(rect.width || 0)),
    height: Math.max(0, Math.round(rect.height || 0)),
  };
}

function getBrowserApi() {
  if (typeof window === 'undefined' || !window.sentinel || !window.sentinel.browser) {
    return null;
  }

  return window.sentinel.browser;
}

function EmbeddedBrowserPanel({ themeId }) {
  const [sessions, setSessions] = React.useState([]);
  const [activeSessionId, setActiveSessionId] = React.useState('');
  const [address, setAddress] = React.useState('https://example.com');
  const [statusText, setStatusText] = React.useState('');
  const [errorText, setErrorText] = React.useState('');
  const [lastProxyPort, setLastProxyPort] = React.useState('unknown');
  const hostRef = React.useRef(null);

  const activeSession = sessions.find(session => session.id === activeSessionId) || null;

  const loadSessions = React.useCallback(async () => {
    const browser = getBrowserApi();
    if (!browser) {
      return;
    }

    const listed = await browser.listSessions();
    const items = Array.isArray(listed.items) ? listed.items : [];
    const sorted = sortSessions(items);
    setSessions(sorted);
    setActiveSessionId(currentId => {
      if (currentId && sorted.some(item => item.id === currentId)) {
        return currentId;
      }
      return sorted[0] ? sorted[0].id : '';
    });
  }, [activeSessionId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadSessions();
      } catch {
        if (!cancelled) {
          setErrorText('Unable to load embedded browser sessions.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSessions]);

  const syncActiveBounds = React.useCallback(async (sessionIdOverride) => {
    const browser = getBrowserApi();
    const targetSessionId = sessionIdOverride || activeSessionId;
    const element = hostRef.current;
    if (!browser || !targetSessionId || !element || typeof element.getBoundingClientRect !== 'function') {
      return;
    }

    const rect = element.getBoundingClientRect();
    const bounds = buildBoundsFromRect(rect);
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    await browser.setBounds({ sessionId: targetSessionId, bounds });
  }, [activeSessionId]);

  React.useEffect(() => {
    const browser = getBrowserApi();
    if (!browser) {
      return undefined;
    }

    const unsubscribers = [
      typeof browser.onState === 'function'
        ? browser.onState(payload => {
          const session = payload && payload.session ? payload.session : null;
          if (!session) {
            return;
          }

          setSessions(currentItems => {
            if (payload && payload.closed) {
              return currentItems.filter(item => item.id !== session.id);
            }
            return sortSessions(mergeSession(currentItems, session));
          });

          if (session.currentUrl) {
            setAddress(session.currentUrl);
          }

          if (payload && payload.proxy && payload.proxy.port) {
            setLastProxyPort(String(payload.proxy.port));
          }

          if (payload && payload.closed && activeSessionId === session.id) {
            setActiveSessionId('');
          }
        })
        : null,
      typeof browser.onNavigateStart === 'function'
        ? browser.onNavigateStart(payload => {
          if (payload && payload.url) {
            setAddress(payload.url);
          }
          setStatusText('Loading page in Chromium browser...');
          setErrorText('');
        })
        : null,
      typeof browser.onNavigateComplete === 'function'
        ? browser.onNavigateComplete(payload => {
          if (payload && payload.proxy && payload.proxy.port) {
            setLastProxyPort(String(payload.proxy.port));
          }
          setStatusText(`Chromium browser routed through proxy port ${payload && payload.proxy ? payload.proxy.port : 'unknown'}.`);
          setErrorText('');
        })
        : null,
      typeof browser.onNavigateError === 'function'
        ? browser.onNavigateError(payload => {
          setErrorText(payload && payload.error ? payload.error : 'Navigation failed.');
          setStatusText('');
        })
        : null,
      typeof browser.onTitleUpdated === 'function'
        ? browser.onTitleUpdated(payload => {
          if (payload && payload.title) {
            setStatusText(`Loaded: ${payload.title}`);
          }
        })
        : null,
    ].filter(Boolean);

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [activeSessionId]);

  React.useEffect(() => {
    const browser = getBrowserApi();
    if (!browser || !activeSessionId) {
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        await browser.focusSession({ sessionId: activeSessionId });
        await browser.showView({ sessionId: activeSessionId });
        await syncActiveBounds(activeSessionId);
      } catch {
        if (!cancelled) {
          setErrorText('Unable to attach Chromium browser surface.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, syncActiveBounds]);

  React.useEffect(() => {
    const browser = getBrowserApi();
    if (!browser || !activeSessionId) {
      return undefined;
    }

    const handleResize = () => {
      syncActiveBounds(activeSessionId).catch(() => {
        // Ignore bounds sync failures triggered by layout sync events.
      });
    };

    let resizeObserver = null;
    let intervalId = null;
    if (typeof ResizeObserver === 'function' && hostRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(hostRef.current);
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleResize, true);
      intervalId = window.setInterval(() => {
        handleResize();
      }, 250);
    }

    handleResize();

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (intervalId && typeof window !== 'undefined') {
        window.clearInterval(intervalId);
      }
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
      }
    };
  }, [activeSessionId, syncActiveBounds]);

  React.useEffect(() => {
    const browser = getBrowserApi();
    return () => {
      if (browser && activeSessionId && typeof browser.hideView === 'function') {
        browser.hideView({ sessionId: activeSessionId }).catch(() => {
          // Ignore detach failures on panel unmount.
        });
      }
    };
  }, [activeSessionId]);

  async function createSession() {
    const browser = getBrowserApi();
    if (!browser) {
      return;
    }

    setErrorText('');
    setStatusText('');
    try {
      const created = await browser.createSession({});
      const session = created && created.session ? created.session : null;
      if (!session) {
        throw new Error('No session returned from browser service.');
      }

      setSessions(prev => sortSessions(mergeSession(prev, session)));
      setActiveSessionId(session.id);
      setAddress(session.currentUrl || address);
      setStatusText('Chromium browser session opened.');
    } catch (error) {
      setErrorText(error && error.message ? error.message : 'Unable to create browser session.');
    }
  }

  async function runNavigation(methodName, args = {}) {
    const browser = getBrowserApi();
    if (!browser || !activeSessionId || typeof browser[methodName] !== 'function') {
      return;
    }

    setErrorText('');
    setStatusText('');
    try {
      const response = await browser[methodName]({ sessionId: activeSessionId, ...args });
      const session = response && response.session ? response.session : null;
      if (session) {
        setSessions(prev => sortSessions(mergeSession(prev, session)));
        if (session.currentUrl) {
          setAddress(session.currentUrl);
        }
      }
      if (response && response.proxy && response.proxy.port) {
        setLastProxyPort(String(response.proxy.port));
      }
    } catch (error) {
      setErrorText(error && error.message ? error.message : 'Navigation failed.');
    }
  }

  async function navigate() {
    return runNavigation('navigate', { url: address });
  }

  async function closeActiveSession() {
    const browser = getBrowserApi();
    if (!browser || !activeSessionId || typeof browser.closeSession !== 'function') {
      return;
    }

    setErrorText('');
    setStatusText('');
    try {
      await browser.closeSession({ sessionId: activeSessionId });
      setSessions(prev => prev.filter(item => item.id !== activeSessionId));
      const remaining = sessions.filter(item => item.id !== activeSessionId);
      setActiveSessionId(remaining[0] ? remaining[0].id : '');
      setStatusText('Chromium browser session closed.');
    } catch (error) {
      setErrorText(error && error.message ? error.message : 'Unable to close browser session.');
    }
  }

  return (
    <Flex direction='column' h='100%' overflow='hidden' p='3' gap='2'>
      {/* Panel header */}
      <Flex flex='0 0 auto' align='center' justify='space-between' pb='2' borderBottomWidth='1px' borderColor='border.default'>
        <Text fontWeight='semibold' fontSize='sm'>Embedded Browser</Text>
        <HStack gap='2'>
          <Badge colorPalette='blue'>{sessions.length} sessions</Badge>
          <Badge colorPalette={activeSession && activeSession.loading ? 'orange' : 'green'}>
            {activeSession && activeSession.loading ? 'Loading' : 'Ready'}
          </Badge>
          <Button size='xs' variant='outline' onClick={loadSessions}>Refresh</Button>
          <Button size='xs' variant='outline' onClick={createSession}>New Session</Button>
        </HStack>
      </Flex>

      {/* Session tabs */}
      <HStack flex='0 0 auto' gap='1' overflowX='auto' overflowY='hidden' minH='6'>
        {sessions.length === 0 ? (
          <Text fontSize='xs' color='fg.muted'>No sessions yet — click New Session to begin.</Text>
        ) : sessions.map(session => (
          <Button
            key={session.id}
            size='xs'
            flex='0 0 auto'
            variant={activeSessionId === session.id ? 'solid' : 'ghost'}
            onClick={() => setActiveSessionId(session.id)}
          >
            {session.name}
          </Button>
        ))}
      </HStack>

      {/* Address bar + nav controls */}
      <HStack flex='0 0 auto' gap='1'>
        <Button size='xs' variant='ghost' onClick={() => runNavigation('back')} disabled={!activeSession || !activeSession.canGoBack}>&#8592;</Button>
        <Button size='xs' variant='ghost' onClick={() => runNavigation('forward')} disabled={!activeSession || !activeSession.canGoForward}>&#8594;</Button>
        <Button size='xs' variant='ghost' onClick={() => runNavigation('reload')} disabled={!activeSession}>&#8635;</Button>
        <Button size='xs' variant='ghost' onClick={() => runNavigation('stop')} disabled={!activeSession || !activeSession.loading}>&#x2715;</Button>
        <Input flex='1' size='xs' value={address} onChange={event => setAddress(event.target.value)} placeholder='https://target.example' />
        <Button size='xs' colorPalette='blue' onClick={navigate} disabled={!activeSessionId}>Go</Button>
        <Button size='xs' variant='outline' colorPalette='red' onClick={closeActiveSession} disabled={!activeSessionId}>Close</Button>
      </HStack>

      {/* Compact session metadata */}
      {activeSession ? (
        <HStack flex='0 0 auto' gap='2' overflow='hidden'>
          <Text fontSize='xs' color='fg.muted' flex='1' overflow='hidden'>
            <Code fontSize='xs'>{activeSession.name}</Code>
            {' · '}
            <Code fontSize='xs'>{activeSession.currentUrl || 'pending'}</Code>
            {' · Proxy '}
            <Code fontSize='xs'>{lastProxyPort}</Code>
          </Text>
        </HStack>
      ) : null}

      {/* Chromium surface — flex:1 ensures this always fills available height within the panel */}
      <Box
        flex='1'
        minH='0'
        borderWidth='1px'
        borderColor='border.default'
        borderRadius='sm'
        overflow='hidden'
        bg='bg.canvas'
        position='relative'
      >
        <Box
          ref={hostRef}
          data-testid='embedded-browser-host'
          position='absolute'
          inset='1px'
          bg='bg.subtle'
        />
        <Flex
          position='absolute'
          inset='1px'
          align='center'
          justify='center'
          direction='column'
          gap='2'
          pointerEvents='none'
          color='fg.muted'
          textAlign='center'
          bg='linear-gradient(180deg, rgba(8, 17, 26, 0.16) 0%, rgba(8, 17, 26, 0.02) 100%)'
        >
          <Text fontWeight='semibold'>Chromium WebContentsView Host</Text>
          <Text fontSize='sm' maxW='md'>
            The live browser surface is attached by Electron main process to this viewport region.
          </Text>
        </Flex>
      </Box>

      {/* Status / error strip */}
      {(statusText || errorText) ? (
        <Box flex='0 0 auto'>
          {statusText ? <Text fontSize='xs' color={getStatusTextColor('success', themeId)}>{statusText}</Text> : null}
          {errorText ? <Text fontSize='xs' color={getStatusTextColor('error', themeId)}>{errorText}</Text> : null}
        </Box>
      ) : null}
    </Flex>
  );
}

export default EmbeddedBrowserPanel;
