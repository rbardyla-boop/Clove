/**
 * Phase 1 ticket formulas + result validators — SIMULATOR-LOCAL PORT of
 * workers/arcade/src/{tickets,signal-sprint,neon-grid}.mjs. Byte-faithful to the
 * product formulas so the testbed awards exactly what the real server would.
 *
 * The SERVER computes tickets; a client estimate is ignored. Here the authority
 * is the canonical fold, so the round-authority reducer computes the award using
 * these pure functions. Tickets are internal arcade points only — no money.
 */
import { getCabinetByMachineId } from './catalog.mjs';

export const GRADES = Object.freeze(['S', 'A', 'B', 'C', 'D', 'F']);
const isInt = (n) => typeof n === 'number' && Number.isInteger(n);

// ── Pulse Tap ────────────────────────────────────────────────────────────────
export const PULSE_BASE = Object.freeze({ S: 25, A: 18, B: 12, C: 7, D: 3, F: 0 });
export const PULSE_LIMITS = Object.freeze({
  MAX_SCORE: 10_000, MAX_ACCURACY: 100, MAX_HITS: 1_000, MAX_STREAK: 1_000,
  MIN_DURATION_MS: 2_000, MAX_DURATION_MS: 120_000,
  SCORE_BONUS_CAP: 10, SCORE_BONUS_DIVISOR: 750, ACCURACY_BONUS_HIGH: 5, ACCURACY_BONUS_MID: 3,
  MAX_PAYOUT: 40, MAX_ROUND_TICKS: 90,
});
export function computePulseTickets({ grade, score, accuracy }) {
  const base = PULSE_BASE[grade] ?? 0;
  const scoreBonus = Math.min(PULSE_LIMITS.SCORE_BONUS_CAP, Math.floor(Math.max(0, score) / PULSE_LIMITS.SCORE_BONUS_DIVISOR));
  let accBonus = 0;
  if (accuracy >= 98) accBonus = PULSE_LIMITS.ACCURACY_BONUS_HIGH;
  else if (accuracy >= 90) accBonus = PULSE_LIMITS.ACCURACY_BONUS_MID;
  return Math.max(0, Math.min(PULSE_LIMITS.MAX_PAYOUT, base + scoreBonus + accBonus));
}
export function validatePulsePayload(p) {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'malformed' };
  if (typeof p.roundId !== 'string' || !p.roundId) return { ok: false, reason: 'malformed' };
  if (typeof p.machineId !== 'string' || !p.machineId) return { ok: false, reason: 'malformed' };
  if (typeof p.grade !== 'string' || !GRADES.includes(p.grade)) return { ok: false, reason: 'bad_grade' };
  if (!isInt(p.score)) return { ok: false, reason: 'malformed' };
  if (p.score < 0) return { ok: false, reason: 'negative_score' };
  if (p.score > PULSE_LIMITS.MAX_SCORE) return { ok: false, reason: 'score_out_of_bounds' };
  if (!isInt(p.accuracy)) return { ok: false, reason: 'malformed' };
  if (p.accuracy < 0 || p.accuracy > PULSE_LIMITS.MAX_ACCURACY) return { ok: false, reason: 'accuracy_out_of_bounds' };
  if (!isInt(p.durationMs)) return { ok: false, reason: 'malformed' };
  if (p.durationMs < PULSE_LIMITS.MIN_DURATION_MS || p.durationMs > PULSE_LIMITS.MAX_DURATION_MS) return { ok: false, reason: 'duration_out_of_bounds' };
  if (!isInt(p.hits) || p.hits < 0 || p.hits > PULSE_LIMITS.MAX_HITS) return { ok: false, reason: 'malformed' };
  if (!isInt(p.bestStreak) || p.bestStreak < 0 || p.bestStreak > PULSE_LIMITS.MAX_STREAK) return { ok: false, reason: 'malformed' };
  return { ok: true, reason: null };
}

// ── Signal Sprint ────────────────────────────────────────────────────────────
export const SIGNAL_BASE = Object.freeze({ S: 22, A: 16, B: 11, C: 6, D: 3, F: 0 });
export const SIGNAL_LIMITS = Object.freeze({
  MAX_SCORE: 20_000, MAX_DISTANCE: 12_000, MAX_PULSES: 3_000, MAX_NOISE: 2_000, MAX_STREAK: 2_000,
  MIN_DURATION_MS: 3_000, MAX_DURATION_MS: 60_000,
  DISTANCE_BONUS_CAP: 8, DISTANCE_BONUS_DIVISOR: 250, STREAK_BONUS_HIGH: 5, STREAK_BONUS_MID: 3,
  STREAK_HIGH_AT: 25, STREAK_MID_AT: 12, NOISE_PENALTY_DIVISOR: 3, NOISE_PENALTY_CAP: 5,
  MAX_PAYOUT: 35, MAX_ROUND_TICKS: 90,
});
export function computeSignalTickets({ grade, distance, maxStreak, noiseHits }) {
  const base = SIGNAL_BASE[grade] ?? 0;
  const distanceBonus = Math.min(SIGNAL_LIMITS.DISTANCE_BONUS_CAP, Math.floor(Math.max(0, distance || 0) / SIGNAL_LIMITS.DISTANCE_BONUS_DIVISOR));
  let streakBonus = 0;
  if ((maxStreak || 0) >= SIGNAL_LIMITS.STREAK_HIGH_AT) streakBonus = SIGNAL_LIMITS.STREAK_BONUS_HIGH;
  else if ((maxStreak || 0) >= SIGNAL_LIMITS.STREAK_MID_AT) streakBonus = SIGNAL_LIMITS.STREAK_BONUS_MID;
  const noisePenalty = Math.min(SIGNAL_LIMITS.NOISE_PENALTY_CAP, Math.floor(Math.max(0, noiseHits || 0) / SIGNAL_LIMITS.NOISE_PENALTY_DIVISOR));
  return Math.max(0, Math.min(SIGNAL_LIMITS.MAX_PAYOUT, base + distanceBonus + streakBonus - noisePenalty));
}
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
  if (!isInt(p.pulsesCollected) || p.pulsesCollected < 0 || p.pulsesCollected > SIGNAL_LIMITS.MAX_PULSES) return { ok: false, reason: 'malformed' };
  if (!isInt(p.noiseHits) || p.noiseHits < 0 || p.noiseHits > SIGNAL_LIMITS.MAX_NOISE) return { ok: false, reason: 'malformed' };
  if (!isInt(p.maxStreak) || p.maxStreak < 0 || p.maxStreak > SIGNAL_LIMITS.MAX_STREAK) return { ok: false, reason: 'malformed' };
  if (!isInt(p.durationMs)) return { ok: false, reason: 'malformed' };
  if (p.durationMs < SIGNAL_LIMITS.MIN_DURATION_MS || p.durationMs > SIGNAL_LIMITS.MAX_DURATION_MS) return { ok: false, reason: 'duration_out_of_bounds' };
  return { ok: true, reason: null };
}

// ── Neon Grid ────────────────────────────────────────────────────────────────
export const GRID_BASE = Object.freeze({ S: 24, A: 17, B: 12, C: 7, D: 3, F: 0 });
export const GRID_LIMITS = Object.freeze({
  MAX_SCORE: 50_000, MAX_CORRECT_STEPS: 256, MAX_PATTERNS: 64, MAX_MISTAKES: 128, MAX_STREAK: 256,
  MIN_DURATION_MS: 5_000, MAX_DURATION_MS: 35_000,
  PATTERN_BONUS_CAP: 8, STREAK_BONUS_HIGH: 5, STREAK_BONUS_MID: 3, STREAK_HIGH_AT: 32, STREAK_MID_AT: 16,
  MISTAKE_PENALTY_DIVISOR: 4, MISTAKE_PENALTY_CAP: 5, MAX_PAYOUT: 38, MAX_ROUND_TICKS: 60,
});
export function computeGridTickets({ grade, completedPatterns, bestStreak, mistakes }) {
  const base = GRID_BASE[grade] ?? 0;
  const patternBonus = Math.min(GRID_LIMITS.PATTERN_BONUS_CAP, Math.max(0, completedPatterns || 0));
  let streakBonus = 0;
  if ((bestStreak || 0) >= GRID_LIMITS.STREAK_HIGH_AT) streakBonus = GRID_LIMITS.STREAK_BONUS_HIGH;
  else if ((bestStreak || 0) >= GRID_LIMITS.STREAK_MID_AT) streakBonus = GRID_LIMITS.STREAK_BONUS_MID;
  const mistakePenalty = Math.min(GRID_LIMITS.MISTAKE_PENALTY_CAP, Math.floor(Math.max(0, mistakes || 0) / GRID_LIMITS.MISTAKE_PENALTY_DIVISOR));
  return Math.max(0, Math.min(GRID_LIMITS.MAX_PAYOUT, base + patternBonus + streakBonus - mistakePenalty));
}
export function validateGridPayload(p) {
  if (!p || typeof p !== 'object') return { ok: false, reason: 'malformed' };
  if (typeof p.roundId !== 'string' || !p.roundId) return { ok: false, reason: 'malformed' };
  if (typeof p.machineId !== 'string' || !p.machineId) return { ok: false, reason: 'malformed' };
  if (typeof p.grade !== 'string' || !GRADES.includes(p.grade)) return { ok: false, reason: 'bad_grade' };
  if (!isInt(p.score)) return { ok: false, reason: 'malformed' };
  if (p.score < 0) return { ok: false, reason: 'negative_score' };
  if (p.score > GRID_LIMITS.MAX_SCORE) return { ok: false, reason: 'score_out_of_bounds' };
  if (!isInt(p.correctSteps)) return { ok: false, reason: 'malformed' };
  if (p.correctSteps < 0) return { ok: false, reason: 'negative_correct_steps' };
  if (p.correctSteps > GRID_LIMITS.MAX_CORRECT_STEPS) return { ok: false, reason: 'correct_steps_out_of_bounds' };
  if (!isInt(p.completedPatterns)) return { ok: false, reason: 'malformed' };
  if (p.completedPatterns < 0) return { ok: false, reason: 'negative_patterns' };
  if (p.completedPatterns > GRID_LIMITS.MAX_PATTERNS) return { ok: false, reason: 'patterns_out_of_bounds' };
  if (!isInt(p.mistakes)) return { ok: false, reason: 'malformed' };
  if (p.mistakes < 0) return { ok: false, reason: 'negative_mistakes' };
  if (p.mistakes > GRID_LIMITS.MAX_MISTAKES) return { ok: false, reason: 'mistakes_out_of_bounds' };
  if (!isInt(p.bestStreak)) return { ok: false, reason: 'malformed' };
  if (p.bestStreak < 0) return { ok: false, reason: 'negative_streak' };
  if (p.bestStreak > GRID_LIMITS.MAX_STREAK) return { ok: false, reason: 'streak_out_of_bounds' };
  if (!isInt(p.durationMs)) return { ok: false, reason: 'malformed' };
  if (p.durationMs < GRID_LIMITS.MIN_DURATION_MS || p.durationMs > GRID_LIMITS.MAX_DURATION_MS) return { ok: false, reason: 'duration_out_of_bounds' };
  return { ok: true, reason: null };
}

/** Ruleset registry keyed by cabinet_type — the server resolves this, never the client. */
export const RULESETS = Object.freeze({
  pulse_tap: {
    rulesetVersion: 'pulse-tap/1', maxRoundTicks: PULSE_LIMITS.MAX_ROUND_TICKS,
    validate: validatePulsePayload,
    compute: (p) => computePulseTickets({ grade: p.grade, score: p.score, accuracy: p.accuracy }),
  },
  signal_sprint: {
    rulesetVersion: 'signal-sprint/1', maxRoundTicks: SIGNAL_LIMITS.MAX_ROUND_TICKS,
    validate: validateSignalPayload,
    compute: (p) => computeSignalTickets({ grade: p.grade, distance: p.distance, maxStreak: p.maxStreak, noiseHits: p.noiseHits }),
  },
  neon_grid: {
    rulesetVersion: 'neon-grid-v1', maxRoundTicks: GRID_LIMITS.MAX_ROUND_TICKS,
    validate: validateGridPayload,
    compute: (p) => computeGridTickets({ grade: p.grade, completedPatterns: p.completedPatterns, bestStreak: p.bestStreak, mistakes: p.mistakes }),
  },
});

export function getRuleset(cabinetType) { return RULESETS[cabinetType] || null; }

/** Resolve a playable cabinet + ruleset from a machine id (catalog is the authority). */
export function resolveRulesetByMachine(machineId) {
  const cabinet = getCabinetByMachineId(machineId);
  if (!cabinet || cabinet.status !== 'live' || cabinet.ticket_enabled !== true) return null;
  const ruleset = RULESETS[cabinet.cabinet_type];
  if (!ruleset) return null; // e.g. mystery_x has no ruleset → not playable
  return { cabinet, ruleset };
}
