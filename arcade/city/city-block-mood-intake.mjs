/**
 * Phase W-5 — block-mood INTAKE boundary (dedup-then-strip), PURE + cross-env.
 *
 * The ONLY place in the mood feature that ever sees an actor field. It adapts already-received,
 * already-public city world-log events into the anonymous tuples the mood model consumes:
 *
 *   raw city event ──> [type allowlist] ──> [current-block filter via event_id prefix]
 *     ──> [future-stamp reject] ──> [per-(actor,type) window dedup, TRANSIENT]
 *     ──> [strip: only { event_id, type, server_time } survives — payloads + actor dropped]
 *
 * Identity rules (ADR-042): actor_public_id is read ONLY to build the transient dedup key for
 * actor-bearing events; it is never stored beyond the window, never serialized, never sent,
 * never keyed into any output, and never reaches city-block-mood.mjs. Events emitted with a
 * null actor (block trials) are deduplicated by event_id alone and bounded by the model's
 * per-type clamp — by design, trials stay per-actor-unbounded here because the server already
 * rate-bounds them (one active trial per block).
 *
 * Named AE-8 trade-off (binding): stripping identity forfeits per-actor dedup in the pure
 * model, so the design substitutes SATURATION for dedup — this boundary dedup, the per-type
 * clamp, the three-tone saturating output, no rendered numeral, and a surface that grants
 * nothing. The client id is URL-overridable (?id=), so the dedup key space is attacker-chosen;
 * the defense is the clamp + quantization, not this dedup. Honest wire caveat: raw actor ids
 * already exist in the client event buffer regardless of this feature — this boundary protects
 * the DERIVATION, it does not (and cannot) minimize the wire.
 *
 * SESSION-LOCAL, NON-REWARD: in-memory only; resets on reload; cleared on every block switch;
 * never written to a DO/account/ledger. Grants nothing.
 */

import { MOOD_EVENT_TYPES, MOOD_WINDOW_MS } from './city-block-mood.mjs';

/** PURE: a fresh, empty intake — created on connect and on EVERY block switch. */
export function createMoodIntake() {
  return { tuples: {}, seen: {} };
}

/**
 * PURE: admit one raw city event into the intake; returns a NEW intake (input never mutated).
 * Rejections are silent no-ops (returns the same intake): wrong/forged type, other block's
 * event (canonical `city_id` field mismatch), future-stamped, duplicate event_id, or an
 * actor-bearing repeat of the same (actor, type) within the window.
 */
export function intakeCityEvent(intake, rawEvent, currentCityId, now) {
  const base = intake && typeof intake === 'object' ? intake : createMoodIntake();
  if (!rawEvent || typeof rawEvent !== 'object') return base;
  const type = rawEvent.type;
  if (!MOOD_EVENT_TYPES.includes(type)) return base;
  const eventId = rawEvent.event_id;
  if (typeof eventId !== 'string' || !eventId || typeof currentCityId !== 'string' || !currentCityId) return base;
  if (rawEvent.city_id !== currentCityId) return base;                // cross-block drop (structural, not incidental)
  const serverTime = rawEvent.server_time;
  if (!Number.isFinite(serverTime) || !Number.isFinite(now) || serverTime > now) return base;
  if (base.tuples[eventId]) return base;                              // reconnect re-sends self-dedup by event_id

  const next = { tuples: {}, seen: {} };
  for (const [id, t] of Object.entries(base.tuples)) {                // window prune (decay = window exit)
    if (now - t.server_time <= MOOD_WINDOW_MS) next.tuples[id] = t;
  }
  for (const [k, ts] of Object.entries(base.seen)) {
    if (now - ts <= MOOD_WINDOW_MS) next.seen[k] = ts;
  }

  const actor = rawEvent.actor_public_id;                             // read ONCE, for the transient dedup key only
  if (typeof actor === 'string' && actor) {
    const seenKey = type + '|' + actor;
    if (next.seen[seenKey] !== undefined) return base;                // 1 per (actor, type) per window
    next.seen[seenKey] = serverTime;
  }
  next.tuples[eventId] = { event_id: eventId, type, server_time: serverTime }; // the strip: nothing else survives
  return next;
}

/** PURE: the anonymous tuples for the mood model (fresh array; carries no identity). */
export function moodTuples(intake) {
  return intake && intake.tuples ? Object.values(intake.tuples).map((t) => ({ ...t })) : [];
}
