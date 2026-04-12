/*
SEN-016 Repeater Panel
AC 1: Load any history item into an editable entry.
AC 2: Edit method, path, headers, and body before sending.
AC 3: Response in Raw, Hex, and Rendered tabs.
AC 4: Each send stored in the entry's local history.
AC 5: Side-by-side compare between two sends.
*/

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
	Textarea,
	VStack,
} from '@chakra-ui/react';
import MonacoEditor from '@monaco-editor/react';
import { getStatusTextColor, getMonacoTheme } from './theme-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function headersObjectToText(headers) {
	if (!headers || typeof headers !== 'object') {
		return '';
	}
	return Object.entries(headers)
		.map(([k, v]) => `${k}: ${v}`)
		.join('\n');
}

function headersTextToObject(text) {
	const result = {};
	for (const line of String(text || '').split('\n')) {
		const idx = line.indexOf(':');
		if (idx > 0) {
			const key = line.slice(0, idx).trim().toLowerCase();
			const value = line.slice(idx + 1).trim();
			if (key) {
				result[key] = value;
			}
		}
	}
	return result;
}

function toHex(base64) {
	if (!base64) {
		return '';
	}
	try {
		const bytes = Buffer.from(base64, 'base64');
		const pairs = [];
		for (let i = 0; i < bytes.length; i++) {
			pairs.push(bytes[i].toString(16).padStart(2, '0'));
			if ((i + 1) % 16 === 0) {
				pairs.push('\n');
			} else if ((i + 1) % 8 === 0) {
				pairs.push('  ');
			} else {
				pairs.push(' ');
			}
		}
		return pairs.join('').trim();
	} catch {
		return '';
	}
}

function labelForSend(send) {
	if (!send) {
		return '';
	}
	return `${send.request.method} ${send.request.path || send.request.url || '/'} — ${new Date(send.sentAt).toLocaleTimeString()}`;
}

function bodyOfSend(send) {
	if (!send?.response) {
		return '[none]';
	}
	if (send.response.body !== undefined && send.response.body !== null) {
		return String(send.response.body);
	}
	if (send.response.rawBodyBase64) {
		return `[binary ${send.response.bodyLength} bytes]`;
	}
	return '[empty]';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ResponseViewer(props) {
	const { response, themeId } = props;
	const [view, setView] = React.useState('raw');

	if (!response) {
		return (
			<Box borderWidth='1px' borderRadius='md' p={3}>
				<Text color='fg.muted' fontSize='sm'>No response yet. Click Send.</Text>
			</Box>
		);
	}

	let statusColor = 'red';
	if (response.statusCode < 300) {
		statusColor = 'green';
	} else if (response.statusCode < 400) {
		statusColor = 'blue';
	}

	let rawText = '[empty body]';
	if (response.body !== undefined && response.body !== null) {
		rawText = String(response.body);
	} else if (response.rawBodyBase64) {
		rawText = `[binary ${response.bodyLength || 0} bytes]`;
	}

	const hexText = toHex(response.rawBodyBase64);
	const renderedHtml = response.contentType?.includes('html') && response.body
		? response.body
		: null;
	const hasTiming = Number.isFinite(response.timings?.total);
	const timingText = hasTiming ? ` · ${response.timings.total}ms` : '';

	const statusColorMap = {
		green: { border: 'green.500', bg: 'rgba(34,197,94,0.1)' },
		blue: { border: 'blue.500', bg: 'rgba(59,130,246,0.1)' },
		red: { border: 'red.500', bg: 'rgba(239,68,68,0.1)' }
	};
	const badgeStyles = statusColorMap[statusColor] || statusColorMap.blue;

	return (
		<Box borderWidth='1px' borderRadius='md' p={3}>
			<HStack mb={2} wrap='wrap'>
				<Badge variant='outline' color='var(--sentinel-fg-default)' borderColor={badgeStyles.border} bg={badgeStyles.bg}>
					{response.statusCode} {response.statusMessage}
				</Badge>
				<Text fontSize='xs' color='fg.muted'>
					{response.contentType || 'unknown'} · {response.bodyLength || 0} bytes
					{timingText}
				</Text>
			</HStack>
			<HStack mb={2}>
				{['raw', 'hex', 'rendered'].map(mode => (
					<Button
						key={mode}
						size='xs'
						variant={view === mode ? 'solid' : 'ghost'}
						onClick={() => setView(mode)}
						color={view === mode ? 'fg.default' : 'fg.muted'}
						bg={view === mode ? 'bg.subtle' : 'bg.surface'}
						borderColor='border.default'
						_hover={{ bg: 'bg.subtle', color: 'fg.default' }}
					>
						{mode.charAt(0).toUpperCase() + mode.slice(1)}
					</Button>
				))}
			</HStack>
			{view === 'raw' && (
				<Box flex='1' minH='240px' borderWidth='1px' borderRadius='sm' borderColor='border.default' bg='bg.surface' overflow='hidden'>
					<MonacoEditor
						height='240px'
						defaultLanguage='http'
						theme={getMonacoTheme(themeId)}
						value={rawText}
						options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', fontSize: 12 }}
					/>
				</Box>
			)}
			{view === 'hex' && (
				<Box
					as='pre'
					fontSize='xs'
					fontFamily='mono'
					whiteSpace='pre-wrap'
					overflowY='auto'
					maxH='240px'
					p={2}
					borderWidth='1px'
					borderRadius='sm'
				>
					{hexText || '[no binary data]'}
				</Box>
			)}
			{view === 'rendered' && (
				renderedHtml ? (
					/* Render in a sandboxed iframe so server-controlled HTML/JS cannot
					   reach window.sentinel or any other renderer globals.
					   sandbox="" with no tokens: no scripts, no forms, no top-navigation. */
					<Box
						as='iframe'
						sandbox=''
						srcDoc={renderedHtml}
						title='Rendered response'
						borderWidth='1px'
						borderColor='border.default'
						style={{ width: '100%', height: '240px' }}
					/>
				) : (
					<Box
						as='pre'
						fontSize='xs'
						fontFamily='mono'
						whiteSpace='pre-wrap'
						overflowY='auto'
						maxH='240px'
						p={2}
						borderWidth='1px'
						borderRadius='sm'
					>
						{rawText}
					</Box>
				)
			)}
		</Box>
	);
}

ResponseViewer.propTypes = {
	response: PropTypes.shape({
		statusCode: PropTypes.number,
		statusMessage: PropTypes.string,
		body: PropTypes.any,
		rawBodyBase64: PropTypes.string,
		bodyLength: PropTypes.number,
		contentType: PropTypes.string,
		timings: PropTypes.shape({
			total: PropTypes.number,
		}),
	}),
	themeId: PropTypes.string,
};

// ---------------------------------------------------------------------------
// CompareView – AC 5
// ---------------------------------------------------------------------------

function CompareView(props) {
	const { sends } = props;
	const [idA, setIdA] = React.useState('');
	const [idB, setIdB] = React.useState('');

	if (sends.length < 2) {
		return (
			<Box borderWidth='1px' borderRadius='md' p={3}>
				<Text color='fg.muted' fontSize='sm'>Send at least 2 requests to compare.</Text>
			</Box>
		);
	}

	const sendA = sends.find(s => s.id === idA);
	const sendB = sends.find(s => s.id === idB);

	return (
		<Box borderWidth='1px' borderRadius='md' p={3}>
			<Text fontWeight='semibold' fontSize='sm' mb={2}>Compare Sends</Text>
			<HStack mb={3} align='flex-start' wrap='wrap'>
				<Box flex='1' minW='200px'>
					<Text fontSize='xs' color='fg.muted' mb={1}>Send A</Text>
					<Box
						as='select'
						value={idA}
						onChange={e => setIdA(e.target.value)}
						color='fg.default'
						bg='bg.surface'
						borderColor='border.default'
						borderWidth='1px'
						borderRadius='sm'
						px='2'
						h='1.75rem'
					>
						<option value=''>— pick a send —</option>
						{sends.map(s => (
							<option key={s.id} value={s.id}>{labelForSend(s)}</option>
						))}
					</Box>
				</Box>
				<Box flex='1' minW='200px'>
					<Text fontSize='xs' color='fg.muted' mb={1}>Send B</Text>
					<Box
						as='select'
						value={idB}
						onChange={e => setIdB(e.target.value)}
						color='fg.default'
						bg='bg.surface'
						borderColor='border.default'
						borderWidth='1px'
						borderRadius='sm'
						px='2'
						h='1.75rem'
					>
						<option value=''>— pick a send —</option>
						{sends.map(s => (
							<option key={s.id} value={s.id}>{labelForSend(s)}</option>
						))}
					</Box>
				</Box>
			</HStack>
			{(idA || idB) && (
				<HStack align='flex-start' spacing={4} wrap='wrap'>
					<Box flex='1' minW='280px'>
						{sendA && (
							<>
								<Text fontSize='xs' fontWeight='semibold' mb={1}>
									A — {sendA.response && `${sendA.response.statusCode} · ${sendA.response.bodyLength}b · ${sendA.response.timings ? sendA.response.timings.total + 'ms' : ''}`}
								</Text>
								<Box as='pre' fontSize='xs' fontFamily='mono' whiteSpace='pre-wrap' overflowY='auto' maxH='200px' p={2} borderWidth='1px' borderRadius='sm'>
									{bodyOfSend(sendA)}
								</Box>
							</>
						)}
					</Box>
					<Box flex='1' minW='280px'>
						{sendB && (
							<>
								<Text fontSize='xs' fontWeight='semibold' mb={1}>
									B — {sendB.response && `${sendB.response.statusCode} · ${sendB.response.bodyLength}b · ${sendB.response.timings ? sendB.response.timings.total + 'ms' : ''}`}
								</Text>
								<Box as='pre' fontSize='xs' fontFamily='mono' whiteSpace='pre-wrap' overflowY='auto' maxH='200px' p={2} borderWidth='1px' borderRadius='sm'>
									{bodyOfSend(sendB)}
								</Box>
							</>
						)}
					</Box>
				</HStack>
			)}
		</Box>
	);
}

CompareView.propTypes = {
	sends: PropTypes.arrayOf(PropTypes.shape({
		id: PropTypes.string,
		sentAt: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
		request: PropTypes.shape({
			method: PropTypes.string,
			path: PropTypes.string,
			url: PropTypes.string,
		}),
		response: PropTypes.shape({
			statusCode: PropTypes.number,
			bodyLength: PropTypes.number,
			body: PropTypes.any,
			rawBodyBase64: PropTypes.string,
			timings: PropTypes.shape({
				total: PropTypes.number,
			}),
		}),
	})).isRequired,
};

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

function RepeaterPanel(props) {
	const { themeId } = props;
	// Sidebar
	const [entries, setEntries] = React.useState([]);
	const [selectedEntryId, setSelectedEntryId] = React.useState('');
	const [activeSends, setActiveSends] = React.useState([]);
	const [compareOpen, setCompareOpen] = React.useState(false);

	// Editor
	const [editMethod, setEditMethod] = React.useState('GET');
	const [editUrl, setEditUrl] = React.useState('');
	const [editHeaders, setEditHeaders] = React.useState('');
	const [editBody, setEditBody] = React.useState('');

	// Response
	const [response, setResponse] = React.useState(null);
	const [sending, setSending] = React.useState(false);
	const [errorText, setErrorText] = React.useState('');

	const sentinel = globalThis?.window?.sentinel || null;

	// Load sidebar entries on mount
	React.useEffect(() => {
		if (!sentinel?.repeater) {
			return;
		}
		sentinel.repeater.historyList().then(result => {
			setEntries(Array.isArray(result.items) ? result.items : []);
		}).catch(() => {});
	}, []);

	React.useEffect(() => {
		const appWindow = globalThis?.window;
		if (!appWindow) {
			return undefined;
		}

		function handleHandoff(event) {
			const request = event?.detail?.request || null;
			if (!request) {
				return;
			}
			setSelectedEntryId('');
			setEditMethod((request.method || 'GET').toUpperCase());
			setEditUrl(request.url || `${request.scheme || 'http'}://${request.host || 'localhost'}${request.path || '/'}`);
			setEditHeaders(headersObjectToText(request.headers));
			setEditBody(request.body || '');
			setResponse(null);
			setActiveSends([]);
			setCompareOpen(false);
			setErrorText('');
		}

		appWindow.addEventListener('sentinel:repeater-handoff', handleHandoff);
		return () => {
			appWindow.removeEventListener('sentinel:repeater-handoff', handleHandoff);
		};
	}, []);

	async function loadEntry(id) {
		if (!sentinel?.repeater) {
			return;
		}
		try {
			const entry = await sentinel.repeater.get({ id });
			if (!entry) {
				return;
			}
			setSelectedEntryId(entry.id);
			setEditMethod(entry.request.method || 'GET');
			setEditUrl(entry.request.url || (entry.request.path || '/'));
			setEditHeaders(headersObjectToText(entry.request.headers));
			setEditBody(entry.request.body || '');
			setResponse(entry.response || null);
			setActiveSends(Array.isArray(entry.sends) ? entry.sends : []);
			setCompareOpen(false);
		} catch {
			setErrorText('Unable to load entry.');
		}
	}

	async function handleSend() {
		if (!sentinel?.repeater) {
			return;
		}
		setErrorText('');
		setSending(true);
		try {
			const request = {
				method: editMethod.toUpperCase(),
				url: editUrl,
				headers: headersTextToObject(editHeaders),
				body: editBody || null,
			};
			const args = selectedEntryId ? { request, entryId: selectedEntryId } : { request };
			const result = await sentinel.repeater.send(args);
			setResponse(result.response);

			// Refresh the entry sidebar and sends list
			const listResult = await sentinel.repeater.historyList();
			setEntries(Array.isArray(listResult.items) ? listResult.items : []);

			const entryId = result.entry?.id || selectedEntryId;
			if (entryId) {
				setSelectedEntryId(entryId);
				const fullEntry = await sentinel.repeater.get({ id: entryId });
				if (fullEntry) {
					setActiveSends(Array.isArray(fullEntry.sends) ? fullEntry.sends : []);
				}
			}
		} catch (error) {
			setErrorText(error?.message || 'Send failed.');
		} finally {
			setSending(false);
		}
	}

	function clearEditor() {
		setSelectedEntryId('');
		setEditMethod('GET');
		setEditUrl('');
		setEditHeaders('');
		setEditBody('');
		setResponse(null);
		setActiveSends([]);
		setCompareOpen(false);
		setErrorText('');
	}

	return (
		<Box p={4} h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word' borderWidth='1px' borderRadius='md'>
			<VStack align='stretch' spacing={3}>
				<Flex justify='space-between' align='center' mb='3' pb='3' borderBottomWidth='1px' borderColor='border.default'>
					<Text fontWeight='medium' fontSize='sm' color='fg.default'>Repeater</Text>
					<HStack gap='2'>
						<Button size='xs' variant='outline' onClick={clearEditor} color='fg.default' bg='bg.surface' borderColor='border.default' _hover={{ bg: 'bg.subtle' }}>New Request</Button>
					</HStack>
				</Flex>

				<HStack align='flex-start' spacing={4} wrap='wrap'>
					{/* Sidebar — entry list */}
					<Box minW='180px' flex='0 0 180px'>
						<Text fontWeight='semibold' fontSize='sm' mb={2}>Sessions</Text>
						<VStack align='stretch' spacing={1}>
							{entries.length === 0 ? (
								<Text fontSize='xs' color='fg.muted'>No sessions yet.</Text>
							) : entries.map(entry => (
								<Button
									key={entry.id}
									size='xs'
									variant={selectedEntryId === entry.id ? 'solid' : 'ghost'}
									textAlign='left'
									whiteSpace='nowrap'
									overflow='hidden'
									textOverflow='ellipsis'
									onClick={() => loadEntry(entry.id)}
								>
									{entry.request?.method || 'GET'}{' '}
									{entry.request?.url || entry.request?.path || '/'}
								</Button>
							))}
						</VStack>
					</Box>

					{/* Editor + Response */}
					<Box flex='1' minW='300px'>
						<VStack align='stretch' spacing={2}>
							{/* Method + URL row */}
							<HStack>
								<Input
									size='sm'
									value={editMethod}
									onChange={e => setEditMethod(e.target.value)}
									maxW='100px'
									placeholder='GET'
									fontFamily='mono'
									textTransform='uppercase'
									color='fg.default'
									bg='bg.surface'
									borderColor='border.default'
									_placeholder={{ color: 'fg.muted' }}
								/>
								<Input
									size='sm'
									flex='1'
									value={editUrl}
									onChange={e => setEditUrl(e.target.value)}
									placeholder='https://example.com/path'
									fontFamily='mono'
									color='fg.default'
									bg='bg.surface'
									borderColor='border.default'
									_placeholder={{ color: 'fg.muted' }}
								/>
								<Button
									size='sm'
									colorPalette='green'
									onClick={handleSend}
									loading={sending}
									disabled={sending || !editUrl.trim()}
								>
									Send
								</Button>
							</HStack>

							{/* Headers */}
							<Textarea
								size='sm'
								value={editHeaders}
								onChange={e => setEditHeaders(e.target.value)}
								placeholder={'host: example.com\ncontent-type: application/json'}
								rows={4}
								fontFamily='mono'
								fontSize='xs'
								color='fg.default'
								bg='bg.surface'
								borderColor='border.default'
								_placeholder={{ color: 'fg.muted' }}
							/>

							{/* Body */}
							<Textarea
								size='sm'
								value={editBody}
								onChange={e => setEditBody(e.target.value)}
								placeholder='Request body (optional)'
								rows={5}
								fontFamily='mono'
								fontSize='xs'
								color='fg.default'
								bg='bg.surface'
								borderColor='border.default'
								_placeholder={{ color: 'fg.muted' }}
							/>

							{errorText && <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text>}

							{/* Response viewer — AC 3 */}
							<ResponseViewer response={response} themeId={themeId} />

							{/* Send history for this entry — AC 4 */}
							{activeSends.length > 0 && (
								<Box borderWidth='1px' borderRadius='md' p={3}>
									<HStack justify='space-between' mb={2}>
										<Text fontWeight='semibold' fontSize='sm'>
											Send History ({activeSends.length})
										</Text>
										<Button
											size='xs'
											variant='outline'
											onClick={() => setCompareOpen(prev => !prev)}
											color='fg.default'
											bg='bg.surface'
											borderColor='border.default'
											_hover={{ bg: 'bg.subtle' }}
										>
											{compareOpen ? 'Hide Compare' : 'Compare…'}
										</Button>
									</HStack>
									<VStack align='stretch' spacing={1} maxH='160px' overflowY='auto'>
										{activeSends.map(send => (
											<HStack key={send.id} justify='space-between'>
												<Text fontSize='xs' fontFamily='mono'>
													{send.request.method}{' '}
													{send.request.path || send.request.url || '/'}{' '}
													→{' '}
													<Code fontSize='xs' color='fg.default' bg='bg.subtle'>
														{send.response?.statusCode}
													</Code>
												</Text>
												<Text fontSize='xs' color='fg.muted'>
													{send.response?.bodyLength}b
													{' '}
													{send.response?.timings
														? `${send.response.timings.total}ms`
														: ''}
												</Text>
											</HStack>
										))}
									</VStack>
								</Box>
							)}

							{/* Compare view — AC 5 */}
							{compareOpen && <CompareView sends={activeSends} />}
						</VStack>
					</Box>
				</HStack>
			</VStack>
		</Box>
	);
}

RepeaterPanel.propTypes = {
	themeId: PropTypes.string,
};

export default RepeaterPanel;
