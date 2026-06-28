/**
 * Turf Wars — Phase 3a BEACON SOURCE (lab) · COMMIT-DERIVED CROSS-BLOCK CHECKPOINT BEACON. Pure.
 *
 * ⚠️ LAB ONLY — see settlement.mjs / canonical.mjs headers. `arcade/hiveworld-agents/turf-wars/` is
 * denylisted from the curated production upload and imported by no Worker/DO/client path. This
 * authorizes nothing live: no live combat, no minors-facing use, no economy, no production exposure.
 * The roadmap stays DRAFT/DESIGN-ONLY and Phase 0 legal/safety counsel remains BLOCKING for any live or
 * minors-facing use.
 *
 * This is the beacon SOURCE designed in docs/NEON_CIRCUIT_TURF_WARS_PHASE3_PLAN.md (Residual 1). It closes
 * the O1 beacon residual that the Phase-2 settlement layer left open: a fair, party-uncontrolled beacon
 * that is fixed AFTER the commit and that the attacker cannot grind. It bounds (does NOT eliminate) the
 * K-of-N multi-commit vector by closing the commit window at the beacon height H_b.
 *
 * The mechanism, in three pure deterministic functions over already-signed foreign snapshots:
 *
 *  1. COHORT (deriveCohort). The N foreign blocks are NOT chosen by the attacker at settle time; the
 *     cohort is a deterministic function of the commit's own bytes. Each witnessed block-id is ranked by
 *     sha256(seed_commit | plan_hash | beacon_height | block_id) ascending, and the first COHORT_SIZE
 *     (excluding the attacker's and defender's blocks) are the cohort. Because the ranking key includes
 *     seed_commit — locked at commit time by the O1 ordering invariant, BEFORE the beacon exists — the
 *     attacker cannot re-pick a friendlier cohort after seeing heads, and cannot grind cohort selection
 *     independently of grinding seed_commit.
 *
 *  2. BEACON (deriveBeacon). The beacon value is a deterministic hash-aggregate of the cohort's signed
 *     snapshot heads at logical height >= H_b. It is UNDEFINED (returns null) until every cohort record
 *     verifies (verifySnapshot === null) AND has reached H_b — that is the post-commit property
 *     deriveSettlementSeed already assumes: a seed locked at commit time provably could not have been
 *     chosen against a known beacon. The output is a closed hex token (SEED_TOKEN_RE width) fed into the
 *     UNCHANGED deriveSettlementSeed 4-input boundary.
 *
 *  3. WINDOW-CLOSE (enforced in the fold, not here). A settle_attack is valid only if its referenced
 *     attack_commit was folded at a height strictly below H_b. Since H_b is defined by FOREIGN heads the
 *     attacker cannot advance or stall on demand, the attacker cannot keep committing past the moment the
 *     beacon becomes computable. K is bounded by the pre-H_b chain-op budget. The mechanism BOUNDS K; it
 *     does not make K = 1.
 *
 * Why no central server: the beacon is a PURE deterministic function of already-signed, content-addressed
 * foreign block snapshots — the same records peers already cache to make an offline block attackable. No
 * node mints, signs, or arbitrates it; every peer recomputes the identical beacon. The cohort is derived
 * from the commit, not assigned by any coordinator, so there is no privileged selector. A peer that merely
 * serves the foreign snapshots gains no authority — correctness traces to the foreign owners' signing keys
 * and the deterministic aggregate, never to who relayed the bytes.
 *
 * Determinism: pure, zero-dep; node:crypto via canonical.mjs; NO Date.now / Math.random / wall clock —
 * byte-identical regeneration. beacon_height (H_b) is a LOGICAL seq-height, never a timestamp.
 */
import { sha256Hex, canonicalize } from './canonical.mjs';
import { verifySnapshot } from './snapshot.mjs';

export const BEACON_VERSION = 1;

/** The number of foreign blocks aggregated into one beacon. Small on purpose (N=3): N=1 is the degenerate
 * single-foreign-owner case (collude / sock-puppet / stall-to-deadlock — see plan), and a larger cohort
 * is the Phase-4 quorum upgrade. This is the Phase-3-buildable cross-block checkpoint width. */
export const COHORT_SIZE = 3;

/** A beacon token is a closed 32-hex string — within settlement's SEED_TOKEN_RE (/^[0-9a-f]{16,64}$/),
 * so it feeds the UNCHANGED deriveSettlementSeed boundary as the `beacon` input. */
export const BEACON_TOKEN_WIDTH = 32;

/**
 * PURE: derive the commit-bound cohort — COHORT_SIZE foreign block-ids selected deterministically from
 * `witnessed`, EXCLUDING any id in `exclude` (the attacker's and defender's blocks). The cohort is pinned
 * by `seed_commit` (locked before the beacon by the O1 ordering invariant), so it cannot be re-chosen at
 * settle time without changing seed_commit.
 *
 *   @param seed_commit    the attacker's commit (sha256 of the seed) — already folded before H_b
 *   @param plan_hash      the attack plan's content address
 *   @param beacon_height  H_b, a bounded positive LOGICAL seq-height (never a timestamp)
 *   @param witnessed      array of foreign block-ids the peer holds signed snapshots for
 *   @param exclude        block-ids that may NOT be in the cohort (attacker + defender blocks)
 *   @returns array of COHORT_SIZE block-ids (fewer iff `witnessed` minus `exclude` is smaller).
 *
 * Ranking key = sha256(seed_commit | plan_hash | beacon_height | block_id), ascending; ties (never expected
 * for distinct ids) break by block_id for total order.
 */
export function deriveCohort({ seed_commit, plan_hash, beacon_height, witnessed, exclude } = {}) {
  const excludeSet = new Set(Array.isArray(exclude) ? exclude : []);
  const pool = (Array.isArray(witnessed) ? witnessed : [])
    .filter((id) => typeof id === 'string' && !excludeSet.has(id));
  // dedup while preserving determinism (the rank/sort below is the real order)
  const unique = [...new Set(pool)];
  const ranked = unique
    .map((block_id) => ({
      block_id,
      rank: sha256Hex(`turf-wars/beacon/v${BEACON_VERSION}|${seed_commit}|${plan_hash}|${beacon_height}|${block_id}`),
    }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.block_id.localeCompare(b.block_id)));
  return ranked.slice(0, COHORT_SIZE).map((r) => r.block_id);
}

/**
 * PURE: derive the beacon value from the cohort's signed snapshot records. Returns a closed hex token
 * (BEACON_TOKEN_WIDTH chars, within SEED_TOKEN_RE), or null if the beacon is UNDEFINED — i.e. any cohort
 * record fails to verify (verifySnapshot !== null) OR has not yet reached H_b (seq_height < beacon_height),
 * OR the cohort is empty. The null-before-H_b property is the post-commit guarantee: the beacon provably
 * did not exist at commit time.
 *
 *   @param cohortRecords  signed snapshot records (snapshot.mjs shape) for the cohort blocks
 *   @param beacon_height  H_b — every record must have seq_height >= this
 *
 * beacon = sha256(canonicalize(sortedByBlockId([{block_id, chain_head}, …]))).slice(0, BEACON_TOKEN_WIDTH)
 */
export function deriveBeacon({ cohortRecords, beacon_height } = {}) {
  if (!Array.isArray(cohortRecords) || cohortRecords.length === 0) return null;
  if (!Number.isInteger(beacon_height) || beacon_height < 1) return null;
  const heads = [];
  for (const record of cohortRecords) {
    if (verifySnapshot(record) !== null) return null;              // tampered / unsigned → undefined
    const snap = record.snapshot;
    if (!Number.isInteger(snap.seq_height) || snap.seq_height < beacon_height) return null; // not yet at H_b
    heads.push({ block_id: snap.block_id, chain_head: snap.chain_head });
  }
  heads.sort((a, b) => String(a.block_id).localeCompare(String(b.block_id)));
  return sha256Hex(canonicalize(heads)).slice(0, BEACON_TOKEN_WIDTH);
}
