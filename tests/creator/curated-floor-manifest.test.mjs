// ADR-043 — curated floor MANIFEST schema: closed fields, selectivity, fail-quiet.
// Run: node --test tests/creator/curated-floor-manifest.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CURATED_STARTERS, validateCuratedFloor, starterManifest,
  ALLOWED_ENTRY_FIELDS, GENRE_TAGS, SHELF_TITLE, SHELF_SAFETY,
} from '../../arcade/cabinets/starters/curated-floor.mjs';
import { STARTERS } from '../../arcade/creator/arcade-builder/cabinet-templates.mjs';
import { FORBIDDEN_TERMS_RE } from '../../arcade/creator/validator/validation-report.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const clone = () => CURATED_STARTERS.map((e) => ({ ...e }));

test('unknown starter id is rejected', () => {
  const list = clone(); list[0] = { ...list[0], starter_id: 'TOTALLY UNKNOWN!!' };
  assert.equal(validateCuratedFloor(list).ok, false);
});

test('forbidden/unknown fields are rejected (economy field names can never ride an entry)', () => {
  for (const bad of ['prize_rule', 'ticket_share', 'payout_pct', 'owner', 'wallet', 'extra_thing']) {
    const list = clone(); list[0] = { ...list[0], [bad]: 1 };
    const v = validateCuratedFloor(list);
    assert.equal(v.ok, false, bad);
    assert.ok(v.errors.some((e) => new RegExp(bad).test(e)), bad);
  }
});

test('count bounds: empty and >8 lists are rejected', () => {
  assert.equal(validateCuratedFloor([]).ok, false);
  const nine = [...clone(), ...clone().slice(0, 3).map((e, i) => ({ ...e, starter_id: `pad-${i}xx`, game_id: `starter_pad_${i}xx` }))];
  assert.equal(validateCuratedFloor(nine).ok, false);
});

test('duplicate ids, oversized copy, off-list genre, traversal paths are rejected', () => {
  const dup = clone(); dup[1] = { ...dup[1], starter_id: dup[0].starter_id };
  assert.equal(validateCuratedFloor(dup).ok, false, 'duplicate');
  const long = clone(); long[0] = { ...long[0], pitch: 'x'.repeat(73) };
  assert.equal(validateCuratedFloor(long).ok, false, 'pitch bound');
  const genre = clone(); genre[0] = { ...genre[0], genre_tag: 'CASINO' };
  assert.equal(validateCuratedFloor(genre).ok, false, 'genre');
  const trav = clone(); trav[0] = { ...trav[0], starter_id: 'a/../../evil' };
  assert.equal(validateCuratedFloor(trav).ok, false, 'traversal');
});

test('selectivity: ids ⊂ starter library; ≥8 starters intentionally absent; no statics for unselected ids', () => {
  const libIds = new Set(STARTERS.map((s) => s.id));
  for (const e of CURATED_STARTERS) assert.ok(libIds.has(e.starter_id), e.starter_id);
  const selected = new Set(CURATED_STARTERS.map((e) => e.starter_id));
  const absent = STARTERS.filter((s) => !selected.has(s.id));
  assert.ok(absent.length >= 8, `${absent.length} starters stay builder-only`);
  for (const s of absent) {
    assert.ok(!existsSync(join(ROOT, 'arcade', 'cabinets', 'starters', s.id)), `${s.id} must not have checked-in statics`);
  }
});

test('one anchor per block: home_blocks cover all six city blocks exactly once', () => {
  const blocks = CURATED_STARTERS.map((e) => e.home_block).sort();
  assert.deepEqual(blocks, ['downtown-01', 'foundry-04', 'garden-06', 'harbor-02', 'nexus-05', 'skyline-03']);
});

test('all player-facing shelf copy is clean of economy vocabulary', () => {
  for (const text of [SHELF_TITLE, SHELF_SAFETY, ...CURATED_STARTERS.flatMap((e) => [e.label, e.pitch, e.genre_tag])]) {
    assert.ok(!FORBIDDEN_TERMS_RE.test(text), `"${text}"`);
  }
  assert.ok(GENRE_TAGS.every((g) => !FORBIDDEN_TERMS_RE.test(g)));
});

test('the entry shape is exactly the closed field list (no silent widening)', () => {
  for (const e of CURATED_STARTERS) {
    assert.deepEqual(Object.keys(e).sort(), [...ALLOWED_ENTRY_FIELDS].sort());
  }
});

test('generated import manifests never request a capability and stay ticketless', () => {
  for (const e of CURATED_STARTERS) {
    const m = starterManifest(e);
    assert.deepEqual(m.requested_capabilities, []);
    assert.equal(m.ticket_mode, 'none');
    assert.equal(m.challenge_mode, 'none');
    assert.equal(m.authority_mode, 'client_local_only');
  }
});
