/**
 * D. Redemption tests + E. Inventory/equip tests + cross-player isolation (F, pure).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  redeemPrize, equipCosmetic, unequipCosmetic, getInventory, getEquips, ownsPrize, publicCosmeticState,
} from '../../workers/arcade/src/prize-authority.mjs';
import { getLedger } from '../../workers/arcade/src/ledger.mjs';
import { createTicketState } from '../../workers/arcade/src/round-authority.mjs';

const NOW = 2_000_000;
const A = 'player:a';
const B = 'player:b';

function withBalance(player, n) {
  const s = createTicketState();
  return { ...s, balances: { ...s.balances, [player]: n } };
}

// ── D. redemption ─────────────────────────────────────────────────────────────
test('sufficient tickets redeem; server subtracts the catalog cost and records a spend ledger entry', () => {
  const s = withBalance(A, 30);
  const r = redeemPrize(s, { prizeId: 'neon-visor', playerId: A, now: NOW, redemptionId: 'rd1' }); // cost 20
  assert.equal(r.ok, true);
  assert.equal(r.balance, 10);
  assert.ok(ownsPrize(r.state, A, 'neon-visor'));
  const led = getLedger(r.state, A);
  assert.equal(led[led.length - 1].event_type, 'tickets_spent');
  assert.equal(led[led.length - 1].delta, -20);
});

test('insufficient tickets are rejected and nothing is spent', () => {
  const s = withBalance(A, 5);
  const r = redeemPrize(s, { prizeId: 'neon-visor', playerId: A, now: NOW, redemptionId: 'rd1' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'insufficient_tickets');
  assert.equal(r.state.balances[A], 5);
});

test('client-supplied cost/discount/balance are ignored — server uses the catalog cost', () => {
  const s = withBalance(A, 100);
  // hostile extra fields should have zero effect
  const r = redeemPrize(s, { prizeId: 'founder-badge-local', playerId: A, now: NOW, redemptionId: 'rd1', cost_tickets: 0, discount: 9999, balance: 999999 });
  assert.equal(r.ok, true);
  assert.equal(r.balance, 90); // 100 - 10 (catalog cost), not 100 - 0
});

test('unknown / disabled / malformed prizes are rejected', () => {
  const s = withBalance(A, 100);
  assert.equal(redeemPrize(s, { prizeId: 'nope', playerId: A, now: NOW, redemptionId: 'x' }).reason, 'unknown_prize');
  assert.equal(redeemPrize(s, { prizeId: 'mystery-unit-soon', playerId: A, now: NOW, redemptionId: 'x' }).reason, 'prize_disabled');
  assert.equal(redeemPrize(s, { prizeId: '', playerId: A, now: NOW, redemptionId: 'x' }).reason, 'malformed');
});

test('a duplicate redemption id does not double-spend', () => {
  const s = withBalance(A, 100);
  const r1 = redeemPrize(s, { prizeId: 'neon-visor', playerId: A, now: NOW, redemptionId: 'dup' });
  const r2 = redeemPrize(r1.state, { prizeId: 'cabinet-glow-blue', playerId: A, now: NOW, redemptionId: 'dup' });
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'duplicate_redemption');
  assert.equal(r2.state.balances[A], 80); // only the first (20) was spent
});

test('a unique item cannot be redeemed twice', () => {
  const s = withBalance(A, 100);
  const r1 = redeemPrize(s, { prizeId: 'neon-visor', playerId: A, now: NOW, redemptionId: 'a' });
  const r2 = redeemPrize(r1.state, { prizeId: 'neon-visor', playerId: A, now: NOW, redemptionId: 'b' });
  assert.equal(r2.reason, 'already_owned');
});

// ── E. inventory / equip ──────────────────────────────────────────────────────
test('redeemed item appears in owner inventory; equip then unequip works', () => {
  const s = withBalance(A, 100);
  const r = redeemPrize(s, { prizeId: 'neon-visor', playerId: A, now: NOW, redemptionId: 'a' });
  assert.equal(getInventory(r.state, A).length, 1);
  const eq = equipCosmetic(r.state, { playerId: A, prizeId: 'neon-visor' });
  assert.equal(eq.ok, true);
  assert.equal(getEquips(eq.state, A).avatar_head, 'neon-visor');
  const un = unequipCosmetic(eq.state, { playerId: A, slot: 'avatar_head' });
  assert.equal(un.ok, true);
  assert.equal(getEquips(un.state, A).avatar_head, undefined);
});

test('a non-owned item cannot be equipped', () => {
  const s = withBalance(A, 100);
  const r = redeemPrize(s, { prizeId: 'neon-visor', playerId: A, now: NOW, redemptionId: 'a' });
  // B owns nothing
  assert.equal(equipCosmetic(r.state, { playerId: B, prizeId: 'neon-visor' }).reason, 'not_owned');
});

test('equipping replaces the prior item in the same slot', () => {
  let s = withBalance(A, 100);
  s = redeemPrize(s, { prizeId: 'founder-badge-local', playerId: A, now: NOW, redemptionId: 'a' }).state;
  s = redeemPrize(s, { prizeId: 'pioneer-badge-local', playerId: A, now: NOW, redemptionId: 'b' }).state;
  s = equipCosmetic(s, { playerId: A, prizeId: 'founder-badge-local' }).state;
  assert.equal(getEquips(s, A).badge, 'founder-badge-local');
  s = equipCosmetic(s, { playerId: A, prizeId: 'pioneer-badge-local' }).state; // same 'badge' slot
  assert.equal(getEquips(s, A).badge, 'pioneer-badge-local'); // replaced
});

test('public cosmetic state exposes only safe summaries (no balance/ledger/inventory)', () => {
  let s = withBalance(A, 100);
  s = redeemPrize(s, { prizeId: 'neon-visor', playerId: A, now: NOW, redemptionId: 'a' }).state;
  s = equipCosmetic(s, { playerId: A, prizeId: 'neon-visor' }).state;
  const pub = publicCosmeticState(s);
  assert.deepEqual(pub[A].avatar_head, { prize_id: 'neon-visor', display_name: 'Neon Visor' });
  const serialized = JSON.stringify(pub);
  assert.ok(!serialized.includes('balance'));
  assert.ok(!serialized.includes('ledger'));
  assert.ok(!serialized.includes('redemption_id'));
});

test('redeem uses the sender’s own balance — B cannot spend A’s tickets', () => {
  // A has 100, B has 0 (shared state, per-player balances)
  let s = withBalance(A, 100);
  const r = redeemPrize(s, { prizeId: 'neon-visor', playerId: B, now: NOW, redemptionId: 'x' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'insufficient_tickets'); // B's own balance is 0
  assert.equal(r.state.balances[A], 100); // A untouched
});
