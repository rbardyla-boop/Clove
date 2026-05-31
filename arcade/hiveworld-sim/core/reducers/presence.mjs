/**
 * presence sideband reducer — high-frequency, ephemeral.
 *
 * Only the latest ping per actor is retained: folding N pings for one actor keeps
 * O(1) state, so the presence slice stays bounded no matter how chatty the
 * channel is. Liveness/staleness is derived from lastTick by isPresenceStale.
 */
import { withKey, ok } from '../state-util.mjs';

export function presence_ping(state, ev) {
  const entry = {
    roomId: ev.room_id ?? null,
    cellId: ev.cell_id ?? null,
    lastTick: ev.logical_tick,
  };
  return ok({ ...state, presence: withKey(state.presence, ev.actor_id, entry) });
}

/** True if we have no (or only stale) presence for an actor at `now`. */
export function isPresenceStale(state, actorId, now, ttlTicks) {
  const p = state.presence[actorId];
  if (!p) return true;
  return now - p.lastTick > ttlTicks;
}
