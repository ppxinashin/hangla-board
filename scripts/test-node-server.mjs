import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAppServer } from '../server/node.mjs';

const dataDir = await mkdtemp(join(tmpdir(), 'tier-board-node-'));
const server = await createAppServer({ dataDir });

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/healthz`);
  assert.equal(health.status, 200);
  assert.equal(await health.text(), 'ok');

  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /联机房间/);

  const created = await fetch(`${base}/api/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      nickname: '部署测试',
      state: { title: '香港节点测试', theme: 'rainbow', tiers: [], bank: [], items: [] },
    }),
  });
  assert.equal(created.status, 200);
  assert.match((await created.json()).code, /^[A-Z0-9]{8}$/);
  console.log('Node server smoke tests passed');
} finally {
  await new Promise(resolve => server.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
}
