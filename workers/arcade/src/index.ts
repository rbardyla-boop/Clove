/**
 * Neon Arcade Mesh Worker — Phase 2c (room presence health + per-room sharding)
 *
 * Routes /arcade/ws?room=<id> to a PER-ROOM ArcadeRoom Durable Object instance
 * (idFromName(roomId)) — each room is its own DO, so rooms scale and stay isolated
 * by construction. A single RoomRegistry DO coordinates cross-room population,
 * per-room HEALTH/heartbeat freshness, and admin status; room DOs talk to it
 * DO-to-DO (clients never reach it directly). Health surfaces over HTTP at
 * /arcade/rooms/health.
 *
 * Paper Firm adds an isolated FIELD authority at /arcade/paper-firm/ws?match=<id>.
 * It owns only movement/presence/scout carry/extraction receipts. RUG remains the
 * sole organizational authority.
 *
 * All authority logic lives inside the DOs.
 */

import { ArcadeRoom } from "./arcade-room";
import { RoomRegistry } from "./room-registry";
import { CityRoom } from "./city-room";
import { CityRegistry } from "./city-registry";
import { PaperFirmRoom } from "./paper-firm-room";
import { resolveRoomId, ROOM_IDS } from "./rooms.mjs";
import { resolveCityRoomId } from "../../../arcade/city/city-block.mjs";
import { sanitizeMatchId } from "../../../arcade/paper-firm/field-core.mjs";

export interface Env {
  ARCADE_ROOM: DurableObjectNamespace;
  ROOM_REGISTRY: DurableObjectNamespace;
  CITY_ROOM: DurableObjectNamespace;
  CITY_REGISTRY: DurableObjectNamespace;
  PAPER_FIRM_ROOM: DurableObjectNamespace;
  PAPER_FIRM_RECEIPT_SECRET?: string;
  ENVIRONMENT?: string;
  ADMIN_ENABLED?: string;
  ADMIN_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    void ctx;
    const url = new URL(request.url);

    if (url.pathname === "/arcade/ws") {
      const hint = resolveRoomId(url.searchParams.get("room"));
      const id = env.ARCADE_ROOM.idFromName(hint.roomId);
      const stub = env.ARCADE_ROOM.get(id);
      try {
        return await stub.fetch(request);
      } catch (err) {
        console.error("[Worker] Error forwarding to room DO:", err);
        return new Response("DO fetch failed", { status: 500 });
      }
    }

    if (url.pathname === "/arcade/city/ws") {
      const hint = resolveCityRoomId(url.searchParams.get("city"));
      const id = env.CITY_ROOM.idFromName(hint.cityId);
      const stub = env.CITY_ROOM.get(id);
      try {
        return await stub.fetch(request);
      } catch (err) {
        console.error("[Worker] Error forwarding to city DO:", err);
        return new Response("City DO fetch failed", { status: 500 });
      }
    }

    if (url.pathname === "/arcade/paper-firm/ws") {
      const match = sanitizeMatchId(url.searchParams.get("match"));
      if (!match) return new Response("Invalid Paper Firm match", { status: 400 });
      const id = env.PAPER_FIRM_ROOM.idFromName(match);
      const stub = env.PAPER_FIRM_ROOM.get(id);
      try {
        return await stub.fetch(request);
      } catch (err) {
        console.error("[Worker] Error forwarding to Paper Firm DO:", err);
        return new Response("Paper Firm DO fetch failed", { status: 500 });
      }
    }

    if (url.pathname === "/arcade/rooms") {
      const reg = env.ROOM_REGISTRY.get(env.ROOM_REGISTRY.idFromName("registry"));
      try {
        return await reg.fetch("https://reg/registry/list");
      } catch {
        return new Response(JSON.stringify({ rooms: [] }), { headers: { "Content-Type": "application/json" } });
      }
    }

    if (url.pathname === "/arcade/rooms/health") {
      const reg = env.ROOM_REGISTRY.get(env.ROOM_REGISTRY.idFromName("registry"));
      try {
        return await reg.fetch("https://reg/registry/health");
      } catch {
        return new Response(JSON.stringify({ ok: false, service: "neon-arcade-room-registry", phase: "2c", rooms: [] }), { headers: { "Content-Type": "application/json" } });
      }
    }

    if (url.pathname === "/arcade/health") {
      return new Response(
        JSON.stringify({ ok: true, service: "neon-arcade-mesh", phase: "paper-firm-first-shift", rooms: ROOM_IDS, sharded: true, paperFirm: true }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Neon Circuit Arcade — Room Authority", { status: 404 });
  },
};

export { ArcadeRoom } from "./arcade-room";
export { RoomRegistry } from "./room-registry";
export { CityRoom } from "./city-room";
export { CityRegistry } from "./city-registry";
export { PaperFirmRoom } from "./paper-firm-room";
