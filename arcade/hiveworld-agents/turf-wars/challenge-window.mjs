/**
 * Turf Wars — Phase 3b AVAILABILITY (lab) · DETERMINISTIC CHALLENGE-WINDOW FINALIZATION PREDICATE. Pure.
 *
 * ⚠️ LAB ONLY — see availability.mjs / settlement.mjs headers. Denylisted from the curated upload; imported
 * by no production path. NO REAL NETWORK. The roadmap stays DRAFT/DESIGN-ONLY and Phase 0 legal/safety
 * counsel remains BLOCKING for any live or minors-facing use.
 *
 * This builds the previously-UN-built "Seam 3" of docs/NEON_CIRCUIT_TURF_WARS_PHASE3_PLAN.md (Residual 2):
 * the settle_attack fold (block-log.mjs) applies scorch and records the settlement IMMEDIATELY, with no
 * provisional/final flag and no window counter. This module supplies the finalization VIEW — and ONLY a
 * view: a pure predicate computed OVER the fold's output. It does NOT modify the fold and does NOT make the
 * fold correctness-authoritative.
 *
 * Logical time is measured in SEQ-HEIGHTS (the seq of folded ops), NEVER wall clock and NEVER op.tick. A
 * settlement folded at seq `open_height` is:
 *
 *   - 'refuted'    iff ANY watcher verdict is a VALID proveFraud (mismatch === true and the honest_digest is
 *                  present / re-derivable) at an IN-WINDOW height [open_height, open_height + W). A single
 *                  valid fraud-proof flips it at ANY in-window height — even height 0.
 *   - 'final'      iff (currentHeight - open_height) >= W AND no valid in-window proveFraud appeared.
 *   - 'provisional' otherwise (window still open, no refutation yet).
 *
 * Authority is unchanged: the predicate REPLAYS the already-delegable pure proveFraud (it does not re-derive
 * correctness itself) and merely COUNTS whether a refutation landed inside the logical-height window. Because
 * s.scorch is OUTSIDE blockFingerprint, provisional/final status never perturbs base-state convergence.
 */

export const CHALLENGE_WINDOW_VERSION = 1;

/** W — the challenge window length, in LOGICAL seq-heights (NOT wall clock, NOT op.tick). A settlement is
 * finalizable only once W seq-heights have advanced past its open_height with no valid in-window fraud-proof.
 * Choosing a REAL W depends on real propagation characteristics and is a DEFERRED residual (Phase 3/4). */
export const CHALLENGE_WINDOW_HEIGHTS = 8;

export const FINALIZE_STATUS = Object.freeze({ PROVISIONAL: 'provisional', FINAL: 'final', REFUTED: 'refuted' });

/**
 * PURE: is a single watcher verdict a VALID, in-window fraud-proof? A valid proveFraud has mismatch === true;
 * a genuine outcome-digest mismatch additionally carries a re-derivable honest_digest (the malformed/invalid-
 * input fraud reasons set mismatch true but may omit honest_digest — those still count as refutations because
 * proveFraud is the delegable authority; we accept any mismatch===true as a valid refutation, and require an
 * in-window height). `verdict.height` is the logical seq-height at which the watcher produced the proof.
 */
function isValidInWindowRefutation(verdict, openHeight, windowHeights) {
  if (!verdict || typeof verdict !== 'object') return false;
  const proof = verdict.fraud_proof || verdict.proof || verdict;
  if (!proof || proof.mismatch !== true) return false; // not a refutation
  const h = verdict.height;
  if (!Number.isInteger(h)) return false;
  // in-window: [open_height, open_height + W)
  return h >= openHeight && h < openHeight + windowHeights;
}

/**
 * PURE: the finalization predicate. Returns { status } where status ∈ FINALIZE_STATUS.
 *
 *   @param settlementRef    an object carrying at least { open_height } (the settle op's seq). Extra fields
 *                           are ignored — this is a view over fold output, not a mutation of it.
 *   @param openHeight       the settle op's seq (logical open height). If omitted, settlementRef.open_height.
 *   @param currentHeight    the current logical seq-height of the fold.
 *   @param watcherVerdicts  array of watcher verdicts; each { height, fraud_proof } (or a bare proveFraud
 *                           object with a `height`). A VALID in-window fraud-proof refutes.
 *   @param windowHeights    W (default CHALLENGE_WINDOW_HEIGHTS).
 *
 * A single valid in-window fraud-proof flips to 'refuted' at any in-window height (even height 0). Otherwise
 * 'final' iff W seq-heights have elapsed, else 'provisional'.
 */
export function finalize(settlementRef, openHeight, currentHeight, watcherVerdicts, windowHeights = CHALLENGE_WINDOW_HEIGHTS) {
  const open = Number.isInteger(openHeight)
    ? openHeight
    : (settlementRef && Number.isInteger(settlementRef.open_height) ? settlementRef.open_height : null);
  const W = Number.isInteger(windowHeights) && windowHeights > 0 ? windowHeights : CHALLENGE_WINDOW_HEIGHTS;
  if (open === null || !Number.isInteger(currentHeight)) {
    return { status: FINALIZE_STATUS.PROVISIONAL };
  }
  const verdicts = Array.isArray(watcherVerdicts) ? watcherVerdicts : [];
  const refuted = verdicts.some((v) => isValidInWindowRefutation(v, open, W));
  if (refuted) return { status: FINALIZE_STATUS.REFUTED };
  if ((currentHeight - open) >= W) return { status: FINALIZE_STATUS.FINAL };
  return { status: FINALIZE_STATUS.PROVISIONAL };
}

/**
 * PURE helper: build a watcher verdict from a proveFraud result at a logical height. `fraudProof` is the
 * object returned by settlement.proveFraud (null when the claim is honest). A null proof produces a verdict
 * that can never refute (mismatch absent). This is the ONLY bridge from the delegable fraud-proof into the
 * predicate — the predicate adds no authority of its own.
 */
export function watcherVerdict({ height, fraud_proof }) {
  return { height, fraud_proof: fraud_proof || null };
}
