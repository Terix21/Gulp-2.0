/**
 * @file ca-manager.js
 * Sentinel CA certificate lifecycle manager (SEN-013).
 *
 * Implements:
 * - Persistent local CA generation on first use
 * - CA certificate export for trust-store installation
 * - Per-host leaf certificate generation with on-disk cache
 * - CA rotation that invalidates all cached leaf certificates
 * - OS-specific trust-install guidance payload for renderer UI
 */

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const forge = require('node-forge');

const CERT_DIR_NAME = 'sentinel-certs';
const CA_CERT_FILE = 'ca-cert.pem';
const CA_KEY_FILE = 'ca-key.pem';
const CA_META_FILE = 'ca-meta.json';
const LEAF_CACHE_DIR = 'leaf-cache';

function ensureDir(dirPath) {
	fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
}

function readUtf8(filePath) {
	return fs.readFileSync(filePath, 'utf8');
}

function writeUtf8Atomic(filePath, content, mode) {
	const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
	fs.writeFileSync(tempPath, content, { encoding: 'utf8', mode });
	fs.renameSync(tempPath, filePath);
}

function sanitizeHost(hostname) {
	return String(hostname || '')
		.trim()
		.toLowerCase()
		.replaceAll(/[^a-z0-9.-]/g, '_');
}

function randomSerialHex() {
	const bytes = crypto.randomBytes(16);
	bytes[0] &= 0x7f;
	return bytes.toString('hex');
}

function sha256Hex(input) {
	return crypto.createHash('sha256').update(input).digest('hex');
}

function resolveBaseDir(baseDir) {
	if (baseDir && typeof baseDir === 'string') {
		return baseDir;
	}
	if (process.env.SENTINEL_CERTS_DIR) {
		return process.env.SENTINEL_CERTS_DIR;
	}
	return path.join(os.homedir(), '.sentinel', CERT_DIR_NAME);
}

function createCaCertificate() {
	const keys = forge.pki.rsa.generateKeyPair(2048);
	const cert = forge.pki.createCertificate();

	cert.publicKey = keys.publicKey;
	cert.serialNumber = randomSerialHex();
	cert.validity.notBefore = new Date(Date.now() - 60 * 1000);
	cert.validity.notAfter = new Date(Date.now() + (3650 * 24 * 60 * 60 * 1000));

	const attrs = [
		{ name: 'commonName', value: 'Sentinel Local CA' },
		{ name: 'organizationName', value: 'Sentinel' },
		{ shortName: 'OU', value: 'Traffic Interception' },
	];

	cert.setSubject(attrs);
	cert.setIssuer(attrs);
	cert.setExtensions([
		{ name: 'basicConstraints', cA: true },
		{
			name: 'keyUsage',
			keyCertSign: true,
			cRLSign: true,
			digitalSignature: true,
		},
		{ name: 'subjectKeyIdentifier' },
	]);

	cert.sign(keys.privateKey, forge.md.sha256.create());

	const certPem = forge.pki.certificateToPem(cert);
	const keyPem = forge.pki.privateKeyToPem(keys.privateKey);

	return {
		certPem,
		keyPem,
		cert,
		privateKey: keys.privateKey,
		serialNumber: cert.serialNumber,
		fingerprint: sha256Hex(certPem),
	};
}

function createLeafCertificate({ hostname, caCert, caPrivateKey }) {
	const safeHost = sanitizeHost(hostname);
	if (!safeHost) {
		throw new TypeError('getLeafCertificate(hostname) requires a valid hostname');
	}

	const leafKeys = forge.pki.rsa.generateKeyPair(2048);
	const cert = forge.pki.createCertificate();

	cert.publicKey = leafKeys.publicKey;
	cert.serialNumber = randomSerialHex();
	cert.validity.notBefore = new Date(Date.now() - 60 * 1000);

	const defaultLeafExpiry = new Date(Date.now() + (397 * 24 * 60 * 60 * 1000));
	cert.validity.notAfter = new Date(Math.min(caCert.validity.notAfter.getTime(), defaultLeafExpiry.getTime()));

	cert.setSubject([{ name: 'commonName', value: safeHost }]);
	cert.setIssuer(caCert.subject.attributes);
	cert.setExtensions([
		{ name: 'basicConstraints', cA: false },
		{
			name: 'keyUsage',
			digitalSignature: true,
			keyEncipherment: true,
		},
		{
			name: 'extKeyUsage',
			serverAuth: true,
		},
		{
			name: 'subjectAltName',
			altNames: [{ type: 2, value: safeHost }],
		},
		{ name: 'subjectKeyIdentifier' },
		{ name: 'authorityKeyIdentifier', keyIdentifier: true },
	]);

	cert.sign(caPrivateKey, forge.md.sha256.create());

	return {
		host: safeHost,
		certPem: forge.pki.certificateToPem(cert),
		keyPem: forge.pki.privateKeyToPem(leafKeys.privateKey),
		serialNumber: cert.serialNumber,
	};
}

function getTrustGuidanceForPlatform(platform, certPathHint) {
	const common = {
		certPathHint,
		caution: 'Trust this CA only in controlled security-testing environments.',
	};

	if (platform === 'win32') {
		return {
			...common,
			platform,
			title: 'Install Sentinel CA on Windows',
			steps: [
				'Export the certificate from Sentinel to a .pem file.',
				'Open certmgr.msc (Current User).',
				'Navigate to Trusted Root Certification Authorities > Certificates.',
				'Use All Tasks > Import and select the exported .pem file.',
				'Restart browsers using the proxy and verify HTTPS interception.',
			],
			verify: [
				'Open the certificate list and confirm the Sentinel Local CA entry exists.',
				'Visit an HTTPS site through the proxy and confirm no trust warning appears.',
			],
		};
	}

	if (platform === 'darwin') {
		return {
			...common,
			platform,
			title: 'Install Sentinel CA on macOS',
			steps: [
				'Export the certificate from Sentinel to a .pem file.',
				'Open Keychain Access and select the login keychain.',
				'Import the .pem certificate file.',
				'Open the certificate details and set Trust > Always Trust.',
				'Restart browsers and verify HTTPS interception.',
			],
			verify: [
				'Confirm the certificate appears in Keychain Access.',
				'Verify HTTPS traffic is intercepted without certificate warnings.',
			],
		};
	}

	return {
		...common,
		platform,
		title: 'Install Sentinel CA on Linux',
		steps: [
			'Export the certificate from Sentinel to a .pem file.',
			'Copy it to /usr/local/share/ca-certificates/sentinel-local-ca.crt.',
			'Run sudo update-ca-certificates.',
			'Restart browsers and verify HTTPS interception.',
		],
		verify: [
			'Run update-ca-certificates output check for one certificate added.',
			'Verify HTTPS traffic is intercepted without certificate warnings.',
		],
	};
}

class CaManager {
	constructor(options = {}) {
		this.baseDir = resolveBaseDir(options.baseDir);
		this.leafDir = path.join(this.baseDir, LEAF_CACHE_DIR);
		this.caCertPath = path.join(this.baseDir, CA_CERT_FILE);
		this.caKeyPath = path.join(this.baseDir, CA_KEY_FILE);
		this.caMetaPath = path.join(this.baseDir, CA_META_FILE);

		this._caLoaded = false;
		this._caCertPem = null;
		this._caKeyPem = null;
		this._caCert = null;
		this._caPrivateKey = null;
		this._meta = null;
	}

	_loadCaFromDisk() {
		if (!fs.existsSync(this.caCertPath) || !fs.existsSync(this.caKeyPath)) {
			return false;
		}

		this._caCertPem = readUtf8(this.caCertPath);
		this._caKeyPem = readUtf8(this.caKeyPath);
		this._caCert = forge.pki.certificateFromPem(this._caCertPem);
		this._caPrivateKey = forge.pki.privateKeyFromPem(this._caKeyPem);

		if (fs.existsSync(this.caMetaPath)) {
			this._meta = JSON.parse(readUtf8(this.caMetaPath));
		} else {
			this._meta = {
				generation: 1,
				createdAt: Date.now(),
				serialNumber: this._caCert.serialNumber,
				fingerprint: sha256Hex(this._caCertPem),
			};
		}

		this._caLoaded = true;
		return true;
	}

	_persistCaArtifacts(caBundle, generation) {
		ensureDir(this.baseDir);
		ensureDir(this.leafDir);

		writeUtf8Atomic(this.caCertPath, caBundle.certPem, 0o644);
		writeUtf8Atomic(this.caKeyPath, caBundle.keyPem, 0o600);

		const meta = {
			generation,
			createdAt: Date.now(),
			serialNumber: caBundle.serialNumber,
			fingerprint: caBundle.fingerprint,
		};
		writeUtf8Atomic(this.caMetaPath, `${JSON.stringify(meta, null, 2)}\n`, 0o600);

		this._caCertPem = caBundle.certPem;
		this._caKeyPem = caBundle.keyPem;
		this._caCert = caBundle.cert;
		this._caPrivateKey = caBundle.privateKey;
		this._meta = meta;
		this._caLoaded = true;
	}

	ensureCaArtifacts() {
		ensureDir(this.baseDir);
		ensureDir(this.leafDir);

		if (this._loadCaFromDisk()) {
			return {
				certPath: this.caCertPath,
				keyPath: this.caKeyPath,
				generated: false,
				fingerprint: this._meta.fingerprint,
			};
		}

		const caBundle = createCaCertificate();
		this._persistCaArtifacts(caBundle, 1);

		return {
			certPath: this.caCertPath,
			keyPath: this.caKeyPath,
			generated: true,
			fingerprint: this._meta.fingerprint,
		};
	}

	getCaCertificatePem() {
		this.ensureCaArtifacts();
		return this._caCertPem;
	}

	exportCaCertificate(destPath) {
		if (!destPath || typeof destPath !== 'string') {
			throw new TypeError('exportCaCertificate(destPath) requires a destination path');
		}

		if (!path.isAbsolute(destPath)) {
			throw new Error('exportCaCertificate(destPath) must be an absolute path');
		}

		if (destPath.includes('..')) {
			throw new Error('exportCaCertificate(destPath) must not contain path traversal sequences');
		}

		const cert = this.getCaCertificatePem();
		ensureDir(path.dirname(destPath));
		writeUtf8Atomic(destPath, cert, 0o644);
		return { ok: true, path: destPath };
	}

	getLeafCertificate(hostname) {
		this.ensureCaArtifacts();

		const safeHost = sanitizeHost(hostname);
		if (!safeHost) {
			throw new TypeError('getLeafCertificate(hostname) requires a valid hostname');
		}

		const certPath = path.join(this.leafDir, `${safeHost}.cert.pem`);
		const keyPath = path.join(this.leafDir, `${safeHost}.key.pem`);

		if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
			return {
				host: safeHost,
				certPem: readUtf8(certPath),
				keyPem: readUtf8(keyPath),
				fromCache: true,
				caFingerprint: this._meta.fingerprint,
			};
		}

		const leaf = createLeafCertificate({
			hostname: safeHost,
			caCert: this._caCert,
			caPrivateKey: this._caPrivateKey,
		});

		writeUtf8Atomic(certPath, leaf.certPem, 0o644);
		writeUtf8Atomic(keyPath, leaf.keyPem, 0o600);

		return {
			host: safeHost,
			certPem: leaf.certPem,
			keyPem: leaf.keyPem,
			fromCache: false,
			caFingerprint: this._meta.fingerprint,
		};
	}

	rotateCa() {
		this.ensureCaArtifacts();

		const currentMeta = this._meta || {};
		const nextGeneration = (currentMeta.generation || 1) + 1;

		let invalidatedLeafCount = 0;
		if (fs.existsSync(this.leafDir)) {
			const files = fs.readdirSync(this.leafDir);
			invalidatedLeafCount = files.length;
			fs.rmSync(this.leafDir, { recursive: true, force: true });
		}
		ensureDir(this.leafDir);

		const caBundle = createCaCertificate();
		this._persistCaArtifacts(caBundle, nextGeneration);

		return {
			ok: true,
			invalidatedLeafCount,
			fingerprint: this._meta.fingerprint,
			generation: this._meta.generation,
		};
	}

	getTrustInstallGuidance(platform = process.platform) {
		this.ensureCaArtifacts();
		return getTrustGuidanceForPlatform(platform, this.caCertPath);
	}

	getSummary() {
		this.ensureCaArtifacts();
		return {
			generation: this._meta.generation,
			serialNumber: this._meta.serialNumber,
			fingerprint: this._meta.fingerprint,
			certPath: this.caCertPath,
			keyPath: this.caKeyPath,
			leafCacheDir: this.leafDir,
		};
	}
}

const defaultManager = new CaManager();

module.exports = {
	CaManager,
	createCaManager: (options) => new CaManager(options),

	ensureCaArtifacts: () => defaultManager.ensureCaArtifacts(),
	getCaCertificatePem: () => defaultManager.getCaCertificatePem(),
	exportCaCertificate: (destPath) => defaultManager.exportCaCertificate(destPath),
	getLeafCertificate: (hostname) => defaultManager.getLeafCertificate(hostname),
	rotateCa: () => defaultManager.rotateCa(),
	getTrustInstallGuidance: (platform) => defaultManager.getTrustInstallGuidance(platform),
	getSummary: () => defaultManager.getSummary(),
};
