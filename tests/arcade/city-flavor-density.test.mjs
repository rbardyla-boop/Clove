// Load-test density pass — landmarks + corridor voice (display-only flavor additions).
// Run: node --test tests/arcade/city-flavor-density.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { blockIdentity, identityBlockIds, identityCopyIsClean, IDENTITY_LANDMARK_MAX } from '../../arcade/city/city-block-identity.mjs';
import { corridorVoice, VOICE_LINE_MAX } from '../../arcade/city/city-district-flavor.mjs';
import { CITY_IDS } from '../../arcade/city/city-block.mjs';
import { FORBIDDEN_RE } from '../../arcade/city/city-interactions.mjs';

test('every live block carries a landmark; copy clean and within the bound', () => {
  for (const id of CITY_IDS) {
    const idn = blockIdentity(id);
    assert.ok(idn.landmark.length > 0, `${id} landmark`);
    assert.ok(identityCopyIsClean(idn.landmark, IDENTITY_LANDMARK_MAX), `${id} landmark clean: "${idn.landmark}"`);
  }
});

test('landmarks name PLACES, never persons (no person/creator vocabulary)', () => {
  for (const id of identityBlockIds()) {
    const lm = blockIdentity(id).landmark;
    assert.ok(!/\b(player|user|creator|owner|founder|mayor|boss|king|queen)\b/i.test(lm), `${id}: "${lm}"`);
    assert.ok(!/[0-9%]/.test(lm), `${id} landmark has no digits`);
  }
});

test('landmarks are distinct across blocks', () => {
  const all = CITY_IDS.map((id) => blockIdentity(id).landmark);
  assert.equal(new Set(all).size, all.length);
});

test('unknown block → empty landmark (fallback-safe, never throws)', () => {
  assert.equal(blockIdentity('mystery-99').landmark, '');
  assert.equal(blockIdentity(null).landmark, '');
});

test('corridor voice: both corridors carry one clean wayfinding line; unknown → empty', () => {
  for (const c of ['ring', 'new']) {
    const v = corridorVoice(c);
    assert.ok(v.length > 0 && v.length <= VOICE_LINE_MAX, `${c} length`);
    assert.ok(!FORBIDDEN_RE.test(v), `${c} vocab clean`);
    assert.ok(!/[0-9%]/.test(v), `${c} no digits`);
    assert.ok(!/\byour?\b|\bplayers?\b/i.test(v), `${c} no second person`);
  }
  assert.equal(corridorVoice('warp'), '');
  assert.equal(corridorVoice(null), '');
});

test('corridor voice avoids tone/host-rank vocabulary (forward-compat with W-5 mood screens)', () => {
  for (const c of ['ring', 'new']) {
    assert.ok(!/\b(quiet|steady|lively|active|ebb|flow|surge|low|mid|high)\b/i.test(corridorVoice(c)), c);
  }
});
