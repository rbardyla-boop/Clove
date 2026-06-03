/**
 * Phase 2c — room presence health, stale-population eviction, and room profiles.
 *
 * These exercise the PURE registry/room model in rooms.mjs (the same code the
 * RoomRegistry DO + dev shim call) plus the round-authority heartbeat helper, so
 * staleness, health derivation, the eviction policy, profiles, and the admin
 * diagnostics shape are all deterministic and transport-agnostic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_IDS,
  ROOM_HEARTBEAT_TTL_MS, ROOM_STALE_TTL_MS, HEARTBEAT_SCHEMA_VERSION, ROOM_HEALTHS,
  deriveRoomHealth, isJoinableHealth, roomProfile,
  roomPresenceEntry, roomPresenceListPayload, roomDiagnosticsList,
} from '../../workers/arcade/src/rooms.mjs';
import { createTicketState, startRound, submitRound, getBalance, activeRoundCount } from '../../workers/arcade/src/round-authority.mjs';

const NOW = 1_000_000_000_000;
/** Build a heartbeat as a room DO would, stamped `last_seen_at = NOW - ageMs`. */
const hb = (roomId, ageMs = 0, over = {}) => ({
  roomId, schema_version: HEARTBEAT_SCHEMA_VERSION, generation: 0, population: 3, capacity: 32,
  status: 'open', last_activity_at: NOW - ageMs, reported_at: NOW - ageMs,
  active_connections: 3, active_rounds: 1, occupied_cabinets: 1, last_seen_at: NOW - ageMs, ...over,
});
const pulse = (over = {}) => ({ roundId: 'p1', machineId: 'pulse', grade: 'A', score: 1825, accuracy: 88, hits: 16, bestStreak: 9, durationMs: 30000, ...over });

// ── A. heartbeat freshness + public-safe presence fields ───────────────────────
test('the presence entry exposes only public-safe room/health/profile fields', () => {
  const e = roomPresenceEntry('main-floor', hb('main-floor', 0), {}, NOW);
  assert.deepEqual(Object.keys(e).sort(), [
    'cabinet_summary', 'capacity', 'description', 'display_name', 'health',
    'last_seen_age_ms', 'population', 'population_is_estimated', 'profile_id',
    'profile_label', 'room_id', 'status', 'theme',
  ].sort());
  const json = JSON.stringify(roomPresenceListPayload({ 'main-floor': hb('main-floor', 0) }, {}, NOW));
  assert.ok(!/balance|ledger|inventory|player|socket|token|connection/i.test(json), json);
});

test('the presence list carries the heartbeat schema version + a deterministic room order', () => {
  const list = roomPresenceListPayload({}, {}, NOW);
  assert.equal(list.schema_version, HEARTBEAT_SCHEMA_VERSION);
  assert.deepEqual(list.rooms.map((r) => r.room_id), [...ROOM_IDS]);
});

test('activeRoundCount counts only live (active, unexpired) rounds', () => {
  assert.equal(activeRoundCount(createTicketState(), NOW), 0);
  const s = startRound(createTicketState(), { machineId: 'pulse', occupantId: 'p', playerId: 'p', roundId: 'r1', now: NOW });
  assert.equal(activeRoundCount(s.state, NOW), 1);
  // a round past its expiry no longer counts
  assert.equal(activeRoundCount(s.state, NOW + 10 * 60_000), 0);
});

// ── B. stale population eviction ───────────────────────────────────────────────
test('a fresh heartbeat shows the reported population (not estimated)', () => {
  const e = roomPresenceEntry('main-floor', hb('main-floor', 0, { population: 5 }), {}, NOW);
  assert.equal(e.health, 'healthy');
  assert.equal(e.population, 5);
  assert.equal(e.population_is_estimated, false);
});

test('a stale heartbeat keeps last population but flags it estimated', () => {
  const ageMs = ROOM_HEARTBEAT_TTL_MS + 5_000; // 35s → stale
  const e = roomPresenceEntry('main-floor', hb('main-floor', ageMs, { population: 7 }), {}, NOW);
  assert.equal(e.health, 'stale');
  assert.equal(e.population, 7);
  assert.equal(e.population_is_estimated, true);
});

test('an expired heartbeat evicts population to 0 (no ghost population) + health offline', () => {
  const ageMs = ROOM_STALE_TTL_MS + 5_000; // 95s → offline
  const e = roomPresenceEntry('main-floor', hb('main-floor', ageMs, { population: 9 }), {}, NOW);
  assert.equal(e.health, 'offline');
  assert.equal(e.population, 0);
  assert.equal(e.population_is_estimated, true);
});

test('a fresh heartbeat restores healthy after a room was stale', () => {
  const stale = roomPresenceEntry('main-floor', hb('main-floor', ROOM_STALE_TTL_MS + 1000), {}, NOW);
  assert.equal(stale.health, 'offline');
  const fresh = roomPresenceEntry('main-floor', hb('main-floor', 0, { population: 4 }), {}, NOW);
  assert.equal(fresh.health, 'healthy');
  assert.equal(fresh.population, 4);
});

test('closed/maintenance health is independent of heartbeat freshness', () => {
  // even with a fresh heartbeat, an admin status override wins for health
  const closed = roomPresenceEntry('main-floor', hb('main-floor', 0), { 'main-floor': 'closed' }, NOW);
  assert.equal(closed.health, 'closed');
  assert.equal(closed.status, 'closed');
  const maint = roomPresenceEntry('main-floor', hb('main-floor', ROOM_STALE_TTL_MS + 1000), { 'main-floor': 'maintenance' }, NOW);
  assert.equal(maint.health, 'maintenance');
  assert.equal(maint.status, 'maintenance');
});

// ── C. room health states ──────────────────────────────────────────────────────
test('deriveRoomHealth maps status + freshness to the six public health states', () => {
  assert.deepEqual([...ROOM_HEALTHS].sort(), ['closed', 'healthy', 'maintenance', 'offline', 'stale', 'unknown'].sort());
  assert.equal(deriveRoomHealth('open', 0), 'healthy');
  assert.equal(deriveRoomHealth('open', ROOM_HEARTBEAT_TTL_MS + 1), 'stale');
  assert.equal(deriveRoomHealth('open', ROOM_STALE_TTL_MS + 1), 'offline');
  assert.equal(deriveRoomHealth('open', null), 'unknown');
  assert.equal(deriveRoomHealth('closed', 0), 'closed');
  assert.equal(deriveRoomHealth('maintenance', 0), 'maintenance');
  // only a healthy room is joinable on the basis of health
  assert.equal(isJoinableHealth('healthy'), true);
  for (const h of ['stale', 'offline', 'unknown', 'closed', 'maintenance']) assert.equal(isJoinableHealth(h), false, h);
});

test('a room that never reported is unknown with zero estimated population', () => {
  const e = roomPresenceEntry('neon-training', null, {}, NOW);
  assert.equal(e.health, 'unknown');
  assert.equal(e.population, 0);
  assert.equal(e.population_is_estimated, true);
  assert.equal(e.last_seen_age_ms, null);
});

test('health appears in the room list per room', () => {
  const list = roomPresenceListPayload(
    { 'main-floor': hb('main-floor', 0), 'neon-training': hb('neon-training', ROOM_HEARTBEAT_TTL_MS + 1) },
    { 'late-night-circuit': 'maintenance' },
    NOW,
  ).rooms;
  assert.equal(list.find((r) => r.room_id === 'main-floor').health, 'healthy');
  assert.equal(list.find((r) => r.room_id === 'neon-training').health, 'stale');
  assert.equal(list.find((r) => r.room_id === 'late-night-circuit').health, 'maintenance');
});

// ── D. room profiles (presentation only — never alter economics) ────────────────
test('each static room has the configured presentation profile', () => {
  assert.deepEqual(roomProfile('main-floor'), { profile_id: 'standard', catalog_profile: 'standard', ruleset_profile: 'standard', label: null });
  assert.deepEqual(roomProfile('neon-training'), { profile_id: 'training', catalog_profile: 'training', ruleset_profile: 'standard', label: 'Training' });
  assert.deepEqual(roomProfile('late-night-circuit'), { profile_id: 'late-night', catalog_profile: 'standard', ruleset_profile: 'standard', label: 'Late Night' });
  assert.equal(roomProfile('nope'), null);
});

test('profiles surface as labels in presence entries but never as economic knobs', () => {
  const nt = roomPresenceEntry('neon-training', hb('neon-training', 0), {}, NOW);
  assert.equal(nt.profile_id, 'training');
  assert.equal(nt.profile_label, 'Training');
  // a profile entry exposes no multiplier / cost / reward field
  const json = JSON.stringify(nt);
  assert.ok(!/multiplier|cost|reward|bonus|payout|price/i.test(json), json);
});

test('profiles do NOT change ticket formulas: the same round awards the same tickets in every room', () => {
  // Each room is its own ticket-state; the formula is resolved from the cabinet
  // catalog by machine id, independent of room/profile. So an identical Pulse Tap
  // round must award an identical balance in every room.
  const awards = ROOM_IDS.map((roomId) => {
    let s = createTicketState();
    s = startRound(s, { machineId: 'pulse', occupantId: 'p', playerId: 'p', roundId: 'p1', now: NOW }).state;
    s = submitRound(s, { payload: pulse(), senderId: 'p', occupantId: 'p', now: NOW + 30000 }).state;
    return getBalance(s, 'p');
  });
  assert.ok(awards[0] > 0);
  for (const a of awards) assert.equal(a, awards[0]); // identical across training / standard / late-night
});

test('the cabinet summary in every room is deterministic + identical (profiles reorder labels only)', () => {
  const list = roomPresenceListPayload({}, {}, NOW).rooms;
  const summaries = list.map((r) => JSON.stringify(r.cabinet_summary));
  for (const s of summaries) assert.equal(s, summaries[0]);
});

// ── E. admin diagnostics shape + privacy (gating covered in admin.test.mjs) ─────
test('diagnostics expose operational counts per room and NO private data', () => {
  const diag = roomDiagnosticsList(
    { 'main-floor': hb('main-floor', 0, { population: 2, generation: 3, active_connections: 2, active_rounds: 1, occupied_cabinets: 1 }) },
    { 'neon-training': 'maintenance' },
    NOW,
  );
  assert.equal(diag.length, ROOM_IDS.length);
  const main = diag.find((d) => d.room_id === 'main-floor');
  assert.equal(main.health, 'healthy');
  assert.equal(main.population, 2);
  assert.equal(main.reset_generation, 3);
  assert.equal(main.active_connection_count, 2);
  assert.equal(main.active_round_count, 1);
  assert.equal(main.occupied_cabinet_count, 1);
  // maintenance status reflected for a room with no heartbeat
  assert.equal(diag.find((d) => d.room_id === 'neon-training').health, 'maintenance');
  // never any player id / balance / ledger / inventory / token
  assert.ok(!/balance|ledger|inventory|player|token|socket/i.test(JSON.stringify(diag)));
});
