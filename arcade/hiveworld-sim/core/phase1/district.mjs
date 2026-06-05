/**
 * HiveWorld v1.0 — District topology + bounded routing + public-safe block summary
 * (mirror of product Phase 5A `arcade/city/city-district.mjs` adjacency/validateRouteRequest +
 * Phase 5C public block summary).
 *
 * PURE, deterministic. The adjacency is a static LINE: downtown — harbor — skyline, so downtown↔skyline
 * are NOT directly routable (you route through harbor). Routing is bounded to adjacent blocks only — a
 * route is a server/authority-VALIDATED confirmation, exactly like the product. No ownership/rent/claim.
 */
import { CITY_IDS, DISTRICT_ID, isKnownBlock, getBlock } from './city-blocks.mjs';

/** Block adjacency graph (line topology). Carries only block ids — already public-safe. */
const ADJACENCY = Object.freeze({
  'downtown-01': Object.freeze(['harbor-02']),
  'harbor-02':   Object.freeze(['downtown-01', 'skyline-03']),
  'skyline-03':  Object.freeze(['harbor-02']),
});

/** Adjacent block ids for a block (a fresh array; empty for unknown blocks). */
export function adjacentBlocks(cityId) {
  const list = ADJACENCY[cityId];
  return Array.isArray(list) ? list.slice() : [];
}

/** True if two known blocks are directly routable (adjacency is symmetric). */
export function areAdjacent(a, b) {
  return adjacentBlocks(a).includes(b);
}

/** Health windows (ticks) — mirror the product Phase 2c/5C freshness policy on the sim clock. */
export const CITY_HEARTBEAT_TTL_TICKS = 5;  // within → healthy
export const CITY_STALE_TTL_TICKS = 15;     // beyond → offline

/** PURE: a block's public health from its last-reported age in ticks (null = never reported). */
export function deriveBlockHealth(lastSeenAgeTicks) {
  if (lastSeenAgeTicks == null) return 'unknown';
  if (lastSeenAgeTicks > CITY_STALE_TTL_TICKS) return 'offline';
  if (lastSeenAgeTicks > CITY_HEARTBEAT_TTL_TICKS) return 'stale';
  return 'healthy';
}

/**
 * PURE: validate an untrusted route request from a server-owned source block to a target block.
 * Returns { ok, target_city_id } or { ok:false, reason }. The source (fromCityId) is authority-owned;
 * the target must be a KNOWN block ADJACENT to the source and not the source itself (bounded — no
 * arbitrary teleport). Mirrors product validateRouteRequest. Never mutates anything.
 */
export function validateRoute(fromCityId, rawTarget) {
  if (!isKnownBlock(fromCityId)) return { ok: false, reason: 'unknown_source' };
  const target = typeof rawTarget === 'string' ? rawTarget : '';
  if (!target) return { ok: false, reason: 'invalid_target' };
  if (!isKnownBlock(target)) return { ok: false, reason: 'unknown_block' };
  if (target === fromCityId) return { ok: false, reason: 'same_block' };
  if (!areAdjacent(fromCityId, target)) return { ok: false, reason: 'not_adjacent' };
  return { ok: true, target_city_id: target };
}

/** The ONLY public-safe fields a block summary exposes (the allowlist). */
const SUMMARY_FIELDS = Object.freeze(['city_id', 'display_name', 'theme', 'population', 'health', 'adjacent']);

/**
 * PURE: a public-safe block summary from a (possibly hostile) reported record + the clock. Re-projected
 * through the allowlist — population is a COUNT, health is derived from freshness; NO player ids,
 * connection/socket ids, balances, inventory, or any private field can pass through.
 */
export function publicBlockSummary(cityId, reported = null, nowTick = 0) {
  const b = getBlock(cityId);
  if (!b) return null;
  const lastSeen = reported && Number.isFinite(reported.last_seen_tick) ? reported.last_seen_tick : null;
  const age = lastSeen == null ? null : Math.max(0, nowTick - lastSeen);
  let population = reported && Number.isFinite(reported.population) ? Math.max(0, Math.floor(reported.population)) : 0;
  // Health is the block's REPORTED health when it gave one (so a scenario can drive stale/offline
  // transitions deterministically); otherwise it is derived from freshness (mirror 5C).
  const VALID = new Set(['healthy', 'stale', 'offline', 'unknown']);
  const health = reported && VALID.has(reported.health) ? reported.health : deriveBlockHealth(age);
  if (health === 'offline') population = 0; // no ghost population (mirror 5C eviction)
  return {
    city_id: b.city_id,
    display_name: b.display_name,
    theme: b.theme,
    population,
    health,
    adjacent: adjacentBlocks(b.city_id),
  };
}

/** PURE: the whole district manifest — every known block's public summary + the adjacency graph. */
export function districtManifest(reportedByBlock = {}, nowTick = 0) {
  const reported = reportedByBlock && typeof reportedByBlock === 'object' ? reportedByBlock : {};
  const adjacency = {};
  for (const id of CITY_IDS) adjacency[id] = adjacentBlocks(id);
  return {
    district_id: DISTRICT_ID,
    blocks: CITY_IDS.map((id) => publicBlockSummary(id, reported[id] || null, nowTick)),
    adjacency,
  };
}

export { SUMMARY_FIELDS };
