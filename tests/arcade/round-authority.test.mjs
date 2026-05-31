/**
 * B (round lifecycle) + C (authority) + D (occupancy integration) + E (reconnect/state).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTicketState, startRound, submitRound, expirePlayerRounds, getBalance, pruneExpired,
} from '../../workers/arcade/src/round-authority.mjs';
import { computeTickets, LIMITS } from '../../workers/arcade/src/tickets.mjs';

const NOW = 1_000_000;
const A = 'player:a';
const B = 'player:b';

function startedRound(stateIn, { player = A, occupant = A, roundId = 'r1', machineId = 'pulse', now = NOW } = {}) {
  return startRound(stateIn, { machineId, occupantId: occupant, playerId: player, roundId, now });
}
function payload(over = {}) {
  return { roundId: 'r1', machineId: 'pulse', grade: 'A', score: 1500, accuracy: 85, durationMs: 30000, hits: 14, bestStreak: 8, ...over };
}

// ── B: round lifecycle ────────────────────────────────────────────────────────
test('server starts a round for the current occupant', () => {
  const r = startedRound(createTicketState());
  assert.equal(r.ok, true);
  assert.equal(r.started.roundId, 'r1');
  assert.equal(r.state.rounds.r1.status, 'active');
});

test('a non-occupant cannot start a round', () => {
  const r = startRound(createTicketState(), { machineId: 'pulse', occupantId: A, playerId: B, roundId: 'r1', now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not_occupant');
});

test('an unknown cabinet is rejected', () => {
  const r = startRound(createTicketState(), { machineId: 'claw', occupantId: A, playerId: A, roundId: 'r1', now: NOW });
  assert.equal(r.reason, 'invalid_cabinet');
});

test('a submission is accepted exactly once; duplicates are rejected with no double-award', () => {
  let { state } = startedRound(createTicketState());
  const first = submitRound(state, { payload: payload(), senderId: A, occupantId: A, now: NOW + 30000 });
  assert.equal(first.ok, true);
  assert.equal(first.awarded, computeTickets({ grade: 'A', score: 1500, accuracy: 85 }));
  assert.equal(first.balance, first.awarded);
  state = first.state;
  const dup = submitRound(state, { payload: payload(), senderId: A, occupantId: A, now: NOW + 31000 });
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, 'duplicate_submission');
  assert.equal(getBalance(dup.state, A), first.awarded); // unchanged
});

test('an unknown round id is rejected', () => {
  const { state } = startedRound(createTicketState());
  const r = submitRound(state, { payload: payload({ roundId: 'nope' }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.reason, 'unknown_round');
});

test('an expired round is rejected', () => {
  const { state } = startedRound(createTicketState());
  const r = submitRound(state, { payload: payload(), senderId: A, occupantId: A, now: NOW + LIMITS.MAX_ROUND_MS + 1 });
  assert.equal(r.reason, 'round_expired');
});

test('a submission from the wrong session is rejected', () => {
  const { state } = startedRound(createTicketState());
  const r = submitRound(state, { payload: payload(), senderId: B, occupantId: A, now: NOW + 1000 });
  assert.equal(r.reason, 'wrong_session');
});

test('a submission for the wrong cabinet is rejected', () => {
  const { state } = startedRound(createTicketState());
  const r = submitRound(state, { payload: payload({ machineId: 'claw' }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.reason, 'wrong_cabinet');
});

// ── C: authority ──────────────────────────────────────────────────────────────
test('client cannot grant tickets directly — submitted ticket count is ignored', () => {
  const { state } = startedRound(createTicketState());
  const r = submitRound(state, { payload: payload({ tickets: 9999, awarded: 9999 }), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.awarded, computeTickets({ grade: 'A', score: 1500, accuracy: 85 }));
  assert.notEqual(r.awarded, 9999);
});

test('impossible / negative score / accuracy / duration are rejected', () => {
  const { state } = startedRound(createTicketState());
  assert.equal(submitRound(state, { payload: payload({ score: -1 }), senderId: A, occupantId: A, now: NOW + 1 }).reason, 'negative_score');
  assert.equal(submitRound(state, { payload: payload({ score: 999999 }), senderId: A, occupantId: A, now: NOW + 1 }).reason, 'score_out_of_bounds');
  assert.equal(submitRound(state, { payload: payload({ accuracy: 250 }), senderId: A, occupantId: A, now: NOW + 1 }).reason, 'accuracy_out_of_bounds');
  assert.equal(submitRound(state, { payload: payload({ durationMs: -10 }), senderId: A, occupantId: A, now: NOW + 1 }).reason, 'duration_out_of_bounds');
});

// ── D: occupancy integration ────────────────────────────────────────────────
test('the occupant can submit; a non-occupant cannot exploit the active round', () => {
  const { state } = startedRound(createTicketState());
  // B tries to submit A's round (B is not the occupant and not the round owner)
  const bAttempt = submitRound(state, { payload: payload(), senderId: B, occupantId: A, now: NOW + 1000 });
  assert.equal(bAttempt.ok, false); // wrong_session
  // occupancy moved to B (A released); A's round is no longer submittable by A either
  const aAfterRelease = submitRound(state, { payload: payload(), senderId: A, occupantId: B, now: NOW + 1000 });
  assert.equal(aAfterRelease.reason, 'not_occupant');
});

test('release/disconnect expires the active round so it cannot be submitted later', () => {
  let { state } = startedRound(createTicketState());
  state = expirePlayerRounds(state, A);
  assert.equal(state.rounds.r1.status, 'expired');
  const r = submitRound(state, { payload: payload(), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(r.reason, 'round_expired');
});

// ── E: reconnect / state ──────────────────────────────────────────────────────
test('balance persists in room/session scope and a duplicate network message does not double-award', () => {
  let { state } = startedRound(createTicketState());
  const s1 = submitRound(state, { payload: payload(), senderId: A, occupantId: A, now: NOW + 1000 });
  state = s1.state;
  assert.equal(getBalance(state, A), s1.awarded); // reconnect would read this same balance
  // identical duplicate network frame
  const s2 = submitRound(state, { payload: payload(), senderId: A, occupantId: A, now: NOW + 1000 });
  assert.equal(s2.ok, false);
  assert.equal(getBalance(s2.state, A), s1.awarded);
});

test('pruneExpired drops fully-elapsed rounds (bounded memory)', () => {
  let { state } = startedRound(createTicketState());
  const submitted = submitRound(state, { payload: payload(), senderId: A, occupantId: A, now: NOW + 1000 }).state;
  const pruned = pruneExpired(submitted, NOW + LIMITS.MAX_ROUND_MS + 1);
  assert.equal(Object.keys(pruned.rounds).length, 0);
  assert.equal(getBalance(pruned, A), getBalance(submitted, A)); // balance survives pruning
});
