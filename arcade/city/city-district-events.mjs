/**
 * Neon Circuit — Scheduled District Events + Live Public Announcements (Phase 6A).
 *
 * PURE, deterministic, runtime-agnostic. Imported UNCHANGED by:
 *   - the browser scene   (arcade/city/city-scene.js)
 *   - the unit tests       (tests/arcade/city-district-events.test.mjs)
 *
 * The district already FUNCTIONS (Phase 5: routing, identity, presence, push deltas, activity
 * feed). Phase 6A adds a district PULSE so the world feels alive: a deterministic, display-only
 * schedule of atmosphere events ("Downtown Signal Surge", "Harbor Quiet Window") with a current
 * event, a next event, and bounded, deduped public announcements that flow into the existing
 * District Activity feed.
 *
 * STRICTLY DISPLAY/ATMOSPHERE. The schedule is a pure function of the wall clock + the STATIC block
 * manifest — nothing canonical depends on it, it reads NO server/player state, and it adds NO server
 * message, DO, migration, route, or protocol field (old clients are unaffected). It NEVER changes
 * rewards, tickets, Host Rank, Stewardship, Block Trial, prize values, or any economy — there is no
 * economy here at all. Every event is built through a fixed field ALLOWLIST; the only interpolated
 * value is a block's STATIC display name (city config). No player ids, balances, inventory, or admin.
 *
 * Determinism: time is bucketed into fixed WINDOW_MS windows; the (type, focus block) for a window
 * is a pure function of the window index, so every client computes the SAME current/next event and
 * the SAME stable event_id for a window. Reconnect/reload recompute from the current time; they do
 * not restore local history as canonical and they dedupe the current window so a reload cannot spam.
 *
 * Non-goals (Phase 6A): no economy/ownership/accounts/marketplace/paid-hosting, no rewards or
 * multipliers, no new DO/migration/route/server message, no client→server append, no HiveWorld
 * bridge. See docs/NEON_CIRCUIT_PHASE6A_DISTRICT_EVENTS.md.
 */
import { DISTRICT_ID } from './city-district.mjs';
import { CITY_IDS, getCity } from './city-block.mjs';

export const EVENT_SCHEMA = 1;

/** Each window runs WINDOW_MS; the pre-roll lead is how early "next" is announced as upcoming. */
export const WINDOW_MS = 5 * 60_000;        // 5 minutes per district window (default)
export const PREROLL_LEAD_MS = 60_000;      // announce the next window ~1 min before it starts
export const ANNOUNCE_MAX = 8;              // hard cap on a single announcement batch (bounded)

// ===================== Phase 6B: operator-tunable, server-authored config =====================
//
// The schedule stays a pure, deterministic function of the clock — Phase 6B lets the SERVER author
// the parameters (window size, enabled, show-next) and publish a public-safe snapshot in the
// existing city_blocks payload. Defaults reproduce Phase 6A exactly. The same pure functions run on
// the server (CityRoom / dev-shim) and the client, so both compute identical current/next events
// from the shared config — no per-transition push needed.

/** Safe bounds for operator-tunable values (clamped server-side; never silently out of range). */
export const DISTRICT_EVENT_BOUNDS = Object.freeze({
  window_ms: Object.freeze({ min: 60_000, max: 3_600_000 }),   // 1 min .. 1 hour
});

/** Default config — reproduces Phase 6A behaviour exactly. */
export const DEFAULT_DISTRICT_EVENT_CONFIG = Object.freeze({
  enabled: true,
  windowMs: WINDOW_MS,
  showNext: true,
});

function parseBoolish(v, dflt) {
  if (v === true || v === false) return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true') return true;
    if (s === 'false') return false;
  }
  return dflt;
}

function clampWindowMs(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return WINDOW_MS;
  const { min, max } = DISTRICT_EVENT_BOUNDS.window_ms;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/**
 * PURE: resolve an operator/env-shaped raw object into a validated, frozen config. Reads
 * DISTRICT_EVENT_{ENABLED,WINDOW_MS,SHOW_NEXT}; clamps the window to safe bounds; falls back to the
 * Phase 6A defaults for anything absent/invalid. Never mutates the input.
 */
export function resolveDistrictEventConfig(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return Object.freeze({
    enabled: parseBoolish(r.DISTRICT_EVENT_ENABLED, DEFAULT_DISTRICT_EVENT_CONFIG.enabled),
    windowMs: r.DISTRICT_EVENT_WINDOW_MS == null ? WINDOW_MS : clampWindowMs(r.DISTRICT_EVENT_WINDOW_MS),
    showNext: parseBoolish(r.DISTRICT_EVENT_SHOW_NEXT, DEFAULT_DISTRICT_EVENT_CONFIG.showNext),
  });
}

/** The effective, positive window size for a config (falls back to the default). */
function cfgWindowMs(config) {
  const w = config && Number.isFinite(config.windowMs) && config.windowMs > 0 ? config.windowMs : WINDOW_MS;
  return w;
}

/** The closed set of Phase 6A event types (display/atmosphere only). */
export const EVENT_TYPES = Object.freeze([
  'district_signal_surge',
  'district_quiet_window',
  'district_route_warmup',
  'district_arcade_hour',
  'district_block_focus',
]);

/** The closed set of event lifecycle statuses. */
export const EVENT_STATUSES = Object.freeze(['upcoming', 'active', 'ended']);

/** The ONLY fields an event object carries (the public-safety allowlist / choke point). */
const EVENT_FIELDS = Object.freeze([
  'schema_version', 'event_id', 'district_id', 'city_id',
  'type', 'status', 'starts_at', 'ends_at', 'label', 'summary', 'public_safe',
]);

/** Short, friendly block name for a label: "Downtown Block" → "Downtown". Static config only. */
function shortBlockName(displayName, cityId) {
  const s = typeof displayName === 'string' && displayName.trim() ? displayName.trim() : String(cityId || 'a block');
  const short = s.replace(/\s+Block$/i, '').trim() || s;
  return short.length > 40 ? short.slice(0, 40) : short;
}

/** Safe wall-clock coercion (callers pass an explicit `now` for deterministic tests). */
function clock(now) {
  return Number.isFinite(now) ? now : Date.now();
}

/** PURE: the window index for a time. Floor division into fixed `windowMs` buckets (default WINDOW_MS). */
export function windowIndexAt(now = Date.now(), windowMs = WINDOW_MS) {
  const w = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : WINDOW_MS;
  return Math.floor(clock(now) / w);
}

/** PURE: the [starts_at, ends_at) bounds of a window index (default WINDOW_MS window). */
export function windowBounds(index, windowMs = WINDOW_MS) {
  const w = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : WINDOW_MS;
  const i = Number.isFinite(index) ? Math.trunc(index) : 0;
  const starts_at = i * w;
  return { starts_at, ends_at: starts_at + w };
}

/** Deterministic, non-negative modulo selection from a frozen list. */
function pick(list, index) {
  const n = list.length;
  return list[(((Math.trunc(index) % n) + n) % n)];
}

/** PURE: the event TYPE for a window index (deterministic rotation). */
export function typeForWindow(index) {
  return pick(EVENT_TYPES, index);
}

/** PURE: the focus BLOCK id for a window index (deterministic rotation). */
export function blockForWindow(index) {
  return pick(CITY_IDS, index);
}

/** PURE: stable event id for a window — same window → same id; next window → different id. */
export function eventId(index, type, cityId) {
  return `district:window:${Math.trunc(index)}:${type}:${cityId}`;
}

/** PURE: the observational, public-safe label for a type. Only the static `name` is interpolated. */
export function eventLabel(type, name) {
  switch (type) {
    case 'district_signal_surge': return `${name} Signal Surge`;
    case 'district_quiet_window': return `${name} Quiet Window`;
    case 'district_route_warmup': return `${name} Route Warmup`;
    case 'district_arcade_hour': return `${name} Arcade Hour`;
    case 'district_block_focus': return `${name} Focus`;
    default: return `${name} Window`;
  }
}

/** PURE: the observational, public-safe one-line summary for a type. Only `name` is interpolated. */
export function eventSummary(type, name) {
  switch (type) {
    case 'district_signal_surge': return `${name} is the focus block for this district window.`;
    case 'district_quiet_window': return `${name} is winding down this window.`;
    case 'district_route_warmup': return `Routes into ${name} are warming up.`;
    case 'district_arcade_hour': return `Cabinets in ${name} are lively this window.`;
    case 'district_block_focus': return `${name} is the spotlight block this window.`;
    default: return `${name} is the focus block this window.`;
  }
}

/**
 * PURE: build the public-safe event object for a window index + status, re-projected through the
 * field allowlist. Returns null for an unknown focus block (fail-safe). Reads ONLY static city
 * config + computed window times — no player/server/private data can reach the object.
 */
export function buildDistrictEvent(index, status, now = Date.now(), windowMs = WINDOW_MS) {
  if (!EVENT_STATUSES.includes(status)) return null;
  const cityId = blockForWindow(index);
  const c = getCity(cityId);
  if (!c) return null;                       // unknown/invalid block → no event (fail-safe)
  const type = typeForWindow(index);
  const name = shortBlockName(c.display_name, cityId);
  const { starts_at, ends_at } = windowBounds(index, windowMs);
  const event = {
    schema_version: EVENT_SCHEMA,
    event_id: eventId(index, type, cityId),
    district_id: DISTRICT_ID,
    city_id: cityId,
    type,
    status,
    starts_at,
    ends_at,
    label: eventLabel(type, name),
    summary: eventSummary(type, name),
    public_safe: true,
  };
  // Freeze + guarantee only allowlisted fields exist (defensive: never widen the wire shape).
  for (const k of Object.keys(event)) if (!EVENT_FIELDS.includes(k)) delete event[k];
  return Object.freeze(event);
}

/** PURE: the currently-active district event (status 'active'). */
export function currentDistrictEvent(now = Date.now(), config = DEFAULT_DISTRICT_EVENT_CONFIG) {
  const w = cfgWindowMs(config);
  return buildDistrictEvent(windowIndexAt(now, w), 'active', now, w);
}

/** PURE: the next district event (status 'upcoming'). */
export function nextDistrictEvent(now = Date.now(), config = DEFAULT_DISTRICT_EVENT_CONFIG) {
  const w = cfgWindowMs(config);
  return buildDistrictEvent(windowIndexAt(now, w) + 1, 'upcoming', now, w);
}

/**
 * PURE: the district-event window view for `now` — the current + next event, time remaining in the
 * current window, and whether the next window is within the pre-roll lead. Display-only; bounded.
 * `config` (Phase 6B) tunes the window size; defaults reproduce Phase 6A.
 */
export function districtEventWindow(now = Date.now(), config = DEFAULT_DISTRICT_EVENT_CONFIG) {
  const w = cfgWindowMs(config);
  const t = clock(now);
  const index = windowIndexAt(t, w);
  const { starts_at, ends_at } = windowBounds(index, w);
  const ms_remaining = Math.max(0, ends_at - t);
  return {
    index,
    starts_at,
    ends_at,
    ms_remaining,
    preroll: ms_remaining <= PREROLL_LEAD_MS,
    current: buildDistrictEvent(index, 'active', t, w),
    next: buildDistrictEvent(index + 1, 'upcoming', t, w),
  };
}

/** A unique announcement key for an (event, status) pair — the dedupe identity. */
function announceKey(event) {
  return `${event.event_id}#${event.status}`;
}

/**
 * PURE: derive the NEW public announcements due at `now`, skipping anything already announced. The
 * caller owns the `announced` set (a Set or array of keys) so reconnect/reload do not re-announce
 * the current window. Returns { events, keys } — `events` are the new event objects to surface and
 * `keys` are their dedupe keys (add them to your set). Bounded to ANNOUNCE_MAX.
 *
 * Order of consideration (newest-relevant first): a just-ended previous window (only if its active
 * was already announced — so a cold load never surfaces a stale "ended"), the current active window,
 * and the next window once it is within the pre-roll lead.
 */
export function deriveDistrictAnnouncements(now = Date.now(), announced = null, config = DEFAULT_DISTRICT_EVENT_CONFIG) {
  const w = cfgWindowMs(config);
  const t = clock(now);
  const seen = announced instanceof Set
    ? announced
    : new Set(Array.isArray(announced) ? announced : []);
  const index = windowIndexAt(t, w);
  const { ends_at } = windowBounds(index, w);
  const events = [];
  const keys = [];
  const consider = (event) => {
    if (!event || events.length >= ANNOUNCE_MAX) return;
    const key = announceKey(event);
    if (seen.has(key)) return;
    events.push(event);
    keys.push(key);
  };

  // ended: the immediately-previous window — only if we already announced it active (witnessed it).
  const ended = buildDistrictEvent(index - 1, 'ended', t, w);
  if (ended && seen.has(`${ended.event_id}#active`)) consider(ended);
  // active: the current window.
  consider(buildDistrictEvent(index, 'active', t, w));
  // upcoming: the next window, once it is within the pre-roll lead.
  if (ends_at - t <= PREROLL_LEAD_MS) consider(buildDistrictEvent(index + 1, 'upcoming', t, w));

  return { events, keys };
}

// ===================== Phase 6B: server-authored public-safe event snapshot =====================

/** The fields the public event snapshot carries (the wire allowlist). */
const SNAPSHOT_FIELDS = Object.freeze([
  'schema_version', 'enabled', 'window_ms', 'show_next', 'server_time', 'current', 'next',
]);

/**
 * PURE: build the public-safe district-event snapshot the SERVER publishes in the existing
 * city_blocks payload (Phase 6B). `current`/`next` are the same allowlisted event objects the
 * client would derive locally — the server is authoritative, the client just displays. When the
 * feature is disabled, `current`/`next` are null. `server_time` lets clients align countdowns to the
 * server clock. Carries no player/private data (only static block names + computed window times).
 */
export function districtEventSnapshot(now = Date.now(), config = DEFAULT_DISTRICT_EVENT_CONFIG) {
  const cfg = config && typeof config === 'object' ? config : DEFAULT_DISTRICT_EVENT_CONFIG;
  const w = cfgWindowMs(cfg);
  const t = clock(now);
  const enabled = cfg.enabled !== false;
  const showNext = cfg.showNext !== false;
  const win = enabled ? districtEventWindow(t, cfg) : null;
  const snapshot = {
    schema_version: EVENT_SCHEMA,
    enabled,
    window_ms: w,
    show_next: showNext,
    server_time: t,
    current: win ? win.current : null,
    next: win && showNext ? win.next : null,
  };
  for (const k of Object.keys(snapshot)) if (!SNAPSHOT_FIELDS.includes(k)) delete snapshot[k];
  return Object.freeze(snapshot);
}
