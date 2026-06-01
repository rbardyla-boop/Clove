/**
 * RoomRegistry — Neon Circuit room coordinator (Durable Object, Phase 2b).
 *
 * With per-room DO sharding (one ArcadeRoom instance per room) no single room DO
 * can see the whole arcade's population. The RoomRegistry is a single coordinator
 * instance that:
 *   - aggregates per-room population (room DOs report join/leave deltas), and
 *   - owns admin status overrides (open / closed / maintenance) for the room
 *     lifecycle tooling, gated by the shared admin guard (dev flag + token).
 *
 * It is reached only DO-to-DO (room DOs report + fetch the room list + forward
 * admin ops) — never directly by a client. It holds NO private player data: only
 * counts + status. Admin ops mutate ONLY room status / a room's own state; there
 * is no money, no accounts, no auth provider.
 */
import { roomListPayload, isValidRoomId, isRoomStatus, isJoinableStatus, effectiveStatus } from "./rooms.mjs";
import { checkAdmin, adminEnabled, isAdminOp } from "./admin.mjs";

interface RegistryState {
  populations: Record<string, number>;
  statusOverrides: Record<string, string>;
}

interface Env {
  ARCADE_ROOM: DurableObjectNamespace;
  ROOM_REGISTRY: DurableObjectNamespace;
  ADMIN_ENABLED?: string;
  ADMIN_TOKEN?: string;
}

export class RoomRegistry implements DurableObject {
  private reg!: RegistryState;

  constructor(private readonly ctx: DurableObjectState, private readonly env: Env) {}

  private async init(): Promise<void> {
    if (this.reg) return;
    const stored = await this.ctx.storage.get<RegistryState>("registry");
    this.reg = stored || { populations: {}, statusOverrides: {} };
  }
  private async persist(): Promise<void> {
    await this.ctx.storage.put("registry", this.reg);
  }
  private json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  async fetch(request: Request): Promise<Response> {
    await this.init();
    const url = new URL(request.url);
    const path = url.pathname;

    // Room DO reports its live population for a room.
    if (path === "/registry/report" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const roomId = (body as any).roomId;
      const population = Math.max(0, Number((body as any).population) || 0);
      if (isValidRoomId(roomId)) { this.reg.populations[roomId] = population; await this.persist(); }
      return this.json({ ok: true });
    }

    // Aggregated, public-safe room list (populations + status overrides).
    if (path === "/registry/list") {
      return this.json(roomListPayload(this.reg.populations, this.reg.statusOverrides));
    }

    // Effective status of one room (room DO queries this to enforce joins).
    if (path === "/registry/status") {
      const roomId = url.searchParams.get("room") || "";
      return this.json({ roomId, status: effectiveStatus(roomId, this.reg.statusOverrides), joinable: isJoinableStatus(effectiveStatus(roomId, this.reg.statusOverrides)) });
    }

    // Gated admin op (forwarded by a room DO with the caller's token).
    if (path === "/registry/admin" && request.method === "POST") {
      const body: any = await request.json().catch(() => ({}));
      const gate = checkAdmin({ enabled: adminEnabled(this.env), token: this.env.ADMIN_TOKEN, providedToken: body.token });
      if (!gate.ok) return this.json({ ok: false, reason: gate.reason }, 403);
      const op = body.op;
      const roomId = body.roomId;
      if (!isAdminOp(op)) return this.json({ ok: false, reason: "unknown_op" });
      if (!isValidRoomId(roomId)) return this.json({ ok: false, reason: "invalid_room" });

      if (op === "set_status") {
        if (!isRoomStatus(body.status)) return this.json({ ok: false, reason: "invalid_status" });
        this.reg.statusOverrides[roomId] = body.status;
        await this.persist();
        // No push needed: room DOs read the effective status from the registry on
        // each join, so a `closed`/`maintenance` status rejects the very next join.
        return this.json({ ok: true, op, roomId, status: body.status });
      }
      if (op === "reset") {
        // Forward the wipe to the target room DO; status is preserved.
        const res = await this.callRoom(roomId, "/admin/reset", {});
        // A reset room with no occupants reports 0; reflect that immediately.
        this.reg.populations[roomId] = Math.max(0, Number((res as any)?.population) || this.reg.populations[roomId] || 0);
        await this.persist();
        return this.json({ ok: true, op, roomId });
      }
      return this.json({ ok: false, reason: "unknown_op" });
    }

    return new Response("Not found", { status: 404 });
  }

  private async callRoom(roomId: string, path: string, body: unknown): Promise<unknown> {
    const id = this.env.ARCADE_ROOM.idFromName(roomId);
    const stub = this.env.ARCADE_ROOM.get(id);
    try {
      const res = await stub.fetch(`https://do${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      return await res.json().catch(() => ({}));
    } catch {
      return {};
    }
  }
}
