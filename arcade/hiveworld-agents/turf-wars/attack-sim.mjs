/**
 * Turf Wars — Phase 2 FOUNDATION (lab) · DETERMINISTIC ATTACK SIMULATOR + FRAUD-PROOF PRIMITIVE (pure).
 *
 * ⚠️ LAB ONLY — see attack-plan.mjs header. No production exposure / live combat / minors-facing use.
 *
 * The keystone of refereeless settlement: an attack outcome is a PURE, DETERMINISTIC function of three
 * public, signed inputs — the defender's content-addressed, host-signed base snapshot (immutable), the
 * attacker's signed attack plan, and a settlement seed:
 *
 *     simulateAttack(baseSnapshotRecord, signedAttackPlan, seed) -> { ok, outcome | reason }
 *
 * Anyone holding the three inputs recomputes the identical outcome — so `verifyAttackOutcome` is a
 * one-op FRAUD-PROOF primitive: a forged outcome digest fails recomputation. Authority = replay
 * determinism (the same property as the Phase-1 fold), no referee.
 *
 * O1/O2 SEAMS (built around, never baked in):
 *  - The `seed` is an explicit PARAMETER. *How* it is derived so neither party can grind it
 *    (commit-reveal) is **O1 — deferred**; this module only requires a closed seed string and is
 *    deterministic given it.
 *  - This module provides the fraud-proof *computation*. *When/who/within-what-window* a fraud-proof
 *    must be raised (esp. for an OFFLINE victim) is **O2 — deferred**; no liveness/timing/settlement is
 *    built here. The outcome mutates no block state — it is data a (future, gated) settlement layer
 *    would consume.
 *
 * Hard invariants (independent of O1/O2): the base snapshot is never mutated; scorch is bounded and
 * reversible (scorch.mjs); there is no transfer/cash-out — the attacker's reward is a bounded number in
 * the outcome, minted by nothing here; a defender's structures and counters are never moved or deleted.
 */
import { contentAddress, sha256Hex } from './canonical.mjs';
import { verifySnapshot } from './snapshot.mjs';
import { verifyAttackPlan } from './attack-plan.mjs';
import { SCORCH_CAP } from './scorch.mjs';

export const ATTACK_OUTCOME_VERSION = 1;

// Deterministic, bounded tuning — small on purpose; an attack is cosmetic and self-healing.
const INTENSITY_SCALE = 20;     // base pressure per intensity point (1->20, 2->40, 3->60)
const LEVEL_MITIGATION = 5;     // each structure level absorbs this much pressure
const DECOY_MITIGATION = 8;     // each defense_decoy in the block absorbs this much (count capped)
const MAX_DECOYS_COUNTED = 4;   // decoy mitigation is bounded
const REWARD_DIVISOR = 10;      // attacker reward = floor(total_scorch / REWARD_DIVISOR), capped
const REWARD_CAP = 25;          // bounded, non-cash

/** Tiny deterministic PRNG (mulberry32) — same family as the Phase-1 evidence pack; no entropy source. */
function lcg(seedInt) {
  let a = seedInt >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** PURE: derive a deterministic 32-bit LCG seed from the closed seed string (provenance = O1, deferred). */
function seedToInt(seed) {
  return parseInt(sha256Hex(`turf-wars/attack/${String(seed)}`).slice(0, 8), 16) >>> 0;
}

/**
 * PURE: precondition check, separate from the computation so callers can ask "is this attack even
 * admissible?" independently. Returns null if (base snapshot verifies) AND (plan verifies) AND (the plan
 * targets exactly this snapshot's address and block); else a reason.
 */
export function attackRejection(baseRecord, plan) {
  const snapReason = verifySnapshot(baseRecord);
  if (snapReason) return `bad_base_snapshot:${snapReason}`;
  const planReason = verifyAttackPlan(plan);
  if (planReason) return `bad_plan:${planReason}`;
  if (plan.base_address !== baseRecord.address) return 'plan_base_mismatch';
  if (plan.target_block !== baseRecord.snapshot.block_id) return 'plan_block_mismatch';
  return null;
}

/**
 * PURE: simulate an attack. Returns { ok:false, reason } if preconditions fail, else { ok:true, outcome,
 * digest }. The outcome is a deterministic, bounded scorch map; `digest` is its content address (the
 * value an attacker would publish in a `record_attack_result` op, and the value a fraud-proof checks).
 */
export function simulateAttack(baseRecord, plan, seed) {
  const reason = attackRejection(baseRecord, plan);
  if (reason) return { ok: false, reason };
  if (typeof seed !== 'string' || !seed) return { ok: false, reason: 'bad_seed' };

  const structures = baseRecord.snapshot.structures || {};
  const decoyCount = Math.min(
    MAX_DECOYS_COUNTED,
    Object.values(structures).filter((s) => s.kind === 'defense_decoy').length,
  );
  const decoyMitigation = decoyCount * DECOY_MITIGATION;

  const rnd = lcg(seedToInt(seed));
  const scorch = {};
  for (const move of plan.moves) {
    const target = structures[move.structure_id];
    // a seeded roll decides whether the move lands full or glancing — bounded variation, seed-dependent
    const landed = rnd() < 0.5 ? 0.5 : 1.0;
    if (!target) continue; // miss: targeting a non-existent structure does nothing (no error, no scorch)
    const pressure = move.intensity * INTENSITY_SCALE * landed;
    const mitigation = target.level * LEVEL_MITIGATION + decoyMitigation;
    const dealt = Math.max(0, Math.round(pressure - mitigation));
    if (dealt <= 0) continue;
    scorch[move.structure_id] = Math.min(SCORCH_CAP, (scorch[move.structure_id] || 0) + dealt);
  }

  const totalScorch = Object.values(scorch).reduce((a, v) => a + v, 0);
  const attackerReward = Math.min(REWARD_CAP, Math.floor(totalScorch / REWARD_DIVISOR));

  const outcome = {
    v: ATTACK_OUTCOME_VERSION,
    lab_only: true,
    base_address: baseRecord.address,
    plan_hash: plan.hash,
    seed,
    scorch,
    total_scorch: totalScorch,
    attacker_reward: attackerReward, // bounded, non-cash; minted by NOTHING here (settlement = O1/O2 deferred)
  };
  return { ok: true, outcome, digest: contentAddress(outcome) };
}

/**
 * PURE: the one-op FRAUD-PROOF primitive. Recompute the outcome from the public inputs and compare its
 * digest to the claimed one. Returns true iff the claim is honest. (The liveness/timing of *raising* a
 * fraud-proof — especially against an offline victim — is O2, deferred; this is only the computation.)
 */
export function verifyAttackOutcome(baseRecord, plan, seed, claimedDigest) {
  const res = simulateAttack(baseRecord, plan, seed);
  if (!res.ok) return false;
  return res.digest === claimedDigest;
}
