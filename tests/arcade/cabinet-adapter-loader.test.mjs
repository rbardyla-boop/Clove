/**
 * Phase 1k — A. adapter registry + B. import loader (pure / Node-testable).
 *
 * The dynamic loader path and the controlled registry are unit tested here so the
 * arcade's import rail ("enter through a validated adapter or fail closed") is
 * enforced by tests. Lifecycle routing + diagnostics (groups C/D) and the live
 * fixture mount (group E) are covered in tests/arcade/frame-contract.spec.mjs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerBuiltInAdapter, registerImportedAdapter, getAdapter, hasAdapter,
  resolveAdapterForCabinet, isEnabled, getFactory, validateAdapterRegistration, unregisterImported,
} from '../../arcade/cabinet-adapter-registry.mjs';
// importing the built-in adapters registers them through the registry
import { pulseTapAdapter } from '../../arcade/adapters/pulse-tap-adapter.mjs';
import { signalSprintAdapter } from '../../arcade/adapters/signal-sprint-adapter.mjs';
import { validateImportPath, loadImportedAdapter } from '../../arcade/cabinet-import-loader.mjs';
import { sampleImportManifest, sampleImportContract } from '../../arcade/cabinets/sample-import-game/manifest.mjs';
import { sampleImportAdapter } from '../../arcade/cabinets/sample-import-game/adapter.mjs';

const sampleResolver = (id) => (id === 'sample_import_game' ? sampleImportContract : undefined);

// ── A. registry ────────────────────────────────────────────────────────────────
test('built-in adapters are registered (via import) and resolve', () => {
  assert.equal(getAdapter('pulse_tap'), pulseTapAdapter);
  assert.equal(getAdapter('signal_sprint'), signalSprintAdapter);
  assert.equal(hasAdapter('pulse_tap'), true);
});

test('re-registering the SAME built-in object is idempotent; a different object for the same type is rejected', () => {
  assert.equal(registerBuiltInAdapter(pulseTapAdapter).ok, true);            // idempotent
  const clash = registerBuiltInAdapter({ ...pulseTapAdapter });             // different object, same cabinetType
  assert.equal(clash.ok, false);
  assert.equal(clash.reason, 'duplicate_builtin');                          // production cannot be replaced
});

test('an invalid built-in adapter (unknown frame contract) is rejected', () => {
  const r = registerBuiltInAdapter({ ...pulseTapAdapter, cabinetType: 'ghostX', gameId: 'ghostX', frameContractId: 'nope' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_adapter');
});

test('an imported adapter registers only with a valid contract resolver, as test-only/disabled', () => {
  unregisterImported('sample_import_game');
  // without the resolver the imported contract is unknown → rejected
  assert.equal(registerImportedAdapter(sampleImportManifest, sampleImportAdapter, { contract: null }).ok, false);
  const r = registerImportedAdapter(sampleImportManifest, sampleImportAdapter, { contract: sampleImportContract, enabled: false });
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'imported');
  assert.equal(r.enabled, false);
  assert.equal(isEnabled('sample_import_game'), false); // disabled by default — not playable by registration alone
});

test('an imported adapter can never shadow a built-in cabinet type', () => {
  const shadow = { ...sampleImportAdapter, cabinetType: 'pulse_tap' };
  const r = registerImportedAdapter(sampleImportManifest, shadow, { contract: sampleImportContract, deps: { getContract: sampleResolver } });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'cannot_shadow_builtin');
});

test('a duplicate ENABLED imported adapter is rejected (replacing a disabled fixture is allowed)', () => {
  unregisterImported('dup_import');
  const a = { ...sampleImportAdapter, gameId: 'dup_import', cabinetType: 'dup_import' };
  assert.equal(registerImportedAdapter(sampleImportManifest, a, { contract: { ...sampleImportContract, game_id: 'dup_import' }, deps: { getContract: () => ({ ...sampleImportContract, game_id: 'dup_import' }) }, enabled: false }).ok, true);
  // replacing a disabled fixture is allowed
  assert.equal(registerImportedAdapter(sampleImportManifest, a, { contract: { ...sampleImportContract, game_id: 'dup_import' }, deps: { getContract: () => ({ ...sampleImportContract, game_id: 'dup_import' }) }, enabled: true }).ok, true);
  // now enabled → a second enabled registration is rejected
  const r = registerImportedAdapter(sampleImportManifest, a, { contract: { ...sampleImportContract, game_id: 'dup_import' }, deps: { getContract: () => ({ ...sampleImportContract, game_id: 'dup_import' }) }, enabled: true });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'duplicate_imported_enabled');
  unregisterImported('dup_import');
});

test('a disabled imported adapter is NOT playable through registration alone', () => {
  unregisterImported('sample_import_game');
  registerImportedAdapter(sampleImportManifest, sampleImportAdapter, { contract: sampleImportContract, enabled: false });
  // even if a (synthetic) catalog cabinet references it, disabled → not resolved
  assert.equal(resolveAdapterForCabinet({ cabinet_type: 'sample_import_game', status: 'live', ticket_enabled: true }), null);
});

test('validateAdapterRegistration delegates to the SDK validator', () => {
  assert.equal(validateAdapterRegistration(pulseTapAdapter).ok, true);
  assert.equal(validateAdapterRegistration({ ...pulseTapAdapter, authorityMode: 'bogus' }).ok, false);
});

// ── B. import loader ────────────────────────────────────────────────────────────
test('validateImportPath accepts arcade-local code and rejects everything else', () => {
  assert.equal(validateImportPath('arcade/cabinets/sample-import-game/adapter.mjs').ok, true);
  assert.equal(validateImportPath('arcade/cabinets/x/y.js').ok, true);
  assert.equal(validateImportPath('https://evil.example/x.js').reason, 'absolute_url');
  assert.equal(validateImportPath('http://evil/x.js').reason, 'absolute_url');
  assert.equal(validateImportPath('data:text/javascript,evil').reason, 'data_or_blob_scheme');
  assert.equal(validateImportPath('blob:abc').reason, 'data_or_blob_scheme');
  assert.equal(validateImportPath('/etc/passwd.js').reason, 'absolute_path');
  assert.equal(validateImportPath('arcade/cabinets/../../etc/x.js').reason, 'path_traversal');
  assert.equal(validateImportPath('game/secret/x.js').reason, 'game_path_forbidden');
  assert.equal(validateImportPath('arcade/cabinets/x/../../game/x.js').reason, 'path_traversal');
  assert.equal(validateImportPath('arcade/neon-circuit-floor.js').reason, 'outside_allowed_root');
  assert.equal(validateImportPath('arcade/cabinets/x/y.ts').reason, 'bad_extension');
});

test('loadImportedAdapter loads the valid local fixture (test-only/disabled)', async () => {
  unregisterImported('sample_import_game');
  const r = await loadImportedAdapter(sampleImportManifest);
  assert.equal(r.ok, true, r.reason || '');
  assert.equal(r.adapter.gameId, 'sample_import_game');
  assert.equal(typeof r.createGame, 'function');
  assert.equal(r.contract.native_width, 320);
  assert.equal(isEnabled('sample_import_game'), false); // remains test-only unless catalog enables it
});

test('loadImportedAdapter rejects an invalid manifest BEFORE importing', async () => {
  const bad = { ...sampleImportManifest, current_width: 720, aspect_ratio: 720 / 480 }; // size change, no migration flag
  const r = await loadImportedAdapter(bad);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_manifest');
});

test('loadImportedAdapter rejects a forbidden capability before importing', async () => {
  const bad = { ...sampleImportManifest, requested_capabilities: ['external_payments'] };
  const r = await loadImportedAdapter(bad);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_manifest');
});

test('loadImportedAdapter rejects a path-traversal / game/* adapter module before importing', async () => {
  const trav = { ...sampleImportManifest, adapter_module: 'arcade/cabinets/x/../../game/evil.mjs' };
  assert.equal((await loadImportedAdapter(trav)).reason.startsWith('invalid'), true);
});

test('loadImportedAdapter returns a structured import_failed for a missing module', async () => {
  const ghost = { ...sampleImportManifest, adapter_module: 'arcade/cabinets/ghost-game/adapter.mjs', scripts: ['arcade/cabinets/ghost-game/x.mjs'] };
  const r = await loadImportedAdapter(ghost);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'import_failed');
  assert.ok(r.details && typeof r.details.error === 'string');
});

test('loadImportedAdapter returns invalid_adapter when the imported module exports a bad adapter', async () => {
  const importer = async () => ({ adapter: { gameId: 'x', cabinetType: 'x', frameContractId: 'x' }, contract: null });
  const r = await loadImportedAdapter(sampleImportManifest, { importer });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_adapter');
});

test('loadImportedAdapter returns no_adapter_export when the module has no adapter', async () => {
  const importer = async () => ({ default: {} });
  const r = await loadImportedAdapter(sampleImportManifest, { importer });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no_adapter_export');
});
