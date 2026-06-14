/**
 * R4 — screen-shake effect verification.
 *
 * Proves the screen-shake effect is closed (frozen preset set), bounded (clamped into SHAKE_BOUNDS),
 * schema-validated (deny-by-default; hostile values rejected), reduced-motion-safe (motionScale=0 →
 * ZERO camera deflection), axis-masked, falloff-enveloped, returns to rest, and export/import stable.
 *
 * Behavioral proofs use the REAL ScreenShake class with a fake camera (THREE.Vector3 offset → our
 * camera.position.add), so they are deterministic and need no browser/GL. Live in-app wiring is proved
 * separately by tests/creator/creator-editor-staging-smoke.spec.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScreenShake } from '../src/effects/ScreenShake.js';
import { resolveShake, shakeEnvelope } from '../src/effects/ScreenShakePresets.js';
import { ReducedMotion } from '../src/effects/ReducedMotion.js';
import { validateEffectsBlock } from '../src/validation/validateArcadeAsset.js';
import { exportArcadeLayout } from '../src/importExport/exportArcadeLayout.js';
import { importArcadeLayout } from '../src/importExport/importArcadeLayout.js';
import { validLayoutModel } from './fixtures.mjs';
import { SCREEN_SHAKE_NAMES, SHAKE_BOUNDS, SHAKE_AXES, SHAKE_FALLOFFS } from '../src/validation/tokens.js';

// Minimal fake camera: position with a THREE.Vector3-compatible add() that accumulates the offset.
function fakeCamera() {
  return { position: { x: 0, y: 0, z: 0, add(v) { this.x += v.x; this.y += v.y; this.z += v.z; } } };
}
const fxErrors = (fx) => { const e = []; validateEffectsBlock(fx, 'effects', e); return e; };

test('closed preset list: every name resolves; unknown/undefined degrade to none', () => {
  assert.equal(SCREEN_SHAKE_NAMES.length, 6);
  for (const name of SCREEN_SHAKE_NAMES) assert.equal(resolveShake(name).name, name);
  assert.equal(resolveShake('chaos-mode').name, 'none');
  assert.equal(resolveShake(undefined).name, 'none');
});

test('preset list matches the validation enum (every name accepted; unknown rejected)', () => {
  for (const name of SCREEN_SHAKE_NAMES) assert.deepEqual(fxErrors({ screen_shake: name }), []);
  assert.ok(fxErrors({ screen_shake: 'chaos-mode' }).length > 0);
});

test('bounds: every resolved preset stays within SHAKE_BOUNDS with closed axis/falloff', () => {
  for (const name of SCREEN_SHAKE_NAMES) {
    const s = resolveShake(name);
    assert.ok(s.amplitude >= SHAKE_BOUNDS.amplitude[0] && s.amplitude <= SHAKE_BOUNDS.amplitude[1], `${name} amplitude ${s.amplitude}`);
    assert.ok(s.frequency >= SHAKE_BOUNDS.frequency[0] && s.frequency <= SHAKE_BOUNDS.frequency[1], `${name} frequency ${s.frequency}`);
    assert.ok(s.duration >= SHAKE_BOUNDS.duration[0] && s.duration <= SHAKE_BOUNDS.duration[1], `${name} duration ${s.duration}`);
    assert.ok(SHAKE_AXES.includes(s.axis) && SHAKE_FALLOFFS.includes(s.falloff), `${name} axis/falloff`);
  }
});

test('hostile effect values are rejected (object / array / number / boolean / unknown / unknown-key)', () => {
  for (const bad of ['chaos-mode', {}, [], 123, true]) {
    assert.ok(fxErrors({ screen_shake: bad }).length > 0, `screen_shake=${JSON.stringify(bad)} must reject`);
  }
  assert.ok(fxErrors({ screen_shake: 'none', not_a_key: 1 }).length > 0, 'unknown effects key must reject');
});

test('reduced motion: motionScale=0 produces ZERO camera deflection; scale=1 deflects', () => {
  const off = new ScreenShake();
  off.setMotionScale(0);
  off.trigger('impact');
  const camOff = fakeCamera();
  for (let i = 0; i < 6; i++) off.apply(camOff, 0.02);
  assert.equal(camOff.position.x, 0);
  assert.equal(camOff.position.y, 0);
  assert.equal(camOff.position.z, 0);

  const on = new ScreenShake();
  on.setMotionScale(1);
  on.trigger('impact');
  const camOn = fakeCamera();
  let moved = false;
  for (let i = 0; i < 6; i++) { on.apply(camOn, 0.02); if (camOn.position.x !== 0 || camOn.position.y !== 0) moved = true; }
  assert.ok(moved, 'motionScale=1 must deflect the camera');
});

test('ReducedMotion override: on→scale 0, off→scale 1, auto restores', () => {
  const rm = new ReducedMotion();
  rm.setOverride('on');
  assert.equal(rm.motionScale(), 0);
  rm.setOverride('off');
  assert.equal(rm.motionScale(), 1);
  rm.setOverride('auto');
  assert.ok(rm.motionScale() === 0 || rm.motionScale() === 1);
});

test('axis masking: each axis moves only its own components', () => {
  const expectMove = { x: ['x'], y: ['y'], xy: ['x', 'y'], xyz: ['x', 'y', 'z'] };
  for (const axis of SHAKE_AXES) {
    const shake = new ScreenShake();
    shake.setMotionScale(1);
    // white-box: drive a bounded active shake with the chosen axis (no preset has axis 'x' alone)
    shake.active = { name: 'test', amplitude: 0.5, frequency: 12, duration: 1, falloff: 'linear', axis };
    shake.elapsed = 0;
    const cam = fakeCamera();
    for (let i = 0; i < 4; i++) shake.apply(cam, 0.03);
    for (const comp of ['x', 'y', 'z']) {
      if (!expectMove[axis].includes(comp)) assert.equal(cam.position[comp], 0, `axis '${axis}' must NOT move ${comp}`);
    }
    assert.ok(expectMove[axis].some((c) => cam.position[c] !== 0), `axis '${axis}' must move at least one expected component`);
  }
});

test('falloff envelope: starts at 1, ends at 0, stays within [0,1] for all falloffs', () => {
  for (const f of SHAKE_FALLOFFS) {
    assert.ok(Math.abs(shakeEnvelope(f, 0) - 1) < 1e-9, `${f} t=0 → ${shakeEnvelope(f, 0)}`);
    assert.ok(shakeEnvelope(f, 1) < 1e-9, `${f} t=1 → ${shakeEnvelope(f, 1)}`);
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = shakeEnvelope(f, t);
      assert.ok(v >= 0 && v <= 1, `${f} t=${t.toFixed(2)} → ${v}`);
    }
  }
});

test('shake returns to rest after its duration (deactivates, no further movement)', () => {
  const shake = new ScreenShake();
  shake.setMotionScale(1);
  shake.trigger('subtle'); // duration 0.18s
  const cam = fakeCamera();
  for (let i = 0; i < 20; i++) shake.apply(cam, 0.02); // 0.4s > 0.18s
  assert.equal(shake.isActive, false, 'shake must deactivate after its duration');
  const rest = { ...cam.position };
  shake.apply(cam, 0.02);
  assert.equal(cam.position.x, rest.x);
  assert.equal(cam.position.y, rest.y);
  assert.equal(cam.position.z, rest.z);
});

test('export/import preserves the selected shake preset, hash-stable', async () => {
  const model = { ...validLayoutModel(), effects: { screen_shake: 'cinematic', particle: 'none' } };
  const exp = await exportArcadeLayout(model);
  assert.equal(exp.ok, true, exp.report?.errors?.join('; '));
  const imp = await importArcadeLayout(exp.json);
  assert.equal(imp.ok, true, imp.errors?.join('; '));
  assert.equal(imp.layout.effects.screen_shake, 'cinematic');
  assert.equal(imp.hash, exp.hash);
});
