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

// ===================== v0.6: live room-event feed transitions =====================
//
// SIMULATOR-LOCAL PORT of the product Phase 2f transition engine
// (workers/arcade/src/room-events.mjs). PURE, deterministic, tick-clocked.
//
// v0.5 reserved the transition sideband keys but did NOT emit transitions. v0.6 EMITS
// them: a `room_event_transition_check` fabric event (folded by the arcade reducer)
// observes a room's schedule at a tick and, comparing the room's per-room transition
// tracker against the current event, appends public-safe feed entries for started /
// ended / featured_cabinet_changed — once each, deduped by event id. Because the
// Sideband CRDT Log folds canonically, the same set of observation events converges to
// the same feed + tracker regardless of arrival order.
//
// Display-only: a transition carries NO economy and NO private data — only the public
// event id / name / featured cabinet. No reward, no multiplier, no balance, no ledger.

/** Transition kinds → public feed event types (the only three v0.6 feed types). */
export const ROOM_EVENT_FEED_TYPES = Object.freeze({
  started: 'room_event_started',
  ended: 'room_event_ended',
  featured_changed: 'featured_cabinet_changed',
});

/** Feed type → sideband (room-wide start/end ride `weather`; featured rides `discovery`). */
export const ROOM_EVENT_FEED_SIDEBAND = Object.freeze({
  room_event_started: 'weather',
  room_event_ended: 'weather',
  featured_cabinet_changed: 'discovery',
});

/**
 * PURE: the initial, empty per-room transition tracker (public-safe). `generation` is
 * carried so a room reset (which installs a fresh tracker) is observable + an old event
 * never replays. `last_transition_checked_tick` enforces monotonic (forward-only)
 * observation so a stale/out-of-order check is a no-op.
 */
export function initialRoomEventTracker(generation = 0) {
  return {
    active: null,                       // { event_id, display_name, featured_cabinet_id, featured_cabinet_type } | null
    started_announced_id: null,         // last event id a 'started' was announced for
    ended_announced_id: null,           // last event id an 'ended' was announced for
    featured_announced_event_id: null,  // event id a 'featured_changed' was announced for
    last_transition_checked_tick: -1,   // highest observe_tick folded (monotonic guard)
    generation: Math.max(0, Number(generation) || 0),
  };
}

/** A compact, public-safe snapshot of an event for the tracker (no economy/private fields). */
function eventSnapshot(event) {
  return event ? {
    event_id: event.event_id,
    display_name: event.display_name,
    featured_cabinet_id: event.featured_cabinet_id,
    featured_cabinet_type: event.featured_cabinet_type,
  } : null;
}

/** PURE: a public-safe summary string for a transition (never money-like). */
export function publicRoomEventSummary(transitionType, snap) {
  if (transitionType === 'started') return `${snap.display_name} started.`;
  if (transitionType === 'ended') return `${snap.display_name} ended.`;
  // featured_changed — resolve the featured cabinet's display name (fail-safe).
  const cab = snap.featured_cabinet_id ? getCabinet(snap.featured_cabinet_id) : null;
  return cab ? `${snap.display_name} is now featuring ${cab.display_name}.`
             : `${snap.display_name} featured cabinet updated.`;
}

/** PURE: build a public-safe transition object from a kind + an event snapshot. */
function makeTransition(transitionType, snap, roomId, observeTick) {
  const feedType = ROOM_EVENT_FEED_TYPES[transitionType];
  return {
    transition_type: transitionType,
    event_id: snap.event_id,
    room_id: roomId,
    display_name: snap.display_name,
    featured_cabinet_id: snap.featured_cabinet_id ?? null,
    featured_cabinet_type: snap.featured_cabinet_type ?? null,
    occurred_tick: Number(observeTick) || 0,
    public_safe_summary: publicRoomEventSummary(transitionType, snap),
    sideband: ROOM_EVENT_FEED_SIDEBAND[feedType] || 'weather',
  };
}

/**
 * PURE: apply a derived transition list to a tracker, producing the NEW tracker. Updates
 * the dedup ids from the transitions, snapshots the current active event, and advances
 * the monotonic checked-tick. (Split out per the v0.6 spec; deriveRoomEventTransitions
 * calls it, so there is a single source of truth for tracker updates.)
 */
export function applyRoomEventTransitions(prevTracker, transitions, currentEvent, observeTick) {
  const prev = prevTracker || initialRoomEventTracker();
  let started = prev.started_announced_id;
  let ended = prev.ended_announced_id;
  let featured = prev.featured_announced_event_id;
  for (const tr of (transitions || [])) {
    if (tr.transition_type === 'started') started = tr.event_id;
    else if (tr.transition_type === 'ended') ended = tr.event_id;
    else if (tr.transition_type === 'featured_changed') featured = tr.event_id;
  }
  return {
    active: eventSnapshot(currentEvent),
    started_announced_id: started,
    ended_announced_id: ended,
    featured_announced_event_id: featured,
    last_transition_checked_tick: Math.max(Number(observeTick) || 0, Number(prev.last_transition_checked_tick) || -1),
    generation: prev.generation,
  };
}

/**
 * PURE: given the previous tracker, derive the room-event transitions that have occurred
 * as of `observeTick`, plus the NEW tracker. Deterministic + idempotent: re-deriving at
 * the same tick with the returned tracker yields `{ transitions: [], changed: false }`.
 *
 *   no active → active            => started
 *   active → different active     => ended(old) + started(new) [+ featured_changed if the
 *                                     featured cabinet differs]
 *   active → same active          => none
 * A reset installs a fresh tracker (initialRoomEventTracker), so an old event never
 * replays; the current event is announced once more after a reset, then deduped.
 */
export function deriveRoomEventTransitions(prevTracker, roomId, observeTick) {
  const prev = prevTracker || initialRoomEventTracker();
  const t = Number(observeTick) || 0;
  const current = getCurrentRoomEvent(roomId, t); // active event (or null)
  const curId = current ? current.event_id : null;
  const prevActive = prev.active;
  const prevId = prevActive ? prevActive.event_id : null;

  const transitions = [];
  const activeChanged = prevId !== curId;

  // The previously-active event is no longer active → it ended (announce once).
  if (activeChanged && prevActive && prev.ended_announced_id !== prevActive.event_id) {
    transitions.push(makeTransition('ended', prevActive, roomId, t));
  }
  // A (new) active event is in effect → it started (announce once per window).
  if (current && prev.started_announced_id !== curId) {
    transitions.push(makeTransition('started', eventSnapshot(current), roomId, t));
  }
  // The featured cabinet changed between two different events (announce once) — skipped
  // on first observation (no prevActive) since 'started' already conveys the cabinet.
  if (activeChanged && current && current.featured_cabinet_id && prevActive
      && current.featured_cabinet_id !== prevActive.featured_cabinet_id
      && prev.featured_announced_event_id !== curId) {
    transitions.push(makeTransition('featured_changed', eventSnapshot(current), roomId, t));
  }

  const state = applyRoomEventTransitions(prev, transitions, current, t);
  return { transitions, state, changed: transitions.length > 0 };
}

/**
 * PURE: shape a transition into the simulator's public feed envelope used by appendFeed
 * (feed.mjs). `actor: 'system'` marks a room-authored announcement (not a player), so it
 * never carries a private actor id; `source: 'room_events'` tags its origin.
 */
export function roomEventFeedEntryForTransition(transition) {
  return {
    type: ROOM_EVENT_FEED_TYPES[transition.transition_type],
    actor: 'system',
    summary: transition.public_safe_summary,
    source: 'room_events',
    tick: transition.occurred_tick,
  };
}
