/**
 * Phase 1 parity — Adapter SDK + import-loader (validation, manifest, path, fail-closed).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateImportPath, validateManifest, validateAdapter, FORBIDDEN_CAPABILITIES,
  ADAPTERS, isAdapterPlayable, neonGridManifest, sampleManifest, sampleFixtureContract,
} from '../../arcade/hiveworld-sim/core/phase1/adapters.mjs';
import { getContract } from '../../arcade/hiveworld-sim/core/phase1/frame-contract.mjs';

test('built-in Pulse/Signal and imported Neon Grid adapters validate against their contracts', () => {
  assert.equal(validateAdapter(ADAPTERS.pulse_tap).ok, true);
  assert.equal(validateAdapter(ADAPTERS.signal_sprint).ok, true);
  assert.equal(validateAdapter(ADAPTERS.neon_grid).ok, true);
});

test('the test-only fixture validates with its own contract resolver; the glitch adapter never does', () => {
  assert.equal(validateAdapter(ADAPTERS.sample_import_game).ok, false); // unknown contract via default resolver
  assert.equal(validateAdapter(ADAPTERS.sample_import_game, () => sampleFixtureContract).ok, true);
  assert.equal(validateAdapter(ADAPTERS.glitch).ok, false); // unknown_frame_contract
  assert.ok(validateAdapter(ADAPTERS.glitch).errors.includes('unknown_frame_contract'));
});

test('a native-size mismatch fails adapter validation', () => {
  const bad = { ...ADAPTERS.pulse_tap, nativeWidth: 720 };
  assert.ok(validateAdapter(bad).errors.includes('native_width_mismatch'));
});

test('import paths: arcade-local only; external URL / data: / traversal / game/* rejected', () => {
  assert.equal(validateImportPath('arcade/cabinets/neon-grid/adapter.mjs').ok, true);
  assert.equal(validateImportPath('https://evil/x.js').reason, 'absolute_url');
  assert.equal(validateImportPath('data:text/js,evil').reason, 'data_or_blob_scheme');
  assert.equal(validateImportPath('arcade/cabinets/../../etc/x.js').reason, 'path_traversal');
  assert.equal(validateImportPath('game/secret/x.mjs').reason, 'game_path_forbidden');
  assert.equal(validateImportPath('arcade/floor.js').reason, 'outside_allowed_root');
  assert.equal(validateImportPath('arcade/cabinets/x/y.ts').reason, 'bad_extension');
});

test('the Neon Grid manifest validates; a forbidden capability or size drift is rejected', () => {
  assert.deepEqual(validateManifest(neonGridManifest), { ok: true, errors: [] });
  for (const cap of ['external_payments', 'real_money', 'transfer', 'crypto_wallet', 'global_auth']) {
    assert.equal(validateManifest({ ...neonGridManifest, requested_capabilities: [cap] }).ok, false, cap);
  }
  const resized = { ...neonGridManifest, current_width: 720, current_height: 1280, aspect_ratio: 720 / 1280 };
  assert.ok(validateManifest(resized).errors.includes('size_changed_without_migration'));
  assert.deepEqual([...neonGridManifest.forbidden_capabilities].sort(), [...FORBIDDEN_CAPABILITIES].sort());
  assert.deepEqual(neonGridManifest.requested_capabilities, []);
});

test('the fixture manifest validates but is client-local + test-only (never production playable)', () => {
  assert.equal(validateManifest(sampleManifest).ok, true);
  assert.equal(isAdapterPlayable(ADAPTERS.sample_import_game, { activated: new Set(['sample_import_game']) }), false);
});

test('a built-in adapter is playable; an imported one only after activation; an invalid one never', () => {
  assert.equal(isAdapterPlayable(ADAPTERS.pulse_tap), true);
  assert.equal(isAdapterPlayable(ADAPTERS.neon_grid), false);
  assert.equal(isAdapterPlayable(ADAPTERS.neon_grid, { activated: new Set(['neon_grid']) }), true);
  assert.equal(isAdapterPlayable(ADAPTERS.glitch, { activated: new Set(['glitch']) }), false);
  assert.equal(getContract('glitch'), null);
});
