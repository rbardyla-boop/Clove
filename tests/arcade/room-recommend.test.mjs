/**
 * Phase 2d — room presence UX helpers (pure, client-side derivations of the public
 * Phase 2c room-presence list). Activity summaries, recommendations, presence-driven
 * sorting, and recovery hints. No server authority, no private data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isJoinable, roomActivity, recommendRooms, sortRoomsForLobby, roomRecoveryHint,
} from '../../arcade/room-recommend.mjs';

// A public room-list entry as the lobby receives it (Phase 2c presence shape).
const room = (over = {}) => ({
  room_id: 'r', display_name: 'R', description: '', status: 'open', health: 'healthy',
  capacity: 32, population: 0, population_is_estimated: false, theme: 'neon',
  profile_id: 'standard', profile_label: null, ...over,
});

// ── isJoinable ─────────────────────────────────────────────────────────────────
test('only an open room is joinable; stale/offline stay joinable (open), closed/maint do not', () => {
  assert.equal(isJoinable(room({ status: 'open', health: 'healthy' })), true);
  assert.equal(isJoinable(room({ status: 'open', health: 'stale' })), true);
  assert.equal(isJoinable(room({ status: 'open', health: 'offline' })), true);
  assert.equal(isJoinable(room({ status: 'closed' })), false);
  assert.equal(isJoinable(room({ status: 'maintenance' })), false);
});

// ── roomActivity ─────────────────────────────────────────────────────────────────
test('activity is derived from public health + population/capacity only', () => {
  assert.equal(roomActivity(room({ status: 'closed' })).level, 'closed');
  assert.equal(roomActivity(room({ status: 'maintenance' })).level, 'maintenance');
  assert.equal(roomActivity(room({ health: 'offline' })).level, 'offline');
  assert.equal(roomActivity(room({ health: 'stale' })).level, 'stale');
  assert.equal(roomActivity(room({ health: 'unknown' })).level, 'unknown');
  assert.equal(roomActivity(room({ health: 'healthy', population: 0 })).level, 'empty');
  assert.equal(roomActivity(room({ health: 'healthy', population: 1, capacity: 32 })).level, 'active');
  assert.equal(roomActivity(room({ health: 'healthy', population: 4, capacity: 32 })).level, 'lively');
  assert.equal(roomActivity(room({ health: 'healthy', population: 28, capacity: 32 })).level, 'busy');
  // a small-capacity room hits "busy" by ratio, not just absolute count
  assert.equal(roomActivity(room({ health: 'healthy', population: 13, capacity: 16 })).level, 'busy');
});
test('activity never leaks private data', () => {
  const json = JSON.stringify(roomActivity(room({ health: 'healthy', population: 5 })));
  assert.ok(!/balance|ledger|inventory|player|actor|token|occupied/i.test(json), json);
});

// ── recommendRooms ───────────────────────────────────────────────────────────────
const sample = () => [
  room({ room_id: 'main-floor', health: 'healthy', population: 5, capacity: 32, profile_id: 'standard' }),
  room({ room_id: 'neon-training', health: 'healthy', population: 1, capacity: 16, profile_id: 'training', profile_label: 'Training' }),
  room({ room_id: 'late-night-circuit', health: 'healthy', population: 0, capacity: 32, profile_id: 'late-night' }),
];
test('busiest recommends the most-populated healthy open room, excluding the current room', () => {
  const { busiest } = recommendRooms(sample(), { currentRoomId: 'neon-training' });
  assert.equal(busiest.room_id, 'main-floor');
  // if the busiest IS the current room, it is not re-recommended
  const r2 = recommendRooms(sample(), { currentRoomId: 'main-floor' });
  assert.notEqual(r2.busiest && r2.busiest.room_id, 'main-floor');
  assert.equal(r2.busiest.room_id, 'neon-training'); // next most-populated healthy
});
test('training recommends the training-profile room when joinable', () => {
  assert.equal(recommendRooms(sample(), {}).training.room_id, 'neon-training');
  // a training room under maintenance is not recommended
  const closedTraining = sample().map((r) => (r.profile_id === 'training' ? { ...r, status: 'maintenance' } : r));
  assert.equal(recommendRooms(closedTraining, {}).training, null);
});
test('revive recommends a healthy but empty room to kick-start', () => {
  assert.equal(recommendRooms(sample(), {}).revive.room_id, 'late-night-circuit');
});
test('recommendations never target closed/maintenance/non-joinable rooms', () => {
  const allClosed = sample().map((r) => ({ ...r, status: 'closed' }));
  const rec = recommendRooms(allClosed, {});
  assert.equal(rec.busiest, null);
  assert.equal(rec.training, null);
  assert.equal(rec.revive, null);
});
test('a full healthy room is not recommended as busiest', () => {
  const full = [room({ room_id: 'main-floor', health: 'healthy', population: 32, capacity: 32 })];
  assert.equal(recommendRooms(full, {}).busiest, null);
});
test('recommendations are deterministic for a given list', () => {
  assert.deepEqual(recommendRooms(sample(), { currentRoomId: 'x' }), recommendRooms(sample(), { currentRoomId: 'x' }));
});

// ── sortRoomsForLobby ────────────────────────────────────────────────────────────
test('sorting puts active healthy first, then empty, then degraded, then closed/maint', () => {
  const rooms = [
    room({ room_id: 'closed1', status: 'closed' }),
    room({ room_id: 'offline1', health: 'offline', population: 9 }),
    room({ room_id: 'empty1', health: 'healthy', population: 0 }),
    room({ room_id: 'busy1', health: 'healthy', population: 10 }),
    room({ room_id: 'stale1', health: 'stale', population: 4 }),
    room({ room_id: 'active1', health: 'healthy', population: 2 }),
  ];
  const order = sortRoomsForLobby(rooms).map((r) => r.room_id);
  assert.deepEqual(order, ['busy1', 'active1', 'empty1', 'stale1', 'offline1', 'closed1']);
  // input is not mutated
  assert.equal(rooms[0].room_id, 'closed1');
});

// ── roomRecoveryHint ─────────────────────────────────────────────────────────────
test('recovery hints are actionable for joinable degraded/empty rooms only', () => {
  assert.match(roomRecoveryHint(room({ health: 'offline' })), /wake it up/i);
  assert.match(roomRecoveryHint(room({ health: 'stale' })), /quiet/i);
  assert.match(roomRecoveryHint(room({ health: 'healthy', population: 0 })), /be the first/i);
  assert.equal(roomRecoveryHint(room({ health: 'healthy', population: 5 })), null); // active → no hint
  assert.equal(roomRecoveryHint(room({ status: 'maintenance' })), null);           // not joinable → no hint
  assert.equal(roomRecoveryHint(room({ status: 'closed' })), null);
});
