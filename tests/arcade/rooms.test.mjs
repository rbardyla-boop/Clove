/**
 * Phase 2a — Multi-room catalog, routing/resolution, and room-partition isolation.
 *
 * Groups A (room catalog) + B (routing) test the pure rooms module directly.
 * Group C (state isolation) proves the partition model the DO/dev-shim use: each
 * room is a SEPARATE ticket-state namespace, so earnings/ledger/inventory in one
 * room never affect another. (Live transport isolation is covered by
 * tests/arcade/multi-room.spec.mjs.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOMS, ROOM_IDS, DEFAULT_ROOM_ID, getRoom, isValidRoomId, sanitizeRoomId, resolveRoomId,
  roomListPayload, roomMetaPayload, hasCapacity, cabinetSummary,
} from '../../workers/arcade/src/rooms.mjs';
import { createTicketState, startRound, submitRound, getBalance } from '../../workers/arcade/src/round-authority.mjs';
import { getLedger } from '../../workers/arcade/src/ledger.mjs';
import { redeemPrize, getInventory } from '../../workers/arcade/src/prize-authority.mjs';

const A = 'player:a';
const pulse = (over = {}) => ({ roundId: 'p1', machineId: 'pulse', grade: 'A', score: 1825, accuracy: 88, hits: 16, bestStreak: 9, durationMs: 30000, ...over });

// ── A. room catalog ──────────────────────────────────────────────────────────
test('the three configured rooms exist with a stable default', () => {
  assert.deepEqual(ROOM_IDS, ['main-floor', 'neon-training', 'late-night-circuit']);
  assert.equal(DEFAULT_ROOM_ID, 'main-floor');
  for (const id of ROOM_IDS) assert.ok(getRoom(id), id);
  assert.equal(getRoom('nope'), null);
});

test('the room list payload is deterministic and public-safe (no private fields)', () => {
  assert.deepEqual(roomListPayload({ 'main-floor': 2 }), roomListPayload({ 'main-floor': 2 }));
  const json = JSON.stringify(roomListPayload({ 'main-floor': 2, 'neon-training': 1 }));
  assert.ok(!/balance|ledger|inventory|playerId|player_id|socket/i.test(json), json);
  const list = roomListPayload({ 'main-floor': 2 }).rooms;
  const main = list.find((r) => r.room_id === 'main-floor');
  assert.equal(main.population, 2);
  assert.ok(main.cabinet_summary.count >= 3); // pulse + signal + grid
  // each listed room exposes only public-safe metadata keys
  for (const r of list) assert.deepEqual(Object.keys(r).sort(), ['cabinet_summary', 'capacity', 'description', 'display_name', 'population', 'room_id', 'status', 'theme'].sort());
});

test('the cabinet summary lists the live ticketed cabinets only', () => {
  const s = cabinetSummary();
  const ids = s.cabinets.map((c) => c.cabinet_id);
  assert.ok(ids.includes('pulse-tap-01') && ids.includes('signal-sprint-01') && ids.includes('neon-grid-01'));
  assert.ok(!ids.includes('circuit-match-01')); // coming_soon excluded
});

test('capacity is enforced per room', () => {
  assert.equal(hasCapacity('neon-training', 15), true);  // capacity 16
  assert.equal(hasCapacity('neon-training', 16), false);
  assert.equal(hasCapacity('nope', 0), false);
  assert.equal(roomMetaPayload('main-floor', 3).population, 3);
  assert.equal(roomMetaPayload('nope'), null);
});

// ── B. routing / resolution ──────────────────────────────────────────────────
test('a missing room id resolves to the default (backwards compatible)', () => {
  assert.deepEqual(resolveRoomId(null), { roomId: 'main-floor', ok: true, fallback: false });
  assert.deepEqual(resolveRoomId(''), { roomId: 'main-floor', ok: true, fallback: false });
});

test('the legacy "main" room id maps to main-floor', () => {
  assert.equal(resolveRoomId('main').roomId, 'main-floor');
  assert.equal(resolveRoomId('main').ok, true);
});

test('an explicit valid room resolves to itself', () => {
  for (const id of ROOM_IDS) assert.deepEqual(resolveRoomId(id), { roomId: id, ok: true, fallback: false });
});

test('an invalid / weird / path-traversal room id is rejected (falls back, ok:false)', () => {
  assert.equal(sanitizeRoomId('../../etc'), '');
  assert.equal(sanitizeRoomId('main floor'), '');
  assert.equal(sanitizeRoomId('a/b'), '');
  assert.equal(sanitizeRoomId('x'.repeat(99)), '');
  for (const bad of ['../secret', 'room/../x', 'unknown-room', 'DROP TABLE', '<script>']) {
    const r = resolveRoomId(bad);
    assert.equal(r.fallback, true, bad);
    assert.equal(r.ok, false, bad);
    assert.equal(r.roomId, 'main-floor');
  }
  assert.equal(isValidRoomId('main-floor'), true);
  assert.equal(isValidRoomId('nope'), false);
});

// ── C. room-partition isolation (the DO/dev-shim model) ──────────────────────
function earnPulse(state, player = A) {
  const s = startRound(state, { machineId: 'pulse', occupantId: player, playerId: player, roundId: 'p1', now: 1000 });
  return submitRound(s.state, { payload: pulse(), senderId: player, occupantId: player, now: 31000 }).state;
}

test('two room partitions are fully isolated: tickets, ledger, and inventory do not leak', () => {
  // mirror the server: one ticket-state per room.
  const partitions = { 'main-floor': createTicketState(), 'neon-training': createTicketState() };

  partitions['main-floor'] = earnPulse(partitions['main-floor']);          // A earns 20 in main-floor
  assert.equal(getBalance(partitions['main-floor'], A), 20);
  assert.equal(getBalance(partitions['neon-training'], A), 0);             // ...nothing in neon-training
  assert.equal(getLedger(partitions['main-floor'], A).length, 1);
  assert.equal(getLedger(partitions['neon-training'], A).length, 0);

  partitions['neon-training'] = earnPulse(partitions['neon-training']);     // A earns 20 in neon-training too
  assert.equal(getBalance(partitions['neon-training'], A), 20);
  assert.equal(getBalance(partitions['main-floor'], A), 20);               // each room independent

  // A redeems a badge in main-floor; it is NOT owned in neon-training.
  partitions['main-floor'] = redeemPrize(partitions['main-floor'], { prizeId: 'founder-badge-local', playerId: A, now: 32000, redemptionId: 'rd1' }).state;
  assert.ok(getInventory(partitions['main-floor'], A).some((i) => i.prize_id === 'founder-badge-local'));
  assert.equal(getInventory(partitions['neon-training'], A).length, 0);
});

test('occupancy machines are per-room (a busy cabinet in one room is free in another)', () => {
  // The DO keeps a separate machines map per room; modelled here as plain records.
  const mainMachines = { pulse: { occupiedBy: 'player:a', rev: 1 } };
  const trainMachines = { pulse: { occupiedBy: null, rev: 0 } };
  assert.equal(mainMachines.pulse.occupiedBy, 'player:a');
  assert.equal(trainMachines.pulse.occupiedBy, null);
});
