/**
 * Phase 1 parity — Challenge Board + achievements (incl. Phase 1l grid challenges).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArcade } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import {
  CHALLENGES, recordRoundAccepted, recordRedemption, claimReward, getProgress,
} from '../../arcade/hiveworld-sim/core/phase1/challenges.mjs';

const A = 'agent:a';
const B = 'agent:b';
const progressOf = (arcade, id, actor = A) => getProgress(arcade, actor).find((p) => p.challenge_id === id);

test('challenge rewards are internal-only (only achievement_id + ticket_bonus)', () => {
  for (const c of CHALLENGES) {
    assert.deepEqual(Object.keys(c.reward).sort(), ['achievement_id', 'ticket_bonus']);
    assert.ok(Number.isInteger(c.reward.ticket_bonus) && c.reward.ticket_bonus >= 0);
    assert.ok(!('cost' in c) && !('price' in c) && !('cash' in c));
  }
});

test('each cabinet round completes its play challenge', () => {
  assert.equal(progressOf(recordRoundAccepted(createArcade(), { actor: A, cabinetType: 'pulse_tap', awarded: 20, tick: 1 }).arcade, 'pulse-rookie').completed, true);
  assert.equal(progressOf(recordRoundAccepted(createArcade(), { actor: A, cabinetType: 'signal_sprint', noiseHits: 6, awarded: 24, tick: 1 }).arcade, 'first-signal').completed, true);
  assert.equal(progressOf(recordRoundAccepted(createArcade(), { actor: A, cabinetType: 'neon_grid', mistakes: 5, awarded: 17, tick: 1 }).arcade, 'grid-rookie').completed, true);
});

test('clean-grid completes only at low mistakes; clean-signal only at low noise', () => {
  assert.equal(progressOf(recordRoundAccepted(createArcade(), { actor: A, cabinetType: 'neon_grid', mistakes: 2, awarded: 20, tick: 1 }).arcade, 'clean-grid').completed, true);
  assert.equal(progressOf(recordRoundAccepted(createArcade(), { actor: A, cabinetType: 'neon_grid', mistakes: 9, awarded: 12, tick: 1 }).arcade, 'clean-grid').completed, false);
  assert.equal(progressOf(recordRoundAccepted(createArcade(), { actor: A, cabinetType: 'signal_sprint', noiseHits: 1, awarded: 24, tick: 1 }).arcade, 'signal-clean-run').completed, true);
});

test('two-cabinet and three-cabinet tours complete only after the right set of cabinets', () => {
  let arcade = createArcade();
  arcade = recordRoundAccepted(arcade, { actor: A, cabinetType: 'pulse_tap', awarded: 20, tick: 1 }).arcade;
  arcade = recordRoundAccepted(arcade, { actor: A, cabinetType: 'signal_sprint', noiseHits: 1, awarded: 24, tick: 2 }).arcade;
  assert.equal(progressOf(arcade, 'two-cabinet-tour').completed, true);
  assert.equal(progressOf(arcade, 'three-cabinet-tour').completed, false);
  arcade = recordRoundAccepted(arcade, { actor: A, cabinetType: 'neon_grid', mistakes: 1, awarded: 26, tick: 3 }).arcade;
  assert.equal(progressOf(arcade, 'three-cabinet-tour').completed, true);
});

test('a redemption completes Counter Regular; 25 tickets completes Ticket Starter', () => {
  assert.equal(progressOf(recordRedemption(createArcade(), { actor: A, tick: 1 }).arcade, 'first-redemption').completed, true);
  let arcade = recordRoundAccepted(createArcade(), { actor: A, cabinetType: 'neon_grid', mistakes: 1, awarded: 26, tick: 1 }).arcade;
  assert.equal(progressOf(arcade, 'ticket-starter').completed, true);
});

test('claim grants the badge into inventory; ticket-bonus reward is server-computed + ledgered', () => {
  let arcade = recordRoundAccepted(createArcade(), { actor: A, cabinetType: 'neon_grid', mistakes: 1, awarded: 26, tick: 1 }).arcade;
  const r = claimReward(arcade, { actor: A, challengeId: 'grid-rookie', tick: 2 });
  assert.equal(r.ok, true);
  assert.equal(r.achievement.achievement_id, 'grid-rookie');
  assert.ok(arcade.inventory[A] === undefined || true);
  assert.ok(Object.values(r.arcade.inventory[A]).some((i) => i.prize_id === 'badge-grid-rookie'));

  // first-signal carries a +5 ticket bonus, server-computed + ledgered
  let s = recordRoundAccepted(createArcade(), { actor: A, cabinetType: 'signal_sprint', noiseHits: 6, awarded: 24, tick: 1 }).arcade;
  const fs = claimReward(s, { actor: A, challengeId: 'first-signal', tick: 2 });
  assert.equal(fs.ticketBonus, 5);
  assert.equal(fs.balance, 5);
  assert.equal(fs.arcade.ledger[A].at(-1).event_type, 'challenge_reward');
});

test('duplicate / incomplete / cross-player claims are rejected (client reward fields ignored)', () => {
  let arcade = recordRoundAccepted(createArcade(), { actor: A, cabinetType: 'neon_grid', mistakes: 1, awarded: 26, tick: 1 }).arcade;
  const first = claimReward(arcade, { actor: A, challengeId: 'grid-rookie', tick: 2, ticket_bonus: 9999 });
  assert.equal(first.ticketBonus, 0); // catalog value, not 9999
  assert.equal(claimReward(first.arcade, { actor: A, challengeId: 'grid-rookie', tick: 3 }).reason, 'already_claimed');
  assert.equal(claimReward(arcade, { actor: B, challengeId: 'grid-rookie', tick: 2 }).reason, 'not_completed');
  assert.equal(claimReward(arcade, { actor: A, challengeId: 'nope', tick: 2 }).reason, 'unknown_challenge');
});
