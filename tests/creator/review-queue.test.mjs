/**
 * Creator Foundation CF-8 — human-review queue unit tests.
 * Proves: unreviewed/revoked packages are never live candidates; a CF-6 verdict alone is not approval;
 * the free-text review gate is mandatory; CF-8 grants ZERO live authority; the audit trail is append-only
 * + hash-chained (tamper-evident); deny-by-default transitions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createReviewQueue, createReviewRecord, decideReview, revokeReview, isLiveCandidate,
  appendAudit, verifyAudit, reviewReport, REVIEW_STATES, REQUIRED_REVIEW_CRITERIA,
} from '../../arcade/creator/moderation/review-queue.mjs';

const SUB = Object.freeze({
  package_hash: 'sha256:' + 'a'.repeat(64),
  package_kind: 'block_style',
  receipt_hash: 'sha256:' + 'b'.repeat(64),
  validator_report_hash: 'sha256:' + 'c'.repeat(64),
  free_text: { display_name: 'Neon Facade', package_id: 'neon-facade-01', operator_note: 'reviewed locally' },
});
const NOW = 1_700_000_000_000;
const APPROVE = Object.freeze({
  to_state: 'approved_for_live_candidate', reviewer_ref: 'reviewer:op1',
  free_text_reviewed: true, free_text_cleared: true, review_criteria: [...REQUIRED_REVIEW_CRITERIA], note: 'clean',
});
const BASE = (await createReviewRecord(SUB, { now: NOW, id: 'fixed' })).record; // createReviewRecord is async (digest)
const rec = () => JSON.parse(JSON.stringify(BASE)); // a fresh, mutable deep copy per test

test('a fresh record is pending and NOT a live candidate; CF-8 grants no live authority', () => {
  const r = rec();
  assert.equal(r.state, 'pending');
  assert.equal(isLiveCandidate(r), false);
  assert.equal(r.live_world_authorized, false);
  // it carries the bound hashes (package + CF-2 receipt + validator report)
  assert.equal(r.package_hash, SUB.package_hash);
  assert.equal(r.receipt_hash, SUB.receipt_hash);
  assert.equal(r.validator_report_hash, SUB.validator_report_hash);
});

test('a CF-6 validation verdict alone is NOT approval (a recorded validator_report_hash, still pending)', () => {
  const r = rec(); // has validator_report_hash, but no human decision
  assert.equal(isLiveCandidate(r), false);
});

test('approval requires the human free-text review gate', () => {
  // missing free_text_reviewed
  assert.equal(decideReview(rec(), { ...APPROVE, free_text_reviewed: false }).ok, false);
  // missing free_text_cleared
  assert.equal(decideReview(rec(), { ...APPROVE, free_text_cleared: false }).ok, false);
  // missing a required criterion
  assert.equal(decideReview(rec(), { ...APPROVE, review_criteria: ['profanity'] }).ok, false);
  // missing reviewer
  assert.equal(decideReview(rec(), { ...APPROVE, reviewer_ref: '' }).ok, false);
});

test('a fully human-reviewed package becomes a live CANDIDATE (still not live-authorized)', () => {
  const d = decideReview(rec(), APPROVE, { now: NOW });
  assert.equal(d.ok, true, d.errors && d.errors.join('; '));
  assert.equal(d.record.state, 'approved_for_live_candidate');
  assert.equal(d.record.free_text_reviewed, true);
  assert.equal(d.record.free_text_cleared, true);
  assert.equal(isLiveCandidate(d.record), true);
  assert.equal(d.record.live_world_authorized, false); // ALWAYS — CF-8 is not the loader
});

test('a revoked candidate is NOT a live candidate; revocation is recorded', () => {
  const cand = decideReview(rec(), APPROVE, { now: NOW }).record;
  const rv = revokeReview(cand, { reviewer_ref: 'reviewer:op1', reason: 'reported slur', now: NOW + 1000 });
  assert.equal(rv.ok, true);
  assert.equal(rv.record.state, 'revoked');
  assert.equal(isLiveCandidate(rv.record), false);
  assert.equal(rv.record.revoke_reason, 'reported slur');
  assert.equal(rv.record.live_world_authorized, false);
});

test('deny-by-default transitions: illegal moves are rejected', () => {
  const rejected = decideReview(rec(), { to_state: 'rejected', reviewer_ref: 'reviewer:op1' }).record;
  assert.equal(decideReview(rejected, APPROVE).ok, false);              // rejected -> approved illegal
  assert.equal(revokeReview(rec(), { reviewer_ref: 'reviewer:op1' }).ok, false); // cannot revoke a pending
  assert.equal(decideReview(rec(), { to_state: 'not_a_state', reviewer_ref: 'r' }).ok, false);
});

test('invalid submissions are rejected (deny-by-default)', async () => {
  assert.equal((await createReviewRecord({ ...SUB, package_hash: 'nope' })).ok, false);
  assert.equal((await createReviewRecord({ ...SUB, free_text: { display_name: 'x' } })).ok, false); // missing fields
  assert.equal((await createReviewRecord({ ...SUB, package_kind: 'arcade_room' })).ok, false);
});

test('append-only audit trail is hash-chained + tamper-evident', async () => {
  let log = [];
  log = await appendAudit(log, { review_id: 'rv_1', package_hash: SUB.package_hash, from_state: null, to_state: 'pending', reviewer_ref: null, reason: 'submitted', now: NOW });
  log = await appendAudit(log, { review_id: 'rv_1', package_hash: SUB.package_hash, from_state: 'pending', to_state: 'approved_for_live_candidate', reviewer_ref: 'reviewer:op1', reason: 'clean', now: NOW + 10 });
  assert.equal(await verifyAudit(log), true);
  // tamper: flip a to_state -> chain breaks
  const tampered = log.map((e, i) => (i === 1 ? { ...e, to_state: 'pending' } : e));
  assert.equal(await verifyAudit(tampered), false);
  // tamper: reorder -> chain breaks
  assert.equal(await verifyAudit([log[1], log[0]]), false);
});

test('reviewReport is deterministic + never reports live authorization', () => {
  const cand = decideReview(rec(), APPROVE, { now: NOW }).record;
  const a = reviewReport(cand); const b = reviewReport(cand);
  assert.deepEqual(a, b);
  assert.equal(a.is_live_candidate, true);
  assert.equal(a.live_world_authorized, false);
  // the report must NOT leak the (opaque) reviewer identity or any secret/PII field
  assert.ok(!('reviewer_ref' in a));
  for (const k of Object.keys(a)) assert.ok(!/reviewer_ref|email|secret|session|password|\bip_/i.test(k), `report must not expose ${k}`);
});

test('the queue: submit -> pending -> approve -> candidate -> revoke, audit stays intact', async () => {
  const q = createReviewQueue();
  const s = await q.submit(SUB, { now: NOW });
  assert.equal(s.ok, true);
  assert.equal(q.isLiveCandidateHash(SUB.package_hash), false); // pending, not a candidate
  const d = await q.decide(s.record.review_id, APPROVE, { now: NOW + 10 });
  assert.equal(d.ok, true);
  assert.equal(q.isLiveCandidateHash(SUB.package_hash), true);  // candidate (NOT live-authorized)
  const rv = await q.revoke(s.record.review_id, { reviewer_ref: 'reviewer:op1', reason: 'reported', now: NOW + 20 });
  assert.equal(rv.ok, true);
  assert.equal(q.isLiveCandidateHash(SUB.package_hash), false); // revoked -> not a candidate
  assert.equal(await q.verifyAudit(), true);
  assert.equal(q.audit().length, 3); // submit + approve + revoke, all recorded
  // no auto-approval: an unknown id cannot be decided
  assert.equal((await q.decide('rv_unknown', APPROVE)).ok, false);
});

test('returned records are copies — mutating one cannot forge candidacy; screened strings are digest-bound (F1)', async () => {
  const q = createReviewQueue();
  const s = await q.submit(SUB, { now: NOW });
  await q.decide(s.record.review_id, APPROVE, { now: NOW + 10 });
  const got = q.get(s.record.review_id);
  got.free_text.display_name = 'FORGED <script>'; // mutate the RETURNED copy
  got.state = 'pending';
  // the internal store is unaffected: still an approved candidate with the ORIGINAL screened strings
  assert.equal(q.isLiveCandidateHash(SUB.package_hash), true);
  assert.equal(q.get(s.record.review_id).free_text.display_name, SUB.free_text.display_name);
  // the screened strings are digest-bound (tamper-evident in the report + audit)
  assert.match(q.get(s.record.review_id).free_text_digest, /^sha256:[0-9a-f]{64}$/);
  assert.ok(q.audit().some((e) => e.free_text_digest && /^sha256:/.test(e.free_text_digest)));
  assert.equal(await q.verifyAudit(), true);
});

test('REVIEW_STATES are exactly the five lifecycle states', () => {
  assert.deepEqual([...REVIEW_STATES].sort(),
    ['approved_for_live_candidate', 'needs_changes', 'pending', 'rejected', 'revoked']);
});
