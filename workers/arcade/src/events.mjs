/**
 * Arcade Event Feed — PURE, runtime-agnostic (Phase 1h).
 *
 * A bounded, room-wide feed of PUBLIC-SAFE events (ticket awards, challenge
 * completions, achievement unlocks, cosmetic equips, redemptions). Every entry
 * is a plain, privacy-safe summary string — it NEVER carries a private balance,
 * ledger detail, hidden inventory, or sensitive payload. Other clients see only
 * what is already public about the room.
 */

/** Keep the feed bounded so room state stays small. */
export const MAX_EVENTS = 50;

/**
 * Append a public-safe event. Returns { state, event }. Trims to the last
 * MAX_EVENTS. `logical_time` is a monotonic per-room counter for stable ordering.
 */
export function appendEvent(state, { type, actorPublicId, summary, source = null, now }) {
  const prev = Array.isArray(state.events) ? state.events : [];
  const logical = prev.length ? (prev[prev.length - 1].logical_time + 1) : 1;
  const event = {
    event_id: `ev-${logical}-${now.toString(36)}`,
    logical_time: logical,
    server_time: now,
    event_type: type,
    actor_public_id: actorPublicId,
    summary,
    source,
    public_safe: true,
  };
  const events = [...prev, event];
  while (events.length > MAX_EVENTS) events.shift();
  return { state: { ...state, events }, event };
}

/** Public feed payload — the last MAX_EVENTS public-safe events. */
export function eventFeedPayload(state) {
  const events = Array.isArray(state.events) ? state.events.slice(-MAX_EVENTS) : [];
  return { events };
}
