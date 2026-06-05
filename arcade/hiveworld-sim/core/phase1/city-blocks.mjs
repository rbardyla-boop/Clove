/**
 * HiveWorld v1.0 — City block static config (mirror of product Phase 5A `arcade/city/city-block.mjs`
 * CITY_ROOMS + Phase 5B per-block identity).
 *
 * SIM-LOCAL MIRROR, not an import: the simulator NEVER imports product `arcade/city/*` (that would be
 * a bridge). This re-states the same static district shape so the fold can reason about city blocks
 * the way the product does — per-block isolation, display identity, line adjacency — as a lab/proof
 * harness only. No networking, no DO, no economy, no ownership.
 */

export const DISTRICT_ID = 'neon-district-01';
export const DISTRICT_NAME = 'Neon District';

/** The three Phase 5A blocks, each with its Phase 5B display identity. Static + bounded for v1.0. */
export const CITY_BLOCKS = Object.freeze({
  'downtown-01': Object.freeze({ city_id: 'downtown-01', display_name: 'Downtown', theme: 'downtown-magenta', capacity: 16 }),
  'harbor-02':   Object.freeze({ city_id: 'harbor-02',   display_name: 'Harbor',   theme: 'harbor-cyan',     capacity: 16 }),
  'skyline-03':  Object.freeze({ city_id: 'skyline-03',  display_name: 'Skyline',  theme: 'skyline-amber',   capacity: 16 }),
});

export const CITY_IDS = Object.freeze(Object.keys(CITY_BLOCKS));
export const DEFAULT_CITY_ID = 'downtown-01';

/** True if cityId is a configured block. */
export function isKnownBlock(cityId) {
  return Object.prototype.hasOwnProperty.call(CITY_BLOCKS, cityId);
}

/** The static block record (or null). */
export function getBlock(cityId) {
  return isKnownBlock(cityId) ? CITY_BLOCKS[cityId] : null;
}

/** A block's display name, falling back to its id (used when a summary is logged before discovery). */
export function blockName(cityId) {
  const b = getBlock(cityId);
  return b ? b.display_name : String(cityId);
}
