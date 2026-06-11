/**
 * Phase 8C — per-block display identity + District Tour unit tests (city-block-identity.mjs).
 * Proves: every block has display-only identity copy; copy is clean of forbidden (economy/ownership/
 * reward) vocabulary AND within length bounds; the District Tour is non-reward + auto-scales to the live
 * block roster; identity is fallback-safe and immutable. DISPLAY-ONLY, grants nothing economic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  blockIdentity, identityBlockIds, identityCopyIsClean, tourProgress,
  IDENTITY_TAGLINE_MAX, IDENTITY_WHY_MAX,
} from '../../arcade/city/city-block-identity.mjs';
import { CITY_IDS } from '../../arcade/city/city-block.mjs';
import { FORBIDDEN_RE } from '../../arcade/city/city-interactions.mjs';

// The same player-facing economy/ownership guard the district browser smoke greps the panel against.
const PANEL_FORBIDDEN = /\$|\bcash\b|\bpayout\b|\bbuy\b|\bsell\b|\brent\b|\bown\b|\bowner\b|\bclaim\b|\bprice\b|\bmarket\b|\bstake\b|\bprofit\b|\bincome\b|\breward\b|\btoken\b|\bunlock\b/i;

test('every configured block has display-only identity (tagline + why_visit)', () => {
  for (const id of identityBlockIds()) {
    const idn = blockIdentity(id);
    assert.ok(idn.tagline.length > 0, `${id} has a tagline`);
    assert.ok(idn.why_visit.length > 0, `${id} has a why_visit`);
  }
  // identity covers the whole live roster — no block is left without a "why go there"
  for (const id of CITY_IDS) {
    assert.ok(blockIdentity(id).tagline.length > 0, `${id} (a live block) has identity copy`);
  }
});

test('all identity copy is clean of forbidden vocabulary and within bounds', () => {
  for (const id of identityBlockIds()) {
    const { tagline, why_visit } = blockIdentity(id);
    assert.ok(identityCopyIsClean(tagline, IDENTITY_TAGLINE_MAX), `${id} tagline clean+bounded: "${tagline}"`);
    assert.ok(identityCopyIsClean(why_visit, IDENTITY_WHY_MAX), `${id} why_visit clean+bounded: "${why_visit}"`);
    // belt-and-suspenders against BOTH the canonical zone guard and the panel-copy guard
    assert.equal(FORBIDDEN_RE.test(tagline + ' ' + why_visit), false, `${id} copy must pass FORBIDDEN_RE`);
    assert.equal(PANEL_FORBIDDEN.test(tagline + ' ' + why_visit), false, `${id} copy must pass the panel guard`);
  }
});

test('identityCopyIsClean rejects forbidden words, overflow, and empties', () => {
  assert.equal(identityCopyIsClean('buy tickets here', IDENTITY_WHY_MAX), false); // forbidden vocab
  assert.equal(identityCopyIsClean('earn a reward', IDENTITY_WHY_MAX), false);    // forbidden vocab
  assert.equal(identityCopyIsClean('x'.repeat(IDENTITY_WHY_MAX + 1), IDENTITY_WHY_MAX), false); // overflow
  assert.equal(identityCopyIsClean('', IDENTITY_WHY_MAX), false);                 // empty
  assert.equal(identityCopyIsClean('the calm route across', IDENTITY_WHY_MAX), true); // clean
});

test('blockIdentity is fallback-safe and immutable', () => {
  // unknown / garbage → neutral empty (renders no extra copy, never throws)
  assert.deepEqual(blockIdentity('nope-99'), { tagline: '', why_visit: '', landmark: '' });
  assert.deepEqual(blockIdentity(''), { tagline: '', why_visit: '', landmark: '' });
  assert.deepEqual(blockIdentity(null), { tagline: '', why_visit: '', landmark: '' });
  // returns a fresh object — a caller mutating it cannot corrupt the canonical config
  const a = blockIdentity('garden-06'); a.tagline = 'TAMPERED';
  assert.equal(blockIdentity('garden-06').tagline, 'the green');
});

test('District Tour (OBJ-1) is non-reward, counts known blocks, and auto-scales to the roster', () => {
  assert.deepEqual(tourProgress(new Set()), { seen: 0, total: CITY_IDS.length, complete: false });
  assert.deepEqual(tourProgress(['downtown-01', 'harbor-02', 'skyline-03']), { seen: 3, total: CITY_IDS.length, complete: false });
  // unknown ids do not inflate the count
  assert.equal(tourProgress(['downtown-01', 'nope-99', 'also-bad']).seen, 1);
  // all six → complete (and the total tracks the live roster, not a hardcoded number)
  const all = tourProgress(CITY_IDS);
  assert.equal(all.seen, CITY_IDS.length);
  assert.equal(all.complete, true);
  assert.equal(all.total, CITY_IDS.length);
});
