/**
 * Turf Wars — Phase 3d INTEGRATION (lab) · NO-CENTRAL-AUTHORITY AVAILABILITY EXERCISED · EVIDENCE PACK.
 * Pure, deterministic. PROVES THE MECHANISM, NOT THE DEPLOYMENT.
 *
 * ⚠️ LAB ONLY — see availability-fabric.mjs / settlement.mjs headers. Denylisted from the curated upload;
 * imported by no production path. NO REAL NETWORK, NO IP EXPOSURE. Mirrors the settlement / beacon /
 * availability / overlay evidence harness: fixture identities + a single seeded LCG, every claim a
 * { id, ok, detail } with the MEASURED value in detail, the pack PASS iff all hold, a frozen
 * LAB_MODULE_PATHS denylist self-check. The roadmap stays DRAFT/DESIGN-ONLY and Phase 0 legal/safety
 * counsel remains BLOCKING for any live or minors-facing use.
 *
 * P3-d is the roadmap's `NO-CENTRAL-AUTHORITY AVAILABILITY EXERCISED` gate (docs/NEON_CIRCUIT_TURF_WARS_
 * PHASE3_PLAN.md). It COMPOSES the already-built 3a beacon, 3b availability + challenge window, and 3c
 * multi-writer overlay into ONE end-to-end settlement lifecycle and proves — as a MECHANISM — that an
 * offline host's base is seeable/attackable and a settlement is deliverable between peers via swappable,
 * signing-keyless helpers, with NO central authority. Authority is replay-determinism + the delegable
 * one-op fraud-proof ONLY.
 *
 * The pack PROVES THE MECHANISM, NOT THE DEPLOYMENT. ALL prior 3a/3b/3c residuals are carried forward,
 * DISCLOSED, and NOT closed (research-evidence honesty / the D5 lesson). Phase 0 legal/safety counsel
 * remains BLOCKING for any live or minors-facing use; the M-of-N safety quorum + render-gate and real P2P
 * transport / IP exposure stay deferred to Phase 4 / Phase 0.
 *
 * Claims (each a composed, end-to-end checkable property of the integrated lifecycle):
 *   F1 honest settlement finalizes          commit→beacon→settle→overlay→window finalizes to 'final'.
 *   F2 forged offline defender caught+revoked a forgery against an OFFLINE defender is caught + revoked by a
 *                                            THIRD party using only public inputs (no owner key/online); the
 *                                            revoked entry's scorch is excluded.
 *   F3 authority traces to signatures+folds every authority point is replay-determinism or the delegable
 *                                            fraud-proof; NO node mints/signs/arbitrates an outcome; swapping
 *                                            the holder/discovery index → byte-identical outcomes (keyless seam).
 *   F4 beacon post-commit bounds K           composed: beacon undefined before H_b; window-close bounds K.
 *   F5 challenge window protects offline victim composed: offline victim protected iff >=1 honest in-window
 *                                            watcher; partition-past-window finalizes the forgery (disclosed).
 *   F6 overlay converges                     composed: the integrated overlay converges (same fingerprint)
 *                                            under a seeded delivery storm; concurrent attacks deterministic.
 *   F7 base never mutated end-to-end         the defender's blockFingerprint is byte-identical across the
 *                                            entire HONEST and FORGED lifecycles.
 *   F8 no central server                     NO central server/coordinator/referee anywhere; authority =
 *                                            replay-determinism + delegable fraud-proof ONLY.
 */
import { contentAddress } from './canonical.mjs';
import { foldBlock, blockFingerprint } from './block-log.mjs';
import { deriveBeacon, COHORT_SIZE } from './beacon.mjs';
import { settleAttack, makeCommitOp, makeSettleOp } from './settlement.mjs';
import { FINALIZE_STATUS, CHALLENGE_WINDOW_HEIGHTS } from './challenge-window.mjs';
import { overlayFingerprint, foldOverlay } from './overlay-dag.mjs';
import { signSnapshot } from './snapshot.mjs';
import { makeAttackPlan } from './attack-plan.mjs';
import { scorchBoundsHold } from './scorch.mjs';
import { buildSignedChain, structureId } from './turf-evidence.mjs';
import {
  runHonestSettlement, runForgedSettlementOfflineDefender, swapIndexInvariance,
  runPartitionPastWindow, FABRIC_VERSION, FABRIC_BEACON_HEIGHT,
} from './availability-fabric.mjs';
import { isExcludedFromUpload, PUBLIC_CREATOR_ALLOW } from '../../../scripts/build-curated-client-upload.mjs';

/** The Phase-3d integration lab modules — for the denylist self-check. */
export const LAB_MODULE_PATHS = Object.freeze([
  'arcade/hiveworld-agents/turf-wars/availability-fabric.mjs',
  'arcade/hiveworld-agents/turf-wars/fabric-evidence.mjs',
  'arcade/hiveworld-agents/turf-wars/fabric-stress.mjs',
]);

const NO_VALUE_OPS = ['transfer', 'cash_out', 'sell', 'buy', 'trade', 'payout'];

/** Tiny deterministic PRNG (mulberry32) — same generator family every turf-wars pack uses. */
function lcg(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffled = (arr, rnd) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/** PURE: build the Phase-3d NO-CENTRAL-AUTHORITY AVAILABILITY EXERCISED evidence pack for a seed. */
export function buildFabricEvidencePack({ seed = 42 } = {}) {
  const rnd = lcg((seed >>> 0) ^ 0x3d0fab12);
  const W = CHALLENGE_WINDOW_HEIGHTS;
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  // the full composed traces (one honest, one forged-offline-defender)
  const honest = runHonestSettlement({ seed });
  const forged = runForgedSettlementOfflineDefender({ seed });
  const swap = swapIndexInvariance({ seed });
  const partition = runPartitionPastWindow({ seed });

  // ── F1 honest settlement finalizes: commit→beacon→settle→overlay→window → 'final' deterministically ──
  const honest2 = runHonestSettlement({ seed }); // byte-identical replay
  claim('F1_honest_settlement_finalizes',
    honest.finalized && honest.final_status === FINALIZE_STATUS.FINAL
      && honest.entry_status === 'settled' && typeof honest.beacon === 'string' && /^[0-9a-f]{32}$/.test(honest.beacon)
      && honest.final_status === honest2.final_status && honest.overlay_fingerprint === honest2.overlay_fingerprint,
    `lifecycle commit→beacon(${honest.beacon})→settle→overlay→window(W=${W}) → ${honest.final_status}; entry=${honest.entry_status}; deterministic replay=${honest.overlay_fingerprint === honest2.overlay_fingerprint}`);

  // ── F2 forged offline defender caught + revoked by a THIRD party using only public inputs ──
  claim('F2_forged_offline_defender_caught_and_revoked',
    forged.refuted && forged.refuted_status === FINALIZE_STATUS.REFUTED
      && forged.revoked && forged.revoked_status === 'revoked'
      && forged.scorch_excluded && forged.applied_total_rev < forged.applied_total_no_rev
      && forged.revoker_is_watcher_not_owner && forged.owner_online === false && forged.protected_victim === true,
    `forged settlement vs OFFLINE defender → refuted=${forged.refuted_status}, revoked by third-party watcher (not owner)=${forged.revoker_is_watcher_not_owner}, owner online=${forged.owner_online}; revoked scorch excluded (${forged.applied_total_no_rev}→${forged.applied_total_rev}); offline victim protected=${forged.protected_victim}`);

  // ── F3 authority traces to signatures + folds; swapping the holder/discovery index → byte-identical ──
  claim('F3_authority_traces_to_signatures_and_folds',
    swap.honestIdentical === true && swap.forgedIdentical === true
      // no node minted/signed/arbitrated: the honest claim is never "protected against" (nothing to refute),
      // the forgery is caught only by a recompute (proveFraud), and outcomes are index-independent.
      && honest.protected_against_honest === false,
    `swap holder/discovery index (makeHolderIndex ↔ plain-map swapHolderIndex) → honest outcomes identical=${swap.honestIdentical}, forged outcomes identical=${swap.forgedIdentical}; authority = owner key + delegable proveFraud + folds, never the index/relay`);

  // ── F4 beacon post-commit + window-close bounds K (composed via the integrated path) ──
  // post-commit: deriveBeacon over the SAME cohort but at an UNREACHED H_b is null (provably did not exist
  // at commit time). window-close: a settle whose attack_commit folded at seq >= H_b is econ-rejected.
  const ctxBeaconNull = deriveBeacon({ cohortRecords: forged._internal.ctx.cohortRecords, beacon_height: FABRIC_BEACON_HEIGHT + 1000 });
  // window-close on the integrated base chain: pad the base so the commit lands at seq >= H_b → closed.
  const ctx = honest._internal.ctx;
  const Hb = FABRIC_BEACON_HEIGHT;
  const padSteps = [{ type: 'init_block', payload: { theme: 'chrome' }, tick: 0 }];
  for (let i = 1; i <= Hb; i++) padSteps.push({ type: 'build_structure', payload: { structure_id: structureId(`fk-pad-${i}`), kind: 'signage', x: i % 16, y: (i + 1) % 16 }, tick: i });
  const longChain = buildSignedChain(ctx.defender, ctx.block, padSteps); // length = H_b + 1
  const longState = foldBlock(longChain);
  const longBase = signSnapshot(ctx.defender, longState);
  // a plan bound to longBase (targeting a padded signage that exists in longBase) so settleAttack is valid;
  // the window-close econ-rejection is what we are exercising, independent of the target identity.
  const longPlan = makeAttackPlan(ctx.attacker, {
    target_block: ctx.block, base_address: longBase.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('fk-pad-1'), intensity: 3 }, { structure_id: structureId('fk-pad-1'), intensity: 3 }],
  });
  const longSettle = settleAttack(longBase, longPlan, { seed_reveal: ctx.seedReveal, beacon: ctx.beacon, beacon_height: Hb });
  const lateSeq = longChain.length; // >= H_b
  const lateCommit = makeCommitOp(ctx.defender, { block_id: ctx.block, prev: longChain[longChain.length - 1].hash, seq: lateSeq, tick: lateSeq },
    { base_address: longSettle.settlement.base_address, plan_hash: longSettle.settlement.plan_hash, seed_commit: longSettle.settlement.seed_commit, beacon_height: Hb });
  const lateSettleOp = makeSettleOp(ctx.defender, { block_id: ctx.block, prev: lateCommit.hash, seq: lateSeq + 1, tick: lateSeq + 1 }, longSettle.settlement);
  const closedState = foldBlock([...longChain, lateCommit, lateSettleOp]);
  const windowClosed = !closedState.applied.includes(lateSettleOp.hash)
    && closedState.econ_rejected.some((r) => r.ref === lateSettleOp.hash && r.reason === 'commit_window_closed')
    && Object.keys(closedState.scorch).length === 0;
  claim('F4_beacon_post_commit_bounds_K',
    ctxBeaconNull === null && typeof honest.beacon === 'string' && honest.cohort.length === COHORT_SIZE && windowClosed && lateSeq >= Hb,
    `beacon undefined before H_b (cohort at unreached H_b → ${ctxBeaconNull}) and defined after (${honest.beacon}); window-close: commit folded at seq=${lateSeq} (>= H_b=${Hb}) → settle econ-rejected commit_window_closed (K bounded by pre-H_b budget)`);

  // ── F5 challenge window protects offline victim iff >=1 honest in-window watcher; partition finalizes ──
  claim('F5_challenge_window_protects_offline_victim',
    forged.protected_victim === true && forged.refuted === true
      && partition.protected_under_partition === false && partition.final_status === FINALIZE_STATUS.FINAL
      && partition.forgery_finalizes === true,
    `>=1 honest in-window watcher → offline victim protected=${forged.protected_victim} (refuted=${forged.refuted}); PARTITION past W isolates victim+honest holders → protected=${partition.protected_under_partition}, forgery FINALIZES=${partition.final_status} (DISCLOSED residual, not closed)`);

  // ── F6 overlay converges under a seeded delivery storm; concurrent attacks deterministic ──
  // re-fold the honest overlay entry under reorder/dup and confirm the integrated overlayFingerprint is stable.
  const entry = honest._internal.mini.entry;
  const baseOverlayFp = overlayFingerprint(foldOverlay([entry], [], {}));
  let overlayConvergent = true;
  for (let k = 0; k < 16; k++) {
    const dupEntries = [];
    for (let i = 0; i < 4; i++) dupEntries.push(entry); // duplicate delivery of the same entry
    if (overlayFingerprint(foldOverlay(shuffled([entry, ...dupEntries], rnd), [], {})) !== baseOverlayFp) { overlayConvergent = false; break; }
  }
  // concurrent: two forged-lifecycle replays converge to the same overlay fingerprint (delivery-order free)
  const forgedReplay = runForgedSettlementOfflineDefender({ seed });
  const concurrentDeterministic = overlayFingerprint(forged._internal.overlayRev) === overlayFingerprint(forgedReplay._internal.overlayRev);
  claim('F6_overlay_converges',
    overlayConvergent && concurrentDeterministic,
    `16 reorder/dup storms over the integrated overlay → same overlayFingerprint=${overlayConvergent}; concurrent forged-lifecycle replays converge=${concurrentDeterministic}`);

  // ── F7 base never mutated end-to-end: the defender's blockFingerprint is byte-identical across BOTH
  //    the honest AND the forged lifecycles ──
  const baseFpEqualAcrossScenarios = honest.block_fingerprint === forged.block_fingerprint_before
    && forged.block_fingerprint_before === forged.block_fingerprint_after;
  claim('F7_base_never_mutated_end_to_end',
    forged.base_byte_identical === true && baseFpEqualAcrossScenarios,
    `defender blockFingerprint byte-identical: honest=${honest.block_fingerprint.slice(0, 24)}…; forged before→after identical=${forged.base_byte_identical}; equal across scenarios=${baseFpEqualAcrossScenarios}`);

  // ── F8 no central server: authority = replay-determinism + delegable fraud-proof ONLY; NO node
  //    mints/signs/arbitrates an outcome; no value/transfer field on any composed surface ──
  const noValueFieldHonest = !NO_VALUE_OPS.some((t) => t in honest.settlement) && honest.settlement.attacker_reward <= 25
    && scorchBoundsHold(honest.settlement.scorch);
  const noValueFieldOverlay = !NO_VALUE_OPS.some((t) => t in forged._internal.overlayRev)
    && !('attacker_reward' in forged._internal.overlayRev) && scorchBoundsHold(forged._internal.overlayRev.applied_scorch);
  // the ONLY way the forgery was caught was a recompute (proveFraud) by a THIRD party with no owner key and
  // the owner offline — no coordinator/referee. The swap-index invariance proves no relay holds authority.
  const noCentralAuthority = forged.revoker_is_watcher_not_owner && forged.owner_online === false
    && swap.honestIdentical && swap.forgedIdentical;
  claim('F8_no_central_server',
    noCentralAuthority && noValueFieldHonest && noValueFieldOverlay,
    `forgery caught/revoked by a third-party recompute with owner offline & no owner key=${noCentralAuthority}; no value/transfer field on settlement or overlay=${noValueFieldHonest && noValueFieldOverlay}; authority = replay-determinism + delegable fraud-proof ONLY`);

  // ── denylist self-check (boundary): the integration lab modules never reach the curated production upload ──
  const allExcluded = LAB_MODULE_PATHS.every((p) => isExcludedFromUpload(p));
  const notAllowlisted = LAB_MODULE_PATHS.every((p) => !PUBLIC_CREATOR_ALLOW.has(p));
  claim('F0_production_denylist_proven', allExcluded && notAllowlisted,
    `${LAB_MODULE_PATHS.length}/${LAB_MODULE_PATHS.length} integration lab modules excluded from curated upload; none allowlisted`);

  return {
    artifact_kind: 'turf_wars_phase3d_fabric_evidence',
    schema_version: 1,
    lab_only: true,
    fabric_version: FABRIC_VERSION,
    proves: 'THE MECHANISM, NOT THE DEPLOYMENT — an offline host base is seeable/attackable + a settlement deliverable between peers via swappable, signing-keyless helpers, with NO central authority (replay-determinism + delegable one-op fraud-proof ONLY). This proves the mechanism in-process; real-network deployment is NOT proven.',
    never_production: 'arcade/hiveworld-agents/turf-wars/ is denylisted from the curated upload and imported by no Worker/DO/client path',
    resolves: [
      'Phase 3 availability fabric MECHANISM — offline host base seeable/attackable + settlement deliverable between peers via swappable, signing-keyless helpers, no central authority',
    ],
    deferred_residuals: [
      'real-world beacon entropy liveness + sybil cohort (3a)',
      'honest-minority assumption + partition-past-window (3b)',
      'sybil-resistant revocation quorum + owner reconciliation (Phase 4)',
      'real P2P transport / IP exposure (Phase 0 B6/B7/D11)',
      'M-of-N safety quorum + render-gate = Phase 4',
      'Phase 0 legal/safety counsel = BLOCKING for any live/minors-facing use',
    ],
    seed,
    window_heights: W,
    claims,
    pass: claims.every((c) => c.ok),
  };
}

/** PURE: the multi-seed suite. */
export function buildFabricEvidenceSuite({ seeds = [42, 1337, 9001] } = {}) {
  const packs = seeds.map((seed) => buildFabricEvidencePack({ seed }));
  return { schema_version: 1, lab_only: true, suite: 'turf-wars-fabric-evidence-suite', seeds, packs, pass: packs.every((p) => p.pass) };
}
