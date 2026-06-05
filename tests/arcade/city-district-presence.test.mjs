/**
 * Phase 5D — pure unit tests for push-on-change district presence deltas.
 *
 * The delta carries ONLY the live, public-safe per-block subset (population + health +
 * population_is_estimated) for blocks that actually changed — never player ids or private data.
 * Identical snapshots coalesce to no delta; the freshness/stale policy is the Phase 5C one
 * (reused from city-district.mjs, not re-implemented here).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  presenceSubset, districtPresenceSnapshot, diffDistrictPresence, buildPresenceDelta,
  deriveDistrictPresenceDelta, mergePresenceDelta,
  PRESENCE_DELTA_KIND, PRESENCE_DELTA_SCHEMA,
} from '../../arcade/city/city-district-presence.mjs';
import { districtManifest, CITY_HEARTBEAT_TTL_MS, CITY_STALE_TTL_MS, DISTRICT_ID } from '../../arcade/city/city-district.mjs';

const NOW = 1_000_000_000;
const beat = (population, ageMs = 1000) => ({ population, last_seen_at: NOW - ageMs });

test('presenceSubset projects exactly the 3 live public-safe fields (Phase 5C policy reused)', () => {
  assert.deepEqual(presenceSubset(beat(3), NOW), { population: 3, health: 'healthy', population_is_estimated: false });
  assert.deepEqual(presenceSubset(beat(5, CITY_HEARTBEAT_TTL_MS + 2000), NOW), { population: 5, health: 'stale', population_is_estimated: true });
  assert.deepEqual(presenceSubset(beat(9, CITY_STALE_TTL_MS + 2000), NOW), { population: 0, health: 'offline', population_is_estimated: true });
  assert.deepEqual(presenceSubset(null, NOW), { population: 0, health: 'unknown', population_is_estimated: true });
});

test('districtPresenceSnapshot covers every known block and never mutates input', () => {
  const presence = { 'downtown-01': beat(2), 'harbor-02': beat(4) };
  const frozen = JSON.stringify(presence);
  const snap = districtPresenceSnapshot(presence, NOW);
  assert.equal(snap['downtown-01'].population, 2);
  assert.equal(snap['harbor-02'].population, 4);
  assert.equal(snap['skyline-03'].population, 0);      // never reported → unknown/0
  assert.equal(snap['skyline-03'].health, 'unknown');
  assert.equal(JSON.stringify(presence), frozen);      // input untouched
});

test('identical snapshots produce NO delta (coalesced)', () => {
  const presence = { 'downtown-01': beat(2), 'harbor-02': beat(1) };
  const a = districtPresenceSnapshot(presence, NOW);
  const b = districtPresenceSnapshot(presence, NOW);
  assert.equal(diffDistrictPresence(a, b).length, 0);
  assert.equal(deriveDistrictPresenceDelta(a, presence, NOW).delta, null);
});

test('a changed population produces a delta for only that block', () => {
  const prev = districtPresenceSnapshot({ 'downtown-01': beat(2), 'harbor-02': beat(1) }, NOW);
  const changed = diffDistrictPresence(prev, districtPresenceSnapshot({ 'downtown-01': beat(2), 'harbor-02': beat(3) }, NOW));
  assert.equal(changed.length, 1);
  assert.equal(changed[0].city_id, 'harbor-02');
  assert.equal(changed[0].population, 3);
});

test('a changed health produces a delta even when the count is unchanged', () => {
  const prev = districtPresenceSnapshot({ 'downtown-01': beat(2, 1000) }, NOW);
  const next = districtPresenceSnapshot({ 'downtown-01': beat(2, CITY_HEARTBEAT_TTL_MS + 2000) }, NOW); // healthy → stale
  const changed = diffDistrictPresence(prev, next);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].health, 'stale');
  assert.equal(changed[0].population_is_estimated, true);
});

test('a changed population_is_estimated flag alone produces a delta', () => {
  const prev = districtPresenceSnapshot({ 'downtown-01': beat(3, 1000) }, NOW);                       // estimated:false
  const next = districtPresenceSnapshot({ 'downtown-01': beat(3, CITY_HEARTBEAT_TTL_MS + 1000) }, NOW); // estimated:true (stale)
  const changed = diffDistrictPresence(prev, next);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].population_is_estimated, true);
});

test('the delta is bounded to at most the number of blocks and is sorted by city_id', () => {
  const prev = districtPresenceSnapshot({}, NOW); // all unknown/0
  const next = districtPresenceSnapshot({ 'skyline-03': beat(1), 'downtown-01': beat(1), 'harbor-02': beat(1) }, NOW);
  const changed = diffDistrictPresence(prev, next);
  assert.equal(changed.length, 3);
  assert.ok(changed.length <= 3);
  assert.deepEqual(changed.map((b) => b.city_id), ['downtown-01', 'harbor-02', 'skyline-03']);
});

test('buildPresenceDelta strips any private/extra fields (allowlist projection)', () => {
  const delta = buildPresenceDelta([{
    city_id: 'downtown-01', population: 2, health: 'healthy', population_is_estimated: false,
    // hostile extras a caller must never be able to leak:
    playerId: 'p-secret', players: ['p1', 'p2'], balance: 999, ledger: [1], inventory: ['x'],
    connectionId: 'c-1', socketId: 's-1', accountId: 'acct-1', adminToken: 'tok',
  }], NOW);
  const json = JSON.stringify(delta);
  assert.equal(/player|balance|ledger|inventory|connection|socket|account|admin|secret|token/i.test(json), false);
  assert.deepEqual(Object.keys(delta.blocks[0]).sort(), ['city_id', 'health', 'population', 'population_is_estimated']);
  assert.equal(delta.public_safe, true);
  assert.equal(delta.kind, PRESENCE_DELTA_KIND);
  assert.equal(delta.schema_version, PRESENCE_DELTA_SCHEMA);
  assert.equal(delta.district_id, DISTRICT_ID);
  assert.equal(delta.changed_at, NOW);
});

test('a private field on a heartbeat never reaches the snapshot or delta', () => {
  const presence = { 'downtown-01': { population: 2, last_seen_at: NOW - 1000, playerIds: ['a', 'b'], secret: 'x' } };
  const snap = districtPresenceSnapshot(presence, NOW);
  assert.deepEqual(Object.keys(snap['downtown-01']).sort(), ['health', 'population', 'population_is_estimated']);
  const { delta } = deriveDistrictPresenceDelta(districtPresenceSnapshot({}, NOW), presence, NOW);
  assert.equal(/player|secret/i.test(JSON.stringify(delta)), false);
});

test('deriveDistrictPresenceDelta returns the next snapshot as the new baseline', () => {
  const presence = { 'downtown-01': beat(2) };
  const { snapshot, delta } = deriveDistrictPresenceDelta(districtPresenceSnapshot({}, NOW), presence, NOW);
  assert.ok(delta && delta.blocks.length >= 1);
  // feeding the returned snapshot back with the same presence coalesces (no repeat delta)
  assert.equal(deriveDistrictPresenceDelta(snapshot, presence, NOW).delta, null);
});

test('mergePresenceDelta returns a NEW manifest with updated live fields, preserving identity', () => {
  const manifest = districtManifest('downtown-01', { 'downtown-01': beat(1), 'harbor-02': beat(1) }, NOW);
  const before = JSON.stringify(manifest);
  const delta = buildPresenceDelta([{ city_id: 'harbor-02', population: 4, health: 'healthy', population_is_estimated: false }], NOW);
  const merged = mergePresenceDelta(manifest, delta);
  const h = merged.blocks.find((b) => b.city_id === 'harbor-02');
  const hOrig = manifest.blocks.find((b) => b.city_id === 'harbor-02');
  assert.equal(h.population, 4);                       // live field updated
  assert.equal(h.display_name, hOrig.display_name);    // static identity preserved
  assert.deepEqual(h.adjacent, hOrig.adjacent);
  assert.notEqual(merged, manifest);                   // new object
  assert.equal(JSON.stringify(manifest), before);      // input not mutated
});

test('mergePresenceDelta ignores unknown city_ids and empty deltas', () => {
  const manifest = districtManifest('downtown-01', {}, NOW);
  const ghost = buildPresenceDelta([{ city_id: 'atlantis-99', population: 7, health: 'healthy', population_is_estimated: false }], NOW);
  const merged = mergePresenceDelta(manifest, ghost);
  assert.equal(merged.blocks.find((b) => b.city_id === 'atlantis-99'), undefined);
  assert.equal(merged.blocks.length, manifest.blocks.length);
  assert.equal(mergePresenceDelta(manifest, buildPresenceDelta([], NOW)), manifest); // no-op returns same ref
});
