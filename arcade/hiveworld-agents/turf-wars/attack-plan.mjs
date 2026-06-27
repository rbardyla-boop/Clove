/**
 * Turf Wars — Phase 2 FOUNDATION (lab) · CLOSED ATTACK-PLAN VOCABULARY (pure, deterministic).
 *
 * ⚠️ LAB ONLY. `arcade/hiveworld-agents/` is denylisted from the curated production upload and imported
 * by no Worker/DO/client path. This is the O1/O2-AGNOSTIC foundation of Phase 2 of
 * docs/NEON_CIRCUIT_TURF_WARS_PHASE2_PLAN.md — it builds only the parts that do NOT depend on the two
 * open design decisions (O1 settlement-seed / commit-reveal, O2 fraud-proof liveness vs. offline
 * victim). It authorizes nothing live: no live combat, no minors-facing use, no economy, no production
 * exposure. The roadmap stays DRAFT/DESIGN-ONLY and Phase 0 legal/safety counsel remains BLOCKING for
 * any live or minors-facing use.
 *
 * An attack plan is a CLOSED-vocabulary, Ed25519-signed declaration: "attacker A intends these bounded
 * moves against defender block B's signed base snapshot." Same closed-vocab discipline as the Phase-1
 * op grammar — strict per-field schema + a forbidden-content scan, no free text / URL / code, bounded
 * move count and intensity. The plan does NOT itself settle anything; it is one of the three public
 * inputs to the deterministic attack simulator (attack-sim.mjs). The `nonce` is a uniqueness seam for
 * anti-replay; how a nonce/seed is bound so it cannot be ground is **O1, deferred**.
 */
import { contentAddress, isContentAddress } from './canonical.mjs';
import { signBytes, verifyBytes } from './identity.mjs';
import { scanForbidden, BLOCK_ID_RE, STRUCTURE_ID_RE } from './ops.mjs';

export const ATTACK_PLAN_VERSION = 1;

/** Closed move intensities and bounds — small on purpose; an attack is bounded and cosmetic. */
export const MOVE_INTENSITIES = Object.freeze([1, 2, 3]);
export const MAX_MOVES = 16;          // a plan cannot target unboundedly
export const NONCE_RE = /^[0-9a-f]{16,64}$/; // a closed hex token (provenance/binding = O1, deferred)

const isInt = (v) => Number.isInteger(v);

/** PURE: strict validation of a single move ({ structure_id, intensity } only). */
export function validateMove(move) {
  if (!move || typeof move !== 'object' || Array.isArray(move)) return 'move_not_object';
  const keys = Object.keys(move);
  if (keys.length !== 2 || !keys.includes('structure_id') || !keys.includes('intensity')) return 'move_shape';
  if (!STRUCTURE_ID_RE.test(move.structure_id)) return 'bad_structure_id';
  if (!isInt(move.intensity) || !MOVE_INTENSITIES.includes(move.intensity)) return 'bad_intensity';
  return null;
}

/** PURE: the signable core of an attack plan (everything the hash + signature commit to). */
export function attackPlanCore({ target_block, base_address, moves, nonce, actor }) {
  return { v: ATTACK_PLAN_VERSION, target_block, base_address, moves, nonce, actor };
}

/** PURE: the content-address hash of an attack plan core. */
export function hashAttackPlan(core) {
  return contentAddress(core);
}

/** Build a fully-signed attack plan from an attacker identity. */
export function makeAttackPlan(identity, { target_block, base_address, moves, nonce }) {
  const core = attackPlanCore({ target_block, base_address, moves, nonce, actor: identity.publicRawHex });
  const hash = hashAttackPlan(core);
  const sig = signBytes(identity.privateKey, hash);
  return { ...core, hash, sig };
}

/**
 * PURE: cryptographic + structural verification of an attack plan, independent of any base snapshot.
 * Returns null if well-formed, hash-consistent, and correctly signed by `actor`; else a reason.
 * ORIGIN + INTEGRITY + CLOSED-VOCAB only — whether the plan is *legal against a given base* is the
 * simulator's job (attack-sim.mjs).
 */
export function verifyAttackPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return 'malformed_plan';
  const ENVELOPE = ['v', 'target_block', 'base_address', 'moves', 'nonce', 'actor', 'hash', 'sig'];
  for (const k of Object.keys(plan)) if (!ENVELOPE.includes(k)) return 'unknown_plan_key';
  if (plan.v !== ATTACK_PLAN_VERSION) return 'bad_version';
  if (!BLOCK_ID_RE.test(plan.target_block || '')) return 'bad_target_block';
  if (!isContentAddress(plan.base_address)) return 'bad_base_address';
  if (typeof plan.nonce !== 'string' || !NONCE_RE.test(plan.nonce)) return 'bad_nonce';
  if (typeof plan.actor !== 'string' || !/^[0-9a-f]{64}$/.test(plan.actor)) return 'bad_actor';
  if (!Array.isArray(plan.moves) || plan.moves.length < 1 || plan.moves.length > MAX_MOVES) return 'bad_moves_count';
  for (const move of plan.moves) { const r = validateMove(move); if (r) return r; }
  const dirty = scanForbidden({ moves: plan.moves, nonce: plan.nonce });
  if (dirty) return `forbidden_content:${dirty}`;
  if (hashAttackPlan(attackPlanCore(plan)) !== plan.hash) return 'hash_mismatch';
  if (!verifyBytes(plan.actor, plan.hash, plan.sig)) return 'bad_signature';
  return null;
}
