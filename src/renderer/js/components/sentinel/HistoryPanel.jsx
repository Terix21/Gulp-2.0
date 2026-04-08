import React from 'react';
import {
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
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { getMonacoTheme, getStatusTextColor } from './theme-utils';

const columnHelper = createColumnHelper();
const ROW_HEIGHT = 34;

function toHex(base64) {
	if (!base64) {
		return '';
	}
	try {
		const raw = atob(base64);
		const parts = [];
		for (let index = 0; index < raw.length; index += 1) {
			parts.push(raw.charCodeAt(index).toString(16).padStart(2, '0'));
		}
		return parts.join(' ');
	} catch {
		return '';
	}
}

function buildRawRequest(request = {}) {
	const headers = Object.entries(request.headers || {})
		.map(([key, value]) => `${key}: ${value}`)
		.join('\n');
	return [
		`${request.method || 'GET'} ${request.path || '/'} ${request.protocol || 'HTTP/1.1'}`,
		headers,
		'',
		request.body || '',
	].join('\n');
}

function buildRawResponse(response = {}) {
	const headers = Object.entries(response.headers || {})
		.map(([key, value]) => `${key}: ${value}`)
		.join('\n');
	return [
		`${response.statusCode || 0} ${response.statusMessage || ''}`,
		headers,
		'',
		response.body || '',
	].join('\n');
}

function InspectorSection({ item, inspectorTab, setInspectorTab, onSendToRepeater, onSendToIntruder, themeId }) {
	if (!item) {
		return (
			<Box p={4} h='100%'>
				<Text color='fg.muted' fontSize='sm'>Select a history row to inspect request and response details.</Text>
			</Box>
		);
	}

	const request = item.request || {};
	const response = item.response || {};
	const headersEntries = Object.entries(response.headers || request.headers || {});
	const previewHtml = response.contentType && String(response.contentType).includes('html') ? response.body : null;
	const hexText = response.rawBodyBase64 ? toHex(response.rawBodyBase64) : (request.rawBodyBase64 ? toHex(request.rawBodyBase64) : '');
	const rawText = response.statusCode ? buildRawResponse(response) : buildRawRequest(request);

	return (
		<VStack align='stretch' h='100%' gap='3' p='3'>
			<HStack justify='space-between' wrap='wrap'>
				<Box>
					<Text fontWeight='semibold'>{request.method || 'GET'} {request.host || 'unknown-host'}{request.path || '/'}</Text>
					<Text fontSize='xs' color='fg.muted'>Status <Code>{String(response.statusCode || 'pending')}</Code></Text>
				</Box>
				<HStack>
					<Button size='xs' variant='outline' onClick={onSendToRepeater}>Send to Repeater</Button>
					<Button size='xs' variant='outline' onClick={onSendToIntruder}>Send to Intruder</Button>
				</HStack>
			</HStack>
			<HStack>
				{['headers', 'raw', 'preview', 'hex'].map((tabName) => (
					<Button
						key={tabName}
						size='xs'
						variant={inspectorTab === tabName ? 'solid' : 'outline'}
						onClick={() => setInspectorTab(tabName)}
					>
						{tabName === 'raw' ? 'Raw' : tabName === 'preview' ? 'Preview' : tabName === 'hex' ? 'Hex' : 'Headers'}
					</Button>
				))}
			</HStack>
			<Box flex='1' minH='0' borderWidth='1px' borderRadius='sm' borderColor='border.default' overflow='hidden'>
				{inspectorTab === 'headers' ? (
					<VStack align='stretch' gap='1' p='3' overflowY='auto' h='100%'>
						{headersEntries.length === 0 ? <Text fontSize='sm' color='fg.muted'>No headers available.</Text> : null}
						{headersEntries.map(([key, value]) => (
							<Flex key={key} justify='space-between' gap='3' fontSize='sm'>
								<Code>{key}</Code>
								<Text color='fg.muted' textAlign='right'>{String(value)}</Text>
							</Flex>
						))}
					</VStack>
				) : null}
				{inspectorTab === 'raw' ? (
					<MonacoEditor
						height='100%'
						defaultLanguage='http'
						theme={getMonacoTheme(themeId)}
						value={rawText}
						options={{ readOnly: true, minimap: { enabled: false }, wordWrap: 'on', fontSize: 12 }}
					/>
				) : null}
				{inspectorTab === 'preview' ? (
					previewHtml ? (
						<Box as='iframe' sandbox='' srcDoc={previewHtml} title='Preview' w='100%' h='100%' border='0' />
					) : (
						<Box as='pre' p='3' fontSize='xs' fontFamily='mono' whiteSpace='pre-wrap' overflow='auto' h='100%'>
							{response.body || request.body || '[No previewable content]'}
						</Box>
					)
				) : null}
				{inspectorTab === 'hex' ? (
					<Box as='pre' p='3' fontSize='xs' fontFamily='mono' whiteSpace='pre-wrap' overflow='auto' h='100%'>
						{hexText || '[No binary data]'}
					</Box>
				) : null}
			</Box>
		</VStack>
	);
}

function VirtualizedHistoryTable({ table, selectedId, onSelect }) {
	const rows = table.getRowModel().rows;

	return (
		<Box h='100%' display='flex' flexDirection='column'>
			<Flex px='2' py='2' borderBottomWidth='1px' borderColor='border.default' fontSize='xs' color='fg.muted' fontFamily='mono'>
				{table.getFlatHeaders().map((header) => (
					<Box key={header.id} flex={header.column.columnDef.meta && header.column.columnDef.meta.flex ? header.column.columnDef.meta.flex : '1'} px='2'>
						{flexRender(header.column.columnDef.header, header.getContext())}
					</Box>
				))}
			</Flex>
			<Box flex='1'>
				<FixedSizeList
					height={420}
					itemCount={rows.length}
					itemSize={ROW_HEIGHT}
					width='100%'
				>
					{({ index, style }) => {
						const row = rows[index];
						const isSelected = row.original.id === selectedId;
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
								onClick={() => onSelect(row.original.id)}
							>
								{row.getVisibleCells().map((cell) => (
									<Box key={cell.id} flex={cell.column.columnDef.meta && cell.column.columnDef.meta.flex ? cell.column.columnDef.meta.flex : '1'} px='2' overflow='hidden' textOverflow='ellipsis' whiteSpace='nowrap'>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</Box>
								))}
							</Flex>
						);
					}}
				</FixedSizeList>
			</Box>
		</Box>
	);
}

function HistoryPanel({ themeId }) {
	const [items, setItems] = React.useState([]);
	const [loading, setLoading] = React.useState(true);
	const [errorText, setErrorText] = React.useState('');
	const [noticeText, setNoticeText] = React.useState('');
	const [page, setPage] = React.useState(0);
	const [pageSize, setPageSize] = React.useState(250);
	const [total, setTotal] = React.useState(0);
	const [selectedId, setSelectedId] = React.useState('');
	const [inspectorTab, setInspectorTab] = React.useState('headers');
	const [filters, setFilters] = React.useState({
		host: '',
		path: '',
		method: '',
		statusCode: '',
	});
	const loadHistoryRef = React.useRef(null);
	const refreshTimerRef = React.useRef(null);
	const refreshPendingRef = React.useRef(false);
	const bufferedItemsRef = React.useRef([]);
	const knownIdsRef = React.useRef(new Set());
	const activeFilterRef = React.useRef({});
	const pageRef = React.useRef(0);
	const pageSizeRef = React.useRef(250);

	function buildQueryFilter(rawFilters) {
		const hostValue = String(rawFilters.host || '').trim();
		const pathValue = String(rawFilters.path || '').trim();
		const methodValue = String(rawFilters.method || '').trim().toUpperCase();
		const statusCodeValue = String(rawFilters.statusCode || '').trim();
		const parsedStatus = statusCodeValue ? Number(statusCodeValue) : null;

		return {
			host: hostValue || undefined,
			path: pathValue || undefined,
			method: methodValue || undefined,
			statusCode: Number.isFinite(parsedStatus) ? parsedStatus : undefined,
		};
	}

	function matchesActiveFilters(item, filter) {
		const request = item && item.request ? item.request : {};
		const response = item && item.response ? item.response : {};

		if (filter.method && String(request.method || '').toUpperCase() !== String(filter.method).toUpperCase()) {
			return false;
		}

		if (filter.host && !String(request.host || '').toLowerCase().includes(String(filter.host).toLowerCase())) {
			return false;
		}

		if (filter.path && !String(request.path || '').startsWith(String(filter.path))) {
			return false;
		}

		if (typeof filter.statusCode === 'number' && response.statusCode !== filter.statusCode) {
			return false;
		}

		return true;
	}

	const loadHistory = React.useCallback(async (nextPage = 0) => {
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.history) {
			setLoading(false);
			return;
		}

		setErrorText('');
		setNoticeText('');
		setLoading(true);
		try {
			const queryFilter = buildQueryFilter(filters);

			const result = await sentinel.history.query({
				page: nextPage,
				pageSize,
				filter: queryFilter,
			});

			const loadedItems = Array.isArray(result.items) ? result.items : [];
			if (nextPage === 0) {
				bufferedItemsRef.current = [];
			}
			knownIdsRef.current = new Set(loadedItems.map(item => item?.id).filter(Boolean));
			setItems(loadedItems);
			setTotal(Number(result.total) || 0);
			setPage(Number(result.page) || 0);
		} catch {
			setErrorText('Unable to load traffic history.');
		} finally {
			setLoading(false);
		}
	}, [filters, pageSize]);

	React.useEffect(() => {
		loadHistoryRef.current = loadHistory;
	}, [loadHistory]);

	React.useEffect(() => {
		activeFilterRef.current = buildQueryFilter(filters);
		pageRef.current = page;
		pageSizeRef.current = pageSize;
	}, [filters, page, pageSize]);

	const columns = React.useMemo(() => ([
		columnHelper.accessor(row => row.request && row.request.method ? row.request.method : 'GET', {
			id: 'method',
			header: 'METHOD',
			cell: info => info.getValue(),
			meta: { flex: '0 0 72px' },
		}),
		columnHelper.accessor(row => row.request && row.request.host ? row.request.host : 'unknown-host', {
			id: 'host',
			header: 'HOST',
			cell: info => info.getValue(),
			meta: { flex: '0 0 180px' },
		}),
		columnHelper.accessor(row => row.request && row.request.path ? row.request.path : '/', {
			id: 'path',
			header: 'PATH',
			cell: info => info.getValue(),
			meta: { flex: '1' },
		}),
		columnHelper.accessor(row => row.response && row.response.statusCode ? row.response.statusCode : '...', {
			id: 'status',
			header: 'STATUS',
			cell: info => String(info.getValue()),
			meta: { flex: '0 0 72px' },
		}),
		columnHelper.accessor(row => new Date(row.timestamp).toLocaleTimeString(), {
			id: 'time',
			header: 'TIME',
			cell: info => info.getValue(),
			meta: { flex: '0 0 100px' },
		}),
	]), []);

	const table = useReactTable({
		data: items,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	React.useEffect(() => {
		let cancelled = false;
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.history) {
			setLoading(false);
			return undefined;
		}

		if (loadHistoryRef.current) {
			loadHistoryRef.current(0);
		}

		const scheduleRefresh = () => {
			refreshPendingRef.current = true;
			if (refreshTimerRef.current) {
				return;
			}

			refreshTimerRef.current = setTimeout(() => {
				refreshTimerRef.current = null;
				if (cancelled) {
					return;
				}

				const pendingItems = bufferedItemsRef.current.splice(0);
				if (pageRef.current === 0 && pendingItems.length > 0) {
					setItems(prev => {
						const mergedById = new Map();
						[pendingItems, prev].forEach(collection => {
							collection.forEach(item => {
								if (!item || mergedById.has(item.id)) {
									return;
								}
								mergedById.set(item.id, item);
							});
						});
						return Array.from(mergedById.values()).slice(0, pageSizeRef.current);
					});
				}

				if (refreshPendingRef.current && loadHistoryRef.current) {
					refreshPendingRef.current = false;
					loadHistoryRef.current(0);
				}
			}, 150);
		};

		const unsubscribe = sentinel.history.onPush((item) => {
			if (cancelled || !item) {
				return;
			}

			if (pageRef.current === 0 && matchesActiveFilters(item, activeFilterRef.current)) {
				const isInBuffer = bufferedItemsRef.current.some(existing => existing && existing.id === item.id);
				if (!isInBuffer && !knownIdsRef.current.has(item.id)) {
					bufferedItemsRef.current.unshift(item);
					knownIdsRef.current.add(item.id);
					setTotal(prevTotal => prevTotal + 1);
				}
			}

			scheduleRefresh();
		});

		return () => {
			cancelled = true;
			refreshPendingRef.current = false;
			if (refreshTimerRef.current) {
				clearTimeout(refreshTimerRef.current);
				refreshTimerRef.current = null;
			}
			bufferedItemsRef.current = [];
			if (typeof unsubscribe === 'function') {
				unsubscribe();
			}
		};
	}, []);

	async function clearHistory() {
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.history) {
			return;
		}
		setErrorText('');
		setNoticeText('');
		try {
			await sentinel.history.clear();
			setItems([]);
			setTotal(0);
			setPage(0);
		} catch {
			setErrorText('Unable to clear history.');
		}
	}

	async function sendToRepeater(itemId) {
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.history || !sentinel.repeater) {
			return;
		}

		setErrorText('');
		setNoticeText('');
		try {
			const item = await sentinel.history.get({ id: itemId });
			if (!item || !item.request) {
				throw new Error('Selected history item has no request payload.');
			}

			await sentinel.repeater.send({ request: item.request });
			setNoticeText('Sent to Repeater.');
		} catch {
			setErrorText('Unable to send item to Repeater.');
		}
	}

	async function sendToIntruder(itemId) {
		const sentinel = window.sentinel;
		if (!sentinel || !sentinel.history || !sentinel.intruder) {
			return;
		}

		setErrorText('');
		setNoticeText('');
		try {
			const item = await sentinel.history.get({ id: itemId });
			if (!item || !item.request) {
				throw new Error('Selected history item has no request payload.');
			}

			const request = item.request;
			const scheme = request.tls ? 'https' : 'http';
			const authority = request.host || (request.headers && request.headers.host) || 'localhost';
			const originalUrl = request.url || `${scheme}://${authority}${request.path || '/'}`;
			const separator = originalUrl.includes('?') ? '&' : '?';
			const templateUrl = `${originalUrl}${separator}attack=§injection§`;

			const configured = await sentinel.intruder.configure({
				config: {
					requestTemplate: {
						method: request.method,
						url: templateUrl,
						headers: request.headers,
						body: request.body,
					},
					attackType: 'sniper',
					positions: [
						{
							source: {
								type: 'dictionary',
								items: ['test', 'admin', "' or 1=1 --"],
							},
						},
					],
				},
			});

			await sentinel.intruder.start({ configId: configured.configId });
			setNoticeText('Sent to Intruder.');
		} catch {
			setErrorText('Unable to send item to Intruder.');
		}
	}

	function sendToRepeaterInspector(item) {
		window.dispatchEvent(new CustomEvent('sentinel:repeater-handoff', {
			detail: {
				request: item.request,
			},
		}));
		window.dispatchEvent(new CustomEvent('sentinel:navigate-module', {
			detail: { moduleName: 'Repeater' },
		}));
		setNoticeText('Loaded selected request into Repeater tab.');
	}

	const selectedItem = items.find(item => item && item.id === selectedId) || null;

	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	function onFilterChange(key, value) {
		setFilters(prev => ({ ...prev, [key]: value }));
	}

	return (
		<Flex h='100%' overflow='hidden' direction='column'>
			<Flex px='3' py='2' borderBottomWidth='1px' borderColor='border.default' bg='bg.elevated' align='center' justify='space-between' flexShrink='0'>
				<Text fontWeight='medium' fontSize='sm'>History</Text>
				<HStack gap='2'>
					<Button size='xs' variant='outline' onClick={() => loadHistory(page)}>Refresh</Button>
					<Button size='xs' variant='outline' colorPalette='red' onClick={clearHistory}>Clear</Button>
				</HStack>
			</Flex>
			<VStack align='stretch' spacing={3} p='4' flex='1' overflow='hidden'>

				<HStack wrap='wrap'>
					<Input
						size='xs'
						placeholder='Host'
						value={filters.host}
						onChange={event => onFilterChange('host', event.target.value)}
						maxW='180px'
					/>
					<Input
						size='xs'
						placeholder='Path prefix'
						value={filters.path}
						onChange={event => onFilterChange('path', event.target.value)}
						maxW='180px'
					/>
					<Input
						size='xs'
						placeholder='Method (GET)'
						value={filters.method}
						onChange={event => onFilterChange('method', event.target.value)}
						maxW='140px'
					/>
					<Input
						size='xs'
						type='number'
						placeholder='Status (200)'
						value={filters.statusCode}
						onChange={event => onFilterChange('statusCode', event.target.value)}
						maxW='140px'
					/>
					<Button size='xs' variant='outline' onClick={() => loadHistory(0)}>Apply</Button>
				</HStack>

				<Text fontSize='sm' color='fg.muted'>
					Page <Code>{page + 1}</Code> / <Code>{totalPages}</Code> · Showing <Code>{items.length}</Code> of <Code>{total}</Code>
				</Text>
				<Text fontSize='xs' color='fg.muted'>Buffered stream flush cadence <Code>150ms</Code></Text>

				<Flex flex='1' minH='0' gap='3' overflow='hidden'>
					<Box flex='1' minW='0' borderWidth='1px' borderRadius='sm' borderColor='border.default' overflow='hidden'>
						{loading && items.length === 0 ? <Text fontSize='sm' color='fg.muted' p='3'>Loading history...</Text> : null}
						{!loading && items.length === 0 ? <Text fontSize='sm' color='fg.muted' p='3'>No traffic captured yet.</Text> : null}
						{items.length > 0 ? (
							<VirtualizedHistoryTable table={table} selectedId={selectedId} onSelect={setSelectedId} />
						) : null}
					</Box>
					<Box w='44%' minW='360px' borderWidth='1px' borderRadius='sm' borderColor='border.default' overflow='hidden'>
						<InspectorSection
							item={selectedItem}
							inspectorTab={inspectorTab}
							setInspectorTab={setInspectorTab}
							onSendToRepeater={() => selectedItem ? sendToRepeaterInspector(selectedItem) : null}
							onSendToIntruder={() => selectedItem ? sendToIntruder(selectedItem.id) : null}
							themeId={themeId}
						/>
					</Box>
				</Flex>

				<Separator />
				<HStack justify='space-between'>
					<Button
						size='xs'
						variant='outline'
						onClick={() => loadHistory(Math.max(0, page - 1))}
						disabled={page <= 0}
					>
						Previous
					</Button>
					<Button
						size='xs'
						variant='outline'
						onClick={() => loadHistory(page + 1)}
						disabled={(page + 1) >= totalPages}
					>
						Next
					</Button>
				</HStack>

				{errorText ? <Text color={getStatusTextColor('error', themeId)} fontSize='sm'>{errorText}</Text> : null}
				{noticeText ? <Text color={getStatusTextColor('success', themeId)} fontSize='sm'>{noticeText}</Text> : null}
			</VStack>
		</Flex>
	);
}

export default HistoryPanel;
