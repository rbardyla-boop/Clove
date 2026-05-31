/**
 * discovery sideband reducers — node + room announcements.
 *
 * The registry built here is read by other reducers to decide authority (e.g.
 * only a 'moderator' may suspend a slot). Because discovery events carry low
 * logical ticks, the registry is populated before any authority check runs
 * during the canonical fold.
 */
import { withKey, ok, rej } from '../state-util.mjs';

const ROLES = new Set(['player', 'moderator', 'room']);

export function agent_announce(state, ev) {
  const role = ROLES.has(ev.payload?.role) ? ev.payload.role : 'player';
  const entry = { role, name: ev.payload?.name || ev.actor_id };
  return ok({ ...state, registry: withKey(state.registry, ev.actor_id, entry) });
}

export function room_announce(state, ev) {
  const roomId = ev.payload?.roomId;
  if (typeof roomId !== 'string' || !roomId) return rej(state, 'bad_room');
  const rooms = state.rooms[roomId]
    ? state.rooms
    : withKey(state.rooms, roomId, { machines: {}, announcedBy: ev.actor_id });
  const registry = withKey(state.registry, roomId, { role: 'room', name: ev.payload?.name || roomId });
  return ok({ ...state, rooms, registry });
}
