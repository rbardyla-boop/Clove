/**
 * Phase 1f Prize Counter — SIMULATOR-LOCAL PORT of workers/arcade/src/prize-authority.mjs.
 *
 * Redeem arcade tickets for SESSION-BOUND cosmetics, and equip/unequip them.
 * Server-authoritative rules: cost comes from the catalog (never the client),
 * balance is checked + decremented, entitlements are session-bound (never movable
 * off the session), unique items cannot be redeemed twice, you can only equip what
 * you own. There is NO transfer / resale / cash-out path — those are forbidden
 * event types rejected at the fabric boundary. Operates on an `arcade` slice.
 */
import { getPrize, EQUIP_SLOTS } from './catalog.mjs';
import { appendLedger } from './ledger.mjs';

export function ownsPrize(arcade, actor, prizeId) {
  return !!(arcade.inventory[actor] && arcade.inventory[actor][prizeId]);
}
export function getInventory(arcade, actor) {
  return Object.values(arcade.inventory[actor] || {});
}
export function getEquips(arcade, actor) {
  return { ...(arcade.equips[actor] || {}) };
}

/** Redeem a prize. redemptionId dedups. Returns { arcade, ok, reason, balance, item }. */
export function redeemPrize(arcade, { prizeId, actor, tick, redemptionId }) {
  if (typeof prizeId !== 'string' || !prizeId) return { arcade, ok: false, reason: 'malformed' };
  if (!actor) return { arcade, ok: false, reason: 'no_identity' };
  const prize = getPrize(prizeId);
  if (!prize) return { arcade, ok: false, reason: 'unknown_prize' };
  if (!prize.enabled) return { arcade, ok: false, reason: 'prize_disabled' };
  if (redemptionId && arcade.redemptions[redemptionId]) return { arcade, ok: false, reason: 'duplicate_redemption' };
  if (prize.unique && ownsPrize(arcade, actor, prizeId)) return { arcade, ok: false, reason: 'already_owned' };
  const balance = arcade.balances[actor] || 0;
  if (balance < prize.cost_tickets) return { arcade, ok: false, reason: 'insufficient_tickets' };

  const newBalance = balance - prize.cost_tickets;
  const entitlement = { prize_id: prize.prize_id, display_name: prize.display_name, category: prize.category, equip_slot: prize.equip_slot, bound_to: 'session', redeemed_at: tick };
  let next = {
    ...arcade,
    balances: { ...arcade.balances, [actor]: newBalance },
    inventory: { ...arcade.inventory, [actor]: { ...(arcade.inventory[actor] || {}), [prize.prize_id]: entitlement } },
    redemptions: redemptionId ? { ...arcade.redemptions, [redemptionId]: true } : arcade.redemptions,
  };
  next = appendLedger(next, { actor, eventType: 'tickets_spent', delta: -prize.cost_tickets, balanceAfter: newBalance, source: 'prize-counter', refId: redemptionId || `${actor}:${prize.prize_id}`, prizeId: prize.prize_id, summary: `redeemed ${prize.display_name}`, tick });
  return { arcade: next, ok: true, reason: null, balance: newBalance, item: entitlement };
}

/** Equip an owned cosmetic/badge (slot derived from the owned entitlement). */
export function equipCosmetic(arcade, { actor, prizeId }) {
  const owned = arcade.inventory[actor] && arcade.inventory[actor][prizeId];
  if (!owned) return { arcade, ok: false, reason: 'not_owned' };
  const prize = getPrize(prizeId);
  const slot = owned.equip_slot || (prize ? prize.equip_slot : null);
  if (!slot || !EQUIP_SLOTS.includes(slot)) return { arcade, ok: false, reason: 'bad_slot' };
  const equips = { ...arcade.equips, [actor]: { ...(arcade.equips[actor] || {}), [slot]: prizeId } };
  return { arcade: { ...arcade, equips }, ok: true, reason: null, slot };
}

export function unequipCosmetic(arcade, { actor, slot, prizeId }) {
  let targetSlot = slot;
  if (!targetSlot && prizeId) targetSlot = getPrize(prizeId)?.equip_slot;
  if (!targetSlot || !EQUIP_SLOTS.includes(targetSlot)) return { arcade, ok: false, reason: 'bad_slot' };
  const cur = arcade.equips[actor] || {};
  if (!cur[targetSlot]) return { arcade, ok: false, reason: 'not_equipped' };
  const next = { ...cur };
  delete next[targetSlot];
  return { arcade: { ...arcade, equips: { ...arcade.equips, [actor]: next } }, ok: true, reason: null, slot: targetSlot };
}

/** Public, privacy-safe cosmetic state: per actor, equipped slots (id + name only). */
export function publicCosmeticState(arcade) {
  const out = {};
  for (const [actor, slots] of Object.entries(arcade.equips)) {
    const equipped = {};
    for (const [slot, prizeId] of Object.entries(slots)) {
      const prize = getPrize(prizeId);
      const owned = arcade.inventory[actor] && arcade.inventory[actor][prizeId];
      equipped[slot] = { prize_id: prizeId, display_name: prize ? prize.display_name : (owned ? owned.display_name : prizeId) };
    }
    if (Object.keys(equipped).length) out[actor] = equipped;
  }
  return out;
}
