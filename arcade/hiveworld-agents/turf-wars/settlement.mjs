/**
 * Turf Wars — Phase 2 SETTLEMENT (lab) · COMMIT-REVEAL SEED (O1) + DELEGABLE FRAUD-PROOF (O2). Pure.
 *
 * ⚠️ LAB ONLY — see attack-plan.mjs / canonical.mjs headers. `arcade/hiveworld-agents/` is denylisted
 * from the curated production upload and imported by no Worker/DO/client path. This authorizes nothing
 * live: no live combat, no minors-facing use, no economy, no production exposure. The roadmap stays
 * DRAFT/DESIGN-ONLY and Phase 0 legal/safety counsel remains BLOCKING for any live or minors-facing use.
 *
 * This is the settlement layer designed in docs/TURF_WARS_O1_O2_SETTLEMENT_DESIGN.md. It closes the two
 * open settlement decisions of the Phase-2 plan, as MECHANISMS (with honest residuals deferred to Phase
 * 3/4 — the beacon source and honest-peer availability):
 *
 *  O1 — settlement seed (closes D5, grind resistance). A TWO-PHASE commit-reveal with a post-commit
 *  beacon. The attacker first folds an `attack_commit` op carrying seed_commit = sha256(attacker_seed) —
 *  with NO reveal and NO beacon — at an EARLIER seq; only then can a `settle_attack` reveal it (the fold
 *  REJECTS a settle_attack with no matching prior commit as `no_prior_commit`). The settlement seed binds
 *  (base_address, plan_hash, attacker_seed, beacon); a reveal is accepted only if sha256(reveal) ===
 *  seed_commit. So the attacker is structurally LOCKED to one seed chosen at commit time, before the
 *  beacon is known — they cannot forward-enumerate reveals against a known beacon. The defender
 *  contributes nothing choosable. (Residual: that the `beacon` is fixed AFTER the commit and is
 *  party-uncontrolled — a fair beacon SOURCE — is Phase 3/4; here `beacon` is an explicit input.)
 *
 *  O2 — fraud-proof liveness (closes D7, offline victim). The outcome is a PURE function of public,
 *  signed inputs, so verification/challenge is DELEGABLE: any peer holding the defender's signed snapshot
 *  can recompute and, on mismatch, produce a one-op fraud-proof — the victim need not be online.
 *  (Residual: that >=1 honest peer is watching within the challenge window is Phase 3 availability.)
 *
 * Hard invariants (unchanged): the base snapshot is never mutated; the only effect is bounded, reversible,
 * cosmetic scorch (scorch.mjs); no transfer/cash-out op exists; `attacker_reward` is a bounded non-cash
 * number credited to NOTHING (block-collective recognition only — ADR-009 / Phase 9 doctrine).
 */
import { sha256Hex } from './canonical.mjs';
import { simulateAttack } from './attack-sim.mjs';
import { makeOp } from './ops.mjs';

export const SETTLE_VERSION = 1;
export const SEED_TOKEN_RE = /^[0-9a-f]{16,64}$/; // attacker_seed / beacon: closed hex tokens

/** PURE: the attacker's seed commitment = sha256(attacker_seed) (a 64-hex string). Published BEFORE the
 * beacon exists, so the attacker is bound to one seed chosen without knowledge of the beacon. */
export function makeSeedCommit(seedReveal) {
  return sha256Hex(String(seedReveal));
}

/** PURE: a reveal is valid iff it is a closed hex token AND sha256(reveal) === the commit. */
export function verifySeedReveal(commit, reveal) {
  if (typeof commit !== 'string' || !/^[0-9a-f]{64}$/.test(commit)) return false;
  if (typeof reveal !== 'string' || !SEED_TOKEN_RE.test(reveal)) return false;
  return makeSeedCommit(reveal) === commit;
}

/** PURE: derive the single settlement seed from the four bound inputs. Neither party can grind it: the
 * attacker committed `seed_reveal` before `beacon` existed, and the defender contributes nothing here. */
export function deriveSettlementSeed({ base_address, plan_hash, seed_reveal, beacon }) {
  return sha256Hex(`turf-wars/settle/v1|${base_address}|${plan_hash}|${seed_reveal}|${beacon}`);
}

/**
 * PURE: settle an attack. Validates the closed seed tokens, derives the bound settlement seed, and runs
 * the existing deterministic simulator. Returns { ok:false, reason } if a precondition fails, else
 * { ok:true, settlement } where `settlement` is the full, recomputable settlement record. The settlement
 * mutates nothing — it is data a fold (settle_attack) or a verifier consumes.
 */
export function settleAttack(baseRecord, plan, { seed_reveal, beacon } = {}) {
  if (typeof seed_reveal !== 'string' || !SEED_TOKEN_RE.test(seed_reveal)) return { ok: false, reason: 'bad_seed_reveal' };
  if (typeof beacon !== 'string' || !SEED_TOKEN_RE.test(beacon)) return { ok: false, reason: 'bad_beacon' };
  const settlement_seed = deriveSettlementSeed({ base_address: baseRecord.address, plan_hash: plan.hash, seed_reveal, beacon });
  const sim = simulateAttack(baseRecord, plan, settlement_seed);
  if (!sim.ok) return { ok: false, reason: sim.reason };
  return {
    ok: true,
    settlement: {
      v: SETTLE_VERSION,
      base_address: baseRecord.address,
      plan_hash: plan.hash,
      seed_commit: makeSeedCommit(seed_reveal),
      seed_reveal,
      beacon,
      settlement_seed,
      scorch: sim.outcome.scorch,
      total_scorch: sim.outcome.total_scorch,
      attacker_reward: sim.outcome.attacker_reward, // bounded, non-cash; credited to NOTHING (see fold)
      outcome_digest: sim.digest,
    },
  };
}

/**
 * PURE, DELEGABLE (O2): verify a settlement CLAIM using only the public, signed inputs — no defender
 * participation required. Any peer holding the defender's signed snapshot + the attacker's plan can run
 * this. Returns true iff the claim's commit↔reveal hold AND recomputing yields the same seed + digest.
 */
export function verifySettlement(baseRecord, plan, claim) {
  if (!claim || typeof claim !== 'object') return false;
  if (!verifySeedReveal(claim.seed_commit, claim.seed_reveal)) return false;
  const re = settleAttack(baseRecord, plan, { seed_reveal: claim.seed_reveal, beacon: claim.beacon });
  return re.ok
    && re.settlement.settlement_seed === claim.settlement_seed
    && re.settlement.outcome_digest === claim.outcome_digest;
}

/**
 * PURE, DELEGABLE (O2): the one-op FRAUD-PROOF. Any peer recomputes the honest settlement from the public
 * inputs and compares it to the claim. Returns a fraud-proof object if the claim is forged (or its inputs
 * are invalid), else null. A truthful-but-offline defender is protected because ANY peer can run this.
 */
export function proveFraud(baseRecord, plan, claim) {
  if (!claim || typeof claim !== 'object') return { kind: 'fraud_proof', reason: 'malformed_claim', mismatch: true };
  if (!verifySeedReveal(claim.seed_commit, claim.seed_reveal)) {
    return { kind: 'fraud_proof', reason: 'bad_commit_reveal', claimed_digest: claim.outcome_digest, mismatch: true };
  }
  const honest = settleAttack(baseRecord, plan, { seed_reveal: claim.seed_reveal, beacon: claim.beacon });
  if (!honest.ok) {
    return { kind: 'fraud_proof', reason: honest.reason, claimed_digest: claim.outcome_digest, mismatch: true };
  }
  if (honest.settlement.outcome_digest !== claim.outcome_digest) {
    return { kind: 'fraud_proof', honest_digest: honest.settlement.outcome_digest, claimed_digest: claim.outcome_digest, mismatch: true };
  }
  return null; // claim is honest — no fraud
}

/** Build a signed `attack_commit` op — the attacker's binding commitment, folded BEFORE its settle_attack
 * (O1 temporal ordering). Carries seed_commit only; no reveal, no beacon. */
export function makeCommitOp(identity, { block_id, prev, seq, tick }, { base_address, plan_hash, seed_commit }) {
  return makeOp(identity, {
    block_id, prev, seq, tick, type: 'attack_commit',
    payload: { base_address, plan_hash, seed_commit },
  });
}

/** Build a signed `settle_attack` op carrying a settlement (the optimistic, fold-applied settlement op). */
export function makeSettleOp(identity, { block_id, prev, seq, tick }, settlement) {
  return makeOp(identity, {
    block_id, prev, seq, tick, type: 'settle_attack',
    payload: {
      base_address: settlement.base_address,
      plan_hash: settlement.plan_hash,
      seed_commit: settlement.seed_commit,
      seed_reveal: settlement.seed_reveal,
      beacon: settlement.beacon,
      scorch: settlement.scorch,
      outcome_digest: settlement.outcome_digest,
    },
  });
}
