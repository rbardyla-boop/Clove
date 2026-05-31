/**
 * occupancy sideband reducers — cabinet authority.
 *
 * Mirrors the canonical Phase-1b Durable Object (workers/arcade/src/arcade-room.ts):
 * one occupant per machine, monotonically increasing `rev`, optional optimistic
 * concurrency via expectedRev, and a room-authoritative timeout release. The
 * difference is that here the truth is the canonical fold of the log rather than
 * a live in-memory object — which is exactly what lets a base station recover by
 * replaying.
 */
import { withKey, ok, rej } from '../state-util.mjs';

function getMachine(room, machineId) {
  return room.machines[machineId] || { machineId, occupiedBy: null, occupiedSince: null, rev: 0 };
}

function putMachine(state, roomId, machineId, machine) {
  const room = state.rooms[roomId];
  const machines = withKey(room.machines, machineId, machine);
  return { ...state, rooms: withKey(state.rooms, roomId, { ...room, machines }) };
}

export function occupy_cabinet(state, ev) {
  const roomId = ev.room_id;
  const room = state.rooms[roomId];
  if (!room) return rej(state, 'unknown_room');

  const machineId = ev.payload?.machineId;
  if (typeof machineId !== 'string') return rej(state, 'bad_machine');

  const m = getMachine(room, machineId);
  const expected = ev.payload?.expectedRev;
  if (typeof expected === 'number' && expected !== m.rev) return rej(state, 'stale_rev');

  if (m.occupiedBy !== null) {
    if (m.occupiedBy === ev.actor_id) return ok(state); // idempotent re-occupy by holder
    return rej(state, 'busy');
  }

  const next = { machineId, occupiedBy: ev.actor_id, occupiedSince: ev.logical_tick, rev: m.rev + 1 };
  return ok(putMachine(state, roomId, machineId, next));
}

export function release_cabinet(state, ev) {
  const room = state.rooms[ev.room_id];
  if (!room) return rej(state, 'unknown_room');
  const m = room.machines[ev.payload?.machineId];
  if (!m || m.occupiedBy === null) return rej(state, 'not_occupied');
  if (m.occupiedBy !== ev.actor_id) return rej(state, 'not_owner');

  const next = { ...m, occupiedBy: null, occupiedSince: null, rev: m.rev + 1 };
  return ok(putMachine(state, ev.room_id, ev.payload.machineId, next));
}

export function cabinet_timeout(state, ev) {
  // Only the room that owns the machine may force a stale-lock release.
  const roomId = ev.room_id;
  const room = state.rooms[roomId];
  if (!room) return rej(state, 'unknown_room');
  if (ev.actor_id !== roomId) return rej(state, 'not_authority');

  const m = room.machines[ev.payload?.machineId];
  if (!m || m.occupiedBy === null) return rej(state, 'not_occupied');
  if (ev.payload?.occupant && ev.payload.occupant !== m.occupiedBy) {
    return rej(state, 'occupant_changed');
  }

  const next = { ...m, occupiedBy: null, occupiedSince: null, rev: m.rev + 1 };
  return ok(putMachine(state, roomId, ev.payload.machineId, next));
}
