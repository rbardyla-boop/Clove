/**
 * CityRoom — Neon Circuit City Block Authority (Durable Object), Phase 4A.
 *
 * The city analogue of ArcadeRoom, but DELIBERATELY ISOLATED: a CityRoom instance
 * serves exactly one city block (the Worker routes /arcade/city/ws?city=<id> to
 * idFromName(cityId)), it owns ONLY ephemeral player position/membership, and it
 * NEVER talks to the RoomRegistry and NEVER touches arcade occupancy/ticket state.
 * So nothing here can change arcade behavior or authority.
 *
 * Authority model: clients send INPUT INTENT only (a unit direction vector + seq +
 * client ts). The server resolves every accepted position itself from its OWN last
 * canonical position, the SERVER clock dt, a max-speed clamp, and deterministic AABB
 * collision — all in the shared pure core. No message carries an absolute position.
 *
 * The pure authority lives in arcade/city/city-block.mjs (shared by this DO, the
 * Node city dev shim, the unit tests, and the browser), mirroring how round
 * authority lives in round-authority.mjs and arcade-room.ts is a thin wrapper.
 *
 * Scope + non-goals: docs/NEON_CIRCUIT_PHASE4_GTA80_CITY_BLOCK.md.
 */

import {
  DEFAULT_CITY_ID, resolveCityRoomId, getCity, isValidPlayerId,
  createCityState, addPlayer, applyInput, removePlayer, touchPlayer,
  stalePlayerIds, enterPortal, welcomePayload, citySnapshot,
} from "../../../arcade/city/city-block.mjs";
import { createEventLog, appendCityEvent, cityEventsPayload, recentEvents } from "../../../arcade/city/city-events.mjs";
import { evaluatePressure, pressureChanged, suggestionReasons, schedulerStatePayload, isBaselinePressure } from "../../../arcade/city/city-scheduler.mjs";
import { evaluateHostRank, hostRankChanged, hostRankTierChanged, isBaselineHostRank, hostRankStatePayload } from "../../../arcade/city/city-host-rank.mjs";

interface CityEnv {
  CITY_ROOM: DurableObjectNamespace;
}

interface CityState {
  players: Record<string, any>;
  generation: number;
}

interface SocketMeta {
  playerId: string;
  cityId: string;
  lastHeartbeat: number;
  lastSnapReqAt: number;
  lastEvReqAt: number;
  lastSchedReqAt: number;
  lastRankReqAt: number;
  interiorOpen: boolean;
}

const STALE_SWEEP_MS = 30_000;
const SNAP_REQ_MIN_MS = 250; // floor between client-requested snapshots/events (anti-spam)

export class CityRoom implements DurableObject {
  private state!: CityState;
  private eventLog!: { events: any[]; seq: number }; // Phase 4C: server-authored append-only world log
  private pressure: any = null;                       // Phase 4D: last Hive-Scheduler snapshot (in-memory; derived from the log)
  private hostRank: any = null;                        // Phase 4E: last Host Rank snapshot (in-memory; derived from the log + scheduler)
  private rankChangedLast = false;                     // did the last host-rank eval broadcast a change (for join-send dedup)
  private sockets: Map<WebSocket, SocketMeta>;
  private boundCityId: string = DEFAULT_CITY_ID;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: CityEnv
  ) {
    this.sockets = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as { playerId?: string; cityId?: string; interiorOpen?: boolean } | null;
      if (att?.playerId) {
        // interiorOpen is rehydrated from the attachment so a DO hibernation/restart while
        // a player is inside the arcade still fires city_arcade_interior_closed on disconnect.
        this.sockets.set(ws, { playerId: att.playerId, cityId: att.cityId || DEFAULT_CITY_ID, lastHeartbeat: Date.now(), lastSnapReqAt: 0, lastEvReqAt: 0, lastSchedReqAt: 0, lastRankReqAt: 0, interiorOpen: !!att.interiorOpen });
        if (att.cityId) this.boundCityId = att.cityId; // trusted: we serialized this attachment ourselves
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.state) return;
    await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<CityState>("cityState");
      this.state = stored && stored.players ? stored : createCityState();
      const storedEv = await this.ctx.storage.get<{ events: any[]; seq: number }>("cityEvents");
      this.eventLog = storedEv && Array.isArray(storedEv.events) ? storedEv : createEventLog();
    });
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("cityState", this.state);
    await this.ctx.storage.put("cityEvents", this.eventLog);
  }

  /** Append a SERVER-AUTHORED public-safe world event + broadcast it live. */
  private emit(type: string, actorPublicId: string | null, payload: Record<string, unknown> = {}): void {
    const r = appendCityEvent(this.eventLog, { type, cityId: this.boundCityId, actorPublicId, payload, now: Date.now() });
    this.eventLog = r.log;
    this.broadcast({ t: "city_event", event: r.event });
  }

  private scheduleSweep(): void {
    this.ctx.storage.setAlarm(Date.now() + STALE_SWEEP_MS);
  }

  // ==================== WebSocket transport ====================

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    const url = new URL(request.url);
    if (url.pathname === "/arcade/city/ws") {
      const hinted = resolveCityRoomId(url.searchParams.get("city"));
      if (hinted.ok) this.boundCityId = hinted.cityId;
      const pair = new WebSocketPair();
      const server = pair[1];
      this.ctx.acceptWebSocket(server, ["city"]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureInitialized();
    let data: any;
    try {
      data = typeof message === "string" ? JSON.parse(message) : message;
    } catch {
      this.send(ws, { t: "city_error", code: "bad_json", message: "Invalid JSON" });
      return;
    }

    switch (data.t) {
      case "city_join": { await this.handleJoin(ws, data); break; }
      case "city_input": { await this.handleInput(ws, data); break; }
      case "city_snapshot_request": { this.handleSnapshotRequest(ws); break; }
      case "city_events_request": { this.handleEventsRequest(ws); break; }
      case "city_scheduler_request": { await this.handleSchedulerRequest(ws); break; }
      case "city_host_rank_request": { await this.handleHostRankRequest(ws); break; }
      // accept the 4C name + the 4B name (alias) so old clients keep working
      case "city_portal_enter":
      case "city_portal_enter_request": { await this.handlePortal(ws, data); break; }
      case "city_portal_close_request": { await this.handlePortalClose(ws); break; }
      case "city_leave": { await this.handleLeave(ws); break; }
      case "heartbeat": { this.handleHeartbeat(ws); break; }
      default: { this.send(ws, { t: "city_error", code: "unknown_type", message: `Unknown message type: ${data.t}` }); }
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.ensureInitialized();
    await this.dropSocket(ws);
  }
  async webSocketError(ws: WebSocket): Promise<void> {
    await this.ensureInitialized();
    await this.dropSocket(ws);
  }

  // ==================== handlers ====================

  private async handleJoin(ws: WebSocket, data: any): Promise<void> {
    const playerId = data.playerId;
    if (!isValidPlayerId(playerId)) {
      this.send(ws, { t: "city_error", code: "no_identity", message: "a valid playerId is required" });
      return;
    }
    // The block is fixed by the route (idFromName(cityId)); the join payload's cityId
    // is NOT trusted to re-bind this instance.
    const now = Date.now();
    const capacity = getCity(this.boundCityId)?.capacity;

    const res = addPlayer(this.state, playerId, { now, capacity });
    if (!res.ok) { this.send(ws, { t: "city_error", code: res.reason, message: "join rejected" }); return; }
    this.state = res.state;

    ws.serializeAttachment({ playerId, cityId: this.boundCityId, interiorOpen: false });
    this.sockets.set(ws, { playerId, cityId: this.boundCityId, lastHeartbeat: now, lastSnapReqAt: 0, lastEvReqAt: 0, lastSchedReqAt: 0, lastRankReqAt: 0, interiorOpen: false });

    this.send(ws, { t: "city_welcome", ...welcomePayload(this.state, playerId, this.boundCityId, now) });
    this.send(ws, { t: "city_events", ...cityEventsPayload(this.eventLog) }); // recent history on (re)join
    this.broadcastExcept(ws, { t: "city_player_joined", id: playerId, x: res.player.x, y: res.player.y }); // legacy 4B message
    this.emit("city_player_joined", playerId, {}); // canonical append-only event
    this.broadcastSnapshot(now);
    // Phase 4D: refresh pressure. If the eval changed pressure it already broadcast
    // city_scheduler_state to everyone (incl. this socket); only send explicitly when it
    // did NOT, so a (re)connect always sees current pressure exactly once.
    if (!this.evaluateScheduler()) this.send(ws, { t: "city_scheduler_state", ...schedulerStatePayload(this.pressure) });
    // Phase 4E: evaluateScheduler() also ran the host-rank eval; send host-rank state to
    // the joiner exactly once (only when the eval did not already broadcast a change).
    if (!this.rankChangedLast) this.send(ws, { t: "city_host_rank_state", ...hostRankStatePayload(this.hostRank) });
    await this.persist();
    this.scheduleSweep();
  }

  private async handleInput(ws: WebSocket, data: any): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.send(ws, { t: "city_error", code: "no_identity", message: "Must city_join first" }); return; }
    const now = Date.now();
    const res = applyInput(this.state, meta.playerId, data, now);
    this.state = res.state;
    meta.lastHeartbeat = now;
    // Broadcast the canonical snapshot only when the server actually accepted a move.
    // Inputs are rate-limited per player in the pure core, so this cadence is bounded.
    if (res.accepted) this.broadcastSnapshot(now);
  }

  private handleSnapshotRequest(ws: WebSocket): void {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    const now = Date.now();
    if (now - meta.lastSnapReqAt < SNAP_REQ_MIN_MS) return; // anti-spam: ignore rapid re-requests
    meta.lastSnapReqAt = now;
    this.send(ws, { t: "city_snapshot", cityId: this.boundCityId, ...citySnapshot(this.state, now) });
  }

  private handleEventsRequest(ws: WebSocket): void {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    const now = Date.now();
    if (now - meta.lastEvReqAt < SNAP_REQ_MIN_MS) return; // anti-spam
    meta.lastEvReqAt = now;
    this.send(ws, { t: "city_events", ...cityEventsPayload(this.eventLog) });
  }

  /**
   * Server-gated portal entry. The request, and its accept/reject, and the interior
   * open are all recorded as SERVER-AUTHORED events. The client cannot open the
   * interior without a server `city_portal_ok` (which requires being in the zone).
   */
  private async handlePortal(ws: WebSocket, data: any): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.send(ws, { t: "city_error", code: "no_identity", message: "Must city_join first" }); return; }
    const portalId = data.portalId;
    this.emit("city_portal_enter_requested", meta.playerId, { portalId });
    const res = enterPortal(this.state, meta.playerId, portalId);
    if (!res.ok) {
      this.emit("city_portal_enter_rejected", meta.playerId, { portalId, reason: res.reason });
      this.send(ws, { t: "city_error", code: `portal_${res.reason}`, message: "portal entry denied" });
      this.evaluateScheduler();
      await this.persist();
      return;
    }
    this.emit("city_portal_enter_accepted", meta.playerId, { portalId, target: res.target });
    if (!meta.interiorOpen) {
      meta.interiorOpen = true;
      ws.serializeAttachment({ playerId: meta.playerId, cityId: meta.cityId, interiorOpen: true }); // survive hibernation
      this.emit("city_arcade_interior_opened", meta.playerId, { portalId });
    }
    this.send(ws, { t: "city_portal_ok", portalId, target: res.target });
    this.evaluateScheduler();
    await this.persist();
  }

  private async handlePortalClose(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta || !meta.interiorOpen) return; // only a genuinely-open interior closes
    meta.interiorOpen = false;
    ws.serializeAttachment({ playerId: meta.playerId, cityId: meta.cityId, interiorOpen: false });
    this.emit("city_arcade_interior_closed", meta.playerId, {});
    this.evaluateScheduler();
    await this.persist();
  }

  private handleHeartbeat(ws: WebSocket): void {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    const now = Date.now();
    meta.lastHeartbeat = now;
    this.state = touchPlayer(this.state, meta.playerId, now);
  }

  private async handleLeave(ws: WebSocket): Promise<void> {
    await this.dropSocket(ws, true);
  }

  // ==================== internal ====================

  /** Remove the socket and, if it was the player's last connection, the player. */
  private async dropSocket(ws: WebSocket, announceLeft = false): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    this.sockets.delete(ws);
    if (announceLeft) { try { ws.close(1000, "left"); } catch { /* already closing */ } }
    // a socket that had the arcade interior open closes it (also covers disconnect-while-open)
    if (meta.interiorOpen) { meta.interiorOpen = false; this.emit("city_arcade_interior_closed", meta.playerId, {}); }
    if (this.hasSocketFor(meta.playerId)) { await this.persist(); return; } // another tab still holds this player
    this.state = removePlayer(this.state, meta.playerId);
    const now = Date.now();
    this.broadcast({ t: "city_player_left", id: meta.playerId }); // legacy 4B message
    this.emit("city_player_left", meta.playerId, {});             // canonical append-only event (once)
    this.broadcastSnapshot(now);
    this.evaluateScheduler();
    await this.persist();
  }

  private hasSocketFor(playerId: string): boolean {
    for (const m of this.sockets.values()) if (m.playerId === playerId) return true;
    return false;
  }

  private broadcastSnapshot(now: number): void {
    this.broadcast({ t: "city_snapshot", cityId: this.boundCityId, ...citySnapshot(this.state, now) });
  }

  private broadcast(payload: unknown): void {
    for (const ws of this.sockets.keys()) this.send(ws, payload);
  }
  private broadcastExcept(except: WebSocket, payload: unknown): void {
    for (const ws of this.sockets.keys()) if (ws !== except) this.send(ws, payload);
  }
  private send(ws: WebSocket, payload: unknown): void {
    try { ws.send(JSON.stringify(payload)); } catch { /* socket closing */ }
  }

  // ==================== alarm — stale player eviction ====================

  async alarm(): Promise<void> {
    await this.ensureInitialized();
    const now = Date.now();
    const stale = stalePlayerIds(this.state, now);
    let changed = false;
    for (const id of stale) {
      // Only evict players with no live socket (a heartbeating socket refreshes lastSeen).
      if (this.hasSocketFor(id)) continue;
      this.state = removePlayer(this.state, id);
      this.broadcast({ t: "city_player_left", id }); // legacy 4B message
      this.emit("city_player_left", id, {});         // canonical append-only event
      changed = true;
    }
    if (changed) this.broadcastSnapshot(now);
    this.evaluateScheduler(); // Phase 4D: periodic decay (activity ages out of the window)
    await this.persist();
    if (this.sockets.size > 0 || Object.keys(this.state.players).length > 0) this.scheduleSweep();
  }

  // ==================== Phase 4D: Hive Scheduler (subordinate, bounded) ====================

  /**
   * Re-evaluate non-authoritative city pressure from the recent SERVER-AUTHORED event
   * log + the server's own occupancy count. Emits a scheduler tick / new suggestions
   * ONLY when the pressure snapshot actually changes (dedup → bounded, no log spam),
   * and never moves a player, grants anything, or reads a client fact. Returns whether
   * the snapshot changed (so callers can decide to persist). Display-only.
   */
  private evaluateScheduler(): boolean {
    const now = Date.now();
    const occupancy = Object.keys(this.state.players).length;
    const snap = evaluatePressure({ cityId: this.boundCityId, now, recentEvents: recentEvents(this.eventLog), occupancy });
    const prev = this.pressure;
    // The first eval on a cold start at the idle baseline is not "news" — don't log a tick.
    const meaningful = pressureChanged(prev, snap) && !(!prev && isBaselinePressure(snap));
    if (meaningful) {
      this.emit("city_scheduler_tick", null, { pressure: snap.pressure.scheduler_mood, reason: "pressure_update" });
      const prevReasons = new Set(suggestionReasons(prev));
      for (const s of snap.suggestions) {
        if (!prevReasons.has(s.reason)) this.emit("city_pressure_suggested", null, { pressure: snap.pressure.scheduler_mood, reason: s.reason, severity: s.severity });
      }
      this.broadcast({ t: "city_scheduler_state", ...schedulerStatePayload(snap) });
    }
    this.pressure = snap; // always keep the latest snapshot (evaluated_at fresh)
    this.evaluateHostRank(); // Phase 4E: host rank always follows the scheduler review
    return meaningful;
  }

  /** Client request → bounded, rate-limited evaluation; returns current pressure to the requester. */
  private async handleSchedulerRequest(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    const now = Date.now();
    if (now - meta.lastSchedReqAt < SNAP_REQ_MIN_MS) return; // anti-spam: clients can't flood scheduler evals
    meta.lastSchedReqAt = now;
    const changed = this.evaluateScheduler();
    this.send(ws, { t: "city_scheduler_state", ...schedulerStatePayload(this.pressure) });
    // evaluateScheduler() also runs the host-rank eval, which may append host-rank events
    // even when pressure is unchanged — persist if EITHER produced new log entries.
    if (changed || this.rankChangedLast) await this.persist();
  }

  // ==================== Phase 4E: Host Rank (non-cash, subordinate, bounded) ====================

  /**
   * Re-derive the block's non-cash Host Rank from the recent SERVER-AUTHORED event log
   * + the scheduler-reviewed pressure snapshot. Emits city_host_rank_evaluated only when
   * the headline display changes (tier|support|reasons; cold-start idle guard) and
   * city_host_rank_changed when tier|support changes (dedup → bounded, no log spam), and
   * broadcasts city_host_rank_state on change. Grants nothing, moves no one, reads no
   * client fact. Sets rankChangedLast for the join-send dedup. Display-only.
   */
  private evaluateHostRank(): boolean {
    const now = Date.now();
    const snap = evaluateHostRank({ cityId: this.boundCityId, now, recentEvents: recentEvents(this.eventLog), schedulerState: this.pressure });
    const prev = this.hostRank;
    const meaningful = hostRankChanged(prev, snap) && !(!prev && isBaselineHostRank(snap));
    if (meaningful) {
      const hr = snap.host_rank;
      this.emit("city_host_rank_evaluated", null, { tier: hr.tier, support_signal: hr.support_signal, score: hr.score, score_cap: hr.score_cap, reason: hr.reasons[0] || "activity" });
      if (hostRankTierChanged(prev, snap)) this.emit("city_host_rank_changed", null, { tier: hr.tier, support_signal: hr.support_signal, score: hr.score, score_cap: hr.score_cap });
      this.broadcast({ t: "city_host_rank_state", ...hostRankStatePayload(snap) });
    }
    this.hostRank = snap;
    this.rankChangedLast = meaningful;
    return meaningful;
  }

  /** Client request → bounded, rate-limited host-rank re-eval; returns current rank to the requester. */
  private async handleHostRankRequest(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    const now = Date.now();
    if (now - meta.lastRankReqAt < SNAP_REQ_MIN_MS) return; // anti-spam: clients can't flood host-rank evals
    meta.lastRankReqAt = now;
    const changed = this.evaluateHostRank();
    this.send(ws, { t: "city_host_rank_state", ...hostRankStatePayload(this.hostRank) });
    if (changed) await this.persist();
  }
}
