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

/**
 * Phase 2g: how long BEFORE the next event begins it is announced as "upcoming"
 * (pre-roll). When the next event is within this lead of starting, the room feed gets a
 * one-time `room_event_upcoming` announcement and the lobby/floor show a live countdown.
 * Display-only — no reward, no ticket change. Tests inject a fake `now`.
 */
export const PREROLL_LEAD_MS = 2 * 60 * 1000; // 2 minutes (default pre-roll lead)

// ===================== Phase 2h: operator-tunable event presentation =====================
//
// DISPLAY-ONLY presentation knobs an operator can tune (server-side, via env — never by a
// user, never per-request). They change ONLY how events are presented: the pre-roll lead,
// how often the client refreshes the live countdown, and whether the next-event preview /
// featured chip are shown. They NEVER touch the schedule's economic neutrality — no ticket
// formula, prize cost, reward, challenge, or authority. Resolution is pure + validated +
// clamped to safe bounds, falling back to defaults on any bad value (fail-safe).

/** Safe bounds for the tunable presentation values. */
export const PRESENTATION_BOUNDS = Object.freeze({
  preroll_lead_ms: { min: 10 * 1000, max: EVENT_WINDOW_MS - 1000 },   // 10s … (window − 1s)
  countdown_refresh_ms: { min: 250, max: 60 * 1000 },                 // 0.25s … 60s
});

/** The default presentation config (matches Phase 2g behaviour). */
export const DEFAULT_EVENT_PRESENTATION = Object.freeze({
  preroll_lead_ms: PREROLL_LEAD_MS,
  countdown_refresh_ms: 1000,
  show_next_event: true,
  show_featured_chip: true,
});

function clampInt(value, fallback, { min, max }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}
function coerceBool(value, fallback) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return fallback;
}

/**
 * PURE: resolve + VALIDATE an operator presentation override into a safe, frozen config.
 * Unknown / out-of-range / malformed values fall back to (or clamp toward) the defaults —
 * a bad operator value can never break event presentation or leak into economy.
 */
export function resolveEventPresentation(overrides = {}) {
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  return Object.freeze({
    preroll_lead_ms: clampInt(o.preroll_lead_ms, DEFAULT_EVENT_PRESENTATION.preroll_lead_ms, PRESENTATION_BOUNDS.preroll_lead_ms),
    countdown_refresh_ms: clampInt(o.countdown_refresh_ms, DEFAULT_EVENT_PRESENTATION.countdown_refresh_ms, PRESENTATION_BOUNDS.countdown_refresh_ms),
    show_next_event: coerceBool(o.show_next_event, DEFAULT_EVENT_PRESENTATION.show_next_event),
    show_featured_chip: coerceBool(o.show_featured_chip, DEFAULT_EVENT_PRESENTATION.show_featured_chip),
  });
}

/**
 * PURE: read presentation overrides from an env-like object (operator config). Keys:
 *   EVENT_PREROLL_LEAD_MS, EVENT_COUNTDOWN_REFRESH_MS, EVENT_SHOW_NEXT, EVENT_SHOW_FEATURED.
 * Absent keys → defaults. Same validation as resolveEventPresentation.
 */
export function eventPresentationFromEnv(env = {}) {
  const e = env || {};
  return resolveEventPresentation({
    preroll_lead_ms: e.EVENT_PREROLL_LEAD_MS,
    countdown_refresh_ms: e.EVENT_COUNTDOWN_REFRESH_MS,
    show_next_event: e.EVENT_SHOW_NEXT,
    show_featured_chip: e.EVENT_SHOW_FEATURED,
  });
}

/** The public-safe presentation block surfaced to clients (display hints only). */
export function publicPresentation(config = DEFAULT_EVENT_PRESENTATION) {
  const c = config || DEFAULT_EVENT_PRESENTATION;
  return {
    preroll_lead_ms: c.preroll_lead_ms,
    countdown_refresh_ms: c.countdown_refresh_ms,
    show_next_event: c.show_next_event,
    show_featured_chip: c.show_featured_chip,
  };
}

// ===================== Phase 2i: per-room presentation overrides (live ops) =====================
//
// The Phase 2h env config is the per-deploy BASE. Phase 2i lets an admin set a DISPLAY-ONLY
// PER-ROOM override on top of it (validated + clamped, both-gated). The effective config a
// room presents = base merged with that room's override. Still no economy/authority effect.

/** The tunable presentation keys (the only fields an override may carry). */
export const PRESENTATION_KEYS = Object.freeze(['preroll_lead_ms', 'countdown_refresh_ms', 'show_next_event', 'show_featured_chip']);

const isValidNumericOverride = (v) => Number.isFinite(Number(v));
const isValidBoolOverride = (v) => v === true || v === false || v === 'true' || v === 'false' || v === 0 || v === 1 || v === '0' || v === '1';

/**
 * PURE: keep only the KNOWN, PRESENT, VALID keys of a raw override. Unknown/empty keys and
 * keys whose value would not validate are DROPPED, so an invalid override key falls through
 * to the base rather than being stored as a default.
 */
function presentKeys(override) {
  const out = {};
  if (override == null || typeof override !== 'object') return out;
  for (const k of PRESENTATION_KEYS) {
    if (!(k in override)) continue;
    const v = override[k];
    if (v === undefined || v === null || v === '') continue;
    if ((k === 'preroll_lead_ms' || k === 'countdown_refresh_ms') && !isValidNumericOverride(v)) continue;
    if ((k === 'show_next_event' || k === 'show_featured_chip') && !isValidBoolOverride(v)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * PURE: sanitize a raw admin override into the partial that is SAFE TO STORE — only the
 * keys the admin actually set, each validated/clamped (round-tripped through
 * resolveEventPresentation). Invalid/unknown keys are dropped, so a bad value can never be
 * persisted. An empty/garbage override sanitizes to `{}` (i.e. "no override").
 */
export function sanitizeEventPresentationOverride(override) {
  const present = presentKeys(override);
  const resolved = resolveEventPresentation(present); // fills + validates
  const out = {};
  for (const k of Object.keys(present)) out[k] = resolved[k]; // keep only the set keys, clamped
  return out;
}

/**
 * PURE: the EFFECTIVE presentation config for a room = base config with its (sanitized)
 * override applied on top, re-validated. Missing override keys fall through to the base.
 * Returns a frozen config (same shape as resolveEventPresentation).
 */
export function mergeEventPresentation(base, override) {
  const b = base || DEFAULT_EVENT_PRESENTATION;
  return resolveEventPresentation({ ...publicPresentation(b), ...presentKeys(override) });
}

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
export function roomEventPublic(roomId, now = Date.now(), config = DEFAULT_EVENT_PRESENTATION) {
  const t = Number(now) || 0;
  const lead = (config || DEFAULT_EVENT_PRESENTATION).preroll_lead_ms;
  const current = getCurrentRoomEvent(roomId, t);
  const next = getNextRoomEvent(roomId, t);
  const startsInMs = next ? Math.max(0, next.starts_at - t) : null;
  return {
    current_event: current,
    next_event: next,
    event_ends_in_ms: current ? Math.max(0, current.ends_at - t) : null,
    event_starts_in_ms: startsInMs,
    featured_cabinet_id: current ? current.featured_cabinet_id : null,
    // Phase 2g: the next event is within the (operator-tunable, Phase 2h) pre-roll lead.
    event_upcoming: !!next && next.starts_at > t && (next.starts_at - t) <= lead,
  };
}

/**
 * PURE: enrich a Phase 2c presence list payload with per-room event fields + the public
 * presentation config (Phase 2h). Returns a NEW payload (never mutates). Used identically
 * by the RoomRegistry DO and the dev shim, so every client sees the same events + config.
 *
 * Phase 2i: `config` may be a per-room RESOLVER `(roomId) => config` so each room reflects
 * its own EFFECTIVE (base + override) presentation; a plain config object applies globally
 * (the Phase 2h behaviour). The top-level `presentation` is the BASE (resolver(null)).
 */
export function attachRoomEvents(presenceList, now = Date.now(), config = DEFAULT_EVENT_PRESENTATION) {
  if (!presenceList || !Array.isArray(presenceList.rooms)) return presenceList;
  const t = Number(now) || 0;
  const resolve = typeof config === 'function' ? config : () => (config || DEFAULT_EVENT_PRESENTATION);
  const base = resolve(null) || DEFAULT_EVENT_PRESENTATION;
  return {
    ...presenceList,
    event_ruleset_version: EVENT_RULESET_VERSION,
    presentation: publicPresentation(base),
    rooms: presenceList.rooms.map((r) => {
      if (!r || !r.room_id) return r;
      const cfg = resolve(r.room_id) || base;
      return { ...r, ...roomEventPublic(r.room_id, t, cfg), presentation: publicPresentation(cfg) };
    }),
  };
}

/**
 * PURE: a room's full event read payload (current + next + one-rotation schedule) + the
 * public presentation config (Phase 2h). Public-safe; never includes private player data.
 */
export function roomEventListPayload(roomId, now = Date.now(), config = DEFAULT_EVENT_PRESENTATION) {
  const t = Number(now) || 0;
  const cfg = config || DEFAULT_EVENT_PRESENTATION;
  const current = getCurrentRoomEvent(roomId, t);
  const next = getNextRoomEvent(roomId, t);
  return {
    room_id: roomId,
    event_ruleset_version: EVENT_RULESET_VERSION,
    current_event: current,
    next_event: next,
    schedule: getRoomEventSchedule(roomId, t),
    // Phase 2g: pre-roll countdown info so the floor can render "up next in …".
    event_ends_in_ms: current ? Math.max(0, current.ends_at - t) : null,
    event_starts_in_ms: next ? Math.max(0, next.starts_at - t) : null,
    event_upcoming: !!next && next.starts_at > t && (next.starts_at - t) <= cfg.preroll_lead_ms,
    // Phase 2h: the operator-tunable presentation config (display hints; drives the
    // client live-countdown refresh + which previews are shown).
    presentation: publicPresentation(cfg),
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

// ===================== Phase 2f: live room-event feed transitions =====================
//
// Phase 2e deferred live start/end feed announcements to keep the DO/shim feeds in
// parity (the DO has a 30s alarm; the shim has no timer). Phase 2f resolves this by
// making transition detection a PURE function of (previous tracker state + roomId +
// now): the SAME engine runs on the DO, the dev shim, and the unit tests, driven at
// deterministic access points (room request / alarm) with id-based dedup. Whoever
// checks first announces the transition once; later checks at the same `now` see the
// dedup ids and emit nothing — so the feed never spams and both runtimes converge.
//
// Display-only: a transition carries NO economy and NO private data — only the public
// event id / name / featured cabinet. No reward, no multiplier, no balance, no ledger.

/** Transition kinds → public feed event types (Phase 2f + the Phase 2g pre-roll). */
export const ROOM_EVENT_FEED_TYPES = Object.freeze({
  started: 'room_event_started',
  ended: 'room_event_ended',
  featured_changed: 'featured_cabinet_changed',
  upcoming: 'room_event_upcoming',
});

/** PURE: the initial, empty per-room transition tracker (public-safe). */
export function initialEventTracker() {
  return {
    active: null,                       // { event_id, display_name, featured_cabinet_id, featured_cabinet_type } | null
    started_announced_id: null,         // last event id a 'started' was announced for
    ended_announced_id: null,           // last event id an 'ended' was announced for
    featured_announced_event_id: null,  // event id a 'featured_changed' was announced for
    upcoming_announced_id: null,        // Phase 2g: next event id a pre-roll was announced for
    checked_at: 0,
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
  if (transitionType === 'upcoming') return `${snap.display_name} is up next.`;
  // featured_changed — resolve the featured cabinet's display name (fail-safe).
  const cab = snap.featured_cabinet_id ? getCabinet(snap.featured_cabinet_id) : null;
  return cab ? `${snap.display_name} is now featuring ${cab.display_name}.`
             : `${snap.display_name} featured cabinet updated.`;
}

/** PURE: build a public-safe transition object from a kind + an event snapshot. */
function makeTransition(transitionType, snap, roomId, now) {
  return {
    transition_type: transitionType,
    event_id: snap.event_id,
    room_id: roomId,
    display_name: snap.display_name,
    featured_cabinet_id: snap.featured_cabinet_id ?? null,
    featured_cabinet_type: snap.featured_cabinet_type ?? null,
    occurred_at: Number(now) || 0,
    public_safe_summary: publicRoomEventSummary(transitionType, snap),
  };
}

/**
 * PURE: given the previous tracker state, derive the room-event transitions that have
 * occurred as of `now`, plus the NEW tracker state. Deterministic + idempotent: calling
 * again at the same `now` with the returned state yields `{ transitions: [], changed:
 * false }` (the dedup guarantee the spam tests rely on).
 *
 *   no active → active            => started
 *   active → different active     => ended(old) + started(new) [+ featured_changed if the
 *                                     featured cabinet differs]
 *   active → same active          => none
 * Reset clears the tracker (pass initialEventTracker()), so an old event never replays;
 * the current event is announced once more after a reset, then deduped.
 */
export function deriveRoomEventTransitions(prevState, roomId, now, config = DEFAULT_EVENT_PRESENTATION) {
  const prev = prevState || initialEventTracker();
  const t = Number(now) || 0;
  const prerollLead = (config || DEFAULT_EVENT_PRESENTATION).preroll_lead_ms;
  const current = getCurrentRoomEvent(roomId, t); // active event (or null)
  const curId = current ? current.event_id : null;
  const prevActive = prev.active;
  const prevId = prevActive ? prevActive.event_id : null;

  const transitions = [];
  let startedAnn = prev.started_announced_id;
  let endedAnn = prev.ended_announced_id;
  let featuredAnn = prev.featured_announced_event_id;
  let upcomingAnn = prev.upcoming_announced_id ?? null; // ?? null migrates pre-2g trackers
  const activeChanged = prevId !== curId;

  // The previously-active event is no longer active → it ended (announce once).
  if (activeChanged && prevActive && endedAnn !== prevActive.event_id) {
    transitions.push(makeTransition('ended', prevActive, roomId, t));
    endedAnn = prevActive.event_id;
  }
  // A (new) active event is in effect → it started (announce once per window).
  if (current && startedAnn !== curId) {
    transitions.push(makeTransition('started', eventSnapshot(current), roomId, t));
    startedAnn = curId;
  }
  // The featured cabinet changed between two different events (announce once) — skipped
  // on first observation (no prevActive) since 'started' already conveys the cabinet.
  if (activeChanged && current && current.featured_cabinet_id && prevActive
      && current.featured_cabinet_id !== prevActive.featured_cabinet_id
      && featuredAnn !== curId) {
    transitions.push(makeTransition('featured_changed', eventSnapshot(current), roomId, t));
    featuredAnn = curId;
  }
  // Phase 2g: the NEXT event begins within the pre-roll lead → announce it as upcoming
  // (once per next-event window). Display-only; the live countdown is rendered client-side.
  const next = getNextRoomEvent(roomId, t);
  if (next && next.starts_at > t && (next.starts_at - t) <= prerollLead && upcomingAnn !== next.event_id) {
    transitions.push(makeTransition('upcoming', eventSnapshot(next), roomId, t));
    upcomingAnn = next.event_id;
  }

  const state = {
    active: eventSnapshot(current),
    started_announced_id: startedAnn,
    ended_announced_id: endedAnn,
    featured_announced_event_id: featuredAnn,
    upcoming_announced_id: upcomingAnn,
    checked_at: t,
  };
  return { transitions, state, changed: transitions.length > 0 };
}

/**
 * PURE: shape a transition into the existing public event-feed envelope used by
 * appendEvent (events.mjs). `actorPublicId: 'system'` marks a room-authored
 * announcement (not a player), so it never carries a private player id.
 */
export function roomEventFeedEntryForTransition(transition) {
  return {
    type: ROOM_EVENT_FEED_TYPES[transition.transition_type],
    actorPublicId: 'system',
    summary: transition.public_safe_summary,
    source: transition.event_id,
  };
}
