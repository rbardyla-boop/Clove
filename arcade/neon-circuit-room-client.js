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

    this.ws = null;
    this.roomId = "main";
    this.currentState = { machines: {} };
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.isConnected = false;

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

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return; // already connecting
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.send({
          t: "join_room",
          roomId: this.roomId,
          playerId: this.playerId,
        });
        this.startHeartbeat();
        this.onConnected({ playerId: this.playerId });
        // Reconnect support: pull authoritative ticket balance + cabinet state.
        this.requestTicketBalance();
        // Phase 1f: refresh catalogs, inventory and ledger on (re)connect.
        this.requestCabinetCatalog();
        this.requestPrizeCatalog();
        this.requestInventory();
        this.requestTicketLedger();
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        this.handleMessage(msg);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        this.onError(err);
        this.scheduleReconnect();
      };
    } catch (err) {
      this.onError(err);
      this.scheduleReconnect();
    }
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
