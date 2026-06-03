/**
 * Multi-room arcade catalog — PURE, deterministic, runtime-agnostic (Phase 2a).
 *
 * Phase 2a adds room SELECTION + multiple room instances. Each room has its own
 * isolated state namespace (occupancy, tickets, ledger, inventory, equips,
 * challenges, feed) — there is no global account and no cross-room economy. This
 * module is the authoritative room catalog used by the Durable Object, the local
 * dev shim, and the unit tests, so the room list a client sees is the room set the
 * server validates against.
 *
 * Scope + non-goals: docs/NEON_CIRCUIT_PHASE2A_MULTI_ROOM_LOBBY.md.
 */
import { CABINETS } from './catalog.mjs';

/** The default room a no-room (legacy) client lands in. */
export const DEFAULT_ROOM_ID = 'main-floor';

/** Legacy room ids accepted for backwards compatibility, mapped to a real room. */
const LEGACY_ALIASES = Object.freeze({ main: 'main-floor' });

/**
 * Static, configured room set (Phase 2a: no public matchmaking, no dynamic rooms).
 *
 * Phase 2c adds a per-room PROFILE: `profile_id` + `catalog_profile` +
 * `ruleset_profile` + an optional `profile_label`. Profiles are PRESENTATION ONLY —
 * they may change labels, help text, theme and cabinet ordering, but they NEVER
 * alter ticket formulas, prize costs, or rewards. The round/ticket authority resolves
 * every formula from the cabinet catalog by machine id, independent of the room, so
 * profile-neutral economics are guaranteed by construction.
 */
export const ROOMS = Object.freeze([
  { room_id: 'main-floor',         display_name: 'Main Floor',         description: 'The standard Neon Circuit arcade floor — all three cabinets.', status: 'open', capacity: 32, theme: 'neon',     created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ruleset_version: 'arcade/1', catalog_profile: 'standard', ruleset_profile: 'standard', profile_id: 'standard',   profile_label: null,         visibility: 'public' },
  { room_id: 'neon-training',      display_name: 'Neon Training',      description: 'A beginner-friendly room. Same cabinets, same ticket rules.',   status: 'open', capacity: 16, theme: 'training', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ruleset_version: 'arcade/1', catalog_profile: 'training', ruleset_profile: 'standard', profile_id: 'training',   profile_label: 'Training',   visibility: 'public' },
  { room_id: 'late-night-circuit', display_name: 'Late Night Circuit', description: 'A standard room with its own separate state.',                  status: 'open', capacity: 32, theme: 'midnight', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ruleset_version: 'arcade/1', catalog_profile: 'standard', ruleset_profile: 'standard', profile_id: 'late-night', profile_label: 'Late Night', visibility: 'public' },
]);

export const ROOM_IDS = Object.freeze(ROOMS.map((r) => r.room_id));

/** Room admin statuses (Phase 2b). Only `open` accepts new joins. */
export const ROOM_STATUSES = Object.freeze(['open', 'closed', 'maintenance']);
export function isRoomStatus(s) { return ROOM_STATUSES.includes(s); }
/** A room accepts new joins only when its effective status is `open`. */
export function isJoinableStatus(s) { return s === 'open'; }

export function getRoom(roomId) {
  return ROOMS.find((r) => r.room_id === roomId) || null;
}

/** The effective status of a room (admin override falls back to the configured status). */
export function effectiveStatus(roomId, statusOverrides = {}) {
  const o = statusOverrides[roomId];
  if (isRoomStatus(o)) return o;
  const r = getRoom(roomId);
  return r ? r.status : 'closed';
}
export function isValidRoomId(roomId) {
  return typeof roomId === 'string' && ROOM_IDS.includes(roomId);
}

/**
 * Sanitize an untrusted room id: lowercase, [a-z0-9-] only, bounded length, no
 * traversal. Returns a safe string (possibly empty) — never throws.
 */
export function sanitizeRoomId(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 48) return '';
  if (!/^[a-z0-9-]+$/.test(trimmed)) return '';   // rejects '/', '..', spaces, etc.
  return trimmed;
}

/**
 * Resolve an untrusted room id to a VALID room id. Applies legacy aliases and
 * sanitization. Returns { roomId, ok, fallback } — `ok` is false when the input
 * was missing/invalid and we fell back to the default room.
 */
export function resolveRoomId(raw) {
  if (raw == null || raw === '') return { roomId: DEFAULT_ROOM_ID, ok: true, fallback: false };
  const sane = sanitizeRoomId(raw);
  const aliased = LEGACY_ALIASES[sane] || sane;
  if (isValidRoomId(aliased)) return { roomId: aliased, ok: true, fallback: false };
  return { roomId: DEFAULT_ROOM_ID, ok: false, fallback: true };
}

/** Public-safe cabinet summary for a room (count + display names of live cabinets). */
export function cabinetSummary() {
  const live = CABINETS.filter((c) => c.status === 'live' && c.ticket_enabled === true);
  return { count: live.length, cabinets: live.map((c) => ({ cabinet_id: c.cabinet_id, display_name: c.display_name, cabinet_type: c.cabinet_type })) };
}

/**
 * Public-safe room list. `populations` is a map roomId -> live player count (the
 * server supplies it). NEVER includes private player data, ledgers, balances,
 * inventory, challenge state, or raw connection ids.
 */
export function roomListPayload(populations = {}, statusOverrides = {}) {
  const summary = cabinetSummary();
  return {
    rooms: ROOMS.map((r) => ({
      room_id: r.room_id,
      display_name: r.display_name,
      description: r.description,
      status: effectiveStatus(r.room_id, statusOverrides),
      capacity: r.capacity,
      population: Math.max(0, Number(populations[r.room_id]) || 0),
      theme: r.theme,
      cabinet_summary: summary,
    })),
  };
}

/** Public-safe single-room metadata (for room_joined / room_state). */
export function roomMetaPayload(roomId, population = 0, statusOverrides = {}) {
  const r = getRoom(roomId);
  if (!r) return null;
  return {
    room_id: r.room_id, display_name: r.display_name, description: r.description,
    status: effectiveStatus(roomId, statusOverrides), capacity: r.capacity, population: Math.max(0, Number(population) || 0),
    theme: r.theme, ruleset_version: r.ruleset_version, cabinet_summary: cabinetSummary(),
    profile_id: r.profile_id, profile_label: r.profile_label || null,
  };
}

/** True if a room can accept one more player at the given current population. */
export function hasCapacity(roomId, currentPopulation) {
  const r = getRoom(roomId);
  if (!r) return false;
  return (Number(currentPopulation) || 0) < r.capacity;
}

// ===================== Phase 2c: room presence / health / profiles =====================

/** Heartbeat freshness window. Within this, a reporting room is `healthy`. */
export const ROOM_HEARTBEAT_TTL_MS = 30_000;
/** Beyond this with no fresh heartbeat a room is `offline` and its population is evicted (no ghost population). */
export const ROOM_STALE_TTL_MS = 90_000;
/** Heartbeat envelope schema version — bumped if the heartbeat shape changes. */
export const HEARTBEAT_SCHEMA_VERSION = 1;
/** All public-safe room health states. */
export const ROOM_HEALTHS = Object.freeze(['healthy', 'stale', 'offline', 'closed', 'maintenance', 'unknown']);

/**
 * PURE: derive a room's public health from its effective status + heartbeat age.
 *   closed/maintenance  -> mirrors the admin status (health == status)
 *   open + age <= 30s    -> healthy
 *   open + 30s < age<=90s-> stale
 *   open + age > 90s      -> offline   (expired — population is evicted)
 *   open + never reported -> unknown
 * `lastSeenAgeMs` is null when the room has never reported a heartbeat.
 */
export function deriveRoomHealth(status, lastSeenAgeMs) {
  if (status === 'closed') return 'closed';
  if (status === 'maintenance') return 'maintenance';
  if (lastSeenAgeMs == null) return 'unknown';
  if (lastSeenAgeMs > ROOM_STALE_TTL_MS) return 'offline';
  if (lastSeenAgeMs > ROOM_HEARTBEAT_TTL_MS) return 'stale';
  return 'healthy';
}

/** A room is open to NEW joins only when healthy/open — stale/offline/closed/maintenance are not joinable. */
export function isJoinableHealth(health) {
  return health === 'healthy';
}

/**
 * PURE: a room's presentation profile (labels/metadata ONLY). Never affects ticket
 * formulas, prize costs, or rewards. Returns null for unknown rooms.
 */
export function roomProfile(roomId) {
  const r = getRoom(roomId);
  if (!r) return null;
  return {
    profile_id: r.profile_id,
    catalog_profile: r.catalog_profile,
    ruleset_profile: r.ruleset_profile,
    label: r.profile_label || null,
  };
}

/**
 * PURE: one room's public-safe presence entry, given its latest heartbeat (or null)
 * and the registry freshness clock `now`. Applies the stale-population policy:
 *   fresh   -> reported population (not estimated)
 *   stale   -> last reported population, flagged estimated
 *   offline -> population 0 (no ghost population), flagged estimated
 *   unknown -> population 0, flagged estimated
 * NEVER includes private player data, connection ids, balances, ledger, inventory,
 * challenge state, or admin tokens.
 */
export function roomPresenceEntry(roomId, heartbeat, statusOverrides = {}, now = Date.now()) {
  const r = getRoom(roomId);
  if (!r) return null;
  const status = effectiveStatus(roomId, statusOverrides);
  const lastSeenAt = heartbeat && Number.isFinite(heartbeat.last_seen_at) ? heartbeat.last_seen_at : null;
  const lastSeenAgeMs = lastSeenAt == null ? null : Math.max(0, now - lastSeenAt);
  const health = deriveRoomHealth(status, lastSeenAgeMs);

  let population = heartbeat ? Math.max(0, Number(heartbeat.population) || 0) : 0;
  let estimated = false;
  if (lastSeenAgeMs == null) { population = 0; estimated = true; }
  else if (lastSeenAgeMs > ROOM_STALE_TTL_MS) { population = 0; estimated = true; }
  else if (lastSeenAgeMs > ROOM_HEARTBEAT_TTL_MS) { estimated = true; }

  return {
    room_id: r.room_id,
    display_name: r.display_name,
    description: r.description,
    status,
    health,
    capacity: r.capacity,
    population,
    population_is_estimated: estimated,
    last_seen_age_ms: lastSeenAgeMs,
    theme: r.theme,
    profile_id: r.profile_id,
    profile_label: r.profile_label || null,
    cabinet_summary: cabinetSummary(),
  };
}

/**
 * PURE: public-safe Phase 2c room list with health + freshness (the registry
 * coordinator is the authority for the `heartbeats` map; each value is a stored
 * heartbeat stamped with a registry-side `last_seen_at`).
 */
export function roomPresenceListPayload(heartbeats = {}, statusOverrides = {}, now = Date.now()) {
  return {
    schema_version: HEARTBEAT_SCHEMA_VERSION,
    rooms: ROOMS.map((r) => roomPresenceEntry(r.room_id, heartbeats[r.room_id] || null, statusOverrides, now)),
  };
}

/**
 * PURE: one room's ADMIN-ONLY diagnostics entry (Phase 2c). Operational detail for
 * room-lifecycle tooling. Still public-SAFE in the sense that it carries NO player
 * ids, balances, ledger, inventory, challenge state, or tokens — only counts, status,
 * health, generation, and heartbeat timestamps. Shared by the registry DO + dev shim.
 */
export function roomDiagnosticsEntry(roomId, heartbeat, statusOverrides = {}, now = Date.now()) {
  const status = effectiveStatus(roomId, statusOverrides);
  const hb = heartbeat || null;
  const lastSeenAgeMs = hb && Number.isFinite(hb.last_seen_at) ? Math.max(0, now - hb.last_seen_at) : null;
  return {
    room_id: roomId,
    status,
    health: deriveRoomHealth(status, lastSeenAgeMs),
    generation: hb ? Math.max(0, Number(hb.generation) || 0) : 0,
    reset_generation: hb ? Math.max(0, Number(hb.generation) || 0) : 0,
    population: hb ? Math.max(0, Number(hb.population) || 0) : 0,
    last_reported_at: hb ? (Number(hb.reported_at) || null) : null,
    last_seen_at: hb ? (Number(hb.last_seen_at) || null) : null,
    last_activity_at: hb ? (Number(hb.last_activity_at) || null) : null,
    active_connection_count: hb ? Math.max(0, Number(hb.active_connections) || 0) : 0,
    active_round_count: hb ? Math.max(0, Number(hb.active_rounds) || 0) : 0,
    occupied_cabinet_count: hb ? Math.max(0, Number(hb.occupied_cabinets) || 0) : 0,
  };
}

/** PURE: admin diagnostics for every configured room (deterministic order). */
export function roomDiagnosticsList(heartbeats = {}, statusOverrides = {}, now = Date.now()) {
  return ROOM_IDS.map((roomId) => roomDiagnosticsEntry(roomId, heartbeats[roomId] || null, statusOverrides, now));
}
