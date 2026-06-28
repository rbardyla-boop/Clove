/**
 * Turf Wars — Phase 2 SETTLEMENT (lab) · EVIDENCE PACK (pure, deterministic). RESOLVES D5 + D7.
 *
 * ⚠️ LAB ONLY — see settlement.mjs header. Denylisted from the curated upload; imported by no production
 * path. Mirrors the foundation's attack-evidence harness: fixture identities + a seeded settlement, every
 * claim a { id, ok, detail }, the pack PASS iff all hold.
 *
 * The foundation's attack-evidence pack DEFERRED two claims to the open settlement decisions:
 *   D5 seed-grinding resistance  -> O1 (commit-reveal seed binding)
 *   D7 offline-victim liveness    -> O2 (delegable fraud-proof)
 * This pack RESOLVES both as MECHANISMS (design: docs/TURF_WARS_O1_O2_SETTLEMENT_DESIGN.md), and proves
 * the settlement's hard invariants (cosmetic/reversible scorch, base untouched, no value transfer). The
 * honest residuals — a fair party-uncontrolled beacon SOURCE (O1) and honest-peer availability within the
 * challenge window (O2) — are Phase 3/4 and are NOT claimed here.
 */
import { identityFromSeed } from './identity.mjs';
import { canonicalize, contentAddress } from './canonical.mjs';
import { OP_TYPES } from './ops.mjs';
import { foldBlock } from './block-log.mjs';
import { signSnapshot } from './snapshot.mjs';
import { makeAttackPlan } from './attack-plan.mjs';
import {
  settleAttack, makeCommitOp, makeSettleOp, verifySettlement, proveFraud, makeSeedCommit, verifySeedReveal,
} from './settlement.mjs';
import { decayScorch, ticksToHeal, scorchBoundsHold } from './scorch.mjs';
import { buildSignedChain, blockIdFor, structureId } from './turf-evidence.mjs';

/** The Phase-2 settlement lab modules — for the denylist self-check. */
export const SETTLEMENT_LAB_MODULE_PATHS = Object.freeze([
  'arcade/hiveworld-agents/turf-wars/settlement.mjs',
  'arcade/hiveworld-agents/turf-wars/settlement-evidence.mjs',
]);

const NO_VALUE_OPS = ['transfer', 'cash_out', 'sell', 'buy', 'trade', 'payout'];

/** PURE: a defender block (signage + resource_node), its signed base snapshot, and the genesis chain. */
function defenderFixture(seed) {
  const defender = identityFromSeed(`settle-def/${seed}`);
  const block = blockIdFor(defender);
  const chain = buildSignedChain(defender, block, [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
    { type: 'build_structure', payload: { structure_id: structureId('node'), kind: 'resource_node', x: 2, y: 2 }, tick: 2 },
  ]);
  const state = foldBlock(chain);
  return { defender, block, chain, state, base: signSnapshot(defender, state) };
}

/** PURE: build the settlement D-matrix evidence pack for a seed. */
export function buildSettlementEvidencePack({ seed = 42 } = {}) {
  const { defender, block, chain, state, base } = defenderFixture(seed);
  const attacker = identityFromSeed(`settle-atk/${seed}`);
  const seedReveal = contentAddress({ seed }).slice(7, 7 + 32); // a closed hex token (attacker's secret)
  const beacon = contentAddress({ beacon: seed }).slice(7, 7 + 16); // post-commit beacon (O1 residual = input)
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  const plan = makeAttackPlan(attacker, {
    target_block: block, base_address: base.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('sign'), intensity: 3 }, { structure_id: structureId('sign'), intensity: 3 }],
  });

  // honest settlement
  const st = settleAttack(base, plan, { seed_reveal: seedReveal, beacon });

  // ── S1 settlement deterministic; recompute matches; commit verifies ──
  const st2 = settleAttack(base, plan, { seed_reveal: seedReveal, beacon });
  claim('S1_settlement_deterministic',
    st.ok && st2.ok && st.settlement.outcome_digest === st2.settlement.outcome_digest
      && verifySeedReveal(st.settlement.seed_commit, seedReveal),
    `ok=${st.ok}; recompute digest match; seed_commit verifies reveal`);

  // ── D5 (RESOLVED) seed grinding resistance: commit-BEFORE-settle is ENFORCED in-fold; reveal must match
  //    commit; a post-commit beacon binds the seed (so a committed attacker cannot enumerate reveals) ──
  const wrongReveal = verifySeedReveal(st.settlement.seed_commit, 'ffffffffffffffff') === false;
  const stOtherBeacon = settleAttack(base, plan, { seed_reveal: seedReveal, beacon: '00000000ffffffff' });
  const beaconBinds = stOtherBeacon.ok && stOtherBeacon.settlement.outcome_digest !== st.settlement.outcome_digest;
  const commitBindsReveal = makeSeedCommit(seedReveal) === st.settlement.seed_commit;
  // a settle_attack with NO prior attack_commit fails to fold (no_prior_commit) — the temporal-ordering invariant
  const noCommitSettle = makeSettleOp(defender, { block_id: block, prev: chain[chain.length - 1].hash, seq: chain.length, tick: chain.length }, st.settlement);
  const noCommitState = foldBlock([...chain, noCommitSettle]);
  const orderingEnforced = !noCommitState.applied.includes(noCommitSettle.hash)
    && noCommitState.econ_rejected.some((r) => r.ref === noCommitSettle.hash && r.reason === 'no_prior_commit')
    && Object.keys(noCommitState.scorch).length === 0;
  claim('D5_seed_grinding_resistant',
    wrongReveal && beaconBinds && commitBindsReveal && orderingEnforced,
    `commit-before-settle enforced (no prior commit -> no_prior_commit)=${orderingEnforced}; reveal!=commit rejected=${wrongReveal}; post-commit beacon changes outcome=${beaconBinds}`);

  // ── S5 O2 delegable verify: a THIRD party (neither attacker nor defender) verifies with public inputs only ──
  const thirdPartyVerifies = verifySettlement(base, plan, st.settlement);
  claim('S5_delegable_verify',
    thirdPartyVerifies && proveFraud(base, plan, st.settlement) === null,
    `any peer verifies honest settlement from public inputs=${thirdPartyVerifies}; no false fraud`);

  // ── D7 (RESOLVED) offline-victim liveness: a forged settlement is caught by a THIRD party (no victim online) ──
  const forged = { ...st.settlement, outcome_digest: contentAddress({ forged: true }) };
  const fraud = proveFraud(base, plan, forged); // produced by any peer holding the public inputs
  const honestNoFraud = proveFraud(base, plan, st.settlement) === null;
  claim('D7_offline_victim_liveness',
    !!fraud && fraud.mismatch === true && fraud.honest_digest === st.settlement.outcome_digest && honestNoFraud,
    `forged offline settlement -> third-party fraud-proof=${!!fraud}; honest -> no fraud=${honestNoFraud}`);

  // ── S7 settle_attack folds (after its prior attack_commit): scorch applied (bounded), recorded;
  //    base/counters/structures UNCHANGED ──
  const head = chain[chain.length - 1].hash;
  const commitOp = makeCommitOp(defender, { block_id: block, prev: head, seq: chain.length, tick: chain.length },
    { base_address: st.settlement.base_address, plan_hash: st.settlement.plan_hash, seed_commit: st.settlement.seed_commit });
  const op = makeSettleOp(defender, { block_id: block, prev: commitOp.hash, seq: chain.length + 1, tick: chain.length + 1 }, st.settlement);
  const settled = foldBlock([...chain, commitOp, op]);
  const baseUnchanged = canonicalize(signSnapshot(defender, foldBlock(chain))) === canonicalize(base);
  const countersUnchanged = settled.counters.flux === state.counters.flux && settled.counters.cores === state.counters.cores;
  const structsUnchanged = JSON.stringify(settled.structures) === JSON.stringify(state.structures);
  claim('S7_settle_applies_bounded_scorch_only',
    settled.applied.includes(op.hash) && settled.settlements.length === 1 && scorchBoundsHold(settled.scorch)
      && Object.keys(settled.scorch).length >= 1 && baseUnchanged && countersUnchanged && structsUnchanged,
    `scorch=${JSON.stringify(settled.scorch)}; base/counters/structures unchanged=${baseUnchanged && countersUnchanged && structsUnchanged}`);

  // ── D8 (settlement) scorch reversible: the folded scorch self-heals to empty ──
  claim('D8_settled_scorch_reversible',
    Object.keys(decayScorch(settled.scorch, ticksToHeal(settled.scorch))).length === 0,
    `folded scorch fully self-heals in ${ticksToHeal(settled.scorch)} ticks`);

  // ── D9 (settlement) no value transfer: no transfer op exists; attacker_reward credited to NO counter ──
  const noTransferOp = !NO_VALUE_OPS.some((t) => OP_TYPES.includes(t));
  const rewardCreditedToNothing = settled.counters.flux === state.counters.flux && settled.counters.cores === state.counters.cores
    && !('attacker_reward' in settled) && !('reward' in settled.counters);
  claim('D9_settlement_no_value_transfer',
    noTransferOp && rewardCreditedToNothing && st.settlement.attacker_reward <= 25,
    `no transfer/cash op=${noTransferOp}; attacker_reward=${st.settlement.attacker_reward} credited to NOTHING=${rewardCreditedToNothing}`);

  // ── S10 a bad commit-reveal binding fails to fold (prior commit exists, but reveal != commit) ──
  const badReveal = { ...st.settlement, seed_reveal: 'deadbeefdeadbeef' }; // sha256 != seed_commit
  const badOp = makeSettleOp(defender, { block_id: block, prev: commitOp.hash, seq: chain.length + 1, tick: chain.length + 1 }, badReveal);
  const badState = foldBlock([...chain, commitOp, badOp]);
  claim('S10_bad_commit_reveal_rejected',
    !badState.applied.includes(badOp.hash)
      && badState.econ_rejected.some((r) => r.ref === badOp.hash && r.reason === 'bad_seed_commit')
      && Object.keys(badState.scorch).length === 0,
    `reveal!=commit -> econ-rejected bad_seed_commit; no scorch applied`);

  return {
    artifact_kind: 'turf_wars_phase2_settlement_evidence',
    schema_version: 1,
    lab_only: true,
    never_production: 'arcade/hiveworld-agents/turf-wars/ is denylisted from the curated upload and imported by no Worker/DO/client path',
    resolves: [
      'D5_seed_grinding (foundation deferred -> O1 commit-reveal + post-commit beacon binding)',
      'D7_offline_victim_liveness (foundation deferred -> O2 delegable fraud-proof)',
    ],
    deferred_residuals: [
      'O1 beacon SOURCE — the commit-before-settle ORDERING is now enforced in-fold (no_prior_commit). The remaining O1 residual is the beacon: it must be fixed AFTER the commit op and be party-uncontrolled (a fair beacon: cross-block checkpoint / Phase-4 quorum). This INCLUDES the bounded multi-commit (K-of-N) vector — an attacker can plant several attack_commit ops with different seeds before the beacon and settle with the best one — so the fair-beacon definition must also specify WHEN the commit window closes relative to beacon publication. Phase 3/4; here `beacon` is an explicit input.',
      'O2 availability — that >=1 honest peer watches within the challenge window is the Phase-3 availability fabric',
      'O6 multi-writer — which writer commits the attack_commit/settle_attack ops into a shared log (single-writer here: the block owner) + concurrent-attack convergence + applying a fraud-proof revocation against an offline owner is Phase 3',
    ],
    seed,
    claims,
    pass: claims.every((c) => c.ok),
  };
}

/** PURE: the multi-seed suite. */
export function buildSettlementEvidenceSuite({ seeds = [42, 1337, 9001] } = {}) {
  const packs = seeds.map((seed) => buildSettlementEvidencePack({ seed }));
  return { schema_version: 1, lab_only: true, suite: 'turf-wars-settlement-evidence-suite', seeds, packs, pass: packs.every((p) => p.pass) };
}
