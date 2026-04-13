/*
SEN-018 Target mapping and scope enforcement
- Maintains include/exclude rules for host/domain/IP/CIDR scope.
- Imports Burp XML/JSON and CSV files (including HackerOne exports).
- Builds site map trees from observed traffic for UI navigation.
*/

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
const BURP_EXTENSIONS = new Set(['.xml', '.json']);
const CSV_EXTENSIONS = new Set(['.csv']);

function clone(value) {
	return structuredClone(value);
}

function normalizeText(value) {
	return String(value || '').trim();
}

function normalizeHost(host) {
	return normalizeText(host).toLowerCase();
}

function normalizeRuleKind(rawKind, fallback = 'include') {
	const value = normalizeText(rawKind).toLowerCase();
	if (!value) {
		return fallback;
	}

	if (['exclude', 'excluded', 'deny', 'block', 'out', 'out-of-scope', 'false', '0', 'no'].includes(value)) {
		return 'exclude';
	}

	if (['include', 'included', 'allow', 'in', 'in-scope', 'true', '1', 'yes'].includes(value)) {
		return 'include';
	}

	return fallback;
}

async function readImportFile(filePath, allowedExtensions) {
	if (!filePath || typeof filePath !== 'string') {
		throw new Error('import requires a file path');
	}

	const resolvedPath = path.resolve(filePath);
	const extension = path.extname(resolvedPath).toLowerCase();
	if (!allowedExtensions.has(extension)) {
		throw new Error(`unsupported import file extension: ${extension || 'none'}`);
	}

	const stat = await fs.promises.stat(resolvedPath);
	if (!stat.isFile()) {
		throw new Error('import path must point to a file');
	}

	if (stat.size > MAX_IMPORT_FILE_BYTES) {
		throw new Error(`import file exceeds ${MAX_IMPORT_FILE_BYTES} byte limit`);
	}

	return fs.promises.readFile(resolvedPath, 'utf8');
}

function parseAuthority(raw) {
	const text = normalizeText(raw);
	if (!text) {
		return { host: '', port: null };
	}

	const bracket = parseBracketAuthority(text);
	if (bracket) {
		return bracket;
	}

	const hostPort = parseSingleColonAuthority(text);
	if (hostPort) {
		return hostPort;
	}

	return { host: normalizeHost(text), port: null };
}


function parseBracketAuthority(text) {
	if (!text.startsWith('[')) {
		return null;
	}
	const end = text.indexOf(']');
	if (end <= 0) {
		return null;
	}

	const host = text.slice(1, end);
	const rest = text.slice(end + 1);
	if (!rest.startsWith(':')) {
		return { host: normalizeHost(host), port: null };
	}

	const parsed = Number(rest.slice(1));
	return {
		host: normalizeHost(host),
		port: Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : null,
	};
}


function parseSingleColonAuthority(text) {
	const idx = text.lastIndexOf(':');
	if (idx <= 0 || idx !== text.indexOf(':')) {
		return null;
	}

	const host = text.slice(0, idx);
	const maybePort = Number(text.slice(idx + 1));
	if (Number.isInteger(maybePort) && maybePort > 0 && maybePort <= 65535) {
		return { host: normalizeHost(host), port: maybePort };
	}

	return { host: normalizeHost(text), port: null };
}

function ipToInt(ip) {
	const parts = String(ip || '').split('.');
	if (parts.length !== 4) {
		return null;
	}
	const octets = parts.map(Number);
	if (octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
		return null;
	}
	return ((octets[0] << 24) >>> 0) + ((octets[1] << 16) >>> 0) + ((octets[2] << 8) >>> 0) + octets[3];
}

function parseCidr(cidrText) {
	const text = normalizeText(cidrText);
	if (!text.includes('/')) {
		return null;
	}

	const [baseText, maskText] = text.split('/');
	const base = ipToInt(baseText);
	const maskBits = Number(maskText);
	if (base === null || !Number.isInteger(maskBits) || maskBits < 0 || maskBits > 32) {
		return null;
	}

	const mask = maskBits === 0 ? 0 : ((0xffffffff << (32 - maskBits)) >>> 0);
	return { base: base & mask, mask, text: `${baseText}/${maskBits}` };
}

function hostMatches(host, hostPattern) {
	const value = normalizeHost(host);
	const pattern = normalizeHost(hostPattern);
	if (!value || !pattern) {
		return false;
	}

	if (pattern === '*') {
		return true;
	}

	if (pattern.startsWith('*.')) {
		const suffix = pattern.slice(2);
		return value === suffix || value.endsWith(`.${suffix}`);
	}

	return value === pattern || value.endsWith(`.${pattern}`);
}

function extractTarget(input = {}) {
	const source = input?.request || input;
	const rawUrl = normalizeText(source.url);
	let protocol = normalizeText(source.protocol).toLowerCase();
	let host = normalizeHost(source.host);
	let port = source.port == null ? null : Number(source.port);
	let path = normalizeText(source.path || '/');

	const parsedUrl = parseUrlTarget(rawUrl);
	if (parsedUrl) {
		protocol = parsedUrl.protocol || protocol;
		host = parsedUrl.host || host;
		if (!port) {
			port = parsedUrl.port;
		}
		path = parsedUrl.path || path;
	}

	if (!host && source?.headers?.host) {
		const authority = parseAuthority(source.headers.host);
		host = authority.host;
		if (!port && authority.port) {
			port = authority.port;
		}
	}

	protocol = protocol || (source?.tls ? 'https' : 'http');
	port = normalizePortForProtocol(port, protocol);
	path = normalizePath(path);

	return {
		protocol,
		host,
		port,
		path,
		ip: normalizeText(source.ip),
	};
}

function parseUrlTarget(rawUrl) {
	if (!rawUrl) {
		return null;
	}

	try {
		const parsed = new URL(rawUrl);
		return {
			protocol: normalizeText(parsed.protocol).replaceAll(':', '').toLowerCase(),
			host: normalizeHost(parsed.hostname),
			port: parsed.port ? Number(parsed.port) : null,
			path: `${parsed.pathname || '/'}${parsed.search || ''}`,
		};
	} catch {
		// Ignore malformed URL and use host/path fields.
		return null;
	}
}

function normalizePortForProtocol(port, protocol) {
	if (Number.isInteger(port) && port > 0) {
		return port;
	}
	return protocol === 'https' ? 443 : 80;
}

function normalizePath(path) {
	if (path.startsWith('/')) {
		return path;
	}
	return `/${path}`;
}

function compileRule(rule = {}) {
	const id = normalizeText(rule.id) || randomUUID();
	const kind = normalizeRuleKind(rule.kind, 'include');
	const host = normalizeHost(rule.host || rule.domain);
	const path = normalizeText(rule.path || '/');
	const protocol = normalizeText(rule.protocol).toLowerCase();
	const port = rule.port == null || rule.port === '' ? null : Number(rule.port);
	const cidr = parseCidr(rule.cidr || rule.range);
	const ip = normalizeText(rule.ip);

	if (!host && !ip && !cidr) {
		throw new Error('scope rule requires host, ip, or cidr');
	}

	if (port !== null && (!Number.isInteger(port) || port <= 0 || port > 65535)) {
		throw new Error(`scope rule ${id} has invalid port`);
	}

	return {
		id,
		kind,
		host: host || null,
		path: path || '/',
		protocol: protocol || null,
		port,
		ip: ip || null,
		cidr: cidr ? cidr.text : null,
		metadata: rule.metadata || null,
		_cidr: cidr,
	};
}

function ruleMatchesTarget(rule, target) {
	if (!rule || !target?.host) {
		return false;
	}

	const matched = matchesHostRule(rule, target)
		|| matchesIpRule(rule, target)
		|| matchesCidrRule(rule, target);

	if (!matched) {
		return false;
	}

	if (rule.protocol && rule.protocol !== target.protocol) {
		return false;
	}

	if (rule.port && rule.port !== target.port) {
		return false;
	}

	return matchesRulePath(rule, target.path);
}

function matchesHostRule(rule, target) {
	if (!rule.host) {
		return false;
	}
	return hostMatches(target.host, rule.host);
}

function matchesIpRule(rule, target) {
	if (!rule.ip) {
		return false;
	}
	return normalizeHost(target.host) === normalizeHost(rule.ip);
}

function matchesCidrRule(rule, target) {
	if (!rule._cidr) {
		return false;
	}
	const targetIp = ipToInt(target.host);
	if (targetIp === null) {
		return false;
	}
	return ((targetIp & rule._cidr.mask) >>> 0) === rule._cidr.base;
}

function matchesRulePath(rule, targetPath) {
	if (!rule.path || rule.path === '/') {
		return true;
	}
	return String(targetPath || '/').startsWith(rule.path);
}

function parseDelimitedLine(line) {
	const values = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i += 1) {
		const char = line[i];
		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i += 1;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}
		if (char === ',' && !inQuotes) {
			values.push(current);
			current = '';
			continue;
		}
		current += char;
	}
	values.push(current);
	return values;
}

function parseCsv(text) {
	const lines = String(text || '')
		.split(/\r?\n/g)
		.map(line => line.trim())
		.filter(Boolean);

	if (lines.length === 0) {
		return { headers: [], rows: [] };
	}

	const headers = parseDelimitedLine(lines[0]).map(header => normalizeHost(header));
	const rows = lines.slice(1).map(line => {
		const cols = parseDelimitedLine(line);
		const row = {};
		headers.forEach((header, index) => {
			row[header] = normalizeText(cols[index] || '');
		});
		return row;
	});

	return { headers, rows };
}

function stripTag(value, tagName) {
	const open = `<${tagName}>`;
	const close = `</${tagName}>`;
	const start = value.indexOf(open);
	const end = value.indexOf(close);
	if (start < 0 || end < 0 || end <= start) {
		return '';
	}
	return normalizeText(value.slice(start + open.length, end));
}

// Convert a Burp advanced-mode regex host pattern to a plain hostname or wildcard glob.
// "^hackerone\\.com$" (JSON) → after JSON.parse → "^hackerone\.com$" → "hackerone.com"
// "^.*\\.hackerone-ext-content\\.com$" → "*.hackerone-ext-content.com"
function stripBurpRegexHost(raw) {
	let host = normalizeText(raw);
	if (!host) return '';
	// Only transform anchored or escaped regex patterns
	if (!host.startsWith('^') && !host.includes(String.raw`\.`)) return host.toLowerCase();
	if (host.startsWith('^')) host = host.slice(1);
	if (host.endsWith('$')) host = host.slice(0, -1);
	// .*\. matches any subdomain prefix — convert to wildcard glob
	host = host.replaceAll(String.raw`.*\.`, '*.');
	// Unescape remaining \. → .
	host = host.replaceAll(String.raw`\.`, '.');
	return host.toLowerCase();
}

// Extract an integer port from a Burp regex port string like "^80$".
// Returns null for wildcard patterns (multiple ports via alternation) or unparseable values.
function extractBurpRegexPort(raw) {
	if (!raw) return null;
	const str = String(raw);
	// Alternation means multiple acceptable ports — treat as wildcard
	if (str.includes('|')) return null;
	const cleaned = str.replaceAll(/[\^$()*+?]/g, '').trim();
	const num = Number(cleaned);
	return Number.isInteger(num) && num > 0 && num <= 65535 ? num : null;
}

// Strip Burp regex anchors/wildcards from a file/path field.
// "^/.*" → "/"   "^/api/.*" → "/api/"
function stripBurpRegexPath(raw) {
	let p = normalizeText(raw);
	if (!p) return '/';
	if (p.startsWith('^')) p = p.slice(1);
	if (p.endsWith('$')) p = p.slice(0, -1);
	// /path/.* → /path/
	p = p.replaceAll(/\/\.\*$/g, '/');
	return p || '/';
}

function parseBurpPort(useRegex, rawPort) {
	if (useRegex) {
		return extractBurpRegexPort(rawPort);
	}
	if (!rawPort) {
		return null;
	}
	return Number(rawPort);
}

function toValidPortOrNull(port) {
	return Number.isInteger(port) ? port : null;
}

function parseBurpXmlItem(item, warnings) {
	const enabledRaw = stripTag(item, 'enabled').toLowerCase();
	if (enabledRaw && enabledRaw !== 'true') {
		return null;
	}

	const includeRaw = stripTag(item, 'include').toLowerCase();
	const kind = includeRaw === 'false' ? 'exclude' : 'include';
	const hostRaw = stripTag(item, 'host') || stripTag(item, 'domain');
	// Advanced mode XML uses <file> for paths; plain mode may use <path>
	const pathRaw = stripTag(item, 'path') || stripTag(item, 'file') || '/';
	const portText = stripTag(item, 'port');
	const protocolRaw = normalizeText(stripTag(item, 'protocol')).toLowerCase();
	const useRegex = hostRaw.startsWith('^');
	const host = useRegex ? stripBurpRegexHost(hostRaw) : normalizeHost(hostRaw);
	if (!host) {
		warnings.push('Skipped Burp XML scope item without host/domain.');
		return null;
	}

	const path = useRegex ? stripBurpRegexPath(pathRaw) : normalizeText(pathRaw) || '/';
	const parsedPort = parseBurpPort(useRegex, portText);
	const protocol = (protocolRaw && protocolRaw !== 'any') ? protocolRaw : null;

	return {
		kind,
		host,
		path,
		protocol,
		port: toValidPortOrNull(parsedPort),
	};
}

function listXmlScopeItems(text) {
	const scopeBlockRegex = /<scope[\s\S]*?<\/scope>/gi;
	const itemRegex = /<item[\s\S]*?<\/item>/gi;
	const scopes = String(text || '').match(scopeBlockRegex) || [];
	const items = [];
	for (const scope of scopes) {
		items.push(...(scope.match(itemRegex) || []));
	}
	return items;
}

function parseBurpXml(text) {
	const warnings = [];
	const rules = listXmlScopeItems(text)
		.map(item => parseBurpXmlItem(item, warnings))
		.filter(Boolean);

	return { rules, warnings };
}

function parseBurpJson(text) {
	const warnings = [];
	let payload;
	try {
		payload = JSON.parse(String(text || '{}'));
	} catch {
		throw new Error('Burp import file is not valid JSON or XML.');
	}

	// advanced_mode means host/port/file fields are regex patterns, not plain strings
	const isAdvancedMode = Boolean(payload.target?.scope?.advanced_mode);

	const rawRules = [];
	if (Array.isArray(payload.scope)) {
		rawRules.push(...payload.scope);
	}

	if (Array.isArray(payload.target?.scope?.include)) {
		rawRules.push(...payload.target.scope.include.map(entry => ({ ...entry, kind: 'include' })));
	}
	if (Array.isArray(payload.target?.scope?.exclude)) {
		rawRules.push(...payload.target.scope.exclude.map(entry => ({ ...entry, kind: 'exclude' })));
	}

	const rules = rawRules
		.filter(entry => {
			if (entry.enabled === false) {
				warnings.push(`Skipped disabled Burp scope entry: ${entry.host || '(no host)'}`);
				return false;
			}
			return true;
		})
		.map(entry => {
			// Apply regex stripping when advanced_mode is declared or host looks like a regex
			const useRegex = isAdvancedMode || (typeof entry.host === 'string' && entry.host.startsWith('^'));
			const rawHost = entry.host || entry.domain || entry.hostname || '';
			const host = useRegex ? stripBurpRegexHost(rawHost) : normalizeHost(rawHost);
			// Burp uses "file" for the path field; fall back to "path" for non-advanced exports
			const path = useRegex
				? stripBurpRegexPath(entry.file || entry.path)
				: normalizeText(entry.path || entry.file || '/') || '/';
			const port = parseBurpPort(useRegex, entry.port);
			const protocolRaw = normalizeText(entry.protocol).toLowerCase();
			const protocol = (protocolRaw && protocolRaw !== 'any') ? protocolRaw : null;

			return {
				kind: entry.kind || (entry.include === false ? 'exclude' : 'include'),
				host,
				path,
				protocol,
				port: toValidPortOrNull(port),
				cidr: entry.cidr || null,
				ip: entry.ip || null,
			};
		})
		.filter(entry => {
			const valid = Boolean(entry.host || entry.cidr || entry.ip);
			if (!valid) {
				warnings.push('Skipped Burp JSON entry without host/ip/cidr fields.');
			}
			return valid;
		});

	if (rules.length === 0) {
		warnings.push('Burp JSON did not contain recognizable scope entries.');
	}

	return { rules, warnings };
}

class TargetMapper {
	constructor(options = {}) {
		this.scopeRules = [];
		this.projectStore = options.projectStore || null;
	}

	setProjectStore(projectStore) {
		this.projectStore = projectStore || null;
	}

	setScopeRules(rules = []) {
		if (!Array.isArray(rules)) {
			throw new TypeError('scope rules must be an array');
		}
		const compiled = rules.map(rule => compileRule(rule));
		this.scopeRules = compiled;
		return { ok: true, count: compiled.length };
	}

	getScopeRules() {
		return this.scopeRules.map(rule => ({
			id: rule.id,
			kind: rule.kind,
			host: rule.host,
			path: rule.path,
			protocol: rule.protocol,
			port: rule.port,
			ip: rule.ip,
			cidr: rule.cidr,
			metadata: rule.metadata,
		}));
	}

	isInScope(input = {}) {
		const target = extractTarget(input);
		if (!target.host) {
			return false;
		}

		const includes = this.scopeRules.filter(rule => rule.kind === 'include');
		const excludes = this.scopeRules.filter(rule => rule.kind === 'exclude');

		const included = includes.length === 0
			? true
			: includes.some(rule => ruleMatchesTarget(rule, target));

		if (!included) {
			return false;
		}

		return !excludes.some(rule => ruleMatchesTarget(rule, target));
	}

	evaluateRequest(request = {}) {
		return this.isInScope({ request });
	}

	applyScopeToTraffic(items = []) {
		return items.map(item => {
			if (!item?.request) {
				return clone(item);
			}
			const next = clone(item);
			next.request.inScope = this.evaluateRequest(next.request);
			return next;
		});
	}

	buildSiteMap(items = []) {
		const roots = new Map();
		const list = this.applyScopeToTraffic(Array.isArray(items) ? items : []);
		const evaluateScope = request => this.isInScope({ request });

		for (const item of list) {
			const request = item?.request || null;
			if (!request?.host) {
				continue;
			}
			addRequestToSiteMap(roots, request, item, evaluateScope);
		}

		const toPlain = node => ({
			id: node.id,
			label: node.label,
			fullPath: node.fullPath,
			type: node.type,
			inScope: node.inScope,
			method: node.method,
			statusCode: node.statusCode,
			children: (node.children || []).map(child => toPlain(child)),
		});

		return {
			tree: [...roots.values()]
				.sort((left, right) => left.label.localeCompare(right.label))
				.map(root => toPlain(root)),
		};
	}

	parseBurpImport(text) {
		const raw = String(text || '');
		if (!raw.trim()) {
			throw new Error('Burp import file is empty');
		}

		if (raw.trim().startsWith('<')) {
			return parseBurpXml(raw);
		}

		return parseBurpJson(raw);
	}

	parseCsvImport(text, format = 'generic') {
		const { rows } = parseCsv(text);
		const warnings = [];
		const isHackerOne = String(format || '').toLowerCase() === 'hackerone';

		const rules = rows.map(row => {
			const host = row.asset_identifier || row.host || row.domain || row.hostname || row.target;
			const path = row.path || '/';
			const protocol = row.protocol || row.scheme || '';
			const rawPort = row.port ? Number(row.port) : null;
			const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : null;
			const cidr = row.cidr || row.range || '';
			const ip = row.ip || '';
			let kind = normalizeRuleKind(row.kind || row.type || row.include, 'include');

			if (isHackerOne) {
				const eligibility = normalizeText(row.eligible_for_bounty || row.eligible || '').toLowerCase();
				kind = eligibility === 'false' || eligibility === 'no' ? 'exclude' : 'include';
			}

			return {
				kind,
				host,
				path,
				protocol,
				port,
				cidr,
				ip,
				metadata: {
					source: isHackerOne ? 'hackerone' : 'csv',
					row,
				},
			};
		}).filter(entry => {
			const valid = Boolean(entry.host || entry.cidr || entry.ip);
			if (!valid) {
				warnings.push('Skipped CSV row without host/ip/cidr fields.');
			}
			return valid;
		});

		return { rules, warnings };
	}

	async importBurpFromFile(filePath) {
		const raw = await readImportFile(filePath, BURP_EXTENSIONS);
		const parsed = this.parseBurpImport(raw);
		this.setScopeRules([...this.getScopeRules(), ...parsed.rules]);
		return { ok: true, imported: parsed.rules.length, warnings: parsed.warnings, rules: this.getScopeRules() };
	}

	async importCsvFromFile(filePath, format = 'generic') {
		const raw = await readImportFile(filePath, CSV_EXTENSIONS);
		const parsed = this.parseCsvImport(raw, format);
		this.setScopeRules([...this.getScopeRules(), ...parsed.rules]);
		return { ok: true, imported: parsed.rules.length, warnings: parsed.warnings, rules: this.getScopeRules() };
	}
}

function createSiteMapNode({ id, label, fullPath, type = 'path', inScope, method, statusCode }) {
	return {
		id,
		label,
		fullPath,
		type,
		inScope,
		method,
		statusCode,
		children: [],
		childrenByPath: new Map(),
	};
}

function getRequestStatusCode(item) {
	return item?.response?.statusCode ?? null;
}

function getPathSegments(path) {
	const pathText = String(path || '/').split('?')[0] || '/';
	return pathText.split('/').filter(Boolean);
}

function getOrCreateRootNode(roots, request, evaluateScope) {
	const host = normalizeHost(request.host);
	if (!roots.has(host)) {
		roots.set(host, createSiteMapNode({
			id: `host:${host}`,
			label: host,
			type: 'host',
			inScope: evaluateScope(request),
		}));
	}

	const root = roots.get(host);
	root.inScope = root.inScope || evaluateScope(request);
	return root;
}

function ensureRootLeaf(root, request, item, evaluateScope) {
	if (root.childrenByPath.has('/')) {
		return;
	}

	const leaf = createSiteMapNode({
		id: `${root.id}/`,
		label: '/',
		fullPath: '/',
		inScope: evaluateScope({ ...request, path: '/' }),
		method: request.method || 'GET',
		statusCode: getRequestStatusCode(item),
	});
	root.children.push(leaf);
	root.childrenByPath.set('/', leaf);
}

function getOrCreatePathNode(root, parent, request, item, segment, cursor, evaluateScope) {
	if (!parent.childrenByPath.has(cursor)) {
		const node = createSiteMapNode({
			id: `${root.id}${cursor}`,
			label: segment,
			fullPath: cursor,
			inScope: evaluateScope({ ...request, path: cursor }),
			method: request.method || 'GET',
			statusCode: getRequestStatusCode(item),
		});
		parent.children.push(node);
		parent.childrenByPath.set(cursor, node);
	}

	const child = parent.childrenByPath.get(cursor);
	child.inScope = child.inScope || evaluateScope({ ...request, path: cursor });
	return child;
}

function addRequestToSiteMap(roots, request, item, evaluateScope) {
	const root = getOrCreateRootNode(roots, request, evaluateScope);
	const segments = getPathSegments(request.path);

	if (segments.length === 0) {
		ensureRootLeaf(root, request, item, evaluateScope);
		return;
	}

	let parent = root;
	let cursor = '';
	for (const segment of segments) {
		cursor += `/${segment}`;
		parent = getOrCreatePathNode(root, parent, request, item, segment, cursor, evaluateScope);
	}
}

function createTargetMapper(options = {}) {
	return new TargetMapper(options);
}

const defaultTargetMapper = createTargetMapper();

module.exports = defaultTargetMapper;
module.exports.TargetMapper = TargetMapper;
module.exports.createTargetMapper = createTargetMapper;
