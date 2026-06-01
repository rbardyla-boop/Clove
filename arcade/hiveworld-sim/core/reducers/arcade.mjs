/**
 * Phase 1 arcade reducers — the server-authoritative round/ticket/prize/challenge
 * flow expressed as pure fold reducers over the world's `arcade` slice.
 *
 * Authority lives in the fold (the canonical truth), exactly like occupancy: an
 * agent EMITS an arcade event and the reducer ACCEPTS or REJECTS it against world
 * state (occupancy + the round registry + the catalog-resolved ruleset). The
 * ticket award is computed by the ported pure formulas — never supplied by the
 * client. Internal arcade points only.
 */
import { ok, rej } from '../state-util.mjs';
import { startRound, submitRound } from '../phase1/round-authority.mjs';
import { redeemPrize, equipCosmetic, unequipCosmetic } from '../phase1/prize.mjs';
import { recordRedemption, claimReward } from '../phase1/challenges.mjs';
import { appendFeed } from '../phase1/feed.mjs';

function occupantOf(state, roomId, machineId) {
  return state.rooms[roomId]?.machines?.[machineId]?.occupiedBy ?? null;
}

export function cabinet_catalog(state, ev) {
  // A room/world node announces the catalog on the discovery sideband. Recorded
  // for parity; the catalog itself is static (catalog.mjs is the authority).
  const count = Array.isArray(ev.payload?.cabinetIds) ? ev.payload.cabinetIds.length : 0;
  const arcade = { ...state.arcade, catalogAnnounce: { by: ev.actor_id, tick: ev.logical_tick, cabinetCount: count } };
  return ok({ ...state, arcade });
}

export function arcade_round_start(state, ev) {
  const machineId = ev.payload?.machineId;
  const res = startRound(state.arcade, {
    machineId, occupantId: occupantOf(state, ev.room_id, machineId),
    actor: ev.actor_id, roundId: ev.payload?.roundId, tick: ev.logical_tick,
  });
  if (!res.ok) return rej(state, res.reason);
  return ok({ ...state, arcade: res.arcade });
}

export function arcade_round_submit(state, ev) {
  const res = submitRound(state.arcade, {
    payload: ev.payload, senderId: ev.actor_id,
    occupantId: occupantOf(state, ev.room_id, ev.payload?.machineId), tick: ev.logical_tick,
  });
  if (!res.ok) return rej(state, res.reason);
  return ok({ ...state, arcade: res.arcade });
}

export function arcade_redeem(state, ev) {
  const tick = ev.logical_tick;
  const res = redeemPrize(state.arcade, { prizeId: ev.payload?.prizeId, actor: ev.actor_id, tick, redemptionId: ev.payload?.redemptionId });
  if (!res.ok) return rej(state, res.reason);
  let arcade = res.arcade;
  const rec = recordRedemption(arcade, { actor: ev.actor_id, tick });
  arcade = rec.arcade;
  arcade = appendFeed(arcade, { type: 'prize_redeem', actor: ev.actor_id, summary: `${ev.actor_id} redeemed ${res.item.display_name}`, source: 'prize-counter', tick });
  for (const c of rec.newlyCompleted) {
    arcade = appendFeed(arcade, { type: 'challenge_completed', actor: ev.actor_id, summary: `${ev.actor_id} completed ${c.display_name}`, source: c.challenge_id, tick });
  }
  return ok({ ...state, arcade });
}

export function arcade_equip(state, ev) {
  const res = equipCosmetic(state.arcade, { actor: ev.actor_id, prizeId: ev.payload?.prizeId });
  if (!res.ok) return rej(state, res.reason);
  const owned = state.arcade.inventory[ev.actor_id]?.[ev.payload.prizeId];
  const name = owned ? owned.display_name : ev.payload.prizeId;
  const arcade = appendFeed(res.arcade, { type: 'cosmetic_equip', actor: ev.actor_id, summary: `${ev.actor_id} equipped ${name}`, source: res.slot, tick: ev.logical_tick });
  return ok({ ...state, arcade });
}

export function arcade_unequip(state, ev) {
  const res = unequipCosmetic(state.arcade, { actor: ev.actor_id, slot: ev.payload?.slot, prizeId: ev.payload?.prizeId });
  if (!res.ok) return rej(state, res.reason);
  return ok({ ...state, arcade: res.arcade });
}

export function arcade_claim_challenge(state, ev) {
  const tick = ev.logical_tick;
  const res = claimReward(state.arcade, { actor: ev.actor_id, challengeId: ev.payload?.challengeId, tick });
  if (!res.ok) return rej(state, res.reason);
  let arcade = res.arcade;
  if (res.badge && res.achievement) {
    arcade = appendFeed(arcade, { type: 'achievement_unlocked', actor: ev.actor_id, summary: `${ev.actor_id} ${res.achievement.public_safe_summary}`, source: res.achievement.achievement_id, tick });
  }
  return ok({ ...state, arcade });
}
