import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listCabinetPresets, CABINET_PRESET_NAMES, cabinetPreset } from '../src/cabinets/CabinetPresets.js';
import { defaultCabinet, normalizeCabinet, randomCabinet } from '../src/cabinets/CabinetConfig.js';
import { validateCabinetBlock } from '../src/validation/validateArcadeAsset.js';
import { resolveShake, shakeEnvelope } from '../src/effects/ScreenShakePresets.js';
import { resolveParticlePreset, totalParticleBudget } from '../src/effects/ParticlePresets.js';
import { resolveTheme } from '../src/arcade/ArcadeThemes.js';
import { defaultLayoutModel, createEmptyLayout, addElement, removeElement, cloneLayout } from '../src/arcade/ArcadeLayout.js';
import { exportArcadeLayout } from '../src/importExport/exportArcadeLayout.js';
import {
  SCREEN_SHAKE_NAMES, PARTICLE_NAMES, THEMES, PARTICLE_BOUNDS, SHAKE_BOUNDS,
} from '../src/validation/tokens.js';

function cabinetErrors(block) {
  const e = [];
  validateCabinetBlock(block, 'cabinet', e);
  return e;
}

test('every named cabinet preset is a valid cabinet block', () => {
  for (const { name, cabinet } of listCabinetPresets()) {
    assert.deepEqual(cabinetErrors(cabinet), [], `${name}: ${cabinetErrors(cabinet).join('; ')}`);
  }
  assert.ok(CABINET_PRESET_NAMES.length >= 8);
});

test('defaultCabinet and randomCabinet always produce valid blocks', () => {
  assert.deepEqual(cabinetErrors(defaultCabinet()), []);
  for (let i = 0; i < 25; i++) {
    assert.deepEqual(cabinetErrors(randomCabinet(`seed-${i}`)), []);
  }
});

test('randomCabinet is deterministic for a given seed', () => {
  assert.deepEqual(randomCabinet('abc'), randomCabinet('abc'));
});

test('normalizeCabinet coerces hostile input to a valid closed block', () => {
  const block = normalizeCabinet({
    type: 'spaceship',
    palette: 'rainbow',
    marquee_text: '<script>alert(1)</script>',
    glow_style: 'nuclear',
    junk_field: 42,
  });
  assert.deepEqual(cabinetErrors(block), []);
  assert.equal(block.marquee_text, ''); // unsafe text scrubbed
  assert.ok(!('junk_field' in block)); // unknown keys dropped
});

test('every screen-shake preset resolves within bounds', () => {
  for (const name of SCREEN_SHAKE_NAMES) {
    const s = resolveShake(name);
    assert.ok(s.amplitude >= SHAKE_BOUNDS.amplitude[0] && s.amplitude <= SHAKE_BOUNDS.amplitude[1]);
    assert.ok(s.frequency >= SHAKE_BOUNDS.frequency[0] && s.frequency <= SHAKE_BOUNDS.frequency[1]);
    assert.ok(s.duration >= SHAKE_BOUNDS.duration[0] && s.duration <= SHAKE_BOUNDS.duration[1]);
  }
  // unknown name falls back to a safe "none"
  assert.equal(resolveShake('chaos-mode').name, 'none');
});

test('shake envelope stays within [0,1] across progress', () => {
  for (const f of ['linear', 'ease-out', 'ease-in-out', 'bounce']) {
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const v = shakeEnvelope(f, t);
      assert.ok(v >= -0.0001 && v <= 1.0001, `${f}@${t}=${v}`);
    }
  }
});

test('every particle preset resolves within bounds and respects the count cap', () => {
  for (const name of PARTICLE_NAMES) {
    const p = resolveParticlePreset(name);
    assert.ok(p, `${name} should resolve`);
    assert.ok(p.count >= PARTICLE_BOUNDS.count[0] && p.count <= PARTICLE_BOUNDS.count[1], `${name} count ${p.count}`);
    assert.ok(p.lifetime >= PARTICLE_BOUNDS.lifetime[0] && p.lifetime <= PARTICLE_BOUNDS.lifetime[1]);
    assert.equal(typeof p.color, 'number');
  }
  assert.equal(resolveParticlePreset('none'), null);
  assert.ok(totalParticleBudget(PARTICLE_NAMES) > 0);
});

test('every theme resolves to renderer-ready values', () => {
  for (const name of THEMES) {
    const t = resolveTheme(name);
    assert.equal(typeof t.fogColor, 'number');
    assert.equal(typeof t.fogDensity, 'number');
    assert.equal(typeof t.ambient.accent, 'number');
  }
});

test('the default starter layout exports and validates cleanly', async () => {
  const res = await exportArcadeLayout(defaultLayoutModel());
  assert.equal(res.ok, true, res.report.errors.join('; '));
  assert.match(res.hash, /^sha256:[0-9a-f]{64}$/);
});

test('createEmptyLayout exports cleanly', async () => {
  const res = await exportArcadeLayout(createEmptyLayout({ id: 'blank-hall', theme: 'harbor', cols: 12, rows: 10 }));
  assert.equal(res.ok, true, res.report.errors.join('; '));
});

test('immutable layout ops never mutate the input', () => {
  const base = defaultLayoutModel();
  const before = cloneLayout(base);
  const added = addElement(base, 'props', { type: 'stool', gx: 2, gy: 2, rotation: 0, layer: 1 });
  const removed = removeElement(added, 'props', 0);
  assert.deepEqual(base, before, 'base layout must be unchanged');
  assert.equal(added.props.length, base.props.length + 1);
  assert.equal(removed.props.length, added.props.length - 1);
});
