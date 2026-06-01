/**
 * ArcadeRoom — Neon Circuit Room Authority (Durable Object)
 *
 * Phase 1b–1l: authoritative cabinet occupancy, server-authoritative rounds +
 * tickets, ledger, Prize Counter, Challenge Board, achievements, and a public
 * event feed — all delegated to the pure ./*.mjs state machines.
 *
 * Phase 2a (Multi-Room Arcade Lobby): the DO now hosts MULTIPLE rooms, each with a
 * fully ISOLATED state namespace (occupancy, tickets, ledger, inventory, equips,
 * challenges, feed). A socket is bound to exactly one room (via join). Every
 * authority operation + broadcast is scoped to that socket's room, so state never
 * leaks across rooms. There is no global account and no cross-room economy.
 *
 * Scope + non-goals: docs/NEON_CIRCUIT_PHASE2A_MULTI_ROOM_LOBBY.md.
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
import { cabinetCatalogPayload, prizeCatalogPayload, ticketedMachineIds, getCabinetByMachineId } from "./catalog.mjs";
import { redeemPrize, equipCosmetic, unequipCosmetic, getInventory, getEquips, publicCosmeticState } from "./prize-authority.mjs";
import { getLedger } from "./ledger.mjs";
import { challengeCatalogPayload, getProgress, recordRoundAccepted, recordRedemption, claimReward } from "./challenges.mjs";
import { getAchievements } from "./achievements.mjs";
import { appendEvent, eventFeedPayload } from "./events.mjs";
import { DEFAULT_ROOM_ID, resolveRoomId, isValidRoomId, roomListPayload, roomMetaPayload, hasCapacity, getRoom } from "./rooms.mjs";

export interface MachineState {
  machineId: string;
  occupiedBy: string | null;
  occupiedSince: number | null;
  rev: number;
}

/** One room's fully isolated state namespace. */
export interface RoomPartition {
  machines: Record<string, MachineState>;
  ticketState: any;
}

export interface ArcadeState {
  arcadeId: string;
  rooms: Record<string, RoomPartition>; // roomId -> isolated partition
  lastActivity: number;
}

const PULSE_MACHINE = "pulse"; // canonical machine used for back-compat room_state.rev / ticket_state
const STALE_LOCK_MS = 45_000;

export class ArcadeRoom implements DurableObject {
  private state!: ArcadeState;
  private sockets: Map<WebSocket, { playerId: string; lastHeartbeat: number; roomId: string }>;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env
  ) {
    this.sockets = new Map();
    const hibernatedSockets = this.ctx.getWebSockets();
    for (const ws of hibernatedSockets) {
      const attachment = ws.deserializeAttachment() as { playerId: string; roomId?: string } | null;
      if (attachment?.playerId) {
        this.sockets.set(ws, {
          playerId: attachment.playerId,
          lastHeartbeat: Date.now(),
          roomId: isValidRoomId(attachment.roomId) ? (attachment.roomId as string) : DEFAULT_ROOM_ID,
        });
      }
    }
  }

  // ==================== room partitions ====================

  private newPartition(): RoomPartition {
    const machines: Record<string, MachineState> = {};
    for (const machineId of ticketedMachineIds()) {
      machines[machineId] = { machineId, occupiedBy: null, occupiedSince: null, rev: 0 };
    }
    return { machines, ticketState: createTicketState() };
  }

  /** Get (lazily create + migrate) a room's isolated partition. */
  private room(roomId: string): RoomPartition {
    let part = this.state.rooms[roomId];
    if (!part) {
      part = this.newPartition();
      this.state.rooms[roomId] = part;
    }
    part.ticketState = ensureTicketState(part.ticketState);
    if (!part.machines) part.machines = {};
    for (const machineId of ticketedMachineIds()) {
      if (!part.machines[machineId]) part.machines[machineId] = { machineId, occupiedBy: null, occupiedSince: null, rev: 0 };
    }
    return part;
  }

  private socketRoom(ws: WebSocket): string {
    return this.sockets.get(ws)?.roomId ?? DEFAULT_ROOM_ID;
  }

  /** Live population per room (distinct player ids among connected sockets). */
  private populations(): Record<string, number> {
    const byRoom: Record<string, Set<string>> = {};
    for (const meta of this.sockets.values()) {
      (byRoom[meta.roomId] ||= new Set()).add(meta.playerId);
    }
    const out: Record<string, number> = {};
    for (const [roomId, set] of Object.entries(byRoom)) out[roomId] = set.size;
    return out;
  }
  private roomPopulation(roomId: string): number {
    return this.populations()[roomId] || 0;
  }

  private createInitialState(): ArcadeState {
    return { arcadeId: "neon-circuit", rooms: { [DEFAULT_ROOM_ID]: this.newPartition() }, lastActivity: Date.now() };
  }

  private async persistState(): Promise<void> {
    this.state.lastActivity = Date.now();
    await this.ctx.storage.put("arcadeState", this.state);
  }

  private scheduleStaleLockAlarm(): void {
    this.ctx.storage.setAlarm(Date.now() + 30_000);
  }

  private async ensureInitialized(): Promise<void> {
    if (this.state) return;
    await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<any>("arcadeState");
      const legacy = stored ? null : await this.ctx.storage.get<any>("roomState");
      if (stored && stored.rooms) {
        this.state = stored;
      } else if (legacy && legacy.machines) {
        // Migrate a pre-Phase-2a single-room store into the default room partition.
        this.state = { arcadeId: "neon-circuit", rooms: { [DEFAULT_ROOM_ID]: { machines: legacy.machines, ticketState: legacy.ticketState } }, lastActivity: Date.now() };
      } else {
        this.state = this.createInitialState();
      }
      for (const roomId of Object.keys(this.state.rooms)) this.room(roomId);
      await this.ctx.storage.put("arcadeState", this.state);
    });
    this.scheduleStaleLockAlarm();
  }

  // ==================== WebSocket Hibernation API ====================

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    const url = new URL(request.url);
    if (url.pathname === "/arcade/ws") {
      const pair = new WebSocketPair();
      const server = pair[1];
      this.ctx.acceptWebSocket(server, ["arcade"]);
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
      this.sendError(ws, "bad_json", "Invalid JSON");
      return;
    }

    switch (data.t) {
      // ── lobby ──────────────────────────────────────────────────────────────
      case "room_list_request": { this.send(ws, { t: "room_list", ...roomListPayload(this.populations()) }); break; }
      case "join_room": { await this.handleJoin(ws, data.roomId, data.playerId, false); break; }
      case "room_join_request": { await this.handleJoin(ws, data.roomId, data.playerId, true); break; }
      case "room_leave_request": { await this.handleLeave(ws); break; }
      case "room_state_request": { this.sendRoomState(ws); break; }
      // ── occupancy ────────────────────────────────────────────────────────────
      case "occupy_machine": { await this.handleOccupy(ws, data.machineId, data.rev); break; }
      case "release_machine": { await this.handleRelease(ws, data.machineId, data.rev); break; }
      case "heartbeat": { await this.handleHeartbeat(ws); break; }
      // ── rounds ───────────────────────────────────────────────────────────────
      case "pulse_round_start": { await this.handleRoundStart(ws, data, "pulse_round_started", "pulse_round_rejected"); break; }
      case "pulse_round_submit": { await this.handleRoundSubmit(ws, data, "pulse_round_accepted", "pulse_round_rejected"); break; }
      case "signal_sprint_round_start": { await this.handleRoundStart(ws, data, "signal_sprint_round_started", "signal_sprint_round_rejected"); break; }
      case "signal_sprint_round_submit": { await this.handleRoundSubmit(ws, data, "signal_sprint_round_accepted", "signal_sprint_round_rejected"); break; }
      case "neon_grid_round_start": { await this.handleRoundStart(ws, data, "neon_grid_round_started", "neon_grid_round_rejected"); break; }
      case "neon_grid_round_submit": { await this.handleRoundSubmit(ws, data, "neon_grid_round_accepted", "neon_grid_round_rejected"); break; }
      // ── tickets / catalogs / loop ────────────────────────────────────────────
      case "ticket_balance_request": { await this.handleTicketBalanceRequest(ws); break; }
      case "cabinet_catalog_request": { this.send(ws, { t: "cabinet_catalog", roomId: this.socketRoom(ws), ...cabinetCatalogPayload() }); break; }
      case "prize_catalog_request": { this.send(ws, { t: "prize_catalog", ...prizeCatalogPayload() }); break; }
      case "ticket_ledger_request": { await this.handleTicketLedger(ws); break; }
      case "inventory_request": { await this.handleInventoryRequest(ws); break; }
      case "prize_redeem": { await this.handlePrizeRedeem(ws, data); break; }
      case "cosmetic_equip": { await this.handleCosmeticEquip(ws, data); break; }
      case "cosmetic_unequip": { await this.handleCosmeticUnequip(ws, data); break; }
      case "challenge_catalog_request": { this.send(ws, { t: "challenge_catalog", ...challengeCatalogPayload() }); break; }
      case "challenge_progress_request": { this.handleChallengeProgressRequest(ws); break; }
      case "challenge_reward_claim": { await this.handleChallengeRewardClaim(ws, data); break; }
      case "achievement_state_request": { this.handleAchievementStateRequest(ws); break; }
      case "arcade_event_feed_request": { this.send(ws, { t: "arcade_event_feed", roomId: this.socketRoom(ws), ...eventFeedPayload(this.room(this.socketRoom(ws)).ticketState) }); break; }
      default: { this.sendError(ws, "unknown_type", `Unknown message type: ${data.t}`); }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    await this.ensureInitialized();
    const meta = this.sockets.get(ws);
    if (!meta) return;
    const { playerId, roomId } = meta;
    this.sockets.delete(ws);
    const part = this.room(roomId);
    for (const machineId of Object.keys(part.machines)) {
      if (part.machines[machineId].occupiedBy === playerId) {
        await this.releaseMachineInternal(roomId, playerId, machineId);
      }
    }
    part.ticketState = expirePlayerRounds(part.ticketState, playerId);
    await this.broadcastRoomState(roomId);
    this.broadcastPopulation(roomId);
    await this.persistState();
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    await this.ensureInitialized();
    await this.webSocketClose(ws, 1011, "error", false);
  }

  // ==================== Lobby handlers ====================

  private async handleJoin(ws: WebSocket, rawRoomId: any, playerId?: string, lobby = false): Promise<void> {
    if (!playerId || typeof playerId !== "string") {
      this.sendError(ws, "missing_player", "playerId is required");
      return;
    }
    const resolved = resolveRoomId(rawRoomId);
    if (!resolved.ok && rawRoomId != null && rawRoomId !== "") {
      // An explicit but invalid room id is rejected (rather than silently defaulted).
      this.send(ws, { t: "room_join_rejected", roomId: String(rawRoomId), reason: "invalid_room" });
      return;
    }
    const roomId = resolved.roomId;

    const prev = this.sockets.get(ws);
    // Switching rooms on an existing socket: cleanly leave the old room first.
    if (prev && prev.roomId !== roomId) {
      await this.leaveRoomInternal(ws, prev.playerId, prev.roomId);
    }

    // Capacity check (distinct players already in the target room, excluding self).
    const popExcludingSelf = this.distinctPlayersInRoom(roomId, playerId);
    if (!hasCapacity(roomId, popExcludingSelf)) {
      this.send(ws, { t: "room_join_rejected", roomId, reason: "room_full" });
      return;
    }

    ws.serializeAttachment({ playerId, roomId });
    this.sockets.set(ws, { playerId, lastHeartbeat: Date.now(), roomId });
    const part = this.room(roomId);

    if (lobby) this.send(ws, { t: "room_joined", room: roomMetaPayload(roomId, this.roomPopulation(roomId)) });

    this.send(ws, { t: "room_state", roomId, machines: part.machines, rev: part.machines[PULSE_MACHINE].rev });
    this.send(ws, { t: "ticket_balance", playerId, balance: getBalance(part.ticketState, playerId) });
    this.sendTicketState(ws, roomId);
    this.sendCosmeticState(ws, roomId);
    this.send(ws, { t: "challenge_progress", playerId, challenges: getProgress(part.ticketState, playerId) });
    this.send(ws, { t: "achievement_state", playerId, achievements: getAchievements(part.ticketState, playerId) });
    this.send(ws, { t: "arcade_event_feed", roomId, ...eventFeedPayload(part.ticketState) });
    this.broadcastPopulation(roomId);
    await this.persistState();
  }

  private distinctPlayersInRoom(roomId: string, excludePlayer?: string): number {
    const set = new Set<string>();
    for (const meta of this.sockets.values()) {
      if (meta.roomId === roomId && meta.playerId !== excludePlayer) set.add(meta.playerId);
    }
    return set.size;
  }

  private async leaveRoomInternal(ws: WebSocket, playerId: string, roomId: string): Promise<void> {
    const part = this.room(roomId);
    for (const machineId of Object.keys(part.machines)) {
      if (part.machines[machineId].occupiedBy === playerId) {
        await this.releaseMachineInternal(roomId, playerId, machineId);
      }
    }
    part.ticketState = expirePlayerRounds(part.ticketState, playerId);
    await this.broadcastRoomState(roomId);
    this.broadcastPopulation(roomId);
  }

  private async handleLeave(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    await this.leaveRoomInternal(ws, meta.playerId, meta.roomId);
    this.send(ws, { t: "room_left", roomId: meta.roomId });
    await this.persistState();
  }

  private sendRoomState(ws: WebSocket): void {
    const roomId = this.socketRoom(ws);
    const part = this.room(roomId);
    this.send(ws, { t: "room_state", roomId, machines: part.machines, rev: part.machines[PULSE_MACHINE].rev });
  }

  private broadcastPopulation(roomId: string): void {
    this.broadcastRoom(roomId, { t: "room_population", roomId, population: this.roomPopulation(roomId) });
  }

  // ==================== Occupancy ====================

  private async handleOccupy(ws: WebSocket, machineId: string, clientRev?: number): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    const { playerId, roomId } = meta;
    const part = this.room(roomId);
    const machine = part.machines[machineId];
    if (!machine) { this.send(ws, { t: "occupy_denied", machineId, reason: "invalid" }); return; }
    if (clientRev !== undefined && clientRev !== machine.rev) {
      this.send(ws, { t: "occupy_denied", machineId, reason: "stale_rev", currentRev: machine.rev });
      return;
    }
    if (machine.occupiedBy !== null) { this.send(ws, { t: "occupy_denied", machineId, reason: "busy" }); return; }
    machine.occupiedBy = playerId;
    machine.occupiedSince = Date.now();
    machine.rev += 1;
    await this.persistState();
    await this.broadcastRoomState(roomId);
    this.send(ws, { t: "machine_occupied", machineId, playerId, occupiedSince: machine.occupiedSince, rev: machine.rev });
  }

  private async handleRelease(ws: WebSocket, machineId: string, clientRev?: number): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    const { playerId, roomId } = meta;
    const machine = this.room(roomId).machines[machineId];
    if (!machine) return;
    if (machine.occupiedBy !== playerId) { this.sendError(ws, "not_owner", "Only current occupant can release"); return; }
    if (clientRev !== undefined && clientRev !== machine.rev) {
      this.send(ws, { t: "occupy_denied", machineId, reason: "stale_rev", currentRev: machine.rev });
      return;
    }
    await this.releaseMachineInternal(roomId, playerId, machineId);
  }

  private async handleHeartbeat(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    meta.lastHeartbeat = Date.now();
    await this.persistState();
  }

  // ==================== Round authority ====================

  private currentOccupant(roomId: string, machineId: string): string | null {
    return this.room(roomId).machines[machineId]?.occupiedBy ?? null;
  }

  private async handleRoundStart(ws: WebSocket, data: any, startedType: string, rejectedType: string): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    const { playerId, roomId } = meta;
    const part = this.room(roomId);
    const machineId = data.machineId;
    const roundId = `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const res = startRound(part.ticketState, { machineId, occupantId: this.currentOccupant(roomId, machineId), playerId, roundId, now: Date.now() });
    part.ticketState = res.state;
    if (!res.ok) { this.send(ws, { t: rejectedType, machineId, reason: res.reason }); return; }
    await this.persistState();
    this.send(ws, { t: startedType, roomId, ...res.started });
  }

  private async handleRoundSubmit(ws: WebSocket, data: any, acceptedType: string, rejectedType: string): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    const { playerId, roomId } = meta;
    const part = this.room(roomId);
    const res = submitRound(part.ticketState, { payload: data, senderId: playerId, occupantId: this.currentOccupant(roomId, data.machineId), now: Date.now() });
    part.ticketState = res.state;
    if (!res.ok) { this.send(ws, { t: rejectedType, roundId: data.roundId, machineId: data.machineId, reason: res.reason }); return; }
    const now = Date.now();
    const cabinet = getCabinetByMachineId(data.machineId);
    const cabinetType = cabinet ? cabinet.cabinet_type : null;
    const cabinetLabel = cabinet ? cabinet.display_name : data.machineId;

    const rec = recordRoundAccepted(part.ticketState, { playerId, cabinetType, noiseHits: data.noiseHits, mistakes: data.mistakes, awarded: res.awarded, now });
    part.ticketState = rec.state;

    const feedEvents = [this.pushEvent(roomId, { type: "ticket_award", actorPublicId: playerId, summary: `${playerId} earned ${res.awarded} tickets at ${cabinetLabel}`, source: data.machineId, now })];
    for (const c of rec.newlyCompleted) {
      feedEvents.push(this.pushEvent(roomId, { type: "challenge_completed", actorPublicId: playerId, summary: `${playerId} completed ${c.display_name}`, source: c.challenge_id, now }));
    }
    await this.persistState();

    this.send(ws, { t: acceptedType, roundId: data.roundId, machineId: data.machineId, awarded: res.awarded, balance: res.balance, grade: data.grade, score: data.score });
    this.send(ws, { t: "ticket_balance", playerId, balance: res.balance });
    this.broadcastRoom(roomId, { t: "ticket_awarded", roomId, ...res.publicAward });
    this.broadcastTicketState(roomId);
    for (const c of rec.newlyCompleted) this.send(ws, { t: "challenge_completed", challenge_id: c.challenge_id, display_name: c.display_name });
    if (rec.newlyCompleted.length) this.send(ws, { t: "challenge_progress", playerId, challenges: getProgress(part.ticketState, playerId) });
    for (const ev of feedEvents) this.broadcastEvent(roomId, ev);
  }

  private async handleTicketBalanceRequest(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    this.send(ws, { t: "ticket_balance", playerId: meta.playerId, balance: getBalance(this.room(meta.roomId).ticketState, meta.playerId) });
  }

  private ticketStatePayload(roomId: string): Record<string, unknown> {
    const part = this.room(roomId);
    const machine = part.machines[PULSE_MACHINE];
    const lp = part.ticketState.lastPublic;
    return {
      t: "ticket_state", roomId, machineId: PULSE_MACHINE,
      occupied: machine.occupiedBy !== null, occupiedBy: machine.occupiedBy,
      lastScore: lp ? lp.score : null, lastGrade: lp ? lp.grade : null,
      lastAwardBy: lp ? lp.playerId : null, lastAwardAmount: lp ? lp.awarded : null,
    };
  }
  private sendTicketState(ws: WebSocket, roomId: string): void { this.send(ws, this.ticketStatePayload(roomId)); }
  private broadcastTicketState(roomId: string): void { this.broadcastRoom(roomId, this.ticketStatePayload(roomId)); }

  /** Broadcast to sockets in ONE room only (room isolation). */
  private broadcastRoom(roomId: string, payload: unknown): void {
    for (const [ws, meta] of this.sockets) if (meta.roomId === roomId) this.send(ws, payload);
  }

  // ==================== Arcade loop (room-scoped) ====================

  private sendInventory(ws: WebSocket, roomId: string, playerId: string): void {
    const part = this.room(roomId);
    this.send(ws, { t: "inventory_state", playerId, items: getInventory(part.ticketState, playerId), equips: getEquips(part.ticketState, playerId) });
  }
  private cosmeticStatePayload(roomId: string): Record<string, unknown> {
    return { t: "cosmetic_state", roomId, equipped: publicCosmeticState(this.room(roomId).ticketState) };
  }
  private sendCosmeticState(ws: WebSocket, roomId: string): void { this.send(ws, this.cosmeticStatePayload(roomId)); }
  private broadcastCosmeticState(roomId: string): void { this.broadcastRoom(roomId, this.cosmeticStatePayload(roomId)); }

  private pushEvent(roomId: string, evt: { type: string; actorPublicId: string; summary: string; source?: string | null; now: number }): unknown {
    const part = this.room(roomId);
    const r = appendEvent(part.ticketState, evt);
    part.ticketState = r.state;
    return r.event;
  }
  private broadcastEvent(roomId: string, event: unknown): void { this.broadcastRoom(roomId, { t: "arcade_event", event }); }

  private handleChallengeProgressRequest(ws: WebSocket): void {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    this.send(ws, { t: "challenge_progress", playerId: meta.playerId, challenges: getProgress(this.room(meta.roomId).ticketState, meta.playerId) });
  }

  private handleAchievementStateRequest(ws: WebSocket): void {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    this.send(ws, { t: "achievement_state", playerId: meta.playerId, achievements: getAchievements(this.room(meta.roomId).ticketState, meta.playerId) });
  }

  private async handleChallengeRewardClaim(ws: WebSocket, data: any): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    const { playerId, roomId } = meta;
    const part = this.room(roomId);
    const now = Date.now();
    const res = claimReward(part.ticketState, { playerId, challengeId: data.challengeId, now });
    part.ticketState = res.state;
    if (!res.ok) { this.send(ws, { t: "challenge_rejected", challengeId: data.challengeId, reason: res.reason }); return; }
    const feedEvents: unknown[] = [];
    if (res.badge && res.achievement) {
      feedEvents.push(this.pushEvent(roomId, { type: "achievement_unlocked", actorPublicId: playerId, summary: `${playerId} ${res.achievement.public_safe_summary}`, source: res.achievement.achievement_id, now }));
    }
    await this.persistState();
    if (res.badge && res.achievement) this.send(ws, { t: "achievement_unlocked", achievement_id: res.achievement.achievement_id, badge: res.badge });
    this.send(ws, { t: "challenge_rewarded", challengeId: data.challengeId, badge: res.badge || null, achievement_id: res.achievement ? res.achievement.achievement_id : null, ticketBonus: res.ticketBonus, balance: res.balance });
    if (res.ticketBonus > 0) {
      this.send(ws, { t: "ticket_balance", playerId, balance: res.balance });
      this.send(ws, { t: "ticket_ledger", playerId, entries: getLedger(part.ticketState, playerId) });
    }
    this.sendInventory(ws, roomId, playerId);
    this.send(ws, { t: "challenge_progress", playerId, challenges: getProgress(part.ticketState, playerId) });
    this.send(ws, { t: "achievement_state", playerId, achievements: getAchievements(part.ticketState, playerId) });
    for (const ev of feedEvents) this.broadcastEvent(roomId, ev);
  }

  private async handleTicketLedger(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    this.send(ws, { t: "ticket_ledger", playerId: meta.playerId, entries: getLedger(this.room(meta.roomId).ticketState, meta.playerId) });
  }

  private async handleInventoryRequest(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    this.sendInventory(ws, meta.roomId, meta.playerId);
  }

  private async handlePrizeRedeem(ws: WebSocket, data: any): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    const { playerId, roomId } = meta;
    const part = this.room(roomId);
    const now = Date.now();
    const redemptionId = `rd-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const res = redeemPrize(part.ticketState, { prizeId: data.prizeId, playerId, now, redemptionId });
    part.ticketState = res.state;
    if (!res.ok) { this.send(ws, { t: "prize_rejected", prizeId: data.prizeId, reason: res.reason }); return; }
    const rec = recordRedemption(part.ticketState, { playerId, now });
    part.ticketState = rec.state;
    const prizeName = res.publicSummary ? res.publicSummary.display_name : data.prizeId;
    const feedEvents = [this.pushEvent(roomId, { type: "prize_redeem", actorPublicId: playerId, summary: `${playerId} redeemed ${prizeName}`, source: "prize-counter", now })];
    for (const c of rec.newlyCompleted) feedEvents.push(this.pushEvent(roomId, { type: "challenge_completed", actorPublicId: playerId, summary: `${playerId} completed ${c.display_name}`, source: c.challenge_id, now }));
    await this.persistState();
    this.send(ws, { t: "prize_redeemed", prizeId: data.prizeId, balance: res.balance, item: res.item });
    this.send(ws, { t: "ticket_balance", playerId, balance: res.balance });
    this.sendInventory(ws, roomId, playerId);
    this.send(ws, { t: "ticket_ledger", playerId, entries: getLedger(part.ticketState, playerId) });
    for (const c of rec.newlyCompleted) this.send(ws, { t: "challenge_completed", challenge_id: c.challenge_id, display_name: c.display_name });
    if (rec.newlyCompleted.length) this.send(ws, { t: "challenge_progress", playerId, challenges: getProgress(part.ticketState, playerId) });
    for (const ev of feedEvents) this.broadcastEvent(roomId, ev);
  }

  private async handleCosmeticEquip(ws: WebSocket, data: any): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    const { playerId, roomId } = meta;
    const part = this.room(roomId);
    const res = equipCosmetic(part.ticketState, { playerId, prizeId: data.prizeId });
    part.ticketState = res.state;
    if (!res.ok) { this.send(ws, { t: "prize_rejected", context: "equip", prizeId: data.prizeId, reason: res.reason }); return; }
    const now = Date.now();
    const owned = part.ticketState.inventory[playerId]?.[res.prizeId];
    const cosmeticName = owned ? owned.display_name : res.prizeId;
    const ev = this.pushEvent(roomId, { type: "cosmetic_equip", actorPublicId: playerId, summary: `${playerId} equipped ${cosmeticName}`, source: res.slot, now });
    await this.persistState();
    this.send(ws, { t: "cosmetic_equipped", prizeId: res.prizeId, slot: res.slot });
    this.sendInventory(ws, roomId, playerId);
    this.broadcastCosmeticState(roomId);
    this.broadcastEvent(roomId, ev);
  }

  private async handleCosmeticUnequip(ws: WebSocket, data: any): Promise<void> {
    const meta = this.sockets.get(ws);
    if (!meta) { this.sendError(ws, "no_identity", "Must join with playerId first"); return; }
    const { playerId, roomId } = meta;
    const part = this.room(roomId);
    const res = unequipCosmetic(part.ticketState, { playerId, slot: data.slot, prizeId: data.prizeId });
    part.ticketState = res.state;
    if (!res.ok) { this.send(ws, { t: "prize_rejected", context: "unequip", slot: data.slot, reason: res.reason }); return; }
    await this.persistState();
    this.send(ws, { t: "cosmetic_unequipped", slot: res.slot });
    this.sendInventory(ws, roomId, playerId);
    this.broadcastCosmeticState(roomId);
  }

  // ==================== Internal ====================

  private async releaseMachineInternal(roomId: string, requester: string, machineId: string): Promise<void> {
    const machine = this.room(roomId).machines[machineId];
    if (!machine || machine.occupiedBy !== requester) return;
    machine.occupiedBy = null;
    machine.occupiedSince = null;
    machine.rev += 1;
    this.room(roomId).ticketState = expirePlayerRounds(this.room(roomId).ticketState, requester);
    await this.persistState();
    await this.broadcastRoomState(roomId);
    this.broadcastTicketState(roomId);
  }

  private async broadcastRoomState(roomId: string): Promise<void> {
    const part = this.room(roomId);
    this.broadcastRoom(roomId, { t: "room_state", roomId, machines: part.machines, rev: part.machines[PULSE_MACHINE].rev });
  }

  private send(ws: WebSocket, payload: unknown): void {
    try { ws.send(JSON.stringify(payload)); } catch { /* socket closing */ }
  }
  private sendError(ws: WebSocket, code: string, message: string): void {
    this.send(ws, { t: "error", code, message });
  }

  // ==================== Alarm — stale lock cleanup (all rooms) ====================

  async alarm(): Promise<void> {
    await this.ensureInitialized();
    const now = Date.now();
    for (const [roomId, part] of Object.entries(this.state.rooms)) {
      let released = false;
      for (const machine of Object.values(part.machines)) {
        if (!machine.occupiedBy) continue;
        let occupantLastSeen = 0;
        for (const meta of this.sockets.values()) {
          if (meta.roomId === roomId && meta.playerId === machine.occupiedBy) { occupantLastSeen = meta.lastHeartbeat; break; }
        }
        if (occupantLastSeen === 0 || now - occupantLastSeen > STALE_LOCK_MS) {
          const staleOccupant = machine.occupiedBy;
          machine.occupiedBy = null; machine.occupiedSince = null; machine.rev += 1;
          if (staleOccupant) part.ticketState = expirePlayerRounds(part.ticketState, staleOccupant);
          released = true;
        }
      }
      if (released && this.sockets.size > 0) { await this.broadcastRoomState(roomId); this.broadcastTicketState(roomId); }
      part.ticketState = pruneExpired(part.ticketState, now);
    }
    await this.persistState();
    this.scheduleStaleLockAlarm();
  }
}

interface Env {
  ARCADE_ROOM: DurableObjectNamespace;
}
