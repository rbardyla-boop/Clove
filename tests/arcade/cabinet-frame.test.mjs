/**
 * Phase 1i — A. Cabinet frame contracts + B. uniform-scale math + coordinate mapping.
 *
 * Pure module (no DOM), so the exact frame math the browser runtime uses is unit
 * tested here. Makes "original game size" a contract that fails tests if changed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_CONTRACTS, SCALE_MODES, FORBIDDEN_SCALE_MODES, getContract, listContracts,
  validateContract, cloneGuard, computeFrame, screenToNative, nativeToScreen,
} from '../../arcade/cabinet-frame-contract.mjs';

// ── A. contract tests ─────────────────────────────────────────────────────────
test('Pulse Tap and Signal Sprint contracts exist with positive-integer native dims', () => {
  for (const id of ['pulse_tap', 'signal_sprint']) {
    const c = getContract(id);
    assert.ok(c, `${id} contract`);
    assert.ok(Number.isInteger(c.native_width) && c.native_width > 0, `${id} width`);
    assert.ok(Number.isInteger(c.native_height) && c.native_height > 0, `${id} height`);
    assert.equal(c.native_width, 360);
    assert.equal(c.native_height, 640);
  }
});

test('declared aspect ratio matches native width/height', () => {
  for (const c of listContracts()) {
    assert.ok(Math.abs(c.aspect_ratio - c.native_width / c.native_height) < 1e-6, `${c.game_id} aspect`);
  }
});

test('every registered contract validates', () => {
  for (const c of listContracts()) {
    const v = validateContract(c);
    assert.equal(v.ok, true, `${c.game_id}: ${v.errors.join(',')}`);
  }
});

test('default scale mode is fit-contain (aspect-preserving)', () => {
  for (const c of listContracts()) assert.equal(c.scale_mode, 'fit-contain');
});

test('forbidden scale modes are rejected by validation', () => {
  for (const mode of FORBIDDEN_SCALE_MODES) {
    const bad = { ...getContract('pulse_tap'), scale_mode: mode };
    const v = validateContract(bad);
    assert.equal(v.ok, false);
    assert.ok(v.errors.includes('forbidden_scale_mode'), `mode ${mode}`);
  }
  // an unknown (non-listed) mode is also rejected
  assert.ok(validateContract({ ...getContract('pulse_tap'), scale_mode: 'wobble' }).errors.includes('unknown_scale_mode'));
  // allowed modes pass that check
  for (const mode of SCALE_MODES) {
    const v = validateContract({ ...getContract('pulse_tap'), scale_mode: mode });
    assert.ok(!v.errors.includes('forbidden_scale_mode') && !v.errors.includes('unknown_scale_mode'), `mode ${mode}`);
  }
});

test('aspect ratio mismatch fails validation', () => {
  const bad = { ...getContract('pulse_tap'), aspect_ratio: 1.0 }; // 360/640 != 1.0
  assert.equal(validateContract(bad).ok, false);
  assert.ok(validateContract(bad).errors.includes('aspect_ratio_mismatch'));
});

test('clone policy defaults to preserve original size', () => {
  for (const c of listContracts()) {
    assert.equal(c.clone_policy, 'preserve_original_size');
    assert.equal(cloneGuard(c).ok, true);
  }
});

test('changing current dimensions WITHOUT a migration flag fails the clone guard + validation', () => {
  const mutated = { ...getContract('pulse_tap'), current_width: 720, current_height: 1280, native_width: 720, native_height: 1280, aspect_ratio: 720 / 1280 };
  assert.equal(cloneGuard(mutated).ok, false);
  assert.equal(cloneGuard(mutated).reason, 'size_changed_without_migration');
  assert.equal(validateContract(mutated).ok, false);
  assert.ok(validateContract(mutated).errors.includes('size_changed_without_migration'));
  // ...but a DELIBERATE migration (flag set) is accepted by the guard
  const migrated = { ...mutated, migrated: true };
  assert.equal(cloneGuard(migrated).ok, true);
});

// ── B. scale math tests ─────────────────────────────────────────────────────────
const NW = 360, NH = 640;
const fc = (fw, fh, over = {}) => computeFrame({ nativeWidth: NW, nativeHeight: NH, frameWidth: fw, frameHeight: fh, scaleMode: 'fit-contain', allowUpscale: true, maxUpscale: 2, minScale: 0.25, ...over });

test('fit-contain preserves aspect ratio (uniform scale on both axes)', () => {
  const r = fc(1000, 1000);
  // displayed aspect must equal native aspect
  assert.ok(Math.abs((r.displayWidth / r.displayHeight) - (NW / NH)) < 1e-9);
});

test('a wide (landscape) viewport pillarboxes; tall (portrait) letterboxes — never crops', () => {
  const wide = fc(1280, 720);   // landscape → limited by height → pillarbox (x bars)
  assert.ok(wide.fits);
  assert.ok(wide.displayWidth <= 1280 + 1e-6 && wide.displayHeight <= 720 + 1e-6);
  assert.ok(wide.letterboxX > 0 && Math.abs(wide.letterboxY) < 1e-6);

  const tall = fc(360, 1200);   // very tall → limited by width → letterbox (y bars)
  assert.ok(tall.fits);
  assert.ok(tall.letterboxY > 0 && Math.abs(tall.letterboxX) < 1e-6);
});

test('no crop for fit-contain: display always fits inside the frame', () => {
  for (const [fw, fh] of [[390, 844], [844, 390], [768, 1024], [1280, 720], [320, 240]]) {
    const r = computeFrame({ nativeWidth: NW, nativeHeight: NH, frameWidth: fw, frameHeight: fh, scaleMode: 'fit-contain', allowUpscale: true, maxUpscale: 2, minScale: 0 });
    assert.ok(r.displayWidth <= fw + 1e-6 && r.displayHeight <= fh + 1e-6, `${fw}x${fh}`);
    assert.equal(r.fits, true);
  }
});

test('scale is never negative', () => {
  const r = computeFrame({ nativeWidth: NW, nativeHeight: NH, frameWidth: 0, frameHeight: 0, scaleMode: 'fit-contain', allowUpscale: true, maxUpscale: 2, minScale: 0 });
  assert.ok(r.scale >= 0);
});

test('max upscale is respected', () => {
  const r = fc(100000, 100000, { maxUpscale: 1.5 });
  assert.ok(r.scale <= 1.5 + 1e-9);
  assert.equal(r.scale, 1.5);
});

test('min scale is respected', () => {
  const r = computeFrame({ nativeWidth: NW, nativeHeight: NH, frameWidth: 36, frameHeight: 64, scaleMode: 'fit-contain', allowUpscale: true, maxUpscale: 2, minScale: 0.5 });
  assert.equal(r.scale, 0.5); // fit would be 0.1, floored to 0.5
});

test('allowUpscale=false caps scale at 1', () => {
  const r = computeFrame({ nativeWidth: NW, nativeHeight: NH, frameWidth: 100000, frameHeight: 100000, scaleMode: 'fit-contain', allowUpscale: false, maxUpscale: 4, minScale: 0 });
  assert.equal(r.scale, 1);
});

test('fit-width and fit-height honor a single axis', () => {
  assert.equal(computeFrame({ nativeWidth: NW, nativeHeight: NH, frameWidth: 720, frameHeight: 100, scaleMode: 'fit-width', allowUpscale: true, maxUpscale: 10, minScale: 0 }).scale, 2);
  assert.equal(computeFrame({ nativeWidth: NW, nativeHeight: NH, frameWidth: 100, frameHeight: 1280, scaleMode: 'fit-height', allowUpscale: true, maxUpscale: 10, minScale: 0 }).scale, 2);
});

test('native coordinate mapping round-trips', () => {
  const view = { left: 120, top: 40, scale: 1.5 };
  for (const [nx, ny] of [[0, 0], [180, 320], [359, 639], [42, 600]]) {
    const screen = nativeToScreen({ x: nx, y: ny }, view);
    const back = screenToNative({ clientX: screen.clientX, clientY: screen.clientY }, view);
    assert.ok(Math.abs(back.x - nx) < 1e-9 && Math.abs(back.y - ny) < 1e-9, `${nx},${ny}`);
  }
});

test('screenToNative inverts the applied scale + offset', () => {
  // a point at the stage origin maps to native (0,0)
  const view = { left: 200, top: 100, scale: 2 };
  const p = screenToNative({ clientX: 200, clientY: 100 }, view);
  assert.deepEqual(p, { x: 0, y: 0 });
  // a point one native unit in maps to scale px in
  const q = screenToNative({ clientX: 200 + 2, clientY: 100 + 2 }, view);
  assert.ok(Math.abs(q.x - 1) < 1e-9 && Math.abs(q.y - 1) < 1e-9);
});
