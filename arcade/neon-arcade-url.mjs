/**
 * Neon Circuit — Worker endpoint resolution for the static (Pages) client.
 *
 * PURE + browser/node-portable (imported by neon-circuit-room-client.js in the
 * browser, and unit-tested in node). Keeps the deploy-time URL policy in one
 * place so there is exactly one documented way to point the Pages client at the
 * Worker. See arcade/neon-arcade-config.example.js for the config hook.
 */

/**
 * Resolve the Worker WebSocket URL. Precedence, first defined wins:
 *   1. explicit     — options.wsUrl (e.g. the ?ws= test override)
 *   2. config.wsUrl — window.__NEON_ARCADE_CONFIG__.wsUrl (deploy-time hook)
 *   3. same-origin  — wss://<page host>/arcade/ws (Worker routed on the Pages domain)
 * Returns null only when nothing is resolvable, so callers can fail loudly.
 */
export function resolveWsUrl({ explicit, config, location } = {}) {
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  const configured = config && typeof config.wsUrl === "string" ? config.wsUrl.trim() : "";
  if (configured) return configured;
  if (location && location.host) {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host}/arcade/ws`;
  }
  return null;
}

/** Read the optional deploy-time client config global, safely (null in node). */
export function neonArcadeConfig() {
  return (typeof globalThis !== "undefined" && globalThis.__NEON_ARCADE_CONFIG__) || null;
}
