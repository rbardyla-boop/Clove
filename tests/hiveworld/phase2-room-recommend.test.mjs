/**
 * v0.4 parity — smart-lobby presence UX in the simulator.
 *
 * Mirrors product Phase 2d (arcade/room-recommend.mjs). The recommendation/activity/
 * sort/recovery helpers are PURE derivations of the v0.3 public room-presence list —
 * proven here to read ONLY public room health/population/profile fields and to expose
 * no private state. Also proven against a deterministic simulator scenario whose
 * presence list is the canonical fold of a heartbeat log.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isJoinable, roomActivity, recommendRooms, sortRoomsForLobby, roomRecoveryHint,
} from '../../arcade/hiveworld-sim/core/phase1/room-recommend.mjs';
import { roomPresenceListPayload } from '../../arcade/hiveworld-sim/core/phase1/rooms.mjs';
import { roomRecommendationShowcase } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';
import { PRIVATE_FIELD_RE } from '../../arcade/hiveworld-sim/core/phase1/sideband-map.mjs';

const room = (over = {}) => ({
  room_id: 'r', display_name: 'R', description: '', status: 'open', health: 'healthy',
  capacity: 32, population: 0, population_is_estimated: false, theme: 'neon',
  profile_id: 'standard', profile_label: null, ...over,
});

// ── pure helpers (mirror the product unit tests) ──────────────────────────────────
test('only an open room is joinable; stale/offline stay joinable, closed/maint do not', () => {
  assert.equal(isJoinable(room({ status: 'open', health: 'stale' })), true);
  assert.equal(isJoinable(room({ status: 'closed' })), false);
  assert.equal(isJoinable(room({ status: 'maintenance' })), false);
});

test('activity is derived from public health + population/capacity only', () => {
  assert.equal(roomActivity(room({ status: 'closed' })).level, 'closed');
  assert.equal(roomActivity(room({ status: 'maintenance' })).level, 'maintenance');
  assert.equal(roomActivity(room({ health: 'offline' })).level, 'offline');
  assert.equal(roomActivity(room({ health: 'stale' })).level, 'stale');
  assert.equal(roomActivity(room({ health: 'unknown' })).level, 'unknown');
  assert.equal(roomActivity(room({ population: 0 })).level, 'empty');
  assert.equal(roomActivity(room({ population: 1 })).level, 'active');
  assert.equal(roomActivity(room({ population: 4 })).level, 'lively');
  assert.equal(roomActivity(room({ population: 28 })).level, 'busy');
  assert.equal(roomActivity(room({ population: 13, capacity: 16 })).level, 'busy'); // by ratio
});

const sample = () => [
  room({ room_id: 'main-floor', population: 5, capacity: 32, profile_id: 'standard' }),
  room({ room_id: 'neon-training', population: 1, capacity: 16, profile_id: 'training', profile_label: 'Training' }),
  room({ room_id: 'late-night-circuit', population: 0, capacity: 32, profile_id: 'late-night' }),
];
test('busiest recommends the most-populated healthy open room, excluding current', () => {
  assert.equal(recommendRooms(sample(), { currentRoomId: 'neon-training' }).busiest.room_id, 'main-floor');
  assert.equal(recommendRooms(sample(), { currentRoomId: 'main-floor' }).busiest.room_id, 'neon-training');
});
test('training recommends the training-profile room; revive picks a healthy empty room', () => {
  assert.equal(recommendRooms(sample(), {}).training.room_id, 'neon-training');
  assert.equal(recommendRooms(sample(), {}).revive.room_id, 'late-night-circuit');
});
test('recommendations never target closed/maintenance or full rooms', () => {
  const allClosed = sample().map((r) => ({ ...r, status: 'closed' }));
  assert.deepEqual(recommendRooms(allClosed, {}), { busiest: null, training: null, revive: null });
  const full = [room({ room_id: 'main-floor', population: 32, capacity: 32 })];
  assert.equal(recommendRooms(full, {}).busiest, null);
});
test('recommendations are deterministic', () => {
  assert.deepEqual(recommendRooms(sample(), { currentRoomId: 'x' }), recommendRooms(sample(), { currentRoomId: 'x' }));
});

test('sorting: active healthy first, then empty, then degraded, then closed/maint (no mutation)', () => {
  const rooms = [
    room({ room_id: 'closed1', status: 'closed' }),
    room({ room_id: 'offline1', health: 'offline', population: 9 }),
    room({ room_id: 'empty1', population: 0 }),
    room({ room_id: 'busy1', population: 10 }),
    room({ room_id: 'stale1', health: 'stale', population: 4 }),
    room({ room_id: 'active1', population: 2 }),
  ];
  assert.deepEqual(sortRoomsForLobby(rooms).map((r) => r.room_id), ['busy1', 'active1', 'empty1', 'stale1', 'offline1', 'closed1']);
  assert.equal(rooms[0].room_id, 'closed1');
});

test('recovery hints are actionable for joinable degraded/empty rooms only', () => {
  assert.match(roomRecoveryHint(room({ health: 'offline' })), /wake it up/i);
  assert.match(roomRecoveryHint(room({ health: 'stale' })), /quiet/i);
  assert.match(roomRecoveryHint(room({ population: 0 })), /be the first/i);
  assert.equal(roomRecoveryHint(room({ population: 5 })), null);
  assert.equal(roomRecoveryHint(room({ status: 'maintenance' })), null);
});

// ── privacy: recommendations read only public presence fields ─────────────────────
test('activity + recommendation outputs carry no private state', () => {
  const json = JSON.stringify({ a: roomActivity(sample()[0]), r: recommendRooms(sample(), {}), s: sortRoomsForLobby(sample()) });
  assert.equal(PRIVATE_FIELD_RE.test(json), false);
  assert.ok(!/agent:|token|occupied_cabinet|active_connection/i.test(json), json);
});

// ── scenario-derived: recommendations from the canonical fold's presence list ─────
test('roomRecommendationShowcase: recommendations derive purely from the folded presence list', () => {
  const { report } = roomRecommendationShowcase({});
  const reg = report.finalWorldState.roomRegistry;
  // heartbeats were reported at tick 2; observe at tick 5 (fresh → all healthy).
  const presence = roomPresenceListPayload(reg.heartbeats, reg.statusOverrides, 5).rooms;
  const byId = (id) => presence.find((r) => r.room_id === id);
  assert.equal(byId('main-floor').health, 'healthy');
  assert.equal(byId('main-floor').population, 5);

  const rec = recommendRooms(presence, { currentRoomId: 'neon-training' });
  assert.equal(rec.busiest.room_id, 'main-floor');       // busiest healthy, excluding current
  assert.equal(rec.training.room_id, 'neon-training');   // training profile
  assert.equal(rec.revive.room_id, 'late-night-circuit'); // healthy + empty

  assert.deepEqual(sortRoomsForLobby(presence).map((r) => r.room_id), ['main-floor', 'neon-training', 'late-night-circuit']);
  assert.equal(roomActivity(byId('main-floor')).level, 'lively');
  assert.equal(roomActivity(byId('late-night-circuit')).level, 'empty');

  // the presence list that feeds recommendations is itself public-safe + deterministic
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify(presence)), false);
  assert.equal(report.desyncReport.finalConverged, true);
  assert.equal(roomRecommendationShowcase({}).report.canonicalFingerprint, report.canonicalFingerprint);
});
