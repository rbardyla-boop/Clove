/**
 * Phase 1 parity — round authority + cross-cabinet-type rejection.
 *
 * The pure module is the authority twin of the product round-authority. A few
 * cases also run through the simulator so occupancy (the fold's occupancy slice)
 * really drives the occupant check.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArcade, startRound, submitRound, getBalance, expireActorRounds } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import { GRID_LIMITS } from '../../arcade/hiveworld-sim/core/phase1/tickets.mjs';
import { HiveSimulator } from '../../arcade/hiveworld-sim/core/simulator.mjs';
import { arcadeRoom } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';

const A = 'agent:a';
const B = 'agent:b';
const gridResult = (over = {}) => ({ roundId: 'g1', machineId: 'grid', cabinetType: 'neon_grid', rulesetVersion: 'neon-grid-v1', grade: 'A', score: 5000, correctSteps: 40, completedPatterns: 6, mistakes: 2, bestStreak: 18, durationMs: 22000, ...over });
const pulseResult = (over = {}) => ({ roundId: 'g1', machineId: 'pulse', grade: 'A', score: 1825, accuracy: 88, hits: 16, bestStreak: 9, durationMs: 30000, ...over });

function startGrid(arcade, { occupant = A, actor = A, roundId = 'g1', tick = 100 } = {}) {
  return startRound(arcade, { machineId: 'grid', occupantId: occupant, actor, roundId, tick });
}

test('occupant can start a round; the round records its cabinet type + ruleset', () => {
  const r = startGrid(createArcade());
  assert.equal(r.ok, true);
  assert.equal(r.started.cabinetType, 'neon_grid');
  assert.equal(r.started.rulesetVersion, 'neon-grid-v1');
  assert.equal(r.arcade.rounds.g1.status, 'active');
});

test('a non-occupant cannot start a round', () => {
  const r = startRound(createArcade(), { machineId: 'grid', occupantId: A, actor: B, roundId: 'g1', tick: 100 });
  assert.equal(r.reason, 'not_occupant');
});

test('a valid submit is accepted exactly once; a duplicate is rejected (no double award)', () => {
  let { arcade } = startGrid(createArcade());
  const first = submitRound(arcade, { payload: gridResult(), senderId: A, occupantId: A, tick: 101 });
  assert.equal(first.ok, true);
  assert.equal(first.awarded, 26);
  arcade = first.arcade;
  const dup = submitRound(arcade, { payload: gridResult(), senderId: A, occupantId: A, tick: 102 });
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, 'duplicate_submission');
  assert.equal(getBalance(dup.arcade, A), 26);
});

test('wrong session / wrong cabinet / wrong type / wrong ruleset are rejected', () => {
  const { arcade } = startGrid(createArcade());
  assert.equal(submitRound(arcade, { payload: gridResult(), senderId: B, occupantId: A, tick: 101 }).reason, 'wrong_session');
  assert.equal(submitRound(arcade, { payload: gridResult({ machineId: 'pulse' }), senderId: A, occupantId: A, tick: 101 }).reason, 'wrong_cabinet');
  assert.equal(submitRound(arcade, { payload: gridResult({ cabinetType: 'signal_sprint' }), senderId: A, occupantId: A, tick: 101 }).reason, 'wrong_cabinet_type');
  assert.equal(submitRound(arcade, { payload: gridResult({ rulesetVersion: 'x' }), senderId: A, occupantId: A, tick: 101 }).reason, 'wrong_ruleset');
});

test('cross-game results cannot be submitted to the wrong round', () => {
  // Pulse result → Grid round (labelled): wrong_cabinet_type
  const { arcade } = startGrid(createArcade());
  assert.equal(submitRound(arcade, { payload: { ...pulseResult({ machineId: 'grid' }), cabinetType: 'pulse_tap' }, senderId: A, occupantId: A, tick: 101 }).reason, 'wrong_cabinet_type');
  // Pulse-shaped result, unlabelled → grid validator rejects (no correctSteps/patterns/mistakes)
  assert.equal(submitRound(arcade, { payload: pulseResult({ machineId: 'grid' }), senderId: A, occupantId: A, tick: 101 }).reason, 'malformed');
  // Grid result → Pulse round
  const pulseRound = startRound(createArcade(), { machineId: 'pulse', occupantId: A, actor: A, roundId: 'g1', tick: 100 });
  assert.equal(submitRound(pulseRound.arcade, { payload: gridResult({ machineId: 'pulse' }), senderId: A, occupantId: A, tick: 101 }).reason, 'wrong_cabinet_type');
});

test('an expired round (and a released/disconnected round) is rejected', () => {
  const { arcade } = startGrid(createArcade(), { tick: 100 });
  assert.equal(submitRound(arcade, { payload: gridResult(), senderId: A, occupantId: A, tick: 100 + GRID_LIMITS.MAX_ROUND_TICKS + 1 }).reason, 'round_expired');
  const expired = expireActorRounds(arcade, A);
  assert.equal(submitRound(expired, { payload: gridResult(), senderId: A, occupantId: A, tick: 101 }).reason, 'round_expired');
});

test('impossible values are rejected; client-supplied ticket amount is ignored', () => {
  const { arcade } = startGrid(createArcade());
  assert.equal(submitRound(arcade, { payload: gridResult({ completedPatterns: GRID_LIMITS.MAX_PATTERNS + 1 }), senderId: A, occupantId: A, tick: 101 }).reason, 'patterns_out_of_bounds');
  const r = submitRound(arcade, { payload: gridResult({ tickets: 9999, awarded: 9999 }), senderId: A, occupantId: A, tick: 101 });
  assert.equal(r.ok, true);
  assert.equal(r.awarded, 26);
});

test('through the simulator, occupancy (the fold) drives the occupant check', () => {
  const sim = new HiveSimulator({ seed: 'ra' });
  const room = sim.addRoom({ id: 'room:main', name: 'M' });
  const a = sim.addAgent({ id: A }); const b = sim.addAgent({ id: B });
  sim.publish(room.announce(0)); sim.publish(a.announce(0)); sim.publish(b.announce(0));
  sim.publish(a.occupy('room:main', 'grid', 1));
  sim.publish(a.startArcadeRound('room:main', 'grid', 'g1', 2));
  // B tries to submit A's ACTIVE round → wrong_session
  sim.publish(b.submitArcadeRound('room:main', 'grid', gridResult(), 3));
  sim.publish(a.submitArcadeRound('room:main', 'grid', gridResult(), 4));
  sim.advance(1);
  const rep = sim.report();
  assert.equal(arcadeRoom(rep.finalWorldState.arcade,'room:main').balances[A], 26);
  assert.equal(arcadeRoom(rep.finalWorldState.arcade,'room:main').balances[B] || 0, 0);
  assert.ok(rep.rejectedEvents.some((r) => r.reason === 'wrong_session'));
});
