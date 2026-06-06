/**
 * Creator Foundation CF-2 — approval receipt tests.
 *   node --test tests/creator/*.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApprovalReceipt, validateReceipt, receiptBindsTo, receiptHash,
  RECEIPT_KIND, APPROVAL_STATUSES,
} from '../../arcade/creator/approval/approval-receipt.mjs';
import { packageHash } from '../../arcade/creator/validator/package-hash.mjs';

const HASH = 'sha256:' + 'a'.repeat(64);
const NOW = Date.parse('2026-06-06T00:00:00.000Z');
const make = (over = {}) => buildApprovalReceipt({
  packageHash: HASH, packageKind: 'block_style', status: 'operator_approved_local',
  operatorNote: 'reviewed locally', now: NOW, ...over,
});

test('buildApprovalReceipt produces a valid, hash-sealed receipt', async () => {
  const r = await make();
  assert.equal(r.receipt_kind, RECEIPT_KIND);
  assert.equal(r.package_hash, HASH);
  assert.equal(r.live_world_authorized, false);
  assert.match(r.receipt_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal((await validateReceipt(r)).ok, true);
});

test('receipt is deterministic for the same inputs (incl. receipt_hash)', async () => {
  assert.equal((await make()).receipt_hash, (await make()).receipt_hash);
});

test('NO status implies live-world authorization', async () => {
  for (const status of APPROVAL_STATUSES) {
    const r = await make({ status });
    assert.equal(r.live_world_authorized, false, status);
  }
});

test('receiptBindsTo matches only the bound package hash', async () => {
  const r = await make();
  assert.equal(await receiptBindsTo(r, HASH), true);
  assert.equal(await receiptBindsTo(r, 'sha256:' + 'b'.repeat(64)), false);
});

test('validateReceipt rejects a tampered receipt_hash', async () => {
  const r = await make();
  r.receipt_hash = 'sha256:' + '0'.repeat(64);
  const v = await validateReceipt(r);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /receipt_hash does not match/.test(e)));
});

test('validateReceipt rejects an edited body (note) that no longer matches the hash', async () => {
  const r = await make();
  r.operator_note = 'silently edited after sealing';   // body changed, hash not recomputed
  assert.equal((await validateReceipt(r)).ok, false);
});

test('validateReceipt rejects live_world_authorized:true', async () => {
  const r = await make();
  r.live_world_authorized = true;
  r.receipt_hash = await receiptHash(r);                // even a correctly re-sealed "true" must fail
  const v = await validateReceipt(r);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((e) => /live_world_authorized must be false/.test(e)));
});

test('validateReceipt rejects an unknown key', async () => {
  const r = await make();
  r.live_world_loader = 'enabled';
  assert.equal((await validateReceipt(r)).ok, false);
});

test('validateReceipt rejects an out-of-allowlist status', async () => {
  // buildApprovalReceipt will seal whatever status it's given; validation is the gate.
  const r = await make({ status: 'production_approved' });
  assert.equal((await validateReceipt(r)).ok, false);
});

test('validateReceipt rejects a malformed package_hash (even if re-sealed)', async () => {
  const bad = await make();
  bad.package_hash = 'not-a-hash';
  bad.receipt_hash = await receiptHash(bad);
  assert.equal((await validateReceipt(bad)).ok, false);
});

test('a freshly built receipt binds to a real package hash', async () => {
  const pkg = { schema_version: 1, package_kind: 'block_style', package_id: 'demo-block', target_city_id: 'harbor-02',
    style: { palette: 'neon-cyan', facade_pattern: 'grid-window-tall', sign_variant: 'blade', lighting: 'high', accent: 'white-trim', tile_accent: 'circuit' },
    constraints: { no_external_assets: true, no_scripts: true } };
  const h = await packageHash(pkg);
  const r = await buildApprovalReceipt({ packageHash: h, packageKind: 'block_style', status: 'operator_approved_local', now: NOW });
  assert.equal(await receiptBindsTo(r, h), true);
});
