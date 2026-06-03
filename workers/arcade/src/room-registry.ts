/**
 * RoomRegistry — Neon Circuit room coordinator (Durable Object, Phase 2b → 2c).
 *
 * With per-room DO sharding (one ArcadeRoom instance per room) no single room DO
 * can see the whole arcade's population. The RoomRegistry is a single coordinator
 * instance that:
 *   - stores the latest HEARTBEAT per room (room DOs report on join/leave/reset and
 *     on a ~30s alarm tick), so it can aggregate population AND detect staleness, and
 *   - owns admin status overrides (open / closed / maintenance) for the room
 *     lifecycle tooling, gated by the shared admin guard (dev flag + token).
 *
 * Phase 2c adds room HEALTH: each stored heartbeat is stamped with a registry-side
 * `last_seen_at`, and the public room list derives healthy/stale/offline/unknown +
 * a stale-population eviction policy from that freshness (see rooms.mjs). It is
 * reached only DO-to-DO (room DOs report + fetch the list/health + forward admin
 * ops) — never directly by a client. It holds NO private player data: only counts,
 * status, and heartbeat metadata.
 */
import {
  roomPresenceListPayload, isValidRoomId, isRoomStatus,
  isJoinableStatus, effectiveStatus, roomDiagnosticsList,
  HEARTBEAT_SCHEMA_VERSION,
} from "./rooms.mjs";
import { attachRoomEvents } from "./room-events.mjs";
import { checkAdmin, adminEnabled, isAdminOp } from "./admin.mjs";

/** Latest heartbeat stored for a room (registry stamps `last_seen_at` on receipt). */
interface Heartbeat {
  roomId: string;
  schema_version: number;
  generation: number;
  population: number;
  capacity: number;
  status: string;
  last_activity_at: number;
  reported_at: number;
  active_connections: number;
  active_rounds: number;
  occupied_cabinets: number;
  last_seen_at: number; // registry receive-clock — the authoritative freshness timestamp
}

interface RegistryState {
  heartbeats: Record<string, Heartbeat>;
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
    const stored = await this.ctx.storage.get<any>("registry");
    if (stored && stored.heartbeats) {
      this.reg = { heartbeats: stored.heartbeats, statusOverrides: stored.statusOverrides || {} };
    } else if (stored && stored.populations) {
      // Migrate a Phase 2b store (bare populations) into heartbeats. Seed them as
      // already-stale (last_seen_at = 0) so we never show ghost population from a
      // pre-2c deploy — each room refreshes to healthy on its next heartbeat.
      const heartbeats: Record<string, Heartbeat> = {};
      for (const [roomId, population] of Object.entries(stored.populations)) {
        if (!isValidRoomId(roomId)) continue;
        heartbeats[roomId] = this.seedHeartbeat(roomId, Math.max(0, Number(population) || 0));
      }
      this.reg = { heartbeats, statusOverrides: stored.statusOverrides || {} };
    } else {
      this.reg = { heartbeats: {}, statusOverrides: {} };
    }
  }
  private seedHeartbeat(roomId: string, population: number): Heartbeat {
    return {
      roomId, schema_version: HEARTBEAT_SCHEMA_VERSION, generation: 0, population, capacity: 0,
      status: "open", last_activity_at: 0, reported_at: 0, active_connections: 0,
      active_rounds: 0, occupied_cabinets: 0, last_seen_at: 0,
    };
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

    // Room DO reports a full heartbeat for its room (Phase 2c). The registry stamps
    // its own receive-clock as the authoritative freshness timestamp.
    if (path === "/registry/report" && request.method === "POST") {
      const body: any = await request.json().catch(() => ({}));
      const roomId = body.roomId;
      if (!isValidRoomId(roomId)) return this.json({ ok: false, reason: "invalid_room" });
      if (Number(body.schema_version) !== HEARTBEAT_SCHEMA_VERSION) return this.json({ ok: false, reason: "bad_schema" });
      const now = Date.now();
      this.reg.heartbeats[roomId] = {
        roomId,
        schema_version: HEARTBEAT_SCHEMA_VERSION,
        generation: Math.max(0, Number(body.generation) || 0),
        population: Math.max(0, Number(body.population) || 0),
        capacity: Math.max(0, Number(body.capacity) || 0),
        status: isRoomStatus(body.status) ? body.status : "open",
        last_activity_at: Number(body.last_activity_at) || 0,
        reported_at: Number(body.reported_at) || now,
        active_connections: Math.max(0, Number(body.active_connections) || 0),
        active_rounds: Math.max(0, Number(body.active_rounds) || 0),
        occupied_cabinets: Math.max(0, Number(body.occupied_cabinets) || 0),
        last_seen_at: now,
      };
      await this.persist();
      return this.json({ ok: true });
    }

    // Aggregated, public-safe room list with health + freshness (Phase 2c) +
    // deterministic per-room scheduled events (Phase 2e). Events are display-only
    // and carry no economy/private data (see room-events.mjs).
    if (path === "/registry/list") {
      const now = Date.now();
      return this.json(attachRoomEvents(roomPresenceListPayload(this.reg.heartbeats, this.reg.statusOverrides, now), now));
    }

    // Public-safe registry health envelope (Phase 2c health schema, additively
    // carrying Phase 2e per-room events). `phase` marks the health-envelope schema
    // (unchanged); `event_ruleset_version` marks the additive event layer.
    if (path === "/registry/health") {
      const now = Date.now();
      const list = attachRoomEvents(roomPresenceListPayload(this.reg.heartbeats, this.reg.statusOverrides, now), now);
      return this.json({ ok: true, service: "neon-arcade-room-registry", phase: "2c", schema_version: HEARTBEAT_SCHEMA_VERSION, event_ruleset_version: list.event_ruleset_version, rooms: list.rooms });
    }

    // Effective status of one room (room DO queries this to enforce joins).
    if (path === "/registry/status") {
      const roomId = url.searchParams.get("room") || "";
      const status = effectiveStatus(roomId, this.reg.statusOverrides);
      return this.json({ roomId, status, joinable: isJoinableStatus(status) });
    }

    // Gated admin op (forwarded by a room DO with the caller's token).
    if (path === "/registry/admin" && request.method === "POST") {
      const body: any = await request.json().catch(() => ({}));
      const gate = checkAdmin({ enabled: adminEnabled(this.env), token: this.env.ADMIN_TOKEN, providedToken: body.token });
      if (!gate.ok) return this.json({ ok: false, reason: gate.reason }, 403);
      const op = body.op;
      if (!isAdminOp(op)) return this.json({ ok: false, reason: "unknown_op" });

      // Diagnostics is a registry-wide read; it does not target a single room.
      if (op === "diagnostics") {
        return this.json({ ok: true, op, diagnostics: roomDiagnosticsList(this.reg.heartbeats, this.reg.statusOverrides, Date.now()) });
      }

      const roomId = body.roomId;
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
        // Forward the wipe to the target room DO; it returns a fresh heartbeat.
        const res: any = await this.callRoom(roomId, "/admin/reset", {});
        if (res && res.heartbeat && isValidRoomId(res.heartbeat.roomId)) {
          this.reg.heartbeats[roomId] = { ...res.heartbeat, last_seen_at: Date.now() };
          await this.persist();
        }
        return this.json({ ok: true, op, roomId, generation: res?.heartbeat?.generation });
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
