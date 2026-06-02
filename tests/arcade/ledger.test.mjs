/**
 * B. Ticket ledger tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendLedger, getLedger, makeLedgerId } from '../../workers/arcade/src/ledger.mjs';
import { createTicketState, startRound, submitRound, getBalance } from '../../workers/arcade/src/round-authority.mjs';

const NOW = 1_000_000;
const A = 'player:a';
const B = 'player:b';
const payload = (over = {}) => ({ roundId: 'r1', machineId: 'pulse', grade: 'A', score: 1500, accuracy: 85, durationMs: 30000, hits: 14, bestStreak: 8, ...over });

test('awarding tickets records a ledger entry whose balance_after matches the balance', () => {
  let { state } = startRound(createTicketState(), { machineId: 'pulse', occupantId: A, playerId: A, roundId: 'r1', now: NOW });
  const res = submitRound(state, { payload: payload(), senderId: A, occupantId: A, now: NOW + 30000 });
  assert.equal(res.ok, true);
  const led = getLedger(res.state, A);
  assert.equal(led.length, 1);
  assert.equal(led[0].event_type, 'tickets_awarded');
  assert.equal(led[0].delta, res.awarded);
  assert.equal(led[0].balance_after, getBalance(res.state, A));
});

test('a duplicate submission does not duplicate the ledger award', () => {
  let { state } = startRound(createTicketState(), { machineId: 'pulse', occupantId: A, playerId: A, roundId: 'r1', now: NOW });
  const first = submitRound(state, { payload: payload(), senderId: A, occupantId: A, now: NOW + 1000 });
  const dup = submitRound(first.state, { payload: payload(), senderId: A, occupantId: A, now: NOW + 2000 });
  assert.equal(dup.ok, false);
  assert.equal(getLedger(dup.state, A).length, 1); // still exactly one award entry
});

test('appendLedger is idempotent by ledger_id', () => {
  const s0 = createTicketState();
  const r1 = appendLedger(s0, { playerId: A, eventType: 'tickets_spent', delta: -10, balanceAfter: 5, source: 'prize', refId: 'redeem-1', summary: 'redeemed', now: NOW });
  assert.equal(r1.added, true);
  const r2 = appendLedger(r1.state, { playerId: A, eventType: 'tickets_spent', delta: -10, balanceAfter: 5, source: 'prize', refId: 'redeem-1', summary: 'redeemed', now: NOW });
  assert.equal(r2.added, false);
  assert.equal(getLedger(r2.state, A).length, 1);
});

test('ledger ids are deterministic and unique per source event', () => {
  assert.equal(makeLedgerId('tickets_awarded', 'r1'), 'led-tickets_awarded-r1');
  assert.notEqual(makeLedgerId('tickets_awarded', 'r1'), makeLedgerId('tickets_spent', 'r1'));
});

test("a player's ledger contains only their own entries", () => {
  let s = createTicketState();
  s = appendLedger(s, { playerId: A, eventType: 'tickets_awarded', delta: 20, balanceAfter: 20, source: 'pulse', refId: 'ra', summary: 'a', now: NOW }).state;
  s = appendLedger(s, { playerId: B, eventType: 'tickets_awarded', delta: 13, balanceAfter: 13, source: 'pulse', refId: 'rb', summary: 'b', now: NOW }).state;
  assert.equal(getLedger(s, A).length, 1);
  assert.equal(getLedger(s, B).length, 1);
  assert.equal(getLedger(s, A)[0].player_id, A);
  assert.equal(getLedger(s, 'player:c').length, 0);
});
