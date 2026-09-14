import { createServer } from 'node:http';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import worker from '../dist/server/index.js';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

class SqliteStatement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) { return new SqliteStatement(this.database, this.sql, values); }
  first() { return this.database.prepare(this.sql).get(...this.values) || null; }
  all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
  run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class SqliteBinding {
  constructor(database) { this.database = database; }
  prepare(sql) { return new SqliteStatement(this.database, sql); }
}

class DiskFileBinding {
  constructor(root) { this.root = root; }

  pathFor(key) {
    const safe = key.split('/').filter(part => part && part !== '.' && part !== '..');
    return join(this.root, ...safe);
  }

  async put(key, value) {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(value));
  }

  async get(key) {
    try {
      return { body: await readFile(this.pathFor(key)) };
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async delete(key) {
    try {
      await unlink(this.pathFor(key));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
}

async function initializeDatabase(database) {
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  const hasRooms = database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'rooms'").get();
  if (hasRooms) return;

  for (const name of ['0000_hard_miek.sql', '0001_dazzling_loki.sql']) {
    const migration = await readFile(join(projectRoot, 'drizzle', name), 'utf8');
    for (const statement of migration.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean)) {
      database.exec(statement);
    }
  }
}

async function requestBody(request, limit = 9 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('请求内容过大'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function requestUrl(request) {
  const protocol = request.headers['x-forwarded-proto'] || 'http';
  const host = request.headers['x-forwarded-host'] || request.headers.host || 'localhost';
  return `${protocol}://${host}${request.url || '/'}`;
}

export async function createAppServer({ dataDir = join(projectRoot, '.data') } = {}) {
  await mkdir(join(dataDir, 'files'), { recursive: true });
  const database = new DatabaseSync(join(dataDir, 'tier-board.sqlite'));
  await initializeDatabase(database);
  const env = {
    DB: new SqliteBinding(database),
    FILES: new DiskFileBinding(join(dataDir, 'files')),
  };

  const server = createServer(async (incoming, outgoing) => {
    try {
      if (incoming.url === '/healthz') {
        outgoing.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
        outgoing.end('ok');
        return;
      }
      const body = ['GET', 'HEAD'].includes(incoming.method || 'GET') ? undefined : await requestBody(incoming);
      const response = await worker.fetch(new Request(requestUrl(incoming), {
        method: incoming.method,
        headers: incoming.headers,
        body,
      }), env);
      const headers = Object.fromEntries(response.headers.entries());
      outgoing.writeHead(response.status, headers);
      if (incoming.method === 'HEAD') outgoing.end();
      else outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error(error);
      const status = Number(error?.statusCode) || 500;
      outgoing.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      outgoing.end(JSON.stringify({ error: status === 413 ? '请求内容过大' : '服务器暂时不可用' }));
    }
  });

  server.on('close', () => database.close());
  return server;
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const port = Number(process.env.PORT || 3000);
  const dataDir = process.env.DATA_DIR || '/var/lib/tier-board';
  if (!existsSync(join(projectRoot, 'dist', 'server', 'index.js'))) {
    throw new Error('请先运行 npm run build');
  }
  const server = await createAppServer({ dataDir });
  server.listen(port, '127.0.0.1', () => console.log(`Tier board listening on 127.0.0.1:${port}`));
}
