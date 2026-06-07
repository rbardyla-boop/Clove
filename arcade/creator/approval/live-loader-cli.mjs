/**
 * Creator Foundation CF-7 — LIVE LOADER boundary check / operator reference harness (Node, LOCAL).
 *
 *   node arcade/creator/approval/live-loader-cli.mjs   # prove the live loader rejects by default
 *
 * Builds a FULLY-VALID, fully-approved live chain (CF-2 local receipt + CF-6 hive verdict + CF-8 human
 * review + CF-7 live receipt + live registry, all real + hash-bound) and feeds it to the live loader AS
 * SHIPPED — i.e. with `LIVE_WORLD_LOADER_ENABLED` left at its false constant. The point is the result:
 * even a perfect approval is REJECTED with `live_world_loader_not_enabled`. This is an operator check
 * that the trust boundary holds; it NEVER enables live load, NEVER deploys, NEVER touches the network.
 * (The inner gates — tamper/digest/epoch/binding/kind/kill-switch — are exercised in
 * tests/creator/live-loader.test.mjs, which drives the closed machine with an explicit test parameter.)
 */
import { readFileSync } from 'node:fs';
import { packageHash } from '../validator/package-hash.mjs';
import { buildApprovalReceipt, APPROVED_LOCAL } from './approval-receipt.mjs';
import { buildHiveReceipt } from '../hive-validation/hive-service.mjs';
import { createReviewRecord, decideReview, REQUIRED_REVIEW_CRITERIA } from '../moderation/review-queue.mjs';
import { buildLiveApprovalReceipt } from './live-approval-receipt.mjs';
import { buildLiveRegistry } from './live-registry.mjs';
import { loadLivePackage, LIVE_WORLD_LOADER_ENABLED } from './live-loader.mjs';

const line = (s) => console.log(s);
const NOW = Date.now();
const pkg = JSON.parse(readFileSync(new URL('../samples/sample-block.package.json', import.meta.url)));

line('Creator Foundation CF-7 — live loader boundary check\n');
line(`  LIVE_WORLD_LOADER_ENABLED = ${LIVE_WORLD_LOADER_ENABLED}   (shipped constant)\n`);

// Assemble the full, real, hash-bound approval chain a live load WOULD require.
const hash = await packageHash(pkg);
const localReceipt = await buildApprovalReceipt({ packageHash: hash, packageKind: 'block_style', status: APPROVED_LOCAL, now: NOW });
const hiveReceipt = await buildHiveReceipt(pkg, NOW);
const reviewRecord = decideReview(
  (await createReviewRecord({ package_hash: hash, package_kind: 'block_style', receipt_hash: localReceipt.receipt_hash, validator_report_hash: hiveReceipt.receipt_hash, free_text: { display_name: 'Tide Glass Facade', package_id: 'harbor-tide-glass', operator_note: 'reviewed locally' } }, { now: NOW, id: 'demo' })).record,
  { to_state: 'approved_for_live_candidate', reviewer_ref: 'reviewer:op1', free_text_reviewed: true, free_text_cleared: true, review_criteria: [...REQUIRED_REVIEW_CRITERIA], note: 'clean' },
  { now: NOW },
).record;
const liveReceipt = (await buildLiveApprovalReceipt({ reviewRecord, localReceiptHash: localReceipt.receipt_hash, hiveVerdictReceiptHash: hiveReceipt.receipt_hash, stagingVerified: true, now: NOW })).receipt;
const liveRegistry = await buildLiveRegistry([{ package_hash: hash, package_kind: 'block_style', live_approval_id: liveReceipt.live_approval_id, approval_status: 'operator_approved_live', live_world_authorized: true, approved_live_at: new Date(NOW).toISOString(), expires_at: null, revoked: false, revoked_at: null, revoke_reason: null }], 1);

line('  built a FULLY-VALID live chain:');
line(`    package          ${hash.slice(0, 22)}…  (CF-1 hash)`);
line(`    local receipt    ${localReceipt.approval_status}  (CF-2)`);
line(`    hive verdict     ${hiveReceipt.verdict}  (CF-6)`);
line(`    human review     ${reviewRecord.state}  free_text_cleared=${reviewRecord.free_text_cleared}  (CF-8)`);
line(`    live receipt     live_world_authorized=${liveReceipt.live_world_authorized}  staging_verified=${liveReceipt.staging_verified}  (CF-7)`);
line(`    live registry    1 entry, epoch ${liveRegistry.revocation_epoch}\n`);

// Feed it to the loader AS SHIPPED (no enabled override): the boundary must reject it.
const r = await loadLivePackage({ package: pkg, liveReceipt, liveRegistry, localReceipt, hiveReceipt, reviewRecord, killSwitch: false, highestSeenEpoch: 1, now: NOW });
line(`  load (as shipped) → ${r.ok ? 'LOADED (BOUNDARY BREACH!)' : 'REJECTED: ' + r.reason}`);

const held = !r.ok && r.reason === 'live_world_loader_not_enabled';
line(`\n  boundary holds: ${held}  — even a perfect approval cannot enter the live world while the flag is false.`);
line('  Enabling live load is a separate, human-cleared, staging-verified production gate — not reachable here.');
process.exit(held ? 0 : 1);
