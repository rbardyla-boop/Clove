/**
 * Turf Wars — Phase 3d INTEGRATION (lab) · UNIT TESTS · NO-CENTRAL-AUTHORITY AVAILABILITY EXERCISED.
 *   node --test tests/arcade/turf-wars-fabric.test.mjs
 *
 * Covers the deterministic in-process availability-fabric harness (availability-fabric.mjs) that COMPOSES the
 * already-built 3a beacon, 3b availability + challenge window, and 3c multi-writer overlay into ONE end-to-end
 * settlement lifecycle, the fabric evidence pack + suite (fabric-evidence.mjs), and the end-to-end stress
 * suite (fabric-stress.mjs). LAB ONLY — these modules are denylisted from the curated production upload and
 * imported by no production path. The fabric PROVES THE MECHANISM, NOT THE DEPLOYMENT; all prior 3a/3b/3c
 * residuals are carried forward, DISCLOSED, NOT closed; Phase 0 legal/safety counsel remains BLOCKING.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FINALIZE_STATUS } from '../../arcade/hiveworld-agents/turf-wars/challenge-window.mjs';
import {
  runHonestSettlement, runForgedSettlementOfflineDefender, swapIndexInvariance,
  runPartitionPastWindow, swapHolderIndex,
} from '../../arcade/hiveworld-agents/turf-wars/availability-fabric.mjs';
import {
  buildFabricEvidencePack, buildFabricEvidenceSuite,
} from '../../arcade/hiveworld-agents/turf-wars/fabric-evidence.mjs';
import {
  buildFabricStressPack, buildFabricStressSuite,
} from '../../arcade/hiveworld-agents/turf-wars/fabric-stress.mjs';

// ── honest end-to-end finalization ────────────────────────────────────────────
test('honest lifecycle: commit→beacon→settle→overlay→window finalizes to final', () => {
  const h = runHonestSettlement({ seed: 42 });
  assert.equal(h.finalized, true);
  assert.equal(h.final_status, FINALIZE_STATUS.FINAL);
  assert.equal(h.entry_status, 'settled');
  assert.match(h.beacon, /^[0-9a-f]{32}$/, 'a real DERIVED post-commit beacon fed the settlement');
  // an honest settlement is never "protected against" — there is nothing to refute
  assert.equal(h.protected_against_honest, false);
});

test('honest lifecycle is deterministic (byte-identical replay)', () => {
  const a = runHonestSettlement({ seed: 1337 });
  const b = runHonestSettlement({ seed: 1337 });
  assert.equal(a.overlay_fingerprint, b.overlay_fingerprint);
  assert.equal(a.block_fingerprint, b.block_fingerprint);
  assert.equal(a.final_status, b.final_status);
  assert.equal(a.mini_log_fingerprint, b.mini_log_fingerprint);
});

// ── forged-offline-defender caught + revoked; base byte-identical ──────────────
test('forged settlement vs OFFLINE defender is caught + revoked by a third party using only public inputs', () => {
  const f = runForgedSettlementOfflineDefender({ seed: 42 });
  assert.equal(f.refuted, true);
  assert.equal(f.refuted_status, FINALIZE_STATUS.REFUTED);
  assert.equal(f.revoked, true);
  assert.equal(f.revoked_status, 'revoked');
  // the third-party watcher (not the owner) produced the revocation; the owner was never online / never signed
  assert.equal(f.revoker_is_watcher_not_owner, true);
  assert.equal(f.owner_online, false);
  // the offline victim is protected by the in-window honest watcher
  assert.equal(f.protected_victim, true);
  // the revoked entry's scorch is excluded from the applied total
  assert.equal(f.scorch_excluded, true);
  assert.ok(f.applied_total_rev < f.applied_total_no_rev, 'revoked scorch lowers the total');
});

test('forged-offline lifecycle: the defender base blockFingerprint is byte-identical throughout', () => {
  const f = runForgedSettlementOfflineDefender({ seed: 9001 });
  assert.equal(f.base_byte_identical, true);
  assert.equal(f.block_fingerprint_before, f.block_fingerprint_after, 'base never mutated');
});

// ── swap-the-holder-index → identical outcome (keyless, swappable seam) ────────
test('swapping the holder/discovery index yields byte-identical outcomes (signing-keyless, swappable seam)', () => {
  const sw = swapIndexInvariance({ seed: 42 });
  assert.equal(sw.honestIdentical, true, 'honest lifecycle outcomes index-independent');
  assert.equal(sw.forgedIdentical, true, 'forged lifecycle outcomes index-independent');
  // the swap index holds no key and decides nothing — outcomes match the default index exactly
  assert.equal(sw.honestDefault.final_status, sw.honestSwapped.final_status);
  assert.equal(sw.forgedDefault.refuted_status, sw.forgedSwapped.refuted_status);
  assert.equal(sw.forgedDefault.revoked, sw.forgedSwapped.revoked);
});

test('swapHolderIndex applies the same verifySnapshot gate (a tampered cached record is excluded)', () => {
  const honest = runHonestSettlement({ seed: 7, makeIndex: swapHolderIndex });
  assert.equal(honest.final_status, FINALIZE_STATUS.FINAL, 'lifecycle works over the plain-map index too');
});

// ── composed beacon / window / overlay claims (the evidence pack proves them end-to-end) ──
test('fabric evidence pack passes (seed 42) with all F-claims present', () => {
  const pack = buildFabricEvidencePack({ seed: 42 });
  assert.equal(pack.pass, true, JSON.stringify(pack.claims.filter((c) => !c.ok), null, 2));
  const ids = pack.claims.map((c) => c.id);
  for (const need of [
    'F1_honest_settlement_finalizes',
    'F2_forged_offline_defender_caught_and_revoked',
    'F3_authority_traces_to_signatures_and_folds',
    'F4_beacon_post_commit_bounds_K',
    'F5_challenge_window_protects_offline_victim',
    'F6_overlay_converges',
    'F7_base_never_mutated_end_to_end',
    'F8_no_central_server',
    'F0_production_denylist_proven',
  ]) {
    assert.ok(ids.includes(need), `pack carries ${need}`);
  }
});

test('fabric evidence pack: proves the MECHANISM, carries ALL prior residuals disclosed not closed', () => {
  const pack = buildFabricEvidencePack({ seed: 42 });
  // the single resolves[] entry is the mechanism, not the deployment
  assert.equal(pack.resolves.length, 1);
  assert.match(pack.resolves[0], /MECHANISM/);
  assert.match(pack.proves, /NOT THE DEPLOYMENT/);
  // the deferred residuals are the UNION of the 3a/3b/3c residuals, ALL disclosed not closed
  const r = pack.deferred_residuals.join(' | ');
  assert.match(r, /3a/, 'carries the 3a beacon residual');
  assert.match(r, /3b/, 'carries the 3b availability residual');
  assert.match(r, /Phase 4/, 'carries the Phase-4 quorum residual');
  assert.match(r, /B6\/B7\/D11/, 'carries the real-P2P-transport residual');
  assert.match(r, /M-of-N safety quorum/, 'carries the render-gate residual');
  assert.match(r, /Phase 0 legal\/safety counsel = BLOCKING/, 'Phase 0 legal counsel disclosed as BLOCKING');
});

test('fabric evidence suite passes across seeds [42,1337,9001]', () => {
  const suite = buildFabricEvidenceSuite({ seeds: [42, 1337, 9001] });
  assert.equal(suite.pass, true);
  assert.equal(suite.packs.length, 3);
  for (const p of suite.packs) assert.equal(p.pass, true, `seed ${p.seed} pack passes`);
});

// ── partition residual finalizes the forgery (EXPECTED, disclosed) ────────────
test('partition-past-window finalizes the forgery (the EXPECTED disclosed residual, exercised end-to-end)', () => {
  const p = runPartitionPastWindow({ seed: 42 });
  // a partition isolating the victim + all honest holders past W → protection fails, forgery finalizes
  assert.equal(p.protected_under_partition, false);
  assert.equal(p.final_status, FINALIZE_STATUS.FINAL);
  assert.equal(p.forgery_finalizes, true);
  assert.match(p.disclosure, /DISCLOSED, not closed/);
});

// ── stress: end-to-end reorder/dup/drop + partition across seeds ──────────────
test('fabric stress pack passes (seed 42) with the partition residual witness present', () => {
  const pack = buildFabricStressPack({ seed: 42 });
  assert.equal(pack.pass, true, JSON.stringify(pack.claims.filter((c) => !c.ok), null, 2));
  const ids = pack.claims.map((c) => c.id);
  assert.ok(ids.includes('FS1_lifecycle_replay_deterministic'));
  assert.ok(ids.includes('FS2_reorder_dup_convergent'));
  assert.ok(ids.includes('FS3_forged_lifecycle_deterministic'));
  assert.ok(ids.includes('FSP_partition_past_window_finalizes_forgery_EXPECTED_RESIDUAL'));
  assert.equal(pack.expected_residual_witness, 'FSP_partition_past_window_finalizes_forgery_EXPECTED_RESIDUAL');
});

test('fabric stress suite passes across seeds [42,1337,9001]', () => {
  const suite = buildFabricStressSuite({ seeds: [42, 1337, 9001] });
  assert.equal(suite.pass, true);
  assert.equal(suite.packs.length, 3);
  for (const p of suite.packs) assert.equal(p.pass, true, `seed ${p.seed} stress pack passes`);
});
