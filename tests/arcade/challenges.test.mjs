/**
 * Phase 1h — A. Challenge catalog + B. progress + C. reward claim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGES, getChallenge, challengeCatalogPayload, getProgress,
  recordRoundAccepted, recordRedemption, claimReward,
} from '../../workers/arcade/src/challenges.mjs';
import { getInventory } from '../../workers/arcade/src/prize-authority.mjs';
import { getLedger } from '../../workers/arcade/src/ledger.mjs';
import { createTicketState, getBalance } from '../../workers/arcade/src/round-authority.mjs';

const NOW = 5_000_000;
const A = 'player:a';

const progressOf = (state, id, player = A) => getProgress(state, player).find((p) => p.challenge_id === id);

// ── A. catalog ────────────────────────────────────────────────────────────────
test('challenge catalog is deterministic and only exposes enabled challenges', () => {
  assert.deepEqual(challengeCatalogPayload(), challengeCatalogPayload());
  const ids = challengeCatalogPayload().challenges.map((c) => c.challenge_id);
  assert.ok(ids.includes('pulse-rookie'));
  assert.ok(ids.includes('two-cabinet-tour'));
  assert.ok(!ids.includes('marathon-soon')); // disabled excluded
});

test('the disabled placeholder exists in the master list but is marked disabled', () => {
  assert.equal(getChallenge('marathon-soon').enabled, false);
});

test('every challenge reward is internal-only (no money / external value fields)', () => {
  for (const c of CHALLENGES) {
    const keys = Object.keys(c.reward);
    assert.deepEqual(keys.sort(), ['achievement_id', 'ticket_bonus'].sort(), `${c.challenge_id} reward shape`);
    assert.ok(Number.isInteger(c.reward.ticket_bonus) && c.reward.ticket_bonus >= 0, `${c.challenge_id} bonus`);
    assert.ok(c.reward.achievement_id === null || typeof c.reward.achievement_id === 'string');
    // no cash/price/value-style fields anywhere on the challenge
    assert.ok(!('cost' in c) && !('price' in c) && !('cash' in c));
  }
});

test('unknown challenge resolves to null', () => {
  assert.equal(getChallenge('nope'), null);
});

// ── B. progress ────────────────────────────────────────────────────────────────
test('an accepted Pulse Tap round completes Pulse Rookie', () => {
  const r = recordRoundAccepted(createTicketState(), { playerId: A, cabinetType: 'pulse_tap', awarded: 20, now: NOW });
  assert.equal(progressOf(r.state, 'pulse-rookie').completed, true);
  assert.ok(r.newlyCompleted.some((c) => c.challenge_id === 'pulse-rookie'));
});

test('an accepted Signal Sprint round completes First Signal', () => {
  const r = recordRoundAccepted(createTicketState(), { playerId: A, cabinetType: 'signal_sprint', noiseHits: 6, awarded: 24, now: NOW });
  assert.equal(progressOf(r.state, 'first-signal').completed, true);
  // noiseHits 6 > 3 → NOT a clean run
  assert.equal(progressOf(r.state, 'signal-clean-run').completed, false);
});

test('a low-noise Signal Sprint round completes Clean Signal', () => {
  const r = recordRoundAccepted(createTicketState(), { playerId: A, cabinetType: 'signal_sprint', noiseHits: 2, awarded: 24, now: NOW });
  assert.equal(progressOf(r.state, 'signal-clean-run').completed, true);
});

test('playing both cabinets completes Two Cabinet Tour', () => {
  let state = createTicketState();
  state = recordRoundAccepted(state, { playerId: A, cabinetType: 'pulse_tap', awarded: 20, now: NOW }).state;
  assert.equal(progressOf(state, 'two-cabinet-tour').completed, false); // only one cabinet so far
  assert.equal(progressOf(state, 'two-cabinet-tour').progress, 1);
  state = recordRoundAccepted(state, { playerId: A, cabinetType: 'signal_sprint', noiseHits: 1, awarded: 24, now: NOW }).state;
  assert.equal(progressOf(state, 'two-cabinet-tour').completed, true);
});

test('a redemption completes First Redemption', () => {
  const r = recordRedemption(createTicketState(), { playerId: A, now: NOW });
  assert.equal(progressOf(r.state, 'first-redemption').completed, true);
});

test('earning 25 tickets total completes Ticket Starter', () => {
  let state = createTicketState();
  state = recordRoundAccepted(state, { playerId: A, cabinetType: 'pulse_tap', awarded: 20, now: NOW }).state;
  assert.equal(progressOf(state, 'ticket-starter').completed, false);
  assert.equal(progressOf(state, 'ticket-starter').progress, 20);
  state = recordRoundAccepted(state, { playerId: A, cabinetType: 'signal_sprint', noiseHits: 1, awarded: 24, now: NOW }).state;
  assert.equal(progressOf(state, 'ticket-starter').completed, true); // 44 >= 25
  assert.equal(progressOf(state, 'ticket-starter').progress, 25);    // clamped to target
});

test('progress is not lost once completed (sticky), even if no further events', () => {
  let state = recordRoundAccepted(createTicketState(), { playerId: A, cabinetType: 'pulse_tap', awarded: 20, now: NOW }).state;
  const before = progressOf(state, 'pulse-rookie');
  assert.equal(before.completed, true);
  assert.equal(before.completed_at, NOW);
  // a later, unrelated event keeps the earlier completion timestamp
  state = recordRedemption(state, { playerId: A, now: NOW + 1000 }).state;
  assert.equal(progressOf(state, 'pulse-rookie').completed_at, NOW);
});

test('a repeated cabinet round does not re-fire completion for a one-shot challenge', () => {
  let res = recordRoundAccepted(createTicketState(), { playerId: A, cabinetType: 'pulse_tap', awarded: 20, now: NOW });
  assert.equal(res.newlyCompleted.some((c) => c.challenge_id === 'pulse-rookie'), true);
  res = recordRoundAccepted(res.state, { playerId: A, cabinetType: 'pulse_tap', awarded: 20, now: NOW + 1 });
  assert.equal(res.newlyCompleted.some((c) => c.challenge_id === 'pulse-rookie'), false); // already complete
});

// ── C. reward claim ─────────────────────────────────────────────────────────────
test('a completed challenge can be claimed and grants its achievement badge', () => {
  let state = recordRoundAccepted(createTicketState(), { playerId: A, cabinetType: 'pulse_tap', awarded: 20, now: NOW }).state;
  const r = claimReward(state, { playerId: A, challengeId: 'pulse-rookie', now: NOW + 100 });
  assert.equal(r.ok, true);
  assert.equal(r.achievement.achievement_id, 'pulse-rookie');
  assert.ok(getInventory(r.state, A).some((i) => i.prize_id === 'badge-pulse-rookie'));
  assert.equal(progressOf(r.state, 'pulse-rookie').reward_claimed, true);
});

test('a ticket-bonus reward is server-computed and recorded in the ledger', () => {
  let state = recordRoundAccepted(createTicketState(), { playerId: A, cabinetType: 'signal_sprint', noiseHits: 6, awarded: 24, now: NOW }).state;
  const r = claimReward(state, { playerId: A, challengeId: 'first-signal', now: NOW + 100 });
  assert.equal(r.ok, true);
  assert.equal(r.ticketBonus, 5);
  assert.equal(getBalance(r.state, A), 5); // started at 0 in this isolated state
  const led = getLedger(r.state, A);
  assert.equal(led[led.length - 1].event_type, 'challenge_reward');
  assert.equal(led[led.length - 1].delta, 5);
});

test('claiming an incomplete challenge is rejected', () => {
  const r = claimReward(createTicketState(), { playerId: A, challengeId: 'pulse-rookie', now: NOW });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'not_completed');
});

test('a duplicate claim is rejected (no second grant)', () => {
  let state = recordRoundAccepted(createTicketState(), { playerId: A, cabinetType: 'pulse_tap', awarded: 20, now: NOW }).state;
  const first = claimReward(state, { playerId: A, challengeId: 'pulse-rookie', now: NOW + 1 });
  const dup = claimReward(first.state, { playerId: A, challengeId: 'pulse-rookie', now: NOW + 2 });
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, 'already_claimed');
  assert.equal(getInventory(dup.state, A).filter((i) => i.prize_id === 'badge-pulse-rookie').length, 1);
});

test('unknown / disabled / malformed challenge claims are rejected', () => {
  const state = createTicketState();
  assert.equal(claimReward(state, { playerId: A, challengeId: 'nope', now: NOW }).reason, 'unknown_challenge');
  assert.equal(claimReward(state, { playerId: A, challengeId: 'marathon-soon', now: NOW }).reason, 'challenge_disabled');
  assert.equal(claimReward(state, { playerId: A, challengeId: '', now: NOW }).reason, 'malformed');
});

test('client-supplied reward fields are ignored — only the catalog reward is granted', () => {
  let state = recordRoundAccepted(createTicketState(), { playerId: A, cabinetType: 'signal_sprint', noiseHits: 6, awarded: 24, now: NOW }).state;
  // hostile extra fields must have zero effect
  const r = claimReward(state, { playerId: A, challengeId: 'first-signal', now: NOW, ticket_bonus: 9999, badge: 'pulse-jacket', reward: { ticket_bonus: 9999 } });
  assert.equal(r.ok, true);
  assert.equal(r.ticketBonus, 5); // catalog value, not 9999
  assert.equal(getBalance(r.state, A), 5);
});
