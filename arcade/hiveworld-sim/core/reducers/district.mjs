/**
 * District reducers (HiveWorld v1.0 — city/district foundation).
 *
 * Mirrors the product Phase 5A–5E city/district authority model on the simulator's canonical fold:
 *   - per-block isolation: each block's reported public summary lives under `state.district.blocks`;
 *   - location authority: an actor's current block changes ONLY on a `city_block_arrived` that follows
 *     a CONFIRMED route — a forged/non-adjacent confirm can never teleport an actor;
 *   - public-safety: `district_presence_delta` is re-projected through the public allowlist (population
 *     + health only), so injected private fields are stripped; the activity feed is bounded + deduped;
 *   - convergence: every reducer is a pure function of (state, canonically-ordered event), so delayed /
 *     duplicated / out-of-order delivery folds to the same fingerprint.
 *
 * No economy, accounts, ownership, or money is folded here. This is a lab mirror, not a product bridge.
 */
import { ok, rej } from '../state-util.mjs';
import { isKnownBlock } from '../phase1/city-blocks.mjs';
import { validateRoute, publicBlockSummary } from '../phase1/district.mjs';
import { activityItem, activityForPresence, appendActivity } from '../phase1/district-activity.mjs';

const VALID_HEALTH = new Set(['healthy', 'stale', 'offline', 'unknown']);

function withDistrict(state, slice) {
  return ok({ ...state, district: { ...state.district, ...slice } });
}
function pushActivity(d, item) {
  return item ? { ...d, activity: appendActivity(d.activity, item) } : d;
}

/** An actor joins a block — sets the actor's location (population is reported separately by the block). */
export function city_player_joined(state, ev) {
  const cityId = ev.cell_id || (ev.payload && ev.payload.city_id);
  if (!isKnownBlock(cityId)) return rej(state, 'unknown_block');
  const d = state.district;
  return withDistrict(state, { actorBlock: { ...d.actorBlock, [ev.actor_id]: cityId } });
}

/** An actor leaves a block — clears its location if it was there. */
export function city_player_left(state, ev) {
  const cityId = ev.cell_id || (ev.payload && ev.payload.city_id);
  const d = state.district;
  if (d.actorBlock[ev.actor_id] !== cityId) return ok(state); // not there → no-op (idempotent)
  const actorBlock = { ...d.actorBlock };
  delete actorBlock[ev.actor_id];
  return withDistrict(state, { actorBlock });
}

/** A block authority reports its PUBLIC-SAFE presence summary (population + health). Private fields in
 *  the payload are ignored — only the allowlisted population/health are stored. */
export function district_presence_delta(state, ev) {
  const cityId = ev.cell_id || (ev.payload && ev.payload.city_id);
  if (!isKnownBlock(cityId)) return rej(state, 'unknown_block');
  if (ev.actor_id !== cityId) return rej(state, 'not_authority'); // a block signs only its own presence
  const p = ev.payload || {};
  const population = Number.isFinite(p.population) ? Math.max(0, Math.floor(p.population)) : 0;
  const health = VALID_HEALTH.has(p.health) ? p.health : 'healthy';
  const reported = { population, health, last_seen_tick: ev.logical_tick }; // ALLOWLIST — nothing else stored
  const d = state.district;
  const prevSummary = publicBlockSummary(cityId, d.blocks[cityId] || null, ev.logical_tick);
  const nextSummary = publicBlockSummary(cityId, reported, ev.logical_tick);
  const item = activityForPresence(prevSummary, nextSummary, ev.logical_tick);
  let nd = { ...d, blocks: { ...d.blocks, [cityId]: reported } };
  nd = pushActivity(nd, item);
  return ok({ ...state, district: nd });
}

/** An actor requests a route (intent only). Recorded as pending; the block authority validates/confirms. */
export function city_route_requested(state, ev) {
  const actor = ev.actor_id;
  const target = ev.payload && ev.payload.target_city_id;
  const d = state.district;
  const from = d.actorBlock[actor];
  if (!from) return rej(state, 'not_in_block');           // can't route from nowhere
  if (typeof target !== 'string' || !target) return rej(state, 'invalid_target');
  let nd = { ...d, routes: { ...d.routes, [actor]: { status: 'requested', from, target, tick: ev.logical_tick } } };
  nd = pushActivity(nd, activityItem({ city_id: target, type: 'route_requested', occurred_tick: ev.logical_tick }));
  return ok({ ...state, district: nd });
}

/** A block authority CONFIRMS a route. Re-validated here: a confirm to an unknown/non-adjacent target,
 *  or one that does not match the actor's current block + a pending request, is REJECTED by the fold —
 *  so a forged confirm can never move an actor. */
export function city_route_confirmed(state, ev) {
  const p = ev.payload || {};
  const actor = p.actor_id;
  const from = p.from_city_id;
  const target = p.target_city_id;
  if (ev.actor_id !== from) return rej(state, 'not_authority'); // the SOURCE block signs the confirm
  const d = state.district;
  if (d.actorBlock[actor] !== from) return rej(state, 'actor_not_at_source');
  const pending = d.routes[actor];
  if (!pending || pending.status !== 'requested' || pending.target !== target) return rej(state, 'no_pending_request');
  const v = validateRoute(from, target);
  if (!v.ok) return rej(state, v.reason);                  // forged/non-adjacent confirm → rejected
  let nd = { ...d, routes: { ...d.routes, [actor]: { status: 'confirmed', from, target, tick: ev.logical_tick } } };
  nd = pushActivity(nd, activityItem({ city_id: target, type: 'route_confirmed', occurred_tick: ev.logical_tick }));
  return ok({ ...state, district: nd });
}

/** A block authority REJECTS a route. Records the rejection (no location change) + bumps the counter. */
export function city_route_rejected(state, ev) {
  const p = ev.payload || {};
  const actor = p.actor_id;
  const from = p.from_city_id;
  const target = p.target_city_id;
  if (ev.actor_id !== from) return rej(state, 'not_authority');
  const reason = typeof p.reason === 'string' ? p.reason : 'denied';
  const d = state.district;
  let nd = {
    ...d,
    routes: { ...d.routes, [actor]: { status: 'rejected', from, target, reason, tick: ev.logical_tick } },
    rejectedRoutes: d.rejectedRoutes + 1,
  };
  nd = pushActivity(nd, activityItem({ city_id: target, type: 'route_rejected', occurred_tick: ev.logical_tick }));
  return ok({ ...state, district: nd });
}

/** An actor arrives in a block — honoured ONLY if a CONFIRMED route to that block exists. */
export function city_block_arrived(state, ev) {
  const actor = ev.actor_id;
  const cityId = ev.cell_id || (ev.payload && ev.payload.city_id);
  if (!isKnownBlock(cityId)) return rej(state, 'unknown_block');
  const d = state.district;
  const route = d.routes[actor];
  if (!route || route.status !== 'confirmed' || route.target !== cityId) return rej(state, 'no_confirmed_route');
  const routes = { ...d.routes };
  delete routes[actor];
  let nd = { ...d, actorBlock: { ...d.actorBlock, [actor]: cityId }, routes };
  nd = pushActivity(nd, activityItem({ city_id: cityId, type: 'block_arrived', occurred_tick: ev.logical_tick }));
  return ok({ ...state, district: nd });
}

/** An explicitly-logged public-safe activity item — sanitized through the allowlist and folded into the
 *  bounded feed (the optional "explicitly logged" path; the route/presence reducers derive the rest). */
export function district_activity_derived(state, ev) {
  const p = ev.payload || {};
  const item = activityItem({ city_id: p.city_id, type: p.type, occurred_tick: ev.logical_tick, severity: p.severity });
  if (!item) return rej(state, 'invalid_activity_type');
  return ok({ ...state, district: pushActivity(state.district, item) });
}
