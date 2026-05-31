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
