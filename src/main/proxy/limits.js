/*
Centralised size and limit constants for proxy services.
Consolidates file-size, request-size, and audit-log limits into a single source of truth.
*/

'use strict';

// HTTP request/response body size limits (bytes)
const MAX_REQUEST_BYTES = 25 * 1024 * 1024; // 25 MB

// File import size limits (bytes)
const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_DICTIONARY_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

module.exports = {
	MAX_REQUEST_BYTES,
	MAX_IMPORT_FILE_BYTES,
	MAX_DICTIONARY_FILE_BYTES,
};
