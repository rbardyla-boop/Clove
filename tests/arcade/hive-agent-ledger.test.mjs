// W-4 SIMULATOR LAB — hive node-as-agent ticket ledger: AE invariants + convergence.
// Run: node --test tests/arcade/hive-agent-ledger.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  foldLedger, ledgerFingerprint, supplyConserved, simulateRound, blockRecognition,
  agentRegistered, ticketsMinted, agentTransfer, isAgentId,
  MINT_MAX_PER_EVENT, TRANSFER_MAX_PER_EVENT, EVENT_KINDS, MEMO_TOKENS,
} from '../../arcade/hiveworld-agents/agent-ledger.mjs';

const ROOM = 'arcade-room:neon-circuit';
const CAB = 'cabinet:sha256:' + 'a'.repeat(64);
const CAB2 = 'cabinet:sha256:' + 'b'.repeat(64);

const base = () => [
  agentRegistered({ event_id: 'e1', seq: 1, agent_id: ROOM, node_kind: 'arcade-room' }),
  agentRegistered({ event_id: 'e2', seq: 2, agent_id: CAB, node_kind: 'cabinet' }),
  agentRegistered({ event_id: 'e3', seq: 3, agent_id: CAB2, node_kind: 'cabinet' }),
];

// ── agent identity (AE-NO-PERSON) ────────────────────────────────────────────
test('node-shaped agent ids are valid; person-shaped ids are not', () => {
  assert.equal(isAgentId(ROOM), true);
  assert.equal(isAgentId('city-room:downtown-01'), true);
  assert.equal(isAgentId(CAB), true);
  assert.equal(isAgentId('player:ryan'), false);
  assert.equal(isAgentId('account:123'), false);
  assert.equal(isAgentId('user-room:x'), false);
});

test('registering a person-shaped agent is rejected by the fold', () => {
  const s = foldLedger([agentRegistered({ event_id: 'p1', seq: 1, agent_id: 'player:someone', node_kind: 'cabinet' })]);
  assert.equal(Object.keys(s.agents).length, 0);
  assert.equal(s.rejected[0].reason, 'bad_agent_id');
});

// ── mint bounds (AE-MINT-BOUND) ──────────────────────────────────────────────
test('a bounded mint credits the agent and the supply', () => {
  const s = foldLedger([...base(), ticketsMinted({ event_id: 'm1', seq: 4, agent_id: ROOM, amount: 60, round_id: 'r1' })]);
  assert.equal(s.agents[ROOM].balance, 60);
  assert.equal(s.minted_total, 60);
  assert.ok(supplyConserved(s));
});

test('over-cap, zero, fractional, and round-less mints are rejected', () => {
  const s = foldLedger([
    ...base(),
    ticketsMinted({ event_id: 'm1', seq: 4, agent_id: ROOM, amount: MINT_MAX_PER_EVENT + 1, round_id: 'r1' }),
    ticketsMinted({ event_id: 'm2', seq: 5, agent_id: ROOM, amount: 0, round_id: 'r2' }),
    ticketsMinted({ event_id: 'm3', seq: 6, agent_id: ROOM, amount: 1.5, round_id: 'r3' }),
    { event_id: 'm4', seq: 7, kind: 'tickets_minted', agent_id: ROOM, amount: 5 },
  ]);
  assert.equal(s.agents[ROOM].balance, 0);
  assert.equal(s.rejected.length, 4);
});

// ── transfers (AE-XFER-CAP / AE-NO-NEGATIVE / AE-ONE-PER-ROUND / AE-CLOSED-MEMO) ──
const funded = () => [...base(), ticketsMinted({ event_id: 'm1', seq: 4, agent_id: ROOM, amount: 100, round_id: 'r0' })];

test('a capped transfer moves value between agents and conserves supply', () => {
  const s = foldLedger([...funded(), agentTransfer({ event_id: 't1', seq: 5, from: ROOM, to: CAB, amount: 10, round_id: 'r1', memo_token: 'round_played' })]);
  assert.equal(s.agents[ROOM].balance, 90);
  assert.equal(s.agents[CAB].balance, 10);
  assert.ok(supplyConserved(s));
});

test('over-cap transfer is rejected', () => {
  const s = foldLedger([...funded(), agentTransfer({ event_id: 't1', seq: 5, from: ROOM, to: CAB, amount: TRANSFER_MAX_PER_EVENT + 1, round_id: 'r1', memo_token: 'round_played' })]);
  assert.equal(s.agents[CAB].balance, 0);
  assert.equal(s.rejected[0].reason, 'transfer_out_of_bounds');
});

test('overdraw is rejected — no balance ever goes negative', () => {
  const s = foldLedger([
    ...base(),
    ticketsMinted({ event_id: 'm1', seq: 4, agent_id: ROOM, amount: 5, round_id: 'r0' }),
    agentTransfer({ event_id: 't1', seq: 5, from: ROOM, to: CAB, amount: 6, round_id: 'r1', memo_token: 'round_played' }),
  ]);
  assert.equal(s.agents[ROOM].balance, 5);
  assert.equal(s.rejected[0].reason, 'insufficient_balance');
  assert.ok(Object.values(s.agents).every((a) => a.balance >= 0));
});

test('one transfer per (from, round): a second drain in the same round is rejected', () => {
  const s = foldLedger([
    ...funded(),
    agentTransfer({ event_id: 't1', seq: 5, from: ROOM, to: CAB, amount: 10, round_id: 'r1', memo_token: 'round_played' }),
    agentTransfer({ event_id: 't2', seq: 6, from: ROOM, to: CAB2, amount: 10, round_id: 'r1', memo_token: 'round_played' }),
  ]);
  assert.equal(s.agents[CAB2].balance, 0);
  assert.equal(s.rejected[0].reason, 'round_already_transferred');
});

test('free-text memo and self-transfer are rejected', () => {
  const s = foldLedger([
    ...funded(),
    agentTransfer({ event_id: 't1', seq: 5, from: ROOM, to: CAB, amount: 5, round_id: 'r1', memo_token: 'pay me cash' }),
    agentTransfer({ event_id: 't2', seq: 6, from: ROOM, to: ROOM, amount: 5, round_id: 'r2', memo_token: 'round_played' }),
  ]);
  assert.equal(s.rejected.map((r) => r.reason).sort().join(','), 'bad_memo,self_transfer');
});

// ── AE-NO-CASHOUT: the vocabulary simply has no exit ─────────────────────────
test('no cash-out kind exists, and unknown kinds are rejected', () => {
  assert.ok(!EVENT_KINDS.some((k) => /cash|payout|withdraw|redeem_fiat/.test(k)));
  assert.ok(!MEMO_TOKENS.some((m) => /cash|fiat|usd/.test(m)));
  const s = foldLedger([...funded(), { event_id: 'x1', seq: 9, kind: 'cash_out', agent_id: ROOM, amount: 50 }]);
  assert.equal(s.rejected[0].reason, 'unknown_kind');
  assert.equal(s.agents[ROOM].balance, 100);
});

// ── convergence: canonical fold ≡ under reorder + duplication ────────────────
test('reordered and duplicated delivery folds to the SAME fingerprint', () => {
  const events = [
    ...funded(),
    agentTransfer({ event_id: 't1', seq: 5, from: ROOM, to: CAB, amount: 10, round_id: 'r1', memo_token: 'round_played' }),
    agentTransfer({ event_id: 't2', seq: 6, from: ROOM, to: CAB2, amount: 8, round_id: 'r2', memo_token: 'event_spotlight' }),
  ];
  const fp = ledgerFingerprint(foldLedger(events));
  const shuffled = [events[5], events[1], events[4], events[0], events[3], events[2]];
  const duplicated = [...shuffled, events[4], events[0], events[5]];
  assert.equal(ledgerFingerprint(foldLedger(shuffled)), fp);
  assert.equal(ledgerFingerprint(foldLedger(duplicated)), fp);
  assert.ok(supplyConserved(foldLedger(duplicated)));
});

// ── simulateRound: "a cabinet earns when played" in its non-cash form ────────
test('a played round mints a clamped payout and routes a small share to the cabinet agent', () => {
  const events = [...base(), ...simulateRound({ roomAgent: ROOM, cabinetAgent: CAB, proposedScore: 720, roundId: 'round-9', seqBase: 10 })];
  const s = foldLedger(events);
  assert.equal(s.rejected.length, 0);
  assert.equal(s.minted_total, 60);                       // 720/12 = 60, inside the clamp
  assert.equal(s.agents[CAB].balance, 6);                 // 60/10 share, ≤ TRANSFER_MAX
  assert.equal(s.agents[ROOM].balance, 54);
  assert.ok(supplyConserved(s));
});

test('an absurd proposed score still clamps to the bounds (no jackpot mint)', () => {
  const events = [...base(), ...simulateRound({ roomAgent: ROOM, cabinetAgent: CAB, proposedScore: 9_999_999, roundId: 'round-x', seqBase: 10 })];
  const s = foldLedger(events);
  assert.equal(s.rejected.length, 0);
  assert.ok(s.minted_total <= MINT_MAX_PER_EVENT);
  assert.ok(s.agents[CAB].balance <= TRANSFER_MAX_PER_EVENT);
});

// ── Rung-1 rollup: block-collective recognition only ─────────────────────────
test('recognition rolls up to BLOCKS (collective), never to persons', () => {
  const events = [
    ...base(),
    ...simulateRound({ roomAgent: ROOM, cabinetAgent: CAB, proposedScore: 720, roundId: 'rr1', seqBase: 10 }),
    ...simulateRound({ roomAgent: ROOM, cabinetAgent: CAB2, proposedScore: 360, roundId: 'rr2', seqBase: 20 }),
  ];
  const s = foldLedger(events);
  const rec = blockRecognition(s, { [CAB]: 'harbor-02', [CAB2]: 'harbor-02' });
  assert.deepEqual(Object.keys(rec), ['harbor-02']);
  assert.equal(rec['harbor-02'], s.agents[CAB].balance + s.agents[CAB2].balance);
  assert.ok(!JSON.stringify(rec).match(/player|user|email/i));
});

// ── lab boundary: nothing in production imports this module ──────────────────
test('module declares its simulator-only boundary in the header', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../arcade/hiveworld-agents/agent-ledger.mjs', import.meta.url), 'utf8');
  assert.ok(/SIMULATOR ONLY/.test(src));
  assert.ok(/imported by\s*\n?\s*\* NOTHING in the production/.test(src) || /imported by NOTHING/.test(src.replace(/\n \* /g, ' ')));
});
