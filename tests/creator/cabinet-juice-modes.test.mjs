// Cabinet JUICE + INPUT MODES — closed tokens, bounded effects, reduced-motion clamp,
// generic mode scoring, and adversarial token injection. The importer stays the gate.
// Run: node --test tests/creator/cabinet-juice-modes.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STARTERS, JUICE, INPUT_MODES, INPUT_MODE_COPY,
  gameSource, buildStarterPackage, buildPackage,
} from '../../arcade/creator/arcade-builder/cabinet-templates.mjs';
import { importArcadePackage, SOURCE_FORBIDDEN } from '../../arcade/creator/arcade-importer/import-arcade-package.mjs';
import { FORBIDDEN_TERMS_RE } from '../../arcade/creator/validator/validation-report.mjs';

const SRC = (juice, mode) => gameSource('tide-gate', '#22e0ff', '2', 'standard', 'standard', juice, mode);

test('juice tokens resolve through the frozen table; unknown falls back to standard', () => {
  assert.ok(/const FX = RM \? 0 : 0;/.test(SRC('off', 'tap_window')));
  assert.ok(/const FX = RM \? 0 : 1;/.test(SRC('standard', 'tap_window')));
  assert.ok(/const FX = RM \? 0 : 2;/.test(SRC('vivid', 'tap_window')));
  assert.ok(/const FX = RM \? 0 : 1;/.test(SRC('ARBITRARY 9999', 'tap_window')), 'hostile juice → standard');
});

test('reduced-motion clamp is structural: FX derives from RM in every generated game', () => {
  for (const s of STARTERS) {
    const src = buildStarterPackage(s.id).files['game.mjs'];
    assert.ok(/prefers-reduced-motion: reduce/.test(src), s.id);
    assert.ok(/const FX = RM \? 0 :/.test(src), `${s.id} clamps FX under RM`);
    assert.ok(/if \(FX > 1\) shake/.test(src), `${s.id} shake only ever set at vivid (so never under RM)`);
  }
});

test('particle pool is a FIXED size from the closed table — never an arbitrary count', () => {
  assert.ok(/const FXN = FX \? 24 : 0;/.test(SRC('standard', 'tap_window')));
  assert.ok(/const FXN = FX \? 48 : 0;/.test(SRC('vivid', 'tap_window')));
  assert.ok(/const FXN = FX \? 0 : 0;/.test(SRC('off', 'tap_window')));
  // ring-buffer write is modulo the pool — bounded by construction
  assert.ok(/fi = \(fi \+ 1\) % FXN;/.test(SRC('standard', 'tap_window')));
});

test('no timers, no allocations after init: effects are decay-only rAF-driven state', () => {
  const src = SRC('vivid', 'drag_track');
  assert.ok(!/setTimeout|setInterval|requestAnimationFrame/.test(src), 'generated game owns no timers (the host owns the loop)');
  assert.ok(!/new Array|Array\(/.test(src), 'no dynamic array allocation');
});

test('input modes resolve through the closed list; unknown falls back to tap_window', () => {
  for (const m of INPUT_MODES) assert.ok(new RegExp(`const MODE = '${m}';`).test(SRC('standard', m)), m);
  assert.ok(/const MODE = 'tap_window';/.test(SRC('standard', 'mind_control')), 'hostile mode → tap_window');
});

test("every mode handles a plain 'tap' (keyboard/sandbox degenerate) and proposes integer scores", () => {
  for (const m of INPUT_MODES) {
    const src = SRC('standard', m);
    assert.ok(/ev\.type === 'tap'/.test(src), m);
    assert.ok(/proposed_score: score, public_safe: true/.test(src), m);
  }
});

test('mode coverage in the library: ≥1 starter per mode, ≥6 non-tap starters, ≥8 with juice on', () => {
  const byMode = {};
  for (const s of STARTERS) (byMode[s.params.input_mode] = byMode[s.params.input_mode] || []).push(s.id);
  for (const m of INPUT_MODES) assert.ok((byMode[m] || []).length >= 1, `mode ${m} has a starter`);
  assert.ok(STARTERS.filter((s) => s.params.input_mode !== 'tap_window').length >= 6, 'non-tap variety');
  assert.ok(STARTERS.filter((s) => s.params.juice !== 'off').length >= 8, 'juice adoption');
});

test('all 16 starters remain importer-valid with juice + modes baked in', () => {
  for (const s of STARTERS) {
    const report = importArcadePackage(buildStarterPackage(s.id));
    assert.ok(report.ok, `${s.id}: ${report.errors.join(' | ')}`);
  }
});

test('juiced/moded source carries no forbidden construct or economy vocabulary at any token combo', () => {
  for (const j of Object.keys(JUICE)) {
    for (const m of INPUT_MODES) {
      const src = SRC(j, m);
      for (const [label, re] of SOURCE_FORBIDDEN) assert.ok(!re.test(src), `${j}/${m}: ${label}`);
      assert.ok(!FORBIDDEN_TERMS_RE.test(src), `${j}/${m}: economy vocabulary`);
    }
  }
});

test('mode instruction copy: present for every mode, short, clean, no digits', () => {
  for (const m of INPUT_MODES) {
    const c = INPUT_MODE_COPY[m];
    assert.ok(typeof c === 'string' && c.length > 0 && c.length <= 48, m);
    assert.ok(!FORBIDDEN_TERMS_RE.test(c) && !/[0-9%]/.test(c), m);
  }
});

test('adversarial params through buildPackage: hostile juice/mode strings never reach source', () => {
  const evil = buildPackage({ package_id: 'probe-cab', display_name: 'Probe', variant: 'pulse-ring', accent: 'cyan', speed: 'medium', juice: '"); fetch("x"); //', input_mode: 'eval(1)' });
  assert.ok(!/fetch|eval/.test(evil.files['game.mjs']));
  assert.ok(importArcadePackage(evil).ok, 'fallback package stays importer-valid');
});
