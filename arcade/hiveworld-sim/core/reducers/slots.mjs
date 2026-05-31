/**
 * World-space slot reducers + moderation suspension.
 *
 * A slot is a TEMPORARY game-layer permission to place approved content in a
 * simulated geo-cell. It is explicitly NOT land ownership: it has a holder, a
 * start/end tick window, an allowed-action list and a moderation status, and it
 * lapses on its own. Placement authority disappears the moment a slot expires or
 * is suspended.
 */
import { withKey, ok, rej } from '../state-util.mjs';

function isActive(slot, now) {
  return slot.moderation_status === 'active' && now >= slot.start_tick && now <= slot.end_tick;
}

function putSlot(state, slotId, slot) {
  return { ...state, slots: withKey(state.slots, slotId, slot) };
}

export function lease_slot(state, ev) {
  const p = ev.payload || {};
  const slotId = p.slotId;
  if (typeof slotId !== 'string' || !slotId) return rej(state, 'bad_slot');
  if (state.slots[slotId]) return rej(state, 'slot_exists');
  if (typeof p.cellId !== 'string') return rej(state, 'bad_cell');

  const now = ev.logical_tick;
  // A cell+type can only carry one active lease at a time.
  for (const other of Object.values(state.slots)) {
    if (other.cell_id === p.cellId && other.slot_type === p.slotType && other.holder !== ev.actor_id && isActive(other, now)) {
      return rej(state, 'cell_leased');
    }
  }

  const duration = Number.isFinite(p.durationTicks) && p.durationTicks > 0 ? p.durationTicks : 10;
  const slot = {
    slot_id: slotId,
    cell_id: p.cellId,
    holder: ev.actor_id,
    slot_type: p.slotType || 'generic',
    start_tick: now,
    end_tick: now + duration,
    allowed_actions: Array.isArray(p.allowedActions) ? p.allowedActions.slice() : ['place_object', 'remove_object'],
    placed_objects: [],
    moderation_status: 'active',
  };
  const next = putSlot(state, slotId, slot);
  return ok({ ...next, eventLog: [...next.eventLog, { tick: now, actor: ev.actor_id, type: 'lease_slot', slotId }] });
}

export function renew_slot(state, ev) {
  const slot = state.slots[ev.payload?.slotId];
  if (!slot) return rej(state, 'unknown_slot');
  if (slot.holder !== ev.actor_id) return rej(state, 'not_holder');
  if (slot.moderation_status === 'suspended') return rej(state, 'slot_suspended');
  const extend = Number.isFinite(ev.payload?.extendTicks) && ev.payload.extendTicks > 0 ? ev.payload.extendTicks : 10;
  const next = { ...slot, end_tick: slot.end_tick + extend, moderation_status: 'active' };
  return ok(putSlot(state, slot.slot_id, next));
}

export function expire_slot(state, ev) {
  const slot = state.slots[ev.payload?.slotId];
  if (!slot) return rej(state, 'unknown_slot');
  if (slot.holder !== ev.actor_id) return rej(state, 'not_holder');
  const next = { ...slot, end_tick: ev.logical_tick, moderation_status: 'expired' };
  return ok(putSlot(state, slot.slot_id, next));
}

export function place_object(state, ev) {
  const p = ev.payload || {};
  const slot = state.slots[p.slotId];
  if (!slot) return rej(state, 'unknown_slot');
  if (slot.holder !== ev.actor_id) return rej(state, 'not_holder');
  if (slot.moderation_status === 'suspended') return rej(state, 'slot_suspended');
  if (!isActive(slot, ev.logical_tick)) return rej(state, 'slot_expired');
  const action = p.action || 'place_object';
  if (!slot.allowed_actions.includes(action)) return rej(state, 'action_not_allowed');
  if (typeof p.objectId !== 'string') return rej(state, 'bad_object');
  if (slot.placed_objects.some((o) => o.objectId === p.objectId)) return rej(state, 'object_exists');

  const placed = [...slot.placed_objects, { objectId: p.objectId, kind: p.kind || 'object', tick: ev.logical_tick }];
  const next = putSlot(state, slot.slot_id, { ...slot, placed_objects: placed });
  return ok({
    ...next,
    eventLog: [...next.eventLog, { tick: ev.logical_tick, actor: ev.actor_id, type: 'place_object', slotId: slot.slot_id, objectId: p.objectId }],
  });
}

export function remove_object(state, ev) {
  const slot = state.slots[ev.payload?.slotId];
  if (!slot) return rej(state, 'unknown_slot');
  if (slot.holder !== ev.actor_id) return rej(state, 'not_holder');
  const placed = slot.placed_objects.filter((o) => o.objectId !== ev.payload?.objectId);
  return ok(putSlot(state, slot.slot_id, { ...slot, placed_objects: placed }));
}

// -- moderation sideband (authoritative override) ------------------------------

function isModerator(state, actorId) {
  return state.registry[actorId]?.role === 'moderator';
}

export function suspend_slot(state, ev) {
  if (!isModerator(state, ev.actor_id)) return rej(state, 'not_moderator');
  const slot = state.slots[ev.payload?.slotId];
  if (!slot) return rej(state, 'unknown_slot');
  const next = putSlot(state, slot.slot_id, { ...slot, moderation_status: 'suspended' });
  return ok({
    ...next,
    moderationLog: [...next.moderationLog, { tick: ev.logical_tick, actor: ev.actor_id, action: 'suspend_slot', target: slot.slot_id }],
  });
}

export function suspend_object(state, ev) {
  if (!isModerator(state, ev.actor_id)) return rej(state, 'not_moderator');
  const objectId = ev.payload?.objectId;
  if (typeof objectId !== 'string') return rej(state, 'bad_object');
  const obj = state.objects[objectId] || { objectId };
  const objects = withKey(state.objects, objectId, { ...obj, suspended: true });
  return ok({
    ...state,
    objects,
    moderationLog: [...state.moderationLog, { tick: ev.logical_tick, actor: ev.actor_id, action: 'suspend_object', target: objectId }],
  });
}
