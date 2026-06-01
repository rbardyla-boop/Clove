/**
 * room-registry reducers (v0.3 — room presence health mirror).
 *
 * Mirrors the product RoomRegistry Durable Object (workers/arcade/src/room-registry.ts).
 * The canonical fold stores the LATEST heartbeat per room + admin status overrides +
 * reset generations on `state.roomRegistry`. Health + stale-population EVICTION are
 * pure reads derived at query time (rooms.mjs) from `last_seen_tick`, so no eviction
 * is folded — exactly like the product registry deriving health from `last_seen_at`.
 *
 * Admin ops (status/reset) use the signature-backed both-gate: a config flag
 * (ctx.adminEnabled) AND the actor being the room's own authority (a player cannot
 * sign as the room). Heartbeats only require room-authority. Nothing here carries
 * private actor data — only counts, status, health, and ticks.
 */
import { ok, rej } from '../state-util.mjs';
import { isValidRoomId, isRoomStatus, getRoom, canAdmin, HEARTBEAT_SCHEMA_VERSION } from '../phase1/rooms.mjs';
import { arcadeRoom, withArcadeRoom, createArcade, activeRoundCount } from '../phase1/round-authority.mjs';

function machinesOf(state, roomId) {
  return state.rooms[roomId]?.machines || {};
}
function occupiedCount(state, roomId) {
  let n = 0;
  for (const m of Object.values(machinesOf(state, roomId))) if (m.occupiedBy != null) n += 1;
  return n;
}
function distinctOccupants(state, roomId) {
  const set = new Set();
  for (const m of Object.values(machinesOf(state, roomId))) if (m.occupiedBy != null) set.add(m.occupiedBy);
  return set.size;
}

/** A room reports its own heartbeat. Counts come from the canonical fold; population /
 * connections may be reported by the room (presence concept), defaulting to occupancy. */
export function room_heartbeat(state, ev) {
  const roomId = ev.room_id;
  if (!isValidRoomId(roomId)) return rej(state, 'unknown_room');
  if (ev.actor_id !== roomId) return rej(state, 'not_authority');
  const tick = ev.logical_tick;
  const reg = state.roomRegistry;
  const room = getRoom(roomId);
  const reportedPop = ev.payload && Number.isFinite(ev.payload.population)
    ? Math.max(0, ev.payload.population) : distinctOccupants(state, roomId);
  const reportedConns = ev.payload && Number.isFinite(ev.payload.activeConnections)
    ? Math.max(0, ev.payload.activeConnections) : reportedPop;
  const hb = {
    roomId,
    schema_version: HEARTBEAT_SCHEMA_VERSION,
    generation: reg.generations[roomId] || 0,
    population: reportedPop,
    capacity: room ? room.capacity : 0,
    status: room ? room.status : 'open',
    last_activity_tick: tick,
    reported_tick: tick,
    active_connections: reportedConns,
    active_rounds: activeRoundCount(arcadeRoom(state.arcade, roomId), tick),
    occupied_cabinets: occupiedCount(state, roomId),
    last_seen_tick: tick,
  };
  return ok({ ...state, roomRegistry: { ...reg, heartbeats: { ...reg.heartbeats, [roomId]: hb } } });
}

/** Admin: set a room's status override (open/closed/maintenance). Both-gated. */
export function room_status_set(state, ev, ctx) {
  const roomId = ev.room_id;
  if (!isValidRoomId(roomId)) return rej(state, 'unknown_room');
  const gate = canAdmin({ adminEnabled: ctx && ctx.adminEnabled, isAuthority: ev.actor_id === roomId });
  if (!gate.ok) return rej(state, gate.reason);
  const status = ev.payload && ev.payload.status;
  if (!isRoomStatus(status)) return rej(state, 'invalid_status');
  const reg = state.roomRegistry;
  return ok({ ...state, roomRegistry: { ...reg, statusOverrides: { ...reg.statusOverrides, [roomId]: status } } });
}

/** Admin: reset a room — wipe its arcade partition + occupancy, bump generation. Both-gated. */
export function room_reset(state, ev, ctx) {
  const roomId = ev.room_id;
  if (!isValidRoomId(roomId)) return rej(state, 'unknown_room');
  const gate = canAdmin({ adminEnabled: ctx && ctx.adminEnabled, isAuthority: ev.actor_id === roomId });
  if (!gate.ok) return rej(state, gate.reason);
  const tick = ev.logical_tick;
  const reg = state.roomRegistry;
  const generation = (reg.generations[roomId] || 0) + 1;
  const arcade = withArcadeRoom(state.arcade, roomId, createArcade());
  const rooms = state.rooms[roomId]
    ? { ...state.rooms, [roomId]: { ...state.rooms[roomId], machines: {} } }
    : state.rooms;
  const room = getRoom(roomId);
  const hb = {
    roomId, schema_version: HEARTBEAT_SCHEMA_VERSION, generation,
    population: 0, capacity: room ? room.capacity : 0, status: room ? room.status : 'open',
    last_activity_tick: tick, reported_tick: tick, active_connections: 0,
    active_rounds: 0, occupied_cabinets: 0, last_seen_tick: tick,
  };
  return ok({
    ...state,
    arcade,
    rooms,
    roomRegistry: {
      ...reg,
      generations: { ...reg.generations, [roomId]: generation },
      heartbeats: { ...reg.heartbeats, [roomId]: hb },
    },
  });
}
