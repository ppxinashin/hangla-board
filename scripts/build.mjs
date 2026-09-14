import { mkdir, readFile, writeFile } from 'node:fs/promises';

const [workerSource, html] = await Promise.all([
  readFile(new URL('../src/worker.js', import.meta.url), 'utf8'),
  readFile(new URL('../dist/index.html', import.meta.url), 'utf8'),
]);

const marker = '__INDEX_HTML_JSON__';
if (!workerSource.includes(marker)) throw new Error('Worker HTML marker is missing');

await mkdir(new URL('../dist/server/', import.meta.url), { recursive: true });
await writeFile(
  new URL('../dist/server/index.js', import.meta.url),
  workerSource.replace(marker, JSON.stringify(html)),
  'utf8',
);

console.log('Built dist/server/index.js');
