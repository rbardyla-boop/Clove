/**
 * HiveWorld v1.1 — append-only city world-event log (mirror of product Phase 4C
 * `arcade/city/src/city-events.mjs`).
 *
 * PURE, deterministic. A bounded (FIFO, MAX 50), monotonic-seq, server-authored public-safe log of
 * district world events. The fold STAMPS id/seq; a caller can never forge them. Each entry's payload is
 * re-projected through a CLOSED allowlist of public keys — private fields (actor ids beyond a public
 * label, balances, sockets) can never enter the log. No economy/ownership.
 */
export const CITY_LOG_MAX = 50;

/** The only payload keys a world-log entry may carry (re-projected; everything else dropped). */
const PUBLIC_PAYLOAD_KEYS = Object.freeze([
  'city_id', 'target_city_id', 'reason', 'portal_id', 'palette', 'sign_variant', 'intensity',
  'tier', 'support_signal', 'mood', 'objective', 'score', 'score_cap', 'stabilized',
]);

/** A public-safe scalar (string/number/bool) only — drops objects/arrays so nothing nested leaks. */
function safeScalar(v) {
  if (typeof v === 'string') return v.length > 64 ? v.slice(0, 64) : v;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v;
  return undefined;
}

function sanitizePayload(payload) {
  const out = {};
  const p = payload && typeof payload === 'object' ? payload : {};
  for (const k of PUBLIC_PAYLOAD_KEYS) {
    const v = safeScalar(p[k]);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export function createCityLog() {
  return { events: [], seq: 0 };
}

/**
 * PURE: append a SERVER-AUTHORED public-safe entry. The log stamps `seq` (monotonic) + `event_id`;
 * `actorPublicId` is a PUBLIC label only (e.g. a block id), never a private actor identity. Bounded
 * FIFO. Returns a NEW log (never mutates input). `type` must be a non-empty string.
 */
export function appendCityWorldEvent(log, { type, cityId = null, actorPublicId = null, payload = {}, tick }) {
  const base = log && Array.isArray(log.events) ? log : createCityLog();
  if (typeof type !== 'string' || !type) return base; // ignore malformed
  const seq = base.seq + 1;
  const entry = Object.freeze({
    event_id: `cwe:${seq}`,
    seq,
    type: type.length > 48 ? type.slice(0, 48) : type,
    city_id: typeof cityId === 'string' ? cityId : null,
    actor_public_id: typeof actorPublicId === 'string' ? actorPublicId : null,
    tick: Number.isFinite(tick) ? tick : 0,
    payload: sanitizePayload(payload),
    public_safe: true,
  });
  const events = [...base.events, entry].slice(-CITY_LOG_MAX); // bounded FIFO
  return { events, seq };
}

/** PURE: the most recent `n` entries (newest-last, as stored). */
export function recentCityEvents(log, n = CITY_LOG_MAX) {
  const events = log && Array.isArray(log.events) ? log.events : [];
  return events.slice(-n);
}

export { PUBLIC_PAYLOAD_KEYS };
