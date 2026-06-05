/**
 * Neon Circuit — District Activity Feed (Phase 5E).
 *
 * PURE, deterministic, runtime-agnostic. Imported UNCHANGED by:
 *   - the browser scene   (arcade/city/city-scene.js)
 *   - the unit tests       (tests/arcade/city-district-activity.test.mjs)
 *
 * Phase 5D pushes public-safe district PRESENCE deltas; 5A's routing confirms cross-block
 * transitions. Phase 5E turns those ALREADY-server-authored, ALREADY-public-safe facts into a
 * readable district ACTIVITY feed — "Downtown became active", "Routing to Skyline confirmed",
 * "Arrived in Skyline". It is DISPLAY-ONLY and entirely CLIENT-SIDE DERIVED: no canonical
 * authority depends on it, nothing reads it back, and it adds NO server message, DO, migration,
 * or protocol field. The server still owns all presence/route truth.
 *
 * Every item is re-projected through a fixed field ALLOWLIST (the public-safety choke point), so
 * even if a caller passes a private field it can never reach an activity item. Labels are built
 * from a fixed table; the only interpolated value is a block's STATIC display name (city config).
 * No player ids, socket/connection/account ids, balances, inventory, admin, tokens, or economy.
 *
 * Non-goals (Phase 5E): no economy/ownership/account/marketplace, no new DO/migration/route/server
 * message, no client→server activity append path, no HiveWorld bridge. See
 * docs/NEON_CIRCUIT_PHASE5E_DISTRICT_ACTIVITY_FEED.md.
 */
import { DISTRICT_ID } from './city-district.mjs';

export const ACTIVITY_SCHEMA = 1;
export const ACTIVITY_KIND = 'district_activity';
export const ACTIVITY_FEED_MAX = 16;

/** The closed set of Phase 5E activity types. Anything else is rejected (fail-safe → null). */
export const ACTIVITY_TYPES = Object.freeze([
  'block_population_changed',
  'block_health_changed',
  'block_became_active',
  'block_became_empty',
  'block_presence_stale',
  'block_presence_restored',
  'route_requested',
  'route_confirmed',
  'block_arrived',
  // Phase 6A: scheduled district event announcements (display/atmosphere; see city-district-events.mjs).
  'district_event_upcoming',
  'district_event_active',
  'district_event_ended',
]);
const TYPE_SET = new Set(ACTIVITY_TYPES);
const SEVERITIES = new Set(['info', 'good', 'warn']);

/** The ONLY fields an activity item carries beyond the fixed envelope (the allowlist). */
const ITEM_FIELDS = Object.freeze(['city_id', 'type', 'occurred_at', 'label', 'severity']);

/** A safe, bounded display name (static city config value). Never trusts length/strange input. */
function safeName(name, cityId) {
  const s = typeof name === 'string' && name.trim() ? name.trim() : String(cityId || 'a block');
  return s.length > 40 ? s.slice(0, 40) : s;
}

/** PURE: the observational, public-safe label for a type. Only `name` (static) is interpolated. */
export function labelFor(type, name) {
  switch (type) {
    case 'block_became_active': return `${name} became active.`;
    case 'block_became_empty': return `${name} is quiet now.`;
    case 'block_presence_stale': return `${name} presence went quiet.`;
    case 'block_presence_restored': return `${name} presence restored.`;
    case 'block_population_changed': return `${name} activity shifted.`;
    case 'block_health_changed': return `${name} status changed.`;
    case 'route_requested': return `Routing to ${name}…`;
    case 'route_confirmed': return `Routing to ${name} confirmed.`;
    case 'block_arrived': return `Arrived in ${name}.`;
    // Phase 6A: `name` is the district event's static label (e.g. "Downtown Signal Surge").
    case 'district_event_upcoming': return `${name} starts soon.`;
    case 'district_event_active': return `${name} is active.`;
    case 'district_event_ended': return `${name} ended.`;
    default: return `${name} updated.`;
  }
}

const SEVERITY_FOR = Object.freeze({
  block_became_active: 'good',
  block_presence_restored: 'good',
  route_confirmed: 'good',
  block_arrived: 'good',
  block_presence_stale: 'warn',
  block_became_empty: 'info',
  district_event_active: 'good',
  district_event_upcoming: 'info',
  district_event_ended: 'info',
});

/**
 * PURE: build a public-safe activity item, RE-PROJECTED through the field allowlist. Returns null
 * for an unknown/invalid type (fail-safe). `name` is a static display name; everything else on the
 * input is ignored — a caller can never smuggle a private field onto the wire-safe item.
 */
export function activityItem({ city_id, type, occurred_at, name, severity } = {}) {
  if (!TYPE_SET.has(type)) return null;
  const cityId = typeof city_id === 'string' ? city_id : '';
  const at = Number.isFinite(occurred_at) ? occurred_at : 0;
  const sev = SEVERITIES.has(severity) ? severity : (SEVERITY_FOR[type] || 'info');
  const item = {
    schema_version: ACTIVITY_SCHEMA,
    kind: ACTIVITY_KIND,
    activity_id: `${DISTRICT_ID}:${type}:${cityId}:${at}`,
    district_id: DISTRICT_ID,
    city_id: cityId,
    type,
    occurred_at: at,
    label: labelFor(type, safeName(name, cityId)),
    severity: sev,
    public_safe: true,
  };
  return item;
}

/** True if a public block summary counts as "present" (someone is there). */
function isActive(block) {
  return !!block && Number(block.population) > 0;
}
function healthOf(block) {
  return block && typeof block.health === 'string' ? block.health : 'unknown';
}

/**
 * PURE: classify the single most salient public change between a block's previous and next public
 * summaries → an activity TYPE (or null). Priority: became active/empty > presence stale/restored >
 * population shift. Operates only on public fields (population/health); ignores everything else.
 */
export function classifyBlockChange(prev, next) {
  if (!next) return null;
  const pActive = isActive(prev), nActive = isActive(next);
  if (!pActive && nActive) return 'block_became_active';
  if (pActive && !nActive) return 'block_became_empty';
  const ph = healthOf(prev), nh = healthOf(next);
  if (ph === 'healthy' && (nh === 'stale' || nh === 'offline')) return 'block_presence_stale';
  if ((ph === 'stale' || ph === 'offline') && nh === 'healthy') return 'block_presence_restored';
  if (Number(prev && prev.population) !== Number(next.population)) return 'block_population_changed';
  if (ph !== nh) return 'block_health_changed';
  return null;
}

/**
 * PURE: derive public-safe activity items from a Phase 5D presence delta, comparing each changed
 * block against the CURRENT manifest (pre-merge). `manifest` supplies the previous summary + the
 * static display name. Returns a bounded array (≤ delta.blocks.length); never mutates inputs.
 */
export function deriveActivitiesFromDelta(delta, manifest, now = Date.now()) {
  const blocks = delta && Array.isArray(delta.blocks) ? delta.blocks : [];
  const prevBlocks = manifest && Array.isArray(manifest.blocks) ? manifest.blocks : [];
  const prevById = new Map(prevBlocks.map((b) => [b.city_id, b]));
  const out = [];
  for (const nb of blocks) {
    const prev = prevById.get(nb.city_id) || null;
    const type = classifyBlockChange(prev, nb);
    if (!type) continue;
    const name = (prev && prev.display_name) || nb.display_name;
    const item = activityItem({ city_id: nb.city_id, type, occurred_at: now, name });
    if (item) out.push(item);
  }
  return out;
}

/** PURE: a route-requested activity (the player tapped Travel to a block). */
export function activityForRouteRequested(targetCityId, name, now = Date.now()) {
  return activityItem({ city_id: targetCityId, type: 'route_requested', occurred_at: now, name });
}

/**
 * PURE: a route-confirmed activity from a server `city_route_result`. Only the OK result yields a
 * feed item (a blocked route is surfaced transiently in the route status line, not the feed — it is
 * not one of the Phase 5E activity types). Returns null otherwise.
 */
export function activityForRouteResult(result, name, now = Date.now()) {
  if (!result || result.ok !== true || typeof result.target_city_id !== 'string') return null;
  return activityItem({ city_id: result.target_city_id, type: 'route_confirmed', occurred_at: now, name });
}

/** PURE: an arrival activity (player reconnected into a new block after a travel). */
export function activityForArrival(cityId, name, now = Date.now()) {
  return activityItem({ city_id: cityId, type: 'block_arrived', occurred_at: now, name });
}

/** Map a Phase 6A district-event lifecycle status → an activity type (the feed projection). */
const EVENT_STATUS_TYPE = Object.freeze({
  upcoming: 'district_event_upcoming',
  active: 'district_event_active',
  ended: 'district_event_ended',
});

/**
 * PURE: project a Phase 6A scheduled district EVENT into a public-safe activity feed item, through
 * the SAME allowlist choke point as every other feed item. Only the event's static `label` (e.g.
 * "Downtown Signal Surge") and `city_id` cross over; status picks the type. A non-public-safe or
 * unknown-status event yields null (fail-safe). The event carries no player/private data by
 * construction (see city-district-events.mjs), and nothing private can reach the item regardless.
 */
export function activityForDistrictEvent(event, now = Date.now()) {
  if (!event || event.public_safe !== true) return null;
  const type = EVENT_STATUS_TYPE[event.status];
  if (!type) return null;
  const cityId = typeof event.city_id === 'string' ? event.city_id : '';
  const name = typeof event.label === 'string' ? event.label : '';
  return activityItem({ city_id: cityId, type, occurred_at: now, name });
}

/**
 * PURE: prepend an item to a newest-first feed, COALESCING against the head: if the most recent
 * item has the same (type, city_id), it is replaced (collapses rapid repeats) rather than stacked.
 * Bounded to `max`. Never mutates the input feed; ignores a null item. Returns a new array.
 */
export function appendActivity(feed, item, max = ACTIVITY_FEED_MAX) {
  const list = Array.isArray(feed) ? feed : [];
  if (!item || !item.public_safe || !TYPE_SET.has(item.type)) return list.slice(0, max);
  const head = list[0];
  const base = head && head.type === item.type && head.city_id === item.city_id ? list.slice(1) : list;
  return [item, ...base].slice(0, max);
}
