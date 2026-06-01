/**
 * Neon Arcade Mesh Worker — Phase 2b (per-room DO sharding + registry coordinator)
 *
 * Routes /arcade/ws?room=<id> to a PER-ROOM ArcadeRoom Durable Object instance
 * (idFromName(roomId)) — each room is its own DO, so rooms scale and stay isolated
 * by construction. A single RoomRegistry DO coordinates cross-room population +
 * admin status; room DOs talk to it DO-to-DO (clients never reach it directly).
 *
 * An explicit invalid room id falls back to the default room DO, where the join is
 * rejected (room_join_rejected: invalid_room). No `?room=` → main-floor.
 *
 * All authority logic lives inside the DOs.
 */

import { ArcadeRoom } from "./arcade-room";
import { RoomRegistry } from "./room-registry";
import { resolveRoomId, ROOM_IDS } from "./rooms.mjs";

export interface Env {
  ARCADE_ROOM: DurableObjectNamespace;
  ROOM_REGISTRY: DurableObjectNamespace;
  ADMIN_ENABLED?: string;
  ADMIN_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/arcade/ws") {
      // Resolve the (untrusted) room and shard to its own DO instance. An invalid
      // explicit room routes to the default DO, which rejects the join.
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

    // Public-safe room list over HTTP (the registry coordinator is the authority).
    if (url.pathname === "/arcade/rooms") {
      const reg = env.ROOM_REGISTRY.get(env.ROOM_REGISTRY.idFromName("registry"));
      try {
        return await reg.fetch("https://reg/registry/list");
      } catch {
        return new Response(JSON.stringify({ rooms: [] }), { headers: { "Content-Type": "application/json" } });
      }
    }

    if (url.pathname === "/arcade/health") {
      return new Response(
        JSON.stringify({ ok: true, service: "neon-arcade-mesh", phase: "2b", rooms: ROOM_IDS, sharded: true }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Neon Circuit Arcade — Room Authority", { status: 404 });
  },
};

// Re-export the DO classes so wrangler can discover them.
export { ArcadeRoom } from "./arcade-room";
export { RoomRegistry } from "./room-registry";
