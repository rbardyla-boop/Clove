/**
 * Phase 1j — A. adapter schema + B. import manifest + C. mount-plan logic + D. catalog/adapter integration.
 *
 * Pure modules (no DOM): the adapter SDK + import manifest validation are unit
 * tested here so the arcade's "enter through an adapter or you don't enter" rule
 * is enforced by tests, not convention.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateAdapter, cabinetRenderState, playableCabinets, getAdapter, hasAdapter, planAdapterMount,
  AUTHORITY_MODES, TICKET_MODES, CHALLENGE_MODES,
} from '../../arcade/cabinet-adapter-sdk.mjs';
// importing the adapters registers them in the SDK registry
import { pulseTapAdapter } from '../../arcade/adapters/pulse-tap-adapter.mjs';
import { signalSprintAdapter } from '../../arcade/adapters/signal-sprint-adapter.mjs';
import { validateManifest, MANIFEST_VERSION, FORBIDDEN_CAPABILITIES } from '../../arcade/game-import-manifest.mjs';
import { getContract } from '../../arcade/cabinet-frame-contract.mjs';
import { getCabinet } from '../../workers/arcade/src/catalog.mjs';
import { sampleImportManifest, sampleImportContract } from '../../arcade/cabinets/sample-import-game/manifest.mjs';
import { sampleImportAdapter, sampleContractResolver } from '../../arcade/cabinets/sample-import-game/adapter.mjs';

// ── A. adapter schema ─────────────────────────────────────────────────────────
test('the Pulse Tap and Signal Sprint adapters validate against their frame contracts', () => {
  assert.deepEqual(validateAdapter(pulseTapAdapter), { ok: true, errors: [] });
  assert.deepEqual(validateAdapter(signalSprintAdapter), { ok: true, errors: [] });
});

test('adapter native dimensions must match the frame contract', () => {
  const c = getContract('pulse_tap');
  assert.equal(pulseTapAdapter.nativeWidth, c.native_width);
  assert.equal(pulseTapAdapter.nativeHeight, c.native_height);
  const bad = { ...pulseTapAdapter, nativeWidth: 720 };
  assert.equal(validateAdapter(bad).ok, false);
  assert.ok(validateAdapter(bad).errors.includes('native_width_mismatch'));
});

test('invalid authority / ticket / challenge modes are rejected', () => {
  assert.ok(validateAdapter({ ...pulseTapAdapter, authorityMode: 'bogus' }).errors.includes('bad_authority_mode'));
  assert.ok(validateAdapter({ ...pulseTapAdapter, ticketMode: 'bogus' }).errors.includes('bad_ticket_mode'));
  assert.ok(validateAdapter({ ...pulseTapAdapter, challengeMode: 'bogus' }).errors.includes('bad_challenge_mode'));
  // sanity: the declared modes are all in the allowed sets
  assert.ok(AUTHORITY_MODES.includes(pulseTapAdapter.authorityMode));
  assert.ok(TICKET_MODES.includes(pulseTapAdapter.ticketMode));
  assert.ok(CHALLENGE_MODES.includes(pulseTapAdapter.challengeMode));
});

test('missing required lifecycle hooks are rejected', () => {
  const bad = { ...pulseTapAdapter, lifecycle: ['onMount'] };
  const v = validateAdapter(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => e.startsWith('missing_lifecycle:')));
});

test('invalid selectors are rejected', () => {
  assert.ok(validateAdapter({ ...pulseTapAdapter, selectors: { panel: '.x' } }).errors.includes('bad_selectors'));
  assert.ok(validateAdapter({ ...pulseTapAdapter, selectors: null }).errors.includes('bad_selectors'));
});

test('an unknown frame contract is rejected', () => {
  const v = validateAdapter({ ...pulseTapAdapter, frameContractId: 'nope' });
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes('unknown_frame_contract'));
});

test('a bad clone policy is rejected', () => {
  assert.ok(validateAdapter({ ...pulseTapAdapter, clonePolicy: 'resize_freely' }).errors.includes('bad_clone_policy'));
});

// ── B. import manifest ──────────────────────────────────────────────────────────
test('a valid import manifest passes', () => {
  assert.equal(sampleImportManifest.manifest_version, MANIFEST_VERSION);
  assert.deepEqual(validateManifest(sampleImportManifest), { ok: true, errors: [] });
});

test('original/current dimension mismatch is rejected without a migration flag', () => {
  const bad = { ...sampleImportManifest, current_width: 720, current_height: 1280, aspect_ratio: 720 / 1280 };
  const v = validateManifest(bad);
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes('size_changed_without_migration'));
});

test('a dimension change is allowed only with an explicit migration flag', () => {
  const migrated = { ...sampleImportManifest, current_width: 720, current_height: 1280, aspect_ratio: 720 / 1280, migration_flag: true };
  assert.equal(validateManifest(migrated).ok, true);
});

test('an aspect-ratio mismatch is rejected', () => {
  const bad = { ...sampleImportManifest, aspect_ratio: 1.0 }; // 320/480 != 1.0
  assert.ok(validateManifest(bad).errors.includes('aspect_ratio_mismatch'));
});

test('forbidden capabilities are rejected', () => {
  for (const cap of ['external_payments', 'real_money', 'transfer', 'resale', 'crypto_wallet', 'global_auth', 'dom_escape']) {
    const bad = { ...sampleImportManifest, requested_capabilities: [cap] };
    const v = validateManifest(bad);
    assert.equal(v.ok, false, `${cap} should be rejected`);
    assert.ok(v.errors.includes(`forbidden_capability:${cap}`), `${cap}`);
  }
});

test('external network is rejected by default but allowed only with explicit approval', () => {
  const m = { ...sampleImportManifest, requested_capabilities: ['external_network'] };
  assert.equal(validateManifest(m).ok, false);
  assert.ok(validateManifest(m).errors.includes('forbidden_capability:external_network'));
  assert.equal(validateManifest(m, { approvedExternalNetwork: true }).ok, true);
});

test('an entry file or asset outside arcade/cabinets/ is rejected (and game/* is forbidden)', () => {
  assert.ok(validateManifest({ ...sampleImportManifest, entry_file: 'game/evil.js' }).errors.includes('entry_file_outside_allowed_root'));
  assert.ok(validateManifest({ ...sampleImportManifest, entry_file: 'arcade/neon-circuit-floor.js' }).errors.includes('entry_file_outside_allowed_root'));
  assert.ok(validateManifest({ ...sampleImportManifest, scripts: ['game/x.js'] }).errors.some((e) => e.startsWith('unsupported_script:')));
});

// ── C. mount-plan logic (fail closed + lifecycle order) ───────────────────────────
test('planAdapterMount returns an ordered lifecycle for a valid adapter', () => {
  const p = planAdapterMount(pulseTapAdapter);
  assert.equal(p.ok, true);
  assert.deepEqual(p.lifecycleOrder, ['onMount', 'onFocus', 'onBlur', 'onUnmount']);
});

test('planAdapterMount fails closed (no lifecycle) for an invalid adapter', () => {
  const p = planAdapterMount({ ...pulseTapAdapter, authorityMode: 'bogus', nativeWidth: 999 });
  assert.equal(p.ok, false);
  assert.deepEqual(p.lifecycleOrder, []);
});

test('the sample import fixture adapter validates with its injected contract resolver', () => {
  // its contract is intentionally NOT in the production registry...
  assert.equal(getContract('sample_import_game'), null);
  // ...so it only validates with the fixture's own resolver (proving it would mount)
  assert.equal(validateAdapter(sampleImportAdapter).ok, false);
  assert.equal(validateAdapter(sampleImportAdapter, { getContract: sampleContractResolver }).ok, true);
  assert.equal(planAdapterMount(sampleImportAdapter, { getContract: sampleContractResolver }).ok, true);
  // the fixture keeps its original 320x480 size
  assert.equal(sampleImportContract.native_width, 320);
  assert.equal(sampleImportContract.native_height, 480);
});

// ── D. catalog / adapter integration ──────────────────────────────────────────────
test('an active server cabinet WITH a valid adapter is playable', () => {
  assert.equal(cabinetRenderState(getCabinet('pulse-tap-01')), 'playable');
  assert.equal(cabinetRenderState(getCabinet('signal-sprint-01')), 'playable');
});

test('a coming-soon server cabinet (even with an adapter) is not playable', () => {
  // circuit-match-01 is coming_soon in the catalog
  assert.equal(cabinetRenderState(getCabinet('circuit-match-01')), 'coming_soon');
  // even if we pretend an adapter exists, coming_soon stays not-playable
  assert.equal(cabinetRenderState(getCabinet('circuit-match-01'), () => true), 'coming_soon');
});

test('an active server cabinet with NO adapter shows unavailable', () => {
  const synthetic = { cabinet_id: 'mystery-01', cabinet_type: 'mystery', status: 'live', ticket_enabled: true };
  assert.equal(cabinetRenderState(synthetic), 'unavailable');       // no adapter registered for 'mystery'
  assert.equal(cabinetRenderState(synthetic, () => true), 'playable'); // ...would be playable if one existed
});

test('a client-only adapter not present in the server catalog is never playable', () => {
  // sample_import_game has a fixture adapter but is NOT in the server catalog
  assert.equal(getCabinet('sample-import-01'), null);
  assert.equal(cabinetRenderState(null), 'not_listed');
  // playableCabinets only ever returns cabinets that ARE in the catalog
  const catalogish = [getCabinet('pulse-tap-01'), getCabinet('signal-sprint-01'), getCabinet('circuit-match-01')];
  const playable = playableCabinets(catalogish).map((c) => c.cabinet_id);
  assert.deepEqual(playable.sort(), ['pulse-tap-01', 'signal-sprint-01'].sort());
  assert.ok(!playable.includes('sample-import-01'));
});

test('the registry resolves the registered production adapters', () => {
  assert.equal(getAdapter('pulse_tap').gameId, 'pulse_tap');
  assert.equal(getAdapter('signal_sprint').gameId, 'signal_sprint');
  assert.equal(getAdapter('sample_import_game'), null); // fixture never registered in production
  assert.equal(hasAdapter('pulse_tap'), true);
});
