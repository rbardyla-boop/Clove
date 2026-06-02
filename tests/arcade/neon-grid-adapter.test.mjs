/**
 * Phase 1l — A. Neon Grid manifest + adapter, B. frame contract, C. catalog/registry.
 *
 * Neon Grid is the first PRODUCTION cabinet that enters through the adapter/import
 * path, so the import rail ("server catalog activation → registry resolution →
 * frame contract preservation, or fail closed") is unit tested here. The live
 * mount + lifecycle routing are covered by tests/arcade/frame-contract.spec.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest, MANIFEST_VERSION, FORBIDDEN_CAPABILITIES } from '../../arcade/game-import-manifest.mjs';
import { validateAdapter, cabinetRenderState } from '../../arcade/cabinet-adapter-sdk.mjs';
import { getContract, validateContract, cloneGuard } from '../../arcade/cabinet-frame-contract.mjs';
import {
  loadImportedAdapter, validateImportPath,
} from '../../arcade/cabinet-import-loader.mjs';
import {
  resolveAdapterForCabinet, isEnabled, enableImportedAdapter, unregisterImported,
} from '../../arcade/cabinet-adapter-registry.mjs';
import { neonGridManifest } from '../../arcade/cabinets/neon-grid/manifest.mjs';
import { neonGridAdapter } from '../../arcade/cabinets/neon-grid/adapter.mjs';
import { getCabinet, isPlayableCabinet, CABINETS } from '../../workers/arcade/src/catalog.mjs';

const gridCabinet = getCabinet('neon-grid-01');

// ── A. manifest + adapter ────────────────────────────────────────────────────
test('the Neon Grid manifest is valid + production-shaped (server authority/tickets/challenges)', () => {
  assert.equal(neonGridManifest.manifest_version, MANIFEST_VERSION);
  assert.deepEqual(validateManifest(neonGridManifest), { ok: true, errors: [] });
  assert.equal(neonGridManifest.authority_mode, 'server_round_authoritative');
  assert.equal(neonGridManifest.ticket_mode, 'server_awarded');
  assert.equal(neonGridManifest.challenge_mode, 'server_observed');
  assert.equal(neonGridManifest.original_width, 360);
  assert.equal(neonGridManifest.original_height, 640);
  // it bars every forbidden capability and requests NONE of them
  assert.deepEqual([...neonGridManifest.forbidden_capabilities].sort(), [...FORBIDDEN_CAPABILITIES].sort());
  assert.deepEqual(neonGridManifest.requested_capabilities, []);
});

test('the Neon Grid adapter validates against its (built-in) frame contract at 360x640', () => {
  assert.deepEqual(validateAdapter(neonGridAdapter), { ok: true, errors: [] });
  assert.equal(neonGridAdapter.cabinetType, 'neon_grid');
  assert.equal(neonGridAdapter.nativeWidth, 360);
  assert.equal(neonGridAdapter.nativeHeight, 640);
  assert.equal(neonGridAdapter.rulesetVersion, 'neon-grid-v1');
  assert.equal(neonGridAdapter.clonePolicy, 'preserve_original_size');
});

test('a forbidden capability or a size change without migration makes the manifest invalid', () => {
  for (const cap of ['external_payments', 'real_money', 'transfer', 'crypto_wallet', 'global_auth']) {
    assert.equal(validateManifest({ ...neonGridManifest, requested_capabilities: [cap] }).ok, false, cap);
  }
  const resized = { ...neonGridManifest, current_width: 720, current_height: 1280, aspect_ratio: 720 / 1280 };
  assert.ok(validateManifest(resized).errors.includes('size_changed_without_migration'));
});

test('the manifest only references arcade-local code paths (never game/*)', () => {
  for (const p of [neonGridManifest.entry_file, neonGridManifest.adapter_module, ...neonGridManifest.scripts]) {
    assert.equal(validateImportPath(p).ok, true, p);
  }
  assert.equal(validateImportPath('game/secret/x.mjs').ok, false);
});

// ── B. frame contract ────────────────────────────────────────────────────────
test('the neon_grid frame contract exists at 360x640 and passes the clone guard', () => {
  const c = getContract('neon_grid');
  assert.ok(c);
  assert.equal(c.native_width, 360);
  assert.equal(c.native_height, 640);
  assert.equal(c.scale_mode, 'fit-contain');
  assert.equal(c.clone_policy, 'preserve_original_size');
  assert.equal(validateContract(c).ok, true);
  assert.equal(cloneGuard(c).ok, true);
});

test('a Neon Grid clone that resizes without a migration flag fails the guard', () => {
  const drift = { ...getContract('neon_grid'), current_width: 720, current_height: 1280 };
  assert.equal(cloneGuard(drift).ok, false);
  assert.equal(cloneGuard(drift).reason, 'size_changed_without_migration');
});

// ── C. catalog + registry (server is the authority) ──────────────────────────
test('Neon Grid is an active, ticketed cabinet in the server catalog', () => {
  assert.ok(gridCabinet);
  assert.equal(gridCabinet.cabinet_id, 'neon-grid-01');
  assert.equal(gridCabinet.machine_id, 'grid');
  assert.equal(gridCabinet.cabinet_type, 'neon_grid');
  assert.equal(gridCabinet.ruleset_version, 'neon-grid-v1');
  assert.equal(gridCabinet.status, 'live');
  assert.equal(gridCabinet.ticket_enabled, true);
  assert.equal(isPlayableCabinet('neon-grid-01'), true);
  assert.ok(CABINETS.some((c) => c.cabinet_id === 'neon-grid-01'));
});

test('an imported adapter cannot make Neon Grid playable on its own — the catalog must enable it', async () => {
  unregisterImported('neon_grid');
  const load = await loadImportedAdapter(neonGridManifest);
  assert.equal(load.ok, true, load.reason || '');
  assert.equal(load.adapter.cabinetType, 'neon_grid');
  assert.equal(typeof load.createGame, 'function');
  // registered DISABLED — the catalog cabinet does NOT resolve to it yet
  assert.equal(isEnabled('neon_grid'), false);
  assert.equal(resolveAdapterForCabinet(gridCabinet), null);

  // the catalog activates it → enable → it now resolves
  assert.equal(enableImportedAdapter('neon_grid').ok, true);
  assert.equal(isEnabled('neon_grid'), true);
  assert.equal(resolveAdapterForCabinet(gridCabinet).gameId, 'neon_grid');
  unregisterImported('neon_grid');
});

test('an invalid manifest fails closed (cabinet stays unresolvable)', async () => {
  unregisterImported('neon_grid');
  const bad = { ...neonGridManifest, requested_capabilities: ['external_payments'] };
  const load = await loadImportedAdapter(bad);
  assert.equal(load.ok, false);
  assert.equal(load.reason, 'invalid_manifest');
  assert.equal(resolveAdapterForCabinet(gridCabinet), null);
});

test('render-state: active catalog + resolvable adapter → playable; coming_soon → not; active + no adapter → unavailable', async () => {
  unregisterImported('neon_grid');
  // active + no adapter resolved yet → unavailable
  const hasResolved = (cab) => !!resolveAdapterForCabinet(cab);
  assert.equal(cabinetRenderState(gridCabinet, (ct) => hasResolved({ cabinet_type: ct, status: 'live', ticket_enabled: true })), 'unavailable');
  // activate it → playable
  await loadImportedAdapter(neonGridManifest);
  enableImportedAdapter('neon_grid');
  assert.equal(cabinetRenderState(gridCabinet, (ct) => hasResolved({ cabinet_type: ct, status: 'live', ticket_enabled: true })), 'playable');
  // a coming_soon cabinet is never playable, even with an adapter
  assert.equal(cabinetRenderState({ ...gridCabinet, status: 'coming_soon', ticket_enabled: false }, () => true), 'coming_soon');
  unregisterImported('neon_grid');
});
