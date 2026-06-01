/**
 * Room presence UX helpers (Phase 2d) — PURE, deterministic, browser + node importable.
 *
 * These turn the Phase 2c public room-presence list (room_id, display_name, status,
 * health, capacity, population, population_is_estimated, theme, profile_id,
 * profile_label, cabinet_summary) into smart-lobby behaviour: activity summaries,
 * recommendations (busiest healthy room + training room + a quiet room to revive),
 * presence-driven sorting, and recovery hints.
 *
 * They are CLIENT-SIDE derivations of ALREADY-PUBLIC fields — no server authority,
 * no protocol change, no private data (no actor ids, balances, occupied-cabinet
 * counts, or tokens). The same room_list every client receives yields the same
 * recommendations everywhere, so no coordination is needed.
 */

/** A room accepts new joins only when its effective status is `open` (matches Phase 2c). */
export function isJoinable(room) {
  return !!room && room.status === 'open';
}

function pop(room) { return Math.max(0, Number(room && room.population) || 0); }
function cap(room) { return Math.max(0, Number(room && room.capacity) || 0); }
function isFull(room) { return cap(room) > 0 && pop(room) >= cap(room); }
function cmpId(a, b) { return String(a.room_id).localeCompare(String(b.room_id)); }

/**
 * PURE: a public-safe activity summary for one room, derived from health + population
 * + capacity only. Never exposes who is present or exact cabinet usage.
 * Levels: closed | maintenance | offline | stale | unknown | empty | active | lively | busy.
 */
export function roomActivity(room) {
  if (!room) return { level: 'unknown', label: 'Checking…' };
  if (room.status === 'closed') return { level: 'closed', label: 'Closed' };
  if (room.status === 'maintenance') return { level: 'maintenance', label: 'Maintenance' };
  const health = room.health || 'unknown';
  if (health === 'offline') return { level: 'offline', label: 'Offline' };
  if (health === 'stale') return { level: 'stale', label: 'Quiet' };
  if (health === 'unknown') return { level: 'unknown', label: 'Checking…' };
  // healthy + open
  const p = pop(room);
  if (p === 0) return { level: 'empty', label: 'Empty' };
  const ratio = cap(room) > 0 ? p / cap(room) : 0;
  if (ratio >= 0.75 || p >= 24) return { level: 'busy', label: 'Busy' };
  if (p >= 3 || ratio >= 0.25) return { level: 'lively', label: 'Lively' };
  return { level: 'active', label: 'Active' };
}

/**
 * PURE: recommendations over the public room list. All targets are JOINABLE rooms
 * (open status); none point at closed/maintenance. Deterministic tiebreaks.
 *   busiest  — most-populated HEALTHY, open, not-full room (excludes the current room)
 *   training — the training-profile room, if joinable + not full
 *   revive   — a HEALTHY but EMPTY room a player could kick-start (excludes current)
 */
export function recommendRooms(rooms, { currentRoomId = null } = {}) {
  const list = Array.isArray(rooms) ? rooms : [];
  const joinable = list.filter(isJoinable);
  const healthyOpen = joinable.filter((r) => (r.health || 'unknown') === 'healthy');

  const busiestPool = healthyOpen
    .filter((r) => !isFull(r) && pop(r) > 0 && r.room_id !== currentRoomId)
    .sort((a, b) => (pop(b) - pop(a)) || cmpId(a, b));
  const busiest = busiestPool[0] || null;

  const training = joinable.find((r) => r.profile_id === 'training' && !isFull(r)) || null;

  const revive = healthyOpen
    .filter((r) => pop(r) === 0 && r.room_id !== currentRoomId)
    .sort(cmpId)[0] || null;

  return { busiest, training, revive };
}

/**
 * PURE: presence-driven lobby ordering (stable + deterministic). Active healthy rooms
 * first (busiest first), then empty healthy, then degraded (stale/unknown, then
 * offline), then closed/maintenance last. Never mutates the input.
 */
export function sortRoomsForLobby(rooms) {
  const rank = (r) => {
    if (r.status === 'closed' || r.status === 'maintenance') return 5;
    const h = r.health || 'unknown';
    if (h === 'offline') return 4;
    if (h === 'stale' || h === 'unknown') return 3;
    return pop(r) === 0 ? 2 : 1; // healthy: active before empty
  };
  return [...(Array.isArray(rooms) ? rooms : [])].sort((a, b) => {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    const dp = pop(b) - pop(a);
    if (dp) return dp;
    return cmpId(a, b);
  });
}

/**
 * PURE: an actionable recovery hint for a quiet/degraded but JOINABLE room — the room
 * is still `open`, so joining re-instantiates/refreshes it (self-heal). Returns null
 * for healthy+active rooms and for closed/maintenance (those are not joinable).
 */
export function roomRecoveryHint(room) {
  if (!room || room.status === 'closed' || room.status === 'maintenance') return null;
  const h = room.health || 'unknown';
  if (h === 'offline') return 'This room looks offline — joining will wake it up.';
  if (h === 'stale') return 'This room has gone quiet — joining refreshes it.';
  if (h === 'unknown') return 'Checking this room — you can still join.';
  if (h === 'healthy' && pop(room) === 0) return 'Empty room — be the first to play.';
  return null;
}
