/**
 * Admin gating — PURE, runtime-agnostic (Phase 2b → 2c).
 *
 * Room lifecycle ops (reset a room's state, set a room's status, read room
 * diagnostics) are operational tools, NOT a product auth system. There are NO
 * accounts and NO auth provider.
 * An op is allowed ONLY when BOTH guards pass (defense in depth):
 *
 *   1. a dev/admin flag is enabled server-side (env.ADMIN_ENABLED === 'true'), AND
 *   2. the caller presents an admin token that matches a server-side secret
 *      (env.ADMIN_TOKEN, supplied via `wrangler secret put ADMIN_TOKEN` in prod or
 *      a process env var in dev — NEVER committed to the repo).
 *
 * If the token secret is unset, admin is OFF regardless of the flag. So a default
 * deploy has NO admin surface until an operator explicitly configures the secret.
 */

export const ADMIN_OPS = Object.freeze([
  'reset', 'set_status', 'diagnostics',
  // Phase 2i: live ops surface for per-room, DISPLAY-ONLY presentation overrides. These
  // change ONLY how events are presented (pre-roll lead, countdown refresh, show flags) —
  // never tickets, prizes, rewards, authority, or economy. All both-gated like every op.
  'set_presentation', 'clear_presentation', 'preview_presentation', 'presentation_diagnostics',
]);
export function isAdminOp(op) { return ADMIN_OPS.includes(op); }

/**
 * Constant-time string comparison — PURE JS, no runtime crypto API.
 * Early length check (length leakage is acceptable and standard), then
 * XOR-accumulate over equal-length strings so the compare time does not
 * depend on where the first mismatching char is.
 */
function safeStrEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns { ok, reason }. `enabled` is the dev/admin flag, `token` is the
 * server-side secret (may be undefined), `providedToken` is the caller's token.
 */
export function checkAdmin({ enabled, token, providedToken }) {
  if (enabled !== true) return { ok: false, reason: 'admin_disabled' };
  if (typeof token !== 'string' || token.length === 0) return { ok: false, reason: 'admin_not_configured' };
  if (typeof providedToken !== 'string' || providedToken.length === 0) return { ok: false, reason: 'missing_admin_token' };
  // Constant-time compare as cheap defense-in-depth. Timing-safety is not strictly
  // required here (single-process testbed/edge context; the token is an operational
  // secret, not a user credential), but the constant-time path is free and avoids
  // leaking match progress via early-exit equality.
  if (!safeStrEqual(providedToken, token)) return { ok: false, reason: 'bad_admin_token' };
  return { ok: true, reason: null };
}

/** Resolve the dev/admin flag from an env-like object. */
export function adminEnabled(env) {
  return !!env && String(env.ADMIN_ENABLED) === 'true';
}
