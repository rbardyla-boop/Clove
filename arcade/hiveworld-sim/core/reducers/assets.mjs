/**
 * object_state, ar_anchor and asset_sync reducers.
 *
 *  - object_state: short-lived in-room object locks (one holder, holder releases).
 *  - ar_anchor:    persistent AR anchor placeholders (no real AR in v0).
 *  - asset_sync:   equip/unequip of account-bound goods (cosmetics). You can only
 *                  equip a good you actually own in the economy slice.
 */
import { withKey, ok, rej } from '../state-util.mjs';

export function lock_object(state, ev) {
  const objectId = ev.payload?.objectId;
  if (typeof objectId !== 'string') return rej(state, 'bad_object');
  const existing = state.objects[objectId];
  if (existing && existing.lockedBy && existing.lockedBy !== ev.actor_id) return rej(state, 'locked');
  const objects = withKey(state.objects, objectId, {
    ...(existing || { objectId }),
    lockedBy: ev.actor_id,
    roomId: ev.room_id ?? null,
    tick: ev.logical_tick,
  });
  return ok({ ...state, objects });
}

export function unlock_object(state, ev) {
  const objectId = ev.payload?.objectId;
  const existing = state.objects[objectId];
  if (!existing || !existing.lockedBy) return rej(state, 'not_locked');
  if (existing.lockedBy !== ev.actor_id) return rej(state, 'not_owner');
  const objects = withKey(state.objects, objectId, { ...existing, lockedBy: null });
  return ok({ ...state, objects });
}

export function set_ar_anchor(state, ev) {
  const anchorId = ev.payload?.anchorId;
  if (typeof anchorId !== 'string') return rej(state, 'bad_anchor');
  const anchor = { actor: ev.actor_id, cellId: ev.cell_id ?? null, payload: ev.payload, tick: ev.logical_tick };
  return ok({ ...state, arAnchors: withKey(state.arAnchors, anchorId, anchor) });
}

function equipped(state, actorId) {
  return state.cosmetics[actorId]?.equipped || {};
}

export function equip_good(state, ev) {
  const goodId = ev.payload?.goodId;
  const good = state.economy.goods[goodId];
  if (!good) return rej(state, 'unknown_good');
  if (good.owner !== ev.actor_id) return rej(state, 'not_owner');
  const next = withKey(equipped(state, ev.actor_id), goodId, true);
  return ok({ ...state, cosmetics: withKey(state.cosmetics, ev.actor_id, { equipped: next }) });
}

export function unequip_good(state, ev) {
  const goodId = ev.payload?.goodId;
  const cur = { ...equipped(state, ev.actor_id) };
  if (!cur[goodId]) return rej(state, 'not_equipped');
  delete cur[goodId];
  return ok({ ...state, cosmetics: withKey(state.cosmetics, ev.actor_id, { equipped: cur }) });
}
