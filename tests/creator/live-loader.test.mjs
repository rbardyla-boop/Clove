/**
 * Creator Foundation CF-7 — operator-approved LIVE LOADER, adversarial unit tests.
 *
 * Proves the dangerous gate is a CLOSED, TESTABLE MACHINE that rejects by default. The shipped constant
 * `LIVE_WORLD_LOADER_ENABLED` is false, so a fully-valid, fully-approved chain STILL cannot load. The
 * inner gates (tamper / digest / epoch / binding / kind / kill-switch) are exercised by passing a
 * TEST-ONLY `enabled: true` parameter — which never mutates the shipped constant — and asserting each
 * malformed input is rejected with its specific reason. Covers every CF-7/CF-8 threat-model finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { packageHash } from '../../arcade/creator/validator/package-hash.mjs';
import { buildApprovalReceipt, APPROVED_LOCAL } from '../../arcade/creator/approval/approval-receipt.mjs';
import { buildHiveReceipt } from '../../arcade/creator/hive-validation/hive-service.mjs';
import { createReviewRecord, decideReview, revokeReview, REQUIRED_REVIEW_CRITERIA } from '../../arcade/creator/moderation/review-queue.mjs';
import { buildLiveApprovalReceipt } from '../../arcade/creator/approval/live-approval-receipt.mjs';
import { buildLiveRegistry } from '../../arcade/creator/approval/live-registry.mjs';
import { loadLivePackage, LIVE_WORLD_LOADER_ENABLED } from '../../arcade/creator/approval/live-loader.mjs';

const NOW = 1_700_000_000_000;
const PKG = JSON.parse(readFileSync(new URL('../../arcade/creator/samples/sample-block.package.json', import.meta.url)));
const clone = (v) => JSON.parse(JSON.stringify(v));
const FUTURE = new Date(NOW + 86_400_000).toISOString();
const PAST = new Date(NOW - 86_400_000).toISOString();

const APPROVE = {
  to_state: 'approved_for_live_candidate', reviewer_ref: 'reviewer:op1',
  free_text_reviewed: true, free_text_cleared: true, review_criteria: [...REQUIRED_REVIEW_CRITERIA], note: 'clean',
};
const FREE_TEXT = { display_name: 'Tide Glass Facade', package_id: 'harbor-tide-glass', operator_note: 'reviewed locally' };

// ── Build one fully-valid live-approval chain (every artifact real + hash-bound) ──
const HASH = await packageHash(PKG);
const LOCAL_RECEIPT = await buildApprovalReceipt({ packageHash: HASH, packageKind: 'block_style', status: APPROVED_LOCAL, now: NOW });
const HIVE_RECEIPT = await buildHiveReceipt(PKG, NOW);
const reviewRecordFor = async (freeText, id) => decideReview(
  (await createReviewRecord({ package_hash: HASH, package_kind: 'block_style', receipt_hash: LOCAL_RECEIPT.receipt_hash, validator_report_hash: HIVE_RECEIPT.receipt_hash, free_text: freeText }, { now: NOW, id })).record,
  APPROVE, { now: NOW },
).record;
const REVIEW_RECORD = await reviewRecordFor(FREE_TEXT, 'fixed');
const LIVE_RECEIPT = (await buildLiveApprovalReceipt({
  reviewRecord: REVIEW_RECORD, localReceiptHash: LOCAL_RECEIPT.receipt_hash,
  hiveVerdictReceiptHash: HIVE_RECEIPT.receipt_hash, stagingVerified: true, now: NOW,
})).receipt;
const LIVE_ENTRY = {
  package_hash: HASH, package_kind: 'block_style', live_approval_id: LIVE_RECEIPT.live_approval_id,
  approval_status: 'operator_approved_live', live_world_authorized: true, approved_live_at: new Date(NOW).toISOString(),
  expires_at: null, revoked: false, revoked_at: null, revoke_reason: null,
};
const LIVE_REGISTRY = await buildLiveRegistry([LIVE_ENTRY], 1);

/** A fresh, fully-valid input set (package cloned so tamper tests are isolated). enabled:true DRIVES the
 *  closed machine — it does NOT flip the shipped LIVE_WORLD_LOADER_ENABLED constant. */
const valid = (over = {}) => ({
  package: clone(PKG), liveReceipt: LIVE_RECEIPT, liveRegistry: LIVE_REGISTRY,
  localReceipt: LOCAL_RECEIPT, hiveReceipt: HIVE_RECEIPT, reviewRecord: REVIEW_RECORD,
  killSwitch: false, highestSeenEpoch: 1, now: NOW, enabled: true, ...over,
});

// ════════════════════════════ SHIPPED DISABLED ════════════════════════════

test('SHIPPED DISABLED: a fully-valid, fully-approved chain STILL cannot load (flag is false)', async () => {
  assert.equal(LIVE_WORLD_LOADER_ENABLED, false); // the shipped constant
  // default `enabled` (omitted) = the false constant: a perfect approval is rejected at the flag.
  const r = await loadLivePackage(valid({ enabled: undefined, killSwitch: false }));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'live_world_loader_not_enabled');
  assert.equal(r.package, undefined); // nothing entered the live world
});

test('the closed machine ACCEPTS a fully-valid chain only when explicitly driven (proves rejections are real)', async () => {
  const r = await loadLivePackage(valid());
  assert.equal(r.ok, true, r.reason + ' ' + (r.errors || []).join('; '));
  assert.equal(r.package_hash, HASH);
  assert.equal(r.live_world_authorized, true); // requires the test-only enabled:true; shipped constant stays false
});

// ════════════════════════════ FAIL-CLOSED KILL-SWITCH (F5) ════════════════════════════

test('kill-switch is fail-closed: only the exact off-sentinel (false) proceeds', async () => {
  assert.equal((await loadLivePackage(valid({ killSwitch: true }))).reason, 'kill_switch_engaged');
  assert.equal((await loadLivePackage(valid({ killSwitch: undefined }))).reason, 'kill_switch_engaged');
  assert.equal((await loadLivePackage(valid({ killSwitch: 'false' }))).reason, 'kill_switch_engaged'); // string ≠ boolean
  assert.equal((await loadLivePackage(valid({ killSwitch: 0 }))).reason, 'kill_switch_engaged');
  assert.equal((await loadLivePackage(valid({ killSwitch: false }))).ok, true); // the off-sentinel
});

// ════════════════════════════ ACCEPTANCE CRITERIA ════════════════════════════

test('a tampered package body fails (recomputed hash ≠ receipt)', async () => {
  const pkg = clone(PKG); pkg.display_name = 'Tampered Name';
  const r = await loadLivePackage(valid({ package: pkg }));
  assert.equal(r.reason, 'package_hash_mismatch');
});

test('a mismatched free_text_digest fails (F3 — screened strings bound)', async () => {
  // a DIFFERENT live candidate for the SAME package hash → different free_text_digest than the receipt binds
  const other = await reviewRecordFor({ ...FREE_TEXT, display_name: 'Different Name' }, 'fixed');
  const r = await loadLivePackage(valid({ reviewRecord: other }));
  assert.equal(r.reason, 'free_text_digest_mismatch');
});

test('a review_id that does not match the receipt human_review block fails', async () => {
  // same screened strings (same digest) but a different review_id
  const other = await reviewRecordFor(FREE_TEXT, 'other');
  const r = await loadLivePackage(valid({ reviewRecord: other }));
  assert.equal(r.reason, 'review_id_mismatch');
});

test('a revoked approval fails — both via the CF-8 record and the live registry', async () => {
  const revokedRecord = revokeReview(REVIEW_RECORD, { reviewer_ref: 'reviewer:op1', reason: 'reported', now: NOW + 10 }).record;
  assert.equal((await loadLivePackage(valid({ reviewRecord: revokedRecord }))).reason, 'not_a_live_candidate');
  const revokedReg = await buildLiveRegistry([{ ...LIVE_ENTRY, revoked: true, revoked_at: new Date(NOW + 10).toISOString(), revoke_reason: 'reported' }], 2);
  assert.equal((await loadLivePackage(valid({ liveRegistry: revokedReg, highestSeenEpoch: 2 }))).reason, 'not_live_approved');
});

test('an expired approval fails (TTL)', async () => {
  const expiredReg = await buildLiveRegistry([{ ...LIVE_ENTRY, expires_at: PAST }], 1);
  const r = await loadLivePackage(valid({ liveRegistry: expiredReg }));
  assert.equal(r.reason, 'not_live_approved');
});

test('a wrong receipt kind fails fast (F7 — type confusion)', async () => {
  assert.equal((await loadLivePackage(valid({ liveReceipt: LOCAL_RECEIPT }))).reason, 'wrong_receipt_kind'); // CF-2 receipt
  assert.equal((await loadLivePackage(valid({ liveReceipt: HIVE_RECEIPT }))).reason, 'wrong_receipt_kind');  // CF-6 verdict
});

test('a registry rollback below the monotonic epoch fails (F4)', async () => {
  // the registry is at epoch 1; the loader has seen epoch 2 → an older snapshot is rejected.
  const r = await loadLivePackage(valid({ highestSeenEpoch: 2 }));
  assert.equal(r.reason, 'registry_epoch_rollback');
});

test('missing binding resolution fails (F1) — local receipt, hive verdict, or review record', async () => {
  assert.equal((await loadLivePackage(valid({ localReceipt: undefined }))).reason, 'missing_local_receipt');
  assert.equal((await loadLivePackage(valid({ hiveReceipt: undefined }))).reason, 'hive_receipt_wrong_kind');
  assert.equal((await loadLivePackage(valid({ reviewRecord: undefined }))).reason, 'not_a_live_candidate');
  // a local receipt for a DIFFERENT package does not bind
  const otherLocal = await buildApprovalReceipt({ packageHash: 'sha256:' + 'e'.repeat(64), packageKind: 'block_style', status: APPROVED_LOCAL, now: NOW });
  assert.equal((await loadLivePackage(valid({ localReceipt: otherLocal }))).reason, 'local_receipt_package_mismatch');
});

test('a package with ONLY a CF-6 verdict (no human review) fails', async () => {
  const pending = (await createReviewRecord({ package_hash: HASH, package_kind: 'block_style', receipt_hash: LOCAL_RECEIPT.receipt_hash, validator_report_hash: HIVE_RECEIPT.receipt_hash, free_text: FREE_TEXT }, { now: NOW, id: 'fixed' })).record;
  const r = await loadLivePackage(valid({ reviewRecord: pending })); // hive verdict valid, but pending review
  assert.equal(r.reason, 'not_a_live_candidate');
});

test('an unreviewed (needs_changes) package fails', async () => {
  const base = (await createReviewRecord({ package_hash: HASH, package_kind: 'block_style', receipt_hash: LOCAL_RECEIPT.receipt_hash, validator_report_hash: HIVE_RECEIPT.receipt_hash, free_text: FREE_TEXT }, { now: NOW, id: 'fixed' })).record;
  const needs = decideReview(base, { to_state: 'needs_changes', reviewer_ref: 'reviewer:op1', note: 'fix copy' }, { now: NOW }).record;
  assert.equal((await loadLivePackage(valid({ reviewRecord: needs }))).reason, 'not_a_live_candidate');
});

test('a reviewed-but-not-live-registered package fails', async () => {
  const emptyReg = await buildLiveRegistry([], 1);
  assert.equal((await loadLivePackage(valid({ liveRegistry: emptyReg }))).reason, 'not_live_approved');
});

test('a live entry referencing a different live_approval_id fails', async () => {
  const wrongIdReg = await buildLiveRegistry([{ ...LIVE_ENTRY, live_approval_id: 'la_someoneelse' }], 1);
  assert.equal((await loadLivePackage(valid({ liveRegistry: wrongIdReg }))).reason, 'live_approval_id_mismatch');
});

test('a tampered live registry (registry_hash no longer matches) fails (F6)', async () => {
  const tampered = clone(LIVE_REGISTRY); tampered.packages[0].approved_live_at = '2099-01-01T00:00:00.000Z';
  assert.equal((await loadLivePackage(valid({ liveRegistry: tampered }))).reason, 'invalid_live_registry');
});

test('a non-JSON-clean package (undefined field) fails (F2 — canonical-elision guard)', async () => {
  const pkg = clone(PKG); pkg.style.extra = undefined; // JSON.stringify would silently drop this
  const r = await loadLivePackage(valid({ package: pkg }));
  assert.equal(r.reason, 'package_not_json_clean');
});

test('the loader mutates no input and returns a defensive package copy', async () => {
  const before = clone({ LIVE_RECEIPT, LIVE_REGISTRY, REVIEW_RECORD, HIVE_RECEIPT, LOCAL_RECEIPT });
  const r = await loadLivePackage(valid());
  assert.equal(r.ok, true);
  r.package.display_name = 'mutated by consumer';
  assert.notEqual(PKG.display_name, 'mutated by consumer'); // shared baseline untouched
  assert.deepEqual({ LIVE_RECEIPT, LIVE_REGISTRY, REVIEW_RECORD, HIVE_RECEIPT, LOCAL_RECEIPT }, before);
});
