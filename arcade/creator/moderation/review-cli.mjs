/**
 * Creator Foundation CF-8 — human-review queue CLI / operator reference harness (Node, LOCAL).
 *
 *   node arcade/creator/moderation/review-cli.mjs            # run the reference moderation flow
 *
 * Drives the review queue through the full lifecycle — submit → pending → human approve (with the
 * free-text review gate) → live CANDIDATE → revoke → not a candidate — and prints the deterministic
 * reports + the append-only hash-chained audit trail. CLI-first, local-only: NO network, NO live loader,
 * NO production. It NEVER flips LIVE_WORLD_LOADER_ENABLED and grants ZERO live authority — the most a
 * package reaches here is `approved_for_live_candidate`, a human recommendation, not a live render.
 */
import { createReviewQueue, REQUIRED_REVIEW_CRITERIA } from './review-queue.mjs';

const SAMPLE = {
  package_hash: 'sha256:' + 'a'.repeat(64),
  package_kind: 'block_style',
  receipt_hash: 'sha256:' + 'b'.repeat(64),         // the CF-2 local approval receipt hash
  validator_report_hash: 'sha256:' + 'c'.repeat(64), // the CF-6 / validator report hash (NOT approval)
  free_text: { display_name: 'Neon Facade', package_id: 'neon-facade-01', operator_note: 'Reviewed locally.' },
};

const line = (s) => console.log(s);

line('Creator Foundation CF-8 — human-review queue (reference flow)\n');
const q = createReviewQueue();

const s = await q.submit(SAMPLE);
line(`  submitted ${SAMPLE.package_hash.slice(0, 16)}…  → state=${s.record.state}  live_candidate=${q.isLiveCandidateHash(SAMPLE.package_hash)}`);
line('    (a CF-6 "valid" verdict is recorded as validator_report_hash — it is NOT approval)');

// a human screens the free-text fields and approves it as a LIVE CANDIDATE (still not live-authorized)
const d = await q.decide(s.record.review_id, {
  to_state: 'approved_for_live_candidate',
  reviewer_ref: 'reviewer:op1',
  free_text_reviewed: true,
  free_text_cleared: true,
  review_criteria: [...REQUIRED_REVIEW_CRITERIA],   // profanity/slurs/harassment/impersonation/pii
  note: 'free text clean',
});
line(`  human review     → state=${d.record.state}  free_text_cleared=${d.record.free_text_cleared}  live_candidate=${q.isLiveCandidateHash(SAMPLE.package_hash)}  live_world_authorized=${d.record.live_world_authorized}`);

// an attempt to approve WITHOUT the free-text review gate is rejected
const bad = await q.submit({ ...SAMPLE, package_hash: 'sha256:' + 'd'.repeat(64) });
const rej = await q.decide(bad.record.review_id, { to_state: 'approved_for_live_candidate', reviewer_ref: 'reviewer:op1' });
line(`  approve w/o free-text review → ${rej.ok ? 'ACCEPTED (BUG!)' : 'REJECTED: ' + rej.errors[0]}`);

// revoke the candidate
const rv = await q.revoke(s.record.review_id, { reviewer_ref: 'reviewer:op1', reason: 'reported impersonation' });
line(`  revoke           → state=${rv.record.state}  live_candidate=${q.isLiveCandidateHash(SAMPLE.package_hash)}`);

line('\n  audit trail (append-only, hash-chained):');
for (const e of q.audit()) line(`    #${e.seq} ${e.from_state || '∅'} → ${e.to_state}  by ${e.reviewer_ref || 'system'}  (${e.reason})`);
line(`  audit verified intact: ${await q.verifyAudit()}`);

line('\n  CF-8 grants ZERO live authority: LIVE_WORLD_LOADER_ENABLED stays false; a candidate is a human');
line('  recommendation, never a live render. Live load requires the separate, still-closed CF-7 loader.');
process.exit(0);
