/**
 * @file traffic-model.js
 * Sentinel Canonical Traffic Model — Milestone 0 (Architecture Baseline)
 *
 * Defines the authoritative shapes for every traffic event produced or
 * consumed by the Sentinel proxy pipeline.  All feature modules (intercept,
 * history, repeater, intruder, scanner …) MUST use these structures without
 * deviation.  Structural changes require an explicit M0 amendment + version bump.
 *
 * Schema version: 2
 */

'use strict';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

/** @enum {string} HTTP protocol version used on the intercepted connection. */
const HttpProtocol = {
  HTTP_1_0: 'HTTP/1.0',
  HTTP_1_1: 'HTTP/1.1',
  HTTP_2:   'HTTP/2',
};

/** @enum {string} WebSocket frame direction relative to the browser. */
const WsDirection = {
  CLIENT_TO_SERVER: 'c2s',
  SERVER_TO_CLIENT: 's2c',
};

/** @enum {number} WebSocket opcode values (RFC 6455 §11.8). */
const WsOpcode = {
  CONTINUATION: 0x0,
  TEXT:         0x1,
  BINARY:       0x2,
  CLOSE:        0x8,
  PING:         0x9,
  PONG:         0xA,
};

/** @enum {string} High-level classification of a traffic item. */
const TrafficKind = {
  HTTP:      'http',
  WEBSOCKET: 'websocket',
};

// ---------------------------------------------------------------------------
// HTTP Request
// ---------------------------------------------------------------------------

/**
 * Canonical HTTP request shape.
 *
 * @typedef {object} HttpRequest
 * @property {string}   id            - UUID v4, unique per captured request.
 * @property {string}   connectionId  - UUID v4, groups request with its response.
 * @property {number}   timestamp     - Unix epoch ms (Date.now()) at capture time.
 * @property {string}   method        - Uppercase HTTP verb (GET, POST, …).
 * @property {string}   url           - Full URL as originally requested.
 * @property {string}   host          - Hostname extracted from Host header or URL.
 * @property {number}   port          - TCP port (80, 443, or custom).
 * @property {string}   path          - URL path component including leading slash.
 * @property {string}   queryString   - Raw query string without leading '?', or ''.
 * @property {Record<string, string>} headers - Header name -> value map (lowercased names).
 * @property {string|null} body       - Request body as UTF-8 string, or null if absent.
 * @property {string|null} rawBodyBase64 - Optional raw request body bytes in base64 for binary-safe replay.
 * @property {HttpProtocol} protocol  - Protocol version negotiated for this connection.
 * @property {boolean}  tls           - True when the connection was TLS-wrapped.
 * @property {string[]} tags          - User-applied labels (e.g. 'in-scope', 'interesting').
 * @property {string}   comment       - Free-text analyst note; empty string by default.
 * @property {boolean}  inScope       - Evaluated against active scope rules at capture time.
 */

/**
 * Returns a zero-value HttpRequest with all required fields populated.
 * Use as a factory or type reference — do not mutate the returned object.
 *
 * @returns {HttpRequest}
 */
function createHttpRequest() {
  return {
    id:           '',
    connectionId: '',
    timestamp:    0,
    method:       'GET',
    url:          '',
    host:         '',
    port:         80,
    path:         '/',
    queryString:  '',
    headers:      {},
    body:         null,
    rawBodyBase64: null,
    protocol:     HttpProtocol.HTTP_1_1,
    tls:          false,
    tags:         [],
    comment:      '',
    inScope:      false,
  };
}

// ---------------------------------------------------------------------------
// HTTP Response
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ResponseTimings
 * @property {number} sendStart   - Ms from request dispatch to first byte sent.
 * @property {number} ttfb        - Ms from request dispatch to first response byte.
 * @property {number} total       - Ms from request dispatch to response complete.
 */

/**
 * Canonical HTTP response shape.
 *
 * @typedef {object} HttpResponse
 * @property {string}   id            - UUID v4, unique per captured response.
 * @property {string}   requestId     - Links to the originating HttpRequest.id.
 * @property {string}   connectionId  - Shared with the paired HttpRequest.
 * @property {number}   timestamp     - Unix epoch ms at first response byte.
 * @property {number}   statusCode    - HTTP status code integer.
 * @property {string}   statusMessage - Status reason phrase (e.g. 'OK').
 * @property {Record<string, string>} headers - Header name -> value map (lowercased names).
 * @property {string}   contentType   - Parsed Content-Type without parameters, e.g. 'text/html'.
 * @property {string|null} body       - Response body as UTF-8 string; null for redirects / 204.
 * @property {number}   bodyLength    - Byte length of the raw response body.
 * @property {ResponseTimings} timings - Timing breakdown for latency analysis.
 */

/**
 * Returns a zero-value HttpResponse.
 *
 * @returns {HttpResponse}
 */
function createHttpResponse() {
  return {
    id:            '',
    requestId:     '',
    connectionId:  '',
    timestamp:     0,
    statusCode:    200,
    statusMessage: 'OK',
    headers:       {},
    contentType:   '',
    body:          null,
    bodyLength:    0,
    timings:       { sendStart: 0, ttfb: 0, total: 0 },
  };
}

// ---------------------------------------------------------------------------
// WebSocket Event
// ---------------------------------------------------------------------------

/**
 * Canonical WebSocket frame/event shape.
 *
 * @typedef {object} WebSocketEvent
 * @property {string}      id           - UUID v4, unique per captured frame.
 * @property {string}      connectionId - Groups frames on the same WS connection.
 * @property {number}      timestamp    - Unix epoch ms at capture time.
 * @property {WsDirection} direction    - c2s or s2c.
 * @property {WsOpcode}    opcode       - Frame opcode per RFC 6455.
 * @property {string}      data         - Frame payload as UTF-8 string (text) or base64 (binary).
 * @property {boolean}     masked       - True when the frame was client-masked.
 * @property {number}      length       - Payload byte length before any masking.
 * @property {string}      comment      - Free-text analyst note; empty string by default.
 */

/**
 * Returns a zero-value WebSocketEvent.
 *
 * @returns {WebSocketEvent}
 */
function createWebSocketEvent() {
  return {
    id:           '',
    connectionId: '',
    timestamp:    0,
    direction:    WsDirection.CLIENT_TO_SERVER,
    opcode:       WsOpcode.TEXT,
    data:         '',
    masked:       false,
    length:       0,
    comment:      '',
  };
}

// ---------------------------------------------------------------------------
// Traffic Item  (top-level union stored in history)
// ---------------------------------------------------------------------------

/**
 * Unified wrapper stored in the traffic history log.
 * Exactly one of `request`/`response` or `wsEvent` is populated,
 * disambiguated by `kind`.
 *
 * @typedef {object} TrafficItem
 * @property {string}          id         - UUID v4 (same as nested request.id or wsEvent.id).
 * @property {TrafficKind}     kind       - 'http' or 'websocket'.
 * @property {number}          timestamp  - Capture timestamp (copied from inner event).
 * @property {HttpRequest|null}      request  - Populated for HTTP traffic.
 * @property {HttpResponse|null}     response - Populated when response is available.
 * @property {WebSocketEvent|null}   wsEvent  - Populated for WebSocket traffic.
 */

/**
 * Returns a zero-value HTTP TrafficItem.
 *
 * @returns {TrafficItem}
 */
function createHttpTrafficItem() {
  return {
    id:        '',
    kind:      TrafficKind.HTTP,
    timestamp: 0,
    request:   createHttpRequest(),
    response:  null,
    wsEvent:   null,
  };
}

/**
 * Returns a zero-value WebSocket TrafficItem.
 *
 * @returns {TrafficItem}
 */
function createWsTrafficItem() {
  return {
    id:        '',
    kind:      TrafficKind.WEBSOCKET,
    timestamp: 0,
    request:   null,
    response:  null,
    wsEvent:   createWebSocketEvent(),
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  SCHEMA_VERSION: 2,

  HttpProtocol,
  WsDirection,
  WsOpcode,
  TrafficKind,

  createHttpRequest,
  createHttpResponse,
  createWebSocketEvent,
  createHttpTrafficItem,
  createWsTrafficItem,
};
