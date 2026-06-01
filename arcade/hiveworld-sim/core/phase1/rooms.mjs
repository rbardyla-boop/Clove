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

export const ROOMS = Object.freeze([
  { room_id: 'main-floor',         display_name: 'Main Floor',         description: 'The standard arcade floor.',              status: 'open', capacity: 32, theme: 'neon',     ruleset_version: 'arcade/1' },
  { room_id: 'neon-training',      display_name: 'Neon Training',      description: 'A beginner room with its own state.',     status: 'open', capacity: 16, theme: 'training', ruleset_version: 'arcade/1' },
  { room_id: 'late-night-circuit', display_name: 'Late Night Circuit', description: 'A standard room with separate state.',     status: 'open', capacity: 32, theme: 'midnight', ruleset_version: 'arcade/1' },
]);

export const ROOM_IDS = Object.freeze(ROOMS.map((r) => r.room_id));
export const ROOM_STATUSES = Object.freeze(['open', 'closed', 'maintenance']);

export function getRoom(roomId) { return ROOMS.find((r) => r.room_id === roomId) || null; }
export function isValidRoomId(roomId) { return ROOM_IDS.includes(roomId); }
export function isJoinableStatus(s) { return s === 'open'; }

/** Public-safe room list (populations supplied by the caller; no private fields). */
export function roomListPayload(populations = {}, statusOverrides = {}) {
  return {
    rooms: ROOMS.map((r) => ({
      room_id: r.room_id, display_name: r.display_name, description: r.description,
      status: ROOM_STATUSES.includes(statusOverrides[r.room_id]) ? statusOverrides[r.room_id] : r.status,
      capacity: r.capacity, population: Math.max(0, Number(populations[r.room_id]) || 0), theme: r.theme,
    })),
  };
}
