/**
 * ArcadeRoom — Neon Circuit Room Authority (Durable Object)
 *
 * Authority for the "main" room:
 * - Phase 1b: authoritative cabinet occupancy (one occupant, monotonic rev,
 *   stale-lock timeout) surviving hibernation via the WebSocket Hibernation API.
 * - Phase 1e: server-authoritative Pulse Tap tickets + rounds, delegated to the
 *   pure ./round-authority.mjs state machine. Occupancy authority is unchanged.
 *
 * Scope + non-goals: docs/NEON_CIRCUIT_PHASE1E_SERVER_TICKETS.md
 * (internal session/room-scoped points only; no external economy).
 */

import {
  createTicketState,
  ensureTicketState,
  startRound,
  submitRound,
  expirePlayerRounds,
  getBalance,
  pruneExpired,
} from "./round-authority.mjs";

export interface MachineState {
  machineId: string;      // "pulse"
  occupiedBy: string | null;
  occupiedSince: number | null;
  rev: number;
}

export interface TicketState {
  balances: Record<string, number>;
  rounds: Record<string, any>;
  submitted: Record<string, boolean>;
  lastPublic: any;
}

export interface RoomState {
  roomId: string;
  machines: Record<string, MachineState>;
  lastActivity: number;
  ticketState: TicketState;
}

const MACHINE_ID = "pulse";
const ROOM_ID = "main";
const STALE_LOCK_MS = 45_000; // 45 seconds without heartbeat from occupant = stale

export class ArcadeRoom implements DurableObject {
  private roomState: RoomState;
  private sockets: Map<WebSocket, { playerId: string; lastHeartbeat: number }>;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env
  ) {
    this.sockets = new Map();
    // State is loaded lazily on first access (see ensureInitialized).
    // We still restore hibernated sockets here because getWebSockets() is synchronous.
    const hibernatedSockets = this.ctx.getWebSockets();
    for (const ws of hibernatedSockets) {
      const attachment = ws.deserializeAttachment() as { playerId: string } | null;
      if (attachment?.playerId) {
        this.sockets.set(ws, {
          playerId: attachment.playerId,
          lastHeartbeat: Date.now(),
        });
      }
    }
  }

  private createInitialState(): RoomState {
    return {
      roomId: ROOM_ID,
      machines: {
        [MACHINE_ID]: {
          machineId: MACHINE_ID,
          occupiedBy: null,
          occupiedSince: null,
          rev: 0,
        },
      },
      lastActivity: Date.now(),
      ticketState: createTicketState(),
    };
  }

  private async persistState(): Promise<void> {
    this.roomState.lastActivity = Date.now();
    await this.ctx.storage.put("roomState", this.roomState);
  }

  private scheduleStaleLockAlarm(): void {
    // Alarm is ONLY for cleaning up stale machine locks.
    // Healthy clients stay connected via hibernation — we do NOT close sockets here.
    const nextAlarm = Date.now() + 30_000; // check every 30s
    this.ctx.storage.setAlarm(nextAlarm);
  }

  /**
   * Lazy initialization. Must be awaited before touching this.roomState.
   * Uses blockConcurrencyWhile so concurrent requests don't race on first load.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.roomState) {
      return;
    }

    await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<RoomState>("roomState");
      if (stored) {
        this.roomState = stored;
      } else {
        this.roomState = this.createInitialState();
        await this.ctx.storage.put("roomState", this.roomState);
      }

      // Migration-safe: older stored rooms predate tickets.
      this.roomState.ticketState = ensureTicketState(this.roomState.ticketState);
    });

    // Schedule the stale lock cleanup alarm the first time we initialize
    this.scheduleStaleLockAlarm();
  }

  // ==================== WebSocket Hibernation API ====================

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();

    const url = new URL(request.url);

    if (url.pathname === "/arcade/ws") {
      // Upgrade to WebSocket using the Hibernation API
      const pair = new WebSocketPair();
      const server = pair[1];

      this.ctx.acceptWebSocket(server, ["room:main"]);

      return new Response(null, {
        status: 101,
        webSocket: pair[0],
      });
    }

    return new Response("Not found", { status: 404 });
  }

  // Called when a message arrives on a hibernated or active socket
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.ensureInitialized();

    let data: any;
    try {
      data = typeof message === "string" ? JSON.parse(message) : message;
    } catch {
      this.sendError(ws, "bad_json", "Invalid JSON");
      return;
    }

    const meta = this.sockets.get(ws);
    const playerId = meta?.playerId ?? (data.playerId as string | undefined);

    switch (data.t) {
      case "join_room": {
        await this.handleJoin(ws, data.roomId, playerId);
        break;
      }
      case "occupy_machine": {
        await this.handleOccupy(ws, data.machineId, data.rev, playerId);
        break;
      }
      case "release_machine": {
        await this.handleRelease(ws, data.machineId, data.rev, playerId);
        break;
      }
      case "heartbeat": {
        await this.handleHeartbeat(ws, playerId);
        break;
      }
      case "pulse_round_start": {
        await this.handlePulseRoundStart(ws, data);
        break;
      }
      case "pulse_round_submit": {
        await this.handlePulseRoundSubmit(ws, data);
        break;
      }
      case "ticket_balance_request": {
        await this.handleTicketBalanceRequest(ws);
        break;
      }
      default: {
        this.sendError(ws, "unknown_type", `Unknown message type: ${data.t}`);
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    await this.ensureInitialized();

    const meta = this.sockets.get(ws);
    if (!meta) return;

    const { playerId } = meta;
    this.sockets.delete(ws);

    // If this player owned the machine, release it (authoritative disconnect cleanup)
    const machine = this.roomState.machines[MACHINE_ID];
    if (machine.occupiedBy === playerId) {
      await this.releaseMachineInternal(playerId, "disconnect");
    }

    // Disconnect always invalidates the player's active round (idempotent).
    this.roomState.ticketState = expirePlayerRounds(this.roomState.ticketState, playerId);

    // Broadcast updated state to remaining clients
    await this.broadcastRoomState();
    await this.persistState();
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    await this.ensureInitialized();
    // Treat errors the same as close for safety
    await this.webSocketClose(ws, 1011, "error", false);
  }

  // ==================== Message Handlers ====================

  private async handleJoin(ws: WebSocket, roomId: string, playerId?: string): Promise<void> {
    if (roomId !== ROOM_ID) {
      this.sendError(ws, "invalid_room", "Only 'main' room supported in Phase 1b");
      return;
    }

    if (!playerId || typeof playerId !== "string") {
      this.sendError(ws, "missing_player", "playerId is required");
      return;
    }

    // Attach player metadata to the socket so it survives hibernation
    ws.serializeAttachment({ playerId });

    this.sockets.set(ws, {
      playerId,
      lastHeartbeat: Date.now(),
    });

    // Send current authoritative state
    this.send(ws, {
      t: "room_state",
      roomId: ROOM_ID,
      machines: this.roomState.machines,
      rev: this.roomState.machines[MACHINE_ID].rev,
    });

    // Reconnect support: hand the joiner its authoritative ticket balance + public cabinet state.
    this.send(ws, { t: "ticket_balance", playerId, balance: getBalance(this.roomState.ticketState, playerId) });
    this.sendTicketState(ws);
  }

  private async handleOccupy(
    ws: WebSocket,
    machineId: string,
    clientRev: number | undefined,
    playerId?: string
  ): Promise<void> {
    if (machineId !== MACHINE_ID) {
      this.send(ws, { t: "occupy_denied", machineId, reason: "invalid" });
      return;
    }

    const machine = this.roomState.machines[MACHINE_ID];
    const meta = this.sockets.get(ws);
    const actualPlayerId = playerId ?? meta?.playerId;

    if (!actualPlayerId) {
      this.sendError(ws, "no_identity", "Must join with playerId first");
      return;
    }

    // Optimistic concurrency check
    if (clientRev !== undefined && clientRev !== machine.rev) {
      this.send(ws, {
        t: "occupy_denied",
        machineId,
        reason: "stale_rev",
        currentRev: machine.rev,
      });
      return;
    }

    if (machine.occupiedBy !== null) {
      this.send(ws, { t: "occupy_denied", machineId, reason: "busy" });
      return;
    }

    // Authoritative transition
    machine.occupiedBy = actualPlayerId;
    machine.occupiedSince = Date.now();
    machine.rev += 1;

    await this.persistState();
    await this.broadcastRoomState();

    // Confirm to the occupant
    this.send(ws, {
      t: "machine_occupied",
      machineId,
      playerId: actualPlayerId,
      occupiedSince: machine.occupiedSince,
      rev: machine.rev,
    });
  }

  private async handleRelease(
    ws: WebSocket,
    machineId: string,
    clientRev: number | undefined,
    playerId?: string
  ): Promise<void> {
    if (machineId !== MACHINE_ID) {
      return;
    }

    const machine = this.roomState.machines[MACHINE_ID];
    const meta = this.sockets.get(ws);
    const actualPlayerId = playerId ?? meta?.playerId;

    if (!actualPlayerId || machine.occupiedBy !== actualPlayerId) {
      // Non-owner (or no occupant) attempting release — ignore or error
      this.sendError(ws, "not_owner", "Only current occupant can release");
      return;
    }

    if (clientRev !== undefined && clientRev !== machine.rev) {
      this.send(ws, {
        t: "occupy_denied",
        machineId,
        reason: "stale_rev",
        currentRev: machine.rev,
      });
      return;
    }

    await this.releaseMachineInternal(actualPlayerId, "explicit");
  }

  private async handleHeartbeat(ws: WebSocket, playerId?: string): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) return;

    meta.lastHeartbeat = Date.now();

    // Touch activity so we don't over-alarm
    await this.persistState();
  }

  // ==================== Ticket / Round Authority (Phase 1e) ====================

  private currentOccupant(): string | null {
    return this.roomState.machines[MACHINE_ID].occupiedBy;
  }

  private async handlePulseRoundStart(ws: WebSocket, data: any): Promise<void> {
    const meta = this.sockets.get(ws);
    const playerId = meta?.playerId;
    if (!playerId) {
      this.sendError(ws, "no_identity", "Must join with playerId first");
      return;
    }
    const machineId = data.machineId;
    const roundId = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const res = startRound(this.roomState.ticketState, {
      machineId,
      occupantId: this.currentOccupant(),
      playerId,
      roundId,
      now: Date.now(),
    });
    this.roomState.ticketState = res.state;
    if (!res.ok) {
      this.send(ws, { t: "pulse_round_rejected", machineId, reason: res.reason });
      return;
    }
    await this.persistState();
    this.send(ws, { t: "pulse_round_started", roomId: ROOM_ID, ...res.started });
  }

  private async handlePulseRoundSubmit(ws: WebSocket, data: any): Promise<void> {
    const meta = this.sockets.get(ws);
    const playerId = meta?.playerId;
    if (!playerId) {
      this.sendError(ws, "no_identity", "Must join with playerId first");
      return;
    }
    // senderId is the SOCKET's identity, never a client-supplied field.
    const res = submitRound(this.roomState.ticketState, {
      payload: data,
      senderId: playerId,
      occupantId: this.currentOccupant(),
      now: Date.now(),
    });
    this.roomState.ticketState = res.state;
    if (!res.ok) {
      this.send(ws, { t: "pulse_round_rejected", roundId: data.roundId, machineId: data.machineId, reason: res.reason });
      return;
    }
    await this.persistState();
    // Private to the owner: round accepted + authoritative balance.
    this.send(ws, {
      t: "pulse_round_accepted",
      roundId: data.roundId,
      machineId: data.machineId,
      awarded: res.awarded,
      balance: res.balance,
      grade: data.grade,
      score: data.score,
    });
    this.send(ws, { t: "ticket_balance", playerId, balance: res.balance });
    // Public broadcast: who won how many (no private balance) + cabinet/last-score state.
    this.broadcast({ t: "ticket_awarded", roomId: ROOM_ID, ...res.publicAward });
    this.broadcastTicketState();
  }

  private async handleTicketBalanceRequest(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    const playerId = meta?.playerId;
    if (!playerId) {
      this.sendError(ws, "no_identity", "Must join with playerId first");
      return;
    }
    this.send(ws, { t: "ticket_balance", playerId, balance: getBalance(this.roomState.ticketState, playerId) });
  }

  private ticketStatePayload(): Record<string, unknown> {
    const machine = this.roomState.machines[MACHINE_ID];
    const lp = this.roomState.ticketState.lastPublic;
    return {
      t: "ticket_state",
      roomId: ROOM_ID,
      machineId: MACHINE_ID,
      occupied: machine.occupiedBy !== null,
      occupiedBy: machine.occupiedBy,
      lastScore: lp ? lp.score : null,
      lastGrade: lp ? lp.grade : null,
      lastAwardBy: lp ? lp.playerId : null,
      lastAwardAmount: lp ? lp.awarded : null,
    };
  }

  private sendTicketState(ws: WebSocket): void {
    this.send(ws, this.ticketStatePayload());
  }

  private broadcastTicketState(): void {
    this.broadcast(this.ticketStatePayload());
  }

  private broadcast(payload: unknown): void {
    for (const ws of this.sockets.keys()) {
      this.send(ws, payload);
    }
  }

  // ==================== Internal Authority Logic ====================

  private async releaseMachineInternal(requester: string, reason: string): Promise<void> {
    const machine = this.roomState.machines[MACHINE_ID];

    if (machine.occupiedBy !== requester) {
      return; // safety
    }

    machine.occupiedBy = null;
    machine.occupiedSince = null;
    machine.rev += 1;

    // Releasing the cabinet invalidates any active round the holder had open.
    this.roomState.ticketState = expirePlayerRounds(this.roomState.ticketState, requester);

    await this.persistState();
    await this.broadcastRoomState();
    this.broadcastTicketState();
  }

  private async broadcastRoomState(): Promise<void> {
    const payload = {
      t: "room_state",
      roomId: ROOM_ID,
      machines: this.roomState.machines,
      rev: this.roomState.machines[MACHINE_ID].rev,
    };

    for (const ws of this.sockets.keys()) {
      this.send(ws, payload);
    }
  }

  private send(ws: WebSocket, payload: unknown): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // Socket may be closing — ignore
    }
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, { t: "error", code, message });
  }

  // ==================== Alarm — Stale Lock Cleanup Only ====================

  async alarm(): Promise<void> {
    await this.ensureInitialized();

    const machine = this.roomState.machines[MACHINE_ID];
    const now = Date.now();

    if (machine.occupiedBy) {
      // Find the occupant’s last heartbeat
      let occupantLastSeen = 0;
      for (const meta of this.sockets.values()) {
        if (meta.playerId === machine.occupiedBy) {
          occupantLastSeen = meta.lastHeartbeat;
          break;
        }
      }

      // If the occupant has no recent heartbeat (or no active socket), release
      if (occupantLastSeen === 0 || now - occupantLastSeen > STALE_LOCK_MS) {
        const staleOccupant = machine.occupiedBy;
        machine.occupiedBy = null;
        machine.occupiedSince = null;
        machine.rev += 1;

        // Stale-lock release also invalidates that occupant's active round.
        if (staleOccupant) this.roomState.ticketState = expirePlayerRounds(this.roomState.ticketState, staleOccupant);

        await this.persistState();

        // Only broadcast if there are still active sockets
        if (this.sockets.size > 0) {
          await this.broadcastRoomState();
          this.broadcastTicketState();
        }
      }
    }

    // Always prune fully-elapsed rounds so ticket state stays bounded.
    this.roomState.ticketState = pruneExpired(this.roomState.ticketState, now);
    await this.persistState();

    // Always reschedule the cleanup alarm (never close healthy sockets)
    this.scheduleStaleLockAlarm();
  }
}

// Type for wrangler
interface Env {
  ARCADE_ROOM: DurableObjectNamespace;
}
