// Next-density pass — STREET LIFE ambient happenings (display-only, deterministic rotation).
// Run: node --test tests/arcade/city-street-life.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  streetHappening, streetLines, streetBlockIds, streetIsClean,
  STREET_LINE_MAX, STREET_BUCKET_MS,
} from '../../arcade/city/city-street-life.mjs';
import { CITY_IDS } from '../../arcade/city/city-block.mjs';
import { FORBIDDEN_RE } from '../../arcade/city/city-interactions.mjs';

test('every live block carries street lines; all clean and within the bound', () => {
  for (const id of CITY_IDS) {
    const lines = streetLines(id);
    assert.ok(lines.length >= 2, `${id} has rotation material`);
    for (const l of lines) assert.ok(streetIsClean(l), `${id} line clean: "${l}"`);
  }
  assert.deepEqual(new Set(streetBlockIds()), new Set(CITY_IDS));
});

test('street lines are pure scenery — no numbers, no second person, no status/tone vocabulary', () => {
  for (const id of streetBlockIds()) {
    for (const l of streetLines(id)) {
      assert.ok(!/[0-9%]/.test(l), `${id} no digits: "${l}"`);
      assert.ok(!/\byour?\b|\bplayers?\b|\busers?\b/i.test(l), `${id} no second person: "${l}"`);
      assert.ok(!/\b(quiet|steady|lively|active|ebb|flow|surge|low|mid|high)\b/i.test(l), `${id} no mood-tone overlap: "${l}"`);
      assert.ok(!FORBIDDEN_RE.test(l), `${id} forbidden vocab: "${l}"`);
    }
  }
});

test('deterministic: same (block, bucket) → same line; two clients agree', () => {
  const aligned = Math.floor(1_700_000_000_000 / STREET_BUCKET_MS) * STREET_BUCKET_MS;
  for (const id of CITY_IDS) {
    assert.equal(streetHappening(id, aligned), streetHappening(id, aligned + STREET_BUCKET_MS - 1));
  }
});

test('rotation: consecutive buckets cycle through the block table (never random)', () => {
  const id = CITY_IDS[0];
  const lines = streetLines(id);
  const base = Math.floor(1_700_000_000_000 / STREET_BUCKET_MS) * STREET_BUCKET_MS;
  for (let k = 0; k < lines.length * 2; k++) {
    assert.equal(streetHappening(id, base + k * STREET_BUCKET_MS), lines[(Math.floor(base / STREET_BUCKET_MS) + k) % lines.length]);
  }
});

test('fallback-safe: unknown block / bad clock → empty string, never throws', () => {
  assert.equal(streetHappening('mystery-99', Date.now()), '');
  assert.equal(streetHappening(null, Date.now()), '');
  assert.equal(streetHappening(CITY_IDS[0], NaN), '');
  assert.equal(streetHappening(CITY_IDS[0], -5), '');
  assert.equal(streetLines('mystery-99').length, 0);
});

test('bound holds: every line fits the shared flavor budget', () => {
  for (const id of streetBlockIds()) {
    for (const l of streetLines(id)) assert.ok(l.length <= STREET_LINE_MAX, `${id}: ${l.length}`);
  }
});
