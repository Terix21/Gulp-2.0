import React from 'react';
import { Box, Button, Code, Flex, Grid, Heading, Text, VStack } from '@chakra-ui/react';

// Reusable metric card widget for the 3-column dashboard grid.
function MetricWidget({ title, metrics }) {
	return (
		<Box p='4' borderWidth='1px' borderColor='border.default' borderRadius='sm' bg='bg.panel' h='100%'>
			<Text fontWeight='semibold' mb='3' fontSize='xs' color='fg.muted' textTransform='uppercase' letterSpacing='wider'>
				{title}
			</Text>
			<VStack align='stretch' gap='2'>
				{metrics.map(({ label, value }) => (
					<Flex key={label} justify='space-between' align='center'>
						<Text fontSize='sm' color='fg.muted'>{label}</Text>
						<Code fontSize='sm'>{String(value)}</Code>
					</Flex>
				))}
			</VStack>
		</Box>
	);
}

function DashboardShell() {
	const [guidance, setGuidance] = React.useState(null);
	const [guidanceOpen, setGuidanceOpen] = React.useState(false);

	// Live metric state — populated on mount and updated via push subscriptions.
	const [requestTotal, setRequestTotal] = React.useState(0);
	const [scopeEntries, setScopeEntries] = React.useState(0);
	const [discoveredHosts, setDiscoveredHosts] = React.useState(0);
	const [findingsTotal, setFindingsTotal] = React.useState(0);
	const [findingsCritical, setFindingsCritical] = React.useState(0);

	React.useEffect(() => {
		let cancelled = false;

		async function loadGuidance() {
			const sentinel = window.sentinel;
			if (!sentinel || !sentinel.ca || typeof sentinel.ca.trustGuidance !== 'function') {
				return;
			}

			try {
				const payload = await sentinel.ca.trustGuidance();
				if (!cancelled && payload && payload.guidance) {
					setGuidance(payload.guidance);
				}
			} catch {
				// Guidance is optional in early boot and should not break dashboard render.
			}
		}

		loadGuidance();
		return () => {
			cancelled = true;
		};
	}, []);

	React.useEffect(() => {
		const sentinel = typeof window !== 'undefined' ? window.sentinel : null;
		if (!sentinel) {
			return undefined;
		}

		let cancelled = false;

		async function loadMetrics() {
			try {
				const [historyResult, scopeResult, sitemapResult] = await Promise.all([
					sentinel.history.query({ page: 0, pageSize: 1 }),
					sentinel.scope.get(),
					sentinel.target.sitemap(),
				]);
				if (cancelled) {
					return;
				}
				if (historyResult && typeof historyResult.total === 'number') {
					setRequestTotal(historyResult.total);
				}
				if (scopeResult && Array.isArray(scopeResult.rules)) {
					setScopeEntries(scopeResult.rules.length);
				}
				if (sitemapResult && Array.isArray(sitemapResult.tree)) {
					setDiscoveredHosts(sitemapResult.tree.length);
				}
			} catch {
				// Metric load failure is non-fatal; leave values at their defaults.
			}
		}

		loadMetrics();

		const unsubHistory = sentinel.history.onPush(() => {
			if (cancelled) {
				return;
			}
			setRequestTotal(prev => prev + 1);
		});

		const unsubScanner = sentinel.scanner.onProgress((payload) => {
			if (cancelled || !payload || !payload.finding) {
				return;
			}
			setFindingsTotal(prev => prev + 1);
			if (String(payload.finding.severity || '').toLowerCase() === 'critical') {
				setFindingsCritical(prev => prev + 1);
			}
		});

		return () => {
			cancelled = true;
			unsubHistory();
			unsubScanner();
		};
	}, []);

	const securityMetrics = [
		{ label: 'Critical findings', value: findingsCritical },
		{ label: 'Open issues', value: findingsTotal },
		{ label: 'Active sessions', value: 0 }
	];

	const trafficMetrics = [
		{ label: 'Requests captured', value: requestTotal },
		{ label: 'Visible (filtered)', value: requestTotal },
		{ label: 'Active filter', value: 'None' }
	];

	const targetMetrics = [
		{ label: 'Discovered hosts', value: discoveredHosts },
		{ label: 'Scope entries', value: scopeEntries },
		{ label: 'Scope mode', value: 'in-scope-only' }
	];

	return (
		<Box p='4' h='100%' overflowY='auto' overflowX='hidden' wordBreak='break-word'>
			<Heading size='sm' mb='4'>Dashboard</Heading>
			<Grid templateColumns='repeat(3, 1fr)' gap='4' mb='4'>
				<MetricWidget title='Security Metrics' metrics={securityMetrics} />
				<MetricWidget title='Recent Traffic' metrics={trafficMetrics} />
				<MetricWidget title='Target Discovery' metrics={targetMetrics} />
			</Grid>

			{guidance ? (
				<Box borderWidth='1px' borderColor='border.default' borderRadius='sm' bg='bg.panel' overflow='hidden'>
					<Flex
						px='4'
						py='3'
						justify='space-between'
						align='center'
						borderBottomWidth={guidanceOpen ? '1px' : '0'}
						borderColor='border.default'
					>
						<Text fontWeight='semibold' fontSize='sm'>CA Trust Guidance</Text>
						<Button size='xs' variant='outline' onClick={() => setGuidanceOpen((prev) => !prev)}>
							{guidanceOpen ? 'Hide' : 'Show'}
						</Button>
					</Flex>
					{guidanceOpen ? (
						<Box px='4' py='3'>
							<Text fontSize='sm' color='fg.muted' mb='1'>{guidance.title}</Text>
							<Text fontSize='sm' mb='1'>Certificate path: <Code>{guidance.certPathHint}</Code></Text>
							{guidance.steps.slice(0, 2).map((step, index) => (
								<Text key={`${index}-${step}`} fontSize='sm'>
									{index + 1}. {step}
								</Text>
							))}
							{guidance.steps.length > 2 ? (
								<Text fontSize='sm' color='fg.muted' mt='2'>
									+{guidance.steps.length - 2} more steps — see full guidance in documentation.
								</Text>
							) : null}
						</Box>
					) : null}
				</Box>
			) : null}
		</Box>
	);
}

export default DashboardShell;
