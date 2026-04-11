import React from 'react';
import {
	Badge,
	Box,
	Button,
	Code,
	Flex,
	HStack,
	Input,
	Separator,
	Text,
	VStack,
} from '@chakra-ui/react';
import MonacoEditor from '@monaco-editor/react';
import { FixedSizeList } from 'react-window';
import { getMonacoTheme, getStatusTextColor } from './theme-utils';

const ROW_HEIGHT = 34;

function buildRawRequest(request = {}, pathOverride, bodyOverride) {
	const headers = Object.entries(request.headers || {})
		.map(([key, value]) => `${key}: ${value}`)
		.join('\n');
	return [
		`${request.method || 'GET'} ${pathOverride || request.path || '/'} ${request.protocol || 'HTTP/1.1'}`,
		headers,
		'',
		bodyOverride != null ? bodyOverride : (request.body || ''),
	].join('\n');
}

function ProxyQueue({ queue, selectedId, onSelect }) {
	return (
		<FixedSizeList height={420} itemCount={queue.length} itemSize={ROW_HEIGHT} width='100%'>
			{({ index, style }) => {
				const item = queue[index];
				const isSelected = item.id === selectedId;
				return (
					<Flex
						style={style}
						px='2'
						align='center'
						bg={isSelected ? 'bg.subtle' : 'transparent'}
						borderBottomWidth='1px'
						borderColor='border.default'
						fontFamily='mono'
						fontSize='xs'
						cursor='pointer'
						onClick={() => onSelect(item.id)}
					>
						<Box flex='0 0 64px' px='2'>{item.method || 'GET'}</Box>
						<Box flex='0 0 180px' px='2' overflow='hidden' textOverflow='ellipsis' whiteSpace='nowrap'>{item.host || 'unknown-host'}</Box>
						<Box flex='1' px='2' overflow='hidden' textOverflow='ellipsis' whiteSpace='nowrap'>{item.path || '/'}</Box>
					</Flex>
				);
			}}
		</FixedSizeList>
	);
}

function ProxyPanel({ themeId }) {
	const [status, setStatus] = React.useState({ running: false, port: 8080, intercepting: true });
	const [queue, setQueue] = React.useState([]);
	const [selectedId, setSelectedId] = React.useState('');
	const [editPath, setEditPath] = React.useState('');
	const [editBody, setEditBody] = React.useState('');
	const [errorText, setErrorText] = React.useState('');
	const [noticeText, setNoticeText] = React.useState('');
	const [inspectorTab, setInspectorTab] = React.useState('raw');

	const selected = queue.find(item => item.id === selectedId) || null;

	React.useEffect(() => {
		let cancelled = false;
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.proxy) {
			return undefined;
		}

		async function bootstrap() {
			try {
				const currentStatus = await sentinel.proxy.status();
				if (!cancelled) {
					setStatus(currentStatus);
				}
			} catch {
				if (!cancelled) {
					setErrorText('Unable to load proxy status.');
				}
			}
		}

		bootstrap();

		const unsubscribe = sentinel.proxy.intercept.onRequest((request) => {
			if (cancelled || !request || !request.id) {
				return;
			}
			setQueue(prev => {
				if (prev.some(item => item.id === request.id)) {
					return prev;
				}
				return [request, ...prev];
			});
		});

		const unsubscribeResponse = sentinel.proxy.intercept.onResponse((response) => {
			if (cancelled || !response || !response.requestId) {
				return;
			}

			setQueue(prev => prev.filter(item => item.id !== response.requestId));
			setSelectedId(prev => (prev === response.requestId ? '' : prev));
		});

		const unsubscribeError = sentinel.proxy.intercept.onError((payload) => {
			if (cancelled || !payload) {
				return;
			}

			const requestId = payload.requestId || '';
			const message = payload.error || 'Unable to forward selected request.';
			setErrorText(requestId ? `Forward failed for ${requestId}: ${message}` : message);
		});

		return () => {
			cancelled = true;
			if (typeof unsubscribe === 'function') {
				unsubscribe();
			}
			if (typeof unsubscribeResponse === 'function') {
				unsubscribeResponse();
			}
			if (typeof unsubscribeError === 'function') {
				unsubscribeError();
			}
		};
	}, []);

	React.useEffect(() => {
		if (!selected) {
			setEditPath('');
			setEditBody('');
			return;
		}

		setEditPath(selected.path || '/');
		setEditBody(selected.body || '');
	}, [selectedId]);

	async function startProxy() {
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.proxy) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			const running = await sentinel.proxy.start({ port: status.port || 8080 });
			setStatus(prev => ({ ...prev, running: true, port: running.port }));
		} catch {
			setErrorText('Unable to start proxy listener.');
		}
	}

	async function stopProxy() {
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.proxy) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			await sentinel.proxy.stop();
			setStatus(prev => ({ ...prev, running: false }));
		} catch {
			setErrorText('Unable to stop proxy listener.');
		}
	}

	async function toggleIntercept() {
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.proxy) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			const next = await sentinel.proxy.intercept.toggle({ enabled: !status.intercepting });
			setStatus(prev => ({ ...prev, intercepting: next.intercepting }));
		} catch {
			setErrorText('Unable to toggle intercept mode.');
		}
	}

	async function forwardSelected() {
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.proxy || !selected) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			await sentinel.proxy.intercept.forward({
				requestId: selected.id,
				editedRequest: {
					path: editPath,
					body: editBody,
				},
			});
			setQueue(prev => prev.filter(item => item.id !== selected.id));
			setSelectedId('');
			setNoticeText('Forwarded selected request.');
		} catch {
			setErrorText('Unable to forward selected request.');
		}
	}

	async function dropSelected() {
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.proxy || !selected) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			await sentinel.proxy.intercept.drop({ requestId: selected.id });
			setQueue(prev => prev.filter(item => item.id !== selected.id));
			setSelectedId('');
			setNoticeText('Dropped selected request.');
		} catch {
			setErrorText('Unable to drop selected request.');
		}
	}

	function sendSelectedToRepeater() {
		if (!selected) {
			return;
		}
		window.dispatchEvent(new CustomEvent('sentinel:repeater-handoff', {
			detail: {
				request: {
					...selected,
					path: editPath || selected.path,
					body: editBody,
				},
			},
		}));
		window.dispatchEvent(new CustomEvent('sentinel:navigate-module', {
			detail: { moduleName: 'Repeater' },
		}));
		setNoticeText('Queued request loaded into Repeater.');
	}

	const rawRequest = selected ? buildRawRequest(selected, editPath, editBody) : '';

	return (
		<Flex h='100%' overflow='hidden' direction='column'>
			<Flex px='3' py='2' borderBottomWidth='1px' borderColor='border.default' bg='bg.elevated' align='center' justify='space-between' flexShrink='0' wrap='wrap' gap='2'>
				<HStack gap='3'>
					<Text fontWeight='medium' fontSize='sm' color='fg.default'>Proxy</Text>
					<Badge variant='outline' color='var(--sentinel-fg-default)' borderColor={status.running ? 'green.500' : 'orange.500'} bg={status.running ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.1)'}>
						{status.running ? 'Running' : 'Stopped'}
					</Badge>
					<Badge variant='outline' color='var(--sentinel-fg-default)' borderColor={status.intercepting ? 'purple.500' : 'blue.500'} bg={status.intercepting ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)'}>
						Intercept {status.intercepting ? 'On' : 'Off'}
					</Badge>
					<Text fontSize='xs' color='fg.muted'>Port <Code color='fg.default' bg='bg.subtle'>{status.port}</Code></Text>
				</HStack>
				<HStack gap='2'>
					<Button size='xs' variant='outline' onClick={status.running ? stopProxy : startProxy} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>
						{status.running ? 'Stop' : 'Start'}
					</Button>
					<Button size='xs' variant='outline' onClick={toggleIntercept} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>
						{status.intercepting ? 'Resume All' : 'Pause All'}
					</Button>
				</HStack>
			</Flex>
			<VStack align='stretch' spacing={3} p='4' flex='1' overflow='hidden'>
				<Text color='fg.muted' fontSize='sm'>
					Intercept queue depth: <Code color='fg.default' bg='bg.subtle'>{queue.length}</Code> · Inspector mode <Code color='fg.default' bg='bg.subtle'>{inspectorTab.toUpperCase()}</Code>
				</Text>

				<Flex flex='1' minH='0' gap='3' overflow='hidden'>
					<Box flex='1' minW='0' borderWidth='1px' borderRadius='sm' borderColor='border.default' overflow='hidden'>
						<Flex px='2' py='2' borderBottomWidth='1px' borderColor='border.default' fontSize='xs' color='fg.muted' fontFamily='mono'>
							<Box flex='0 0 64px' px='2'>METHOD</Box>
							<Box flex='0 0 180px' px='2'>HOST</Box>
							<Box flex='1' px='2'>PATH</Box>
						</Flex>
						{queue.length === 0 ? <Text color='fg.muted' fontSize='sm' p='3'>No paused requests.</Text> : <ProxyQueue queue={queue} selectedId={selectedId} onSelect={setSelectedId} />}
					</Box>
					<Box w='44%' minW='360px' borderWidth='1px' borderRadius='sm' borderColor='border.default' overflow='hidden'>
						{selected ? (
							<VStack align='stretch' spacing={3} p='3' h='100%'>
								<HStack justify='space-between' wrap='wrap'>
									<Box>
										<Text fontWeight='semibold'>{selected.method} {selected.host}{selected.path}</Text>
										<Text fontSize='xs' color='fg.muted'>Request ID <Code color='fg.default' bg='bg.subtle'>{selected.id}</Code></Text>
									</Box>
									<HStack>
										<Button size='xs' variant={inspectorTab === 'raw' ? 'solid' : 'outline'} onClick={() => setInspectorTab('raw')} color={inspectorTab === 'raw' ? 'fg.default' : 'fg.muted'} bg={inspectorTab === 'raw' ? 'bg.subtle' : 'bg.surface'} borderColor='border.default' _hover={{ bg: 'bg.subtle', color: 'fg.default' }}>Raw</Button>
										<Button size='xs' variant={inspectorTab === 'edit' ? 'solid' : 'outline'} onClick={() => setInspectorTab('edit')} color={inspectorTab === 'edit' ? 'fg.default' : 'fg.muted'} bg={inspectorTab === 'edit' ? 'bg.subtle' : 'bg.surface'} borderColor='border.default' _hover={{ bg: 'bg.subtle', color: 'fg.default' }}>Edit</Button>
									</HStack>
								</HStack>
								{inspectorTab === 'edit' ? (
									<VStack align='stretch' spacing={2}>
										<Input size='sm' value={editPath} onChange={event => setEditPath(event.target.value)} placeholder='Path' fontFamily='mono' color='fg.default' bg='bg.surface' borderColor='border.default' _placeholder={{ color: 'fg.muted' }} />
										<Box flex='1' minH='240px' borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' overflow='hidden'>
											<MonacoEditor
												height='240px'
												defaultLanguage='text'
												theme={getMonacoTheme(themeId)}
												value={editBody}
												onChange={value => setEditBody(value || '')}
												options={{ minimap: { enabled: false }, wordWrap: 'on', fontSize: 12 }}
											/>
										</Box>
									</VStack>
								) : (
									<Box flex='1' minH='240px' borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' overflow='hidden'>
										<MonacoEditor
											height='240px'
											defaultLanguage='http'
											theme={getMonacoTheme(themeId)}
											value={rawRequest}
											options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', fontSize: 12 }}
										/>
									</Box>
								)}
								<Separator />
								<HStack>
									<Button size='sm' colorPalette='green' onClick={forwardSelected}>Forward</Button>
									<Button size='sm' variant='outline' onClick={sendSelectedToRepeater} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>Send to Repeater</Button>
									<Button size='sm' colorPalette='red' variant='outline' onClick={dropSelected} bg='bg.surface' _hover={{ bg: 'bg.subtle' }}>Drop</Button>
								</HStack>
							</VStack>
						) : (
							<Box p='4'>
								<Text color='fg.muted' fontSize='sm'>Select a paused request to inspect or edit it before forwarding.</Text>
							</Box>
						)}
					</Box>
				</Flex>

				{errorText ? (
					<Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text>
				) : null}
				{noticeText ? (
					<Text color={getStatusTextColor('success', themeId)} fontSize='sm'>{noticeText}</Text>
				) : null}
			</VStack>
		</Flex>
	);
}

export default ProxyPanel;
