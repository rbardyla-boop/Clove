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

// ===================== Phase 2e: scheduled room events (display-only) =====================
//
// These read the public `current_event` already attached to each room by the server
// (room-events.mjs). They are PURE presentation derivations — no economy, no rewards,
// no private data, no protocol change beyond the public room list the client already has.

/** Short type label for an event chip. */
const EVENT_TYPE_LABEL = {
  featured_cabinet: 'Featured now',
  training_focus: 'Training focus',
  late_night_theme: 'Room event',
  room_warmup: 'Room warmup',
  quiet_room_prompt: 'Room warmup',
};

/**
 * PURE: a public-safe event badge for one room (or null when no current event). Carries
 * only display fields — the event name, a short kind label, the featured cabinet id (if
 * any) and how long the current event window has left. Never any reward/economy data.
 */
export function roomEventBadge(room) {
  const ev = room && room.current_event;
  if (!ev || !ev.display_name) return null;
  return {
    label: ev.display_name,
    kind: ev.event_type,
    kind_label: EVENT_TYPE_LABEL[ev.event_type] || 'Room event',
    featured_cabinet_id: ev.featured_cabinet_id || null,
    ends_in_ms: Math.max(0, Number(room.event_ends_in_ms) || 0),
  };
}

/** PURE: the room's next-event display name (or null). */
export function roomNextEventLabel(room) {
  const nx = room && room.next_event;
  return nx && nx.display_name ? nx.display_name : null;
}

/**
 * PURE: an event-aware warmup hint for a JOINABLE but empty/quiet room that has a
 * current event — the "Quiet Room Warmup" prompt. Display-only; joining never grants a
 * reward. Returns null for busy/healthy rooms and for closed/maintenance.
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
 * PURE: compact ms-countdown formatting for an event window (e.g. "12m", "45s",
 * "now"). Display helper only; never used for any timing-sensitive authority.
 */
export function formatEventCountdown(ms) {
  const t = Math.max(0, Number(ms) || 0);
  if (t < 1000) return 'now';
  const totalSec = Math.floor(t / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  return `${hr}h`;
}

/**
 * PURE: a pre-roll prompt for a room whose NEXT event is upcoming (Phase 2g). Reads the
 * server-attached `event_upcoming` flag + `next_event` + `event_starts_in_ms` — returns
 * null when no event is imminent. Display-only: countdown copy, never a reward.
 */
export function roomUpcomingPreroll(room) {
  if (!room || room.event_upcoming !== true) return null;
  const nx = room.next_event;
  if (!nx || !nx.display_name) return null;
  return {
    label: nx.display_name,
    starts_in_ms: Math.max(0, Number(room.event_starts_in_ms) || 0),
    countdown: formatEventCountdown(Math.max(0, Number(room.event_starts_in_ms) || 0)),
  };
}

/**
 * PURE: a live `m:ss` countdown for the Phase 2h pre-roll timer (ticks every refresh
 * interval, so seconds visibly count down). Clamped at 0:00. Display-only.
 */
export function formatPrerollCountdown(ms) {
  const totalSec = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
