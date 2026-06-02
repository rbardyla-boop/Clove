/**
 * A (ticket formula) + C (score validation) — Phase 1e.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTickets, validateScorePayload, GRADE_BASE, LIMITS } from '../../workers/arcade/src/tickets.mjs';

test('grades map to their base ticket value', () => {
  for (const [grade, base] of Object.entries(GRADE_BASE)) {
    assert.equal(computeTickets({ grade, score: 0, accuracy: 0 }), base, `grade ${grade}`);
  }
});

test('score bonus is capped at SCORE_BONUS_CAP', () => {
  // huge score on grade A: base 18 + capped 10 = 28 (no accuracy bonus at 0)
  assert.equal(computeTickets({ grade: 'A', score: 1_000_000, accuracy: 0 }), 18 + LIMITS.SCORE_BONUS_CAP);
});

test('accuracy bonus is capped and tiered', () => {
  assert.equal(computeTickets({ grade: 'B', score: 0, accuracy: 100 }), 12 + 5); // high tier
  assert.equal(computeTickets({ grade: 'B', score: 0, accuracy: 92 }), 12 + 3);  // mid tier
  assert.equal(computeTickets({ grade: 'B', score: 0, accuracy: 50 }), 12);      // none
});

test('absolute max payout per round is enforced (40)', () => {
  assert.equal(computeTickets({ grade: 'S', score: 1_000_000, accuracy: 100 }), 40);
  // even a contrived huge input cannot exceed the cap
  assert.ok(computeTickets({ grade: 'S', score: Number.MAX_SAFE_INTEGER, accuracy: 100 }) <= LIMITS.MAX_PAYOUT);
});

test('F grade earns zero', () => {
  assert.equal(computeTickets({ grade: 'F', score: 9000, accuracy: 100 }), 0 + 10 + 5); // base 0 + bonuses
  assert.equal(computeTickets({ grade: 'F', score: 0, accuracy: 0 }), 0);
});

function goodPayload(over = {}) {
  return { roundId: 'r1', machineId: 'pulse', grade: 'A', score: 1500, accuracy: 85, durationMs: 30000, hits: 14, bestStreak: 8, ...over };
}

test('a well-formed payload validates', () => {
  assert.deepEqual(validateScorePayload(goodPayload()), { ok: true, reason: null });
});

test('malformed payloads are rejected', () => {
  assert.equal(validateScorePayload(null).reason, 'malformed');
  assert.equal(validateScorePayload({}).reason, 'malformed');
  assert.equal(validateScorePayload(goodPayload({ score: 1.5 })).reason, 'malformed');
  assert.equal(validateScorePayload(goodPayload({ roundId: '' })).reason, 'malformed');
  assert.equal(validateScorePayload(goodPayload({ hits: -1 })).reason, 'malformed');
});

test('out-of-bounds score / accuracy / duration are rejected', () => {
  assert.equal(validateScorePayload(goodPayload({ score: -5 })).reason, 'negative_score');
  assert.equal(validateScorePayload(goodPayload({ score: LIMITS.MAX_SCORE + 1 })).reason, 'score_out_of_bounds');
  assert.equal(validateScorePayload(goodPayload({ accuracy: 101 })).reason, 'accuracy_out_of_bounds');
  assert.equal(validateScorePayload(goodPayload({ accuracy: -1 })).reason, 'accuracy_out_of_bounds');
  assert.equal(validateScorePayload(goodPayload({ durationMs: 10 })).reason, 'duration_out_of_bounds');
  assert.equal(validateScorePayload(goodPayload({ durationMs: 999999 })).reason, 'duration_out_of_bounds');
});

test('unknown grade is rejected', () => {
  assert.equal(validateScorePayload(goodPayload({ grade: 'Z' })).reason, 'bad_grade');
});
