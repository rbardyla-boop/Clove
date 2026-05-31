/**
 * Neon Arcade Mesh Worker — Phase 1b
 *
 * Entry point for the room authority WebSocket gateway.
 * Routes /arcade/ws connections to the ArcadeRoom Durable Object.
 *
 * This Worker is intentionally minimal. All authority logic lives inside the DO.
 */

import { ArcadeRoom } from "./arcade-room";

export interface Env {
  ARCADE_ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Only handle the WebSocket upgrade path for Phase 1b
    if (url.pathname === "/arcade/ws") {
      console.log("[Worker] Received WebSocket upgrade request for /arcade/ws");

      // Always route "main" room in Phase 1b.
      // Later phases can parse ?room=xxx or path segments.
      const roomId = "main";
      const id = env.ARCADE_ROOM.idFromName(roomId);
      const stub = env.ARCADE_ROOM.get(id);

      try {
        // Forward the upgrade request to the Durable Object
        const response = await stub.fetch(request);
        console.log("[Worker] DO responded with status:", response.status);
        return response;
      } catch (err) {
        console.error("[Worker] Error forwarding to DO:", err);
        return new Response("DO fetch failed", { status: 500 });
      }
    }

    // Simple health check / info for debugging
    if (url.pathname === "/arcade/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "neon-arcade-mesh",
          phase: "1b",
          room: "main",
          machine: "pulse",
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Neon Circuit Room Authority — Phase 1b only", {
      status: 404,
    });
  },
};

// Re-export the DO class so wrangler can discover it
export { ArcadeRoom } from "./arcade-room";
