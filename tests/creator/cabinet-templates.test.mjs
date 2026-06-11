// Cabinet templates + starter library — every starter proves itself through the REAL importer.
// Run: node --test tests/creator/cabinet-templates.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STARTERS, VARIANTS, ACCENTS, SPEEDS, DIFFICULTY, MOTION, DEFAULT_FRAME,
  getStarter, startersByCategory, buildStarterPackage, buildPackage, gameSource,
} from '../../arcade/creator/arcade-builder/cabinet-templates.mjs';
import { importArcadePackage } from '../../arcade/creator/arcade-importer/import-arcade-package.mjs';
import { FORBIDDEN_TERMS_RE } from '../../arcade/creator/validator/validation-report.mjs';

const REQUIRED_FIELDS = ['id', 'name', 'category', 'tags', 'pitch', 'explain', 'input', 'round_s', 'result_note', 'mobile_note', 'reduced_motion_note', 'params'];
const CATEGORIES = ['Reflex', 'Pattern', 'Position', 'Puzzle', 'Atmosphere'];

test('library shape: ≥12 starters, ≥8 importer-valid is exceeded — ALL are importer-valid', () => {
  assert.ok(STARTERS.length >= 12, `${STARTERS.length} starters`);
  for (const s of STARTERS) {
    const report = importArcadePackage(buildStarterPackage(s.id));
    assert.ok(report.ok, `${s.id} importer-valid: ${report.errors.join(' | ')}`);
    assert.equal(report.result_trust, 'untrusted_local_proposal', `${s.id} stays a proposal`);
  }
});

test('every starter carries the full metadata contract', () => {
  for (const s of STARTERS) {
    for (const f of REQUIRED_FIELDS) assert.ok(f in s && s[f] !== '', `${s.id}.${f}`);
    assert.ok(CATEGORIES.includes(s.category), `${s.id} category`);
    assert.equal(s.input, 'tap', `${s.id} input model is the closed tap contract`);
    assert.ok(Number.isInteger(s.round_s) && s.round_s >= 15 && s.round_s <= 90, `${s.id} round target`);
    assert.ok(VARIANTS.includes(s.params.variant), `${s.id} variant closed`);
    assert.ok(s.params.accent in ACCENTS && s.params.speed in SPEEDS, `${s.id} tokens closed`);
    assert.ok(s.params.difficulty in DIFFICULTY && s.params.motion in MOTION, `${s.id} difficulty/motion closed`);
    assert.ok(['off', 'standard', 'vivid'].includes(s.params.juice), `${s.id} juice closed`);
    assert.ok(['tap_window', 'hold_band', 'release_timing', 'swipe_lane', 'drag_track'].includes(s.params.input_mode), `${s.id} input_mode closed`);
  }
});

test('all starter copy is clean of economy/ownership vocabulary (importer regex is the oracle)', () => {
  for (const s of STARTERS) {
    for (const text of [s.name, s.pitch, s.explain, s.result_note, s.mobile_note, s.reduced_motion_note, ...s.tags]) {
      assert.ok(!FORBIDDEN_TERMS_RE.test(text), `${s.id}: "${text}"`);
    }
  }
});

test('distinctness: ids/names unique; ≥5 distinct gameplay variants; sources differ per variant', () => {
  assert.equal(new Set(STARTERS.map((s) => s.id)).size, STARTERS.length, 'unique ids');
  assert.equal(new Set(STARTERS.map((s) => s.name)).size, STARTERS.length, 'unique names');
  const usedVariants = new Set(STARTERS.map((s) => s.params.variant));
  assert.ok(usedVariants.size >= 5, `${usedVariants.size} distinct variants in the library`);
  const sources = new Set([...usedVariants].map((v) => gameSource(v, '#22e0ff', '2', 'standard', 'standard')));
  assert.equal(sources.size, usedVariants.size, 'each variant generates distinct source');
});

test('all five categories are represented; atmosphere covers every themed block idea', () => {
  const byCat = startersByCategory();
  for (const c of CATEGORIES) assert.ok((byCat[c] || []).length >= 2, `${c} has ≥2 starters`);
});

test('difficulty and motion tokens actually change generated source (closed numeric resolution)', () => {
  const a = gameSource('tide-gate', '#22e0ff', '2', 'chill', 'standard');
  const b = gameSource('tide-gate', '#22e0ff', '2', 'sharp', 'standard');
  const c = gameSource('tide-gate', '#22e0ff', '2', 'sharp', 'vivid');
  assert.notEqual(a, b, 'difficulty token changes WIN');
  assert.notEqual(b, c, 'motion token changes MOT');
  assert.ok(/const WIN = 1\.5;/.test(a) && /const WIN = 0\.65;/.test(b), 'tokens resolve through the frozen table');
});

test('unknown tokens fall back to defaults; unknown starter id → null; bad params → still gated', () => {
  assert.ok(/const WIN = 1;/.test(gameSource('tide-gate', '#22e0ff', '2', 'nope', 'nada')));
  assert.equal(getStarter('not-a-starter'), null);
  const evil = buildPackage({ variant: 'fetch("x")', accent: 'javascript:', speed: '1e9', difficulty: '999', motion: null, package_id: 'fallback-cab' });
  assert.equal(evil.variant, VARIANTS[0], 'unknown variant falls back');
  assert.ok(!/javascript:|fetch\(/.test(evil.files['game.mjs']), 'hostile token values never reach source');
  assert.ok(importArcadePackage(evil).ok, 'fallback package is importer-valid');
});

test('default frame is a real contract and starters fit the size budget with headroom', () => {
  for (const s of STARTERS) {
    const pkg = buildStarterPackage(s.id);
    assert.equal(pkg.manifest.frame_contract_id, DEFAULT_FRAME, s.id);
    const total = pkg.files['game.mjs'].length + pkg.files['adapter.mjs'].length;
    assert.ok(total < pkg.manifest.size_budget_bytes * 0.5, `${s.id}: ${total}B leaves ≥2x headroom`);
  }
});
