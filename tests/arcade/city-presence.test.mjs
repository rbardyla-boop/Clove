/**
 * Phase 5C — pure unit tests for live district presence (population + health).
 * Reuses the Phase 2c freshness policy: fresh→healthy, >30s→stale, >90s→offline (population
 * evicted, no ghosts). Heartbeats carry ONLY a count + a freshness timestamp — never player data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveCityHealth, cityPresenceEntry, districtManifest,
  CITY_HEARTBEAT_TTL_MS, CITY_STALE_TTL_MS,
} from '../../arcade/city/city-district.mjs';

const NOW = 1_000_000_000;
const beat = (population, ageMs) => ({ population, last_seen_at: NOW - ageMs });

test('deriveCityHealth: fresh→healthy, >30s→stale, >90s→offline, null→unknown', () => {
  assert.equal(deriveCityHealth(null), 'unknown');
  assert.equal(deriveCityHealth(0), 'healthy');
  assert.equal(deriveCityHealth(CITY_HEARTBEAT_TTL_MS - 1), 'healthy');
  assert.equal(deriveCityHealth(CITY_HEARTBEAT_TTL_MS + 1), 'stale');
  assert.equal(deriveCityHealth(CITY_STALE_TTL_MS + 1), 'offline');
});

test('cityPresenceEntry applies the stale-population policy (no ghost population)', () => {
  assert.deepEqual(cityPresenceEntry(beat(3, 1000), NOW), { population: 3, health: 'healthy', population_is_estimated: false });
  assert.deepEqual(cityPresenceEntry(beat(3, CITY_HEARTBEAT_TTL_MS + 5000), NOW), { population: 3, health: 'stale', population_is_estimated: true });
  assert.deepEqual(cityPresenceEntry(beat(3, CITY_STALE_TTL_MS + 5000), NOW), { population: 0, health: 'offline', population_is_estimated: true });
  assert.deepEqual(cityPresenceEntry(null, NOW), { population: 0, health: 'unknown', population_is_estimated: true });
  assert.equal(cityPresenceEntry(beat(-5, 1000), NOW).population, 0);  // garbage clamped
  assert.equal(cityPresenceEntry(beat('x', 1000), NOW).population, 0);
});

test('districtManifest enriches each block from a presence map; public-safe; no ghosts', () => {
  const presence = {
    'downtown-01': beat(2, 1000),                        // healthy
    'harbor-02': beat(5, CITY_HEARTBEAT_TTL_MS + 2000),  // stale (keeps last count)
    'skyline-03': beat(9, CITY_STALE_TTL_MS + 2000),     // offline → 0
  };
  const m = districtManifest('downtown-01', presence, NOW);
  const by = (id) => m.blocks.find((b) => b.city_id === id);
  assert.equal(by('downtown-01').population, 2);
  assert.equal(by('downtown-01').health, 'healthy');
  assert.equal(by('harbor-02').population, 5);
  assert.equal(by('harbor-02').health, 'stale');
  assert.equal(by('harbor-02').population_is_estimated, true);
  assert.equal(by('skyline-03').population, 0);  // no ghost population from an offline block
  assert.equal(by('skyline-03').health, 'offline');
  // public-safe: only counts/health — never player ids, connections, or economy
  assert.equal(/player|connection|balance|ledger|inventory|secret|economy|wager/i.test(JSON.stringify(m)), false);
});

test('districtManifest with no presence is the static default (population 0 / unknown)', () => {
  const m = districtManifest('downtown-01');
  for (const b of m.blocks) {
    assert.equal(b.population, 0);
    assert.equal(b.health, 'unknown');
  }
});
