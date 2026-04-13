import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Contracts suite — Milestone 0 (Architecture Baseline, SEN-011)
//
// These tests verify that the contract modules export the expected surface area.
// They do NOT test runtime behaviour (that belongs to service implementation
// tests in later milestones).
// ---------------------------------------------------------------------------

// ============================================================
// traffic-model.js
// ============================================================
describe('contracts/traffic-model', () => {
  const tm = require('../../contracts/traffic-model');

  it('exports a numeric SCHEMA_VERSION', () => {
    expect(typeof tm.SCHEMA_VERSION).toBe('number');
    expect(tm.SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it('exports HttpProtocol enum with required values', () => {
    expect(tm.HttpProtocol.HTTP_1_0).toBeDefined();
    expect(tm.HttpProtocol.HTTP_1_1).toBeDefined();
    expect(tm.HttpProtocol.HTTP_2).toBeDefined();
  });

  it('exports WsDirection enum with both directions', () => {
    expect(tm.WsDirection.CLIENT_TO_SERVER).toBe('c2s');
    expect(tm.WsDirection.SERVER_TO_CLIENT).toBe('s2c');
  });

  it('exports WsOpcode enum including TEXT and BINARY', () => {
    expect(tm.WsOpcode.TEXT).toBe(0x1);
    expect(tm.WsOpcode.BINARY).toBe(0x2);
  });

  it('exports WsOpcode enum with all RFC 6455 values', () => {
    expect(tm.WsOpcode.CONTINUATION).toBe(0x0);
    expect(tm.WsOpcode.TEXT).toBe(0x1);
    expect(tm.WsOpcode.BINARY).toBe(0x2);
    expect(tm.WsOpcode.CLOSE).toBe(0x8);
    expect(tm.WsOpcode.PING).toBe(0x9);
    expect(tm.WsOpcode.PONG).toBe(0xA);
  });

  it('exports HttpProtocol with correct string values', () => {
    expect(tm.HttpProtocol.HTTP_1_0).toBe('HTTP/1.0');
    expect(tm.HttpProtocol.HTTP_1_1).toBe('HTTP/1.1');
    expect(tm.HttpProtocol.HTTP_2).toBe('HTTP/2');
  });

  it('exports TrafficKind enum', () => {
    expect(tm.TrafficKind.HTTP).toBe('http');
    expect(tm.TrafficKind.WEBSOCKET).toBe('websocket');
  });

  describe('createHttpRequest()', () => {
    const req = tm.createHttpRequest();

    it('returns an object with required fields', () => {
      expect(req).toMatchObject({
        id:           '',
        connectionId: '',
        method:       'GET',
        url:          '',
        host:         '',
        port:         80,
        path:         '/',
        queryString:  '',
        headers:      {},
        body:         null,
        rawBodyBase64: null,
        tls:          false,
        tags:         [],
        comment:      '',
        inScope:      false,
      });
    });

    it('protocol defaults to HTTP/1.1', () => {
      expect(req.protocol).toBe(tm.HttpProtocol.HTTP_1_1);
    });
  });

  describe('createHttpResponse()', () => {
    const res = tm.createHttpResponse();

    it('returns an object with required fields', () => {
      expect(res).toMatchObject({
        id:            '',
        requestId:     '',
        connectionId:  '',
        statusCode:    200,
        statusMessage: 'OK',
        headers:       {},
        contentType:   '',
        body:          null,
        bodyLength:    0,
      });
    });

    it('includes timing sub-object with numeric fields', () => {
      expect(res.timings).toMatchObject({ sendStart: 0, ttfb: 0, total: 0 });
    });
  });

  describe('createWebSocketEvent()', () => {
    const ws = tm.createWebSocketEvent();

    it('returns an object with required fields', () => {
      expect(ws).toMatchObject({
        id:           '',
        connectionId: '',
        direction:    tm.WsDirection.CLIENT_TO_SERVER,
        opcode:       tm.WsOpcode.TEXT,
        data:         '',
        masked:       false,
        length:       0,
        comment:      '',
      });
    });
  });

  describe('createHttpTrafficItem()', () => {
    const item = tm.createHttpTrafficItem();

    it('has kind http and nested request', () => {
      expect(item.kind).toBe(tm.TrafficKind.HTTP);
      expect(item.request).toMatchObject({ method: 'GET' });
      expect(item.response).toBeNull();
      expect(item.wsEvent).toBeNull();
    });

    it('has all top-level TrafficItem fields', () => {
      expect(typeof item.id).toBe('string');
      expect(typeof item.timestamp).toBe('number');
      expect(item.kind).toBe('http');
    });
  });

  describe('createWsTrafficItem()', () => {
    const item = tm.createWsTrafficItem();

    it('has kind websocket and nested wsEvent', () => {
      expect(item.kind).toBe(tm.TrafficKind.WEBSOCKET);
      expect(item.wsEvent).toMatchObject({ direction: 'c2s' });
      expect(item.request).toBeNull();
      expect(item.response).toBeNull();
    });

    it('has all top-level TrafficItem fields', () => {
      expect(typeof item.id).toBe('string');
      expect(typeof item.timestamp).toBe('number');
      expect(item.kind).toBe('websocket');
    });
  });
});

// ============================================================
// ipc-contract.js
// ============================================================
describe('contracts/ipc-contract', () => {
  const contract = require('../../contracts/ipc-contract');

  it('exports a numeric SCHEMA_VERSION', () => {
    expect(typeof contract.SCHEMA_VERSION).toBe('number');
  });

  it('exports a non-empty CHANNELS array', () => {
    expect(Array.isArray(contract.CHANNELS)).toBe(true);
    expect(contract.CHANNELS.length).toBeGreaterThan(0);
  });

  it('every channel has required string fields', () => {
    for (const ch of contract.CHANNELS) {
      expect(typeof ch.channel).toBe('string');
      expect(ch.channel.length).toBeGreaterThan(0);
      expect(['invoke', 'push']).toContain(ch.direction);
      expect(typeof ch.payload).toBe('string');
      expect(typeof ch.notes).toBe('string');
    }
  });

  it('channel names are unique', () => {
    const names = contract.CHANNELS.map(c => c.channel);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('getChannel() returns a definition for a known channel', () => {
    const def = contract.getChannel('proxy:start');
    expect(def).toBeDefined();
    expect(def.direction).toBe('invoke');
  });

  it('getChannel() returns undefined for an unknown channel', () => {
    expect(contract.getChannel('nonexistent:channel')).toBeUndefined();
  });

  it('getChannelsForService() filters by service prefix', () => {
    const proxyChs = contract.getChannelsForService('proxy');
    expect(proxyChs.length).toBeGreaterThan(0);
    expect(proxyChs.every(c => c.channel.startsWith('proxy:'))).toBe(true);
  });

  it('getInvokeChannels() returns only invoke channels', () => {
    const chs = contract.getInvokeChannels();
    expect(chs.every(c => c.direction === 'invoke')).toBe(true);
  });

  it('getPushChannels() returns only push channels', () => {
    const chs = contract.getPushChannels();
    expect(chs.every(c => c.direction === 'push')).toBe(true);
  });

  it('covers all expected service namespaces', () => {
    const services = [
      'proxy', 'history', 'rules', 'repeater', 'intruder',
      'target', 'scope', 'scanner', 'decoder', 'browser', 'oob',
      'sequencer', 'extensions', 'project', 'ca',
    ];
    for (const svc of services) {
      const matched = contract.getChannelsForService(svc);
      expect(matched.length, `service "${svc}" has no channels`).toBeGreaterThan(0);
    }
  });

  it('getChannelsForService() returns empty array for unknown service', () => {
    expect(contract.getChannelsForService('nonexistent')).toEqual([]);
  });

  it('invoke and push channels cover all directions', () => {
    const invoke = contract.getInvokeChannels();
    const push   = contract.getPushChannels();
    // There must be both invoke and push channels in the contract
    expect(invoke.length).toBeGreaterThan(0);
    expect(push.length).toBeGreaterThan(0);
    // Together they should account for every channel
    expect(invoke.length + push.length).toBe(contract.CHANNELS.length);
  });

  it('push channels include expected real-time events', () => {
    const pushNames = contract.getPushChannels().map(c => c.channel);
    expect(pushNames).toContain('history:push');
    expect(pushNames).toContain('proxy:intercept:request');
    expect(pushNames).toContain('proxy:intercept:response');
    expect(pushNames).toContain('browser:state');
    expect(pushNames).toContain('browser:navigate:start');
    expect(pushNames).toContain('browser:navigate:complete');
    expect(pushNames).toContain('browser:navigate:error');
    expect(pushNames).toContain('intruder:progress');
    expect(pushNames).toContain('scanner:progress');
    expect(pushNames).toContain('oob:hit');
  });

  it('invoke channels include all CRUD-style service operations', () => {
    const invokeNames = contract.getInvokeChannels().map(c => c.channel);
    expect(invokeNames).toContain('project:new');
    expect(invokeNames).toContain('project:open');
    expect(invokeNames).toContain('project:save');
    expect(invokeNames).toContain('project:close');
    expect(invokeNames).toContain('project:meta');
    expect(invokeNames).toContain('ca:get');
    expect(invokeNames).toContain('ca:export');
    expect(invokeNames).toContain('ca:rotate');
    expect(invokeNames).toContain('browser:session:get');
    expect(invokeNames).toContain('browser:session:close');
    expect(invokeNames).toContain('browser:session:focus');
    expect(invokeNames).toContain('browser:view:set-bounds');
    expect(invokeNames).toContain('browser:back');
    expect(invokeNames).toContain('browser:forward');
    expect(invokeNames).toContain('browser:reload');
    expect(invokeNames).toContain('browser:stop');
  });

  it('validates preload invoke channels against contract direction', () => {
    const preloadPath = path.resolve(__dirname, '..', 'preload.js');
    const source = fs.readFileSync(preloadPath, 'utf8');
    const matches = [...source.matchAll(/invoke\('([^']+)'/g)].map(m => m[1]);
    const usedInvoke = [...new Set(matches)].sort((a, b) => a.localeCompare(b));

    expect(usedInvoke.length).toBeGreaterThan(0);

    for (const channel of usedInvoke) {
      const def = contract.getChannel(channel);
      expect(def, `missing contract for invoke channel: ${channel}`).toBeDefined();
      expect(def.direction, `invoke channel has wrong direction: ${channel}`).toBe('invoke');
    }
  });

  it('validates preload push channels against contract direction', () => {
    const preloadPath = path.resolve(__dirname, '..', 'preload.js');
    const source = fs.readFileSync(preloadPath, 'utf8');
    const matches = [...source.matchAll(/onPush\('([^']+)'/g)].map(m => m[1]);
    const usedPush = [...new Set(matches)].sort((a, b) => a.localeCompare(b));

    expect(usedPush.length).toBeGreaterThan(0);

    for (const channel of usedPush) {
      const def = contract.getChannel(channel);
      expect(def, `missing contract for push channel: ${channel}`).toBeDefined();
      expect(def.direction, `push channel has wrong direction: ${channel}`).toBe('push');
    }
  });
});

// ============================================================
// db-schema.js
// ============================================================
describe('contracts/db-schema', () => {
  const schema = require('../../contracts/db-schema');

  it('exports a numeric CURRENT_VERSION >= 1', () => {
    expect(typeof schema.CURRENT_VERSION).toBe('number');
    expect(schema.CURRENT_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('exports DDL_V1 as a non-empty string array', () => {
    expect(Array.isArray(schema.DDL_V1)).toBe(true);
    expect(schema.DDL_V1.length).toBeGreaterThan(0);
    expect(schema.DDL_V1.every(s => typeof s === 'string')).toBe(true);
  });

  it('exports MIGRATIONS as a non-empty array', () => {
    expect(Array.isArray(schema.MIGRATIONS)).toBe(true);
    expect(schema.MIGRATIONS.length).toBeGreaterThan(0);
  });

  it('every migration has required fields with correct types', () => {
    for (const m of schema.MIGRATIONS) {
      expect(typeof m.fromVersion).toBe('number');
      expect(typeof m.toVersion).toBe('number');
      expect(typeof m.description).toBe('string');
      expect(typeof m.up).toBe('function');
      expect(m.toVersion).toBeGreaterThan(m.fromVersion);
    }
  });

  it('migrations form a contiguous version chain from 0 to CURRENT_VERSION', () => {
    let ver = 0;
    for (const m of schema.MIGRATIONS) {
      expect(m.fromVersion).toBe(ver);
      ver = m.toVersion;
    }
    expect(ver).toBe(schema.CURRENT_VERSION);
  });

  it('exports runMigrations as a function', () => {
    expect(typeof schema.runMigrations).toBe('function');
  });

  it('migration up() uses exec-only adapter contract (no prepare/transaction)', () => {
    for (const m of schema.MIGRATIONS) {
      const statements = [];
      const adapter = {
        exec(sql) { statements.push(sql); },
      };
      // Should not throw on the exec-only adapter
      expect(() => m.up(adapter)).not.toThrow();
      // All emitted statements must be non-empty strings
      expect(statements.length).toBeGreaterThan(0);
      statements.forEach(sql => {
        expect(typeof sql).toBe('string');
        expect(sql.trim().length).toBeGreaterThan(0);
      });
    }
  });

  it('migration up() emits DDL_V1 statements on 0→1 migration', () => {
    const migration = schema.MIGRATIONS.find(m => m.fromVersion === 0 && m.toVersion === 1);
    expect(migration).toBeDefined();

    const emitted = [];
    migration.up({ exec: sql => emitted.push(sql) });

    // At minimum all DDL_V1 entries should appear
    expect(emitted.length).toBeGreaterThanOrEqual(schema.DDL_V1.length);
    // First emitted statement should contain CREATE TABLE IF NOT EXISTS project_meta
    const hasMeta = emitted.some(s => s.includes('project_meta'));
    expect(hasMeta).toBe(true);
  });

  it('rowToProjectMeta() maps numeric timestamps correctly', () => {
    const row = { id: 'abc', name: 'X', created_at: 0, updated_at: 9999, schema_ver: 1 };
    const meta = schema.rowToProjectMeta(row);
    expect(meta.createdAt).toBe(0);
    expect(meta.updatedAt).toBe(9999);
  });

  it('exports rowToProjectMeta as a function that maps DB rows', () => {
    const row = {
      id: 'test-id',
      name: 'Test Project',
      created_at: 1000,
      updated_at: 2000,
      schema_ver: 1,
    };
    const meta = schema.rowToProjectMeta(row);
    expect(meta).toMatchObject({
      id:        'test-id',
      name:      'Test Project',
      createdAt: 1000,
      updatedAt: 2000,
      schemaVer: 1,
    });
  });
});

// ============================================================
// contracts/index.js barrel
// ============================================================
describe('contracts/index.js', () => {
  const contracts = require('../../contracts');

  it('re-exports trafficModel with SCHEMA_VERSION', () => {
    expect(contracts.trafficModel.SCHEMA_VERSION).toBeDefined();
  });

  it('re-exports ipcContract with CHANNELS', () => {
    expect(Array.isArray(contracts.ipcContract.CHANNELS)).toBe(true);
  });

  it('re-exports dbSchema with CURRENT_VERSION', () => {
    expect(typeof contracts.dbSchema.CURRENT_VERSION).toBe('number');
  });
});

// ============================================================
// db/project-store.js delegates to schema
// ============================================================
describe('db/project-store.js', () => {
  const store = require('../db/project-store');

  it('exports CURRENT_VERSION', () => {
    expect(typeof store.CURRENT_VERSION).toBe('number');
  });

  it('exports runMigrations function', () => {
    expect(typeof store.runMigrations).toBe('function');
  });

  it('exports rowToProjectMeta function', () => {
    expect(typeof store.rowToProjectMeta).toBe('function');
  });
});
