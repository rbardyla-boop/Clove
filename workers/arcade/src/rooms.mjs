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

/** Static, configured room set (Phase 2a: no public matchmaking, no dynamic rooms). */
export const ROOMS = Object.freeze([
  { room_id: 'main-floor',         display_name: 'Main Floor',         description: 'The standard Neon Circuit arcade floor — all three cabinets.', status: 'open', capacity: 32, theme: 'neon',     created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ruleset_version: 'arcade/1', catalog_profile: 'standard', visibility: 'public' },
  { room_id: 'neon-training',      display_name: 'Neon Training',      description: 'A beginner-friendly room. Same cabinets, same ticket rules.',   status: 'open', capacity: 16, theme: 'training', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ruleset_version: 'arcade/1', catalog_profile: 'standard', visibility: 'public' },
  { room_id: 'late-night-circuit', display_name: 'Late Night Circuit', description: 'A standard room with its own separate state.',                  status: 'open', capacity: 32, theme: 'midnight', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-06-01T00:00:00Z', ruleset_version: 'arcade/1', catalog_profile: 'standard', visibility: 'public' },
]);

export const ROOM_IDS = Object.freeze(ROOMS.map((r) => r.room_id));

export function getRoom(roomId) {
  return ROOMS.find((r) => r.room_id === roomId) || null;
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
export function roomListPayload(populations = {}) {
  const summary = cabinetSummary();
  return {
    rooms: ROOMS.map((r) => ({
      room_id: r.room_id,
      display_name: r.display_name,
      description: r.description,
      status: r.status,
      capacity: r.capacity,
      population: Math.max(0, Number(populations[r.room_id]) || 0),
      theme: r.theme,
      cabinet_summary: summary,
    })),
  };
}

/** Public-safe single-room metadata (for room_joined / room_state). */
export function roomMetaPayload(roomId, population = 0) {
  const r = getRoom(roomId);
  if (!r) return null;
  return {
    room_id: r.room_id, display_name: r.display_name, description: r.description,
    status: r.status, capacity: r.capacity, population: Math.max(0, Number(population) || 0),
    theme: r.theme, ruleset_version: r.ruleset_version, cabinet_summary: cabinetSummary(),
  };
}

/** True if a room can accept one more player at the given current population. */
export function hasCapacity(roomId, currentPopulation) {
  const r = getRoom(roomId);
  if (!r) return false;
  return (Number(currentPopulation) || 0) < r.capacity;
}
