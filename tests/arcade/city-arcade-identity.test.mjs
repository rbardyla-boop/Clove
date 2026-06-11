// Cabinet-loop polish — per-block arcade house names (display-only seam branding).
// Run: node --test tests/arcade/city-arcade-identity.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { arcadeName, arcadeNameIds, arcadeNameIsClean, ARCADE_NAME_MAX } from '../../arcade/city/city-arcade-identity.mjs';
import { blockIdentity } from '../../arcade/city/city-block-identity.mjs';
import { CITY_IDS } from '../../arcade/city/city-block.mjs';

test('every live block carries a clean, bounded arcade house name', () => {
  assert.deepEqual(new Set(arcadeNameIds()), new Set(CITY_IDS));
  for (const id of CITY_IDS) {
    const n = arcadeName(id);
    assert.ok(arcadeNameIsClean(n), `${id}: "${n}"`);
    assert.ok(n.length <= ARCADE_NAME_MAX, `${id} bound`);
  }
});

test('house names are landmark-derived PLACES — distinct, no persons, no digits', () => {
  const all = CITY_IDS.map(arcadeName);
  assert.equal(new Set(all).size, all.length, 'distinct across blocks');
  for (const id of CITY_IDS) {
    const n = arcadeName(id);
    assert.ok(/Arcade$/.test(n), `${id} reads as a venue: "${n}"`);
    assert.ok(!/[0-9%]/.test(n), `${id} no digits`);
    assert.ok(!/\b(player|user|creator|owner|founder|mayor|boss)\b/i.test(n), `${id} no person`);
    // the name leads with the block's landmark (drop the landmark's leading article)
    const lm = blockIdentity(id).landmark.replace(/^the /, '');
    assert.ok(n.startsWith(lm), `${id}: "${n}" derives from landmark "${lm}"`);
  }
});

test('fallback-safe: unknown block / bad input → empty string (callers use the server label)', () => {
  assert.equal(arcadeName('mystery-99'), '');
  assert.equal(arcadeName(null), '');
  assert.equal(arcadeName(42), '');
});
