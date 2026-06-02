/**
 * Room presence UX helpers (v0.4) — SIMULATOR-LOCAL PORT of arcade/room-recommend.mjs
 * (product Phase 2d). PURE, deterministic.
 *
 * They turn the v0.3 public room-presence list (roomPresenceListPayload in rooms.mjs:
 * room_id, display_name, status, health, capacity, population, population_is_estimated,
 * theme, profile_id, profile_label) into smart-lobby behaviour: activity summaries,
 * recommendations (busiest healthy room + training room + a quiet room to revive),
 * presence-driven sorting, and recovery hints.
 *
 * These are CLIENT-SIDE derivations of ALREADY-PUBLIC fields — no fold authority, no
 * private data (no actor ids, balances, ledger, inventory, occupied-cabinet counts, or
 * tokens). The same presence list yields the same recommendations on every node. This
 * mirrors the product helper byte-for-byte in behaviour (the sim presence entry carries
 * `last_seen_age_ticks` where the product has `_ms`, but recommendations never read it).
 */

/** A room accepts new joins only when its effective status is `open` (matches v0.3). */
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
 */
export function roomActivity(room) {
  if (!room) return { level: 'unknown', label: 'Checking…' };
  if (room.status === 'closed') return { level: 'closed', label: 'Closed' };
  if (room.status === 'maintenance') return { level: 'maintenance', label: 'Maintenance' };
  const health = room.health || 'unknown';
  if (health === 'offline') return { level: 'offline', label: 'Offline' };
  if (health === 'stale') return { level: 'stale', label: 'Quiet' };
  if (health === 'unknown') return { level: 'unknown', label: 'Checking…' };
  const p = pop(room);
  if (p === 0) return { level: 'empty', label: 'Empty' };
  const ratio = cap(room) > 0 ? p / cap(room) : 0;
  if (ratio >= 0.75 || p >= 24) return { level: 'busy', label: 'Busy' };
  if (p >= 3 || ratio >= 0.25) return { level: 'lively', label: 'Lively' };
  return { level: 'active', label: 'Active' };
}

/**
 * PURE: recommendations over the public room list. All targets are JOINABLE rooms;
 * none point at closed/maintenance. Deterministic tiebreaks.
 *   busiest  — most-populated HEALTHY, open, not-full room (excludes the current room)
 *   training — the training-profile room, if joinable + not full
 *   revive   — a HEALTHY but EMPTY room a player could kick-start (excludes current)
 */
export function recommendRooms(rooms, { currentRoomId = null } = {}) {
  const list = Array.isArray(rooms) ? rooms : [];
  const joinable = list.filter(isJoinable);
  const healthyOpen = joinable.filter((r) => (r.health || 'unknown') === 'healthy');

  const busiest = healthyOpen
    .filter((r) => !isFull(r) && pop(r) > 0 && r.room_id !== currentRoomId)
    .sort((a, b) => (pop(b) - pop(a)) || cmpId(a, b))[0] || null;

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
    return pop(r) === 0 ? 2 : 1;
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
 * PURE: an actionable recovery hint for a quiet/degraded but JOINABLE room (still
 * `open`, so joining re-instantiates/refreshes it). Returns null for healthy+active
 * rooms and for closed/maintenance.
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

// ===================== v0.5: scheduled room events (display-only) =====================
//
// SIMULATOR-LOCAL PORT of the product Phase 2e additions (arcade/room-recommend.mjs).
// These read the public `current_event` already attached to each room by room-events.mjs
// (attachRoomEvents). PURE presentation derivations — no fold authority, no economy, no
// private data. The product reads `event_ends_in_ms`; the simulator reads
// `event_ends_in_ticks` (the only difference is the clock unit).

/** Short type label for an event chip (mirrors the product copy). */
const EVENT_TYPE_LABEL = {
  featured_cabinet: 'Featured now',
  training_focus: 'Training focus',
  late_night_theme: 'Room event',
  room_warmup: 'Room warmup',
  quiet_room_prompt: 'Room warmup',
};

/**
 * PURE: a public-safe event badge for one room (or null when no current event). Display
 * fields only — name, a short kind label, the featured cabinet id (if any), and how many
 * ticks the current event window has left. Never any reward/economy data.
 */
export function roomEventBadge(room) {
  const ev = room && room.current_event;
  if (!ev || !ev.display_name) return null;
  return {
    label: ev.display_name,
    kind: ev.event_type,
    kind_label: EVENT_TYPE_LABEL[ev.event_type] || 'Room event',
    featured_cabinet_id: ev.featured_cabinet_id || null,
    ends_in_ticks: Math.max(0, Number(room.event_ends_in_ticks) || 0),
  };
}

/** PURE: the room's next-event display name (or null). */
export function roomNextEventLabel(room) {
  const nx = room && room.next_event;
  return nx && nx.display_name ? nx.display_name : null;
}

/**
 * PURE: an event-aware warmup hint for a JOINABLE but empty/quiet room that has a current
 * event — the "Quiet Room Warmup" prompt. Display-only; joining never grants a reward.
 * Returns null for busy/healthy rooms and for closed/maintenance.
 */
export function roomEventWarmupHint(room) {
  if (!isJoinable(room)) return null;
  const ev = room && room.current_event;
  if (!ev || !ev.display_name) return null;
  const h = room.health || 'unknown';
  const quiet = (h === 'healthy' && pop(room) === 0) || h === 'stale';
  if (!quiet) return null;
  if (ev.event_type === 'training_focus') return `${ev.display_name} — a calm window to warm up. Join to start.`;
  return `${ev.display_name} is on — be the first in to kick it off.`;
}

/**
 * PURE: compact tick-countdown formatting for an event window (e.g. "12t", "now"). The
 * product formats ms ("12m"); the simulator formats ticks. Display helper only.
 */
export function formatEventCountdown(ticks) {
  const t = Math.max(0, Number(ticks) || 0);
  if (t <= 0) return 'now';
  return `${t}t`;
}
