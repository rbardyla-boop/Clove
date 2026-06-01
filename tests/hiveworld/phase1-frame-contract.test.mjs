/**
 * Phase 1 parity — Cabinet Frame Contract metadata + clone guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FRAME_CONTRACTS, getContract, listContracts, validateContract, cloneGuard, FORBIDDEN_SCALE_MODES,
} from '../../arcade/hiveworld-sim/core/phase1/frame-contract.mjs';

test('all three contracts exist at 360x640 fit-contain and validate', () => {
  for (const id of ['pulse_tap', 'signal_sprint', 'neon_grid']) {
    const c = getContract(id);
    assert.ok(c, id);
    assert.equal(c.native_width, 360);
    assert.equal(c.native_height, 640);
    assert.equal(c.scale_mode, 'fit-contain');
    assert.equal(c.clone_policy, 'preserve_original_size');
    assert.equal(validateContract(c).ok, true, `${id}: ${validateContract(c).errors.join(',')}`);
  }
});

test('declared aspect ratio matches native width/height for every contract', () => {
  for (const c of listContracts()) assert.ok(Math.abs(c.aspect_ratio - c.native_width / c.native_height) < 1e-6, c.game_id);
});

test('clone guard rejects size drift without a migration flag; migration flag allows it', () => {
  const drift = { ...getContract('neon_grid'), current_width: 720, current_height: 1280 };
  assert.equal(cloneGuard(drift).ok, false);
  assert.equal(cloneGuard(drift).reason, 'size_changed_without_migration');
  assert.equal(cloneGuard({ ...drift, migrated: true }).ok, true);
});

test('forbidden scale modes (stretch/crop/fill) are rejected by validation', () => {
  for (const mode of FORBIDDEN_SCALE_MODES) {
    const v = validateContract({ ...getContract('pulse_tap'), scale_mode: mode });
    assert.equal(v.ok, false);
    assert.ok(v.errors.includes('forbidden_scale_mode'), mode);
  }
});

test('an aspect-ratio mismatch fails validation', () => {
  assert.ok(validateContract({ ...getContract('pulse_tap'), aspect_ratio: 1.0 }).errors.includes('aspect_ratio_mismatch'));
});

test('the frame contracts are exactly the three product cabinets', () => {
  assert.deepEqual(Object.keys(FRAME_CONTRACTS).sort(), ['neon_grid', 'pulse_tap', 'signal_sprint']);
});
