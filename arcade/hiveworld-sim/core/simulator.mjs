/**
 * HiveSimulator — the orchestrator and the proof harness.
 *
 * Owns the ONE canonical Sideband CRDT Log (ground truth), a set of player agent
 * nodes and room base stations, a logical clock, and fault-injection primitives.
 * Every event is published onto the fabric (structural validation at the boundary)
 * and then delivered to every node's local replica, subject to the faults the
 * scenario chooses: delay, duplication, drop (offline), out-of-order.
 *
 * Convergence is verifiable at any time by comparing each node's folded
 * fingerprint to the canonical fold. Recovery is modelled by replaying the
 * canonical snapshot into a reconnecting node or a recovered base station.
 */
import { SidebandCRDTLog } from './log.mjs';
import { foldLog, applyEvent } from './world.mjs';
import { createInitialState, DEFAULT_CTX, stateFingerprint } from './state-util.mjs';
import { summarizeEvent } from './events.mjs';
import { makeRng } from './rng.mjs';
import { PlayerAgentNode } from './agent.mjs';
import { RoomBaseStation } from './room.mjs';

export class HiveSimulator {
  constructor({ seed = 'neon', ctx = {}, staleLockTicks = 5 } = {}) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.ctx = { ...DEFAULT_CTX, ...ctx };
    this.staleLockTicks = staleLockTicks;

    this.canonicalLog = new SidebandCRDTLog();
    this.agents = new Map();
    this.rooms = new Map();
    this.tick = 0;

    this.ingestRejections = []; // structural rejections at the fabric boundary
    this.sidebandTraffic = {};  // sideband -> accepted-into-fabric count
    this.authorityReport = { timeouts: [], roomOutages: [], reconnects: [] };
    this.desyncObservations = []; // { tick, label, diverged: [{id, fingerprint}] }
    this.pending = [];          // delayed deliveries: { deliverAtTick, event }
    this.trace = [];            // human-readable action log for the UI
  }

  // ── topology ────────────────────────────────────────────────────────────────
  addAgent(opts) {
    const a = new PlayerAgentNode(opts);
    this.agents.set(a.id, a);
    return a;
  }

  addRoom(opts) {
    const r = new RoomBaseStation(opts);
    this.rooms.set(r.id, r);
    return r;
  }

  nodes() {
    return [...this.agents.values(), ...this.rooms.values()];
  }

  log(line) {
    this.trace.push({ tick: this.tick, line });
  }

  // ── publishing ───────────────────────────────────────────────────────────────
  /**
   * Put an already-emitted event onto the fabric, then deliver to node replicas.
   * opts: { duplicate, delayTicks }. Structurally invalid events are rejected at
   * the boundary and never delivered.
   */
  publish(event, opts = {}) {
    const res = this.canonicalLog.ingest(event);
    if (res.status === 'rejected') {
      this.ingestRejections.push({
        tick: this.tick, phase: 'ingest', reason: res.reason,
        actor: event.actor_id, type: event.event_type, summary: summarizeEvent(event),
      });
      this.log(`fabric REJECT ${event.event_type} by ${event.actor_id} :: ${res.reason}`);
      return res;
    }
    if (res.status === 'accepted') {
      this.sidebandTraffic[event.sideband] = (this.sidebandTraffic[event.sideband] || 0) + 1;
      this._noteRoomHeartbeat(event);
    }

    const { duplicate = false, delayTicks = 0 } = opts;
    if (delayTicks > 0) {
      this.pending.push({ deliverAtTick: this.tick + delayTicks, event });
      this.log(`delay ${event.event_type} by ${event.actor_id} (+${delayTicks}t)`);
    } else {
      this._deliver(event);
      if (duplicate) this._deliver(event); // nodes must dedup the second copy
    }
    return res;
  }

  _deliver(event) {
    for (const node of this.nodes()) {
      if (node.id === event.actor_id) continue; // emitter already self-knows it
      node.receive(event);
    }
  }

  _noteRoomHeartbeat(event) {
    const roomId = event.room_id || event.payload?.roomId;
    if (!roomId) return;
    const room = this.rooms.get(roomId);
    if (room && room.online) room.noteHeartbeat(event.actor_id, event.logical_tick);
  }

  /** Deliver any delayed events whose time has come (and optionally shuffle them). */
  drainDue(shuffle = false) {
    const due = this.pending.filter((p) => p.deliverAtTick <= this.tick);
    this.pending = this.pending.filter((p) => p.deliverAtTick > this.tick);
    const order = shuffle ? this.rng.shuffle(due) : due;
    for (const p of order) this._deliver(p.event);
    return order.length;
  }

  /** Deliver everything still pending, regardless of schedule (final convergence). */
  flushPending() {
    const due = this.pending;
    this.pending = [];
    for (const p of due) this._deliver(p.event);
    return due.length;
  }

  // ── clock + maintenance ──────────────────────────────────────────────────────
  advance(steps = 1, perTick = null) {
    for (let i = 0; i < steps; i++) {
      this.tick += 1;
      this.drainDue();
      if (perTick) perTick(this.tick, this);
      this._maintainRooms();
    }
  }

  /** Advance the clock by one for an external (UI) action; deliver any due events. */
  nextTick() {
    this.tick += 1;
    this.drainDue();
    return this.tick;
  }

  _maintainRooms() {
    for (const room of this.rooms.values()) {
      const timeouts = room.maintain(this.tick, this.staleLockTicks);
      for (const ev of timeouts) {
        this.authorityReport.timeouts.push({ tick: this.tick, room: room.id, machine: ev.payload.machineId, occupant: ev.payload.occupant });
        this.log(`room ${room.id} TIMEOUT ${ev.payload.machineId} (occupant ${ev.payload.occupant} stale)`);
        this.publish(ev);
      }
    }
  }

  // ── fault injection ──────────────────────────────────────────────────────────
  disconnectAgent(id) {
    const a = this.agents.get(id);
    if (a) { a.setOnline(false); this.log(`agent ${id} DISCONNECT`); }
  }

  reconnectAgent(id) {
    const a = this.agents.get(id);
    if (!a) return 0;
    a.setOnline(true);
    const replayed = a.syncFrom(this.canonicalLog.snapshot());
    this.authorityReport.reconnects.push({ tick: this.tick, id, replayed });
    this.log(`agent ${id} RECONNECT + replay ${replayed} events`);
    return replayed;
  }

  roomOutage(id) {
    const r = this.rooms.get(id);
    if (r) { r.goOffline(); this.authorityReport.roomOutages.push({ tick: this.tick, id, kind: 'offline' }); this.log(`room ${id} OUTAGE`); }
  }

  roomRecover(id) {
    const r = this.rooms.get(id);
    if (!r) return 0;
    const replayed = r.recover(this.canonicalLog.snapshot());
    this.authorityReport.roomOutages.push({ tick: this.tick, id, kind: 'recovered', replayed });
    this.log(`room ${id} RECOVER + replay ${replayed} events`);
    return replayed;
  }

  /**
   * Shallow-copy an event and overwrite fields WITHOUT re-signing — i.e. forge a
   * tampered envelope. The fabric must reject it (bad hash / bad signature).
   */
  tamper(event, patch) {
    return { ...event, ...patch };
  }

  // ── observation / reporting ──────────────────────────────────────────────────
  /**
   * Snapshot per-node divergence vs the canonical event SET right now. Set
   * equality is a sound convergence proof (the fold is a pure function of the
   * set) and is cheap, so observation never re-folds the whole world.
   */
  observeDesync(label = '') {
    const canonical = this.canonicalLog.setFingerprint();
    const diverged = [];
    for (const node of this.nodes()) {
      if (node.subscriptions) continue; // partial subscribers are expected to differ
      const fp = node.knownSetFingerprint();
      if (fp !== canonical) diverged.push({ id: node.id, eventCount: node.known.size });
    }
    const obs = { tick: this.tick, label, diverged };
    this.desyncObservations.push(obs);
    return obs;
  }

  /** Per-event authority audit (occupancy transitions) from the canonical order. */
  _auditOccupancy() {
    let state = createInitialState();
    const transitions = [];
    for (const ev of this.canonicalLog.ordered()) {
      const before = state.rooms[ev.room_id]?.machines?.[ev.payload?.machineId]?.occupiedBy ?? null;
      const res = applyEvent(state, ev, this.ctx);
      state = res.state;
      if (res.accepted && ['occupy_cabinet', 'release_cabinet', 'cabinet_timeout'].includes(ev.event_type)) {
        const after = state.rooms[ev.room_id]?.machines?.[ev.payload?.machineId]?.occupiedBy ?? null;
        transitions.push({ tick: ev.logical_tick, room: ev.room_id, machine: ev.payload?.machineId, type: ev.event_type, by: ev.actor_id, before, after });
      }
    }
    return transitions;
  }

  /** Build the full structured report. Does NOT mutate node state. */
  report() {
    const canonical = foldLog(this.canonicalLog, this.ctx);
    const canonicalFp = canonical.fingerprint;          // canonical world-STATE hash
    const canonicalSet = this.canonicalLog.setFingerprint(); // canonical event-SET hash

    const perAgentView = {};
    let allConverged = true;
    for (const node of this.nodes()) {
      const setFp = node.knownSetFingerprint();
      const converged = node.subscriptions ? null : setFp === canonicalSet;
      if (converged === false) allConverged = false;
      perAgentView[node.id] = { role: node.role, online: node.online, eventCount: node.known.size, converged, partial: !!node.subscriptions };
    }

    const observedDesync = this.desyncObservations.some((o) => o.diverged.length > 0);

    return {
      seed: this.seed,
      ticks: this.tick,
      agents: [...this.agents.keys()],
      rooms: [...this.rooms.keys()],
      fabricSize: this.canonicalLog.size,
      finalWorldState: canonical.state,
      canonicalFingerprint: canonicalFp,
      perAgentView,
      eventLog: this.canonicalLog.ordered().map(summarizeEvent),
      rejectedEvents: [...this.ingestRejections, ...canonical.rejections],
      ingestRejectionCount: this.ingestRejections.length,
      applyRejectionCount: canonical.rejections.length,
      desyncReport: { observedDesync, observations: this.desyncObservations, finalConverged: allConverged },
      authorityReport: { ...this.authorityReport, occupancyTransitions: this._auditOccupancy() },
      sidebandTraffic: this.sidebandTraffic,
      pendingUndelivered: this.pending.length,
    };
  }
}

export { stateFingerprint };
