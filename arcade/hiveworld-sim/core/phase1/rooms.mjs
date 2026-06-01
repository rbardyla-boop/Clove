/**
 * Phase 2 multi-room catalog — SIMULATOR-LOCAL PORT of workers/arcade/src/rooms.mjs.
 *
 * The product Phase 2a/2b arcade selects among multiple rooms, each a fully
 * ISOLATED state namespace. The simulator mirrors this: occupancy is already keyed
 * by room id, and the `arcade` world slice is partitioned by room (see
 * round-authority.mjs createArcadeWorld / arcadeRoom). This pure module supplies
 * the configured room set + a public-safe room list, used by the multi-room
 * scenarios + tests. No money, no global accounts, no cross-room economy.
 */

export const DEFAULT_ROOM_ID = 'main-floor';

/**
 * v0.3: each room carries a presentation PROFILE (profile_id / catalog_profile /
 * ruleset_profile / profile_label) mirroring the product Phase 2c. Profiles are
 * labels only — they NEVER change ticket formulas (the round authority resolves
 * every formula from the cabinet catalog by machine id, independent of room).
 */
export const ROOMS = Object.freeze([
  { room_id: 'main-floor',         display_name: 'Main Floor',         description: 'The standard arcade floor.',              status: 'open', capacity: 32, theme: 'neon',     ruleset_version: 'arcade/1', catalog_profile: 'standard', ruleset_profile: 'standard', profile_id: 'standard',   profile_label: null },
  { room_id: 'neon-training',      display_name: 'Neon Training',      description: 'A beginner room with its own state.',     status: 'open', capacity: 16, theme: 'training', ruleset_version: 'arcade/1', catalog_profile: 'training', ruleset_profile: 'standard', profile_id: 'training',   profile_label: 'Training' },
  { room_id: 'late-night-circuit', display_name: 'Late Night Circuit', description: 'A standard room with separate state.',     status: 'open', capacity: 32, theme: 'midnight', ruleset_version: 'arcade/1', catalog_profile: 'standard', ruleset_profile: 'standard', profile_id: 'late-night', profile_label: 'Late Night' },
]);

export const ROOM_IDS = Object.freeze(ROOMS.map((r) => r.room_id));
export const ROOM_STATUSES = Object.freeze(['open', 'closed', 'maintenance']);

export function getRoom(roomId) { return ROOMS.find((r) => r.room_id === roomId) || null; }
export function isValidRoomId(roomId) { return ROOM_IDS.includes(roomId); }
export function isJoinableStatus(s) { return s === 'open'; }
export function isRoomStatus(s) { return ROOM_STATUSES.includes(s); }

/** Effective status: an admin override wins, else the configured status. */
export function effectiveStatus(roomId, statusOverrides = {}) {
  const o = statusOverrides[roomId];
  if (isRoomStatus(o)) return o;
  const r = getRoom(roomId);
  return r ? r.status : 'closed';
}

/** Public-safe room list (populations supplied by the caller; no private fields). */
export function roomListPayload(populations = {}, statusOverrides = {}) {
  return {
    rooms: ROOMS.map((r) => ({
      room_id: r.room_id, display_name: r.display_name, description: r.description,
      status: effectiveStatus(r.room_id, statusOverrides),
      capacity: r.capacity, population: Math.max(0, Number(populations[r.room_id]) || 0), theme: r.theme,
    })),
  };
}

// ===================== v0.3: room presence / health / profiles =====================
// Mirrors workers/arcade/src/rooms.mjs Phase 2c. The simulator clock is the logical
// TICK, so freshness windows are expressed in TICKS (same shape as the product's ms
// windows). Health/eviction is DERIVED at query time from the stored heartbeats —
// the fold only records the latest heartbeat per room (no eviction mutation needed).

/** A heartbeat newer than this (in ticks) keeps a room `healthy`. */
export const ROOM_HEARTBEAT_TTL_TICKS = 30;
/** Beyond this with no fresh heartbeat a room is `offline` and population is evicted. */
export const ROOM_STALE_TTL_TICKS = 90;
export const HEARTBEAT_SCHEMA_VERSION = 1;
export const ROOM_HEALTHS = Object.freeze(['healthy', 'stale', 'offline', 'closed', 'maintenance', 'unknown']);

/**
 * PURE: derive a room's public health from effective status + heartbeat age (ticks).
 * closed/maintenance mirror the admin status; otherwise freshness decides. `ageTicks`
 * is null when the room has never reported a heartbeat.
 */
export function deriveRoomHealth(status, ageTicks) {
  if (status === 'closed') return 'closed';
  if (status === 'maintenance') return 'maintenance';
  if (ageTicks == null) return 'unknown';
  if (ageTicks > ROOM_STALE_TTL_TICKS) return 'offline';
  if (ageTicks > ROOM_HEARTBEAT_TTL_TICKS) return 'stale';
  return 'healthy';
}

/** Only a healthy room is joinable on the basis of health alone. */
export function isJoinableHealth(health) { return health === 'healthy'; }

/**
 * PURE: a room's presentation profile (labels/metadata ONLY — never economic). The
 * round/ticket formulas resolve from the cabinet catalog by machine id regardless of
 * room, so profiles can never change awards/costs/rewards.
 */
export function roomProfile(roomId) {
  const r = getRoom(roomId);
  if (!r) return null;
  return { profile_id: r.profile_id, catalog_profile: r.catalog_profile, ruleset_profile: r.ruleset_profile, label: r.profile_label || null };
}

/**
 * PURE: one room's public-safe presence entry given its latest heartbeat (or null)
 * and the registry clock `nowTick`. Stale-population policy: fresh→reported;
 * stale→estimated; offline(>STALE_TTL)→population 0 (no ghost population); unknown→0.
 * NEVER includes actor ids, balances, ledger, inventory, or admin tokens.
 */
export function roomPresenceEntry(roomId, heartbeat, statusOverrides = {}, nowTick = 0) {
  const r = getRoom(roomId);
  if (!r) return null;
  const status = effectiveStatus(roomId, statusOverrides);
  const lastSeenTick = heartbeat && Number.isFinite(heartbeat.last_seen_tick) ? heartbeat.last_seen_tick : null;
  const ageTicks = lastSeenTick == null ? null : Math.max(0, nowTick - lastSeenTick);
  const health = deriveRoomHealth(status, ageTicks);

  let population = heartbeat ? Math.max(0, Number(heartbeat.population) || 0) : 0;
  let estimated = false;
  if (ageTicks == null) { population = 0; estimated = true; }
  else if (ageTicks > ROOM_STALE_TTL_TICKS) { population = 0; estimated = true; }
  else if (ageTicks > ROOM_HEARTBEAT_TTL_TICKS) { estimated = true; }

  return {
    room_id: r.room_id,
    display_name: r.display_name,
    description: r.description,
    status,
    health,
    capacity: r.capacity,
    population,
    population_is_estimated: estimated,
    last_seen_age_ticks: ageTicks,
    theme: r.theme,
    profile_id: r.profile_id,
    profile_label: r.profile_label || null,
  };
}

/** PURE: public-safe room presence list with health + freshness (registry view). */
export function roomPresenceListPayload(heartbeats = {}, statusOverrides = {}, nowTick = 0) {
  return {
    schema_version: HEARTBEAT_SCHEMA_VERSION,
    rooms: ROOMS.map((r) => roomPresenceEntry(r.room_id, heartbeats[r.room_id] || null, statusOverrides, nowTick)),
  };
}

/**
 * PURE: one room's ADMIN-ONLY diagnostics entry. Operational detail (counts, status,
 * health, generation, heartbeat ticks) — still carries NO actor ids / balances /
 * ledger / inventory / tokens.
 */
export function roomDiagnosticsEntry(roomId, heartbeat, statusOverrides = {}, nowTick = 0) {
  const status = effectiveStatus(roomId, statusOverrides);
  const hb = heartbeat || null;
  const ageTicks = hb && Number.isFinite(hb.last_seen_tick) ? Math.max(0, nowTick - hb.last_seen_tick) : null;
  return {
    room_id: roomId,
    status,
    health: deriveRoomHealth(status, ageTicks),
    generation: hb ? Math.max(0, Number(hb.generation) || 0) : 0,
    reset_generation: hb ? Math.max(0, Number(hb.generation) || 0) : 0,
    population: hb ? Math.max(0, Number(hb.population) || 0) : 0,
    last_reported_tick: hb ? (Number(hb.reported_tick) || null) : null,
    last_seen_tick: hb ? (Number(hb.last_seen_tick) || null) : null,
    last_activity_tick: hb ? (Number(hb.last_activity_tick) || null) : null,
    active_connection_count: hb ? Math.max(0, Number(hb.active_connections) || 0) : 0,
    active_round_count: hb ? Math.max(0, Number(hb.active_rounds) || 0) : 0,
    occupied_cabinet_count: hb ? Math.max(0, Number(hb.occupied_cabinets) || 0) : 0,
  };
}

/** PURE: admin diagnostics for every configured room (deterministic order). */
export function roomDiagnosticsList(heartbeats = {}, statusOverrides = {}, nowTick = 0) {
  return ROOM_IDS.map((roomId) => roomDiagnosticsEntry(roomId, heartbeats[roomId] || null, statusOverrides, nowTick));
}

/**
 * PURE both-gate analog of the product admin gate. The product requires a dev flag
 * AND a matching token; the simulator's signature-backed analog is a config flag
 * (`adminEnabled`, from the fold ctx) AND that the actor is the room's own authority
 * (a player cannot sign as the room). Returns { ok, reason }.
 */
export function canAdmin({ adminEnabled, isAuthority }) {
  if (adminEnabled !== true) return { ok: false, reason: 'admin_disabled' };
  if (isAuthority !== true) return { ok: false, reason: 'not_authority' };
  return { ok: true, reason: null };
}
