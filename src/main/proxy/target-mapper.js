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
	return JSON.parse(JSON.stringify(value));
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

	if (text.startsWith('[')) {
		const end = text.indexOf(']');
		if (end > 0) {
			const host = text.slice(1, end);
			const rest = text.slice(end + 1);
			if (rest.startsWith(':')) {
				const parsed = Number(rest.slice(1));
				return { host: normalizeHost(host), port: Number.isInteger(parsed) ? parsed : null };
			}
			return { host: normalizeHost(host), port: null };
		}
	}

	const idx = text.lastIndexOf(':');
	if (idx > 0 && idx === text.indexOf(':')) {
		const host = text.slice(0, idx);
		const maybePort = Number(text.slice(idx + 1));
		if (Number.isInteger(maybePort) && maybePort > 0 && maybePort <= 65535) {
			return { host: normalizeHost(host), port: maybePort };
		}
	}

	return { host: normalizeHost(text), port: null };
}

function ipToInt(ip) {
	const parts = String(ip || '').split('.');
	if (parts.length !== 4) {
		return null;
	}
	const octets = parts.map(part => Number(part));
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
	const source = input.request || input;
	const rawUrl = normalizeText(source.url);
	let protocol = normalizeText(source.protocol).toLowerCase();
	let host = normalizeHost(source.host);
	let port = source.port == null ? null : Number(source.port);
	let path = normalizeText(source.path || '/');

	if (rawUrl) {
		try {
			const parsed = new URL(rawUrl);
			protocol = normalizeText(parsed.protocol).replace(':', '').toLowerCase() || protocol;
			host = normalizeHost(parsed.hostname) || host;
			if (!port) {
				port = parsed.port ? Number(parsed.port) : null;
			}
			path = `${parsed.pathname || '/'}${parsed.search || ''}`;
		} catch {
			// Ignore malformed URL and use host/path fields.
		}
	}

	if (!host && source.headers && source.headers.host) {
		const authority = parseAuthority(source.headers.host);
		host = authority.host;
		if (!port && authority.port) {
			port = authority.port;
		}
	}

	if (!protocol) {
		protocol = source.tls ? 'https' : 'http';
	}

	if (!Number.isInteger(port) || port <= 0) {
		port = protocol === 'https' ? 443 : 80;
	}

	if (!path.startsWith('/')) {
		path = `/${path}`;
	}

	return {
		protocol,
		host,
		port,
		path,
		ip: normalizeText(source.ip),
	};
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
	if (!rule || !target || !target.host) {
		return false;
	}

	const hasHostRule = Boolean(rule.host);
	const hasIpRule = Boolean(rule.ip);
	const hasCidrRule = Boolean(rule._cidr);
	let matched = false;

	if (hasHostRule && hostMatches(target.host, rule.host)) {
		matched = true;
	}

	if (hasIpRule && normalizeHost(target.host) === normalizeHost(rule.ip)) {
		matched = true;
	}

	if (hasCidrRule) {
		const targetIp = ipToInt(target.host);
		if (targetIp !== null && ((targetIp & rule._cidr.mask) >>> 0) === rule._cidr.base) {
			matched = true;
		}
	}

	if (!matched) {
		return false;
	}

	if (rule.protocol && rule.protocol !== target.protocol) {
		return false;
	}

	if (rule.port && rule.port !== target.port) {
		return false;
	}

	if (rule.path && rule.path !== '/' && !String(target.path || '/').startsWith(rule.path)) {
		return false;
	}

	return true;
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
	if (!host.startsWith('^') && !host.includes('\\.')) return host.toLowerCase();
	if (host.startsWith('^')) host = host.slice(1);
	if (host.endsWith('$')) host = host.slice(0, -1);
	// .*\. matches any subdomain prefix — convert to wildcard glob
	host = host.replace(/\.\*\\\./g, '*.');
	// Unescape remaining \. → .
	host = host.replace(/\\\./g, '.');
	return host.toLowerCase();
}

// Extract an integer port from a Burp regex port string like "^80$".
// Returns null for wildcard patterns (multiple ports via alternation) or unparseable values.
function extractBurpRegexPort(raw) {
	if (!raw) return null;
	const str = String(raw);
	// Alternation means multiple acceptable ports — treat as wildcard
	if (str.includes('|')) return null;
	const cleaned = str.replace(/[\^$()*+?]/g, '').trim();
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
	p = p.replace(/\/\.\*$/, '/');
	return p || '/';
}

function parseBurpXml(text) {
	const warnings = [];
	const rules = [];
	const scopeBlockRegex = /<scope[\s\S]*?<\/scope>/gi;
	const itemRegex = /<item[\s\S]*?<\/item>/gi;

	const scopes = String(text || '').match(scopeBlockRegex) || [];
	for (const scope of scopes) {
		const items = scope.match(itemRegex) || [];
		for (const item of items) {
			const enabledRaw = stripTag(item, 'enabled').toLowerCase();
			if (enabledRaw && enabledRaw !== 'true') {
				continue;
			}

			const includeRaw = stripTag(item, 'include').toLowerCase();
			const kind = includeRaw === 'false' ? 'exclude' : 'include';
			const hostRaw = stripTag(item, 'host') || stripTag(item, 'domain');
			// Advanced mode XML uses <file> for paths; plain mode may use <path>
			const pathRaw = stripTag(item, 'path') || stripTag(item, 'file') || '/';
			const portText = stripTag(item, 'port');
			const protocolRaw = normalizeText(stripTag(item, 'protocol')).toLowerCase();
			// Detect advanced mode by regex anchor on host field
			const useRegex = hostRaw.startsWith('^');
			const host = useRegex ? stripBurpRegexHost(hostRaw) : normalizeHost(hostRaw);
			const path = useRegex ? stripBurpRegexPath(pathRaw) : normalizeText(pathRaw) || '/';
			const port = useRegex
				? extractBurpRegexPort(portText)
				: (portText ? Number(portText) : null);
			const protocol = (protocolRaw && protocolRaw !== 'any') ? protocolRaw : null;

			if (!host) {
				warnings.push('Skipped Burp XML scope item without host/domain.');
				continue;
			}

			rules.push({ kind, host, path, protocol, port: Number.isInteger(port) ? port : null });
		}
	}

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
	const isAdvancedMode = Boolean(
		payload.target && payload.target.scope && payload.target.scope.advanced_mode
	);

	const rawRules = [];
	if (Array.isArray(payload.scope)) {
		rawRules.push(...payload.scope);
	}

	if (payload.target && payload.target.scope && Array.isArray(payload.target.scope.include)) {
		rawRules.push(...payload.target.scope.include.map(entry => ({ ...entry, kind: 'include' })));
	}
	if (payload.target && payload.target.scope && Array.isArray(payload.target.scope.exclude)) {
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
			const port = useRegex
				? extractBurpRegexPort(entry.port) || null
				: (entry.port ? Number(entry.port) : null);
			const protocolRaw = normalizeText(entry.protocol).toLowerCase();
			const protocol = (protocolRaw && protocolRaw !== 'any') ? protocolRaw : null;

			return {
				kind: entry.kind || (entry.include === false ? 'exclude' : 'include'),
				host,
				path,
				protocol,
				port: Number.isInteger(port) ? port : null,
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
			throw new Error('scope rules must be an array');
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
			if (!item || !item.request) {
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

		for (const item of list) {
			const request = item && item.request ? item.request : null;
			if (!request || !request.host) {
				continue;
			}

			const host = normalizeHost(request.host);
			if (!roots.has(host)) {
				roots.set(host, {
					id: `host:${host}`,
					label: host,
					type: 'host',
					inScope: this.isInScope({ request }),
					children: [],
					childrenByPath: new Map(),
				});
			}

			const root = roots.get(host);
			root.inScope = root.inScope || this.isInScope({ request });

			const pathText = String(request.path || '/').split('?')[0] || '/';
			const segments = pathText.split('/').filter(Boolean);
			let parent = root;
			let cursor = '';

			if (segments.length === 0) {
				if (!parent.childrenByPath.has('/')) {
					const leafScope = this.isInScope({ request: { ...request, path: '/' } });
					const leaf = {
						id: `${root.id}/`,
						label: '/',
						type: 'path',
						inScope: leafScope,
						method: request.method || 'GET',
						statusCode: item.response ? item.response.statusCode : null,
						children: [],
						childrenByPath: new Map(),
					};
					parent.children.push(leaf);
					parent.childrenByPath.set('/', leaf);
				}
				continue;
			}

			for (const segment of segments) {
				cursor += `/${segment}`;
				if (!parent.childrenByPath.has(cursor)) {
					const nodeScope = this.isInScope({ request: { ...request, path: cursor } });
					const node = {
						id: `${root.id}${cursor}`,
						label: segment,
						fullPath: cursor,
						type: 'path',
						inScope: nodeScope,
						method: request.method || 'GET',
						statusCode: item.response ? item.response.statusCode : null,
						children: [],
						childrenByPath: new Map(),
					};
					parent.children.push(node);
					parent.childrenByPath.set(cursor, node);
				}

				parent = parent.childrenByPath.get(cursor);
				parent.inScope = parent.inScope || this.isInScope({ request: { ...request, path: cursor } });
			}
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

function createTargetMapper(options = {}) {
	return new TargetMapper(options);
}

const defaultTargetMapper = createTargetMapper();

module.exports = defaultTargetMapper;
module.exports.TargetMapper = TargetMapper;
module.exports.createTargetMapper = createTargetMapper;
