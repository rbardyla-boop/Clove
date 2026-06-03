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

export const ADMIN_OPS = Object.freeze(['reset', 'set_status', 'diagnostics']);
export function isAdminOp(op) { return ADMIN_OPS.includes(op); }

/**
 * Returns { ok, reason }. `enabled` is the dev/admin flag, `token` is the
 * server-side secret (may be undefined), `providedToken` is the caller's token.
 */
export function checkAdmin({ enabled, token, providedToken }) {
  if (enabled !== true) return { ok: false, reason: 'admin_disabled' };
  if (typeof token !== 'string' || token.length === 0) return { ok: false, reason: 'admin_not_configured' };
  if (typeof providedToken !== 'string' || providedToken.length === 0) return { ok: false, reason: 'missing_admin_token' };
  // Length-checked equality (timing-safety is not meaningful in this single-process
  // testbed/edge context; the token is an operational secret, not a user credential).
  if (providedToken !== token) return { ok: false, reason: 'bad_admin_token' };
  return { ok: true, reason: null };
}

/** Resolve the dev/admin flag from an env-like object. */
export function adminEnabled(env) {
  return !!env && String(env.ADMIN_ENABLED) === 'true';
}
