// W-6 LAB — attention ledger (attention-framed successor to the W-4 agent ledger).
// Run: node --test tests/arcade/attention-ledger.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  foldAttention, attentionFingerprint, attentionConserved, routeRound, blockSurfacing,
  agentRegistered, attentionGranted, attentionRouted, isAgentId,
  GRANT_MAX_PER_EVENT, ROUTE_MAX_PER_EVENT, EVENT_KINDS, SIGNAL_TOKENS,
} from '../../arcade/hiveworld-agents/attention-ledger.mjs';

const ROOM = 'arcade-room:neon-circuit';
const CAB = 'cabinet:sha256:' + 'a'.repeat(64);
const CAB2 = 'cabinet:sha256:' + 'b'.repeat(64);
const base = () => [
  agentRegistered({ event_id: 'e1', seq: 1, agent_id: ROOM, node_kind: 'arcade-room' }),
  agentRegistered({ event_id: 'e2', seq: 2, agent_id: CAB, node_kind: 'cabinet' }),
  agentRegistered({ event_id: 'e3', seq: 3, agent_id: CAB2, node_kind: 'cabinet' }),
];
const funded = () => [...base(), attentionGranted({ event_id: 'g1', seq: 4, agent_id: ROOM, units: 100, round_id: 'r0' })];

test('node-shaped ids valid; person-shaped rejected (AA-NO-PERSON)', () => {
  assert.equal(isAgentId(ROOM), true);
  assert.equal(isAgentId('city-room:downtown-01'), true);
  assert.equal(isAgentId('player:ryan'), false);
  assert.equal(isAgentId('user:1'), false);
  const s = foldAttention([agentRegistered({ event_id: 'p1', seq: 1, agent_id: 'person:x', node_kind: 'cabinet' })]);
  assert.equal(s.rejected[0].reason, 'bad_agent_id');
});

test('bounded grant credits level + total; over/zero/fractional/round-less grants rejected (AA-GRANT-CAP)', () => {
  const ok = foldAttention([...base(), attentionGranted({ event_id: 'g1', seq: 4, agent_id: ROOM, units: 60, round_id: 'r1' })]);
  assert.equal(ok.agents[ROOM].attention_level, 60);
  assert.equal(ok.granted_total, 60);
  const bad = foldAttention([
    ...base(),
    attentionGranted({ event_id: 'b1', seq: 4, agent_id: ROOM, units: GRANT_MAX_PER_EVENT + 1, round_id: 'r1' }),
    attentionGranted({ event_id: 'b2', seq: 5, agent_id: ROOM, units: 0, round_id: 'r2' }),
    attentionGranted({ event_id: 'b3', seq: 6, agent_id: ROOM, units: 2.5, round_id: 'r3' }),
    { event_id: 'b4', seq: 7, kind: 'attention_granted', agent_id: ROOM, units: 5 },
  ]);
  assert.equal(bad.agents[ROOM].attention_level, 0);
  assert.equal(bad.rejected.length, 4);
});

test('capped route conserves; over-cap/overdraw/self/free-text-signal rejected', () => {
  const s = foldAttention([...funded(), attentionRouted({ event_id: 't1', seq: 5, from: ROOM, to: CAB, units: 10, round_id: 'r1', signal_token: 'round_played' })]);
  assert.equal(s.agents[ROOM].attention_level, 90);
  assert.equal(s.agents[CAB].attention_level, 10);
  assert.ok(attentionConserved(s));
  const bad = foldAttention([
    ...funded(),
    attentionRouted({ event_id: 'x1', seq: 5, from: ROOM, to: CAB, units: ROUTE_MAX_PER_EVENT + 1, round_id: 'r1', signal_token: 'round_played' }),
    attentionRouted({ event_id: 'x2', seq: 6, from: CAB, to: CAB2, units: 5, round_id: 'r2', signal_token: 'round_played' }),
    attentionRouted({ event_id: 'x3', seq: 7, from: ROOM, to: ROOM, units: 5, round_id: 'r3', signal_token: 'round_played' }),
    attentionRouted({ event_id: 'x4', seq: 8, from: ROOM, to: CAB, units: 5, round_id: 'r4', signal_token: 'send cash' }),
  ]);
  assert.deepEqual(bad.rejected.map((r) => r.reason).sort(),
    ['bad_signal', 'insufficient_attention', 'route_out_of_bounds', 'self_route']);
  assert.ok(Object.values(bad.agents).every((a) => a.attention_level >= 0));
});

test('one route per (from, round) — drain loop rejected (AA-ONE-ROUTE)', () => {
  const s = foldAttention([
    ...funded(),
    attentionRouted({ event_id: 't1', seq: 5, from: ROOM, to: CAB, units: 10, round_id: 'r1', signal_token: 'round_played' }),
    attentionRouted({ event_id: 't2', seq: 6, from: ROOM, to: CAB2, units: 10, round_id: 'r1', signal_token: 'round_played' }),
  ]);
  assert.equal(s.agents[CAB2].attention_level, 0);
  assert.equal(s.rejected[0].reason, 'round_already_routed');
});

test('no exit vocabulary exists; exit-shaped kinds rejected unknown (AA-NO-EXIT)', () => {
  const exit = /cash|payout|withdraw|wallet|sell|mint|ticket|balance|payment/i;
  assert.ok(!EVENT_KINDS.some((k) => exit.test(k)), 'kinds clean');
  assert.ok(!SIGNAL_TOKENS.some((t) => exit.test(t)), 'signals clean');
  const s = foldAttention([...funded(), { event_id: 'c1', seq: 9, kind: 'cash_out', agent_id: ROOM, units: 50 }]);
  assert.equal(s.rejected[0].reason, 'unknown_kind');
  assert.equal(s.agents[ROOM].attention_level, 100);
});

test('reorder + duplicate delivery converge to the same fingerprint', () => {
  const events = [
    ...funded(),
    attentionRouted({ event_id: 't1', seq: 5, from: ROOM, to: CAB, units: 10, round_id: 'r1', signal_token: 'round_played' }),
    attentionRouted({ event_id: 't2', seq: 6, from: ROOM, to: CAB2, units: 8, round_id: 'r2', signal_token: 'event_spotlight' }),
  ];
  const fp = attentionFingerprint(foldAttention(events));
  const shuffledEvents = [events[5], events[1], events[4], events[0], events[3], events[2]];
  assert.equal(attentionFingerprint(foldAttention(shuffledEvents)), fp);
  assert.equal(attentionFingerprint(foldAttention([...shuffledEvents, events[0], events[5], events[5]])), fp);
});

test('routeRound: clamped grant + small coordination share; absurd score cannot jackpot', () => {
  const s = foldAttention([...base(), ...routeRound({ roomAgent: ROOM, cabinetAgent: CAB, proposedScore: 720, roundId: 'rr', seqBase: 10 })]);
  assert.equal(s.rejected.length, 0);
  assert.equal(s.granted_total, 60);
  assert.equal(s.agents[CAB].attention_level, 6);
  assert.ok(attentionConserved(s));
  const huge = foldAttention([...base(), ...routeRound({ roomAgent: ROOM, cabinetAgent: CAB, proposedScore: 9e9, roundId: 'rh', seqBase: 10 })]);
  assert.ok(huge.granted_total <= GRANT_MAX_PER_EVENT);
  assert.ok(huge.agents[CAB].attention_level <= ROUTE_MAX_PER_EVENT);
});

test('blockSurfacing rolls cabinet attention up to BLOCKS only (ADR-009 deferral intact)', () => {
  const s = foldAttention([
    ...base(),
    ...routeRound({ roomAgent: ROOM, cabinetAgent: CAB, proposedScore: 720, roundId: 'ra', seqBase: 10 }),
    ...routeRound({ roomAgent: ROOM, cabinetAgent: CAB2, proposedScore: 360, roundId: 'rb', seqBase: 20 }),
  ]);
  const up = blockSurfacing(s, { [CAB]: 'harbor-02', [CAB2]: 'harbor-02' });
  assert.deepEqual(Object.keys(up), ['harbor-02']);
  assert.equal(up['harbor-02'], s.agents[CAB].attention_level + s.agents[CAB2].attention_level);
  assert.ok(!/player|user|email/i.test(JSON.stringify(up)));
});

test('state vocabulary: no balance/payment/cash key anywhere (attention framing holds)', () => {
  const s = foldAttention(funded());
  const bad = /balance|payment|payout|cash|wallet|ticket|mint|earn/i;
  const keys = [];
  const walk = (v) => { if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { keys.push(k); walk(x); } };
  walk(s);
  assert.ok(keys.every((k) => !bad.test(k)), keys.filter((k) => bad.test(k)).join(','));
});

test('module header declares the simulator-only boundary', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../arcade/hiveworld-agents/attention-ledger.mjs', import.meta.url), 'utf8');
  assert.ok(/SIMULATOR ONLY/.test(src));
});
