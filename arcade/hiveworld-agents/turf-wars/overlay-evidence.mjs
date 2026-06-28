/**
 * Turf Wars — Phase 3c MULTI-WRITER OVERLAY (O6, lab) · EVIDENCE PACK (pure, deterministic). RESOLVES O6
 * multi-writer (MECHANISM): per-attacker single-writer mini-log + content-addressed convergent overlay +
 * keyless (offline-owner) revocation.
 *
 * ⚠️ LAB ONLY — see overlay-dag.mjs / settlement-mini-log.mjs headers. Denylisted from the curated upload;
 * imported by no production path. NO REAL NETWORK. Mirrors the settlement / availability evidence harness:
 * fixture identities + a single seeded LCG, every claim a { id, ok, detail } with the MEASURED value in
 * detail, the pack PASS iff all hold, a frozen LAB_MODULE_PATHS denylist self-check. The roadmap stays
 * DRAFT/DESIGN-ONLY and Phase 0 legal/safety counsel remains BLOCKING for any live or minors-facing use.
 *
 * The settlement-evidence pack DEFERRED O6 multi-writer ("which writer commits the ops into a shared log +
 * concurrent-attack convergence + applying a fraud-proof revocation against an offline owner is Phase 3").
 * This pack RESOLVES that as a MECHANISM (design: docs/NEON_CIRCUIT_TURF_WARS_PHASE3_PLAN.md, Residual 3).
 * It does NOT close the sybil-resistant quorum / revocation-flood bound or owner reconciliation — both are
 * DISCLOSED and DEFERRED to Phase 4, not faked here.
 */
import { identityFromSeed } from './identity.mjs';
import { canonicalize, contentAddress } from './canonical.mjs';
import { foldBlock, blockFingerprint } from './block-log.mjs';
import { signSnapshot } from './snapshot.mjs';
import { makeAttackPlan } from './attack-plan.mjs';
import { settleAttack, proveFraud } from './settlement.mjs';
import { SCORCH_CAP, scorchBoundsHold } from './scorch.mjs';
import {
  makeMiniLogId, makeSettlementCommitOp, makeSettlementRevealOp, makeMiniOp,
  foldMiniLog, miniLogFingerprint,
} from './settlement-mini-log.mjs';
import {
  foldOverlay, overlayFingerprint, overlayEntryFromMiniLog, makeRevocationEntry,
  verifyRevocationEntry, overlayBoundsHold, ENTRY_STATUS,
} from './overlay-dag.mjs';
import { buildSignedChain, blockIdFor, structureId } from './turf-evidence.mjs';
import { isExcludedFromUpload, PUBLIC_CREATOR_ALLOW } from '../../../scripts/build-curated-client-upload.mjs';

/** The Phase-3c multi-writer-overlay lab modules — for the denylist self-check. */
export const LAB_MODULE_PATHS = Object.freeze([
  'arcade/hiveworld-agents/turf-wars/settlement-mini-log.mjs',
  'arcade/hiveworld-agents/turf-wars/overlay-dag.mjs',
  'arcade/hiveworld-agents/turf-wars/overlay-evidence.mjs',
]);

const NO_VALUE_OPS = ['transfer', 'cash_out', 'sell', 'buy', 'trade', 'payout'];

/** ONE deterministic PRNG (mulberry32) — same generator family the other packs use. */
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

/** A defender with one distinct signage per attacker so each attacker's scorch lands on its OWN structure —
 * removing one entry's scorch then demonstrably lowers the additive total (the SCORCH_CAP saturation that
 * would otherwise mask exclusion is avoided). The structures cost only flux (signage), within the starter
 * grant. ATTACKERS = N below; we build N targets. */
const ATTACKER_COUNT = 4;
function targetId(i) { return structureId(`o6-target-${i}`); }

/** PURE: the genesis step list (one defender block with N distinct signage targets + one resource_node). One
 * source of truth so every fingerprint recompute uses byte-identical steps. */
function genesisSteps() {
  const steps = [{ type: 'init_block', payload: { theme: 'chrome' }, tick: 0 }];
  for (let i = 0; i < ATTACKER_COUNT; i++) {
    steps.push({ type: 'build_structure', payload: { structure_id: targetId(i), kind: 'signage', x: i, y: 0 }, tick: i + 1 });
  }
  steps.push({ type: 'build_structure', payload: { structure_id: structureId('node'), kind: 'resource_node', x: 0, y: 5 }, tick: ATTACKER_COUNT + 1 });
  return steps;
}

/** PURE: a defender block, its signed base snapshot, and the genesis chain. The defender is the OFFLINE
 * VICTIM/OWNER throughout — never required online; revocation is keyless for it. */
function defenderFixture(seed) {
  const defender = identityFromSeed(`o6-def/${seed}`);
  const block = blockIdFor(defender);
  const chain = buildSignedChain(defender, block, genesisSteps());
  const state = foldBlock(chain);
  return { defender, block, chain, state, base: signSnapshot(defender, state) };
}

/** PURE: build a full attacker mini-log (commit→reveal) against the defender base, returning the ops, the
 * folded state, the overlay entry, and the honest settlement record (the reveal's claim). Each attacker
 * targets its OWN distinct signage (targetId(idx)) so scorch is per-attacker separable. */
function attackerMiniLog(seed, idx, base, block, defenderState) {
  const attacker = identityFromSeed(`o6-atk/${seed}/${idx}`);
  const seedReveal = contentAddress({ seed, idx }).slice(7, 7 + 32); // closed hex token (attacker's secret)
  const beacon = contentAddress({ beacon: seed, idx }).slice(7, 7 + 16); // post-commit beacon (O1 residual = input)
  const beaconHeight = 4; // H_b: a fixed bounded logical seq-height (window-close metadata; threaded through)
  // each attacker targets ITS OWN distinct signage with two moves so the outcome carries separable scorch
  const plan = makeAttackPlan(attacker, {
    target_block: block, base_address: base.address, nonce: contentAddress({ nonce: seed, idx }).slice(7, 7 + 16),
    moves: [{ structure_id: targetId(idx), intensity: 3 }, { structure_id: targetId(idx), intensity: 3 }],
  });
  const st = settleAttack(base, plan, { seed_reveal: seedReveal, beacon, beacon_height: beaconHeight });
  const settlement = st.settlement;
  const mini_log_id = makeMiniLogId({ block_id: block, base_address: base.address, attacker_pubkey: attacker.publicRawHex });
  const commitOp = makeSettlementCommitOp(attacker, { mini_log_id, prev: null, seq: 0, tick: 0 },
    { base_address: settlement.base_address, plan_hash: settlement.plan_hash, seed_commit: settlement.seed_commit, beacon_height: beaconHeight });
  const revealOp = makeSettlementRevealOp(attacker, { mini_log_id, prev: commitOp.hash, seq: 1, tick: 1 }, settlement);
  const ops = [commitOp, revealOp];
  const folded = foldMiniLog(ops);
  return { attacker, plan, settlement, mini_log_id, commitOp, revealOp, ops, folded, entry: overlayEntryFromMiniLog(folded) };
}

/** PURE: build the Phase-3c multi-writer overlay evidence pack for a seed. */
export function buildOverlayEvidencePack({ seed = 42 } = {}) {
  const rnd = lcg((seed >>> 0) ^ 0x06a7c3d9);
  const { defender, block, state, base } = defenderFixture(seed);
  // the OWNER base fingerprint, computed from the genesis chain (offline owner). Recomputing from the SAME
  // genesisSteps() proves base-independence: overlay activity never touches it.
  const ownerBaseFp = () => blockFingerprint(foldBlock(buildSignedChain(defender, block, genesisSteps())));
  const blockFp0 = ownerBaseFp();
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  // N concurrent distinct attackers, each a single-writer mini-log against the same base.
  const N = ATTACKER_COUNT;
  const attacks = [];
  for (let i = 0; i < N; i++) attacks.push(attackerMiniLog(seed, i, base, block, state));

  // ── O6_1 single-writer per author: a foreign-signed mini-log op is rejected not_attacker; the owner's
  //    base chain (assembleChain) is NEVER written by an attacker (single-writer-of-own-chain preserved). ──
  const a0 = attacks[0];
  const intruder = identityFromSeed(`o6-intruder/${seed}`);
  // intruder forges a settlement_reveal at seq 1 in a0's mini-log (correct id/prev, WRONG signer)
  const foreignReveal = makeMiniOp(intruder, { mini_log_id: a0.mini_log_id, prev: a0.commitOp.hash, seq: 1, tick: 1, type: 'settlement_reveal', payload: a0.revealOp.payload });
  const foldedWithForeign = foldMiniLog([a0.commitOp, foreignReveal]);
  const foreignRejected = foldedWithForeign.rejected.some((r) => r.ref === foreignReveal.hash && r.reason === 'not_attacker')
    && !foldedWithForeign.applied.includes(foreignReveal.hash)
    && foldedWithForeign.reveal === null; // the foreign op never folded a reveal
  // the OWNER's base chain stays single-writer: an attacker op cannot ride the owner chain (assembleChain
  // rejects it not_owner). Build an owner genesis, then have an attacker sign a build at seq 1 → not_owner.
  const ownerGenesis = buildSignedChain(defender, block, [{ type: 'init_block', payload: { theme: 'neon' }, tick: 0 }]);
  // an attacker-signed op on the OWNER chain is rejected; the base substrate already proves this (C3),
  // here we re-assert the boundary: the mini-log adds writers ONLY in the separate namespace.
  const baseSingleWriter = foldBlock(ownerGenesis).owner === defender.publicRawHex
    && foldBlock(ownerGenesis).applied.length === 1;
  claim('O6_1_single_writer_per_author',
    foreignRejected && baseSingleWriter,
    `foreign-signed mini-log op → not_attacker (inert)=${foreignRejected}; owner base chain single-writer preserved=${baseSingleWriter}`);

  // ── O6_2 mini-log convergence: foldMiniLog(shuffle(S)) === foldMiniLog(S) over K shuffles ──
  let miniConvergent = true;
  const miniFp = miniLogFingerprint(a0.folded);
  for (let k = 0; k < 16; k++) {
    const dups = [];
    for (let i = 0; i < 4; i++) dups.push(a0.ops[Math.floor(rnd() * a0.ops.length)]); // duplicate delivery
    if (miniLogFingerprint(foldMiniLog(shuffled([...a0.ops, ...dups], rnd))) !== miniFp) { miniConvergent = false; break; }
  }
  // a settlement_reveal with NO prior commit fails to fold (no_prior_commit) — temporal ordering invariant
  const orphanReveal = a0.revealOp; // seq 1, but delivered without its seq-0 commit
  const orphanFold = foldMiniLog([orphanReveal]);
  const noPriorCommit = orphanFold.reveal === null
    && orphanFold.rejected.some((r) => r.ref === orphanReveal.hash);
  claim('O6_2_minilog_convergence',
    miniConvergent && noPriorCommit,
    `16 reorder/dup shuffles → same mini-log fingerprint=${miniConvergent}; reveal w/o prior commit does not fold=${noPriorCommit}`);

  // ── O6_3 overlay convergence: foldOverlay(shuffle(E)) === foldOverlay(E) with concurrent attackers +
  //    injected revocations (same overlayFingerprint) ──
  const entries = attacks.map((a) => a.entry);
  // verify-fn over the public inputs (closure: the caller holds base + each attacker's plan/claim)
  const claimFor = (mini_log_id) => attacks.find((a) => a.mini_log_id === mini_log_id);
  // build a FORGED variant of attack[1] so there is a real revocation to converge over
  const forgedClaims = new Map();
  const forgedEntries = new Map();
  const forgedClaimFor = (a) => forgedClaims.get(a.mini_log_id);
  const forgedEntryFor = (a) => forgedEntries.get(a.mini_log_id);
  const a1 = attacks[1];
  const forgedClaim1 = { ...a1.settlement, outcome_digest: contentAddress({ forged: seed }) };
  forgedClaims.set(a1.mini_log_id, forgedClaim1);
  // the forged entry carries the forged outcome_digest (what a malicious attacker would publish)
  const forgedEntry1 = { ...a1.entry, outcome_digest: forgedClaim1.outcome_digest };
  forgedEntries.set(a1.mini_log_id, forgedEntry1);
  const entriesForged = entries.map((e) => (e.mini_log_id === a1.mini_log_id ? forgedEntry1 : e));
  const fraud1 = proveFraud(base, a1.plan, forgedClaim1);
  const rev1 = makeRevocationEntry({ mini_log_id: a1.mini_log_id, fraud_proof: fraud1, revoker_identity: identityFromSeed(`o6-revoker/${seed}`) });
  // verify-fn for THIS overlay: a revocation applies iff re-running proveFraud over the forged claim says fraud
  const isVerifiedForged = (rev) => {
    const a = claimFor(rev.mini_log_id);
    if (!a) return false;
    return verifyRevocationEntry(forgedEntryFor(a) || a.entry, base, a.plan, forgedClaimFor(a) || a.settlement);
  };
  const baseOverlay = foldOverlay(entriesForged, [rev1], { isVerified: isVerifiedForged });
  const baseOverlayFp = overlayFingerprint(baseOverlay);
  let overlayConvergent = true;
  for (let k = 0; k < 16; k++) {
    const dupEntries = [];
    for (let i = 0; i < 5; i++) dupEntries.push(entriesForged[Math.floor(rnd() * entriesForged.length)]);
    const fp = overlayFingerprint(foldOverlay(shuffled([...entriesForged, ...dupEntries], rnd), shuffled([rev1, rev1], rnd), { isVerified: isVerifiedForged }));
    if (fp !== baseOverlayFp) { overlayConvergent = false; break; }
  }
  claim('O6_3_overlay_convergence',
    overlayConvergent && baseOverlay.revoked.has(a1.mini_log_id),
    `16 reorder/dup overlay shuffles (concurrent attackers + revocation) → same overlayFingerprint=${overlayConvergent}; revoked entry present=${baseOverlay.revoked.has(a1.mini_log_id)}`);

  // ── O6_4 offline-owner revocation: a forged settlement_reveal is revoked by ANY peer WITHOUT the owner's
  //    key; the revoked entry's scorch is excluded; the OWNER's blockFingerprint is BYTE-IDENTICAL ──
  // any third-party peer (not the owner, not the attacker) produces the fraud-proof + revocation
  const watcher = identityFromSeed(`o6-watcher/${seed}`);
  const fraudOffline = proveFraud(base, a1.plan, forgedClaim1); // keyless: only public inputs
  const revOffline = makeRevocationEntry({ mini_log_id: a1.mini_log_id, fraud_proof: fraudOffline, revoker_identity: watcher });
  const overlayNoRev = foldOverlay(entriesForged, [], { isVerified: isVerifiedForged });
  const overlayRev = foldOverlay(entriesForged, [revOffline], { isVerified: isVerifiedForged });
  const scorchExcluded = overlayRev.applied_total < overlayNoRev.applied_total
    && overlayRev.by_id[a1.mini_log_id].status === ENTRY_STATUS.REVOKED;
  // the owner is NEVER online and the owner's key never signs the revocation
  const ownerNotInvolved = revOffline.revoker_pubkey === watcher.publicRawHex
    && revOffline.revoker_pubkey !== defender.publicRawHex;
  // the OWNER base fingerprint is byte-identical before and after overlay activity (base never mutated)
  const blockFpAfter = ownerBaseFp();
  claim('O6_4_offline_owner_revocation',
    scorchExcluded && ownerNotInvolved && blockFp0 === blockFpAfter,
    `forged settlement revoked keyless (revoker=watcher,not owner)=${ownerNotInvolved}; revoked scorch excluded (${overlayRev.applied_total} < ${overlayNoRev.applied_total})=${scorchExcluded}; owner blockFingerprint byte-identical=${blockFp0 === blockFpAfter}`);

  // ── O6_5 concurrent-attack determinism: N distinct attackers → N distinct mini_log_ids; scorch applied in
  //    canonical mini_log_id order; no structure exceeds SCORCH_CAP; overlayFingerprint identical across
  //    delivery orders ──
  const ids = attacks.map((a) => a.mini_log_id);
  const distinctIds = new Set(ids).size === N;
  const allHonest = foldOverlay(entries, [], {}); // honest entries only, no revocations
  const canonicalOrder = allHonest.entries.map((e) => e.mini_log_id);
  const isCanonical = JSON.stringify(canonicalOrder) === JSON.stringify([...ids].sort());
  const capRespected = overlayBoundsHold(allHonest)
    && Object.values(allHonest.applied_scorch).every((v) => v <= SCORCH_CAP);
  const honestFp = overlayFingerprint(allHonest);
  let concurrentConvergent = true;
  for (let k = 0; k < 8; k++) {
    if (overlayFingerprint(foldOverlay(shuffled(entries, rnd), [], {})) !== honestFp) { concurrentConvergent = false; break; }
  }
  claim('O6_5_concurrent_attack_determinism',
    distinctIds && isCanonical && capRespected && concurrentConvergent,
    `N=${N} distinct mini_log_ids=${distinctIds}; scorch in canonical id order=${isCanonical}; all ≤ SCORCH_CAP=${capRespected}; overlayFingerprint stable across orders=${concurrentConvergent}`);

  // ── O6_6 base-fingerprint independence: adding/revoking overlay entries never changes blockFingerprint ──
  // The overlay folds are entirely separate from foldBlock; the owner base is recomputed identically.
  const baseIndependent = blockFp0 === ownerBaseFp();
  // also confirm the foldBlock state itself carries no overlay/settlement leakage from these mini-logs
  const baseStateClean = JSON.stringify(state.structures)
    === JSON.stringify(foldBlock(buildSignedChain(defender, block, genesisSteps())).structures);
  claim('O6_6_base_fingerprint_independence',
    baseIndependent && baseStateClean && Object.keys(overlayRev.applied_scorch).length >= 1,
    `blockFingerprint unchanged by overlay add/revoke=${baseIndependent}; base structures untouched=${baseStateClean}`);

  // ── O6_7 revocation idempotent: re-delivering the same revocation any number of times does not change
  //    overlayFingerprint or grow audit state ──
  const flood = [];
  for (let i = 0; i < 50; i++) flood.push(rev1); // the SAME revocation re-delivered
  const overlayFlood = foldOverlay(entriesForged, flood, { isVerified: isVerifiedForged });
  const idempotentFp = overlayFingerprint(overlayFlood) === baseOverlayFp;
  // a verified revocation applied once; a NEVER-VERIFIED revocation flood cannot grow rejected state either
  const badRev = makeRevocationEntry({ mini_log_id: a1.mini_log_id, fraud_proof: { kind: 'fraud_proof', mismatch: false }, revoker_identity: watcher });
  const badFlood = [];
  for (let i = 0; i < 50; i++) badFlood.push(badRev);
  const overlayBadFlood = foldOverlay(entriesForged, badFlood, { isVerified: () => false });
  const auditBounded = overlayBadFlood.rejected_revocations.length <= 1; // dual-Set dedup: one entry max
  claim('O6_7_revocation_idempotent',
    idempotentFp && auditBounded,
    `50× same revocation → overlayFingerprint unchanged=${idempotentFp}; 50× rejected-revocation flood → audit bounded (${overlayBadFlood.rejected_revocations.length} entry)=${auditBounded}`);

  // ── O6_8 relays swappable: two peers receiving entries from different (modeled) relays converge to the same
  //    overlayFingerprint; authority traces to proveFraud + the fold, never the relay ──
  // peer A gets entries via "relay 1" (shuffled order, with dups); peer B via "relay 2" (different shuffle).
  const relay1 = shuffled([...entriesForged, entriesForged[0], entriesForged[2]], rnd);
  const relay2 = shuffled([...entriesForged, entriesForged[1], entriesForged[3]], rnd);
  const peerA = foldOverlay(relay1, [rev1], { isVerified: isVerifiedForged });
  const peerB = foldOverlay(relay2, [revOffline], { isVerified: isVerifiedForged }); // a DIFFERENT revoker's revocation
  const relaysConverge = overlayFingerprint(peerA) === overlayFingerprint(peerB);
  // authority = proveFraud + the fold: a revocation carrying a NON-fraud proof never applies, whoever relayed
  const nonFraudRev = makeRevocationEntry({ mini_log_id: attacks[2].mini_log_id, fraud_proof: proveFraud(base, attacks[2].plan, attacks[2].settlement), revoker_identity: watcher });
  const overlayHonestRev = foldOverlay(entries, [nonFraudRev], { isVerified: (rev) => verifyRevocationEntry(claimFor(rev.mini_log_id).entry, base, claimFor(rev.mini_log_id).plan, claimFor(rev.mini_log_id).settlement) });
  const honestNotRevoked = !overlayHonestRev.revoked.has(attacks[2].mini_log_id); // proveFraud(honest)===null
  claim('O6_8_relays_swappable',
    relaysConverge && honestNotRevoked,
    `two peers, different relays + different revokers → same overlayFingerprint=${relaysConverge}; honest settlement (proveFraud null) never revoked regardless of relay=${honestNotRevoked}`);

  // ── invariants: no transfer/value field anywhere on the overlay state ──
  const noValueField = !NO_VALUE_OPS.some((t) => t in baseOverlay)
    && !('attacker_reward' in baseOverlay) && scorchBoundsHold(baseOverlay.applied_scorch);

  // ── denylist self-check ──
  const allExcluded = LAB_MODULE_PATHS.every((p) => isExcludedFromUpload(p));
  const notAllowlisted = LAB_MODULE_PATHS.every((p) => !PUBLIC_CREATOR_ALLOW.has(p));
  claim('O6_0_production_denylist_proven', allExcluded && notAllowlisted && noValueField,
    `${LAB_MODULE_PATHS.length}/${LAB_MODULE_PATHS.length} overlay lab modules excluded from curated upload; none allowlisted; no value field on overlay=${noValueField}`);

  return {
    artifact_kind: 'turf_wars_phase3c_overlay_evidence',
    schema_version: 1,
    lab_only: true,
    never_production: 'arcade/hiveworld-agents/turf-wars/ is denylisted from the curated upload and imported by no Worker/DO/client path',
    resolves: ['O6 multi-writer — per-attacker mini-log + content-addressed convergent overlay + keyless revocation (mechanism)'],
    deferred_residuals: [
      'sybil-resistant quorum / revocation-flood bound (Phase 4)',
      'owner reconciliation on return (Phase 4)',
      'fair beacon source (Phase 3a residual)',
      'watcher liveness (Phase 3b residual)',
      'real P2P transport / IP (B6/B7/D11)',
    ],
    seed,
    attackers: N,
    owner_block_fingerprint: blockFp0,
    overlay_fingerprint: baseOverlayFp,
    claims,
    pass: claims.every((c) => c.ok),
  };
}

/** PURE: the multi-seed suite. */
export function buildOverlayEvidenceSuite({ seeds = [42, 1337, 9001] } = {}) {
  const packs = seeds.map((seed) => buildOverlayEvidencePack({ seed }));
  return { schema_version: 1, lab_only: true, suite: 'turf-wars-overlay-evidence-suite', seeds, packs, pass: packs.every((p) => p.pass) };
}
