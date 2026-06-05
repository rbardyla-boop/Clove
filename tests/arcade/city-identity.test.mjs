/**
 * Phase 5B — pure unit tests for per-block identity (display-only).
 * Each district block has its own default style + landmark labels, drawn from the SAME
 * closed stewardship allowlist and overlaid on IDENTICAL geometry (so collision / spawn /
 * portal authority is unchanged). No-arg/unknown cityId falls back to downtown.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { publicLayout, CITY_IDS } from '../../arcade/city/city-block.mjs';
import {
  defaultBlockStyle, normalizeBlockStyle, evaluateStewardship,
  ALLOWED_PALETTES, ALLOWED_SIGN_VARIANTS, ALLOWED_INTENSITY, ALLOWED_TARGETS,
} from '../../arcade/city/city-stewardship.mjs';

const HELPER = { tier: 'helper', support_signal: 'steady' };

// ── per-block default style ──────────────────────────────────────────────────
test('each block has a distinct, manifest-valid default style; no-arg = downtown', () => {
  const downtown = defaultBlockStyle('downtown-01');
  const harbor = defaultBlockStyle('harbor-02');
  const skyline = defaultBlockStyle('skyline-03');

  // distinct identities (the three arcade-front palettes differ)
  const palettes = [downtown, harbor, skyline].map((s) => s.arcade_front.palette);
  assert.equal(new Set(palettes).size, 3, 'three distinct arcade palettes');

  // backward-compat: no-arg and unknown fall back to the downtown default
  assert.deepEqual(defaultBlockStyle(), downtown);
  assert.deepEqual(defaultBlockStyle('nope-99'), downtown);

  // every per-block default is already within the closed allowlist (normalize idempotent)
  for (const id of CITY_IDS) {
    const s = defaultBlockStyle(id);
    assert.deepEqual(normalizeBlockStyle(s), s, `${id} default is manifest-valid`);
    for (const t of ALLOWED_TARGETS) {
      assert.ok(ALLOWED_PALETTES.includes(s[t].palette), `${id}.${t} palette allowlisted`);
      if (s[t].sign_variant) assert.ok(ALLOWED_SIGN_VARIANTS.includes(s[t].sign_variant));
      if (s[t].intensity) assert.ok(ALLOWED_INTENSITY.includes(s[t].intensity));
    }
  }
});

test('a steward reset restores the BLOCK\'s own default identity (not always downtown)', () => {
  const r = evaluateStewardship({
    cityId: 'harbor-02', hostRank: HELPER,
    currentStewardship: defaultBlockStyle('downtown-01'),
    request: { action: 'reset' },
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.canonical_style, defaultBlockStyle('harbor-02'));
  assert.notDeepEqual(r.canonical_style, defaultBlockStyle('downtown-01'));
});

// ── per-block landmark labels (display only; identical geometry) ──────────────
test('per-block layouts share IDENTICAL geometry but distinct landmark labels', () => {
  const dt = publicLayout('downtown-01');
  const hb = publicLayout('harbor-02');
  const sk = publicLayout('skyline-03');

  // geometry byte-identical → collision / spawn / portal authority unchanged across blocks
  const geom = (L) => L.buildings.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h }));
  assert.deepEqual(geom(hb), geom(dt));
  assert.deepEqual(geom(sk), geom(dt));
  assert.deepEqual(hb.portals, dt.portals);
  assert.deepEqual(hb.spawns, dt.spawns);
  assert.deepEqual(sk.props, dt.props);

  // non-arcade landmark labels differ per block
  const labelOf = (L, id) => L.buildings.find((b) => b.id === id).label;
  assert.notEqual(labelOf(hb, 'data-spire'), labelOf(dt, 'data-spire'));
  assert.notEqual(labelOf(sk, 'data-spire'), labelOf(dt, 'data-spire'));
  assert.notEqual(labelOf(hb, 'data-spire'), labelOf(sk, 'data-spire'));

  // the arcade building keeps its label everywhere (it is the portal home)
  assert.equal(labelOf(hb, 'arcade-bldg'), labelOf(dt, 'arcade-bldg'));
  assert.equal(labelOf(sk, 'arcade-bldg'), labelOf(dt, 'arcade-bldg'));
});

test('publicLayout() with no/unknown cityId returns the default (downtown) labels', () => {
  const labelOf = (L, id) => L.buildings.find((b) => b.id === id).label;
  assert.equal(labelOf(publicLayout(), 'data-spire'), labelOf(publicLayout('downtown-01'), 'data-spire'));
  assert.equal(labelOf(publicLayout('../etc'), 'data-spire'), labelOf(publicLayout('downtown-01'), 'data-spire'));
});
