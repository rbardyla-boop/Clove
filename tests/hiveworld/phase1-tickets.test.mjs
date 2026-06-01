/**
 * Phase 1 parity — ticket formulas + result validators for all three cabinets.
 * Byte-faithful to the product (workers/arcade/src/{tickets,signal-sprint,neon-grid}.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PULSE_BASE, SIGNAL_BASE, GRID_BASE, GRADES,
  computePulseTickets, computeSignalTickets, computeGridTickets,
  validatePulsePayload, validateSignalPayload, validateGridPayload,
  PULSE_LIMITS, SIGNAL_LIMITS, GRID_LIMITS, getRuleset, resolveRulesetByMachine,
} from '../../arcade/hiveworld-sim/core/phase1/tickets.mjs';

test('each cabinet has distinct grade base awards', () => {
  assert.deepEqual(PULSE_BASE, { S: 25, A: 18, B: 12, C: 7, D: 3, F: 0 });
  assert.deepEqual(SIGNAL_BASE, { S: 22, A: 16, B: 11, C: 6, D: 3, F: 0 });
  assert.deepEqual(GRID_BASE, { S: 24, A: 17, B: 12, C: 7, D: 3, F: 0 });
});

test('Pulse Tap: base + score bonus (cap 10) + accuracy bonus, cap 40', () => {
  for (const g of GRADES) assert.equal(computePulseTickets({ grade: g, score: 0, accuracy: 0 }), PULSE_BASE[g]);
  assert.equal(computePulseTickets({ grade: 'A', score: 1825, accuracy: 88 }), 20); // 18 + 2 + 0
  assert.equal(computePulseTickets({ grade: 'A', score: 1825, accuracy: 90 }), 23); // 18 + 2 + 3
  assert.equal(computePulseTickets({ grade: 'S', score: 100000, accuracy: 100 }), PULSE_LIMITS.MAX_PAYOUT); // capped
});

test('Signal Sprint: base + distance bonus + streak − noise penalty, cap 35, floor 0', () => {
  assert.equal(computeSignalTickets({ grade: 'A', distance: 1800, maxStreak: 14, noiseHits: 6 }), 24); // 16 + 7 + 3 − 2
  assert.equal(computeSignalTickets({ grade: 'F', distance: 0, maxStreak: 0, noiseHits: 999 }), 0); // floor
  assert.equal(computeSignalTickets({ grade: 'S', distance: 12000, maxStreak: 2000, noiseHits: 0 }), SIGNAL_LIMITS.MAX_PAYOUT);
});

test('Neon Grid: base + pattern bonus (cap 8) + streak − mistake penalty, cap 38, floor 0', () => {
  assert.equal(computeGridTickets({ grade: 'A', completedPatterns: 6, bestStreak: 18, mistakes: 2 }), 26); // 17 + 6 + 3 − 0
  assert.equal(computeGridTickets({ grade: 'F', completedPatterns: 0, bestStreak: 0, mistakes: 128 }), 0); // floor
  assert.equal(computeGridTickets({ grade: 'F', completedPatterns: 100, bestStreak: 0, mistakes: 0 }), GRID_LIMITS.PATTERN_BONUS_CAP); // pattern capped
  assert.equal(computeGridTickets({ grade: 'S', completedPatterns: 64, bestStreak: 256, mistakes: 0 }), 37); // ≤ cap 38
});

test('validators reject malformed / bad grade / out-of-bounds / impossible values', () => {
  assert.equal(validatePulsePayload({ roundId: 'r', machineId: 'pulse', grade: 'Z', score: 1, accuracy: 1, durationMs: 30000, hits: 1, bestStreak: 1 }).reason, 'bad_grade');
  assert.equal(validatePulsePayload({ roundId: 'r', machineId: 'pulse', grade: 'A', score: -1, accuracy: 1, durationMs: 30000, hits: 1, bestStreak: 1 }).reason, 'negative_score');
  assert.equal(validatePulsePayload({ roundId: 'r', machineId: 'pulse', grade: 'A', score: 1, accuracy: 200, durationMs: 30000, hits: 1, bestStreak: 1 }).reason, 'accuracy_out_of_bounds');
  assert.equal(validateSignalPayload({ roundId: 'r', machineId: 'signal', grade: 'A', score: 1, distance: 1, pulsesCollected: 1, noiseHits: 1, maxStreak: 1, durationMs: 1 }).reason, 'duration_out_of_bounds');
  assert.equal(validateGridPayload({ roundId: 'r', machineId: 'grid', grade: 'A', score: 1, correctSteps: 1, completedPatterns: GRID_LIMITS.MAX_PATTERNS + 1, mistakes: 0, bestStreak: 1, durationMs: 22000 }).reason, 'patterns_out_of_bounds');
  assert.equal(validateGridPayload(null).reason, 'malformed');
});

test('a valid payload for each cabinet passes', () => {
  assert.equal(validatePulsePayload({ roundId: 'r', machineId: 'pulse', grade: 'A', score: 1825, accuracy: 88, durationMs: 30000, hits: 16, bestStreak: 9 }).ok, true);
  assert.equal(validateSignalPayload({ roundId: 'r', machineId: 'signal', grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000 }).ok, true);
  assert.equal(validateGridPayload({ roundId: 'r', machineId: 'grid', grade: 'A', score: 5000, correctSteps: 40, completedPatterns: 6, mistakes: 2, bestStreak: 18, durationMs: 22000 }).ok, true);
});

test('rulesets resolve server-side by machine id; unknown/unsupported cabinets resolve to null', () => {
  assert.equal(resolveRulesetByMachine('pulse').cabinet.cabinet_type, 'pulse_tap');
  assert.equal(resolveRulesetByMachine('signal').cabinet.cabinet_type, 'signal_sprint');
  assert.equal(resolveRulesetByMachine('grid').cabinet.cabinet_type, 'neon_grid');
  assert.equal(resolveRulesetByMachine('myx'), null);  // mystery_x has no ruleset
  assert.equal(resolveRulesetByMachine('nope'), null);
  assert.equal(getRuleset('neon_grid').rulesetVersion, 'neon-grid-v1');
});
