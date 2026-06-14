/**
 * R5 — particle effect verification.
 *
 * Proves particles are closed (frozen preset set), count-capped (≤600), bounds-clamped, schema-
 * validated (deny-by-default; hostile values rejected), reduced-motion-safe (motionScale=0 freezes
 * velocity-driven motion after the one ungated frame-1 recycle settle), recycle without explosion
 * (finite, count-stable), and export/import stable.
 *
 * Behavioral proofs use the REAL ParticleSystem class (THREE typed-array buffers; no GL needed for
 * construction/update), so they are deterministic and need no browser. Live in-app wiring is proved
 * separately by tests/creator/creator-editor-staging-smoke.spec.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ParticleSystem } from '../src/effects/ParticleSystem.js';
import { resolveParticlePreset, totalParticleBudget } from '../src/effects/ParticlePresets.js';
import { validateEffectsBlock } from '../src/validation/validateArcadeAsset.js';
import { exportArcadeLayout } from '../src/importExport/exportArcadeLayout.js';
import { importArcadeLayout } from '../src/importExport/importArcadeLayout.js';
import { validLayoutModel } from './fixtures.mjs';
import { PARTICLE_NAMES, PARTICLE_BOUNDS } from '../src/validation/tokens.js';

// Exact declared counts (tokens.js PARTICLE_PRESETS) — locks per-preset cost, not just "within bounds".
const DECLARED_COUNT = {
  sparks: 120, dust: 80, 'neon-motes': 140, 'pixel-burst': 200,
  'smoke-puff': 60, 'portal-shimmer': 180, 'cabinet-glow': 90,
};
const fxErrors = (fx) => { const e = []; validateEffectsBlock(fx, 'effects', e); return e; };

test('closed preset list: 7 presets resolve; none/unknown → null', () => {
  assert.equal(PARTICLE_NAMES.length, 7);
  for (const name of PARTICLE_NAMES) assert.ok(resolveParticlePreset(name), name);
  assert.equal(resolveParticlePreset('none'), null);
  assert.equal(resolveParticlePreset('evil-emitter'), null);
});

test('preset list matches the validation enum (every name + none accepted; unknown rejected)', () => {
  for (const name of [...PARTICLE_NAMES, 'none']) assert.deepEqual(fxErrors({ particle: name }), []);
  assert.ok(fxErrors({ particle: 'evil-emitter' }).length > 0);
});

test('each declared preset count resolves exactly and is within the hard cap', () => {
  for (const name of PARTICLE_NAMES) {
    const r = resolveParticlePreset(name);
    assert.equal(r.count, DECLARED_COUNT[name], `${name} count`);
    assert.ok(r.count >= PARTICLE_BOUNDS.count[0] && r.count <= PARTICLE_BOUNDS.count[1], `${name} within [0,${PARTICLE_BOUNDS.count[1]}]`);
  }
});

test('bounds: lifetime / size / speed / gravity clamp within configured ranges', () => {
  for (const name of PARTICLE_NAMES) {
    const r = resolveParticlePreset(name);
    assert.ok(r.lifetime >= PARTICLE_BOUNDS.lifetime[0] && r.lifetime <= PARTICLE_BOUNDS.lifetime[1], `${name} lifetime ${r.lifetime}`);
    assert.ok(r.size >= PARTICLE_BOUNDS.size[0] && r.size <= PARTICLE_BOUNDS.size[1], `${name} size ${r.size}`);
    assert.ok(r.speed >= PARTICLE_BOUNDS.speed[0] && r.speed <= PARTICLE_BOUNDS.speed[1], `${name} speed ${r.speed}`);
    assert.ok(r.gravity >= -8 && r.gravity <= 8, `${name} gravity ${r.gravity}`);
  }
});

test('totalParticleBudget sums resolved counts; none/unknown contribute 0', () => {
  const sum = totalParticleBudget(PARTICLE_NAMES);
  const manual = PARTICLE_NAMES.reduce((a, n) => a + resolveParticlePreset(n).count, 0);
  assert.equal(sum, manual);
  assert.ok(sum > 0);
  assert.equal(totalParticleBudget(['none', 'unknown']), 0);
});

test('hostile particle values are rejected (object / array / number / boolean / unknown)', () => {
  for (const bad of ['evil', {}, [], 999, false]) {
    assert.ok(fxErrors({ particle: bad }).length > 0, `particle=${JSON.stringify(bad)} must reject`);
  }
});

// Reduced-motion proof uses a NON-PINNED preset ('dust' → box spawn). 'sparks' (cone spawn) writes
// only velocities and pins every particle to the origin, so a position-freeze assertion on it passes
// even if motionScale never gates position — vacuous. 'dust' spawns at varied offsets AND carries
// real velocity, so freezing it proves motionScale actually stops motion, not that spawn pins it.
//
// One ungated effect exists by design: the recycle check (_age >= _life → _spawn) is NOT motionScale-
// gated, so staggered-age particles that start already-expired recycle ONCE on frame 1 even at scale
// 0, moving to a fresh spawn position. We absorb that single settle frame, THEN measure.
const RM_PRESET = 'dust';

test('reduced motion: chosen preset is non-pinned (guards against a vacuous freeze)', () => {
  // A cone/origin-pinned preset would give x-spread 0, making the freeze test below vacuous; this
  // assertion fails if RM_PRESET is ever swapped back to a pinned preset (e.g. sparks). dust's box
  // spawn spans ~1.6 on x.
  const sys = new ParticleSystem(RM_PRESET);
  const xs = [];
  for (let i = 0; i < sys.count; i++) xs.push(sys._pos[i * 3]);
  const spread = Math.max(...xs) - Math.min(...xs);
  assert.ok(spread > 0.1, `RM_PRESET must spawn at varied positions (non-pinned); x-spread ${spread}`);
});

test('reduced motion: motionScale=0 freezes velocity-driven motion after the frame-1 settle; scale=1 keeps moving', () => {
  const frozen = new ParticleSystem(RM_PRESET);
  frozen.setMotionScale(0);
  frozen.update(1 / 60); // absorb the one ungated frame-1 recycle settle
  const settled = Float32Array.from(frozen._pos);
  for (let i = 0; i < 30; i++) frozen.update(1 / 60);
  assert.deepEqual(Float32Array.from(frozen._pos), settled,
    'motionScale=0 must freeze velocity-driven motion after the settle frame');

  // motionScale=1 over the SAME window keeps moving. "motionScale ignored" == scale stuck at 1, so
  // this moving state is exactly what the freeze assertion above rejects if the step gate is removed.
  const live = new ParticleSystem(RM_PRESET);
  live.setMotionScale(1);
  live.update(1 / 60); // absorb the same settle frame
  const liveStart = Float32Array.from(live._pos);
  for (let i = 0; i < 30; i++) live.update(1 / 60);
  let moved = 0;
  for (let i = 0; i < live._pos.length; i++) if (live._pos[i] !== liveStart[i]) moved++;
  assert.ok(moved > live._pos.length / 2, `motionScale=1 must keep moving particles after settle (moved ${moved}/${live._pos.length})`);

  // Reduced motion must not corrupt the buffer: finite + count-stable.
  for (let i = 0; i < frozen._pos.length; i++) assert.ok(Number.isFinite(frozen._pos[i]), `frozen pos[${i}] finite`);
  assert.equal(frozen.count, DECLARED_COUNT[RM_PRESET], 'count stays the declared cap under reduced motion');
});

test('particle buffer stays finite and count-stable across many frames (recycle, no explosion)', () => {
  const sys = new ParticleSystem('pixel-burst');
  sys.setMotionScale(1);
  for (let i = 0; i < 240; i++) sys.update(1 / 60); // ~4s — lifetimes (0.6s) recycle many times
  assert.equal(sys.count, DECLARED_COUNT['pixel-burst'], 'count stays the declared cap');
  for (let i = 0; i < sys._pos.length; i++) assert.ok(Number.isFinite(sys._pos[i]), `pos[${i}] must stay finite`);
});

test('export/import preserves the selected particle preset, hash-stable', async () => {
  const model = { ...validLayoutModel(), effects: { screen_shake: 'none', particle: 'portal-shimmer' } };
  const exp = await exportArcadeLayout(model);
  assert.equal(exp.ok, true, exp.report?.errors?.join('; '));
  const imp = await importArcadeLayout(exp.json);
  assert.equal(imp.ok, true, imp.errors?.join('; '));
  assert.equal(imp.layout.effects.particle, 'portal-shimmer');
  assert.equal(imp.hash, exp.hash);
});

test('partial effects block: either key alone (or an empty block) is accepted (both keys optional)', () => {
  assert.deepEqual(fxErrors({}), [], 'empty effects block must be accepted');
  assert.deepEqual(fxErrors({ screen_shake: 'impact' }), [], 'shake-only block must be accepted');
  assert.deepEqual(fxErrors({ particle: 'sparks' }), [], 'particle-only block must be accepted');
});

test('combined effects: shake + particle both non-none survive export/import together, hash-stable', async () => {
  const model = { ...validLayoutModel(), effects: { screen_shake: 'cinematic', particle: 'portal-shimmer' } };
  const exp = await exportArcadeLayout(model);
  assert.equal(exp.ok, true, exp.report?.errors?.join('; '));
  const imp = await importArcadeLayout(exp.json);
  assert.equal(imp.ok, true, imp.errors?.join('; '));
  assert.equal(imp.layout.effects.screen_shake, 'cinematic');
  assert.equal(imp.layout.effects.particle, 'portal-shimmer');
  assert.equal(imp.hash, exp.hash);
});
