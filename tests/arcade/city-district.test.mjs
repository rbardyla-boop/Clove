/**
 * Phase 5A — pure unit tests for the Multi-Block District model (city-district.mjs).
 * Discovery + bounded routing + public-safe summaries. No state, no economy, no private data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DISTRICT_ID, DISTRICT_NAME,
  isKnownBlock, adjacentBlocks, areAdjacent,
  blockPublicSummary, districtManifest, validateRouteRequest, cityWsHint,
} from '../../arcade/city/city-district.mjs';
import { CITY_IDS, DEFAULT_CITY_ID } from '../../arcade/city/city-block.mjs';

// Word-boundaried so legitimate substrings (e.g. "cur**rent**_city_id") don't false-match.
// Phase 5C: a public `population` COUNT + `health` are public-safe aggregates (like arcade
// rooms expose) — NOT private. The forbidden set is player-level/economy data.
const PRIVATE = /\b(balance|ledger|inventory|redemption|secret|token|economy|payout|wager|owner|ownership|rent|rental|income|landlord|tenant|price|market|marketplace|player_id|connection)\b/i;

// ── block identity ───────────────────────────────────────────────────────────
test('known block ids are accepted; unknown/garbage rejected', () => {
  for (const id of CITY_IDS) assert.equal(isKnownBlock(id), true);
  assert.equal(isKnownBlock('harbor-02'), true);
  assert.equal(isKnownBlock('nope-99'), false);
  assert.equal(isKnownBlock('../etc'), false);
  assert.equal(isKnownBlock(''), false);
  assert.equal(isKnownBlock(null), false);
});

// ── adjacency / topology ─────────────────────────────────────────────────────
test('adjacency is deterministic, symmetric, and references only known blocks', () => {
  for (const id of CITY_IDS) {
    const adj = adjacentBlocks(id);
    assert.ok(Array.isArray(adj));
    for (const n of adj) {
      assert.equal(isKnownBlock(n), true, `${id} -> ${n} must be a known block`);
      assert.equal(areAdjacent(n, id), true, `adjacency must be symmetric: ${id}<->${n}`);
      assert.notEqual(n, id, 'a block is not adjacent to itself');
    }
  }
  // returns a fresh array (no shared mutable state)
  const a = adjacentBlocks('harbor-02');
  a.push('tamper');
  assert.deepEqual(adjacentBlocks('harbor-02'), ['downtown-01', 'skyline-03']);
});

test('downtown and skyline stay non-adjacent (opposite blocks need a route via harbor or foundry)', () => {
  assert.equal(areAdjacent('downtown-01', 'harbor-02'), true);
  assert.equal(areAdjacent('harbor-02', 'skyline-03'), true);
  assert.equal(areAdjacent('downtown-01', 'skyline-03'), false);
});

// ── Phase 6D: fourth block + non-linear (ring) topology ───────────────────────
test('6D: foundry-04 is a known block in the catalog', () => {
  assert.equal(isKnownBlock('foundry-04'), true);
  assert.ok(CITY_IDS.includes('foundry-04'));
});

test('6D: the ring topology — foundry connects downtown & skyline; harbor stays the same', () => {
  // foundry's neighbours
  assert.deepEqual(adjacentBlocks('foundry-04').slice().sort(), ['downtown-01', 'skyline-03']);
  // downtown and skyline each gained foundry; harbor is UNCHANGED (preserves Phase 5A routes)
  assert.deepEqual(adjacentBlocks('downtown-01').slice().sort(), ['foundry-04', 'harbor-02']);
  assert.deepEqual(adjacentBlocks('skyline-03').slice().sort(), ['foundry-04', 'harbor-02']);
  assert.deepEqual(adjacentBlocks('harbor-02'), ['downtown-01', 'skyline-03']);
  // adjacency is symmetric for every new edge
  assert.equal(areAdjacent('foundry-04', 'downtown-01'), true);
  assert.equal(areAdjacent('downtown-01', 'foundry-04'), true);
  assert.equal(areAdjacent('foundry-04', 'skyline-03'), true);
  assert.equal(areAdjacent('skyline-03', 'foundry-04'), true);
});

test('6D: the ring is non-linear — harbor↔foundry are OPPOSITE (non-adjacent); two paths downtown↔skyline', () => {
  assert.equal(areAdjacent('harbor-02', 'foundry-04'), false);   // opposite corners of the ring
  assert.equal(areAdjacent('downtown-01', 'skyline-03'), false); // opposite corners of the ring
  // downtown reaches skyline two ways: via harbor AND via foundry (more than one path)
  assert.ok(areAdjacent('downtown-01', 'harbor-02') && areAdjacent('harbor-02', 'skyline-03'));
  assert.ok(areAdjacent('downtown-01', 'foundry-04') && areAdjacent('foundry-04', 'skyline-03'));
});

test('6D: routing respects the ring — adjacent foundry routes accepted; non-adjacent rejected', () => {
  assert.equal(validateRouteRequest('downtown-01', 'foundry-04').ok, true);
  assert.equal(validateRouteRequest('skyline-03', 'foundry-04').ok, true);
  assert.equal(validateRouteRequest('foundry-04', 'downtown-01').ok, true);
  // harbor↔foundry is not a direct edge — must be rejected
  assert.deepEqual(validateRouteRequest('harbor-02', 'foundry-04'), { ok: false, reason: 'not_adjacent' });
  assert.deepEqual(validateRouteRequest('foundry-04', 'harbor-02'), { ok: false, reason: 'not_adjacent' });
});

// ── public summaries ─────────────────────────────────────────────────────────
test('block public summary carries identity/presentation/presence only — no private/economy fields', () => {
  const s = blockPublicSummary('downtown-01');
  assert.deepEqual(Object.keys(s).sort(),
    ['adjacent', 'capacity', 'city_id', 'display_name', 'health', 'population', 'population_is_estimated', 'theme']);
  assert.equal(s.city_id, 'downtown-01');
  // no heartbeat → unknown / 0 (the Phase 5A/5B static default)
  assert.equal(s.population, 0);
  assert.equal(s.health, 'unknown');
  assert.equal(blockPublicSummary('nope') === null, true);
  assert.equal(PRIVATE.test(JSON.stringify(s)), false);
});

// ── manifest ─────────────────────────────────────────────────────────────────
test('district manifest lists all blocks, is public-safe, and reports the current block', () => {
  const m = districtManifest('harbor-02');
  assert.equal(m.district_id, DISTRICT_ID);
  assert.equal(m.district_name, DISTRICT_NAME);
  assert.equal(m.current_city_id, 'harbor-02');
  assert.equal(m.blocks.length, CITY_IDS.length);
  assert.deepEqual(m.blocks.map((b) => b.city_id), CITY_IDS.slice());
  assert.equal(typeof m.adjacency, 'object');
  assert.equal(PRIVATE.test(JSON.stringify(m)), false);
});

test('manifest falls back to the default block for an unknown/garbage current id', () => {
  assert.equal(districtManifest('nope-99').current_city_id, DEFAULT_CITY_ID);
  assert.equal(districtManifest('../etc/passwd').current_city_id, DEFAULT_CITY_ID);
  assert.equal(districtManifest(null).current_city_id, DEFAULT_CITY_ID);
});

// ── route validation ─────────────────────────────────────────────────────────
test('route to a known ADJACENT block is accepted with a same-origin ws hint', () => {
  const r = validateRouteRequest('downtown-01', 'harbor-02');
  assert.equal(r.ok, true);
  assert.equal(r.target_city_id, 'harbor-02');
  assert.equal(r.ws_hint, cityWsHint('harbor-02'));
  assert.equal(/^\/arcade\/city\/ws\?city=harbor-02$/.test(r.ws_hint), true);
});

test('route is bounded: non-adjacent, unknown, same-block, garbage all rejected with reasons', () => {
  assert.deepEqual(validateRouteRequest('downtown-01', 'skyline-03'), { ok: false, reason: 'not_adjacent' });
  assert.deepEqual(validateRouteRequest('downtown-01', 'nope-99'), { ok: false, reason: 'unknown_block' });
  assert.deepEqual(validateRouteRequest('downtown-01', 'downtown-01'), { ok: false, reason: 'same_block' });
  assert.deepEqual(validateRouteRequest('downtown-01', '../etc/passwd'), { ok: false, reason: 'invalid_target' }); // bad charset → sanitized empty
  assert.deepEqual(validateRouteRequest('downtown-01', 'unknown-but-valid-charset'), { ok: false, reason: 'unknown_block' });
  assert.deepEqual(validateRouteRequest('downtown-01', ''), { ok: false, reason: 'invalid_target' });
  assert.deepEqual(validateRouteRequest('downtown-01', null), { ok: false, reason: 'invalid_target' });
  assert.deepEqual(validateRouteRequest('bogus-source', 'harbor-02'), { ok: false, reason: 'unknown_source' });
});

test('route validation is pure — repeated calls are identical and never throw', () => {
  const a = validateRouteRequest('harbor-02', 'skyline-03');
  const b = validateRouteRequest('harbor-02', 'skyline-03');
  assert.deepEqual(a, b);
  assert.equal(a.ok, true);
  // an untrusted target case-folds + sanitizes (never rewrites identity into a valid one)
  assert.equal(validateRouteRequest('harbor-02', 'SKYLINE-03').ok, true); // sanitizeCityId lowercases
  assert.equal(validateRouteRequest('harbor-02', 'sky line').ok, false);  // space → invalid charset
});
