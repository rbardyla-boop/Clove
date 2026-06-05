/**
 * HiveWorld v1.0 — City/district fabric event types + builder helpers.
 *
 * v1.0 adds the city/district era to the simulator's event fabric (mirroring product Phase 5A–5E):
 *   presence : city_player_joined, city_player_left, district_presence_delta
 *   event_log: city_route_requested, city_route_confirmed, city_route_rejected,
 *              city_block_arrived, district_activity_derived
 *
 * The builders take a sim NODE (an Agent for the actor events, a per-block RoomBaseStation whose id ===
 * cityId for the block-authority events) and return a signed envelope via node.emit — so scenarios stay
 * readable WITHOUT touching agent.mjs / room.mjs. Routing follows the product authority model: an actor
 * REQUESTS, a block authority CONFIRMS/REJECTS (validated), and the actor ARRIVES only after a confirm.
 */

/** city/district event_type → its single sideband (the v1.0 slice of EVENT_SPECS). */
export const CITY_EVENT_SIDEBAND = Object.freeze({
  city_player_joined:       'presence',
  city_player_left:         'presence',
  district_presence_delta:  'presence',
  city_route_requested:     'event_log',
  city_route_confirmed:     'event_log',
  city_route_rejected:      'event_log',
  city_block_arrived:       'event_log',
  district_activity_derived:'event_log',
});

export const CITY_EVENT_TYPES = Object.freeze(Object.keys(CITY_EVENT_SIDEBAND));

const sb = (type) => CITY_EVENT_SIDEBAND[type];

// ── actor events ───────────────────────────────────────────────────────────────
/** An actor joins a block (cell = the block). */
export function joinBlock(actor, cityId, tick) {
  return actor.emit({ eventType: 'city_player_joined', sideband: sb('city_player_joined'), cellId: cityId, payload: { city_id: cityId }, tick });
}
/** An actor leaves a block. */
export function leaveBlock(actor, cityId, tick) {
  return actor.emit({ eventType: 'city_player_left', sideband: sb('city_player_left'), cellId: cityId, payload: { city_id: cityId }, tick });
}
/** An actor requests a route to a target block (intent only; the authority validates + confirms). */
export function requestRoute(actor, targetCityId, tick) {
  return actor.emit({ eventType: 'city_route_requested', sideband: sb('city_route_requested'), payload: { target_city_id: targetCityId }, tick });
}
/** An actor arrives in a block (honoured by the fold ONLY if a confirmed route exists). */
export function arriveBlock(actor, cityId, tick) {
  return actor.emit({ eventType: 'city_block_arrived', sideband: sb('city_block_arrived'), cellId: cityId, payload: { city_id: cityId }, tick });
}

// ── block-authority events (emitter id MUST equal the source/target cityId) ──────
/** A block authority CONFIRMS an actor's route from this block to an adjacent target. */
export function confirmRoute(blockAuthority, actorId, fromCityId, targetCityId, tick) {
  return blockAuthority.emit({ eventType: 'city_route_confirmed', sideband: sb('city_route_confirmed'), cellId: fromCityId, payload: { actor_id: actorId, from_city_id: fromCityId, target_city_id: targetCityId }, tick });
}
/** A block authority REJECTS an actor's route (unknown/non-adjacent/forged target). */
export function rejectRoute(blockAuthority, actorId, fromCityId, targetCityId, reason, tick) {
  return blockAuthority.emit({ eventType: 'city_route_rejected', sideband: sb('city_route_rejected'), cellId: fromCityId, payload: { actor_id: actorId, from_city_id: fromCityId, target_city_id: targetCityId, reason }, tick });
}
/** A block authority reports its public-safe presence summary (population + health). */
export function presenceDelta(blockAuthority, cityId, { population = 0, health = 'healthy' } = {}, tick, extra = {}) {
  return blockAuthority.emit({ eventType: 'district_presence_delta', sideband: sb('district_presence_delta'), cellId: cityId, payload: { city_id: cityId, population, health, ...extra }, tick });
}
/** Any node may log an explicitly-derived public-safe activity item (folded into the bounded feed). */
export function deriveActivity(node, { city_id, type, severity }, tick, extra = {}) {
  return node.emit({ eventType: 'district_activity_derived', sideband: sb('district_activity_derived'), cellId: city_id, payload: { city_id, type, severity, ...extra }, tick });
}
