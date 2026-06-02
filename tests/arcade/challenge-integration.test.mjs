/**
 * Phase 1h — F. Challenge → achievement → equip integration + cross-player
 * isolation + reconnect persistence. Drives the SAME pure modules the Durable
 * Object orchestrates (round authority + challenges + achievements + prizes).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTicketState, ensureTicketState, startRound, submitRound, getBalance,
} from '../../workers/arcade/src/round-authority.mjs';
import { recordRoundAccepted, recordRedemption, claimReward, getProgress } from '../../workers/arcade/src/challenges.mjs';
import { getAchievements } from '../../workers/arcade/src/achievements.mjs';
import { redeemPrize, equipCosmetic, getInventory, getEquips, publicCosmeticState } from '../../workers/arcade/src/prize-authority.mjs';
import { getLedger } from '../../workers/arcade/src/ledger.mjs';

const NOW = 8_000_000;
const A = 'player:a';
const B = 'player:b';

const pulsePayload = (over = {}) => ({ roundId: 'p1', machineId: 'pulse', grade: 'A', score: 1500, accuracy: 85, durationMs: 30000, hits: 14, bestStreak: 8, ...over });
const signalPayload = (over = {}) => ({ roundId: 's1', machineId: 'signal', cabinetType: 'signal_sprint', rulesetVersion: 'signal-sprint/1', grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000, ...over });

// Mirror the DO: accept a round, then record the challenge event with the award.
function playPulse(state, player) {
  const started = startRound(state, { machineId: 'pulse', occupantId: player, playerId: player, roundId: 'p1', now: NOW });
  const sub = submitRound(started.state, { payload: pulsePayload(), senderId: player, occupantId: player, now: NOW + 30000 });
  const rec = recordRoundAccepted(sub.state, { playerId: player, cabinetType: 'pulse_tap', awarded: sub.awarded, now: NOW + 30001 });
  return rec.state;
}
function playSignal(state, player, noiseHits = 6) {
  const started = startRound(state, { machineId: 'signal', occupantId: player, playerId: player, roundId: 's1', now: NOW });
  const sub = submitRound(started.state, { payload: signalPayload({ noiseHits }), senderId: player, occupantId: player, now: NOW + 25000 });
  const rec = recordRoundAccepted(sub.state, { playerId: player, cabinetType: 'signal_sprint', noiseHits, awarded: sub.awarded, now: NOW + 25001 });
  return rec.state;
}
const prog = (state, id, player = A) => getProgress(state, player).find((p) => p.challenge_id === id);

test('A completes Pulse, Signal and Two Cabinet Tour by playing both cabinets', () => {
  let state = createTicketState();
  state = playPulse(state, A);
  assert.equal(prog(state, 'pulse-rookie').completed, true);
  state = playSignal(state, A);
  assert.equal(prog(state, 'first-signal').completed, true);
  assert.equal(prog(state, 'two-cabinet-tour').completed, true);
});

test('A claims the Two Cabinet Tour badge, equips it, and B sees only the public badge', () => {
  let state = createTicketState();
  state = playPulse(state, A);
  state = playSignal(state, A);

  const claim = claimReward(state, { playerId: A, challengeId: 'two-cabinet-tour', now: NOW + 40000 });
  assert.equal(claim.ok, true);
  assert.equal(claim.achievement.achievement_id, 'circuit-tourist');
  state = claim.state;
  assert.ok(getInventory(state, A).some((i) => i.prize_id === 'badge-circuit-tourist'));
  assert.equal(getAchievements(state, A).length, 1);

  const eq = equipCosmetic(state, { playerId: A, prizeId: 'badge-circuit-tourist' });
  assert.equal(eq.ok, true);
  state = eq.state;
  assert.equal(getEquips(state, A).badge, 'badge-circuit-tourist');

  // B sees A's public badge, no private balance/ledger/inventory
  const pub = publicCosmeticState(state);
  assert.equal(pub[A].badge.display_name, 'Circuit Tourist');
  assert.ok(!/balance|ledger|redemption/i.test(JSON.stringify(pub)));
});

test('B cannot claim A’s reward and cannot see A’s private balance/ledger', () => {
  let state = createTicketState();
  state = playPulse(state, A);
  state = playSignal(state, A);
  // B has no progress on two-cabinet-tour
  const bClaim = claimReward(state, { playerId: B, challengeId: 'two-cabinet-tour', now: NOW + 50000 });
  assert.equal(bClaim.ok, false);
  assert.equal(bClaim.reason, 'not_completed');
  // B's own private views are empty
  assert.equal(getBalance(state, B), 0);
  assert.equal(getLedger(state, B).length, 0);
  assert.equal(getProgress(state, B).every((p) => !p.completed), true);
});

test('First Redemption completes after a real Prize Counter redemption', () => {
  let state = createTicketState();
  state = playPulse(state, A);   // +20
  state = playSignal(state, A);  // +24 → 44
  const r = redeemPrize(state, { prizeId: 'founder-badge-local', playerId: A, now: NOW, redemptionId: 'rd1' }); // cost 10
  state = recordRedemption(r.state, { playerId: A, now: NOW + 1 }).state;
  assert.equal(prog(state, 'first-redemption').completed, true);
});

test('challenge + achievement + inventory state survives a reconnect (ensureTicketState round-trip)', () => {
  let state = createTicketState();
  state = playPulse(state, A);
  state = playSignal(state, A);
  state = claimReward(state, { playerId: A, challengeId: 'two-cabinet-tour', now: NOW + 40000 }).state;
  state = equipCosmetic(state, { playerId: A, prizeId: 'badge-circuit-tourist' }).state;

  // Simulate persistence + reload (the DO stores then re-hydrates via ensureTicketState)
  const restored = ensureTicketState(JSON.parse(JSON.stringify(state)));
  assert.equal(prog(restored, 'two-cabinet-tour').completed, true);
  assert.equal(prog(restored, 'two-cabinet-tour').reward_claimed, true);
  assert.equal(getAchievements(restored, A).length, 1);
  assert.ok(getInventory(restored, A).some((i) => i.prize_id === 'badge-circuit-tourist'));
  assert.equal(getEquips(restored, A).badge, 'badge-circuit-tourist');
});

test('client-forced completion is impossible — progress only moves via authoritative events', () => {
  // A fresh state with no plays: nothing is complete, and a claim is rejected.
  const state = createTicketState();
  assert.equal(getProgress(state, A).every((p) => !p.completed), true);
  assert.equal(claimReward(state, { playerId: A, challengeId: 'pulse-rookie', now: NOW }).reason, 'not_completed');
});
