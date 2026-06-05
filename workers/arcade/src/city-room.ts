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
import { evaluateStewardship, defaultBlockStyle, normalizeBlockStyle, stewardshipStatePayload, isStewardshipEligible } from "../../../arcade/city/city-stewardship.mjs";
import { createTrial, addTrialPlayer, removeTrialPlayer, stepTrial, closeTrial, isTrialActive, trialStatePayload } from "../../../arcade/city/city-battle-instance.mjs";
import { districtManifest, validateRouteRequest } from "../../../arcade/city/city-district.mjs";

interface CityEnv {
  CITY_ROOM: DurableObjectNamespace;
  // Phase 5C: city-block presence coordinator (DO-to-DO; this block reports its occupancy
  // and reads back the public-safe district presence map). Optional/fail-open.
  CITY_REGISTRY?: DurableObjectNamespace;
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
  lastStewReqAt: number;
  lastTrialReqAt: number;
  lastBlocksReqAt: number; // Phase 5A: district discovery anti-spam
  lastRouteReqAt: number;  // Phase 5A: route request anti-spam
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
  private stewardship: any = null;                      // Phase 4F: canonical block style (server-owned; persisted, hibernation-safe)
  private trial: any = null;                             // Phase 4G: active Block Trial instance (in-memory, ephemeral; never persisted)
  private sockets: Map<WebSocket, SocketMeta>;
  private boundCityId: string = DEFAULT_CITY_ID;
  private presenceCache: Record<string, any> = {}; // Phase 5C: last district presence map (DO-to-DO, fail-open)

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
        this.sockets.set(ws, { playerId: att.playerId, cityId: att.cityId || DEFAULT_CITY_ID, lastHeartbeat: Date.now(), lastSnapReqAt: 0, lastEvReqAt: 0, lastSchedReqAt: 0, lastRankReqAt: 0, lastStewReqAt: 0, lastTrialReqAt: 0, lastBlocksReqAt: 0, lastRouteReqAt: 0, interiorOpen: !!att.interiorOpen });
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
      // Phase 4F: canonical block style — normalized through the pure manifest so a stored
      // value can never carry anything outside the allowlist, and missing → city default.
      const storedSt = await this.ctx.storage.get<any>("cityStewardship");
      // Phase 5B: a cold block seeds its OWN per-block default identity (boundCityId is set
      // from the route before init — see fetch()); a stored style is normalized as before.
      this.stewardship = storedSt ? normalizeBlockStyle(storedSt) : defaultBlockStyle(this.boundCityId);
    });
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("cityState", this.state);
    await this.ctx.storage.put("cityEvents", this.eventLog);
    await this.ctx.storage.put("cityStewardship", this.stewardship);
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

  /**
   * Phase 5C: report THIS block's live occupancy to the city presence coordinator and refresh
   * the cached district presence map from the echoed response. DO-to-DO only; FAIL-OPEN — if the
   * registry is unbound or unreachable, the district manifest simply falls back to static
   * (population 0 / unknown). Reports only a COUNT — never player ids or any private data.
   */
  private async reportPresence(): Promise<void> {
    const ns = this.env.CITY_REGISTRY;
    if (!ns) return;
    try {
      const stub = ns.get(ns.idFromName("city-registry"));
      const res = await stub.fetch("https://city-reg/city-registry/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId: this.boundCityId, population: Object.keys(this.state.players).length }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (data && data.presence && typeof data.presence === "object") this.presenceCache = data.presence;
    } catch {
      /* fail-open: keep the last cache (or static) */
    }
  }

  // ==================== WebSocket transport ====================

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/arcade/city/ws") {
      // Bind the block from the route BEFORE init so a cold DO seeds the per-block default
      // style/labels (Phase 5B) rather than the downtown default.
      const hinted = resolveCityRoomId(url.searchParams.get("city"));
      if (hinted.ok) this.boundCityId = hinted.cityId;
      await this.ensureInitialized();
      const pair = new WebSocketPair();
      const server = pair[1];
      this.ctx.acceptWebSocket(server, ["city"]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    await this.ensureInitialized();
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
      case "city_stewardship_request": { await this.handleStewardshipRequest(ws, data); break; }
      case "city_block_trial_request": { await this.handleTrialRequest(ws); break; }
      case "city_block_trial_join_request": { await this.handleTrialJoin(ws); break; }
      case "city_block_trial_leave": { this.handleTrialLeave(ws); break; }
      case "city_block_trial_close_request": { await this.handleTrialClose(ws); break; }
      case "city_blocks_request": { await this.handleBlocksRequest(ws); break; }
      case "city_route_request": { this.handleRouteRequest(ws, data); break; }
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
    this.sockets.set(ws, { playerId, cityId: this.boundCityId, lastHeartbeat: now, lastSnapReqAt: 0, lastEvReqAt: 0, lastSchedReqAt: 0, lastRankReqAt: 0, lastStewReqAt: 0, lastTrialReqAt: 0, lastBlocksReqAt: 0, lastRouteReqAt: 0, interiorOpen: false });

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
    // Phase 4F: a (re)connect always sees the current canonical block style.
    this.send(ws, { t: "city_stewardship_state", ...stewardshipStatePayload(this.stewardship) });
    // Phase 4G: a (re)connect to a warm DO sees an in-progress Block Trial, if any.
    if (this.trial) this.send(ws, { t: "city_block_trial_state", ...trialStatePayload(this.trial) });
    // Phase 5A/5C: a (re)connect always sees the public-safe district manifest for discovery,
    // enriched with live per-block presence (refresh first so this join counts).
    await this.reportPresence();
    this.send(ws, { t: "city_blocks", ...districtManifest(this.boundCityId, this.presenceCache) });
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
    if (res.accepted) {
      this.broadcastSnapshot(now);
      // Phase 4G: a member's accepted move may stabilize a signal node — step the trial.
      if (this.tickTrial()) await this.persist();
    }
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

  // ==================== Phase 5A: multi-block district (discovery + bounded routing) ====================

  /**
   * Public-safe district manifest (discovery) enriched with live per-block presence. Refreshes
   * the presence cache from the coordinator first (fail-open) so a client polling for blocks sees
   * other blocks' current population. Touches no block state.
   */
  private async handleBlocksRequest(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    const now = Date.now();
    if (now - meta.lastBlocksReqAt < SNAP_REQ_MIN_MS) return; // anti-spam
    meta.lastBlocksReqAt = now;
    await this.reportPresence();
    this.send(ws, { t: "city_blocks", ...districtManifest(this.boundCityId, this.presenceCache) });
  }

  /**
   * Server-validated route request. The SOURCE block is server-owned (this.boundCityId,
   * fixed by the route URL); the target is untrusted and must be a KNOWN block ADJACENT to
   * the source (bounded — no arbitrary teleport). This is a CONFIRMATION only: it mutates
   * NO block state. The client reconnects to the target block's CityRoom, which then
   * authoritatively admits the player — so a client can never forge cross-block membership.
   */
  private handleRouteRequest(ws: WebSocket, data: any): void {
    const meta = this.sockets.get(ws);
    if (!meta) { this.send(ws, { t: "city_error", code: "no_identity", message: "Must city_join first" }); return; }
    const now = Date.now();
    if (now - meta.lastRouteReqAt < SNAP_REQ_MIN_MS) return; // anti-spam
    meta.lastRouteReqAt = now;
    const res = validateRouteRequest(this.boundCityId, data?.target_city_id);
    if (!res.ok) { this.send(ws, { t: "city_route_result", ok: false, reason: res.reason, public_safe: true }); return; }
    this.send(ws, { t: "city_route_result", ok: true, from_city_id: this.boundCityId, target_city_id: res.target_city_id, ws_hint: res.ws_hint, public_safe: true });
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
    // Phase 4G: a leaver also leaves any active trial (the instance is non-destructive).
    if (this.trial && this.trial.players && this.trial.players[meta.playerId]) {
      this.trial = removeTrialPlayer(this.trial, meta.playerId);
      this.broadcast({ t: "city_block_trial_state", ...trialStatePayload(this.trial) });
    }
    this.evaluateScheduler();
    this.ctx.waitUntil(this.reportPresence()); // Phase 5C: occupancy dropped — report it (fail-open)
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
    this.tickTrial();         // Phase 4G: time-based trial completion when idle (no movement)
    this.ctx.waitUntil(this.reportPresence()); // Phase 5C: keepalive — keep this block's presence fresh
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

  // ==================== Phase 4F: Block Stewardship (constrained, reversible, non-cash) ====================

  /**
   * Client request → server-validated, manifest-constrained visual edit. The client sends
   * INTENT only (action/target/style); the pure module checks CURRENT Host Rank eligibility
   * + the closed allowlist and decides the outcome. preview never persists; apply/reset
   * persist the canonical style and broadcast it. The client can never mutate canonical
   * style directly, and no css/html/js/url/text field can survive the sanitizer. Touches no
   * player/collision/portal/ticket/inventory/economy state. Rate-limited per socket.
   */
  private async handleStewardshipRequest(ws: WebSocket, data: any): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.send(ws, { t: "city_error", code: "no_identity", message: "Must city_join first" }); return; }
    const now = Date.now();
    if (now - meta.lastStewReqAt < SNAP_REQ_MIN_MS) return; // anti-spam: clients can't flood stewardship evals
    meta.lastStewReqAt = now;

    const request = { request_id: data.request_id, action: data.action, target: data.target, style: data.style };
    const res = evaluateStewardship({ cityId: this.boundCityId, now, hostRank: this.hostRank?.host_rank, currentStewardship: this.stewardship, request });

    if (!res.ok) {
      this.emit("city_stewardship_rejected", meta.playerId, { target: typeof data.target === "string" ? data.target : undefined, reason: res.reason });
      this.send(ws, { t: "city_stewardship_result", ok: false, action: res.action, reason: res.reason, public_safe: true });
      await this.persist(); // the rejected event was appended to the log
      return;
    }

    if (res.action === "preview") {
      // preview NEVER changes canonical state — only the requester gets the sanitized preview.
      this.emit("city_stewardship_previewed", meta.playerId, { target: res.target, palette: res.preview_style[res.target!]?.palette });
      this.send(ws, { t: "city_stewardship_result", ok: true, action: "preview", target: res.target, preview_style: res.preview_style, reason: res.reason, public_safe: true });
      await this.persist(); // the preview event was appended to the log
      return;
    }

    // apply / reset → the canonical block style changes; broadcast it to everyone.
    this.stewardship = normalizeBlockStyle(res.canonical_style);
    if (res.action === "reset") {
      this.emit("city_stewardship_reset", meta.playerId, {});
    } else {
      const t = res.target!;
      const st = this.stewardship[t] || {};
      this.emit("city_stewardship_applied", meta.playerId, { target: t, palette: st.palette, sign_variant: st.sign_variant, intensity: st.intensity });
    }
    this.broadcast({ t: "city_stewardship_state", ...stewardshipStatePayload(this.stewardship) });
    this.send(ws, { t: "city_stewardship_result", ok: true, action: res.action, target: res.target, reason: res.reason, public_safe: true });
    await this.persist();
  }

  // ==================== Phase 4G: Instanced, non-destructive Block Trial ====================

  private broadcastTrial(): void {
    this.broadcast({ t: "city_block_trial_state", ...trialStatePayload(this.trial) });
  }

  /**
   * Advance the active trial from the SERVER-authoritative positions of its members (players
   * move via the existing city_input authority — the trial never owns movement). Emits an
   * updated/completed event + broadcasts ONLY on a node-latch/status change (bounded). Returns
   * whether anything changed (so the caller can persist the appended log entry). Never mutates
   * public city/stewardship state. Display-only.
   */
  private tickTrial(): boolean {
    if (!isTrialActive(this.trial)) return false;
    const now = Date.now();
    const positions: Record<string, { x: number; y: number }> = {};
    for (const pid of Object.keys(this.trial.players)) {
      const p = this.state.players[pid];
      if (p) positions[pid] = { x: p.x, y: p.y };
    }
    const r = stepTrial(this.trial, { now, positions });
    this.trial = r.state;
    if (!r.changed) return false;
    if (r.completed) {
      const o = this.trial.outcome || {};
      this.emit("city_block_trial_completed", null, { instance_id: this.trial.instance_id, objective: this.trial.objective, status: this.trial.status, score: this.trial.score, score_cap: this.trial.score_cap, node_count: o.node_count, stabilized_count: o.stabilized, duration_ms: o.duration_ms, reason: o.result });
    } else {
      this.emit("city_block_trial_updated", null, { instance_id: this.trial.instance_id, status: this.trial.status, score: this.trial.score, score_cap: this.trial.score_cap, stabilized_count: this.trial.score });
    }
    this.broadcastTrial();
    return true;
  }

  /** Client request → create + start ONE active Block Trial (gated on stewardship eligibility). */
  private async handleTrialRequest(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.send(ws, { t: "city_error", code: "no_identity", message: "Must city_join first" }); return; }
    const now = Date.now();
    if (now - meta.lastTrialReqAt < SNAP_REQ_MIN_MS) return; // anti-spam
    meta.lastTrialReqAt = now;

    if (isTrialActive(this.trial) && now < this.trial.ends_at) {
      this.emit("city_block_trial_rejected", meta.playerId, { reason: "trial_active" });
      this.send(ws, { t: "city_block_trial_result", ok: false, reason: "trial_active", public_safe: true });
      await this.persist();
      return;
    }
    // gated on CURRENT stewardship eligibility — Host Rank as one signal (it grants nothing itself)
    if (!isStewardshipEligible(this.hostRank?.host_rank)) {
      this.emit("city_block_trial_rejected", meta.playerId, { reason: "host_rank_too_low" });
      this.send(ws, { t: "city_block_trial_result", ok: false, reason: "host_rank_too_low", public_safe: true });
      await this.persist();
      return;
    }

    const instanceId = `trial-${this.boundCityId}-${now}`;
    let trial = createTrial({ cityId: this.boundCityId, instanceId, now, copiedStyle: this.stewardship }); // COPIES the style
    trial = addTrialPlayer(trial, meta.playerId, now); // the requester is the first member
    this.trial = trial;
    this.emit("city_block_trial_requested", meta.playerId, { instance_id: instanceId, objective: trial.objective });
    this.emit("city_block_trial_started", meta.playerId, { instance_id: instanceId, objective: trial.objective, status: trial.status, node_count: trial.signal_nodes.length, score_cap: trial.score_cap });
    this.broadcastTrial();
    this.send(ws, { t: "city_block_trial_result", ok: true, action: "request", instance_id: instanceId, public_safe: true });
    await this.persist();
  }

  /** Client request → join the active trial (open to any joined city player). */
  private async handleTrialJoin(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.send(ws, { t: "city_error", code: "no_identity", message: "Must city_join first" }); return; }
    const now = Date.now();
    if (now - meta.lastTrialReqAt < SNAP_REQ_MIN_MS) return; // anti-spam
    meta.lastTrialReqAt = now;
    if (!isTrialActive(this.trial)) { this.send(ws, { t: "city_block_trial_result", ok: false, reason: "no_active_trial", public_safe: true }); return; }
    if (!this.trial.players[meta.playerId]) {
      this.trial = addTrialPlayer(this.trial, meta.playerId, now);
      this.emit("city_block_trial_joined", meta.playerId, { instance_id: this.trial.instance_id });
      this.broadcastTrial();
      await this.persist();
    }
    this.send(ws, { t: "city_block_trial_result", ok: true, action: "join", instance_id: this.trial.instance_id, public_safe: true });
  }

  /** Client request → leave the trial (membership only; the instance continues). */
  private handleTrialLeave(ws: WebSocket): void {
    const meta = this.sockets.get(ws);
    if (!meta || !this.trial || !this.trial.players || !this.trial.players[meta.playerId]) return;
    this.trial = removeTrialPlayer(this.trial, meta.playerId);
    this.broadcastTrial();
  }

  /** Client request → close + DISCARD the trial. The public city/stewardship are untouched. */
  private async handleTrialClose(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta || !this.trial) return;
    if (isTrialActive(this.trial) && !this.trial.players[meta.playerId]) {
      this.send(ws, { t: "city_block_trial_result", ok: false, reason: "not_a_member", public_safe: true });
      return;
    }
    const now = Date.now();
    this.trial = closeTrial(this.trial, now);
    const o = this.trial.outcome || {};
    this.emit("city_block_trial_closed", meta.playerId, { instance_id: this.trial.instance_id, status: this.trial.status, score: this.trial.score, node_count: o.node_count, stabilized_count: o.stabilized, duration_ms: o.duration_ms, reason: o.result });
    this.broadcastTrial();
    this.send(ws, { t: "city_block_trial_result", ok: true, action: "close", instance_id: this.trial.instance_id, public_safe: true });
    await this.persist();
    this.trial = null; // discard the instance (public city + stewardship remain unchanged)
  }
}
