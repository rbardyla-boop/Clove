/**
 * v0.7 parity — room-event pre-roll ("upcoming") in the simulator.
 *
 * Mirrors product Phase 2g (the room_event_upcoming pre-roll) on the simulator's TICK
 * clock. Proves the pure pre-roll detection (next event within PREROLL_LEAD_TICKS) +
 * once-per-window dedup, the `event_upcoming` payload flag, that the existing
 * room_event_transition_check reducer emits the pre-roll with NO reducer change, the
 * roomEventPrerollShowcase scenario (pre-roll → start/end flow), convergence, and privacy.
 * Display-only: no reward, no ticket change, no economy fold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_WINDOW_TICKS, PREROLL_LEAD_TICKS, ROOM_EVENT_FEED_TYPES, ROOM_EVENT_FEED_SIDEBAND,
  initialRoomEventTracker, deriveRoomEventTransitions, applyRoomEventTransitions,
  roomEventFeedEntryForTransition, publicRoomEventSummary, roomEventPublic, roomEventListPayload,
  getCurrentRoomEvent,
} from '../../arcade/hiveworld-sim/core/phase1/room-events.mjs';
import { arcadeRoom } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import { sidebandForRoomEvent, PRIVATE_FIELD_RE, feedIsPublicSafe } from '../../arcade/hiveworld-sim/core/phase1/sideband-map.mjs';
import { HiveSimulator } from '../../arcade/hiveworld-sim/core/simulator.mjs';
import { roomEventPrerollShowcase } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';

const W = EVENT_WINDOW_TICKS;
const mid = (k) => k * W + 1;                       // mid-ish of window k (not pre-roll)
const preroll = (k) => k * W - PREROLL_LEAD_TICKS;  // first pre-roll tick of window k
// main-floor (phase 0): window 3 → Pulse Hour, window 4 → Signal Sprint Relay (featured signal)
const mainFeed = (report) => arcadeRoom(report.finalWorldState.arcade, 'main-floor').feed;

// ── A. pure pre-roll engine ───────────────────────────────────────────────────────
test('PREROLL_LEAD_TICKS is a sane sub-window lead; upcoming is a feed type on weather', () => {
  assert.ok(PREROLL_LEAD_TICKS > 0 && PREROLL_LEAD_TICKS < W);
  assert.equal(ROOM_EVENT_FEED_TYPES.upcoming, 'room_event_upcoming');
  assert.equal(ROOM_EVENT_FEED_SIDEBAND.room_event_upcoming, 'weather');
  assert.equal(sidebandForRoomEvent('room_event_upcoming'), 'weather');
  assert.equal(initialRoomEventTracker().upcoming_announced_id, null);
});

test('no upcoming when the next event is far away', () => {
  const r = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', mid(3));
  assert.deepEqual(r.transitions.map((t) => t.transition_type), ['started']);
});

test('upcoming fires when the next event is within the pre-roll lead (once)', () => {
  let tk = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', mid(3)).state;
  const r = deriveRoomEventTransitions(tk, 'main-floor', preroll(4));
  assert.deepEqual(r.transitions.map((t) => t.transition_type), ['upcoming']);
  assert.equal(r.transitions[0].display_name, 'Signal Sprint Relay');
  assert.equal(r.transitions[0].public_safe_summary, 'Signal Sprint Relay is up next.');
  assert.equal(r.transitions[0].sideband, 'weather');
  const r2 = deriveRoomEventTransitions(r.state, 'main-floor', preroll(4) + 1); // still pre-roll
  assert.deepEqual(r2.transitions, []);
});

test('first observation already inside a pre-roll window emits started + upcoming', () => {
  const r = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', preroll(4));
  assert.deepEqual(r.transitions.map((t) => t.transition_type).sort(), ['started', 'upcoming']);
});

test('the window flip after a pre-roll emits ended + started + featured (no re-upcoming)', () => {
  let tk = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', mid(3)).state;
  tk = deriveRoomEventTransitions(tk, 'main-floor', preroll(4)).state; // upcoming Signal Sprint Relay
  const r = deriveRoomEventTransitions(tk, 'main-floor', mid(4));
  assert.deepEqual(r.transitions.map((t) => t.transition_type), ['ended', 'started', 'featured_changed']);
});

test('upcoming dedup advances per next-event (window K+2 pre-roll fires once)', () => {
  let tk = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', mid(3)).state;
  tk = deriveRoomEventTransitions(tk, 'main-floor', preroll(4)).state;
  tk = deriveRoomEventTransitions(tk, 'main-floor', mid(4)).state;
  const r = deriveRoomEventTransitions(tk, 'main-floor', preroll(5));
  assert.deepEqual(r.transitions.map((t) => t.transition_type), ['upcoming']);
  assert.equal(r.transitions[0].display_name, 'Neon Grid Rush');
});

test('applyRoomEventTransitions carries upcoming_announced_id', () => {
  const prev = initialRoomEventTracker();
  let tk = deriveRoomEventTransitions(prev, 'main-floor', mid(3)).state;
  const { transitions } = deriveRoomEventTransitions(tk, 'main-floor', preroll(4));
  const next = applyRoomEventTransitions(tk, transitions, getCurrentRoomEvent('main-floor', preroll(4)), preroll(4));
  assert.equal(next.upcoming_announced_id, transitions[0].event_id);
});

test('event_upcoming flag is on the room payloads with the tick countdown', () => {
  assert.equal(roomEventPublic('main-floor', mid(3)).event_upcoming, false);
  const pub = roomEventPublic('main-floor', preroll(4));
  assert.equal(pub.event_upcoming, true);
  assert.equal(pub.event_starts_in_ticks, PREROLL_LEAD_TICKS);
  const list = roomEventListPayload('main-floor', preroll(4));
  assert.equal(list.event_upcoming, true);
  assert.equal(list.event_starts_in_ticks, PREROLL_LEAD_TICKS);
  assert.equal(roomEventListPayload('main-floor', mid(3)).event_upcoming, false);
});

test('upcoming feed entry maps to room_event_upcoming, system-authored + public-safe', () => {
  const tk = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', mid(3)).state;
  const r = deriveRoomEventTransitions(tk, 'main-floor', preroll(4));
  const entry = roomEventFeedEntryForTransition(r.transitions[0]);
  assert.equal(entry.type, 'room_event_upcoming');
  assert.equal(entry.actor, 'system');
  assert.equal(entry.source, 'room_events');
  assert.equal(entry.summary, 'Signal Sprint Relay is up next.');
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify(r.transitions)), false);
  assert.ok(!/agent:|token|balance|reward|jackpot|multiplier|payout|cash|profit/i.test(JSON.stringify(r.transitions)));
});

test('publicRoomEventSummary handles the upcoming kind (non-monetary)', () => {
  assert.equal(publicRoomEventSummary('upcoming', { display_name: 'Pulse Hour' }), 'Pulse Hour is up next.');
});

// ── B. fold / feed integration (reducer auto-propagates upcoming) ─────────────────
function obsSim(seed, observations) {
  const sim = new HiveSimulator({ seed, staleLockTicks: 1000 });
  const main = sim.addRoom({ id: 'main-floor', name: 'Main Floor' });
  sim.publish(main.announce(0));
  let tick = 2;
  for (const ot of observations) sim.publish(main.observeRoomEvents(ot, tick++));
  sim.advance(1);
  return sim.report();
}

test('the existing transition-check reducer emits room_event_upcoming (no reducer change)', () => {
  const feed = mainFeed(obsSim('v07-feed', [mid(3), preroll(4)]));
  assert.deepEqual(feed.map((e) => e.event_type), ['room_event_started', 'room_event_upcoming']);
  assert.equal(feed[1].summary, 'Signal Sprint Relay is up next.');
  assert.equal(feed[1].actor_public_id, 'system');
  assert.equal(feedIsPublicSafe(feed), true);
});

test('a repeated pre-roll observation does not duplicate the feed', () => {
  const feed = mainFeed(obsSim('v07-dedup', [mid(3), preroll(4), preroll(4) + 1]));
  assert.equal(feed.filter((e) => e.event_type === 'room_event_upcoming').length, 1);
});

test('out-of-order pre-roll observation arrival converges (canonical fold)', () => {
  const fwd = obsSim('v07-conv', [mid(3), preroll(4), mid(4)]);
  const sim = new HiveSimulator({ seed: 'v07-conv', staleLockTicks: 1000 });
  const main = sim.addRoom({ id: 'main-floor', name: 'Main Floor' });
  sim.publish(main.announce(0));
  sim.publish(main.observeRoomEvents(mid(3), 2));
  sim.publish(main.observeRoomEvents(mid(4), 4));   // later tick first…
  sim.publish(main.observeRoomEvents(preroll(4), 3)); // …pre-roll second (canonical fold re-sorts)
  sim.advance(1);
  assert.equal(sim.report().canonicalFingerprint, fwd.canonicalFingerprint);
  assert.equal(sim.report().desyncReport.finalConverged, true);
});

// ── C. scenario (pre-roll → start/end flow) ──────────────────────────────────────
test('roomEventPrerollShowcase: started → upcoming → ended → started → featured, converged', () => {
  const { report } = roomEventPrerollShowcase({});
  const feed = mainFeed(report);
  assert.deepEqual(feed.map((e) => e.event_type), [
    'room_event_started', 'room_event_upcoming', 'room_event_ended', 'room_event_started', 'featured_cabinet_changed',
  ]);
  assert.equal(feed[1].summary, 'Signal Sprint Relay is up next.');
  assert.equal(report.desyncReport.finalConverged, true);
  assert.equal(feedIsPublicSafe(feed), true);
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify(feed)), false);
});

test('roomEventPrerollShowcase fingerprint is stable across reruns', () => {
  assert.equal(roomEventPrerollShowcase({}).report.canonicalFingerprint, roomEventPrerollShowcase({}).report.canonicalFingerprint);
});
