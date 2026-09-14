const INDEX_HTML = __INDEX_HTML_JSON__;

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};
const ROOM_CODE_PATTERN = /^[A-Z0-9]{8}$/;
const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function randomRoomCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map(value => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]).join('');
}

function cleanName(value, fallback = '参与者') {
  const name = String(value || '').trim().slice(0, 24);
  return name || fallback;
}

function cleanRoomCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

function cleanBoardState(value) {
  if (!value || typeof value !== 'object') throw new Error('看板数据无效');
  const tiers = Array.isArray(value.tiers) ? value.tiers.slice(0, 20) : [];
  const items = Array.isArray(value.items) ? value.items.slice(0, 200) : [];
  const knownItemIds = new Set(items.map(item => String(item?.id || '')).filter(Boolean));
  return {
    title: String(value.title || '这期怎么排？').slice(0, 80),
    theme: value.theme === 'ember' ? 'ember' : 'rainbow',
    tiers: tiers.map((tier, index) => ({
      id: String(tier?.id || crypto.randomUUID()).slice(0, 80),
      name: String(tier?.name || `档位 ${index + 1}`).slice(0, 30),
      items: Array.isArray(tier?.items)
        ? tier.items.map(String).filter(id => knownItemIds.has(id)).slice(0, 200)
        : [],
    })),
    bank: Array.isArray(value.bank)
      ? value.bank.map(String).filter(id => knownItemIds.has(id)).slice(0, 200)
      : [],
    items: items.map(item => ({
      id: String(item?.id || crypto.randomUUID()).slice(0, 80),
      name: String(item?.name || '图片').slice(0, 120),
      url: String(item?.url || '').slice(0, 300),
      remoteId: item?.remoteId ? String(item.remoteId).slice(0, 80) : null,
    })),
  };
}

async function readBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 400000) throw new Error('请求内容过大');
  return request.json();
}

async function getRoom(env, code) {
  return env.DB.prepare(
    'SELECT code, host_participant_id, state_json, version, finalized, updated_at FROM rooms WHERE code = ?',
  ).bind(code).first();
}

async function activeParticipants(env, code) {
  const cutoff = Date.now() - 30000;
  const result = await env.DB.prepare(
    'SELECT id, name, last_seen FROM participants WHERE room_code = ? AND last_seen >= ? ORDER BY last_seen DESC',
  ).bind(code, cutoff).all();
  return (result.results || []).map(entry => ({
    id: entry.id,
    name: entry.name,
    lastSeen: entry.last_seen,
  }));
}

async function touchParticipant(env, code, participantId, nickname) {
  const id = String(participantId || '').slice(0, 80) || crypto.randomUUID();
  const name = cleanName(nickname);
  await env.DB.prepare(
    `INSERT INTO participants (id, room_code, name, last_seen)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET room_code = excluded.room_code, name = excluded.name, last_seen = excluded.last_seen`,
  ).bind(id, code, name, Date.now()).run();
  return { id, name };
}

async function roomPayload(env, room) {
  return {
    code: room.code,
    state: JSON.parse(room.state_json),
    version: Number(room.version),
    finalized: Boolean(room.finalized),
    hostParticipantId: room.host_participant_id || null,
    participants: await activeParticipants(env, room.code),
    updatedAt: Number(room.updated_at),
  };
}

async function createRoom(request, env) {
  const body = await readBody(request);
  const participantId = String(body.participantId || crypto.randomUUID()).slice(0, 80);
  const nickname = cleanName(body.nickname, '房主');
  const state = cleanBoardState(body.state);
  const hostKey = crypto.randomUUID() + crypto.randomUUID();
  const now = Date.now();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomRoomCode();
    try {
      await env.DB.prepare(
        `INSERT INTO rooms (code, host_key, host_participant_id, state_json, version, finalized, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
      ).bind(code, hostKey, participantId, JSON.stringify(state), now, now).run();
      await touchParticipant(env, code, participantId, nickname);
      const room = await getRoom(env, code);
      return json({ ...(await roomPayload(env, room)), hostKey, participantId });
    } catch (error) {
      if (!String(error).toLowerCase().includes('unique')) throw error;
    }
  }
  return json({ error: '暂时无法生成房间号，请重试' }, 503);
}

async function joinRoom(request, env, code) {
  const room = await getRoom(env, code);
  if (!room) return json({ error: '房间不存在或已失效' }, 404);
  const body = await readBody(request);
  const participant = await touchParticipant(env, code, body.participantId, body.nickname);
  return json({ ...(await roomPayload(env, room)), participantId: participant.id });
}

async function readRoomState(env, code, url) {
  const room = await getRoom(env, code);
  if (!room) return json({ error: '房间不存在或已失效' }, 404);
  const version = Number(room.version);
  const sinceValue = url.searchParams.get('since');
  const since = sinceValue === null ? Number.NaN : Number(sinceValue);
  const payload = {
    code: room.code,
    version,
    finalized: Boolean(room.finalized),
    hostParticipantId: room.host_participant_id || null,
    participants: await activeParticipants(env, room.code),
    updatedAt: Number(room.updated_at),
  };
  if (!Number.isInteger(since) || since !== version) payload.state = JSON.parse(room.state_json);
  return json(payload);
}

async function transferRoom(request, env, code) {
  const body = await readBody(request);
  const room = await env.DB.prepare(
    'SELECT host_key, host_participant_id FROM rooms WHERE code = ?',
  ).bind(code).first();
  if (!room) return json({ error: '房间不存在或已失效' }, 404);
  if (!body.hostKey || body.hostKey !== room.host_key) return json({ error: '只有房主可以转让房间' }, 403);
  const targetParticipantId = String(body.targetParticipantId || '').slice(0, 80);
  if (!targetParticipantId || targetParticipantId === room.host_participant_id) {
    return json({ error: '请选择其他参与者接任房主' }, 400);
  }
  const target = await env.DB.prepare(
    'SELECT id FROM participants WHERE id = ? AND room_code = ? AND last_seen >= ?',
  ).bind(targetParticipantId, code, Date.now() - 30000).first();
  if (!target) return json({ error: '接任者已不在房间，请重新选择' }, 404);
  const nextHostKey = crypto.randomUUID() + crypto.randomUUID();
  await env.DB.prepare(
    'UPDATE rooms SET host_key = ?, host_participant_id = ?, updated_at = ? WHERE code = ?',
  ).bind(nextHostKey, targetParticipantId, Date.now(), code).run();
  if (room.host_participant_id) {
    await env.DB.prepare('DELETE FROM participants WHERE id = ? AND room_code = ?')
      .bind(room.host_participant_id, code).run();
  }
  const latest = await getRoom(env, code);
  return json({ ...(await roomPayload(env, latest)), transferred: true });
}

async function claimRoomHost(request, env, code) {
  const body = await readBody(request);
  const participantId = String(body.participantId || '').slice(0, 80);
  const room = await env.DB.prepare(
    'SELECT host_key, host_participant_id FROM rooms WHERE code = ?',
  ).bind(code).first();
  if (!room) return json({ error: '房间不存在或已失效' }, 404);
  if (!participantId || participantId !== room.host_participant_id) return json({ error: '当前参与者不是房主' }, 403);
  return json({ hostKey: room.host_key, hostParticipantId: room.host_participant_id });
}

async function dissolveRoom(request, env, code) {
  const body = await readBody(request);
  const room = await env.DB.prepare('SELECT host_key FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return json({ error: '房间不存在或已失效' }, 404);
  if (!body.hostKey || body.hostKey !== room.host_key) return json({ error: '只有房主可以解散房间' }, 403);
  const images = await env.DB.prepare('SELECT object_key FROM room_images WHERE room_code = ?').bind(code).all();
  await Promise.all((images.results || []).map(image => env.FILES.delete(image.object_key)));
  await env.DB.prepare('DELETE FROM rooms WHERE code = ?').bind(code).run();
  return json({ dissolved: true, code });
}

async function presence(request, env, code) {
  const room = await getRoom(env, code);
  if (!room) return json({ error: '房间不存在或已失效' }, 404);
  const body = await readBody(request);
  await touchParticipant(env, code, body.participantId, body.nickname);
  const latest = await getRoom(env, code);
  return json(await roomPayload(env, latest));
}

async function syncRoom(request, env, code) {
  const body = await readBody(request);
  const room = await getRoom(env, code);
  if (!room) return json({ error: '房间不存在或已失效' }, 404);
  await touchParticipant(env, code, body.participantId, body.nickname);
  if (room.finalized) return json({ error: '最终排名已锁定', ...(await roomPayload(env, room)) }, 423);

  const baseVersion = Number(body.baseVersion);
  if (!Number.isInteger(baseVersion) || baseVersion !== Number(room.version)) {
    return json({ error: '房间已有新调整', ...(await roomPayload(env, room)) }, 409);
  }

  const nextState = cleanBoardState(body.state);
  const result = await env.DB.prepare(
    `UPDATE rooms SET state_json = ?, version = version + 1, updated_at = ?
     WHERE code = ? AND version = ? AND finalized = 0`,
  ).bind(JSON.stringify(nextState), Date.now(), code, baseVersion).run();

  if (!result.meta?.changes) {
    const latest = await getRoom(env, code);
    return json({ error: '房间已有新调整', ...(await roomPayload(env, latest)) }, 409);
  }
  const latest = await getRoom(env, code);
  return json(await roomPayload(env, latest));
}

async function finalizeRoom(request, env, code) {
  const body = await readBody(request);
  const room = await env.DB.prepare('SELECT host_key FROM rooms WHERE code = ?').bind(code).first();
  if (!room) return json({ error: '房间不存在或已失效' }, 404);
  if (!body.hostKey || body.hostKey !== room.host_key) return json({ error: '只有房主可以定稿' }, 403);
  await env.DB.prepare(
    'UPDATE rooms SET finalized = ?, version = version + 1, updated_at = ? WHERE code = ?',
  ).bind(body.finalized ? 1 : 0, Date.now(), code).run();
  const latest = await getRoom(env, code);
  return json(await roomPayload(env, latest));
}

async function uploadImage(request, env, code) {
  const room = await getRoom(env, code);
  if (!room) return json({ error: '房间不存在或已失效' }, 404);
  if (room.finalized) return json({ error: '最终排名已锁定' }, 423);
  const contentType = (request.headers.get('content-type') || '').split(';')[0].toLowerCase();
  if (!IMAGE_TYPES.has(contentType)) return json({ error: '仅支持 PNG、JPEG、WebP 和 GIF' }, 415);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) return json({ error: '单张图片不能超过 8MB' }, 413);

  const id = crypto.randomUUID();
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }[contentType];
  const objectKey = `rooms/${code}/${id}.${extension}`;
  let fileName = '图片';
  try { fileName = decodeURIComponent(request.headers.get('x-file-name') || '图片'); } catch (_) {}
  fileName = cleanName(fileName, '图片').slice(0, 120);
  await env.FILES.put(objectKey, bytes, { httpMetadata: { contentType } });
  await env.DB.prepare(
    `INSERT INTO room_images (id, room_code, object_key, file_name, content_type, size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, code, objectKey, fileName, contentType, bytes.byteLength, Date.now()).run();
  return json({ id, name: fileName, url: `/api/images/${code}/${id}` }, 201);
}

async function serveImage(env, code, id) {
  if (!ROOM_CODE_PATTERN.test(code) || !id) return new Response('Not found', { status: 404 });
  const meta = await env.DB.prepare(
    'SELECT object_key, content_type FROM room_images WHERE id = ? AND room_code = ?',
  ).bind(id, code).first();
  if (!meta) return new Response('Not found', { status: 404 });
  const object = await env.FILES.get(meta.object_key);
  if (!object) return new Response('Not found', { status: 404 });
  return new Response(object.body, {
    headers: {
      'content-type': meta.content_type,
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
}

async function handleApi(request, env, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api') return null;

  if (parts[1] === 'images' && parts.length === 4 && request.method === 'GET') {
    return serveImage(env, parts[2], parts[3]);
  }
  if (parts[1] !== 'rooms') return json({ error: '接口不存在' }, 404);
  if (parts.length === 2 && request.method === 'POST') return createRoom(request, env);

  const code = cleanRoomCode(parts[2]);
  if (!code) return json({ error: '房间号应为 8 位字母或数字' }, 400);
  if (parts.length === 3 && request.method === 'GET') return readRoomState(env, code, url);
  if (parts[3] === 'join' && request.method === 'POST') return joinRoom(request, env, code);
  if (parts[3] === 'presence' && request.method === 'POST') return presence(request, env, code);
  if (parts[3] === 'sync' && request.method === 'PUT') return syncRoom(request, env, code);
  if (parts[3] === 'finalize' && request.method === 'POST') return finalizeRoom(request, env, code);
  if (parts[3] === 'transfer' && request.method === 'POST') return transferRoom(request, env, code);
  if (parts[3] === 'claim-host' && request.method === 'POST') return claimRoomHost(request, env, code);
  if (parts[3] === 'dissolve' && request.method === 'POST') return dissolveRoom(request, env, code);
  if (parts[3] === 'images' && request.method === 'POST') return uploadImage(request, env, code);
  return json({ error: '接口不存在' }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const apiResponse = await handleApi(request, env, url);
      if (apiResponse) return apiResponse;
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        return new Response(INDEX_HTML, {
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-cache',
            'x-content-type-options': 'nosniff',
            'referrer-policy': 'same-origin',
          },
        });
      }
      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error(error);
      return json({ error: error instanceof Error ? error.message : '服务器暂时不可用' }, 500);
    }
  },
};
