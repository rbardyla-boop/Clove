/**
 * Neon Circuit — Multi-Block District model (Phase 5A).
 *
 * PURE, deterministic, runtime-agnostic. Imported UNCHANGED by:
 *   - the CityRoom Durable Object      (workers/arcade/src/city-room.ts)
 *   - the local city dev shim          (workers/arcade/city-dev-shim.mjs)
 *   - the unit tests                   (tests/arcade/city-district.test.mjs)
 *   - the browser scene                (arcade/city/city-scene.js)
 *
 * The district is STATIC CONFIGURATION on top of the existing per-block authority:
 * each block is already its own CityRoom DO (idFromName(cityId)). This module adds
 * only discovery + bounded routing + public-safe summaries. It owns NO state, reads
 * NO private/player data, and never touches economy, ownership, population, or any
 * block's runtime. Cross-block isolation is structural (one DO per block); a route is
 * a server-VALIDATED confirmation that the client then reconnects on — the target DO
 * still authoritatively admits the player.
 *
 * Non-goals (Phase 5A): no ownership/land/rent/income, no marketplace, no economy, no
 * accounts, no cross-block inventory, no live population (deferred), no HiveWorld bridge.
 *
 * Scope + non-goals: docs/NEON_CIRCUIT_PHASE5_MULTI_BLOCK_DISTRICT.md.
 */
import { CITY_IDS, getCity, sanitizeCityId, DEFAULT_CITY_ID } from './city-block.mjs';

/** The single district Phase 5A ships. Blocks live in city-block.mjs (CITY_ROOMS). */
export const DISTRICT_ID = 'neon-district-01';
export const DISTRICT_NAME = 'Neon District';

/**
 * Block adjacency graph (the routing topology). Phase 6D made it NON-LINEAR (a 4-block ring
 * downtown — harbor — skyline — foundry — downtown). Phase 8A added Nexus + Garden as a second
 * "new" corridor (downtown ⇄ garden ⇄ nexus ⇄ skyline). Phase 8B grows the SINGLE district to
 * NINE blocks, adding Aurora + Relay + Lumen as a third "outer" corridor WITHOUT removing any
 * prior edge:
 *   - every Phase 6D ring edge and Phase 8A corridor edge is preserved (all existing routes work);
 *   - the original 4-ring (downtown/harbor/skyline/foundry) is UNCHANGED;
 *   - new edges garden↔aurora, aurora↔relay, relay↔lumen, lumen↔nexus, aurora↔lumen attach a
 *     third corridor at garden & nexus, so the three new blocks form a bounded outer loop.
 * 9 nodes / 12 edges — at the Phase-8A ceiling (B=9) the full manifest stays a few KB, well under
 * the 16 KB norm, so no partial-manifest/sharding trigger fires (docs/PHASE_8_DISTRICT_SCALE_PLAN.md
 * §1c, §3). Still bounded to directly-adjacent blocks only; adjacency is symmetric; every id here
 * MUST be a known block (asserted in tests). Block ids only — already public-safe; map topology,
 * NOT ownership/economy.
 */
const ADJACENCY = Object.freeze({
  'downtown-01': Object.freeze(['harbor-02', 'foundry-04', 'garden-06']),
  'harbor-02': Object.freeze(['downtown-01', 'skyline-03']),
  'skyline-03': Object.freeze(['harbor-02', 'foundry-04', 'nexus-05']),
  'foundry-04': Object.freeze(['downtown-01', 'skyline-03']),
  'nexus-05': Object.freeze(['skyline-03', 'garden-06', 'lumen-09']),
  'garden-06': Object.freeze(['downtown-01', 'nexus-05', 'aurora-07']),
  'aurora-07': Object.freeze(['garden-06', 'relay-08', 'lumen-09']),
  'relay-08': Object.freeze(['aurora-07', 'lumen-09']),
  'lumen-09': Object.freeze(['relay-08', 'nexus-05', 'aurora-07']),
});

/** True if cityId is a configured block. */
export function isKnownBlock(cityId) {
  return CITY_IDS.includes(cityId);
}

/** The adjacent block ids for a block (a fresh array; empty for unknown blocks). */
export function adjacentBlocks(cityId) {
  const list = ADJACENCY[cityId];
  return Array.isArray(list) ? list.slice() : [];
}

/** True if two known blocks are directly routable (adjacency is symmetric). */
export function areAdjacent(a, b) {
  return adjacentBlocks(a).includes(b);
}

// ===================== Phase 5C: live district presence (population + health) =====================

/** Heartbeat freshness windows — mirror the Phase 2c room-health policy. */
export const CITY_HEARTBEAT_TTL_MS = 30_000; // within → healthy
export const CITY_STALE_TTL_MS = 90_000;     // beyond → offline (population evicted; no ghosts)
export const CITY_HEALTHS = Object.freeze(['healthy', 'stale', 'offline', 'unknown']);

/** PURE: a block's public health from its heartbeat freshness age (ms; null = never reported). */
export function deriveCityHealth(lastSeenAgeMs) {
  if (lastSeenAgeMs == null) return 'unknown';
  if (lastSeenAgeMs > CITY_STALE_TTL_MS) return 'offline';
  if (lastSeenAgeMs > CITY_HEARTBEAT_TTL_MS) return 'stale';
  return 'healthy';
}

/**
 * PURE: one block's public-safe presence from its latest heartbeat (or null) + the clock.
 * Stale-population policy (no ghost population): fresh → reported count; stale → last reported,
 * flagged estimated; offline/unknown → 0, flagged estimated. A heartbeat carries ONLY a count
 * and a freshness timestamp — never player ids, balances, ledger, inventory, or any private data.
 */
export function cityPresenceEntry(heartbeat, now = Date.now()) {
  const lastSeenAt = heartbeat && Number.isFinite(heartbeat.last_seen_at) ? heartbeat.last_seen_at : null;
  const lastSeenAgeMs = lastSeenAt == null ? null : Math.max(0, now - lastSeenAt);
  const health = deriveCityHealth(lastSeenAgeMs);
  let population = heartbeat ? Math.max(0, Number(heartbeat.population) || 0) : 0;
  let estimated = false;
  if (lastSeenAgeMs == null) { population = 0; estimated = true; }
  else if (lastSeenAgeMs > CITY_STALE_TTL_MS) { population = 0; estimated = true; }
  else if (lastSeenAgeMs > CITY_HEARTBEAT_TTL_MS) { estimated = true; }
  return { population, health, population_is_estimated: estimated };
}

/**
 * PUBLIC-SAFE summary of one block: identity + presentation + adjacency + live presence
 * (a population COUNT + health derived from heartbeat freshness). Never player ids, balances,
 * ledger, inventory, economy, or ownership. `heartbeat` is this block's latest heartbeat (or
 * null → unknown/0). Returns null for an unknown block.
 */
export function blockPublicSummary(cityId, heartbeat = null, now = Date.now()) {
  const c = getCity(cityId);
  if (!c) return null;
  const pres = cityPresenceEntry(heartbeat, now);
  return {
    city_id: c.city_id,
    display_name: c.display_name,
    theme: c.theme,
    capacity: c.capacity,
    adjacent: adjacentBlocks(c.city_id),
    population: pres.population,
    health: pres.health,
    population_is_estimated: pres.population_is_estimated,
  };
}

/** Same-origin WebSocket hint for a target block (informational; client keys off the id). */
export function cityWsHint(cityId) {
  return `/arcade/city/ws?city=${cityId}`;
}

/**
 * PURE: the public-safe district manifest sent to a client. `current_city_id` is the
 * server-owned block the requester is in (falls back to the default if unknown). `presence`
 * is a public-safe map { cityId → heartbeat } (Phase 5C); omit it and every block reads as
 * unknown/0 (the Phase 5A/5B static behavior).
 */
export function districtManifest(currentCityId, presence = {}, now = Date.now()) {
  const current = sanitizeCityId(currentCityId);
  const adjacency = {};
  for (const id of CITY_IDS) adjacency[id] = adjacentBlocks(id);
  const beats = presence && typeof presence === 'object' ? presence : {};
  return {
    district_id: DISTRICT_ID,
    district_name: DISTRICT_NAME,
    current_city_id: isKnownBlock(current) ? current : DEFAULT_CITY_ID,
    blocks: CITY_IDS.map((id) => blockPublicSummary(id, beats[id] || null, now)),
    adjacency,
  };
}

/**
 * PURE: validate an untrusted route request from a server-owned source block to a
 * target block. Returns { ok, target_city_id, ws_hint } or { ok:false, reason }. The
 * source (fromCityId) is server-owned (the CityRoom's boundCityId); the target is
 * sanitized and must be a KNOWN block ADJACENT to the source (bounded — no arbitrary
 * teleport), and not the source itself. This function NEVER mutates any block state.
 */
export function validateRouteRequest(fromCityId, rawTarget) {
  const from = sanitizeCityId(fromCityId);
  if (!isKnownBlock(from)) return { ok: false, reason: 'unknown_source' };
  const target = sanitizeCityId(rawTarget);
  if (!target) return { ok: false, reason: 'invalid_target' };
  if (!isKnownBlock(target)) return { ok: false, reason: 'unknown_block' };
  if (target === from) return { ok: false, reason: 'same_block' };
  if (!areAdjacent(from, target)) return { ok: false, reason: 'not_adjacent' };
  return { ok: true, target_city_id: target, ws_hint: cityWsHint(target) };
}
