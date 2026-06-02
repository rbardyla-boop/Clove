/**
 * Phase 1l — D. Neon Grid round authority + cross-cabinet-type rejection.
 *
 * Neon Grid reuses the SAME pure round engine as Pulse Tap + Signal Sprint; the
 * cabinet type, ruleset and payout are resolved server-side from the catalog by
 * machine id ('grid'). A client can never pick a more generous validator/formula
 * or submit one cabinet's result to another.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTicketState, startRound, submitRound, expirePlayerRounds, getBalance,
} from '../../workers/arcade/src/round-authority.mjs';
import { computeNeonGridTickets, NEON_GRID_LIMITS } from '../../workers/arcade/src/neon-grid.mjs';

const NOW = 2_000_000;
const A = 'player:a';
const B = 'player:b';

function startGrid(stateIn, { player = A, occupant = A, roundId = 'g1', now = NOW } = {}) {
  return startRound(stateIn, { machineId: 'grid', occupantId: occupant, playerId: player, roundId, now });
}
function gridPayload(over = {}) {
  return {
    roundId: 'g1', machineId: 'grid', cabinetType: 'neon_grid', rulesetVersion: 'neon-grid-v1',
    grade: 'A', score: 5000, correctSteps: 40, completedPatterns: 6, mistakes: 2, bestStreak: 18, durationMs: 22000, ...over,
  };
}
function signalPayload(over = {}) {
  return { roundId: 'g1', machineId: 'signal', cabinetType: 'signal_sprint', rulesetVersion: 'signal-sprint/1', grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000, ...over };
}

const GRID_AWARD = computeNeonGridTickets({ grade: 'A', completedPatterns: 6, bestStreak: 18, mistakes: 2 }); // 26

test('the Neon Grid occupant can start a round; the round records its cabinet type + ruleset', () => {
  const r = startGrid(createTicketState());
  assert.equal(r.ok, true);
  assert.equal(r.started.cabinetId, 'neon-grid-01');
  assert.equal(r.started.cabinetType, 'neon_grid');
  assert.equal(r.started.rulesetVersion, 'neon-grid-v1');
  assert.equal(r.state.rounds.g1.status, 'active');
  assert.equal(r.state.rounds.g1.cabinetType, 'neon_grid');
});

test('a non-occupant cannot start a Neon Grid round', () => {
  const r = startRound(createTicketState(), { machineId: 'grid', occupantId: A, playerId: B, roundId: 'g1', now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not_occupant');
});

test('a Neon Grid submission is accepted exactly once; duplicates are rejected', () => {
  let { state } = startGrid(createTicketState());
  const first = submitRound(state, { payload: gridPayload(), senderId: A, occupantId: A, now: NOW + 22000 });
  assert.equal(first.ok, true);
  assert.equal(first.awarded, GRID_AWARD);
  assert.equal(first.balance, GRID_AWARD);
  state = first.state;
  const dup = submitRound(state, { payload: gridPayload(), senderId: A, occupantId: A, now: NOW + 23000 });
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, 'duplicate_submission');
  assert.equal(getBalance(dup.state, A), GRID_AWARD);
});

test('a submission for the wrong machine is rejected', () => {
  const { state } = startGrid(createTicketState());
  const r = submitRound(state, { payload: gridPayload({ machineId: 'pulse' }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.reason, 'wrong_cabinet');
});

test('a labelled wrong cabinet TYPE / ruleset is rejected', () => {
  const { state } = startGrid(createTicketState());
  assert.equal(submitRound(state, { payload: gridPayload({ cabinetType: 'signal_sprint' }), senderId: A, occupantId: A, now: NOW + 1000 }).reason, 'wrong_cabinet_type');
  assert.equal(submitRound(state, { payload: gridPayload({ rulesetVersion: 'neon-grid-v999' }), senderId: A, occupantId: A, now: NOW + 1000 }).reason, 'wrong_ruleset');
});

test('a Signal Sprint result cannot be submitted to a Neon Grid round', () => {
  const { state } = startGrid(createTicketState());
  const labelled = submitRound(state, { payload: signalPayload({ machineId: 'grid' }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(labelled.reason, 'wrong_cabinet_type');
  // even unlabelled, the grid validator rejects a signal-shaped result (no correctSteps/patterns/mistakes)
  const unlabelled = submitRound(state, { payload: { roundId: 'g1', machineId: 'grid', grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000 }, senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(unlabelled.ok, false);
  assert.equal(unlabelled.reason, 'malformed');
});

test('a Neon Grid result cannot be submitted to a Signal Sprint round', () => {
  const { state } = startRound(createTicketState(), { machineId: 'signal', occupantId: A, playerId: A, roundId: 'g1', now: NOW });
  const labelled = submitRound(state, { payload: gridPayload({ machineId: 'signal' }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(labelled.reason, 'wrong_cabinet_type');
});

test('impossible Neon Grid values are rejected by the resolved validator', () => {
  const { state } = startGrid(createTicketState());
  assert.equal(submitRound(state, { payload: gridPayload({ score: NEON_GRID_LIMITS.MAX_SCORE + 1 }), senderId: A, occupantId: A, now: NOW + 1000 }).reason, 'score_out_of_bounds');
  assert.equal(submitRound(state, { payload: gridPayload({ completedPatterns: NEON_GRID_LIMITS.MAX_PATTERNS + 1 }), senderId: A, occupantId: A, now: NOW + 1000 }).reason, 'patterns_out_of_bounds');
  assert.equal(submitRound(state, { payload: gridPayload({ mistakes: -1 }), senderId: A, occupantId: A, now: NOW + 1000 }).reason, 'negative_mistakes');
  assert.equal(submitRound(state, { payload: gridPayload({ grade: 'Z' }), senderId: A, occupantId: A, now: NOW + 1000 }).reason, 'bad_grade');
});

test('an expired Neon Grid round is rejected', () => {
  const { state } = startGrid(createTicketState());
  const r = submitRound(state, { payload: gridPayload(), senderId: A, occupantId: A, now: NOW + NEON_GRID_LIMITS.MAX_ROUND_MS + 1 });
  assert.equal(r.reason, 'round_expired');
});

test('release/disconnect expires the active Neon Grid round', () => {
  let { state } = startGrid(createTicketState());
  state = expirePlayerRounds(state, A);
  assert.equal(state.rounds.g1.status, 'expired');
  assert.equal(submitRound(state, { payload: gridPayload(), senderId: A, occupantId: A, now: NOW + 1000 }).reason, 'round_expired');
});

test('a non-occupant / wrong session cannot exploit the active Neon Grid round', () => {
  const { state } = startGrid(createTicketState());
  assert.equal(submitRound(state, { payload: gridPayload(), senderId: B, occupantId: A, now: NOW + 1000 }).reason, 'wrong_session');
  assert.equal(submitRound(state, { payload: gridPayload(), senderId: A, occupantId: B, now: NOW + 1000 }).reason, 'not_occupant');
});

test('client-supplied ticket counts are ignored — the server computes the Neon Grid award', () => {
  const { state } = startGrid(createTicketState());
  const r = submitRound(state, { payload: gridPayload({ tickets: 9999, awarded: 9999 }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.awarded, GRID_AWARD);
  assert.notEqual(r.awarded, 9999);
});
