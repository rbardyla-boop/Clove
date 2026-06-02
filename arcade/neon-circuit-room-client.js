/**
 * NeonCircuitRoomClient
 *
 * Thin authoritative client for the Neon Circuit Room Authority Mesh (Phase 1b).
 *
 * Responsibilities:
 * - Connect to the Worker WebSocket endpoint
 * - Send join_room, occupy_machine, release_machine, heartbeat
 * - Receive and reconcile authoritative room_state / machine transitions
 * - Automatic heartbeat + basic reconnection
 *
 * This is deliberately NOT called "mesh". It talks only to the room authority.
 *
 * For Phase 1b validation, pass `playerIdOverride` (via ?id= in the harness)
 * so two tabs can use clearly distinct identities without sharing localStorage.
 *
 * Usage (in a test harness or later real arcade shell):
 *   const client = new NeonCircuitRoomClient({
 *     wsUrl: "ws://localhost:8787/arcade/ws",
 *     playerIdOverride: "test-alpha",   // validation only
 *     onState: (state) => { ... },
 *   });
 */

export class NeonCircuitRoomClient {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || this.defaultWsUrl();
    this.onState = options.onState || (() => {});
    this.onDenied = options.onDenied || (() => {});
    this.onError = options.onError || (() => {});
    this.onConnected = options.onConnected || (() => {});
    // Phase 1e ticket-flow callbacks (Pulse Tap)
    this.onRoundStarted = options.onRoundStarted || (() => {});
    this.onRoundAccepted = options.onRoundAccepted || (() => {});
    this.onRoundRejected = options.onRoundRejected || (() => {});
    // Phase 1g ticket-flow callbacks (Signal Sprint)
    this.onSignalRoundStarted = options.onSignalRoundStarted || (() => {});
    this.onSignalRoundAccepted = options.onSignalRoundAccepted || (() => {});
    this.onSignalRoundRejected = options.onSignalRoundRejected || (() => {});
    // Phase 1l ticket-flow callbacks (Neon Grid — adapter-loaded cabinet)
    this.onNeonGridRoundStarted = options.onNeonGridRoundStarted || (() => {});
    this.onNeonGridRoundAccepted = options.onNeonGridRoundAccepted || (() => {});
    this.onNeonGridRoundRejected = options.onNeonGridRoundRejected || (() => {});
    this.onTicketBalance = options.onTicketBalance || (() => {});
    this.onTicketAwarded = options.onTicketAwarded || (() => {});
    this.onTicketState = options.onTicketState || (() => {});
    // Phase 1f arcade-loop callbacks
    this.onCabinetCatalog = options.onCabinetCatalog || (() => {});
    this.onPrizeCatalog = options.onPrizeCatalog || (() => {});
    this.onTicketLedger = options.onTicketLedger || (() => {});
    this.onInventoryState = options.onInventoryState || (() => {});
    this.onPrizeRedeemed = options.onPrizeRedeemed || (() => {});
    this.onPrizeRejected = options.onPrizeRejected || (() => {});
    this.onCosmeticEquipped = options.onCosmeticEquipped || (() => {});
    this.onCosmeticUnequipped = options.onCosmeticUnequipped || (() => {});
    this.onCosmeticState = options.onCosmeticState || (() => {});
    // Phase 1h challenge board / achievements / event feed callbacks
    this.onChallengeCatalog = options.onChallengeCatalog || (() => {});
    this.onChallengeProgress = options.onChallengeProgress || (() => {});
    this.onChallengeCompleted = options.onChallengeCompleted || (() => {});
    this.onChallengeRewarded = options.onChallengeRewarded || (() => {});
    this.onChallengeRejected = options.onChallengeRejected || (() => {});
    this.onAchievementState = options.onAchievementState || (() => {});
    this.onAchievementUnlocked = options.onAchievementUnlocked || (() => {});
    this.onArcadeEventFeed = options.onArcadeEventFeed || (() => {});
    this.onArcadeEvent = options.onArcadeEvent || (() => {});
    // Phase 2e: scheduled room events (display-only; current/next + schedule).
    this.onRoomEvents = options.onRoomEvents || (() => {});
    // Phase 2a lobby callbacks
    this.onRoomList = options.onRoomList || (() => {});
    this.onRoomJoined = options.onRoomJoined || (() => {});
    this.onRoomJoinRejected = options.onRoomJoinRejected || (() => {});
    this.onRoomLeft = options.onRoomLeft || (() => {});
    this.onRoomPopulation = options.onRoomPopulation || (() => {});
    // Phase 2b admin / lifecycle callbacks
    this.onRoomReset = options.onRoomReset || (() => {});
    this.onRoomAdminResult = options.onRoomAdminResult || (() => {});

    this.ws = null;
    // Phase 2a: the room this client is bound to (default main-floor; legacy 'main').
    this.roomId = this._normalizeRoom(options.roomId) || "main-floor";
    this.currentState = { machines: {} };
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.isConnected = false;
    // A monotonically-increasing connection generation. Messages from a previous
    // socket (e.g. after switching rooms) are ignored, so stale room responses can
    // never corrupt the newly-joined room's UI state.
    this.generation = 0;

    // Support explicit override for validation (e.g. ?id=alpha)
    // When an override is provided we do NOT touch localStorage for this session.
    this.playerIdOverride = options.playerIdOverride || null;
    this.playerId = this.playerIdOverride || this.loadOrCreatePlayerId();
    this.usingPlayerIdOverride = !!this.playerIdOverride;
  }

  defaultWsUrl() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    // In dev you will usually override this explicitly
    return `${proto}//${location.host}/arcade/ws`;
  }

  loadOrCreatePlayerId() {
    const key = "neon-arcade-player-id";
    let id = localStorage.getItem(key);
    if (!id) {
      id = `player_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(key, id);
    }
    return id;
  }

  /** Normalize an untrusted room id (legacy 'main' → 'main-floor'); empty → null. */
  _normalizeRoom(raw) {
    if (typeof raw !== "string") return null;
    const r = raw.trim().toLowerCase();
    if (!r || !/^[a-z0-9-]+$/.test(r)) return null;
    return r === "main" ? "main-floor" : r;
  }

  /** Build the ws URL for the current room (carries ?room= for routing/clarity). */
  _roomWsUrl() {
    const sep = this.wsUrl.includes("?") ? "&" : "?";
    return `${this.wsUrl}${sep}room=${encodeURIComponent(this.roomId)}`;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return; // already connecting
    }

    const gen = ++this.generation; // this socket's generation
    try {
      const ws = new WebSocket(this._roomWsUrl());
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return; // superseded by a newer socket
        this.isConnected = true;
        this.send({ t: "join_room", roomId: this.roomId, playerId: this.playerId });
        this.startHeartbeat();
        this.onConnected({ playerId: this.playerId, roomId: this.roomId });
        // Reconnect support: pull authoritative balance + room-scoped catalogs/state.
        this.requestTicketBalance();
        this.requestCabinetCatalog();
        this.requestPrizeCatalog();
        this.requestInventory();
        this.requestTicketLedger();
        this.requestRoomEvents(); // Phase 2e: this room's scheduled events (display-only)
      };

      ws.onmessage = (event) => {
        // Ignore any message from a stale socket / generation (room-switch safety).
        if (this.ws !== ws || gen !== this.generation) return;
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        this.handleMessage(msg);
      };

      ws.onclose = () => {
        if (this.ws !== ws) return; // an intentional switch already moved on
        this.isConnected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      ws.onerror = (err) => {
        if (this.ws !== ws) return;
        this.onError(err);
        this.scheduleReconnect();
      };
    } catch (err) {
      this.onError(err);
      this.scheduleReconnect();
    }
  }

  /**
   * Phase 2a: switch to another room. Closes the current socket cleanly, bumps the
   * connection generation so any in-flight old-room responses are ignored, then
   * connects to the selected room. The floor resets room-scoped UI on onConnected.
   */
  switchRoom(roomId) {
    const target = this._normalizeRoom(roomId);
    if (!target || target === this.roomId) return;
    this.generation += 1; // invalidate the old socket's callbacks immediately
    this.stopHeartbeat();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { try { this.ws.close(1000, "switch room"); } catch { /* ignore */ } this.ws = null; }
    this.isConnected = false;
    this.currentState = { machines: {} };
    this.roomId = target;
    this.connect();
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close(1000, "client disconnect");
      this.ws = null;
    }
    this.isConnected = false;
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ t: "heartbeat" });
      }
    }, 20_000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1500);
  }

  handleMessage(msg) {
    switch (msg.t) {
      case "room_list": {
        this.onRoomList(msg);
        break;
      }
      case "room_joined": {
        if (msg.room && msg.room.room_id) this.roomId = msg.room.room_id;
        this.onRoomJoined(msg);
        break;
      }
      case "room_join_rejected": {
        this.onRoomJoinRejected(msg);
        break;
      }
      case "room_left": {
        this.onRoomLeft(msg);
        break;
      }
      case "room_population": {
        this.onRoomPopulation(msg);
        break;
      }
      case "room_reset": {
        this.onRoomReset(msg);
        break;
      }
      case "room_admin_result": {
        this.onRoomAdminResult(msg);
        break;
      }
      case "room_state": {
        this.currentState = msg;
        this.onState(msg);
        break;
      }
      case "machine_occupied":
      case "machine_released": {
        // Force a fresh authoritative snapshot on transitions
        this.send({ t: "heartbeat" }); // prompt latest state
        break;
      }
      case "occupy_denied": {
        this.onDenied(msg);
        break;
      }
      case "error": {
        this.onError(msg);
        break;
      }
      case "pulse_round_started": {
        this.onRoundStarted(msg);
        break;
      }
      case "pulse_round_accepted": {
        this.onRoundAccepted(msg);
        break;
      }
      case "pulse_round_rejected": {
        this.onRoundRejected(msg);
        break;
      }
      case "signal_sprint_round_started": {
        this.onSignalRoundStarted(msg);
        break;
      }
      case "signal_sprint_round_accepted": {
        this.onSignalRoundAccepted(msg);
        break;
      }
      case "signal_sprint_round_rejected": {
        this.onSignalRoundRejected(msg);
        break;
      }
      case "neon_grid_round_started": {
        this.onNeonGridRoundStarted(msg);
        break;
      }
      case "neon_grid_round_accepted": {
        this.onNeonGridRoundAccepted(msg);
        break;
      }
      case "neon_grid_round_rejected": {
        this.onNeonGridRoundRejected(msg);
        break;
      }
      case "ticket_balance": {
        this.onTicketBalance(msg);
        break;
      }
      case "ticket_awarded": {
        this.onTicketAwarded(msg);
        break;
      }
      case "ticket_state": {
        this.onTicketState(msg);
        break;
      }
      case "cabinet_catalog": {
        this.onCabinetCatalog(msg);
        break;
      }
      case "prize_catalog": {
        this.onPrizeCatalog(msg);
        break;
      }
      case "ticket_ledger": {
        this.onTicketLedger(msg);
        break;
      }
      case "inventory_state": {
        this.onInventoryState(msg);
        break;
      }
      case "prize_redeemed": {
        this.onPrizeRedeemed(msg);
        break;
      }
      case "prize_rejected": {
        this.onPrizeRejected(msg);
        break;
      }
      case "cosmetic_equipped": {
        this.onCosmeticEquipped(msg);
        break;
      }
      case "cosmetic_unequipped": {
        this.onCosmeticUnequipped(msg);
        break;
      }
      case "cosmetic_state": {
        this.onCosmeticState(msg);
        break;
      }
      case "challenge_catalog": {
        this.onChallengeCatalog(msg);
        break;
      }
      case "challenge_progress": {
        this.onChallengeProgress(msg);
        break;
      }
      case "challenge_completed": {
        this.onChallengeCompleted(msg);
        break;
      }
      case "challenge_rewarded": {
        this.onChallengeRewarded(msg);
        break;
      }
      case "challenge_rejected": {
        this.onChallengeRejected(msg);
        break;
      }
      case "achievement_state": {
        this.onAchievementState(msg);
        break;
      }
      case "achievement_unlocked": {
        this.onAchievementUnlocked(msg);
        break;
      }
      case "arcade_event_feed": {
        this.onArcadeEventFeed(msg);
        break;
      }
      case "arcade_event": {
        this.onArcadeEvent(msg);
        break;
      }
      case "room_events": {
        this.onRoomEvents(msg);
        break;
      }
    }
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  // ==================== Public API used by the harness ====================

  occupy(machineId = "pulse") {
    this.send({
      t: "occupy_machine",
      machineId,
      // rev omitted — server will reject with currentRev if stale
    });
  }

  release(machineId = "pulse") {
    this.send({
      t: "release_machine",
      machineId,
    });
  }

  // ==================== Phase 1e: server-authoritative tickets ====================

  /** Ask the server to register a new Pulse Tap round and issue a round id. */
  startPulseRound(machineId = "pulse") {
    this.send({ t: "pulse_round_start", machineId });
  }

  /**
   * Submit a finished round for server validation + ticket award.
   * `result` must include { roundId, machineId, score, accuracy, grade, hits, bestStreak, durationMs }.
   * Any client-side ticket estimate is intentionally NOT sent as authoritative —
   * the server computes the final award and replies with pulse_round_accepted.
   */
  submitPulseRound(result) {
    this.send({ t: "pulse_round_submit", ...result });
  }

  /** Request the current authoritative ticket balance for this session. */
  requestTicketBalance() {
    this.send({ t: "ticket_balance_request" });
  }

  // ==================== Phase 1g: Signal Sprint (second ticketed cabinet) ====================

  /** Ask the server to register a new Signal Sprint round and issue a round id. */
  startSignalRound(machineId = "signal") {
    this.send({ t: "signal_sprint_round_start", machineId });
  }

  /**
   * Submit a finished Signal Sprint round for server validation + ticket award.
   * `result` must include { roundId, machineId, score, distance, pulsesCollected,
   * noiseHits, maxStreak, grade, durationMs }. The server computes the final award.
   */
  submitSignalRound(result) {
    this.send({ t: "signal_sprint_round_submit", cabinetType: "signal_sprint", rulesetVersion: "signal-sprint/1", ...result });
  }

  // ==================== Phase 1l: Neon Grid (first adapter-loaded cabinet) ====================

  /** Ask the server to register a new Neon Grid round and issue a round id. */
  startNeonGridRound(machineId = "grid") {
    this.send({ t: "neon_grid_round_start", machineId });
  }

  /**
   * Submit a finished Neon Grid round for server validation + ticket award.
   * `result` must include { roundId, machineId, grade, score, correctSteps,
   * completedPatterns, mistakes, bestStreak, durationMs }. The server computes the
   * final award; any client estimate is ignored.
   */
  submitNeonGridRound(result) {
    this.send({ t: "neon_grid_round_submit", cabinetType: "neon_grid", rulesetVersion: "neon-grid-v1", ...result });
  }

  // ==================== Phase 1f: arcade loop (catalog / prizes / cosmetics) ====================

  requestCabinetCatalog() {
    this.send({ t: "cabinet_catalog_request" });
  }
  requestPrizeCatalog() {
    this.send({ t: "prize_catalog_request" });
  }
  requestTicketLedger() {
    this.send({ t: "ticket_ledger_request" });
  }
  requestInventory() {
    this.send({ t: "inventory_request" });
  }
  /** Redeem a prize with arcade tickets. The server computes cost + validates. */
  redeemPrize(prizeId) {
    this.send({ t: "prize_redeem", prizeId });
  }
  equipCosmetic(prizeId) {
    this.send({ t: "cosmetic_equip", prizeId });
  }
  unequipCosmetic({ slot, prizeId } = {}) {
    this.send({ t: "cosmetic_unequip", slot, prizeId });
  }

  // ==================== Phase 1h: challenge board / achievements / event feed ====================

  requestChallengeCatalog() {
    this.send({ t: "challenge_catalog_request" });
  }
  requestChallengeProgress() {
    this.send({ t: "challenge_progress_request" });
  }
  /** Claim a completed challenge's reward. The server validates + grants. */
  claimChallengeReward(challengeId) {
    this.send({ t: "challenge_reward_claim", challengeId });
  }
  requestAchievementState() {
    this.send({ t: "achievement_state_request" });
  }
  requestEventFeed() {
    this.send({ t: "arcade_event_feed_request" });
  }

  // ==================== Phase 2a: lobby / multi-room ====================

  /** Ask the server for the public-safe room list (with live populations). */
  requestRoomList() {
    this.send({ t: "room_list_request" });
  }
  /** Ask the server for this room's deterministic scheduled events (Phase 2e). */
  requestRoomEvents() {
    this.send({ t: "room_events_request" });
  }
  /** Re-request the current room's authoritative occupancy snapshot. */
  requestRoomState() {
    this.send({ t: "room_state_request" });
  }
  /** Explicitly leave the current room (server releases occupancy + rounds). */
  leaveRoom() {
    this.send({ t: "room_leave_request" });
  }
  getRoomId() {
    return this.roomId;
  }

  // ---- Phase 2b: room lifecycle admin (gated server-side by dev flag + token) ----
  /** Reset a room's state (admin). The server validates the token; never trusted client-side. */
  adminResetRoom(roomId, token) {
    this.send({ t: "room_admin", op: "reset", roomId, token });
  }
  /** Set a room's status (open/closed/maintenance) (admin). Server-gated. */
  adminSetRoomStatus(roomId, status, token) {
    this.send({ t: "room_admin", op: "set_status", roomId, status, token });
  }
  /**
   * Phase 2c: request public-safe per-room operational diagnostics (admin). The
   * server validates the token; the result arrives via onRoomAdminResult with a
   * `diagnostics` array. Never exposes player ids / balances / ledger / the token.
   */
  adminRoomDiagnostics(token) {
    this.send({ t: "room_admin", op: "diagnostics", token });
  }

  // ---- Phase 2i: live-ops, DISPLAY-ONLY per-room presentation overrides (server-gated) ----
  // These tune ONLY how room events are presented (pre-roll lead, countdown refresh, show
  // flags) — never tickets/prizes/economy/authority. The server validates the token and
  // sanitizes/clamps the override; nothing here is trusted client-side.
  /** Apply a per-room presentation override (partial; empty/garbage clears it). */
  adminSetPresentation(roomId, override, token) {
    this.send({ t: "room_admin", op: "set_presentation", roomId, override, token });
  }
  /** Reset a room's presentation override back to the operator/base config. */
  adminClearPresentation(roomId, token) {
    this.send({ t: "room_admin", op: "clear_presentation", roomId, token });
  }
  /** Preview the effective config a proposed override WOULD produce, WITHOUT applying it. */
  adminPreviewPresentation(roomId, override, token) {
    this.send({ t: "room_admin", op: "preview_presentation", roomId, override, token });
  }
  /** Request registry-wide presentation diagnostics (per-room override + effective config). */
  adminPresentationDiagnostics(token) {
    this.send({ t: "room_admin", op: "presentation_diagnostics", token });
  }

  getCurrentMachineState(machineId = "pulse") {
    return this.currentState.machines?.[machineId] || null;
  }

  getPlayerId() {
    return this.playerId;
  }

  // For validation harness only — makes identity provenance visible
  isUsingPlayerIdOverride() {
    return this.usingPlayerIdOverride;
  }

  getPlayerIdSource() {
    return this.usingPlayerIdOverride ? "query-override" : "localStorage";
  }
}

// Convenience factory for the Phase 1b test harness
export function createRoomClientForTest(overrides = {}) {
  const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const defaultUrl = isLocal
    ? "ws://localhost:8787/arcade/ws"
    : "wss://neon-arcade-mesh.<your-subdomain>.workers.dev/arcade/ws"; // replace at deploy time

  return new NeonCircuitRoomClient({
    wsUrl: overrides.wsUrl || defaultUrl,
    ...overrides,
  });
}
