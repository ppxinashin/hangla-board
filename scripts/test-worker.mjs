import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import worker from '../dist/server/index.js';

class D1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) { return new D1Statement(this.database, this.sql, values); }
  first() { return this.database.prepare(this.sql).get(...this.values) || null; }
  all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
  run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class D1Mock {
  constructor() {
    this.database = new DatabaseSync(':memory:');
  }
  prepare(sql) { return new D1Statement(this.database, sql); }
  exec(sql) { this.database.exec(sql); }
}

class R2Mock {
  objects = new Map();
  async put(key, value, options) { this.objects.set(key, { value: new Uint8Array(value), options }); }
  async get(key) {
    const object = this.objects.get(key);
    return object ? { body: object.value } : null;
  }
}

const DB = new D1Mock();
const migration = await readFile(new URL('../drizzle/0000_hard_miek.sql', import.meta.url), 'utf8');
for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean)) DB.exec(statement);
const env = { DB, FILES: new R2Mock() };

async function call(path, method = 'GET', body, headers = {}) {
  const requestHeaders = new Headers(headers);
  let requestBody = body;
  if (body && !(body instanceof ArrayBuffer) && !(body instanceof Uint8Array)) {
    requestHeaders.set('content-type', 'application/json');
    requestBody = JSON.stringify(body);
  }
  const response = await worker.fetch(new Request(`https://example.test${path}`, { method, headers: requestHeaders, body: requestBody }), env);
  const contentType = response.headers.get('content-type') || '';
  return { response, data: contentType.includes('application/json') ? await response.json() : null };
}

const initialState = {
  title: '联机测试',
  theme: 'rainbow',
  tiers: [{ id: 'tier-1', name: '夯', items: [] }],
  bank: [],
  items: [],
};

const created = await call('/api/rooms', 'POST', { participantId: 'host-1', nickname: '主持人', state: initialState });
assert.equal(created.response.status, 200);
assert.match(created.data.code, /^\d{6}$/);
assert.ok(created.data.hostKey);

const code = created.data.code;
const joined = await call(`/api/rooms/${code}/join`, 'POST', { participantId: 'guest-1', nickname: '嘉宾' });
assert.equal(joined.response.status, 200);
assert.equal(joined.data.state.title, '联机测试');

const bytes = new Uint8Array([137, 80, 78, 71]);
const uploaded = await call(`/api/rooms/${code}/images`, 'POST', bytes, { 'content-type': 'image/png', 'x-file-name': encodeURIComponent('测试图片') });
assert.equal(uploaded.response.status, 201);
assert.match(uploaded.data.url, new RegExp(`^/api/images/${code}/`));

const nextState = {
  ...initialState,
  tiers: [{ id: 'tier-1', name: '夯', items: ['item-1'] }],
  items: [{ id: 'item-1', name: '测试图片', url: uploaded.data.url, remoteId: uploaded.data.id }],
};
const synced = await call(`/api/rooms/${code}/sync`, 'PUT', { participantId: 'host-1', nickname: '主持人', baseVersion: 0, state: nextState });
assert.equal(synced.response.status, 200);
assert.equal(synced.data.version, 1);

const stale = await call(`/api/rooms/${code}/sync`, 'PUT', { participantId: 'guest-1', nickname: '嘉宾', baseVersion: 0, state: initialState });
assert.equal(stale.response.status, 409);
assert.equal(stale.data.state.items.length, 1);

const finalized = await call(`/api/rooms/${code}/finalize`, 'POST', { hostKey: created.data.hostKey, finalized: true });
assert.equal(finalized.response.status, 200);
assert.equal(finalized.data.finalized, true);

const locked = await call(`/api/rooms/${code}/sync`, 'PUT', { participantId: 'guest-1', nickname: '嘉宾', baseVersion: finalized.data.version, state: initialState });
assert.equal(locked.response.status, 423);

const image = await call(uploaded.data.url);
assert.equal(image.response.status, 200);
assert.equal(image.response.headers.get('content-type'), 'image/png');

const page = await worker.fetch(new Request('https://example.test/'), env);
assert.equal(page.status, 200);
assert.match(await page.text(), /联机房间/);

console.log('Worker collaboration tests passed');
