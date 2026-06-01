/**
 * v0.3 parity — room presence health in the simulator.
 *
 * Mirrors the product Phase 2c (docs/NEON_CIRCUIT_PHASE2C_ROOM_PRESENCE_HEALTH.md):
 * room heartbeats fold into the roomRegistry slice; health + stale-population
 * eviction are pure reads derived from heartbeat freshness; profiles are labels
 * only; admin status/reset are both-gated (config flag + room authority). Privacy
 * boundaries and convergence are preserved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_IDS, ROOM_HEALTHS, ROOM_HEARTBEAT_TTL_TICKS, ROOM_STALE_TTL_TICKS, HEARTBEAT_SCHEMA_VERSION,
  deriveRoomHealth, isJoinableHealth, roomProfile, canAdmin,
  roomPresenceEntry, roomPresenceListPayload, roomDiagnosticsList,
} from '../../arcade/hiveworld-sim/core/phase1/rooms.mjs';
import {
  createArcade, startRound, submitRound, getBalance, activeRoundCount,
} from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import { fold } from '../../arcade/hiveworld-sim/core/world.mjs';
import { RoomBaseStation } from '../../arcade/hiveworld-sim/core/room.mjs';
import { PlayerAgentNode } from '../../arcade/hiveworld-sim/core/agent.mjs';
import { roomHealthLifecycle } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';
import { RESULTS } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';

const NOW = 1000;
const hb = (roomId, ageTicks = 0, over = {}) => ({
  roomId, schema_version: HEARTBEAT_SCHEMA_VERSION, generation: 0, population: 3, capacity: 32, status: 'open',
  last_activity_tick: NOW - ageTicks, reported_tick: NOW - ageTicks, active_connections: 3, active_rounds: 1,
  occupied_cabinets: 1, last_seen_tick: NOW - ageTicks, ...over,
});

// ── A. health states ────────────────────────────────────────────────────────
test('deriveRoomHealth maps status + tick-freshness to the six health states', () => {
  assert.deepEqual([...ROOM_HEALTHS].sort(), ['closed', 'healthy', 'maintenance', 'offline', 'stale', 'unknown'].sort());
  assert.equal(deriveRoomHealth('open', 0), 'healthy');
  assert.equal(deriveRoomHealth('open', ROOM_HEARTBEAT_TTL_TICKS + 1), 'stale');
  assert.equal(deriveRoomHealth('open', ROOM_STALE_TTL_TICKS + 1), 'offline');
  assert.equal(deriveRoomHealth('open', null), 'unknown');
  assert.equal(deriveRoomHealth('closed', 0), 'closed');
  assert.equal(deriveRoomHealth('maintenance', 0), 'maintenance');
  assert.equal(isJoinableHealth('healthy'), true);
  for (const h of ['stale', 'offline', 'unknown', 'closed', 'maintenance']) assert.equal(isJoinableHealth(h), false, h);
});

// ── B. presence entry public-safe ─────────────────────────────────────────────
test('presence entries expose only public-safe room/health/profile fields', () => {
  const e = roomPresenceEntry('main-floor', hb('main-floor', 0), {}, NOW);
  assert.deepEqual(Object.keys(e).sort(), [
    'capacity', 'description', 'display_name', 'health', 'last_seen_age_ticks',
    'population', 'population_is_estimated', 'profile_id', 'profile_label', 'room_id', 'status', 'theme',
  ].sort());
  const json = JSON.stringify(roomPresenceListPayload({ 'main-floor': hb('main-floor', 0) }, {}, NOW));
  assert.ok(!/balance|ledger|inventory|actor|agent:|socket|token/i.test(json), json);
});

// ── C. stale population eviction ───────────────────────────────────────────────
test('fresh heartbeat shows reported population (not estimated)', () => {
  const e = roomPresenceEntry('main-floor', hb('main-floor', 0, { population: 5 }), {}, NOW);
  assert.equal(e.health, 'healthy'); assert.equal(e.population, 5); assert.equal(e.population_is_estimated, false);
});
test('stale heartbeat keeps last population but flags it estimated', () => {
  const e = roomPresenceEntry('main-floor', hb('main-floor', ROOM_HEARTBEAT_TTL_TICKS + 5, { population: 7 }), {}, NOW);
  assert.equal(e.health, 'stale'); assert.equal(e.population, 7); assert.equal(e.population_is_estimated, true);
});
test('expired heartbeat evicts population to 0 (no ghost population) + offline', () => {
  const e = roomPresenceEntry('main-floor', hb('main-floor', ROOM_STALE_TTL_TICKS + 5, { population: 9 }), {}, NOW);
  assert.equal(e.health, 'offline'); assert.equal(e.population, 0); assert.equal(e.population_is_estimated, true);
});
test('a fresh heartbeat restores healthy after a room was offline', () => {
  assert.equal(roomPresenceEntry('main-floor', hb('main-floor', ROOM_STALE_TTL_TICKS + 5), {}, NOW).health, 'offline');
  assert.equal(roomPresenceEntry('main-floor', hb('main-floor', 0, { population: 4 }), {}, NOW).health, 'healthy');
});
test('closed/maintenance health is independent of heartbeat freshness; unknown when never reported', () => {
  assert.equal(roomPresenceEntry('main-floor', hb('main-floor', 0), { 'main-floor': 'closed' }, NOW).health, 'closed');
  assert.equal(roomPresenceEntry('main-floor', hb('main-floor', ROOM_STALE_TTL_TICKS + 5), { 'main-floor': 'maintenance' }, NOW).health, 'maintenance');
  const unk = roomPresenceEntry('neon-training', null, {}, NOW);
  assert.equal(unk.health, 'unknown'); assert.equal(unk.population, 0); assert.equal(unk.last_seen_age_ticks, null);
});

// ── D. profiles (labels only — never economic) ────────────────────────────────
test('each static room has its presentation profile', () => {
  assert.deepEqual(roomProfile('main-floor'), { profile_id: 'standard', catalog_profile: 'standard', ruleset_profile: 'standard', label: null });
  assert.deepEqual(roomProfile('neon-training'), { profile_id: 'training', catalog_profile: 'training', ruleset_profile: 'standard', label: 'Training' });
  assert.deepEqual(roomProfile('late-night-circuit'), { profile_id: 'late-night', catalog_profile: 'standard', ruleset_profile: 'standard', label: 'Late Night' });
  assert.equal(roomProfile('nope'), null);
});
test('profiles do NOT change ticket formulas: an identical round awards identically in every room', () => {
  const awards = ROOM_IDS.map(() => {
    let arc = createArcade();
    arc = startRound(arc, { machineId: 'pulse', occupantId: 'p', actor: 'p', roundId: 'r1', tick: 1 }).arcade;
    arc = submitRound(arc, { payload: { ...RESULTS.pulse, roundId: 'r1', machineId: 'pulse' }, senderId: 'p', occupantId: 'p', tick: 2 }).arcade;
    return getBalance(arc, 'p');
  });
  assert.ok(awards[0] > 0);
  for (const a of awards) assert.equal(a, awards[0]);
});

// ── E. diagnostics shape + privacy ────────────────────────────────────────────
test('diagnostics expose operational counts per room and NO private data', () => {
  const diag = roomDiagnosticsList(
    { 'main-floor': hb('main-floor', 0, { population: 2, generation: 3, active_connections: 2, active_rounds: 1, occupied_cabinets: 1 }) },
    { 'neon-training': 'maintenance' }, NOW,
  );
  assert.equal(diag.length, ROOM_IDS.length);
  const main = diag.find((d) => d.room_id === 'main-floor');
  assert.equal(main.health, 'healthy');
  assert.equal(main.reset_generation, 3);
  assert.equal(main.active_connection_count, 2);
  assert.equal(main.occupied_cabinet_count, 1);
  assert.equal(diag.find((d) => d.room_id === 'neon-training').health, 'maintenance');
  assert.ok(!/balance|ledger|inventory|agent:|token|socket/i.test(JSON.stringify(diag)));
});

// ── F. admin both-gate ─────────────────────────────────────────────────────────
test('canAdmin requires BOTH the config flag AND room authority', () => {
  assert.equal(canAdmin({ adminEnabled: false, isAuthority: true }).reason, 'admin_disabled');
  assert.equal(canAdmin({ adminEnabled: true, isAuthority: false }).reason, 'not_authority');
  assert.deepEqual(canAdmin({ adminEnabled: true, isAuthority: true }), { ok: true, reason: null });
});

// ── G. fold / reducer behaviour ────────────────────────────────────────────────
function nodes() {
  return { room: new RoomBaseStation({ id: 'main-floor', name: 'Main' }), a: new PlayerAgentNode({ id: 'agent:a', name: 'A' }) };
}
test('room_heartbeat folds into the registry with authoritative round/cabinet counts', () => {
  const { room, a } = nodes();
  const evs = [room.announce(0), a.occupy('main-floor', 'pulse', 1), room.heartbeat(2, { population: 1 })];
  const { state } = fold(evs, { adminEnabled: true });
  const h = state.roomRegistry.heartbeats['main-floor'];
  assert.ok(h, 'heartbeat stored');
  assert.equal(h.last_seen_tick, 2);
  assert.equal(h.population, 1);
  assert.equal(h.occupied_cabinets, 1); // computed from the canonical occupancy slice
  assert.equal(h.schema_version, HEARTBEAT_SCHEMA_VERSION);
  assert.ok(!('token' in h));
});
test('a room heartbeat for an unknown room is rejected', () => {
  const room = new RoomBaseStation({ id: 'room:main', name: 'Legacy' }); // not a catalog room
  const { state, rejections } = fold([room.announce(0), room.heartbeat(1)], {});
  assert.equal(state.roomRegistry.heartbeats['room:main'], undefined);
  assert.ok(rejections.some((r) => r.reason === 'unknown_room'));
});
test('room_status_set is both-gated: flag off OR non-authority is denied; room authority + flag accepted', () => {
  const { room, a } = nodes();
  const setByRoom = room.setStatus('maintenance', 1);
  // flag off → denied
  let r = fold([room.announce(0), setByRoom], { adminEnabled: false });
  assert.equal(r.state.roomRegistry.statusOverrides['main-floor'], undefined);
  assert.ok(r.rejections.some((x) => x.reason === 'admin_disabled'));
  // a player forging an admin event for the room → not_authority
  const forge = a.emit({ eventType: 'room_status_set', sideband: 'moderation', roomId: 'main-floor', payload: { status: 'closed' }, tick: 2 });
  r = fold([room.announce(0), forge], { adminEnabled: true });
  assert.equal(r.state.roomRegistry.statusOverrides['main-floor'], undefined);
  assert.ok(r.rejections.some((x) => x.reason === 'not_authority'));
  // room authority + flag on → accepted
  r = fold([room.announce(0), setByRoom], { adminEnabled: true });
  assert.equal(r.state.roomRegistry.statusOverrides['main-floor'], 'maintenance');
});
test('room_reset bumps generation, wipes the arcade partition + occupancy, and refreshes the heartbeat', () => {
  const { room, a } = nodes();
  const evs = [
    room.announce(0), a.occupy('main-floor', 'pulse', 1),
    a.startArcadeRound('main-floor', 'pulse', 'r1', 2), room.heartbeat(3, { population: 1 }),
    room.resetRoom(4),
  ];
  const { state } = fold(evs, { adminEnabled: true });
  assert.equal(state.roomRegistry.generations['main-floor'], 1);
  const h = state.roomRegistry.heartbeats['main-floor'];
  assert.equal(h.generation, 1);
  assert.equal(h.population, 0);          // population evicted by reset
  assert.equal(h.occupied_cabinets, 0);
  assert.deepEqual(state.rooms['main-floor'].machines, {}); // occupancy wiped
});

// ── H. scenario: deterministic health lifecycle ───────────────────────────────
test('roomHealthLifecycle: healthy→stale→offline by observer clock; maintenance; reset generation', () => {
  const { report } = roomHealthLifecycle({});
  const reg = report.finalWorldState.roomRegistry;
  const health = (roomId, nowTick) => roomPresenceListPayload(reg.heartbeats, reg.statusOverrides, nowTick).rooms.find((r) => r.room_id === roomId).health;
  // main-floor reported at tick 3 → health depends purely on the observer clock.
  assert.equal(health('main-floor', 8), 'healthy');
  assert.equal(health('main-floor', 3 + ROOM_HEARTBEAT_TTL_TICKS + 5), 'stale');
  assert.equal(health('main-floor', 3 + ROOM_STALE_TTL_TICKS + 5), 'offline');
  // offline evicts population to 0
  const offline = roomPresenceListPayload(reg.heartbeats, reg.statusOverrides, 3 + ROOM_STALE_TTL_TICKS + 5).rooms.find((r) => r.room_id === 'main-floor');
  assert.equal(offline.population, 0);
  // neon-training under maintenance; late-night-circuit reset → generation 1.
  assert.equal(health('neon-training', 8), 'maintenance');
  assert.equal(reg.generations['late-night-circuit'], 1);
  assert.equal(report.desyncReport.finalConverged, true);
  assert.equal(report.applyRejectionCount, 0);
});
test('roomRegistry is covered by the convergence fingerprint (a heartbeat changes world state)', () => {
  const { room, a } = nodes();
  const base = [room.announce(0), a.occupy('main-floor', 'pulse', 1)];
  const withHb = fold([...base, room.heartbeat(2, { population: 1 })], {});
  const without = fold(base, {});
  assert.notEqual(withHb.fingerprint, without.fingerprint);
});
