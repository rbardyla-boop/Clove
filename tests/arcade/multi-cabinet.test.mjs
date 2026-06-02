/**
 * Phase 1g — D. Multi-cabinet integration.
 *
 * Pulse Tap and Signal Sprint share ONE room/session balance + ledger. A player
 * earns from either cabinet; both awards land in the same balance; the ledger
 * records both sources; the Prize Counter redeems against the combined balance.
 * Cross-player isolation (B cannot spend A's tickets or submit A's round) holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTicketState, startRound, submitRound, getBalance,
} from '../../workers/arcade/src/round-authority.mjs';
import { getLedger } from '../../workers/arcade/src/ledger.mjs';
import { redeemPrize } from '../../workers/arcade/src/prize-authority.mjs';
import { computeTickets } from '../../workers/arcade/src/tickets.mjs';
import { computeSignalTickets } from '../../workers/arcade/src/signal-sprint.mjs';

const NOW = 3_000_000;
const A = 'player:a';
const B = 'player:b';

const pulsePayload = (over = {}) => ({ roundId: 'p1', machineId: 'pulse', grade: 'A', score: 1500, accuracy: 85, durationMs: 30000, hits: 14, bestStreak: 8, ...over });
const signalPayload = (over = {}) => ({ roundId: 's1', machineId: 'signal', cabinetType: 'signal_sprint', rulesetVersion: 'signal-sprint/1', grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000, ...over });

function earnPulse(state, { player = A, roundId = 'p1', now = NOW } = {}) {
  const started = startRound(state, { machineId: 'pulse', occupantId: player, playerId: player, roundId, now });
  return submitRound(started.state, { payload: pulsePayload({ roundId }), senderId: player, occupantId: player, now: now + 30000 });
}
function earnSignal(state, { player = A, roundId = 's1', now = NOW } = {}) {
  const started = startRound(state, { machineId: 'signal', occupantId: player, playerId: player, roundId, now });
  return submitRound(started.state, { payload: signalPayload({ roundId }), senderId: player, occupantId: player, now: now + 25000 });
}

const PULSE_AWARD = computeTickets({ grade: 'A', score: 1500, accuracy: 85 });          // 20
const SIGNAL_AWARD = computeSignalTickets({ grade: 'A', distance: 1800, maxStreak: 14, noiseHits: 6 }); // 16 + 7 + 3 - 2 = 24

test('a player earns tickets from BOTH cabinets into one shared balance', () => {
  let state = createTicketState();
  state = earnPulse(state).state;
  state = earnSignal(state).state;
  assert.equal(getBalance(state, A), PULSE_AWARD + SIGNAL_AWARD);
});

test('the ledger records one entry per cabinet with the correct source + cabinet_type', () => {
  let state = createTicketState();
  state = earnPulse(state).state;
  state = earnSignal(state).state;
  const led = getLedger(state, A);
  assert.equal(led.length, 2);
  const pulseEntry = led.find((e) => e.cabinet_type === 'pulse_tap');
  const signalEntry = led.find((e) => e.cabinet_type === 'signal_sprint');
  assert.ok(pulseEntry && pulseEntry.source === 'pulse' && pulseEntry.delta === PULSE_AWARD);
  assert.ok(signalEntry && signalEntry.source === 'signal' && signalEntry.delta === SIGNAL_AWARD);
});

test('the Prize Counter redeems against the COMBINED cross-cabinet balance', () => {
  let state = createTicketState();
  state = earnPulse(state).state;     // 20
  state = earnSignal(state).state;    // +24 → 44
  const redeemed = redeemPrize(state, { prizeId: 'pulse-jacket', playerId: A, now: NOW, redemptionId: 'rd1' }); // cost 35
  assert.equal(redeemed.ok, true);
  assert.equal(redeemed.balance, PULSE_AWARD + SIGNAL_AWARD - 35);
  // The same prize would NOT have been affordable from either cabinet alone.
  assert.ok(PULSE_AWARD < 35 && SIGNAL_AWARD < 35);
});

test('balances are per-player — B cannot spend A’s combined tickets', () => {
  let state = createTicketState();
  state = earnPulse(state, { player: A, roundId: 'p1' }).state;
  state = earnSignal(state, { player: A, roundId: 's1' }).state;
  const r = redeemPrize(state, { prizeId: 'founder-badge-local', playerId: B, now: NOW, redemptionId: 'x' }); // B has 0
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'insufficient_tickets');
  assert.equal(getBalance(r.state, A), PULSE_AWARD + SIGNAL_AWARD); // A untouched
});

test('B cannot submit A’s active Signal Sprint round (occupancy + identity preserved)', () => {
  const started = startRound(createTicketState(), { machineId: 'signal', occupantId: A, playerId: A, roundId: 's1', now: NOW });
  const bAttempt = submitRound(started.state, { payload: signalPayload(), senderId: B, occupantId: A, now: NOW + 1000 });
  assert.equal(bAttempt.ok, false);
  assert.equal(bAttempt.reason, 'wrong_session');
  assert.equal(getBalance(bAttempt.state, B), 0);
});

test('two players earn independently on the two cabinets (no cross-contamination)', () => {
  let state = createTicketState();
  state = earnPulse(state, { player: A, roundId: 'pa' }).state;     // A: 20 (pulse)
  state = earnSignal(state, { player: B, roundId: 'sb' }).state;    // B: 24 (signal)
  assert.equal(getBalance(state, A), PULSE_AWARD);
  assert.equal(getBalance(state, B), SIGNAL_AWARD);
});
