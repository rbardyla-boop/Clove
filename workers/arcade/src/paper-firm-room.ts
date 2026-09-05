import {
  addFieldPlayer,
  advanceScout,
  applyFieldInput,
  createFieldState,
  extractPage,
  publicFieldSnapshot,
  removeFieldPlayer,
  sanitizeMatchId,
  validPlayerId,
} from "../../../arcade/paper-firm/field-core.mjs";

interface PaperFirmEnv {
  PAPER_FIRM_ROOM: DurableObjectNamespace;
  PAPER_FIRM_RECEIPT_SECRET?: string;
  ENVIRONMENT?: string;
}

type FieldState = ReturnType<typeof createFieldState>;
type SocketMeta = { playerId: string; matchId: string; lastHeartbeat: number };

const STALE_MS = 45_000;
const SWEEP_MS = 30_000;

function devSecret(env: PaperFirmEnv): string {
  if (env.PAPER_FIRM_RECEIPT_SECRET) return env.PAPER_FIRM_RECEIPT_SECRET;
  return env.ENVIRONMENT === "development" ? "paper-firm-local-dev-secret-change-me" : "";
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canonicalReceipt(input: {
  version: string;
  match_id: string;
  receipt_id: string;
  actor_id: string;
  action: string;
  object_id: string;
  zone_id: string;
  sequence: number;
  nonce: string;
  issued_at: number;
}) {
  return [input.version, input.match_id, input.receipt_id, input.actor_id, input.action, input.object_id, input.zone_id, String(input.sequence), input.nonce, String(input.issued_at)].join("\n");
}

async function signReceipt(secret: string, material: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(material)));
}

export class PaperFirmRoom implements DurableObject {
  private state!: FieldState;
  private sockets = new Map<WebSocket, SocketMeta>();
  private matchId = "FIRSTSHIFT";

  constructor(private readonly ctx: DurableObjectState, private readonly env: PaperFirmEnv) {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Partial<SocketMeta> | null;
      if (att?.playerId && att.matchId) {
        this.sockets.set(ws, { playerId: att.playerId, matchId: att.matchId, lastHeartbeat: Date.now() });
        this.matchId = att.matchId;
      }
    }
  }

  private async init() {
    if (this.state) return;
    await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<FieldState>("pfState");
      this.state = stored && stored.players ? stored : createFieldState();
    });
  }
  private async persist() { await this.ctx.storage.put("pfState", this.state); }
  private send(ws: WebSocket, data: unknown) { try { ws.send(JSON.stringify(data)); } catch { /* closed */ } }
  private broadcast(data: unknown) {
    const text = JSON.stringify(data);
    for (const ws of this.sockets.keys()) try { ws.send(text); } catch { /* closed */ }
  }
  private snapshot() { return { t: "pf_snapshot", ...publicFieldSnapshot(this.state, this.matchId) }; }
  private async drop(ws: WebSocket) {
    const meta = this.sockets.get(ws);
    if (!meta) return;
    this.sockets.delete(ws);
    this.state = removeFieldPlayer(this.state, meta.playerId);
    await this.persist();
    this.broadcast(this.snapshot());
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/arcade/paper-firm/ws") return new Response("Not found", { status: 404 });
    const match = sanitizeMatchId(url.searchParams.get("match"));
    if (!match) return new Response("Invalid match", { status: 400 });
    this.matchId = match;
    await this.init();
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server, ["paper-firm"]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.init();
    let data: any;
    try { data = typeof message === "string" ? JSON.parse(message) : {}; }
    catch { this.send(ws, { t: "pf_error", reason: "bad_json" }); return; }

    if (data.t === "pf_join") {
      const playerId = String(data.playerId || "");
      if (!validPlayerId(playerId)) { this.send(ws, { t: "pf_error", reason: "invalid_player" }); return; }
      const r = addFieldPlayer(this.state, playerId, Date.now());
      if (!r.ok) { this.send(ws, { t: "pf_error", reason: r.reason }); return; }
      this.state = r.state;
      const meta = { playerId, matchId: this.matchId, lastHeartbeat: Date.now() };
      ws.serializeAttachment(meta);
      this.sockets.set(ws, meta);
      await this.persist();
      this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
      this.send(ws, { t: "pf_welcome", playerId, ...publicFieldSnapshot(this.state, this.matchId) });
      this.broadcast(this.snapshot());
      return;
    }

    const meta = this.sockets.get(ws);
    if (!meta) { this.send(ws, { t: "pf_error", reason: "not_joined" }); return; }
    meta.lastHeartbeat = Date.now();

    if (data.t === "heartbeat") { this.send(ws, { t: "heartbeat_ack", at: Date.now() }); return; }
    if (data.t === "pf_snapshot_request") { this.send(ws, this.snapshot()); return; }

    if (data.t === "pf_input") {
      const r = applyFieldInput(this.state, meta.playerId, { dx: data.dx, dy: data.dy }, Date.now());
      if (!r.ok) { if (r.reason !== "too_fast") this.send(ws, { t: "pf_error", reason: r.reason }); return; }
      this.state = r.state;
      await this.persist();
      this.broadcast(this.snapshot());
      return;
    }

    if (data.t === "pf_scout") {
      const r = advanceScout(this.state, String(data.verb || ""));
      if (!r.ok) { this.send(ws, { t: "pf_error", reason: r.reason }); return; }
      this.state = r.state;
      await this.persist();
      this.broadcast({ t: "pf_scout_event", verb: String(data.verb), actor: meta.playerId, phase: this.state.scout.phase, at: Date.now() });
      this.broadcast(this.snapshot());
      return;
    }

    if (data.t === "pf_extract") {
      const r = extractPage(this.state, meta.playerId);
      if (!r.ok) { this.send(ws, { t: "pf_extract_result", ok: false, reason: r.reason }); return; }
      const secret = devSecret(this.env);
      if (!secret) { this.send(ws, { t: "pf_extract_result", ok: false, reason: "receipt_signing_unavailable" }); return; }
      this.state = r.state;
      const issued_at = Date.now();
      const unsigned = {
        version: "PF/1", match_id: this.matchId, receipt_id: `pf:${this.matchId}:${r.sequence}`,
        actor_id: meta.playerId, action: "extract", object_id: "PAGE-7", zone_id: "ARCHIVE",
        sequence: r.sequence, nonce: randomHex(), issued_at,
      };
      const signature = await signReceipt(secret, canonicalReceipt(unsigned));
      const receipt = { ...unsigned, signature };
      await this.persist();
      this.send(ws, { t: "pf_extract_result", ok: true, receipt });
      // The receipt is not secret. Broadcasting it lets the distinct Desk human accept
      // the field evidence into RUG. Replay protection + RUG membership still gate truth.
      this.broadcast({ t: "pf_field_receipt", receipt });
      this.broadcast(this.snapshot());
      return;
    }

    if (data.t === "pf_leave") {
      await this.drop(ws);
      try { ws.close(1000, "left"); } catch { /* noop */ }
      return;
    }
    this.send(ws, { t: "pf_error", reason: "unknown_type" });
  }

  async webSocketClose(ws: WebSocket): Promise<void> { await this.init(); await this.drop(ws); }
  async webSocketError(ws: WebSocket): Promise<void> { await this.init(); await this.drop(ws); }
  async alarm(): Promise<void> {
    await this.init();
    const now = Date.now();
    for (const [ws, meta] of [...this.sockets.entries()]) {
      if (now - meta.lastHeartbeat > STALE_MS) {
        try { ws.close(1001, "stale"); } catch { /* noop */ }
        await this.drop(ws);
      }
    }
    if (this.sockets.size) this.ctx.storage.setAlarm(Date.now() + SWEEP_MS);
  }
}
