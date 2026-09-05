/**
 * Clove Hive World room authority.
 *
 * This is the live multiplayer adapter for the pure rules in
 * arcade/hiveworld/hive-world.mjs. It deliberately uses a separate Durable
 * Object namespace from Neon Circuit's existing CityRoom so the old live game
 * remains a rollback-safe product. The room is server-authoritative: clients
 * send intent, never positions, evidence outcomes, or authority decisions.
 */

import {
  addPlayer,
  applyCommand,
  createInitialWorld,
  isValidHivePlayerId,
  markPlayerDisconnected,
  publicSnapshot,
} from "../../../arcade/hiveworld/hive-world.mjs";

interface HiveEnv {
  HIVE_ROOM: DurableObjectNamespace;
  HIVE_WORLD_SEED?: string;
}

interface HiveSocketMeta {
  playerId: string;
  lastHeartbeat: number;
  lastCommand: number;
}

const COMMAND_MIN_MS = 33;
const HEARTBEAT_STALE_MS = 45_000;
const ALARM_INTERVAL_MS = 30_000;

const ERROR_TEXT: Record<string, string> = {
  unknown_command: "The Hive does not recognize that action.",
  unknown_player: "Your witness identity is no longer present. Reconnect to continue.",
  route_not_adjacent: "That route is not open from here.",
  invalid_law_guess: "Choose one of the visible readings before making a claim.",
  evidence_does_not_match_law: "That evidence belongs to another question.",
  unknown_hypothesis: "That claim is no longer in this cycle.",
  stale_hypothesis: "The world has moved on; form a new claim.",
  no_focus: "You have no Focus left for another risky probe this cycle.",
  regroup_at_hub: "Return to Clove Hive before regrouping your attention.",
  regroup_limit: "You have used every regroup for this cycle. The remaining evidence must carry you forward.",
  regroup_not_needed: "Your Focus is already full; keep your attention for a risky probe.",
  build_needs_focus: "A field beacon costs two Focus. Regroup at Clove Hive before building.",
  build_needs_shared_proof: "Share a supported claim and its tested proof before building.",
  build_limit: "You have already left one field beacon this cycle. Let it do its work.",
  cycle_sealed: "This cycle is sealed. Begin the next question before building again.",
  signal_at_relay: "Stand at Hollow Relay to send a coordination signal.",
  invalid_signal: "Choose one of the six coordination signals.",
  signal_limit: "Your witness can send three signals per cycle. Let the frontier answer.",
  expedition_complete: "This Relay Thread is archived. Wait for the next cycle.",
  duplicate_hypothesis: "That reading was already tested this cycle. Choose another visible option.",
  unknown_evidence: "That evidence is not yours to share.",
  stale_evidence: "That evidence belongs to an earlier cycle.",
  stand_at_hollow_relay: "Travel to Hollow Relay before asking the Hive to authorize this.",
  share_claim_first: "Share the claim publicly before asking the Hive to trust it.",
  claim_not_supported: "The claim needs a supporting probe before it can carry authority.",
  authority_rule_rejected: "The world did not support that claim. The rejection is part of the record.",
  share_tested_evidence_first: "Share the tested evidence attached to this claim first.",
  relay_not_legible: "The relay is not legible yet. Authorize all three laws first.",
  seal_current_cycle_first: "Repair the relay before opening another cycle.",
};

function messageFor(reason: string | null | undefined): string {
  return ERROR_TEXT[reason || ""] || "The Hive rejected that action without changing the world.";
}

function cleanWorldSeed(raw: string | undefined): string {
  const seed = typeof raw === "string" && raw.trim() ? raw.trim() : "clove-frontier-live-v1";
  return seed.slice(0, 96).replace(/[^A-Za-z0-9:_-]/g, "-");
}

export class HiveRoom implements DurableObject {
  private world: any | null = null;
  private readonly sockets = new Map<WebSocket, HiveSocketMeta>();

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: HiveEnv,
  ) {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as { playerId?: string } | null;
      if (attachment?.playerId) {
        this.sockets.set(ws, { playerId: attachment.playerId, lastHeartbeat: Date.now(), lastCommand: 0 });
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.world) return;
    await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<any>("hiveWorld");
      this.world = stored && stored.schema === 1
        ? stored
        : createInitialWorld({ seed: cleanWorldSeed(this.env.HIVE_WORLD_SEED) });
    });
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("hiveWorld", this.world);
  }

  private scheduleSweep(): void {
    this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
  }

  private send(ws: WebSocket, payload: unknown): void {
    try { ws.send(JSON.stringify(payload)); } catch { /* the close path owns cleanup */ }
  }

  private sendSnapshot(ws: WebSocket): void {
    const meta = this.sockets.get(ws);
    if (!meta || !this.world) return;
    this.send(ws, { t: "hive_snapshot", snapshot: publicSnapshot(this.world, meta.playerId) });
  }

  private broadcast(): void {
    for (const ws of this.sockets.keys()) this.sendSnapshot(ws);
  }

  private async removeSocket(ws: WebSocket): Promise<void> {
    const meta = this.sockets.get(ws);
    this.sockets.delete(ws);
    if (!meta || !this.world) return;
    // A reconnect can briefly leave two sockets carrying the same anonymous
    // browser identity. Only the last socket may mark the witness offline.
    if (this.hasSocketFor(meta.playerId)) {
      await this.persist();
      return;
    }
    this.world = markPlayerDisconnected(this.world, meta.playerId);
    await this.persist();
    this.broadcast();
  }

  private hasSocketFor(playerId: string): boolean {
    for (const meta of this.sockets.values()) if (meta.playerId === playerId) return true;
    return false;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/arcade/hive/ws") return new Response("Not found", { status: 404 });
    await this.ensureInitialized();
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server, ["hive"]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    await this.ensureInitialized();
    let data: any;
    try {
      data = typeof raw === "string" ? JSON.parse(raw) : JSON.parse(new TextDecoder().decode(raw));
    } catch {
      this.send(ws, { t: "hive_error", code: "bad_json", message: "That message was not valid JSON." });
      return;
    }

    if (data.t === "hive_join") {
      await this.handleJoin(ws, data);
      return;
    }

    const meta = this.sockets.get(ws);
    if (!meta) {
      this.send(ws, { t: "hive_error", code: "join_required", message: "Join the frontier before acting." });
      return;
    }

    if (data.t === "heartbeat") {
      meta.lastHeartbeat = Date.now();
      return;
    }
    if (data.t === "hive_snapshot_request") {
      this.sendSnapshot(ws);
      return;
    }
    if (data.t === "hive_leave") {
      await this.removeSocket(ws);
      return;
    }

    const now = Date.now();
    if (now - meta.lastCommand < COMMAND_MIN_MS) {
      this.send(ws, { t: "hive_error", code: "rate_limited", message: "Slow down; the frontier records deliberate actions." });
      return;
    }
    meta.lastCommand = now;

    const command = this.commandFromMessage(data);
    const result = applyCommand(this.world, meta.playerId, command);
    if (!result.ok) {
      this.send(ws, { t: "hive_error", code: result.reason, message: messageFor(result.reason) });
      return;
    }
    this.world = result.world;
    // Position is ephemeral high-frequency state; durable evidence, claims,
    // authority, cycle archives, and roster state are persisted. This keeps a
    // busy shared room from turning every movement tick into a storage write.
    if (command.type !== "move") await this.persist();
    if (result.event) {
      for (const socket of this.sockets.keys()) this.send(socket, { t: "hive_event", event: result.event });
    }
    this.broadcast();
  }

  private commandFromMessage(data: any): any {
    switch (data.t) {
      case "hive_move": return { type: "move", dx: data.dx, dy: data.dy, dt: data.dt };
      case "hive_travel": return { type: "travel", regionId: data.regionId };
      case "hive_observe": return { type: "observe" };
      case "hive_hypothesize": return { type: "hypothesize", lawId: data.lawId, guess: data.guess, evidenceIds: data.evidenceIds };
      case "hive_probe": return { type: "probe", hypothesisId: data.hypothesisId };
      case "hive_regroup": return { type: "regroup" };
      case "hive_build": return { type: "build", kind: data.kind };
      case "hive_signal": return { type: "signal", signalId: data.signalId };
      case "hive_share": return { type: "share", itemId: data.itemId };
      case "hive_authorize": return { type: "authorize", hypothesisId: data.hypothesisId };
      case "hive_repair": return { type: "repair" };
      case "hive_next_cycle": return { type: "next_cycle" };
      default: return { type: "unknown_command" };
    }
  }

  private async handleJoin(ws: WebSocket, data: any): Promise<void> {
    const playerId = typeof data.playerId === "string" ? data.playerId.trim() : "";
    if (!isValidHivePlayerId(playerId)) {
      this.send(ws, { t: "hive_error", code: "no_identity", message: "A bounded witness identity is required." });
      return;
    }
    const result = addPlayer(this.world, {
      playerId,
      displayName: data.displayName,
      factionId: data.factionId,
      responsibility: data.responsibility,
    });
    this.world = result.world;
    this.sockets.set(ws, { playerId, lastHeartbeat: Date.now(), lastCommand: 0 });
    try { ws.serializeAttachment({ playerId }); } catch { /* attachment support is provided by workerd */ }
    await this.persist();
    this.scheduleSweep();
    this.send(ws, { t: "hive_welcome", schema: 1, worldId: this.world.worldId, playerId });
    this.broadcast();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.ensureInitialized();
    await this.removeSocket(ws);
  }
  async webSocketError(ws: WebSocket): Promise<void> {
    await this.ensureInitialized();
    await this.removeSocket(ws);
  }

  async alarm(): Promise<void> {
    await this.ensureInitialized();
    const now = Date.now();
    for (const [ws, meta] of this.sockets) {
      if (now - meta.lastHeartbeat > HEARTBEAT_STALE_MS) {
        try { ws.close(1000, "stale witness"); } catch { /* cleanup below */ }
        await this.removeSocket(ws);
      }
    }
    if (this.sockets.size > 0 || Object.values(this.world.players).some((player: any) => player.connected)) this.scheduleSweep();
  }
}
