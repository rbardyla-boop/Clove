/**
 * Room-scoped scheduled events (v0.5) — SIMULATOR-LOCAL PORT of
 * workers/arcade/src/room-events.mjs (product Phase 2e). PURE, deterministic.
 *
 * Each room rotates through a STATIC event list (Pulse Hour, Signal Sprint Relay,
 * Training Focus, Late Night Circuit, …) that highlights a cabinet or a room activity.
 * Events are DERIVED deterministically from `roomId` + the simulator's logical TICK
 * (a fixed window bucket), exactly as the product derives them from `roomId` + a
 * wall-clock ms window — the only difference is the clock unit (ticks here, ms there).
 * Every node folding the same log computes the same current/next event for the same
 * tick, so events need no coordination and add no fold authority.
 *
 * HARD BOUNDARY (mirrors the product): events are PRESENTATION ONLY. They NEVER change
 * ticket formulas, prize costs, ledger values, challenge criteria, inventory value,
 * cabinet availability, or any cross-room economy. No event reward, no ticket
 * multiplier. This module never touches a balance, a formula, or fold state.
 *
 * No dynamic / user-created events, no random drift — a pure function of room id + tick.
 *
 * Testbed mirror, never the canonical authority. See docs/HIVEWORLD_V0_5_ROOM_EVENTS.md.
 */
import { getCabinet, isLiveTicketed } from './catalog.mjs';

/** Event ruleset version — matches the product's `arcade-events/1`. */
export const EVENT_RULESET_VERSION = 'arcade-events/1';

/**
 * Window length in LOGICAL TICKS (the simulator's clock). The product uses a 20-minute
 * ms window; the simulator's tick analog is 20 ticks — same shape, same rotation, just
 * the simulator's clock unit. Scenarios/tests pin a fake `nowTick`, so this never gates
 * on real time.
 */
export const EVENT_WINDOW_TICKS = 20;

/** Event lifecycle statuses (public-safe) — identical set to the product. */
export const EVENT_STATUSES = Object.freeze(['upcoming', 'active', 'ended', 'disabled']);

/** Event types — identical set to the product. */
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
 * Static per-room event schedule — mirrors the product EVENT_SCHEDULES byte-for-byte
 * (same room ids, schedule keys, types, featured cabinet ids, and per-room `phase`
 * desync). Display-only.
 */
export const EVENT_SCHEDULES = Object.freeze({
  'main-floor': {
    phase: 0,
    events: [
      { schedule_key: 'pulse-hour',          event_type: 'featured_cabinet', display_name: 'Pulse Hour',          description: 'Pulse Tap is in the spotlight on the main floor.',  featured_cabinet_id: 'pulse-tap-01',     sort_order: 1 },
      { schedule_key: 'signal-sprint-relay', event_type: 'featured_cabinet', display_name: 'Signal Sprint Relay', description: 'Ride the Signal Sprint lane — featured this window.', featured_cabinet_id: 'signal-sprint-01', sort_order: 2 },
      { schedule_key: 'neon-grid-rush',      event_type: 'featured_cabinet', display_name: 'Neon Grid Rush',      description: 'Neon Grid takes the marquee — match the path.',      featured_cabinet_id: 'neon-grid-01',     sort_order: 3 },
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
      { schedule_key: 'late-night-circuit', event_type: 'late_night_theme', display_name: 'Late Night Circuit', description: 'The after-hours theme is on across the room.',  featured_cabinet_id: null,               sort_order: 1 },
      { schedule_key: 'signal-afterdark',   event_type: 'late_night_theme', display_name: 'Signal Afterdark',   description: 'Signal Sprint under the late-night lights.',    featured_cabinet_id: 'signal-sprint-01', sort_order: 2 },
      { schedule_key: 'neon-grid-rush',     event_type: 'featured_cabinet', display_name: 'Neon Grid Rush',     description: 'Neon Grid takes the marquee — match the path.', featured_cabinet_id: 'neon-grid-01',     sort_order: 3 },
    ],
  },
});

/** True if the room has a configured event schedule. */
export function hasRoomEvents(roomId) {
  return typeof roomId === 'string' && Object.prototype.hasOwnProperty.call(EVENT_SCHEDULES, roomId);
}

/** PURE: the window index for a logical tick (deterministic, no drift). */
export function windowIndexFor(nowTick) {
  return Math.floor((Number(nowTick) || 0) / EVENT_WINDOW_TICKS);
}

/** PURE: the rotation slot a room shows at `windowIndex` (room phase desyncs rooms). */
function slotFor(schedule, windowIndex) {
  const k = schedule.events.length;
  if (k === 0) return -1;
  const phase = Number(schedule.phase) || 0;
  return (((windowIndex + phase) % k) + k) % k;
}

/**
 * PURE: resolve a featured cabinet id to a public-safe annotation. Fail-safe: an
 * unknown / not-live-ticketed cabinet collapses to nulls so the event still displays
 * as a room event but carries no cabinet annotation.
 */
function resolveFeatured(featuredCabinetId) {
  if (typeof featuredCabinetId !== 'string' || !featuredCabinetId) return { id: null, type: null };
  if (!isLiveTicketed(featuredCabinetId)) return { id: null, type: null };
  const cab = getCabinet(featuredCabinetId);
  return { id: cab.cabinet_id, type: cab.cabinet_type };
}

/**
 * PURE: derive an event's status from its window bounds + `nowTick`.
 *   disabled def           -> disabled
 *   nowTick <  starts_at    -> upcoming
 *   starts_at <= now < ends -> active
 *   nowTick >= ends_at      -> ended
 */
export function deriveEventStatus(event, nowTick) {
  if (!event) return 'disabled';
  if (event.disabled === true) return 'disabled';
  const t = Number(nowTick) || 0;
  if (t < event.starts_at_tick) return 'upcoming';
  if (t >= event.ends_at_tick) return 'ended';
  return 'active';
}

/**
 * PURE: build a full PUBLIC-SAFE event object for a room's `def` at `windowIndex`.
 * `event_id` is stable within a window and flips across windows (the transition basis
 * a future feed could compare). Carries NO private/fold data.
 */
function buildEvent(roomId, def, windowIndex, nowTick) {
  const startsAt = windowIndex * EVENT_WINDOW_TICKS;
  const endsAt = startsAt + EVENT_WINDOW_TICKS;
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
    starts_at_tick: startsAt,
    ends_at_tick: endsAt,
    duration_ticks: EVENT_WINDOW_TICKS,
    sort_order: def.sort_order,
    visibility: 'public',
    public_safe: true,
    ruleset_version: EVENT_RULESET_VERSION,
    disabled: def.enabled === false,
  };
  event.status = deriveEventStatus(event, nowTick);
  return event;
}

/** PURE: the room's currently-active event (or null for an unscheduled room). */
export function getCurrentRoomEvent(roomId, nowTick = 0) {
  const schedule = EVENT_SCHEDULES[roomId];
  if (!schedule) return null;
  const windowIndex = windowIndexFor(nowTick);
  const slot = slotFor(schedule, windowIndex);
  if (slot < 0) return null;
  const event = buildEvent(roomId, schedule.events[slot], windowIndex, nowTick);
  return event.status === 'disabled' ? null : event;
}

/** PURE: the room's next upcoming event (the following window's slot), or null. */
export function getNextRoomEvent(roomId, nowTick = 0) {
  const schedule = EVENT_SCHEDULES[roomId];
  if (!schedule) return null;
  const windowIndex = windowIndexFor(nowTick) + 1;
  const slot = slotFor(schedule, windowIndex);
  if (slot < 0) return null;
  const event = buildEvent(roomId, schedule.events[slot], windowIndex, nowTick);
  return event.status === 'disabled' ? null : event;
}

/**
 * PURE: the room's deterministic schedule view (one full rotation from the current
 * window), each a public-safe event with computed window + status. Empty for an
 * unscheduled room; disabled slots omitted.
 */
export function getRoomEventSchedule(roomId, nowTick = 0) {
  const schedule = EVENT_SCHEDULES[roomId];
  if (!schedule) return [];
  const base = windowIndexFor(nowTick);
  const k = schedule.events.length;
  const out = [];
  for (let i = 0; i < k; i += 1) {
    const windowIndex = base + i;
    const slot = slotFor(schedule, windowIndex);
    if (slot < 0) continue;
    const event = buildEvent(roomId, schedule.events[slot], windowIndex, nowTick);
    if (event.status !== 'disabled') out.push(event);
  }
  return out;
}

/**
 * PURE: compact public event fields to MERGE into a room-list entry. Safe nulls for an
 * unscheduled room. `event_ends_in_ticks` / `event_starts_in_ticks` are the tick
 * analogs of the product's `_ms` countdowns.
 */
export function roomEventPublic(roomId, nowTick = 0) {
  const t = Number(nowTick) || 0;
  const current = getCurrentRoomEvent(roomId, t);
  const next = getNextRoomEvent(roomId, t);
  return {
    current_event: current,
    next_event: next,
    event_ends_in_ticks: current ? Math.max(0, current.ends_at_tick - t) : null,
    event_starts_in_ticks: next ? Math.max(0, next.starts_at_tick - t) : null,
    featured_cabinet_id: current ? current.featured_cabinet_id : null,
  };
}

/**
 * PURE: enrich a v0.3 presence list payload with per-room event fields. Returns a NEW
 * payload (never mutates). Mirrors the product `attachRoomEvents` used by the
 * RoomRegistry DO + dev shim.
 */
export function attachRoomEvents(presenceList, nowTick = 0) {
  if (!presenceList || !Array.isArray(presenceList.rooms)) return presenceList;
  const t = Number(nowTick) || 0;
  return {
    ...presenceList,
    event_ruleset_version: EVENT_RULESET_VERSION,
    rooms: presenceList.rooms.map((r) => (r && r.room_id ? { ...r, ...roomEventPublic(r.room_id, t) } : r)),
  };
}

/** PURE: a room's full event read payload (current + next + one-rotation schedule). */
export function roomEventListPayload(roomId, nowTick = 0) {
  const t = Number(nowTick) || 0;
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
 * room's current event. Returns a NEW payload (never mutates). Adds only `is_featured`
 * / `featured_reason` / `featured_event_id` — never changes a ticket formula, a
 * cabinet's status/availability, or a reward. Fail-safe when no valid featured cabinet.
 */
export function annotateCatalogForRoom(catalogPayload, roomId, nowTick = 0) {
  if (!catalogPayload || !Array.isArray(catalogPayload.cabinets)) return catalogPayload;
  const current = getCurrentRoomEvent(roomId, nowTick);
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
