/**
 * Phase 1/2 arcade reducers — the server-authoritative round/ticket/prize/challenge
 * flow expressed as pure fold reducers over the world's `arcade` slice.
 *
 * Phase 2 parity: the arcade slice is PARTITIONED BY ROOM. Each reducer scopes to
 * the event's `room_id` partition (read the room substate, run the pure function,
 * write the substate back under the same room), so tickets / ledger / inventory /
 * challenges / feed are ISOLATED per room — mirroring the per-room product DOs.
 *
 * Authority lives in the fold (the canonical truth), exactly like occupancy. The
 * ticket award is computed by the ported pure formulas, never supplied by the
 * client. Internal arcade points only.
 */
import { ok, rej } from '../state-util.mjs';
import { startRound, submitRound, arcadeRoom, withArcadeRoom, DEFAULT_SIM_ROOM } from '../phase1/round-authority.mjs';
import { redeemPrize, equipCosmetic, unequipCosmetic } from '../phase1/prize.mjs';
import { recordRedemption, claimReward } from '../phase1/challenges.mjs';
import { appendFeed } from '../phase1/feed.mjs';
import { isValidRoomId } from '../phase1/rooms.mjs';
import { initialRoomEventTracker, deriveRoomEventTransitions, roomEventFeedEntryForTransition } from '../phase1/room-events.mjs';

function occupantOf(state, roomId, machineId) {
  return state.rooms[roomId]?.machines?.[machineId]?.occupiedBy ?? null;
}
const roomOf = (ev) => ev.room_id || DEFAULT_SIM_ROOM;

export function cabinet_catalog(state, ev) {
  // A room/world node announces the catalog on the discovery sideband. Recorded
  // for parity; the catalog itself is static (catalog.mjs is the authority).
  const count = Array.isArray(ev.payload?.cabinetIds) ? ev.payload.cabinetIds.length : 0;
  const arcade = { ...state.arcade, catalogAnnounce: { by: ev.actor_id, tick: ev.logical_tick, cabinetCount: count } };
  return ok({ ...state, arcade });
}

export function arcade_round_start(state, ev) {
  const roomId = roomOf(ev);
  const machineId = ev.payload?.machineId;
  const res = startRound(arcadeRoom(state.arcade, roomId), {
    machineId, occupantId: occupantOf(state, ev.room_id, machineId),
    actor: ev.actor_id, roundId: ev.payload?.roundId, tick: ev.logical_tick,
  });
  if (!res.ok) return rej(state, res.reason);
  return ok({ ...state, arcade: withArcadeRoom(state.arcade, roomId, res.arcade) });
}

export function arcade_round_submit(state, ev) {
  const roomId = roomOf(ev);
  const res = submitRound(arcadeRoom(state.arcade, roomId), {
    payload: ev.payload, senderId: ev.actor_id,
    occupantId: occupantOf(state, ev.room_id, ev.payload?.machineId), tick: ev.logical_tick,
  });
  if (!res.ok) return rej(state, res.reason);
  return ok({ ...state, arcade: withArcadeRoom(state.arcade, roomId, res.arcade) });
}

export function arcade_redeem(state, ev) {
  const roomId = roomOf(ev);
  const tick = ev.logical_tick;
  const res = redeemPrize(arcadeRoom(state.arcade, roomId), { prizeId: ev.payload?.prizeId, actor: ev.actor_id, tick, redemptionId: ev.payload?.redemptionId });
  if (!res.ok) return rej(state, res.reason);
  let sub = res.arcade;
  const rec = recordRedemption(sub, { actor: ev.actor_id, tick });
  sub = rec.arcade;
  sub = appendFeed(sub, { type: 'prize_redeem', actor: ev.actor_id, summary: `${ev.actor_id} redeemed ${res.item.display_name}`, source: 'prize-counter', tick });
  for (const c of rec.newlyCompleted) {
    sub = appendFeed(sub, { type: 'challenge_completed', actor: ev.actor_id, summary: `${ev.actor_id} completed ${c.display_name}`, source: c.challenge_id, tick });
  }
  return ok({ ...state, arcade: withArcadeRoom(state.arcade, roomId, sub) });
}

export function arcade_equip(state, ev) {
  const roomId = roomOf(ev);
  const sub0 = arcadeRoom(state.arcade, roomId);
  const res = equipCosmetic(sub0, { actor: ev.actor_id, prizeId: ev.payload?.prizeId });
  if (!res.ok) return rej(state, res.reason);
  const owned = sub0.inventory[ev.actor_id]?.[ev.payload.prizeId];
  const name = owned ? owned.display_name : ev.payload.prizeId;
  const sub = appendFeed(res.arcade, { type: 'cosmetic_equip', actor: ev.actor_id, summary: `${ev.actor_id} equipped ${name}`, source: res.slot, tick: ev.logical_tick });
  return ok({ ...state, arcade: withArcadeRoom(state.arcade, roomId, sub) });
}

export function arcade_unequip(state, ev) {
  const roomId = roomOf(ev);
  const res = unequipCosmetic(arcadeRoom(state.arcade, roomId), { actor: ev.actor_id, slot: ev.payload?.slot, prizeId: ev.payload?.prizeId });
  if (!res.ok) return rej(state, res.reason);
  return ok({ ...state, arcade: withArcadeRoom(state.arcade, roomId, res.arcade) });
}

export function arcade_claim_challenge(state, ev) {
  const roomId = roomOf(ev);
  const tick = ev.logical_tick;
  const res = claimReward(arcadeRoom(state.arcade, roomId), { actor: ev.actor_id, challengeId: ev.payload?.challengeId, tick });
  if (!res.ok) return rej(state, res.reason);
  let sub = res.arcade;
  if (res.badge && res.achievement) {
    sub = appendFeed(sub, { type: 'achievement_unlocked', actor: ev.actor_id, summary: `${ev.actor_id} ${res.achievement.public_safe_summary}`, source: res.achievement.achievement_id, tick });
  }
  return ok({ ...state, arcade: withArcadeRoom(state.arcade, roomId, sub) });
}

/**
 * v0.6: a room observes its own scheduled-event window at `observe_tick` and announces
 * any started / ended / featured_cabinet_changed transitions to its public feed (once
 * each, deduped by the per-room eventTracker). Room-authored (actor_id === room_id),
 * like room_heartbeat. Deterministic + convergent: the canonical fold processes the
 * checks in canonical order, and a stale/out-of-order observation is a monotonic no-op,
 * so the final feed + tracker are identical regardless of arrival order. Display-only —
 * never touches tickets / ledger / inventory / economy.
 */
export function room_event_transition_check(state, ev) {
  const roomId = ev.room_id || ev.payload?.room_id;
  if (!isValidRoomId(roomId)) return rej(state, 'unknown_room');
  if (ev.actor_id !== roomId) return rej(state, 'not_authority');
  const observeTick = ev.payload?.observe_tick;
  if (!Number.isInteger(observeTick) || observeTick < 0) return rej(state, 'invalid_observe_tick');

  const sub = arcadeRoom(state.arcade, roomId);
  const tracker = sub.eventTracker || initialRoomEventTracker(0);
  // Monotonic: a stale/backward observation is a no-op (idempotent convergence).
  if (observeTick < (Number(tracker.last_transition_checked_tick) || -1)) return ok(state);

  const { transitions, state: nextTracker } = deriveRoomEventTransitions(tracker, roomId, observeTick);
  let next = { ...sub, eventTracker: nextTracker };
  for (const tr of transitions) {
    next = appendFeed(next, roomEventFeedEntryForTransition(tr));
  }
  return ok({ ...state, arcade: withArcadeRoom(state.arcade, roomId, next) });
}
