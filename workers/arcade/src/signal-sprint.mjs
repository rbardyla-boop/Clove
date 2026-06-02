/**
 * Signal Sprint ticket formula + score-payload validation — PURE, runtime-agnostic.
 *
 * Phase 1g's second ticketed cabinet. Like ./tickets.mjs (Pulse Tap), this file
 * uses no Workers/Node APIs, so the exact same code runs inside the Durable
 * Object, the local dev shim, and the Node unit tests.
 *
 * The SERVER computes tickets. The client may show an estimate, but any
 * client-supplied ticket count is ignored — only computeSignalTickets() decides.
 *
 * Signal Sprint tickets are internal session/room-scoped arcade points only:
 * no money, no crypto, no transferable goods, no cash value. See
 * docs/NEON_CIRCUIT_PHASE1G_SIGNAL_SPRINT.md for scope + non-goals.
 */

export const GRADES = Object.freeze(['S', 'A', 'B', 'C', 'D', 'F']);

/** Base tickets per grade (distinct from Pulse Tap — proves the loop is not hardcoded). */
export const GRADE_BASE = Object.freeze({ S: 22, A: 16, B: 11, C: 6, D: 3, F: 0 });

/** Tunable limits + caps. Anything outside these bounds is "impossible". */
export const SIGNAL_LIMITS = Object.freeze({
  MAX_SCORE: 20_000,          // a ~25s Signal Sprint round cannot plausibly exceed this
  MAX_DISTANCE: 12_000,       // lane distance travelled
  MAX_PULSES: 3_000,          // pulses collected
  MAX_NOISE: 2_000,           // static/noise hits taken
  MAX_STREAK: 2_000,          // best uninterrupted collect streak
  MIN_DURATION_MS: 3_000,     // a real round takes at least a few seconds
  MAX_DURATION_MS: 60_000,    // generous upper bound incl. network latency
  DISTANCE_BONUS_CAP: 8,
  DISTANCE_BONUS_DIVISOR: 250, // 1 bonus ticket per 250 distance, capped
  STREAK_BONUS_HIGH: 5,        // max_streak >= 25
  STREAK_BONUS_MID: 3,         // max_streak >= 12
  STREAK_HIGH_AT: 25,
  STREAK_MID_AT: 12,
  NOISE_PENALTY_DIVISOR: 3,    // -1 ticket per 3 noise hits
  NOISE_PENALTY_CAP: 5,        // ...capped at -5
  MAX_PAYOUT: 35,              // hard ceiling per round
  MAX_ROUND_MS: 90_000,        // server round lifetime before it expires
});

function isInt(n) {
  return typeof n === 'number' && Number.isInteger(n);
}

/**
 * Deterministic ticket award. Assumes inputs already passed validateSignalPayload.
 * Returns an integer in [0, MAX_PAYOUT].
 *
 *   base[grade]
 *   + min(8, floor(distance / 250))            // distance bonus
 *   + (max_streak >= 25 ? 5 : max_streak >= 12 ? 3 : 0)  // streak bonus
 *   - min(5, floor(noise_hits / 3))            // noise penalty
 *   clamped to [0, 35]
 */
export function computeSignalTickets({ grade, distance, maxStreak, noiseHits }) {
  const base = GRADE_BASE[grade] ?? 0;
  const distanceBonus = Math.min(
    SIGNAL_LIMITS.DISTANCE_BONUS_CAP,
    Math.floor(Math.max(0, distance || 0) / SIGNAL_LIMITS.DISTANCE_BONUS_DIVISOR),
  );
  let streakBonus = 0;
  if ((maxStreak || 0) >= SIGNAL_LIMITS.STREAK_HIGH_AT) streakBonus = SIGNAL_LIMITS.STREAK_BONUS_HIGH;
  else if ((maxStreak || 0) >= SIGNAL_LIMITS.STREAK_MID_AT) streakBonus = SIGNAL_LIMITS.STREAK_BONUS_MID;
  const noisePenalty = Math.min(
    SIGNAL_LIMITS.NOISE_PENALTY_CAP,
    Math.floor(Math.max(0, noiseHits || 0) / SIGNAL_LIMITS.NOISE_PENALTY_DIVISOR),
  );
  const total = base + distanceBonus + streakBonus - noisePenalty;
  return Math.max(0, Math.min(SIGNAL_LIMITS.MAX_PAYOUT, total));
}

/**
 * Validate a Signal Sprint round-submit payload. Returns { ok, reason }.
 * Reasons are stable machine strings used in signal_sprint_round_rejected.
 */
export function validateSignalPayload(p) {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'malformed' };
  if (typeof p.roundId !== 'string' || !p.roundId) return { ok: false, reason: 'malformed' };
  if (typeof p.machineId !== 'string' || !p.machineId) return { ok: false, reason: 'malformed' };
  if (typeof p.grade !== 'string' || !GRADES.includes(p.grade)) return { ok: false, reason: 'bad_grade' };

  if (!isInt(p.score)) return { ok: false, reason: 'malformed' };
  if (p.score < 0) return { ok: false, reason: 'negative_score' };
  if (p.score > SIGNAL_LIMITS.MAX_SCORE) return { ok: false, reason: 'score_out_of_bounds' };

  if (!isInt(p.distance)) return { ok: false, reason: 'malformed' };
  if (p.distance < 0) return { ok: false, reason: 'negative_distance' };
  if (p.distance > SIGNAL_LIMITS.MAX_DISTANCE) return { ok: false, reason: 'distance_out_of_bounds' };

  if (!isInt(p.pulsesCollected) || p.pulsesCollected < 0 || p.pulsesCollected > SIGNAL_LIMITS.MAX_PULSES) {
    return { ok: false, reason: 'malformed' };
  }
  if (!isInt(p.noiseHits) || p.noiseHits < 0 || p.noiseHits > SIGNAL_LIMITS.MAX_NOISE) {
    return { ok: false, reason: 'malformed' };
  }
  if (!isInt(p.maxStreak) || p.maxStreak < 0 || p.maxStreak > SIGNAL_LIMITS.MAX_STREAK) {
    return { ok: false, reason: 'malformed' };
  }

  if (!isInt(p.durationMs)) return { ok: false, reason: 'malformed' };
  if (p.durationMs < SIGNAL_LIMITS.MIN_DURATION_MS || p.durationMs > SIGNAL_LIMITS.MAX_DURATION_MS) {
    return { ok: false, reason: 'duration_out_of_bounds' };
  }

  return { ok: true, reason: null };
}
