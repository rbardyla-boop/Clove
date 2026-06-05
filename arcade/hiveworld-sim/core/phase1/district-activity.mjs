/**
 * HiveWorld v1.0 — District activity feed (mirror of product Phase 5E
 * `arcade/city/city-district-activity.mjs`).
 *
 * PURE, deterministic. Turns already-public-safe district facts (route results, presence changes,
 * arrivals) into a bounded, public-safe activity feed. Every item is RE-PROJECTED through a fixed
 * field ALLOWLIST (the public-safety choke point), so a private field can never reach an item even
 * if a caller passes one. Labels are built from a fixed table; only a STATIC block display name is
 * interpolated. No actor/player ids, no economy/ownership.
 */
import { DISTRICT_ID, blockName } from './city-blocks.mjs';

export const ACTIVITY_KIND = 'district_activity';
export const ACTIVITY_FEED_MAX = 16;

/** The closed set of v1.0 district activity types. Anything else fails safe (→ null). */
export const ACTIVITY_TYPES = Object.freeze([
  'block_population_changed',
  'block_health_changed',
  'block_became_active',
  'block_became_empty',
  'block_presence_stale',
  'block_presence_restored',
  'route_requested',
  'route_confirmed',
  'route_rejected',
  'block_arrived',
]);
const TYPE_SET = new Set(ACTIVITY_TYPES);
const SEVERITIES = new Set(['info', 'good', 'warn']);

/** The only fields an activity item carries beyond the fixed envelope (the allowlist). */
const ITEM_FIELDS = Object.freeze(['city_id', 'type', 'occurred_tick', 'label', 'severity']);

const SEVERITY_FOR = Object.freeze({
  block_became_active: 'good',
  block_presence_restored: 'good',
  route_confirmed: 'good',
  block_arrived: 'good',
  block_presence_stale: 'warn',
  route_rejected: 'warn',
});

/** PURE: the observational, public-safe label for a type (only a static block name is interpolated). */
export function labelFor(type, name) {
  switch (type) {
    case 'block_became_active': return `${name} became active.`;
    case 'block_became_empty': return `${name} is quiet now.`;
    case 'block_presence_stale': return `${name} presence went quiet.`;
    case 'block_presence_restored': return `${name} presence restored.`;
    case 'block_population_changed': return `${name} activity shifted.`;
    case 'block_health_changed': return `${name} status changed.`;
    case 'route_requested': return `Routing to ${name} requested.`;
    case 'route_confirmed': return `Routing to ${name} confirmed.`;
    case 'route_rejected': return `Route to ${name} unavailable.`;
    case 'block_arrived': return `Arrived in ${name}.`;
    default: return `${name} updated.`;
  }
}

/**
 * PURE: build a public-safe activity item, RE-PROJECTED through the field allowlist. Returns null for
 * an unknown/invalid type. Only `city_id`, `type`, `occurred_tick`, derived `label`, `severity` survive;
 * any other property a caller passes (player ids, balances, …) is dropped.
 */
export function activityItem({ city_id, type, occurred_tick, severity } = {}) {
  if (!TYPE_SET.has(type)) return null;
  const cityId = typeof city_id === 'string' ? city_id : '';
  const at = Number.isFinite(occurred_tick) ? occurred_tick : 0;
  const sev = SEVERITIES.has(severity) ? severity : (SEVERITY_FOR[type] || 'info');
  return Object.freeze({
    kind: ACTIVITY_KIND,
    activity_id: `${DISTRICT_ID}:${type}:${cityId}:${at}`,
    district_id: DISTRICT_ID,
    city_id: cityId,
    type,
    occurred_tick: at,
    label: labelFor(type, blockName(cityId)),
    severity: sev,
    public_safe: true,
  });
}

/** True if two public block summaries differ on a live field (population / health). */
function summaryChangedType(prev, next) {
  const pPop = prev ? Number(prev.population) || 0 : 0;
  const nPop = Number(next.population) || 0;
  const pHealth = prev && prev.health ? prev.health : 'unknown';
  const nHealth = next.health || 'unknown';
  if (pPop === 0 && nPop > 0) return 'block_became_active';
  if (pPop > 0 && nPop === 0) return 'block_became_empty';
  if (pHealth === 'healthy' && (nHealth === 'stale' || nHealth === 'offline')) return 'block_presence_stale';
  if ((pHealth === 'stale' || pHealth === 'offline') && nHealth === 'healthy') return 'block_presence_restored';
  if (pPop !== nPop) return 'block_population_changed';
  if (pHealth !== nHealth) return 'block_health_changed';
  return null;
}

/** PURE: the activity item (or null) for a presence change between two public block summaries. */
export function activityForPresence(prevSummary, nextSummary, occurredTick) {
  if (!nextSummary || !nextSummary.city_id) return null;
  const type = summaryChangedType(prevSummary, nextSummary);
  if (!type) return null;
  return activityItem({ city_id: nextSummary.city_id, type, occurred_tick: occurredTick });
}

/**
 * PURE: prepend an item to a newest-first feed, COALESCING against the head — if the most recent item
 * has the same (type, city_id), it is replaced (collapses rapid repeats). Bounded to `max`. Never
 * mutates the input feed; ignores a null / non-public / unknown-type item. Returns a new array.
 */
export function appendActivity(feed, item, max = ACTIVITY_FEED_MAX) {
  const list = Array.isArray(feed) ? feed : [];
  if (!item || item.public_safe !== true || !TYPE_SET.has(item.type)) return list.slice(0, max);
  const head = list[0];
  const base = head && head.type === item.type && head.city_id === item.city_id ? list.slice(1) : list;
  return [item, ...base].slice(0, max);
}

export { ITEM_FIELDS };
