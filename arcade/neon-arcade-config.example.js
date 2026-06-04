/**
 * Neon Circuit — static client deploy-time configuration (EXAMPLE).
 *
 * The Pages-served arcade client (neon-circuit-floor.js → NeonCircuitRoomClient)
 * needs to know the Worker WebSocket URL. Resolution precedence is:
 *
 *   1. ?ws=…                              (test-only query override; see below)
 *   2. window.__NEON_ARCADE_CONFIG__.wsUrl  (THIS hook — set it at deploy time)
 *   3. wss://<the page's own host>/arcade/ws (same-origin fallback)
 *
 * You only need this hook when the Worker is on a DIFFERENT origin than the Pages
 * site (e.g. the Pages site is arcade.example.com and the Worker is
 * neon-arcade-mesh.<subdomain>.workers.dev). If you route the Worker on the SAME
 * custom domain at /arcade/*, the same-origin fallback already works — no config.
 *
 * To use it, pick ONE:
 *
 *   A. Inline in index.html, BEFORE the module script, no extra request:
 *        <script>window.__NEON_ARCADE_CONFIG__ = { wsUrl: "wss://…/arcade/ws" };</script>
 *
 *   B. Copy this file to arcade/neon-arcade-config.js, edit the URL, and load it
 *      with <script src="./neon-arcade-config.js"></script> before the module.
 *
 *   C. Inject it from your Pages build / environment.
 *
 * SECURITY: this is a PUBLIC, display/transport config only. Never put an admin
 * token, secret, or any credential here — it ships to every browser.
 */
window.__NEON_ARCADE_CONFIG__ = {
  // The Worker WebSocket endpoint. Use wss:// in production (https pages require it).
  wsUrl: "wss://neon-arcade-mesh.YOUR-SUBDOMAIN.workers.dev/arcade/ws",
};
