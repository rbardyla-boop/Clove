/**
 * Neon Arcade Mesh Worker — Phase 2a (Multi-Room Arcade Lobby)
 *
 * Entry point for the arcade authority WebSocket gateway. Routes /arcade/ws
 * connections to the single ArcadeRoom Durable Object, which hosts MULTIPLE rooms
 * as isolated state namespaces. A client connects with `?room=<id>` (informational)
 * and selects its room through the lobby join protocol; the DO is the authority for
 * room validation + binding (see arcade-room.ts handleJoin). One shared DO keeps
 * cross-room population aggregation + room isolation simple for the configured room
 * set; per-room DO sharding is a future scaling step.
 *
 * This Worker is intentionally minimal. All authority logic lives inside the DO.
 */

import { ArcadeRoom } from "./arcade-room";
import { resolveRoomId, ROOM_IDS } from "./rooms.mjs";

export interface Env {
  ARCADE_ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/arcade/ws") {
      // Resolve the (optional, untrusted) room hint for defense-in-depth + logging.
      // The DO is the authority for binding; an explicit invalid room is rejected
      // there with room_join_rejected. All rooms share one DO instance ("arcade").
      const hint = resolveRoomId(url.searchParams.get("room"));
      console.log(`[Worker] WS upgrade /arcade/ws (room hint: ${hint.roomId}${hint.fallback ? " — fell back from invalid" : ""})`);
      const id = env.ARCADE_ROOM.idFromName("arcade");
      const stub = env.ARCADE_ROOM.get(id);
      try {
        return await stub.fetch(request);
      } catch (err) {
        console.error("[Worker] Error forwarding to DO:", err);
        return new Response("DO fetch failed", { status: 500 });
      }
    }

    if (url.pathname === "/arcade/health") {
      return new Response(
        JSON.stringify({ ok: true, service: "neon-arcade-mesh", phase: "2a", rooms: ROOM_IDS }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Neon Circuit Arcade — Room Authority", { status: 404 });
  },
};

// Re-export the DO class so wrangler can discover it
export { ArcadeRoom } from "./arcade-room";
