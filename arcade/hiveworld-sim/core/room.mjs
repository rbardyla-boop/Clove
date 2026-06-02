/**
 * RoomBaseStation — a room's fast-authority node.
 *
 * The room is also a HiveNode: it announces itself and signs cabinet_timeout
 * events on its own source chain. It keeps a lightweight liveness mirror
 * (heartbeats) plus a CHEAP occupancy projection so it can answer "who holds this
 * cabinet" and release stale locks without re-folding the entire world every tick.
 *
 * The occupancy projection folds only this room's occupancy events, and only when
 * one has actually changed (dirty flag). That is the "fast authority" story: a
 * base station tracks just its own small slice in real time. The full, canonical
 * truth still lives in the log — which is why recover() can rebuild this mirror
 * exactly by replaying. No truth is lost when the base station dies.
 */
import { HiveNode } from './node.mjs';
import { compareEvents } from './log.mjs';
import { fold } from './world.mjs';

export class RoomBaseStation extends HiveNode {
  constructor({ id, name }) {
    super({ id, role: 'room', name });
    this.heartbeats = {};      // agentId -> last tick heard
    this._occDirty = true;
    this._occCache = {};       // machineId -> machine state
    this._occEvents = [];      // this room's occupancy slice, accumulated incrementally
  }

  announce(tick) {
    return this.emit({ eventType: 'room_announce', sideband: 'discovery', payload: { roomId: this.id, name: this.name }, tick });
  }

  // ── v0.3 room presence health ──────────────────────────────────────────────
  /**
   * Report this room's heartbeat (presence sideband). `population` / connections are
   * the room's presence view; round + cabinet counts are recomputed authoritatively
   * by the registry reducer from the canonical fold. Carries NO actor ids.
   */
  heartbeat(tick, { population = null, activeConnections = null } = {}) {
    const payload = {};
    if (Number.isFinite(population)) payload.population = population;
    if (Number.isFinite(activeConnections)) payload.activeConnections = activeConnections;
    return this.emit({ eventType: 'room_heartbeat', sideband: 'presence', roomId: this.id, payload, tick });
  }

  /** Admin (room authority): set this room's status override. Gated in the reducer. */
  setStatus(status, tick) {
    return this.emit({ eventType: 'room_status_set', sideband: 'moderation', roomId: this.id, payload: { status }, tick });
  }

  /** Admin (room authority): reset this room (wipe arcade partition + occupancy, bump generation). */
  resetRoom(tick) {
    return this.emit({ eventType: 'room_reset', sideband: 'moderation', roomId: this.id, payload: {}, tick });
  }

  /**
   * v0.6: observe this room's scheduled-event window at `observeTick` and announce any
   * started / ended / featured_cabinet_changed transitions to the room feed (the reducer
   * dedups). Published at logical `tick`; `observeTick` drives the schedule window.
   */
  observeRoomEvents(observeTick, tick) {
    return this.emit({ eventType: 'room_event_transition_check', sideband: 'weather', roomId: this.id, payload: { room_id: this.id, observe_tick: observeTick }, tick });
  }

  /**
   * v0.9: set (or clear) this room's DISPLAY-ONLY presentation override (the live-ops analog
   * of the product Phase 2i set/clear_presentation). The reducer sanitizes the override
   * (drops invalid/unknown keys); pass `{}` (or an all-invalid override) to clear it back to
   * the base config. Room-authored (actor_id === room_id). Display-only — no economy effect.
   */
  setPresentationOverride(override, tick) {
    return this.emit({ eventType: 'room_presentation_override_set', sideband: 'weather', roomId: this.id, payload: { room_id: this.id, override }, tick });
  }

  noteHeartbeat(agentId, tick) {
    this.heartbeats[agentId] = tick;
  }

  _isOccSlice(ev) {
    return (ev.sideband === 'occupancy' && ev.room_id === this.id) ||
           (ev.event_type === 'room_announce' && ev.payload?.roomId === this.id);
  }

  _touchOcc(ev) {
    if (ev && this._isOccSlice(ev)) {
      this._occDirty = true;
      this._occEvents.push(ev);
    }
  }

  emit(args) {
    const ev = super.emit(args);
    this._touchOcc(ev);
    return ev;
  }

  receive(ev) {
    const res = super.receive(ev);
    if (res.status === 'accepted') this._touchOcc(ev);
    return res;
  }

  syncFrom(events) {
    const n = super.syncFrom(events);
    this._occEvents = Array.from(this.known.values()).filter((e) => this._isOccSlice(e));
    this._occDirty = true;
    return n;
  }

  /** Cheap occupancy projection: fold ONLY this room's occupancy slice, cached. */
  _occupancy() {
    if (this._occDirty) {
      const subset = this._occEvents.slice().sort(compareEvents);
      const room = fold(subset).state.rooms[this.id];
      this._occCache = room ? room.machines : {};
      this._occDirty = false;
    }
    return this._occCache;
  }

  machineState(machineId) {
    return this._occupancy()[machineId] || { machineId, occupiedBy: null, occupiedSince: null, rev: 0 };
  }

  members(now, ttlTicks) {
    return Object.entries(this.heartbeats)
      .filter(([, last]) => now - last <= ttlTicks)
      .map(([id]) => id);
  }

  /**
   * Issue cabinet_timeout events for occupants whose heartbeat is stale. Returns
   * the emitted events (the simulator broadcasts them). Offline rooms issue none.
   */
  maintain(now, ttlTicks) {
    if (!this.online) return [];
    const machines = this._occupancy();
    const out = [];
    for (const m of Object.values(machines)) {
      if (!m.occupiedBy) continue;
      const last = this.heartbeats[m.occupiedBy];
      const stale = last === undefined || now - last > ttlTicks;
      if (stale) {
        out.push(this.emit({
          eventType: 'cabinet_timeout',
          sideband: 'occupancy',
          roomId: this.id,
          payload: { machineId: m.machineId, occupant: m.occupiedBy },
          tick: now,
        }));
      }
    }
    return out;
  }

  goOffline() {
    this.online = false;
  }

  /** Come back and replay the canonical log to rebuild local state. */
  recover(events) {
    this.online = true;
    return this.syncFrom(events);
  }
}
