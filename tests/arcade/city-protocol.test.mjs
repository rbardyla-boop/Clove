/**
 * Phase 4A — City Block AUTHORITY reducers (the server's truth engine, transport-
 * agnostic). Proves: join/leave/reconnect, server-clamped movement (clients send
 * intent only — never a position), input rate limiting, server-validated portal
 * entry, and stale-player eviction. The CityRoom DO + dev shim are thin wrappers
 * over exactly these functions, so passing here means both transports agree.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCityState, addPlayer, applyInput, removePlayer, touchPlayer,
  stalePlayerIds, enterPortal, welcomePayload, citySnapshot, SCHEMA_VERSION,
  MOVEMENT, PLAYER_STALE_MS,
} from '../../arcade/city/city-block.mjs';

const A = 'player:a';
const B = 'player:b';
const T0 = 1_000_000;

function withA(now = T0) {
  return addPlayer(createCityState(), A, { now });
}

// ── membership ─────────────────────────────────────────────────────────────
test('addPlayer seeds a player at a walkable spawn; re-add is idempotent (reconnect keeps position)', () => {
  const r = withA();
  assert.equal(r.ok, true);
  assert.equal(r.player.id, A);
  assert.equal(r.player.lastSeq, 0);
  // move A, then re-add → keeps the moved position (a reconnect does not respawn)
  const moved = applyInput(r.state, A, { dx: 1, dy: 0, seq: 1 }, T0 + 100).state;
  const again = addPlayer(moved, A, { now: T0 + 200 });
  assert.equal(again.player.x, moved.players[A].x);
});

test('addPlayer rejects a missing or invalid identity', () => {
  assert.equal(addPlayer(createCityState(), '', { now: T0 }).reason, 'no_identity');
  assert.equal(addPlayer(createCityState(), 'bad id!', { now: T0 }).reason, 'no_identity');
  assert.equal(addPlayer(createCityState(), 'x'.repeat(65), { now: T0 }).reason, 'no_identity');
});

test('addPlayer enforces capacity but always lets an existing player reconnect', () => {
  let s = createCityState();
  s = addPlayer(s, 'p1', { now: T0, capacity: 2 }).state;
  s = addPlayer(s, 'p2', { now: T0, capacity: 2 }).state;
  const full = addPlayer(s, 'p3', { now: T0, capacity: 2 });
  assert.equal(full.ok, false);
  assert.equal(full.reason, 'city_full');
  // an already-present player may still re-add (reconnect) even at capacity
  const reconnect = addPlayer(s, 'p1', { now: T0 + 5, capacity: 2 });
  assert.equal(reconnect.ok, true);
  // omitting capacity = unbounded (test worlds)
  assert.equal(addPlayer(s, 'p3', { now: T0 }).ok, true);
});

test('removePlayer drops the player from the world', () => {
  const r = withA();
  const after = removePlayer(r.state, A);
  assert.equal(after.players[A], undefined);
  assert.equal(removePlayer(after, A).players[A], undefined); // idempotent
});

// ── server-authoritative movement ─────────────────────────────────────────────
test('applyInput moves the player by a server-clamped step from ITS OWN last position', () => {
  const { state, player } = withA();
  const x0 = player.x;
  const r = applyInput(state, A, { dx: 1, dy: 0, seq: 1 }, T0 + 100);
  assert.equal(r.accepted, true);
  const expected = x0 + MOVEMENT.MAX_SPEED * 0.1; // dt=100ms
  assert.ok(Math.abs(r.player.x - expected) < 1e-6);
  assert.equal(r.player.lastSeq, 1);
});

test('NO CLIENT AUTHORITY: a client-supplied position is ignored; only intent moves the player', () => {
  const { state, player } = withA();
  const start = { x: player.x, y: player.y };
  // Malicious payload tries to teleport via x/y and claim a huge dx.
  const r = applyInput(state, A, { dx: 9999, dy: 0, seq: 1, x: 0, y: 0 }, T0 + 100);
  // dx is unit-clamped, dt clamped → tiny bounded move, NEVER a jump to (0,0) or off-map.
  assert.notEqual(r.player.x, 0);
  assert.ok(r.player.x - start.x <= MOVEMENT.MAX_SPEED * (MOVEMENT.MAX_DT_MS / 1000) + 1e-6);
  assert.ok(r.player.x > start.x, 'still moved by the legitimate clamped intent');
});

test('a single delayed input cannot teleport across the map (dt is clamped)', () => {
  const { state, player } = withA();
  const r = applyInput(state, A, { dx: 1, dy: 0, seq: 1 }, T0 + 60_000); // 60s gap
  const maxStep = MOVEMENT.MAX_SPEED * (MOVEMENT.MAX_DT_MS / 1000);
  assert.ok(r.player.x - player.x <= maxStep + 1e-6);
});

test('inputs faster than MIN_INPUT_INTERVAL_MS are dropped (bounded ingest, no extra movement)', () => {
  const { state } = withA();
  const first = applyInput(state, A, { dx: 1, dy: 0, seq: 1 }, T0 + 100);
  const xAfterFirst = first.player.x;
  const tooSoon = applyInput(first.state, A, { dx: 1, dy: 0, seq: 2 }, T0 + 100 + 5); // 5ms later
  assert.equal(tooSoon.accepted, false);
  assert.equal(tooSoon.reason, 'rate_limited');
  assert.equal(tooSoon.player.x, xAfterFirst, 'dropped input does not move the player');
});

test('applyInput on an unknown player is rejected', () => {
  const r = applyInput(createCityState(), 'ghost', { dx: 1, dy: 0 }, T0 + 100);
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'not_joined');
});

test('collision is enforced server-side: walking into a building does not pass through it', () => {
  // Seed A right against the data-spire wall, then push left repeatedly.
  let state = createCityState();
  state = { ...state, players: { [A]: { id: A, x: 430, y: 240, facing: 0, lastSeq: 0, lastInputAt: T0, lastSeen: T0 } } };
  let now = T0;
  for (let i = 0; i < 20; i++) {
    now += 50;
    state = applyInput(state, A, { dx: -1, dy: 0, seq: i + 1 }, now).state;
  }
  assert.ok(state.players[A].x > 400 + MOVEMENT.PLAYER_RADIUS - 1, 'blocked by the building wall, never inside it');
});

// ── Phase 4B: client-dt authority (deterministic replay, still anti-cheat) ────
test('applyInput honors a client dt but NEVER exceeds real elapsed server time (anti speed-hack)', () => {
  const { state, player } = withA(T0);
  const forged = applyInput(state, A, { dx: 1, dy: 0, seq: 1, dt: 9_999 }, T0 + 100);
  const step100 = MOVEMENT.MAX_SPEED * 0.1; // only 100ms really elapsed
  assert.ok(Math.abs(forged.player.x - (player.x + step100)) < 1e-6, 'forged dt capped to real elapsed');
});

test('applyInput uses a smaller client dt when it is below real elapsed', () => {
  const { state, player } = withA(T0);
  const r = applyInput(state, A, { dx: 1, dy: 0, seq: 1, dt: 50 }, T0 + 100);
  assert.ok(Math.abs(r.player.x - (player.x + MOVEMENT.MAX_SPEED * 0.05)) < 1e-6);
});

test('applyInput without dt falls back to the server clock (4A-compatible)', () => {
  const { state, player } = withA(T0);
  const r = applyInput(state, A, { dx: 1, dy: 0, seq: 1 }, T0 + 100);
  assert.ok(Math.abs(r.player.x - (player.x + MOVEMENT.MAX_SPEED * 0.1)) < 1e-6);
});

test('a rate-limited input is acknowledged (lastSeq advances) so the client stops replaying it', () => {
  const { state } = withA(T0);
  const first = applyInput(state, A, { dx: 1, dy: 0, seq: 1, dt: 50 }, T0 + 100);
  assert.equal(first.accepted, true);
  const tooSoon = applyInput(first.state, A, { dx: 1, dy: 0, seq: 2, dt: 50 }, T0 + 105); // < 33ms gate
  assert.equal(tooSoon.accepted, false);
  assert.equal(tooSoon.reason, 'rate_limited');
  assert.equal(tooSoon.player.x, first.player.x, 'no movement on a rate-limited input');
  assert.equal(tooSoon.player.lastSeq, 2, 'seq still ack-ed → client drops it from replay (no over-prediction)');
});

test('snapshot + welcome carry a schema_version, and snapshot still acks via per-player seq', () => {
  let { state } = withA(T0);
  state = applyInput(state, A, { dx: 1, dy: 0, seq: 7, dt: 50 }, T0 + 100).state;
  const snap = citySnapshot(state, T0 + 100);
  assert.equal(snap.schema_version, SCHEMA_VERSION);
  assert.equal(snap.players.find((p) => p.id === A).seq, 7); // ack_seq for self
  const w = welcomePayload(state, A, 'downtown-01', T0 + 100);
  assert.equal(w.schema_version, SCHEMA_VERSION);
  assert.equal(w.self_player_id, A);
});

// ── server-validated portal ─────────────────────────────────────────────────
test('enterPortal is allowed ONLY when the canonical position is inside the zone', () => {
  let state = createCityState();
  // Inside the arcade portal zone (x200..280, y560..600).
  state = { ...state, players: { [A]: { id: A, x: 240, y: 580, facing: 0, lastSeq: 0, lastInputAt: T0, lastSeen: T0 } } };
  const ok = enterPortal(state, A, 'arcade');
  assert.equal(ok.ok, true);
  assert.equal(ok.target, '/arcade/');
});

test('enterPortal rejects players outside the zone, unknown portals, and unknown players', () => {
  const { state } = withA(); // A spawns on the plaza (not in any portal)
  assert.equal(enterPortal(state, A, 'arcade').reason, 'not_in_zone');
  assert.equal(enterPortal(state, A, 'nope').reason, 'unknown_portal');
  assert.equal(enterPortal(createCityState(), A, 'arcade').reason, 'not_joined');
});

// ── liveness / eviction ───────────────────────────────────────────────────────
test('stalePlayerIds flags players past PLAYER_STALE_MS; touchPlayer refreshes liveness', () => {
  const { state } = withA();
  assert.deepEqual(stalePlayerIds(state, T0 + 1000), []);
  assert.deepEqual(stalePlayerIds(state, T0 + PLAYER_STALE_MS + 1), [A]);
  const refreshed = touchPlayer(state, A, T0 + PLAYER_STALE_MS);
  assert.deepEqual(stalePlayerIds(refreshed, T0 + PLAYER_STALE_MS + 1), []);
});

// ── welcome payload ───────────────────────────────────────────────────────────
test('welcomePayload carries you + roster + layout + tick, and no private fields', () => {
  let r = withA();
  r = { ...r, state: addPlayer(r.state, B, { now: T0 }).state };
  const w = welcomePayload(r.state, A, 'downtown-01', T0);
  assert.equal(w.cityId, 'downtown-01');
  assert.equal(w.you.id, A);
  assert.equal(w.players.length, 2);
  assert.ok(w.layout.world && w.layout.buildings && w.layout.portals);
  assert.ok(w.tick.snapshotIntervalMs > 0);
  assert.ok(!/lastInputAt|lastSeen/.test(JSON.stringify(w)));
});
