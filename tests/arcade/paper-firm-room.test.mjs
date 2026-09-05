import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../workers/arcade/package.json', import.meta.url));
const { buildSync } = require('esbuild');
const roomSource = fileURLToPath(new URL('../../workers/arcade/src/paper-firm-room.ts', import.meta.url));
const roomModule = { exports: {} };
const roomCode = buildSync({ entryPoints: [roomSource], bundle: true, platform: 'node', format: 'cjs', target: 'node18', write: false, sourcemap: false }).outputFiles[0].text;
class ResponseStub {
  constructor(body, init = {}) { this.body = body; this.status = init.status; this.webSocket = init.webSocket; }
}
new Function('require', 'module', 'exports', 'crypto', 'atob', 'Response', roomCode)(createRequire(roomSource), roomModule, roomModule.exports, webcrypto, globalThis.atob, ResponseStub);
const { PaperFirmRoom } = roomModule.exports;

const SECRET = 'paper-firm-local-dev-secret-change-me';

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

class StorageStub {
  values = new Map();
  writes = [];
  alarms = [];
  async get(key) { return clone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, clone(value)); this.writes.push(key); }
  setAlarm(at) { this.alarms.push(at); }
}

class SocketStub {
  readyState = 1;
  messages = [];
  closed = null;
  attachment = null;
  serializeAttachment(value) { this.attachment = clone(value); }
  deserializeAttachment() { return clone(this.attachment); }
  send(value) { this.messages.push(JSON.parse(value)); }
  close(code, reason) { this.closed = { code, reason }; this.readyState = 3; }
}

class ContextStub {
  constructor(storage = new StorageStub(), sockets = []) { this.storage = storage; this.sockets = sockets; }
  getWebSockets() { return this.sockets; }
  acceptWebSocket(ws) { if (!this.sockets.includes(ws)) this.sockets.push(ws); }
  blockConcurrencyWhile(fn) { return fn(); }
}

class PairStub {
  constructor() { this[0] = new SocketStub(); this[1] = new SocketStub(); }
}

globalThis.WebSocketPair = PairStub;

function ticket({ matchId = 'RUG001', actorId = 'human:ada', role = 'lead', expiresAt }) {
  const material = ['PF-JOIN/2', matchId, actorId, role, String(expiresAt)].join('\n');
  const encoded = Buffer.from(material).toString('base64url');
  const signature = createHmac('sha256', SECRET).update(material).digest('hex');
  return `${encoded}.${signature}`;
}

async function withClock(start, fn) {
  const realNow = Date.now;
  let now = start;
  Date.now = () => now;
  try { return await fn({ now: () => now, advance: (ms) => { now += ms; } }); }
  finally { Date.now = realNow; }
}

function room(ctx) {
  return new PaperFirmRoom(ctx, { ENVIRONMENT: 'development' });
}

async function join(ctx, actorId, role, matchId, expiresAt) {
  const r = room(ctx);
  const response = await r.fetch(new Request(`https://mesh/arcade/paper-firm/ws?match=${matchId}&ticket=${encodeURIComponent(ticket({ matchId, actorId, role, expiresAt }))}`));
  assert.equal(response.status, 101);
  const ws = ctx.sockets.at(-1);
  await r.webSocketMessage(ws, JSON.stringify({ t: 'pf_join', playerId: actorId }));
  return { r, ws };
}

test('PaperFirmRoom signs ordered Scout participation into the extraction receipt', async () => {
  await withClock(1_800_000_000_000, async ({ now, advance }) => {
    const ctx = new ContextStub();
    const { r, ws } = await join(ctx, 'human:ada', 'lead', 'RUG001', now() + 60_000);
    const storageWritesAfterJoin = ctx.storage.writes.length;

    // Move through the real socket protocol into STAIN; no direct state mutation.
    for (let i = 0; i < 30; i += 1) { advance(50); await r.webSocketMessage(ws, JSON.stringify({ t: 'pf_input', dx: 1, dy: -0.4 })); }
    await r.webSocketMessage(ws, JSON.stringify({ t: 'pf_scout', verb: 'find' }));
    await r.webSocketMessage(ws, JSON.stringify({ t: 'pf_scout', verb: 'carry' }));
    for (let i = 0; i < 34; i += 1) { advance(50); await r.webSocketMessage(ws, JSON.stringify({ t: 'pf_input', dx: 1, dy: -0.3 })); }
    await r.webSocketMessage(ws, JSON.stringify({ t: 'pf_extract' }));

    const extraction = ws.messages.find((message) => message.t === 'pf_extract_result');
    assert.equal(extraction?.ok, true);
    assert.equal(extraction.receipt.scout_find_sequence, 1);
    assert.equal(extraction.receipt.scout_carry_sequence, 2);
    assert.equal(extraction.receipt.scout_carry_sequence > extraction.receipt.scout_find_sequence, true);
    assert.equal(extraction.receipt.scout_find_at <= extraction.receipt.scout_carry_at, true);
    assert.equal(extraction.receipt.scout_carry_at <= extraction.receipt.issued_at, true);
    const signedMaterial = [
      extraction.receipt.version, extraction.receipt.match_id, extraction.receipt.receipt_id, extraction.receipt.actor_id,
      extraction.receipt.action, extraction.receipt.object_id, extraction.receipt.zone_id, String(extraction.receipt.sequence),
      extraction.receipt.nonce, String(extraction.receipt.issued_at), String(extraction.receipt.scout_find_sequence),
      String(extraction.receipt.scout_find_at), String(extraction.receipt.scout_carry_sequence), String(extraction.receipt.scout_carry_at),
    ].join('\n');
    assert.equal(extraction.receipt.signature, createHmac('sha256', SECRET).update(signedMaterial).digest('hex'));
    assert.equal(ctx.storage.values.get('pfState').page.pendingReceipt.receipt_id, extraction.receipt.receipt_id);
    assert.equal(ctx.storage.writes.length > storageWritesAfterJoin, true);
  });
});

test('PaperFirmRoom flushes a trailing position before Scout validation and restores durable clocks', async () => {
  await withClock(1_800_000_100_000, async ({ now, advance }) => {
    const storage = new StorageStub();
    const ctx = new ContextStub(storage);
    const { r, ws } = await join(ctx, 'human:ada', 'lead', 'RUG002', now() + 60_000);
    for (let i = 0; i < 30; i += 1) { advance(50); await r.webSocketMessage(ws, JSON.stringify({ t: 'pf_input', dx: 1, dy: -0.4 })); }
    const beforeScout = clone(r.state.players['human:ada']);
    const writesBeforeScout = storage.writes.length;
    await r.webSocketMessage(ws, JSON.stringify({ t: 'pf_scout', verb: 'find' }));
    assert.deepEqual(
      { x: storage.values.get('pfState').players['human:ada'].x, y: storage.values.get('pfState').players['human:ada'].y },
      { x: beforeScout.x, y: beforeScout.y },
      'critical Scout transition persists the latest in-memory position',
    );
    assert.equal(storage.writes.length > writesBeforeScout, true);

    const checkpointAt = storage.values.get('pfPositionCheckpoints')['human:ada'];
    const restoredCtx = new ContextStub(storage, [ws]);
    const restored = room(restoredCtx);
    advance(500);
    await restored.webSocketMessage(ws, JSON.stringify({ t: 'heartbeat' }));
    assert.equal(storage.values.get('pfPositionCheckpoints')['human:ada'], checkpointAt, 'hibernation restore keeps the checkpoint throttle timestamp');
    assert.equal(ws.attachment.lastHeartbeat, now());
  });
});

test('PaperFirmRoom closes expired pending admissions during restore and rechecks pf_join expiry', async () => {
  await withClock(1_800_000_200_000, async ({ now }) => {
    const expired = new SocketStub();
    expired.serializeAttachment({ authorizedPlayerId: 'human:late', role: 'lead', matchId: 'RUG003', expiresAt: now() - 1, connectedAt: now() - 10_000 });
    const ctx = new ContextStub(new StorageStub(), [expired]);
    const restored = room(ctx);
    assert.deepEqual(expired.closed, { code: 1008, reason: 'admission_expired' });
    await restored.webSocketMessage(expired, JSON.stringify({ t: 'pf_join', playerId: 'human:late' }));
    assert.equal(expired.messages.at(-1)?.reason, 'admission_expired');
  });
});
