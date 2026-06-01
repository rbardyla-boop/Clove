/**
 * Phase 1 parity — Prize Counter: combined-balance redemption, dedup, ownership, no transfer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArcade } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import { redeemPrize, equipCosmetic, ownsPrize, getInventory } from '../../arcade/hiveworld-sim/core/phase1/prize.mjs';
import { isForbiddenType } from '../../arcade/hiveworld-sim/core/events.mjs';

const A = 'agent:a';
const B = 'agent:b';
function withBalance(n, actor = A) {
  const arcade = createArcade();
  return { ...arcade, balances: { ...arcade.balances, [actor]: n } };
}

test('redeem succeeds against the combined balance and binds the entitlement to the session', () => {
  const r = redeemPrize(withBalance(70), { prizeId: 'pulse-jacket', actor: A, tick: 1, redemptionId: 'rd1' }); // cost 35
  assert.equal(r.ok, true);
  assert.equal(r.balance, 35);
  assert.equal(r.item.bound_to, 'session');
  assert.ok(ownsPrize(r.arcade, A, 'pulse-jacket'));
});

test('insufficient balance, unknown prize, disabled prize, and duplicate-unique are rejected', () => {
  assert.equal(redeemPrize(withBalance(5), { prizeId: 'pulse-jacket', actor: A, tick: 1, redemptionId: 'r' }).reason, 'insufficient_tickets');
  assert.equal(redeemPrize(withBalance(50), { prizeId: 'nope', actor: A, tick: 1, redemptionId: 'r' }).reason, 'unknown_prize');
  assert.equal(redeemPrize(withBalance(50), { prizeId: 'mystery-unit-soon', actor: A, tick: 1, redemptionId: 'r' }).reason, 'prize_disabled');
  const owned = redeemPrize(withBalance(40), { prizeId: 'founder-badge-local', actor: A, tick: 1, redemptionId: 'r1' });
  assert.equal(redeemPrize(owned.arcade, { prizeId: 'founder-badge-local', actor: A, tick: 2, redemptionId: 'r2' }).reason, 'already_owned');
});

test('a duplicate redemptionId is rejected (replayed event never double-spends)', () => {
  const first = redeemPrize(withBalance(40), { prizeId: 'founder-badge-local', actor: A, tick: 1, redemptionId: 'rd1' });
  assert.equal(redeemPrize(first.arcade, { prizeId: 'pioneer-badge-local', actor: A, tick: 2, redemptionId: 'rd1' }).reason, 'duplicate_redemption');
});

test('a non-owner cannot equip an item; the owner can', () => {
  const owned = redeemPrize(withBalance(40), { prizeId: 'founder-badge-local', actor: A, tick: 1, redemptionId: 'rd1' });
  assert.equal(equipCosmetic(owned.arcade, { actor: B, prizeId: 'founder-badge-local' }).reason, 'not_owned');
  assert.equal(equipCosmetic(owned.arcade, { actor: A, prizeId: 'founder-badge-local' }).ok, true);
});

test('balances are per-actor: B cannot spend A tickets', () => {
  const arcade = withBalance(70, A); // B has 0
  assert.equal(redeemPrize(arcade, { prizeId: 'founder-badge-local', actor: B, tick: 1, redemptionId: 'r' }).reason, 'insufficient_tickets');
  assert.equal(getInventory(arcade, B).length, 0);
});

test('there is NO transfer / resale / cash-out / stake path — those are forbidden event types', () => {
  for (const t of ['transfer_good', 'cashout_credits', 'stake_credits', 'yield_credits', 'list_for_resale', 'sell_good', 'token_trade']) {
    assert.equal(isForbiddenType(t), true, t);
  }
});
