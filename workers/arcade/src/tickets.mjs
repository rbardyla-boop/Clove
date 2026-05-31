/**
 * Pulse Tap ticket formula + score-payload validation — PURE, runtime-agnostic.
 *
 * No Workers/Node APIs are used here, so the exact same code runs:
 *  - inside the Durable Object (bundled by esbuild/wrangler),
 *  - inside the local dev WebSocket shim, and
 *  - inside the Node unit tests.
 *
 * The SERVER computes tickets. The client may show an estimate, but any
 * client-supplied ticket count is ignored — only computeTickets() decides.
 *
 * Phase 1e: tickets are internal session/room-scoped arcade points only.
 * Scope + non-goals: docs/NEON_CIRCUIT_PHASE1E_SERVER_TICKETS.md
 */

export const GRADES = Object.freeze(['S', 'A', 'B', 'C', 'D', 'F']);

/** Base tickets per grade. */
export const GRADE_BASE = Object.freeze({ S: 25, A: 18, B: 12, C: 7, D: 3, F: 0 });

/** Tunable limits + caps. Anything outside these bounds is "impossible". */
export const LIMITS = Object.freeze({
  MAX_SCORE: 10_000,        // a 30s Pulse Tap round cannot plausibly exceed this
  MAX_ACCURACY: 100,
  MAX_HITS: 1_000,
  MAX_STREAK: 1_000,
  MIN_DURATION_MS: 2_000,   // a real round takes at least a couple seconds
  MAX_DURATION_MS: 120_000, // generous upper bound incl. network latency
  SCORE_BONUS_CAP: 10,
  SCORE_BONUS_DIVISOR: 750, // 1 bonus ticket per 750 score, capped
  ACCURACY_BONUS_HIGH: 5,   // accuracy >= 98
  ACCURACY_BONUS_MID: 3,    // accuracy >= 90
  MAX_PAYOUT: 40,           // hard ceiling per round
  MAX_ROUND_MS: 90_000,     // server round lifetime before it expires
});

function isInt(n) {
  return typeof n === 'number' && Number.isInteger(n);
}

/**
 * Deterministic ticket award. Assumes inputs already passed validateScorePayload.
 * Returns an integer in [0, MAX_PAYOUT].
 */
export function computeTickets({ grade, score, accuracy }) {
  const base = GRADE_BASE[grade] ?? 0;
  const scoreBonus = Math.min(LIMITS.SCORE_BONUS_CAP, Math.floor(Math.max(0, score) / LIMITS.SCORE_BONUS_DIVISOR));
  let accBonus = 0;
  if (accuracy >= 98) accBonus = LIMITS.ACCURACY_BONUS_HIGH;
  else if (accuracy >= 90) accBonus = LIMITS.ACCURACY_BONUS_MID;
  const total = base + scoreBonus + accBonus;
  return Math.max(0, Math.min(LIMITS.MAX_PAYOUT, total));
}

/**
 * Validate a round-submit payload's score block. Returns { ok, reason }.
 * Reasons are stable machine strings used in pulse_round_rejected.
 */
export function validateScorePayload(p) {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'malformed' };
  if (typeof p.roundId !== 'string' || !p.roundId) return { ok: false, reason: 'malformed' };
  if (typeof p.machineId !== 'string' || !p.machineId) return { ok: false, reason: 'malformed' };
  if (typeof p.grade !== 'string' || !GRADES.includes(p.grade)) return { ok: false, reason: 'bad_grade' };

  if (!isInt(p.score)) return { ok: false, reason: 'malformed' };
  if (p.score < 0) return { ok: false, reason: 'negative_score' };
  if (p.score > LIMITS.MAX_SCORE) return { ok: false, reason: 'score_out_of_bounds' };

  if (!isInt(p.accuracy)) return { ok: false, reason: 'malformed' };
  if (p.accuracy < 0 || p.accuracy > LIMITS.MAX_ACCURACY) return { ok: false, reason: 'accuracy_out_of_bounds' };

  if (!isInt(p.durationMs)) return { ok: false, reason: 'malformed' };
  if (p.durationMs < LIMITS.MIN_DURATION_MS || p.durationMs > LIMITS.MAX_DURATION_MS) {
    return { ok: false, reason: 'duration_out_of_bounds' };
  }

  if (!isInt(p.hits) || p.hits < 0 || p.hits > LIMITS.MAX_HITS) return { ok: false, reason: 'malformed' };
  if (!isInt(p.bestStreak) || p.bestStreak < 0 || p.bestStreak > LIMITS.MAX_STREAK) return { ok: false, reason: 'malformed' };

  return { ok: true, reason: null };
}
