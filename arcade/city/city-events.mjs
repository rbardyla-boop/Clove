/**
 * Neon Circuit — City Block append-only world event log (Phase 4C), PURE.
 *
 * A bounded, append-only log of SERVER-AUTHORED, public-safe city facts (joins,
 * leaves, portal request/accept/reject, arcade-interior open/close). It is the first
 * durable-feeling living-world primitive and the seam future phases read from
 * (4D Hive Scheduler, 4E Host Rank) — WITHOUT any of those being built here.
 *
 * Authority: the SERVER authors every event. This module never reads a client-
 * supplied event id, sequence, or timestamp — `appendCityEvent` assigns all three
 * itself. Payloads are filtered to a public-safe allowlist, so no private/economy
 * data (balance, ledger, inventory, admin, raw connection ids) can ever ride an
 * event. Isolated from the arcade economy feed (workers/arcade/src/events.mjs).
 *
 * Imported by the CityRoom DO, the city dev shim, the unit tests, and the browser.
 */
import { SCHEMA_VERSION } from './city-block.mjs';

/** Keep the log bounded so per-room state stays small. */
export const MAX_CITY_EVENTS = 50;

/** The Phase 4C event types. No per-move logging — these are discrete world facts. */
export const EVENT_TYPES = Object.freeze([
  'city_player_joined',
  'city_player_left',
  'city_portal_enter_requested',
  'city_portal_enter_accepted',
  'city_portal_enter_rejected',
  'city_arcade_interior_opened',
  'city_arcade_interior_closed',
]);
const TYPE_SET = new Set(EVENT_TYPES);
export function isCityEventType(t) { return TYPE_SET.has(t); }

/** Public-safe scalar payload fields. Anything else is dropped. */
const ALLOWED_PAYLOAD_KEYS = ['portalId', 'target', 'reason'];
/** Cap allowlisted string values so a crafted client field can't bloat storage/broadcasts. */
const MAX_PAYLOAD_STR = 64;

/** PURE: keep only allowlisted public-safe scalars (strings length-capped) — never private/economy data. */
export function sanitizeEventPayload(payload) {
  const out = {};
  if (!payload || typeof payload !== 'object') return out;
  for (const k of ALLOWED_PAYLOAD_KEYS) {
    const v = payload[k];
    if (typeof v === 'string') { if (v.length <= MAX_PAYLOAD_STR) out[k] = v; }
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

/** A fresh, empty append-only log. `seq` is monotonic and survives FIFO pruning. */
export function createEventLog() {
  return { events: [], seq: 0 };
}

/**
 * Append a SERVER-AUTHORED public-safe event. The server assigns the id, seq, and
 * timestamp — any client-supplied id/seq/server_time in `fields` is ignored. Returns
 * { log, event } (new log; old events are never mutated). Trims to MAX_CITY_EVENTS
 * (FIFO) while keeping `seq` monotonic, so event ids stay unique across pruning.
 */
export function appendCityEvent(log, fields = {}) {
  const base = (log && Array.isArray(log.events)) ? log : createEventLog();
  const { type, cityId, actorPublicId = null, payload = {}, now = Date.now() } = fields;
  const safeCity = (typeof cityId === 'string' && cityId) ? cityId : 'city'; // ids stay well-formed
  const seq = (Number.isFinite(base.seq) ? base.seq : 0) + 1;
  const safeType = isCityEventType(type) ? type : 'city_unknown'; // never trust an arbitrary type
  const event = Object.freeze({
    schema_version: SCHEMA_VERSION,
    event_id: `${safeCity}:${seq}:${safeType}`,
    seq,
    city_id: safeCity,
    type: safeType,
    server_time: now,
    actor_public_id: (typeof actorPublicId === 'string' && actorPublicId) ? actorPublicId : null,
    payload: sanitizeEventPayload(payload),
    public_safe: true,
  });
  const events = [...base.events, event];
  while (events.length > MAX_CITY_EVENTS) events.shift();
  return { log: { events, seq }, event };
}

/** The most recent `limit` events (bounded by MAX_CITY_EVENTS). */
export function recentEvents(log, limit = MAX_CITY_EVENTS) {
  const evs = (log && Array.isArray(log.events)) ? log.events : [];
  const n = Math.max(0, Math.min(Number(limit) || MAX_CITY_EVENTS, MAX_CITY_EVENTS));
  return evs.slice(-n);
}

/** Public-safe wire payload of recent events (carries the protocol schema version). */
export function cityEventsPayload(log, limit = MAX_CITY_EVENTS) {
  return { schema_version: SCHEMA_VERSION, events: recentEvents(log, limit) };
}
