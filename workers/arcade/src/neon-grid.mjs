/**
 * Neon Grid ticket formula + result-payload validation — PURE, runtime-agnostic.
 *
 * Phase 1l's third ticketed cabinet, and the FIRST production cabinet that enters
 * Neon Circuit through the Phase 1j/1k cabinet-adapter / dynamic-import path
 * instead of being hand-wired into the floor. Like ./tickets.mjs (Pulse Tap) and
 * ./signal-sprint.mjs (Signal Sprint) this file uses no Workers/Node APIs, so the
 * exact same code runs inside the Durable Object, the local dev shim, and the Node
 * unit tests.
 *
 * Neon Grid is a short pattern-path game: a path lights up on a small neon grid
 * and the player repeats it by tapping the cells in order. The result space is
 * intentionally small and bounded so server validation is deterministic.
 *
 * The SERVER computes tickets. The client may show an estimate, but any
 * client-supplied ticket count is ignored — only computeNeonGridTickets() decides.
 *
 * Neon Grid tickets are internal session/room-scoped arcade points only: no money,
 * no crypto, no transferable goods, no cash value. See
 * docs/NEON_CIRCUIT_PHASE1L_NEON_GRID.md for scope + non-goals.
 */

export const GRADES = Object.freeze(['S', 'A', 'B', 'C', 'D', 'F']);

/** Base tickets per grade (distinct from Pulse Tap + Signal Sprint). */
export const GRADE_BASE = Object.freeze({ S: 24, A: 17, B: 12, C: 7, D: 3, F: 0 });

/** Tunable limits + caps. Anything outside these bounds is "impossible". */
export const NEON_GRID_LIMITS = Object.freeze({
  MAX_SCORE: 50_000,          // a ~30s Neon Grid round cannot plausibly exceed this
  MAX_CORRECT_STEPS: 256,     // individual correct cell taps
  MAX_PATTERNS: 64,           // completed patterns (full paths repeated)
  MAX_MISTAKES: 128,          // wrong-cell taps
  MAX_STREAK: 256,            // best uninterrupted correct-step streak
  MIN_DURATION_MS: 5_000,     // a real round takes at least a few seconds
  MAX_DURATION_MS: 35_000,    // generous upper bound incl. network latency
  PATTERN_BONUS_CAP: 8,       // +1 ticket per completed pattern, capped
  STREAK_BONUS_HIGH: 5,       // best_streak >= 32
  STREAK_BONUS_MID: 3,        // best_streak >= 16
  STREAK_HIGH_AT: 32,
  STREAK_MID_AT: 16,
  MISTAKE_PENALTY_DIVISOR: 4, // -1 ticket per 4 mistakes
  MISTAKE_PENALTY_CAP: 5,     // ...capped at -5
  MAX_PAYOUT: 38,             // hard ceiling per round
  MAX_ROUND_MS: 60_000,       // server round lifetime before it expires
});

function isInt(n) {
  return typeof n === 'number' && Number.isInteger(n);
}

/**
 * Deterministic ticket award. Assumes inputs already passed validateNeonGridPayload.
 * Returns an integer in [0, MAX_PAYOUT].
 *
 *   base[grade]
 *   + min(8, completed_patterns)                              // pattern bonus
 *   + (best_streak >= 32 ? 5 : best_streak >= 16 ? 3 : 0)     // streak bonus
 *   - min(5, floor(mistakes / 4))                             // mistake penalty
 *   clamped to [0, 38]
 */
export function computeNeonGridTickets({ grade, completedPatterns, bestStreak, mistakes }) {
  const base = GRADE_BASE[grade] ?? 0;
  const patternBonus = Math.min(
    NEON_GRID_LIMITS.PATTERN_BONUS_CAP,
    Math.max(0, completedPatterns || 0),
  );
  let streakBonus = 0;
  if ((bestStreak || 0) >= NEON_GRID_LIMITS.STREAK_HIGH_AT) streakBonus = NEON_GRID_LIMITS.STREAK_BONUS_HIGH;
  else if ((bestStreak || 0) >= NEON_GRID_LIMITS.STREAK_MID_AT) streakBonus = NEON_GRID_LIMITS.STREAK_BONUS_MID;
  const mistakePenalty = Math.min(
    NEON_GRID_LIMITS.MISTAKE_PENALTY_CAP,
    Math.floor(Math.max(0, mistakes || 0) / NEON_GRID_LIMITS.MISTAKE_PENALTY_DIVISOR),
  );
  const total = base + patternBonus + streakBonus - mistakePenalty;
  return Math.max(0, Math.min(NEON_GRID_LIMITS.MAX_PAYOUT, total));
}

/**
 * Validate a Neon Grid round-submit payload. Returns { ok, reason }.
 * Reasons are stable machine strings used in neon_grid_round_rejected.
 */
export function validateNeonGridPayload(p) {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'malformed' };
  if (typeof p.roundId !== 'string' || !p.roundId) return { ok: false, reason: 'malformed' };
  if (typeof p.machineId !== 'string' || !p.machineId) return { ok: false, reason: 'malformed' };
  if (typeof p.grade !== 'string' || !GRADES.includes(p.grade)) return { ok: false, reason: 'bad_grade' };

  if (!isInt(p.score)) return { ok: false, reason: 'malformed' };
  if (p.score < 0) return { ok: false, reason: 'negative_score' };
  if (p.score > NEON_GRID_LIMITS.MAX_SCORE) return { ok: false, reason: 'score_out_of_bounds' };

  if (!isInt(p.correctSteps)) return { ok: false, reason: 'malformed' };
  if (p.correctSteps < 0) return { ok: false, reason: 'negative_correct_steps' };
  if (p.correctSteps > NEON_GRID_LIMITS.MAX_CORRECT_STEPS) return { ok: false, reason: 'correct_steps_out_of_bounds' };

  if (!isInt(p.completedPatterns)) return { ok: false, reason: 'malformed' };
  if (p.completedPatterns < 0) return { ok: false, reason: 'negative_patterns' };
  if (p.completedPatterns > NEON_GRID_LIMITS.MAX_PATTERNS) return { ok: false, reason: 'patterns_out_of_bounds' };

  if (!isInt(p.mistakes)) return { ok: false, reason: 'malformed' };
  if (p.mistakes < 0) return { ok: false, reason: 'negative_mistakes' };
  if (p.mistakes > NEON_GRID_LIMITS.MAX_MISTAKES) return { ok: false, reason: 'mistakes_out_of_bounds' };

  if (!isInt(p.bestStreak)) return { ok: false, reason: 'malformed' };
  if (p.bestStreak < 0) return { ok: false, reason: 'negative_streak' };
  if (p.bestStreak > NEON_GRID_LIMITS.MAX_STREAK) return { ok: false, reason: 'streak_out_of_bounds' };

  if (!isInt(p.durationMs)) return { ok: false, reason: 'malformed' };
  if (p.durationMs < NEON_GRID_LIMITS.MIN_DURATION_MS || p.durationMs > NEON_GRID_LIMITS.MAX_DURATION_MS) {
    return { ok: false, reason: 'duration_out_of_bounds' };
  }

  return { ok: true, reason: null };
}
