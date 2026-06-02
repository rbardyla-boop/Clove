/**
 * Prize Counter authority — PURE, runtime-agnostic.
 *
 * Redeem arcade tickets for account/session-bound cosmetics, and equip/unequip
 * them. Operates on the shared ticket state (balances/inventory/equips/ledger).
 *
 * Server-authoritative rules:
 *  - cost comes from the catalog, never the client (client cost/discount/balance ignored);
 *  - balance is checked + decremented on the server;
 *  - entitlements are SESSION-BOUND (tied to the room session, never movable off it);
 *  - unique items cannot be redeemed twice;
 *  - you can only equip an item you actually own.
 *
 * There is no path to move an entitlement off its owning session. See
 * docs/NEON_CIRCUIT_PHASE1F_ARCADE_LOOP.md for the full non-goals list.
 */
import { getPrize, EQUIP_SLOTS } from './catalog.mjs';
import { appendLedger } from './ledger.mjs';

export function getInventory(state, playerId) {
  const inv = state.inventory[playerId] || {};
  return Object.values(inv);
}
export function getEquips(state, playerId) {
  return { ...(state.equips[playerId] || {}) };
}
export function ownsPrize(state, playerId, prizeId) {
  return !!(state.inventory[playerId] && state.inventory[playerId][prizeId]);
}

/** Redeem a prize. redemptionId is server-issued (dedup). Returns rich result. */
export function redeemPrize(state, { prizeId, playerId, now, redemptionId }) {
  if (typeof prizeId !== 'string' || !prizeId) return { state, ok: false, reason: 'malformed' };
  if (!playerId) return { state, ok: false, reason: 'no_identity' };
  const prize = getPrize(prizeId);
  if (!prize) return { state, ok: false, reason: 'unknown_prize' };
  if (!prize.enabled) return { state, ok: false, reason: 'prize_disabled' };
  if (!Number.isInteger(prize.cost_tickets) || prize.cost_tickets <= 0) return { state, ok: false, reason: 'bad_cost' };
  if (redemptionId && state.redemptions[redemptionId]) return { state, ok: false, reason: 'duplicate_redemption' };
  if (prize.unique && ownsPrize(state, playerId, prizeId)) return { state, ok: false, reason: 'already_owned' };

  const balance = state.balances[playerId] || 0;
  if (balance < prize.cost_tickets) return { state, ok: false, reason: 'insufficient_tickets' };

  const newBalance = balance - prize.cost_tickets;
  const entitlement = {
    prize_id: prize.prize_id,
    display_name: prize.display_name,
    category: prize.category,
    equip_slot: prize.equip_slot,
    bound_to: prize.bound_to, // 'session'
    redeemed_at: now,
    redemption_id: redemptionId || null,
  };
  let next = {
    ...state,
    balances: { ...state.balances, [playerId]: newBalance },
    inventory: { ...state.inventory, [playerId]: { ...(state.inventory[playerId] || {}), [prize.prize_id]: entitlement } },
    redemptions: redemptionId ? { ...state.redemptions, [redemptionId]: true } : state.redemptions,
  };
  next = appendLedger(next, {
    playerId, eventType: 'tickets_spent', delta: -prize.cost_tickets, balanceAfter: newBalance,
    source: 'prize-counter', refId: redemptionId || `${playerId}:${prize.prize_id}`, prizeId: prize.prize_id,
    summary: `redeemed ${prize.display_name}`, now,
  }).state;

  return {
    state: next, ok: true, reason: null, balance: newBalance, item: entitlement,
    publicSummary: { playerId, action: 'redeemed', display_name: prize.display_name, prize_id: prize.prize_id },
  };
}

/** Equip an owned cosmetic. Replaces any prior item in the same slot. */
export function equipCosmetic(state, { playerId, prizeId }) {
  const prize = getPrize(prizeId);
  if (!prize) return { state, ok: false, reason: 'unknown_prize' };
  if (!ownsPrize(state, playerId, prizeId)) return { state, ok: false, reason: 'not_owned' };
  const slot = prize.equip_slot;
  if (!EQUIP_SLOTS.includes(slot)) return { state, ok: false, reason: 'bad_slot' };
  const equips = { ...state.equips, [playerId]: { ...(state.equips[playerId] || {}), [slot]: prizeId } };
  return { state: { ...state, equips }, ok: true, reason: null, slot, prizeId };
}

/** Unequip by slot, or by prizeId (slot derived from the catalog). */
export function unequipCosmetic(state, { playerId, slot, prizeId }) {
  let targetSlot = slot;
  if (!targetSlot && prizeId) targetSlot = getPrize(prizeId)?.equip_slot;
  if (!targetSlot || !EQUIP_SLOTS.includes(targetSlot)) return { state, ok: false, reason: 'bad_slot' };
  const cur = state.equips[playerId] || {};
  if (!cur[targetSlot]) return { state, ok: false, reason: 'not_equipped' };
  const nextForPlayer = { ...cur };
  delete nextForPlayer[targetSlot];
  return { state: { ...state, equips: { ...state.equips, [playerId]: nextForPlayer } }, ok: true, reason: null, slot: targetSlot };
}

/**
 * Public, privacy-safe cosmetic state: per player, what is equipped in each slot
 * (prize id + display name only). No balance, no ledger, no full inventory.
 */
export function publicCosmeticState(state) {
  const out = {};
  for (const [playerId, slots] of Object.entries(state.equips)) {
    const equipped = {};
    for (const [slot, prizeId] of Object.entries(slots)) {
      const prize = getPrize(prizeId);
      equipped[slot] = { prize_id: prizeId, display_name: prize ? prize.display_name : prizeId };
    }
    if (Object.keys(equipped).length) out[playerId] = equipped;
  }
  return out;
}
