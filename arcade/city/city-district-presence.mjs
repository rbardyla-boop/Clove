/**
 * Neon Circuit — Push-on-change district presence deltas (Phase 5D).
 *
 * PURE, deterministic, runtime-agnostic. Imported UNCHANGED by:
 *   - the CityRoom Durable Object      (workers/arcade/src/city-room.ts)
 *   - the local city dev shim          (workers/arcade/city-dev-shim.mjs)
 *   - the unit tests                   (tests/arcade/city-district-presence.test.mjs)
 *   - the browser scene                (arcade/city/city-scene.js)
 *
 * Phase 5C made the district presence (per-block population + health) LIVE but PULL-based:
 * the client polled `city_blocks_request` to refresh it. Phase 5D pushes a bounded, public-safe
 * DELTA to a block's connected clients only when a public summary actually changes, so the
 * district UI updates without polling. Authority is unchanged: the CityRegistry stays the
 * DO-to-DO coordinator and each CityRoom stays its block's authority — this module only
 * COMPARES the public-safe summaries the district manifest is already built from and emits a
 * minimal diff. It owns NO state, reads NO private/player data, and is economy/ownership-neutral.
 *
 * The presence map (`{ cityId -> { population, last_seen_at } }`) is exactly the Phase 5C
 * heartbeat map: a COUNT plus a freshness timestamp per block — never player ids, balances,
 * ledger, inventory, connection/socket ids, account ids, admin tokens, or any private data.
 * The freshness/stale policy is reused from city-district.mjs (no duplicated thresholds).
 *
 * Non-goals (Phase 5D): no new economy/account/ownership/marketplace, no new DO/migration,
 * no new client-facing registry socket, no HiveWorld bridge. See
 * docs/NEON_CIRCUIT_PHASE5D_DISTRICT_PRESENCE_PUSH.md.
 */
import { CITY_IDS } from './city-block.mjs';
import { cityPresenceEntry, DISTRICT_ID } from './city-district.mjs';

/** Wire/semantic markers for the delta message (the transport adds `t: 'city_district_presence'`). */
export const PRESENCE_DELTA_KIND = 'district_presence_delta';
export const PRESENCE_DELTA_SCHEMA = 1;

/** The ONLY live, public-safe per-block fields a delta carries (the allowlist). */
const PRESENCE_FIELDS = Object.freeze(['population', 'health', 'population_is_estimated']);

/**
 * PURE: project a block's public presence to the live subset {population, health,
 * population_is_estimated} from its latest heartbeat (or null). Reuses the Phase 5C policy
 * (cityPresenceEntry) so freshness/stale rules never drift. Ignores any extra heartbeat field.
 */
export function presenceSubset(heartbeat, now = Date.now()) {
  const e = cityPresenceEntry(heartbeat, now);
  return { population: e.population, health: e.health, population_is_estimated: e.population_is_estimated };
}

/**
 * PURE: a snapshot of the whole district's live presence — { cityId -> subset } for every
 * known block — derived from a public-safe presence map. Deterministic; never mutates input.
 */
export function districtPresenceSnapshot(presence = {}, now = Date.now()) {
  const beats = presence && typeof presence === 'object' ? presence : {};
  const snap = {};
  for (const id of CITY_IDS) snap[id] = presenceSubset(beats[id] || null, now);
  return snap;
}

/** True if two presence subsets are equal on the live fields. */
function subsetEqual(a, b) {
  if (!a || !b) return false;
  for (const f of PRESENCE_FIELDS) if (a[f] !== b[f]) return false;
  return true;
}

/**
 * PURE: the bounded list of blocks whose live presence changed between two snapshots, as
 * {city_id, ...subset}, sorted by city_id (deterministic). At most CITY_IDS.length entries.
 * Never mutates either input. A missing prev entry counts as changed (first observation).
 */
export function diffDistrictPresence(prev = {}, next = {}) {
  const p = prev && typeof prev === 'object' ? prev : {};
  const n = next && typeof next === 'object' ? next : {};
  const changed = [];
  for (const id of CITY_IDS) {
    if (n[id] && !subsetEqual(p[id], n[id])) changed.push({ city_id: id, ...n[id] });
  }
  changed.sort((a, b) => (a.city_id < b.city_id ? -1 : a.city_id > b.city_id ? 1 : 0));
  return changed;
}

/**
 * PURE: build the public-safe delta payload (without the transport `t`) from a list of changed
 * blocks. Each block is RE-PROJECTED through the field allowlist, so any stray/private field a
 * caller might pass can never reach the wire. `district_id` defaults to the single Phase 5 district.
 */
export function buildPresenceDelta(changedBlocks = [], now = Date.now(), districtId = DISTRICT_ID) {
  const blocks = (Array.isArray(changedBlocks) ? changedBlocks : []).map((b) => ({
    city_id: b.city_id,
    population: Math.max(0, Number(b.population) || 0),
    health: b.health,
    population_is_estimated: !!b.population_is_estimated,
  }));
  return {
    schema_version: PRESENCE_DELTA_SCHEMA,
    district_id: districtId,
    kind: PRESENCE_DELTA_KIND,
    changed_at: now,
    blocks,
    public_safe: true,
  };
}

/**
 * PURE convenience for the transport layer: diff a presence map against the last-broadcast
 * snapshot and, ONLY when something changed (coalesced), return a ready delta payload.
 * Returns { snapshot, delta }, where delta is null when nothing changed. The caller stores
 * `snapshot` as its new baseline and broadcasts `delta` (under t:'city_district_presence')
 * when non-null. DO and shim share this so their push behavior is byte-identical.
 */
export function deriveDistrictPresenceDelta(prevSnapshot, presence, now = Date.now()) {
  const snapshot = districtPresenceSnapshot(presence, now);
  const changed = diffDistrictPresence(prevSnapshot, snapshot);
  const delta = changed.length ? buildPresenceDelta(changed, now) : null;
  return { snapshot, delta };
}

/**
 * PURE (client): apply a presence delta to a district manifest, returning a NEW manifest with
 * the changed blocks' live fields updated. Never mutates the input. Unknown city_ids in the
 * delta are ignored (a manifest only knows its district's blocks). Only the live allowlist
 * fields are copied — static identity (display_name/theme/capacity/adjacent) is preserved.
 */
export function mergePresenceDelta(manifest, delta) {
  if (!manifest || !Array.isArray(manifest.blocks)) return manifest;
  const changes = delta && Array.isArray(delta.blocks) ? delta.blocks : [];
  if (!changes.length) return manifest;
  const byId = new Map(changes.map((b) => [b.city_id, b]));
  const blocks = manifest.blocks.map((b) => {
    const c = byId.get(b.city_id);
    if (!c) return b;
    return {
      ...b,
      population: Math.max(0, Number(c.population) || 0),
      health: c.health,
      population_is_estimated: !!c.population_is_estimated,
    };
  });
  return { ...manifest, blocks };
}
