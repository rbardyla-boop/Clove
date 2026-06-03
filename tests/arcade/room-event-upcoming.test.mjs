/**
 * Phase 2g — room-event pre-roll ("upcoming") announcements (PURE). Covers pre-roll
 * detection (the next event within PREROLL_LEAD_MS), once-per-window dedup, the
 * `event_upcoming` payload flag, the feed entry shaping, and the lobby pre-roll helper.
 * Injected `now`, so no test waits on real time. Display-only: no reward, no ticket
 * change, no economy — the pre-roll never touches a balance or a formula.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_WINDOW_MS, PREROLL_LEAD_MS, ROOM_EVENT_FEED_TYPES,
  initialEventTracker, deriveRoomEventTransitions, roomEventFeedEntryForTransition,
  publicRoomEventSummary, roomEventPublic, roomEventListPayload,
} from '../../workers/arcade/src/room-events.mjs';
import { roomUpcomingPreroll, formatEventCountdown } from '../../arcade/room-recommend.mjs';

const W = EVENT_WINDOW_MS;
const mid = (k) => k * W + 1000;                 // mid-ish of window k (not pre-roll)
const preroll = (k) => k * W - 60_000;           // 60s before window k starts (within the 2-min lead)
// main-floor (phase 0): window 3 → Pulse Hour, window 4 → Signal Sprint Relay (featured signal)

test('PREROLL_LEAD_MS is a sane sub-window lead, and upcoming is a feed type', () => {
  assert.ok(PREROLL_LEAD_MS > 0 && PREROLL_LEAD_MS < W);
  assert.equal(ROOM_EVENT_FEED_TYPES.upcoming, 'room_event_upcoming');
  assert.equal(initialEventTracker().upcoming_announced_id, null);
});

test('no upcoming when the next event is far away', () => {
  const r = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', mid(3));
  assert.deepEqual(r.transitions.map((t) => t.transition_type), ['started']); // just Pulse Hour started
});

test('upcoming fires when the next event is within the pre-roll lead (once)', () => {
  // establish window 3 (Pulse Hour active), then advance into the pre-roll of window 4
  let tk = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', mid(3)).state;
  const r = deriveRoomEventTransitions(tk, 'main-floor', preroll(4));
  assert.deepEqual(r.transitions.map((t) => t.transition_type), ['upcoming']);
  assert.equal(r.transitions[0].display_name, 'Signal Sprint Relay');
  assert.equal(r.transitions[0].public_safe_summary, 'Signal Sprint Relay is up next.');
  // re-check in the same pre-roll window → no duplicate
  const r2 = deriveRoomEventTransitions(r.state, 'main-floor', preroll(4) + 20_000);
  assert.deepEqual(r2.transitions, []);
});

test('first observation already inside a pre-roll window emits started + upcoming', () => {
  const r = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', preroll(4));
  assert.deepEqual(r.transitions.map((t) => t.transition_type).sort(), ['started', 'upcoming']);
});

test('the window flip after a pre-roll emits ended + started + featured (no re-upcoming)', () => {
  let tk = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', mid(3)).state;
  tk = deriveRoomEventTransitions(tk, 'main-floor', preroll(4)).state; // upcoming Signal Sprint Relay
  const r = deriveRoomEventTransitions(tk, 'main-floor', mid(4));
  assert.deepEqual(r.transitions.map((t) => t.transition_type), ['ended', 'started', 'featured_changed']);
});

test('upcoming dedup advances per next-event (window K+2 pre-roll fires once)', () => {
  let tk = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', mid(3)).state;
  tk = deriveRoomEventTransitions(tk, 'main-floor', preroll(4)).state; // upcoming window4
  tk = deriveRoomEventTransitions(tk, 'main-floor', mid(4)).state;     // flip to window4
  const r = deriveRoomEventTransitions(tk, 'main-floor', preroll(5));  // pre-roll of window5
  assert.deepEqual(r.transitions.map((t) => t.transition_type), ['upcoming']);
  assert.equal(r.transitions[0].display_name, 'Neon Grid Rush');
});

test('event_upcoming flag is on the room payloads with the countdown', () => {
  assert.equal(roomEventPublic('main-floor', mid(3)).event_upcoming, false);
  const pub = roomEventPublic('main-floor', preroll(4));
  assert.equal(pub.event_upcoming, true);
  assert.equal(pub.event_starts_in_ms, 60_000);
  const list = roomEventListPayload('main-floor', preroll(4));
  assert.equal(list.event_upcoming, true);
  assert.equal(list.event_starts_in_ms, 60_000);
  assert.equal(roomEventListPayload('main-floor', mid(3)).event_upcoming, false);
});

test('upcoming feed entry maps to room_event_upcoming, system-authored + public-safe', () => {
  const tk = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', mid(3)).state;
  const r = deriveRoomEventTransitions(tk, 'main-floor', preroll(4));
  const entry = roomEventFeedEntryForTransition(r.transitions[0]);
  assert.equal(entry.type, 'room_event_upcoming');
  assert.equal(entry.actorPublicId, 'system');
  assert.equal(entry.summary, 'Signal Sprint Relay is up next.');
  assert.ok(!/balance|ledger|inventory|"player|reward|jackpot|multiplier|payout|cash|profit/i.test(JSON.stringify(r.transitions)));
});

test('publicRoomEventSummary handles the upcoming kind', () => {
  assert.equal(publicRoomEventSummary('upcoming', { display_name: 'Pulse Hour' }), 'Pulse Hour is up next.');
});

// ── lobby pre-roll helper (client display) ───────────────────────────────────────
const roomWith = (over = {}) => ({ room_id: 'main-floor', display_name: 'Main Floor', status: 'open', health: 'healthy', capacity: 32, population: 5, ...over });

test('roomUpcomingPreroll surfaces the next-event countdown only when upcoming', () => {
  const up = roomUpcomingPreroll(roomWith({ event_upcoming: true, next_event: { display_name: 'Signal Sprint Relay' }, event_starts_in_ms: 90_000 }));
  assert.equal(up.label, 'Signal Sprint Relay');
  assert.equal(up.starts_in_ms, 90_000);
  assert.equal(up.countdown, formatEventCountdown(90_000));
  assert.equal(roomUpcomingPreroll(roomWith({ event_upcoming: false, next_event: { display_name: 'X' } })), null);
  assert.equal(roomUpcomingPreroll(roomWith({})), null);
});

test('pre-roll copy carries no money/economy framing', () => {
  const up = roomUpcomingPreroll(roomWith({ event_upcoming: true, next_event: { display_name: 'Neon Grid Rush' }, event_starts_in_ms: 30_000 }));
  const text = `${up.label} ${up.countdown}`;
  assert.ok(!/jackpot|multiplier|boost|payout|win more|bonus|reward|cash|profit/i.test(text), text);
});
