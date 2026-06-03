/**
 * Room-scoped scheduled events — PURE, deterministic, runtime-agnostic (Phase 2e).
 *
 * Each room rotates through a STATIC, configured list of display-only events
 * (Pulse Hour, Signal Sprint Relay, Training Focus, Late Night Circuit, …). An
 * event highlights a cabinet or a room activity. Events are DERIVED deterministically
 * from `roomId` + server time (a fixed wall-clock window bucket), so every caller —
 * the RoomRegistry DO, each ArcadeRoom DO, the dev shim, and the unit tests —
 * computes the SAME current/next event for the same `now`. `now` is always injected
 * so tests use a fake clock and never depend on the real time of day.
 *
 * HARD BOUNDARY (Phase 2e): events are PRESENTATION ONLY. They NEVER change ticket
 * formulas, prize costs, ledger values, challenge criteria, inventory value, cabinet
 * availability, or any cross-room economy. There is no event reward and no ticket
 * multiplier. The round/ticket authority resolves every formula from the cabinet
 * catalog by machine id, independent of any event — economy-neutrality is guaranteed
 * by construction (this module never touches a balance or a formula).
 *
 * No dynamic/user-created events, no random schedule drift, no background cron — the
 * schedule is a deterministic function of room id and time.
 *
 * Scope + non-goals: docs/NEON_CIRCUIT_PHASE2E_ROOM_EVENTS.md.
 */
import { getCabinet, isPlayableCabinet } from './catalog.mjs';

/** Event ruleset version — bumped if the event payload shape changes. */
export const EVENT_RULESET_VERSION = 'arcade-events/1';

/**
 * How long each event window lasts (wall-clock). One event is `active` per room per
 * window; the rotation advances to the next event when the window flips. Chosen in
 * the recommended 10–30 min band. Tests inject a fake `now` so this value never gates
 * a unit test on real elapsed time.
 */
export const EVENT_WINDOW_MS = 20 * 60 * 1000; // 20 minutes

/** All event lifecycle statuses (public-safe). */
export const EVENT_STATUSES = Object.freeze(['upcoming', 'active', 'ended', 'disabled']);

/** All event types. featured_cabinet highlights one cabinet; the others are room-wide. */
export const EVENT_TYPES = Object.freeze([
  'featured_cabinet',
  'room_warmup',
  'quiet_room_prompt',
  'training_focus',
  'late_night_theme',
]);

export function isEventType(t) { return EVENT_TYPES.includes(t); }
export function isEventStatus(s) { return EVENT_STATUSES.includes(s); }

/**
 * Static, configured per-room event schedule (Phase 2e: no public matchmaking, no
 * dynamic rooms, no user-created events). Each room has an ordered rotation; `phase`
 * desyncs rooms so they do not all show the same slot at once. `featured_cabinet_id`
 * is a cabinet the event highlights (or null for a room-wide activity event). Every
 * field here is display-only.
 */
export const EVENT_SCHEDULES = Object.freeze({
  'main-floor': {
    phase: 0,
    events: [
      { schedule_key: 'pulse-hour',          event_type: 'featured_cabinet', display_name: 'Pulse Hour',          description: 'Pulse Tap is in the spotlight on the main floor.',      featured_cabinet_id: 'pulse-tap-01',   sort_order: 1 },
      { schedule_key: 'signal-sprint-relay', event_type: 'featured_cabinet', display_name: 'Signal Sprint Relay', description: 'Ride the Signal Sprint lane — featured this window.',     featured_cabinet_id: 'signal-sprint-01', sort_order: 2 },
      { schedule_key: 'neon-grid-rush',      event_type: 'featured_cabinet', display_name: 'Neon Grid Rush',      description: 'Neon Grid takes the marquee — match the path.',          featured_cabinet_id: 'neon-grid-01',   sort_order: 3 },
    ],
  },
  'neon-training': {
    phase: 1,
    events: [
      { schedule_key: 'training-focus', event_type: 'training_focus', display_name: 'Training Focus', description: 'A warm, beginner-friendly window — try any cabinet at your pace.', featured_cabinet_id: null,             sort_order: 1 },
      { schedule_key: 'pulse-practice', event_type: 'training_focus', display_name: 'Pulse Practice', description: 'Practice your timing on Pulse Tap.',                              featured_cabinet_id: 'pulse-tap-01',   sort_order: 2 },
      { schedule_key: 'grid-basics',    event_type: 'training_focus', display_name: 'Grid Basics',    description: 'Learn the Neon Grid pattern, step by step.',                      featured_cabinet_id: 'neon-grid-01',   sort_order: 3 },
    ],
  },
  'late-night-circuit': {
    phase: 2,
    events: [
      { schedule_key: 'late-night-circuit', event_type: 'late_night_theme', display_name: 'Late Night Circuit', description: 'The after-hours theme is on across the room.',       featured_cabinet_id: null,               sort_order: 1 },
      { schedule_key: 'signal-afterdark',   event_type: 'late_night_theme', display_name: 'Signal Afterdark',   description: 'Signal Sprint under the late-night lights.',         featured_cabinet_id: 'signal-sprint-01', sort_order: 2 },
      { schedule_key: 'neon-grid-rush',     event_type: 'featured_cabinet', display_name: 'Neon Grid Rush',     description: 'Neon Grid takes the marquee — match the path.',      featured_cabinet_id: 'neon-grid-01',     sort_order: 3 },
    ],
  },
});

/** True if the room has a configured event schedule. */
export function hasRoomEvents(roomId) {
  return typeof roomId === 'string' && Object.prototype.hasOwnProperty.call(EVENT_SCHEDULES, roomId);
}

/** PURE: the global wall-clock window index for a time (deterministic, no drift). */
export function windowIndexFor(now) {
  return Math.floor((Number(now) || 0) / EVENT_WINDOW_MS);
}

/**
 * PURE: the rotation slot a room shows at `windowIndex`. Deterministic from room id
 * (via its event count + phase) and the window — never random.
 */
function slotFor(schedule, windowIndex) {
  const k = schedule.events.length;
  if (k === 0) return -1;
  const phase = Number(schedule.phase) || 0;
  return (((windowIndex + phase) % k) + k) % k;
}

/**
 * PURE: resolve an event definition's featured cabinet to a PUBLIC-SAFE annotation.
 * Fail-safe: an unknown / not-playable featured cabinet collapses to nulls so the
 * event still displays as a room event but carries no cabinet annotation.
 */
function resolveFeatured(featuredCabinetId) {
  if (typeof featuredCabinetId !== 'string' || !featuredCabinetId) return { id: null, type: null };
  if (!isPlayableCabinet(featuredCabinetId)) return { id: null, type: null };
  const cab = getCabinet(featuredCabinetId);
  return { id: cab.cabinet_id, type: cab.cabinet_type };
}

/**
 * PURE: derive an event's status from its window bounds + `now`.
 *   disabled def        -> disabled
 *   now <  starts_at     -> upcoming
 *   starts_at <= now < ends_at -> active
 *   now >= ends_at       -> ended
 */
export function deriveEventStatus(event, now) {
  if (!event) return 'disabled';
  if (event.disabled === true) return 'disabled';
  const t = Number(now) || 0;
  if (t < event.starts_at) return 'upcoming';
  if (t >= event.ends_at) return 'ended';
  return 'active';
}

/**
 * PURE: build a full PUBLIC-SAFE event object for a room's `def` at `windowIndex`.
 * `event_id` is stable within a window and changes when the window flips, so a feed
 * transition detector can compare ids. Carries NO private player data.
 */
function buildEvent(roomId, def, windowIndex, now) {
  const startsAt = windowIndex * EVENT_WINDOW_MS;
  const endsAt = startsAt + EVENT_WINDOW_MS;
  const featured = resolveFeatured(def.featured_cabinet_id);
  const event = {
    event_id: `${roomId}:${def.schedule_key}:${windowIndex}`,
    room_id: roomId,
    event_type: def.event_type,
    display_name: def.display_name,
    description: def.description,
    schedule_key: def.schedule_key,
    featured_cabinet_id: featured.id,
    featured_cabinet_type: featured.type,
    starts_at: startsAt,
    ends_at: endsAt,
    duration_ms: EVENT_WINDOW_MS,
    sort_order: def.sort_order,
    visibility: 'public',
    public_safe: true,
    ruleset_version: EVENT_RULESET_VERSION,
    disabled: def.enabled === false,
  };
  event.status = deriveEventStatus(event, now);
  return event;
}

/** PURE: the room's currently-active event (or null for an unscheduled room). */
export function getCurrentRoomEvent(roomId, now = Date.now()) {
  const schedule = EVENT_SCHEDULES[roomId];
  if (!schedule) return null;
  const windowIndex = windowIndexFor(now);
  const slot = slotFor(schedule, windowIndex);
  if (slot < 0) return null;
  const event = buildEvent(roomId, schedule.events[slot], windowIndex, now);
  return event.status === 'disabled' ? null : event;
}

/** PURE: the room's next upcoming event (the following window's slot), or null. */
export function getNextRoomEvent(roomId, now = Date.now()) {
  const schedule = EVENT_SCHEDULES[roomId];
  if (!schedule) return null;
  const windowIndex = windowIndexFor(now) + 1;
  const slot = slotFor(schedule, windowIndex);
  if (slot < 0) return null;
  const event = buildEvent(roomId, schedule.events[slot], windowIndex, now);
  return event.status === 'disabled' ? null : event;
}

/**
 * PURE: the room's deterministic event schedule view starting at the current window
 * (one full rotation), each entry a public-safe event with computed window + status.
 * Disabled slots are omitted. Empty array for an unscheduled room.
 */
export function getRoomEventSchedule(roomId, now = Date.now()) {
  const schedule = EVENT_SCHEDULES[roomId];
  if (!schedule) return [];
  const base = windowIndexFor(now);
  const k = schedule.events.length;
  const out = [];
  for (let i = 0; i < k; i += 1) {
    const windowIndex = base + i;
    const slot = slotFor(schedule, windowIndex);
    if (slot < 0) continue;
    const event = buildEvent(roomId, schedule.events[slot], windowIndex, now);
    if (event.status !== 'disabled') out.push(event);
  }
  return out;
}

/**
 * PURE: compact public event fields to MERGE into a room-list entry. Safe defaults
 * (all null/0) for an unscheduled room so the list shape stays uniform.
 *   current_event / next_event   — full public-safe event objects (or null)
 *   event_ends_in_ms             — ms until the current event's window flips
 *   event_starts_in_ms           — ms until the next event begins
 *   featured_cabinet_id          — current event's featured cabinet (or null)
 */
export function roomEventPublic(roomId, now = Date.now()) {
  const t = Number(now) || 0;
  const current = getCurrentRoomEvent(roomId, t);
  const next = getNextRoomEvent(roomId, t);
  return {
    current_event: current,
    next_event: next,
    event_ends_in_ms: current ? Math.max(0, current.ends_at - t) : null,
    event_starts_in_ms: next ? Math.max(0, next.starts_at - t) : null,
    featured_cabinet_id: current ? current.featured_cabinet_id : null,
  };
}

/**
 * PURE: enrich a Phase 2c presence list payload with per-room event fields. Returns a
 * NEW payload (never mutates). Used identically by the RoomRegistry DO and the dev
 * shim, so the room list every client sees carries the same deterministic events.
 */
export function attachRoomEvents(presenceList, now = Date.now()) {
  if (!presenceList || !Array.isArray(presenceList.rooms)) return presenceList;
  const t = Number(now) || 0;
  return {
    ...presenceList,
    event_ruleset_version: EVENT_RULESET_VERSION,
    rooms: presenceList.rooms.map((r) => (r && r.room_id ? { ...r, ...roomEventPublic(r.room_id, t) } : r)),
  };
}

/**
 * PURE: a room's full event read payload (current + next + one-rotation schedule).
 * Public-safe; never includes private player data.
 */
export function roomEventListPayload(roomId, now = Date.now()) {
  const t = Number(now) || 0;
  return {
    room_id: roomId,
    event_ruleset_version: EVENT_RULESET_VERSION,
    current_event: getCurrentRoomEvent(roomId, t),
    next_event: getNextRoomEvent(roomId, t),
    schedule: getRoomEventSchedule(roomId, t),
  };
}

/**
 * PURE: annotate a cabinet catalog payload with DISPLAY-ONLY featured markers for a
 * room's current event. Returns a NEW payload (never mutates). The annotation ONLY
 * adds `is_featured` / `featured_reason` / `featured_event_id` fields — it never
 * changes a ticket formula, a cabinet's status/availability, or a reward. Fail-safe:
 * if the current event has no valid featured cabinet, no cabinet is marked.
 */
export function annotateCatalogForRoom(catalogPayload, roomId, now = Date.now()) {
  if (!catalogPayload || !Array.isArray(catalogPayload.cabinets)) return catalogPayload;
  const current = getCurrentRoomEvent(roomId, now);
  const featuredId = current ? current.featured_cabinet_id : null;
  return {
    ...catalogPayload,
    event_ruleset_version: EVENT_RULESET_VERSION,
    cabinets: catalogPayload.cabinets.map((c) => {
      const isFeatured = !!featuredId && c.cabinet_id === featuredId;
      return {
        ...c,
        is_featured: isFeatured,
        featured_reason: isFeatured ? current.display_name : null,
        featured_event_id: isFeatured ? current.event_id : null,
      };
    }),
  };
}
