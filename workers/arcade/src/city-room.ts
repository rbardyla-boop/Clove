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

interface CityEnv {
  CITY_ROOM: DurableObjectNamespace;
}

interface CityState {
  players: Record<string, any>;
  generation: number;
}

const STALE_SWEEP_MS = 30_000;
const SNAP_REQ_MIN_MS = 250; // floor between client-requested snapshots (anti-spam)

export class CityRoom implements DurableObject {
  private state!: CityState;
  private sockets: Map<WebSocket, { playerId: string; cityId: string; lastHeartbeat: number; lastSnapReqAt: number }>;
  private boundCityId: string = DEFAULT_CITY_ID;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: CityEnv
  ) {
    this.sockets = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as { playerId?: string; cityId?: string } | null;
      if (att?.playerId) {
        this.sockets.set(ws, { playerId: att.playerId, cityId: att.cityId || DEFAULT_CITY_ID, lastHeartbeat: Date.now(), lastSnapReqAt: 0 });
        if (att.cityId) this.boundCityId = att.cityId; // trusted: we serialized this attachment ourselves
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.state) return;
    await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<CityState>("cityState");
      this.state = stored && stored.players ? stored : createCityState();
    });
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("cityState", this.state);
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
      case "city_portal_enter": { this.handlePortal(ws, data); break; }
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

    ws.serializeAttachment({ playerId, cityId: this.boundCityId });
    this.sockets.set(ws, { playerId, cityId: this.boundCityId, lastHeartbeat: now, lastSnapReqAt: 0 });

    this.send(ws, { t: "city_welcome", ...welcomePayload(this.state, playerId, this.boundCityId, now) });
    this.broadcastExcept(ws, { t: "city_player_joined", id: playerId, x: res.player.x, y: res.player.y });
    this.broadcastSnapshot(now);
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

  private handlePortal(ws: WebSocket, data: any): void {
    const meta = this.sockets.get(ws);
    if (!meta) { this.send(ws, { t: "city_error", code: "no_identity", message: "Must city_join first" }); return; }
    const res = enterPortal(this.state, meta.playerId, data.portalId);
    if (!res.ok) { this.send(ws, { t: "city_error", code: `portal_${res.reason}`, message: "portal entry denied" }); return; }
    this.send(ws, { t: "city_portal_ok", portalId: data.portalId, target: res.target });
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
    if (this.hasSocketFor(meta.playerId)) return; // another tab still holds this player
    this.state = removePlayer(this.state, meta.playerId);
    const now = Date.now();
    this.broadcast({ t: "city_player_left", id: meta.playerId });
    this.broadcastSnapshot(now);
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
      this.broadcast({ t: "city_player_left", id });
      changed = true;
    }
    if (changed) this.broadcastSnapshot(now);
    await this.persist();
    if (this.sockets.size > 0 || Object.keys(this.state.players).length > 0) this.scheduleSweep();
  }
}
