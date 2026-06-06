/**
 * Creator Foundation CF-2 — approved-hash loader tests (the trust-boundary proofs).
 *   node --test tests/creator/*.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadApprovedPackage, LOADER_MODES, LIVE_WORLD_LOADER_ENABLED } from '../../arcade/creator/approval/approved-loader.mjs';
import { buildApprovalReceipt } from '../../arcade/creator/approval/approval-receipt.mjs';
import { createRegistry } from '../../arcade/creator/approval/approved-package-registry.mjs';
import { packageHash } from '../../arcade/creator/validator/package-hash.mjs';

const NOW = Date.parse('2026-06-06T00:00:00.000Z');
const block = () => structuredClone({
  schema_version: 1, package_kind: 'block_style', package_id: 'harbor-tide-glass',
  display_name: 'Tide Glass Facade', target_city_id: 'harbor-02',
  style: { palette: 'neon-cyan', facade_pattern: 'grid-window-tall', sign_variant: 'blade', lighting: 'high', accent: 'white-trim', tile_accent: 'circuit' },
  constraints: { no_external_assets: true, no_scripts: true },
});

/** Build a fully-approved (package, receipt, registry) triple for a given package. */
async function approved(pkg, status = 'operator_approved_local') {
  const hash = await packageHash(pkg);
  const receipt = await buildApprovalReceipt({ packageHash: hash, packageKind: pkg.package_kind, status, now: NOW });
  const registry = createRegistry([{
    package_hash: hash, package_kind: pkg.package_kind, display_name: 'Demo Neon Facade',
    approval_status: status, approved_at: new Date(NOW).toISOString(),
    validator_version: 'creator-validator-cf2', live_world_authorized: false,
  }]);
  return { hash, receipt, registry };
}

test('the live-world loader is disabled in CF-2', () => {
  assert.equal(LIVE_WORLD_LOADER_ENABLED, false);
});

test('operator_approved_local LOADS in local_preview', async () => {
  const pkg = block();
  const { receipt, registry, hash } = await approved(pkg);
  const r = await loadApprovedPackage({ package: pkg, receipt, registry, mode: LOADER_MODES.LOCAL_PREVIEW });
  assert.equal(r.ok, true);
  assert.equal(r.mode, 'local_preview');
  assert.equal(r.package_hash, hash);
  assert.equal(r.status, 'operator_approved_local');
});

test('operator_approved_local is REJECTED in live_world mode', async () => {
  const pkg = block();
  const { receipt, registry } = await approved(pkg);
  const r = await loadApprovedPackage({ package: pkg, receipt, registry, mode: LOADER_MODES.LIVE_WORLD });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'live_world_loader_not_enabled');
});

test('live_world mode ALWAYS blocks — no input opens it', async () => {
  const pkg = block();
  const { receipt, registry } = await approved(pkg);
  const variants = [
    { package: pkg, receipt, registry, mode: LOADER_MODES.LIVE_WORLD },
    { package: pkg, receipt: null, registry, mode: LOADER_MODES.LIVE_WORLD },
    { package: pkg, receipt, registry: null, mode: LOADER_MODES.LIVE_WORLD },
  ];
  for (const v of variants) {
    const r = await loadApprovedPackage(v);
    assert.equal(r.ok, false);
  }
});

test('a MODIFIED package (hash mismatch) is rejected', async () => {
  const pkg = block();
  const { receipt, registry } = await approved(pkg);
  const tampered = block();
  tampered.display_name = 'A Different Facade';     // still valid, but a different canonical hash
  const r = await loadApprovedPackage({ package: tampered, receipt, registry, mode: LOADER_MODES.LOCAL_PREVIEW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'receipt_hash_mismatch');
});

test('an UNAPPROVED package (empty registry) is rejected', async () => {
  const pkg = block();
  const { receipt } = await approved(pkg);
  const r = await loadApprovedPackage({ package: pkg, receipt, registry: createRegistry([]), mode: LOADER_MODES.LOCAL_PREVIEW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not_approved');
});

test('a local_validation_only receipt does not approve a local preview', async () => {
  const pkg = block();
  const { receipt, registry } = await approved(pkg, 'local_validation_only');
  const r = await loadApprovedPackage({ package: pkg, receipt, registry, mode: LOADER_MODES.LOCAL_PREVIEW });
  assert.equal(r.ok, false);                 // registry entry is local_validation_only → not approved
});

test('a MISSING receipt is rejected', async () => {
  const pkg = block();
  const { registry } = await approved(pkg);
  const r = await loadApprovedPackage({ package: pkg, receipt: null, registry, mode: LOADER_MODES.LOCAL_PREVIEW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'missing_receipt');
});

test('an unknown mode is rejected', async () => {
  const pkg = block();
  const { receipt, registry } = await approved(pkg);
  const r = await loadApprovedPackage({ package: pkg, receipt, registry, mode: 'production' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unknown_loader_mode');
});

test('an INVALID package is rejected (package_invalid)', async () => {
  const pkg = block();
  pkg.style.palette = 'rainbow';                     // not in the closed allowlist
  const hash = await packageHash(pkg);               // receipt binds to the invalid package's hash
  const receipt = await buildApprovalReceipt({ packageHash: hash, packageKind: 'block_style', status: 'operator_approved_local', now: NOW });
  const registry = createRegistry([{ package_hash: hash, package_kind: 'block_style', display_name: 'x',
    approval_status: 'operator_approved_local', approved_at: new Date(NOW).toISOString(), validator_version: 'creator-validator-cf2', live_world_authorized: false }]);
  const r = await loadApprovedPackage({ package: pkg, receipt, registry, mode: LOADER_MODES.LOCAL_PREVIEW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'package_invalid');
});

test('a malformed registry is rejected (invalid_registry)', async () => {
  const pkg = block();
  const { receipt } = await approved(pkg);
  const badRegistry = { schema_version: 1, registry_kind: 'creator_approved_packages', packages: [{ junk: true }] };
  const r = await loadApprovedPackage({ package: pkg, receipt, registry: badRegistry, mode: LOADER_MODES.LOCAL_PREVIEW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_registry');
});

test('a tampered receipt is rejected (invalid_receipt)', async () => {
  const pkg = block();
  const { receipt, registry } = await approved(pkg);
  receipt.operator_note = 'edited after sealing';    // receipt_hash no longer matches body
  const r = await loadApprovedPackage({ package: pkg, receipt, registry, mode: LOADER_MODES.LOCAL_PREVIEW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_receipt');
});
