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
  PAPER_FIRM_FIELD_SECRET?: string;
  // Compatibility with the first local prototype configuration.
  PAPER_FIRM_RECEIPT_SECRET?: string;
  ENVIRONMENT?: string;
}

type FieldState = ReturnType<typeof createFieldState>;
type JoinRole = "lead" | "hand" | "observer";
type SocketMeta = { playerId: string; role: JoinRole; matchId: string; lastHeartbeat: number };
type PendingAttachment = { authorizedPlayerId: string; role: JoinRole; matchId: string; expiresAt: number; connectedAt: number };
type ReceiptAck = { version: "PF-ACK/1"; match_id: string; receipt_id: string; actor_id: string; accepted_at: number; signature: string };
type PositionCheckpointMap = Record<string, number>;

const STALE_MS = 45_000;
const SWEEP_MS = 30_000;
const POSITION_CHECKPOINT_MS = 1_000;

function timestamp(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validJoinRole(value: unknown): value is JoinRole {
  return value === "lead" || value === "hand" || value === "observer";
}

function devSecret(env: PaperFirmEnv): string {
  if (env.PAPER_FIRM_FIELD_SECRET) return env.PAPER_FIRM_FIELD_SECRET;
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

function bytesFromHex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const bytes = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function verifyJoinTicket(secret: string, ticket: string, matchId: string): Promise<{ actorId: string; role: JoinRole; expiresAt: number } | null> {
  if (!secret || !ticket) return null;
  const [encoded, signature] = ticket.split(".");
  if (!encoded || !signature || !/^[0-9a-f]{64}$/i.test(signature)) return null;
  let material = "";
  try { material = decodeBase64Url(encoded); } catch { return null; }
  const [version, ticketMatch, actorId, role, expiresRaw] = material.split("\n");
  const expiresAt = Number(expiresRaw);
  if (version !== "PF-JOIN/2" || ticketMatch !== matchId || !validPlayerId(actorId) || !validJoinRole(role) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, bytesFromHex(signature), new TextEncoder().encode(material));
  return valid ? { actorId, role: role as JoinRole, expiresAt } : null;
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
  scout_find_sequence: number;
  scout_find_at: number;
  scout_carry_sequence: number;
  scout_carry_at: number;
}) {
  // Joint PF/1 field-receipt extension: RUG verifies these four field-authored
  // facts before projecting Scout participation; intake must not synthesize them.
  return [input.version, input.match_id, input.receipt_id, input.actor_id, input.action, input.object_id, input.zone_id, String(input.sequence), input.nonce, String(input.issued_at), String(input.scout_find_sequence), String(input.scout_find_at), String(input.scout_carry_sequence), String(input.scout_carry_at)].join("\n");
}

async function signReceipt(secret: string, material: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(material)));
}

async function verifyReceiptAck(secret: string, ack: unknown, matchId: string, receiptId: string, actorId: string): Promise<boolean> {
  if (!secret || !ack || typeof ack !== "object" || Array.isArray(ack)) return false;
  const a = ack as Partial<ReceiptAck>;
  if (a.version !== "PF-ACK/1" || a.match_id !== matchId || a.receipt_id !== receiptId || a.actor_id !== actorId || !Number.isSafeInteger(a.accepted_at) || !a.signature || !/^[0-9a-f]{64}$/i.test(a.signature)) return false;
  if (a.accepted_at! > Date.now() + 60_000) return false;
  const material = [a.version, a.match_id, a.receipt_id, a.actor_id, String(a.accepted_at)].join("\n");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  return crypto.subtle.verify("HMAC", key, bytesFromHex(a.signature), new TextEncoder().encode(material));
}

export class PaperFirmRoom implements DurableObject {
  private state!: FieldState;
  private sockets = new Map<WebSocket, SocketMeta>();
  private pending = new Map<WebSocket, PendingAttachment>();
  private lastPositionPersistAt = new Map<string, number>();
  private dirtyPositions = new Set<string>();
  private nextAlarmAt = 0;
  private matchId = "FIRSTSHIFT";

  constructor(private readonly ctx: DurableObjectState, private readonly env: PaperFirmEnv) {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      let att: Partial<SocketMeta & PendingAttachment> | null = null;
      try { att = ws.deserializeAttachment() as Partial<SocketMeta & PendingAttachment> | null; } catch { /* closed/unreadable socket */ }
      if (att?.playerId && validJoinRole(att.role) && att.matchId) {
        const meta: SocketMeta = {
          playerId: att.playerId,
          role: att.role,
          matchId: att.matchId,
          lastHeartbeat: timestamp(att.lastHeartbeat, timestamp(att.connectedAt, now)),
        };
        this.sockets.set(ws, meta);
        ws.serializeAttachment(meta);
        this.matchId = att.matchId;
      } else if (att?.authorizedPlayerId && validJoinRole(att.role) && att.matchId && Number.isSafeInteger(Number(att.expiresAt)) && Number(att.expiresAt) > now) {
        const pending: PendingAttachment = {
          authorizedPlayerId: att.authorizedPlayerId,
          role: att.role,
          matchId: att.matchId,
          expiresAt: Number(att.expiresAt),
          connectedAt: timestamp(att.connectedAt, now),
        };
        this.pending.set(ws, pending);
        ws.serializeAttachment(pending);
        this.matchId = att.matchId;
      } else if (att?.authorizedPlayerId) {
        try { ws.close(1008, "admission_expired"); } catch { /* closed */ }
      }
    }
    if (this.sockets.size || this.pending.size) this.scheduleMaintenance(now);
  }

  private async init() {
    if (this.state) return;
    await this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<FieldState>("pfState");
      this.state = stored && stored.players ? stored : createFieldState();
      const storedCheckpoints = await this.ctx.storage.get<PositionCheckpointMap>("pfPositionCheckpoints");
      if (storedCheckpoints && typeof storedCheckpoints === "object") {
        for (const [playerId, at] of Object.entries(storedCheckpoints)) {
          if (Number.isSafeInteger(at) && at > 0) this.lastPositionPersistAt.set(playerId, at);
        }
      }
      for (const [playerId, player] of Object.entries(this.state.players)) {
        if (!this.lastPositionPersistAt.has(playerId)) this.lastPositionPersistAt.set(playerId, timestamp((player as any).lastInputAt, Date.now()));
      }
    });
  }
  private async persist(now = Date.now()) {
    for (const playerId of Object.keys(this.state.players)) this.lastPositionPersistAt.set(playerId, now);
    this.dirtyPositions.clear();
    await this.ctx.storage.put("pfState", this.state);
    await this.ctx.storage.put("pfPositionCheckpoints", Object.fromEntries(this.lastPositionPersistAt));
  }
  private async flushDirtyPositions(now = Date.now()) {
    if (this.dirtyPositions.size) await this.persist(now);
  }
  private positionCheckpointDue(now: number): boolean {
    return [...this.dirtyPositions].some((playerId) => now - (this.lastPositionPersistAt.get(playerId) || 0) >= POSITION_CHECKPOINT_MS);
  }
  private scheduleMaintenance(now = Date.now()) {
    let at = now + SWEEP_MS;
    for (const pending of this.pending.values()) at = Math.min(at, pending.expiresAt);
    for (const meta of this.sockets.values()) at = Math.min(at, meta.lastHeartbeat + STALE_MS);
    for (const playerId of this.dirtyPositions) at = Math.min(at, (this.lastPositionPersistAt.get(playerId) || now) + POSITION_CHECKPOINT_MS);
    if (!this.nextAlarmAt || at < this.nextAlarmAt) {
      this.nextAlarmAt = at;
      this.ctx.storage.setAlarm(at);
    }
  }
  private send(ws: WebSocket, data: unknown) { try { ws.send(JSON.stringify(data)); } catch { /* closed */ } }
  private broadcast(data: unknown) {
    const text = JSON.stringify(data);
    for (const ws of this.sockets.keys()) try { ws.send(text); } catch { /* closed */ }
  }
  private snapshot() { return { t: "pf_snapshot", ...publicFieldSnapshot(this.state, this.matchId) }; }
  private async drop(ws: WebSocket) {
    if (this.pending.delete(ws)) { this.scheduleMaintenance(); return; }
    const meta = this.sockets.get(ws);
    if (!meta) return;
    this.sockets.delete(ws);
    const hasAnotherSocket = [...this.sockets.values()].some((other) => other.playerId === meta.playerId);
    if (!hasAnotherSocket) {
      this.state = removeFieldPlayer(this.state, meta.playerId);
      await this.persist();
      this.broadcast(this.snapshot());
    }
    this.scheduleMaintenance();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/arcade/paper-firm/ws") return new Response("Not found", { status: 404 });
    const match = sanitizeMatchId(url.searchParams.get("match"));
    if (!match) return new Response("Invalid match", { status: 400 });
    const admission = await verifyJoinTicket(devSecret(this.env), url.searchParams.get("ticket") || "", match);
    if (!admission) return new Response("Field admission ticket required", { status: 401 });
    this.matchId = match;
    await this.init();
    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server, ["paper-firm"]);
    const pending: PendingAttachment = { authorizedPlayerId: admission.actorId, role: admission.role, matchId: match, expiresAt: admission.expiresAt, connectedAt: Date.now() };
    this.pending.set(server, pending);
    server.serializeAttachment(pending);
    this.scheduleMaintenance();
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
      const pending = this.pending.get(ws) || (ws.deserializeAttachment() as PendingAttachment | null);
      const now = Date.now();
      if (!pending?.authorizedPlayerId) {
        this.send(ws, { t: "pf_error", reason: "principal_ticket_mismatch" });
        return;
      }
      if (!validJoinRole(pending.role) || pending.expiresAt <= now) {
        this.pending.delete(ws);
        this.send(ws, { t: "pf_error", reason: "admission_expired" });
        try { ws.close(1008, "admission_expired"); } catch { /* closed */ }
        this.scheduleMaintenance(now);
        return;
      }
      if (pending.authorizedPlayerId !== playerId || pending.matchId !== this.matchId) {
        this.send(ws, { t: "pf_error", reason: "principal_ticket_mismatch" });
        return;
      }
      this.pending.delete(ws);
      for (const [other, otherMeta] of this.sockets) {
        if (otherMeta.playerId === playerId && other !== ws) {
          this.sockets.delete(other);
          try { other.close(4001, "replaced"); } catch { /* noop */ }
        }
      }
      const r = addFieldPlayer(this.state, playerId, now);
      if (!r.ok) { this.send(ws, { t: "pf_error", reason: r.reason }); return; }
      this.state = r.state;
      const meta: SocketMeta = { playerId, role: pending.role, matchId: this.matchId, lastHeartbeat: now };
      ws.serializeAttachment(meta);
      this.sockets.set(ws, meta);
      await this.persist(now);
      this.scheduleMaintenance(now);
      this.send(ws, { t: "pf_welcome", playerId, ...publicFieldSnapshot(this.state, this.matchId) });
      this.broadcast(this.snapshot());
      return;
    }

    const meta = this.sockets.get(ws);
    if (!meta) { this.send(ws, { t: "pf_error", reason: "not_joined" }); return; }
    const now = Date.now();
    meta.lastHeartbeat = now;
    ws.serializeAttachment(meta);

    if (data.t === "heartbeat") { this.send(ws, { t: "heartbeat_ack", at: now }); this.scheduleMaintenance(now); return; }
    if (data.t === "pf_snapshot_request") { this.send(ws, this.snapshot()); return; }

    if (data.t === "pf_input") {
      const r = applyFieldInput(this.state, meta.playerId, { dx: data.dx, dy: data.dy }, now);
      if (!r.ok) { if (r.reason !== "too_fast") this.send(ws, { t: "pf_error", reason: r.reason }); return; }
      this.state = r.state;
      this.dirtyPositions.add(meta.playerId);
      if (r.bumped) this.send(ws, { t: "pf_bump", at: now });
      const lastPersist = this.lastPositionPersistAt.get(meta.playerId) || 0;
      if (now - lastPersist >= POSITION_CHECKPOINT_MS) {
        await this.persist();
      }
      this.scheduleMaintenance(now);
      this.broadcast(this.snapshot());
      return;
    }

    if (data.t === "pf_scout") {
      await this.flushDirtyPositions(now);
      const r = advanceScout(this.state, String(data.verb || ""), { playerId: meta.playerId, role: meta.role }, now);
      if (!r.ok) { this.send(ws, { t: "pf_error", reason: r.reason }); return; }
      this.state = r.state;
      await this.persist(now);
      this.broadcast({ t: "pf_scout_event", verb: String(data.verb), actor: meta.playerId, phase: this.state.scout.phase, at: Date.now() });
      this.broadcast(this.snapshot());
      return;
    }

    if (data.t === "pf_extract") {
      if (meta.role !== "lead") { this.send(ws, { t: "pf_extract_result", ok: false, reason: "field_lead_required" }); return; }
      await this.flushDirtyPositions(now);
      const r = extractPage(this.state, meta.playerId);
      if (!r.ok) { this.send(ws, { t: "pf_extract_result", ok: false, reason: r.reason }); return; }
      const secret = devSecret(this.env);
      if (!secret) { this.send(ws, { t: "pf_extract_result", ok: false, reason: "receipt_signing_unavailable" }); return; }
      this.state = r.state;
      const issued_at = now;
      const unsigned = {
        version: "PF/1", match_id: this.matchId, receipt_id: `pf:${this.matchId}:${r.sequence}`,
        actor_id: meta.playerId, action: "extract", object_id: "PAGE-7", zone_id: "ARCHIVE",
        sequence: r.sequence, nonce: randomHex(), issued_at,
        // Field-authoritative Scout participation is signed into the extraction
        // receipt; RUG validates and projects these facts before OBS intake.
        scout_find_sequence: this.state.scout.findSequence,
        scout_find_at: this.state.scout.findAt,
        scout_carry_sequence: this.state.scout.carrySequence,
        scout_carry_at: this.state.scout.carryAt,
      };
      const signature = await signReceipt(secret, canonicalReceipt(unsigned));
      const receipt = { ...unsigned, signature };
      this.state = { ...this.state, page: { ...this.state.page, pendingReceipt: receipt } };
      await this.persist(now);
      this.send(ws, { t: "pf_extract_result", ok: true, receipt });
      // The receipt is not secret. Broadcasting it lets the distinct Desk human accept
      // the field evidence into RUG. Replay protection + RUG membership still gate truth.
      this.broadcast({ t: "pf_field_receipt", receipt });
      this.broadcast(this.snapshot());
      return;
    }

    if (data.t === "pf_receipt_ack") {
      await this.flushDirtyPositions(now);
      const pendingReceipt = this.state.page.pendingReceipt;
      const receiptId = String(data.ack?.receipt_id || data.receipt_id || "");
      if (!receiptId || !pendingReceipt || pendingReceipt.receipt_id !== receiptId || !await verifyReceiptAck(devSecret(this.env), data.ack, this.matchId, receiptId, pendingReceipt.actor_id)) {
        this.send(ws, { t: "pf_receipt_ack_result", ok: false, reason: "receipt_not_pending" });
        return;
      }
      this.state = { ...this.state, page: { ...this.state.page, pendingReceipt: null } };
      await this.persist(now);
      this.broadcast({ t: "pf_receipt_ack_result", ok: true, receipt_id: receiptId });
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
    this.nextAlarmAt = 0;
    await this.init();
    const now = Date.now();
    if (this.positionCheckpointDue(now)) await this.persist(now);
    for (const [ws, pending] of [...this.pending.entries()]) {
      if (pending.expiresAt <= now) {
        this.pending.delete(ws);
        try { ws.close(1008, "admission_expired"); } catch { /* noop */ }
      }
    }
    for (const [ws, meta] of [...this.sockets.entries()]) {
      if (now - meta.lastHeartbeat > STALE_MS) {
        try { ws.close(1001, "stale"); } catch { /* noop */ }
        await this.drop(ws);
      }
    }
    if (this.sockets.size || this.pending.size || this.dirtyPositions.size) this.scheduleMaintenance(now);
  }
}
