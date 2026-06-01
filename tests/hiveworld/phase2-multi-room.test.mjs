/**
 * Phase 2 parity — multi-room isolation in the simulator.
 *
 * The arcade world slice is partitioned by room (round-authority.mjs
 * createArcadeWorld / arcadeRoom), so tickets / inventory / challenges / feed are
 * isolated per room — and occupancy is already room-keyed. Mirrors the per-room
 * product Durable Objects.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { multiRoomIsolation } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';
import { arcadeRoom, createArcadeWorld, withArcadeRoom, createArcade } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import { ROOM_IDS, roomListPayload, getRoom, isValidRoomId, isJoinableStatus } from '../../arcade/hiveworld-sim/core/phase1/rooms.mjs';

const A = 'agent:a';
const B = 'agent:b';

test('the simulator room catalog mirrors the product (3 rooms, public-safe list)', () => {
  assert.deepEqual(ROOM_IDS, ['main-floor', 'neon-training', 'late-night-circuit']);
  assert.equal(isValidRoomId('neon-training'), true);
  assert.equal(isValidRoomId('nope'), false);
  assert.equal(isJoinableStatus('open'), true);
  assert.equal(isJoinableStatus('closed'), false);
  const json = JSON.stringify(roomListPayload({ 'main-floor': 2 }));
  assert.ok(!/balance|ledger|inventory|playerId/i.test(json));
  assert.equal(getRoom('main-floor').capacity, 32);
});

test('the arcade world slice is a per-room partition; arcadeRoom reads/writes immutably', () => {
  const world = createArcadeWorld();
  assert.deepEqual(world, { rooms: {} });
  // a fresh room reads as an empty substate without mutating the world
  assert.deepEqual(arcadeRoom(world, 'main-floor'), createArcade());
  assert.deepEqual(world, { rooms: {} });
  // writing back is immutable + isolated
  const w2 = withArcadeRoom(world, 'main-floor', { ...createArcade(), balances: { [A]: 20 } });
  assert.equal(arcadeRoom(w2, 'main-floor').balances[A], 20);
  assert.equal(arcadeRoom(w2, 'neon-training').balances[A] || 0, 0);
  assert.deepEqual(world, { rooms: {} }); // original untouched
});

test('tickets, inventory and challenges are isolated per room', () => {
  const { report } = multiRoomIsolation({});
  const main = arcadeRoom(report.finalWorldState.arcade, 'main-floor');
  const train = arcadeRoom(report.finalWorldState.arcade, 'neon-training');

  // A earned 20 in main-floor then redeemed the 10-ticket badge → 10; earned 24 in neon-training.
  assert.equal(main.balances[A], 10);
  assert.equal(train.balances[A], 24);

  // The founder badge A redeemed in main-floor is NOT owned in neon-training.
  assert.ok(Object.values(main.inventory[A]).some((i) => i.prize_id === 'founder-badge-local'));
  assert.equal(train.inventory[A], undefined);

  // Challenge progress is per-room: pulse-rookie in main-floor, first-signal in neon-training.
  assert.equal(main.challengeProgress[A]['pulse-rookie'].completed, true);
  assert.ok(!main.challengeProgress[A]['first-signal'] || !main.challengeProgress[A]['first-signal'].completed);
  assert.equal(train.challengeProgress[A]['first-signal'].completed, true);
});

test('occupancy is per-room: a cabinet busy in one room is free in another', () => {
  const { report } = multiRoomIsolation({});
  const rooms = report.finalWorldState.rooms;
  assert.equal(rooms['main-floor'].machines.pulse.occupiedBy, B);   // B holds Pulse Tap in main-floor
  assert.equal(rooms['neon-training'].machines.pulse?.occupiedBy ?? null, null); // free in neon-training
});

test('the public feed is isolated per room (no cross-room leakage)', () => {
  const { report } = multiRoomIsolation({});
  const mainFeed = JSON.stringify(arcadeRoom(report.finalWorldState.arcade, 'main-floor').feed);
  const trainFeed = JSON.stringify(arcadeRoom(report.finalWorldState.arcade, 'neon-training').feed);
  // main-floor feed has the Pulse Tap award; neon-training feed has the Signal Sprint award.
  assert.ok(/at Pulse Tap/.test(mainFeed));
  assert.ok(/at Signal Sprint/.test(trainFeed));
  // ...and NOT vice-versa (rooms don't see each other's events).
  assert.ok(!/at Signal Sprint/.test(mainFeed));
  assert.ok(!/at Pulse Tap/.test(trainFeed));
});

test('the multi-room scenario converges and is deterministic', () => {
  const r1 = multiRoomIsolation({});
  const r2 = multiRoomIsolation({});
  assert.equal(r1.report.desyncReport.finalConverged, true);
  assert.equal(r1.report.canonicalFingerprint, r2.report.canonicalFingerprint);
});
