/**
 * Phase 1h public arcade event feed — SIMULATOR-LOCAL PORT of
 * workers/arcade/src/events.mjs.
 *
 * A bounded (<= MAX_EVENTS) feed of PUBLIC-SAFE summaries. Every entry is a plain
 * privacy-safe summary string + a few public fields — it NEVER carries a private
 * balance, ledger detail, or hidden inventory. Operates on an `arcade.feed` array.
 */
export const MAX_EVENTS = 50;

/** Append a public-safe feed event. Returns the new arcade slice (trims to MAX_EVENTS). */
export function appendFeed(arcade, { type, actor, summary, source = null, tick }) {
  const prev = Array.isArray(arcade.feed) ? arcade.feed : [];
  const logical = prev.length ? prev[prev.length - 1].logical_time + 1 : 1;
  const event = { event_id: `ev-${logical}`, logical_time: logical, tick, event_type: type, actor_public_id: actor, summary, source, public_safe: true };
  const feed = [...prev, event];
  while (feed.length > MAX_EVENTS) feed.shift();
  return { ...arcade, feed };
}

export function feedPayload(arcade) {
  return { events: Array.isArray(arcade.feed) ? arcade.feed.slice(-MAX_EVENTS) : [] };
}
