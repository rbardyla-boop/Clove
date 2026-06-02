/**
 * Phase 2f — live room-event feed transitions (PURE). Covers the transition engine
 * (started / ended / featured_changed), id-based dedup (no feed spam), reset behaviour,
 * and feed integration (the transitions become bounded, public-safe entries in the
 * existing event feed). Everything is driven by an injected `now`, so no test waits on
 * real time. Display-only: transitions carry no economy and no private data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_WINDOW_MS, ROOM_EVENT_FEED_TYPES,
  initialEventTracker, deriveRoomEventTransitions, roomEventFeedEntryForTransition,
  publicRoomEventSummary, getCurrentRoomEvent,
} from '../../workers/arcade/src/room-events.mjs';
import { appendEvent, eventFeedPayload, MAX_EVENTS } from '../../workers/arcade/src/events.mjs';
import { createTicketState } from '../../workers/arcade/src/round-authority.mjs';

const W = EVENT_WINDOW_MS;
const at = (windowIndex, offset = 1000) => windowIndex * W + offset;
// main-floor (phase 0): window 3 → Pulse Hour (pulse), 4 → Signal Sprint Relay (signal), 5 → Neon Grid Rush (grid)

// ── A. pure transition engine ─────────────────────────────────────────────────────
test('no previous event + active current => started (once)', () => {
  const r = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', at(3));
  assert.equal(r.transitions.length, 1);
  assert.equal(r.transitions[0].transition_type, 'started');
  assert.equal(r.transitions[0].display_name, 'Pulse Hour');
  assert.equal(r.changed, true);
});

test('active previous + same current => none (dedup)', () => {
  const r1 = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', at(3));
  const r2 = deriveRoomEventTransitions(r1.state, 'main-floor', at(3, 9000)); // same window
  assert.deepEqual(r2.transitions, []);
  assert.equal(r2.changed, false);
});

test('active previous + different current => ended(old) + started(new) + featured_changed', () => {
  const r1 = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', at(3)); // Pulse Hour (pulse)
  const r2 = deriveRoomEventTransitions(r1.state, 'main-floor', at(4));             // Signal Sprint Relay (signal)
  const types = r2.transitions.map((t) => t.transition_type);
  assert.deepEqual(types, ['ended', 'started', 'featured_changed']);
  assert.equal(r2.transitions[0].display_name, 'Pulse Hour');             // ended the old one
  assert.equal(r2.transitions[1].display_name, 'Signal Sprint Relay');   // started the new one
  assert.equal(r2.transitions[2].featured_cabinet_id, 'signal-sprint-01');
});

test('featured_changed only fires when the featured cabinet actually differs', () => {
  // neon-training window 2 → training-focus (featured null) → window 3 → pulse-practice (pulse)
  const a = deriveRoomEventTransitions(initialEventTracker(), 'neon-training', at(2));
  assert.deepEqual(a.transitions.map((t) => t.transition_type), ['started']); // null featured: no featured_changed on first obs
  const b = deriveRoomEventTransitions(a.state, 'neon-training', at(3));
  assert.deepEqual(b.transitions.map((t) => t.transition_type), ['ended', 'started', 'featured_changed']); // null → pulse
  assert.equal(b.transitions[2].featured_cabinet_id, 'pulse-tap-01');
});

test('repeated checks across the SAME event never duplicate (no spam)', () => {
  let tr = initialEventTracker();
  let total = 0;
  for (let i = 0; i < 10; i += 1) {
    const r = deriveRoomEventTransitions(tr, 'main-floor', at(3, 1000 + i * 100));
    tr = r.state;
    total += r.transitions.length;
  }
  assert.equal(total, 1); // only the first check announces 'started'
});

test('reset (fresh tracker) re-announces the current event once, no infinite replay', () => {
  const r1 = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', at(4)); // started Signal Sprint Relay
  // a reset clears the tracker; the next check re-announces 'started' exactly once...
  const afterReset = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', at(4, 8000));
  assert.deepEqual(afterReset.transitions.map((t) => t.transition_type), ['started']);
  // ...and then dedups (no replay of the old ended/started)
  const again = deriveRoomEventTransitions(afterReset.state, 'main-floor', at(4, 9000));
  assert.deepEqual(again.transitions, []);
});

test('unknown room derives no transitions (safe)', () => {
  const r = deriveRoomEventTransitions(initialEventTracker(), 'nope', at(3));
  assert.deepEqual(r.transitions, []);
  assert.equal(r.changed, false);
});

test('transition payloads are public-safe (no economy / private fields)', () => {
  const r = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', at(4));
  const json = JSON.stringify(r.transitions);
  assert.ok(!/balance|ledger|inventory|"player|actor_public|token|secret|reward|cost_tickets/i.test(json), json);
  for (const t of r.transitions) {
    assert.ok(typeof t.public_safe_summary === 'string');
    assert.equal(t.room_id, 'main-floor');
    assert.ok(typeof t.occurred_at === 'number');
  }
});

test('summaries are non-monetary and human', () => {
  const ev = getCurrentRoomEvent('main-floor', at(4));
  const snap = { event_id: ev.event_id, display_name: ev.display_name, featured_cabinet_id: ev.featured_cabinet_id, featured_cabinet_type: ev.featured_cabinet_type };
  assert.equal(publicRoomEventSummary('started', snap), 'Signal Sprint Relay started.');
  assert.equal(publicRoomEventSummary('ended', snap), 'Signal Sprint Relay ended.');
  assert.equal(publicRoomEventSummary('featured_changed', snap), 'Signal Sprint Relay is now featuring Signal Sprint.');
  const all = [publicRoomEventSummary('started', snap), publicRoomEventSummary('ended', snap), publicRoomEventSummary('featured_changed', snap)].join(' ');
  assert.ok(!/jackpot|multiplier|boost|payout|win more|bonus|reward|cash|profit/i.test(all), all);
});

// ── B. feed integration (transitions → existing public event feed) ────────────────
function announce(state, roomId, prevTracker, now) {
  const { transitions, state: tracker } = deriveRoomEventTransitions(prevTracker, roomId, now);
  let s = state;
  for (const tr of transitions) {
    s = appendEvent(s, { ...roomEventFeedEntryForTransition(tr), now }).state;
  }
  return { state: s, tracker, count: transitions.length };
}

test('transitions create feed entries with the three Phase 2f feed types', () => {
  let s = createTicketState();
  let tk = initialEventTracker();
  ({ state: s, tracker: tk } = announce(s, 'main-floor', tk, at(3))); // started
  ({ state: s, tracker: tk } = announce(s, 'main-floor', tk, at(4))); // ended + started + featured_changed
  const types = eventFeedPayload(s).events.map((e) => e.event_type);
  assert.ok(types.includes(ROOM_EVENT_FEED_TYPES.started));
  assert.ok(types.includes(ROOM_EVENT_FEED_TYPES.ended));
  assert.ok(types.includes(ROOM_EVENT_FEED_TYPES.featured_changed));
  assert.deepEqual([ROOM_EVENT_FEED_TYPES.started, ROOM_EVENT_FEED_TYPES.ended, ROOM_EVENT_FEED_TYPES.featured_changed],
    ['room_event_started', 'room_event_ended', 'featured_cabinet_changed']);
});

test('feed entries are public-safe + system-authored (no private player id)', () => {
  let s = createTicketState();
  let tk = initialEventTracker();
  ({ state: s, tracker: tk } = announce(s, 'main-floor', tk, at(3)));
  const e = eventFeedPayload(s).events.at(-1);
  assert.equal(e.public_safe, true);
  assert.equal(e.actor_public_id, 'system');
  assert.ok(!/balance|ledger|inventory|cost_tickets/i.test(JSON.stringify(e)), JSON.stringify(e));
});

test('feed stays bounded by MAX_EVENTS even across many transitions', () => {
  let s = createTicketState();
  let tk = initialEventTracker();
  for (let w = 3; w < 3 + MAX_EVENTS + 20; w += 1) {
    ({ state: s, tracker: tk } = announce(s, 'main-floor', tk, at(w)));
  }
  assert.ok(eventFeedPayload(s).events.length <= MAX_EVENTS);
});

// ── C. request-spam safety (idempotence at the same clock) ────────────────────────
test('repeated checks at the same now add no feed entries (request spam safe)', () => {
  let s = createTicketState();
  let tk = initialEventTracker();
  ({ state: s, tracker: tk } = announce(s, 'main-floor', tk, at(4)));
  const before = eventFeedPayload(s).events.length;
  for (let i = 0; i < 5; i += 1) ({ state: s, tracker: tk } = announce(s, 'main-floor', tk, at(4, 2000 + i)));
  assert.equal(eventFeedPayload(s).events.length, before);
});

// ── D. reset / multi-room independence ────────────────────────────────────────────
test('a reset (fresh tracker) lets the new event announce once; other rooms unaffected', () => {
  // room A advances; room B has its own independent tracker.
  let aTracker = initialEventTracker();
  let bTracker = initialEventTracker();
  ({ state: aTracker } = { state: deriveRoomEventTransitions(aTracker, 'main-floor', at(3)).state });
  const b1 = deriveRoomEventTransitions(bTracker, 'late-night-circuit', at(3)); // independent
  assert.equal(b1.transitions.length, 1);
  // reset room A → fresh tracker re-announces once at the current window
  const aReset = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', at(3, 5000));
  assert.deepEqual(aReset.transitions.map((t) => t.transition_type), ['started']);
  // room B unchanged by A's reset (still deduped on its own state)
  const b2 = deriveRoomEventTransitions(b1.state, 'late-night-circuit', at(3, 6000));
  assert.deepEqual(b2.transitions, []);
});
