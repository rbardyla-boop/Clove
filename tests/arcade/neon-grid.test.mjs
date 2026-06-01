/**
 * Phase 1l — E. Neon Grid ticket formula + result-payload validation (pure).
 *
 * Same shape as tests/arcade/tickets.test.mjs / signal-sprint validation: the
 * server-side formula + bounds are unit tested so the third cabinet's payout and
 * "impossible result" rejection are enforced by tests, not convention.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNeonGridTickets, validateNeonGridPayload, NEON_GRID_LIMITS, GRADE_BASE, GRADES,
} from '../../workers/arcade/src/neon-grid.mjs';

function payload(over = {}) {
  return {
    roundId: 'g1', machineId: 'grid', grade: 'A', score: 5000,
    correctSteps: 40, completedPatterns: 6, mistakes: 2, bestStreak: 18, durationMs: 22000, ...over,
  };
}

// ── E. ticket formula ────────────────────────────────────────────────────────
test('each grade pays its base award with no bonuses or mistakes', () => {
  for (const g of GRADES) {
    assert.equal(computeNeonGridTickets({ grade: g, completedPatterns: 0, bestStreak: 0, mistakes: 0 }), GRADE_BASE[g]);
  }
});

test('pattern bonus is +1 per completed pattern, capped at 8', () => {
  assert.equal(computeNeonGridTickets({ grade: 'F', completedPatterns: 5, bestStreak: 0, mistakes: 0 }), 5);
  assert.equal(computeNeonGridTickets({ grade: 'F', completedPatterns: 8, bestStreak: 0, mistakes: 0 }), 8);
  assert.equal(computeNeonGridTickets({ grade: 'F', completedPatterns: 64, bestStreak: 0, mistakes: 0 }), NEON_GRID_LIMITS.PATTERN_BONUS_CAP);
});

test('streak bonus tiers: >=32 → +5, >=16 → +3, else 0 (capped at +5)', () => {
  assert.equal(computeNeonGridTickets({ grade: 'F', completedPatterns: 0, bestStreak: 15, mistakes: 0 }), 0);
  assert.equal(computeNeonGridTickets({ grade: 'F', completedPatterns: 0, bestStreak: 16, mistakes: 0 }), 3);
  assert.equal(computeNeonGridTickets({ grade: 'F', completedPatterns: 0, bestStreak: 32, mistakes: 0 }), 5);
  assert.equal(computeNeonGridTickets({ grade: 'F', completedPatterns: 0, bestStreak: 256, mistakes: 0 }), 5);
});

test('mistake penalty is -1 per 4 mistakes, capped at -5', () => {
  assert.equal(computeNeonGridTickets({ grade: 'A', completedPatterns: 0, bestStreak: 0, mistakes: 3 }), 17);   // <4 → 0
  assert.equal(computeNeonGridTickets({ grade: 'A', completedPatterns: 0, bestStreak: 0, mistakes: 4 }), 16);   // -1
  assert.equal(computeNeonGridTickets({ grade: 'A', completedPatterns: 0, bestStreak: 0, mistakes: 20 }), 12);  // -5
  assert.equal(computeNeonGridTickets({ grade: 'A', completedPatterns: 0, bestStreak: 0, mistakes: 128 }), 12); // still -5
});

test('the award is clamped to [0, MAX_PAYOUT]', () => {
  const max = computeNeonGridTickets({ grade: 'S', completedPatterns: 64, bestStreak: 256, mistakes: 0 });
  assert.ok(max <= NEON_GRID_LIMITS.MAX_PAYOUT, `award ${max} exceeds cap`);
  assert.equal(max, GRADE_BASE.S + NEON_GRID_LIMITS.PATTERN_BONUS_CAP + NEON_GRID_LIMITS.STREAK_BONUS_HIGH); // 24+8+5 = 37 (38 is a defensive ceiling)
  // a grade-F round drowning in mistakes never goes negative
  assert.equal(computeNeonGridTickets({ grade: 'F', completedPatterns: 0, bestStreak: 0, mistakes: 128 }), 0);
});

test('a representative round computes deterministically', () => {
  // base A=17 + pattern min(8,6)=6 + streak(18>=16 → +3) − floor(2/4)=0 = 26
  assert.equal(computeNeonGridTickets({ grade: 'A', completedPatterns: 6, bestStreak: 18, mistakes: 2 }), 26);
});

// ── result-payload validation ────────────────────────────────────────────────
test('a well-formed Neon Grid payload validates', () => {
  assert.deepEqual(validateNeonGridPayload(payload()), { ok: true, reason: null });
});

test('malformed / missing identity fields are rejected', () => {
  assert.equal(validateNeonGridPayload(null).reason, 'malformed');
  assert.equal(validateNeonGridPayload(payload({ roundId: '' })).reason, 'malformed');
  assert.equal(validateNeonGridPayload(payload({ machineId: '' })).reason, 'malformed');
  assert.equal(validateNeonGridPayload(payload({ grade: 'Z' })).reason, 'bad_grade');
  assert.equal(validateNeonGridPayload(payload({ score: 1.5 })).reason, 'malformed'); // non-integer
});

test('impossible / out-of-bounds metrics are rejected with stable reasons', () => {
  assert.equal(validateNeonGridPayload(payload({ score: -1 })).reason, 'negative_score');
  assert.equal(validateNeonGridPayload(payload({ score: NEON_GRID_LIMITS.MAX_SCORE + 1 })).reason, 'score_out_of_bounds');
  assert.equal(validateNeonGridPayload(payload({ correctSteps: -1 })).reason, 'negative_correct_steps');
  assert.equal(validateNeonGridPayload(payload({ correctSteps: NEON_GRID_LIMITS.MAX_CORRECT_STEPS + 1 })).reason, 'correct_steps_out_of_bounds');
  assert.equal(validateNeonGridPayload(payload({ completedPatterns: -1 })).reason, 'negative_patterns');
  assert.equal(validateNeonGridPayload(payload({ completedPatterns: NEON_GRID_LIMITS.MAX_PATTERNS + 1 })).reason, 'patterns_out_of_bounds');
  assert.equal(validateNeonGridPayload(payload({ mistakes: -1 })).reason, 'negative_mistakes');
  assert.equal(validateNeonGridPayload(payload({ mistakes: NEON_GRID_LIMITS.MAX_MISTAKES + 1 })).reason, 'mistakes_out_of_bounds');
  assert.equal(validateNeonGridPayload(payload({ bestStreak: -1 })).reason, 'negative_streak');
  assert.equal(validateNeonGridPayload(payload({ bestStreak: NEON_GRID_LIMITS.MAX_STREAK + 1 })).reason, 'streak_out_of_bounds');
  assert.equal(validateNeonGridPayload(payload({ durationMs: NEON_GRID_LIMITS.MIN_DURATION_MS - 1 })).reason, 'duration_out_of_bounds');
  assert.equal(validateNeonGridPayload(payload({ durationMs: NEON_GRID_LIMITS.MAX_DURATION_MS + 1 })).reason, 'duration_out_of_bounds');
});

test('client-supplied ticket fields do not affect validation (ignored downstream)', () => {
  assert.equal(validateNeonGridPayload(payload({ tickets: 9999, awarded: 9999 })).ok, true);
});
