/**
 * Phase 1g — Signal Sprint round authority (B) + cross-cabinet-type rejection.
 *
 * Reuses the SAME pure round engine as Pulse Tap; the cabinet type, ruleset and
 * payout are resolved server-side from the catalog by machine id.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTicketState, startRound, submitRound, expirePlayerRounds, getBalance,
} from '../../workers/arcade/src/round-authority.mjs';
import { computeSignalTickets, SIGNAL_LIMITS } from '../../workers/arcade/src/signal-sprint.mjs';

const NOW = 1_000_000;
const A = 'player:a';
const B = 'player:b';

function startSignal(stateIn, { player = A, occupant = A, roundId = 's1', now = NOW } = {}) {
  return startRound(stateIn, { machineId: 'signal', occupantId: occupant, playerId: player, roundId, now });
}
function signalPayload(over = {}) {
  return {
    roundId: 's1', machineId: 'signal', cabinetType: 'signal_sprint', rulesetVersion: 'signal-sprint/1',
    grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000, ...over,
  };
}
function pulsePayload(over = {}) {
  return { roundId: 's1', machineId: 'pulse', grade: 'A', score: 1500, accuracy: 85, durationMs: 30000, hits: 14, bestStreak: 8, ...over };
}

// ── B. round lifecycle ────────────────────────────────────────────────────────
test('the Signal Sprint occupant can start a round; the round records its cabinet type', () => {
  const r = startSignal(createTicketState());
  assert.equal(r.ok, true);
  assert.equal(r.started.cabinetId, 'signal-sprint-01');
  assert.equal(r.started.cabinetType, 'signal_sprint');
  assert.equal(r.started.rulesetVersion, 'signal-sprint/1');
  assert.equal(r.state.rounds.s1.status, 'active');
  assert.equal(r.state.rounds.s1.cabinetType, 'signal_sprint');
});

test('a non-occupant cannot start a Signal Sprint round', () => {
  const r = startRound(createTicketState(), { machineId: 'signal', occupantId: A, playerId: B, roundId: 's1', now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not_occupant');
});

test('an unknown cabinet is still rejected as invalid_cabinet', () => {
  const r = startRound(createTicketState(), { machineId: 'claw', occupantId: A, playerId: A, roundId: 's1', now: NOW });
  assert.equal(r.reason, 'invalid_cabinet');
});

test('a Signal Sprint submission is accepted exactly once; duplicates are rejected', () => {
  let { state } = startSignal(createTicketState());
  const first = submitRound(state, { payload: signalPayload(), senderId: A, occupantId: A, now: NOW + 25000 });
  assert.equal(first.ok, true);
  assert.equal(first.awarded, computeSignalTickets({ grade: 'A', distance: 1800, maxStreak: 14, noiseHits: 6 }));
  assert.equal(first.balance, first.awarded);
  state = first.state;
  const dup = submitRound(state, { payload: signalPayload(), senderId: A, occupantId: A, now: NOW + 26000 });
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, 'duplicate_submission');
  assert.equal(getBalance(dup.state, A), first.awarded);
});

test('a submission for the wrong cabinet (machine mismatch) is rejected', () => {
  const { state } = startSignal(createTicketState());
  const r = submitRound(state, { payload: signalPayload({ machineId: 'pulse' }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.reason, 'wrong_cabinet');
});

test('a labelled wrong cabinet TYPE is rejected', () => {
  const { state } = startSignal(createTicketState());
  const r = submitRound(state, { payload: signalPayload({ cabinetType: 'pulse_tap' }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.reason, 'wrong_cabinet_type');
});

test('a wrong ruleset version is rejected', () => {
  const { state } = startSignal(createTicketState());
  const r = submitRound(state, { payload: signalPayload({ rulesetVersion: 'signal-sprint/999' }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.reason, 'wrong_ruleset');
});

test('a Pulse Tap result cannot be submitted to a Signal Sprint round', () => {
  const { state } = startSignal(createTicketState());
  // Pulse-shaped payload, but aimed at the signal machine + round.
  const labelled = submitRound(state, { payload: { ...pulsePayload({ machineId: 'signal' }), cabinetType: 'pulse_tap' }, senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(labelled.reason, 'wrong_cabinet_type');
  // Even unlabelled, the signal validator rejects a pulse-shaped result (no distance/pulses).
  const unlabelled = submitRound(state, { payload: pulsePayload({ machineId: 'signal' }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(unlabelled.ok, false);
  assert.equal(unlabelled.reason, 'malformed');
});

test('a Signal Sprint result cannot be submitted to a Pulse Tap round', () => {
  let { state } = startRound(createTicketState(), { machineId: 'pulse', occupantId: A, playerId: A, roundId: 's1', now: NOW });
  const labelled = submitRound(state, { payload: signalPayload({ machineId: 'pulse' }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(labelled.reason, 'wrong_cabinet_type');
});

test('an expired Signal Sprint round is rejected', () => {
  const { state } = startSignal(createTicketState());
  const r = submitRound(state, { payload: signalPayload(), senderId: A, occupantId: A, now: NOW + SIGNAL_LIMITS.MAX_ROUND_MS + 1 });
  assert.equal(r.reason, 'round_expired');
});

test('release/disconnect expires the active Signal Sprint round', () => {
  let { state } = startSignal(createTicketState());
  state = expirePlayerRounds(state, A);
  assert.equal(state.rounds.s1.status, 'expired');
  const r = submitRound(state, { payload: signalPayload(), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.reason, 'round_expired');
});

test('a non-occupant cannot exploit the active Signal Sprint round', () => {
  const { state } = startSignal(createTicketState());
  const bAttempt = submitRound(state, { payload: signalPayload(), senderId: B, occupantId: A, now: NOW + 1000 });
  assert.equal(bAttempt.reason, 'wrong_session');
  const aAfterRelease = submitRound(state, { payload: signalPayload(), senderId: A, occupantId: B, now: NOW + 1000 });
  assert.equal(aAfterRelease.reason, 'not_occupant');
});

test('client-supplied ticket counts are ignored — server computes the Signal Sprint award', () => {
  const { state } = startSignal(createTicketState());
  const r = submitRound(state, { payload: signalPayload({ tickets: 9999, awarded: 9999 }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.awarded, computeSignalTickets({ grade: 'A', distance: 1800, maxStreak: 14, noiseHits: 6 }));
  assert.notEqual(r.awarded, 9999);
});
