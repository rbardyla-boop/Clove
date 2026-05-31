/**
 * market sideband reducers — INTERNAL-ONLY credits + account-bound goods.
 *
 * Hard rules baked into v0:
 *   - grant_credits only works in economyTestMode (a faucet for the testbed).
 *   - spend_credits cannot overdraw.
 *   - minted goods are always account-bound (bound: true) and never carry a
 *     resale/transfer path. The only transfer-like event types are in
 *     FORBIDDEN_EVENT_TYPES and are rejected before they ever reach a reducer.
 *
 * There is no cash-out, no external token, no price, no yield, no staking. These
 * are credits-as-arcade-tokens, nothing more.
 */
import { withKey, ok, rej } from '../state-util.mjs';
import { mockSign, hashContent } from '../hash.mjs';

function balance(state, actorId) {
  return state.economy.credits[actorId] || 0;
}

function signReceipt(state, ev, kind, detail) {
  const core = { tick: ev.logical_tick, actor: ev.actor_id, kind, detail };
  const receipt = { ...core, sig: mockSign(ev.actor_id, hashContent(core)) };
  const economy = { ...state.economy, receipts: [...state.economy.receipts, receipt] };
  return { ...state, economy };
}

export function grant_credits(state, ev, ctx) {
  if (!ctx.economyTestMode) return rej(state, 'economy_locked');
  const to = typeof ev.payload?.to === 'string' ? ev.payload.to : ev.actor_id;
  const amount = ev.payload?.amount;
  if (!Number.isInteger(amount) || amount <= 0) return rej(state, 'bad_amount');

  const credits = withKey(state.economy.credits, to, (state.economy.credits[to] || 0) + amount);
  let next = { ...state, economy: { ...state.economy, credits } };
  next = signReceipt(next, ev, 'grant_credits', { to, amount });
  return ok(next);
}

export function spend_credits(state, ev) {
  const amount = ev.payload?.amount;
  if (!Number.isInteger(amount) || amount <= 0) return rej(state, 'bad_amount');
  if (balance(state, ev.actor_id) < amount) return rej(state, 'insufficient_credits');

  const credits = withKey(state.economy.credits, ev.actor_id, balance(state, ev.actor_id) - amount);
  let next = { ...state, economy: { ...state.economy, credits } };
  next = signReceipt(next, ev, 'spend_credits', { amount, reason: ev.payload?.reason || 'spend' });
  return ok(next);
}

export function mint_bound_good(state, ev) {
  const p = ev.payload || {};
  const goodId = p.goodId;
  if (typeof goodId !== 'string' || !goodId) return rej(state, 'bad_good');
  if (state.economy.goods[goodId]) return rej(state, 'good_exists');

  const cost = Number.isInteger(p.cost) && p.cost > 0 ? p.cost : 0;
  if (cost > 0 && balance(state, ev.actor_id) < cost) return rej(state, 'insufficient_credits');

  let credits = state.economy.credits;
  if (cost > 0) credits = withKey(credits, ev.actor_id, balance(state, ev.actor_id) - cost);

  // Account-bound by construction. There is intentionally no `transferable` flag.
  const goods = withKey(state.economy.goods, goodId, { owner: ev.actor_id, type: p.goodType || 'cosmetic', bound: true });
  let next = { ...state, economy: { ...state.economy, credits, goods } };
  next = signReceipt(next, ev, 'mint_bound_good', { goodId, goodType: p.goodType || 'cosmetic', cost });
  return ok(next);
}
