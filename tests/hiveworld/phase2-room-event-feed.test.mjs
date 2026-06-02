/**
 * v0.6 parity — live room-event feed transitions in the simulator.
 *
 * Mirrors product Phase 2f (workers/arcade/src/room-events.mjs + the room DO feed
 * announcements) on the simulator's TICK clock. Proves the pure transition engine
 * (started / ended / featured_cabinet_changed + dedup), the `room_event_transition_check`
 * fabric event + reducer (validation, monotonic no-op, room-scoped public-safe feed),
 * deterministic convergence under reordering, and the deterministic scenarios. Everything
 * is DISPLAY-ONLY: no fold authority over economy, no rewards, no private data.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_WINDOW_TICKS, ROOM_EVENT_FEED_TYPES, ROOM_EVENT_FEED_SIDEBAND,
  initialRoomEventTracker, deriveRoomEventTransitions, applyRoomEventTransitions,
  roomEventFeedEntryForTransition, publicRoomEventSummary, getCurrentRoomEvent,
} from '../../arcade/hiveworld-sim/core/phase1/room-events.mjs';
import { room_event_transition_check } from '../../arcade/hiveworld-sim/core/reducers/arcade.mjs';
import { arcadeRoom } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import { sidebandForEvent, sidebandForRoomEvent, PRIVATE_FIELD_RE, feedIsPublicSafe } from '../../arcade/hiveworld-sim/core/phase1/sideband-map.mjs';
import { HiveSimulator } from '../../arcade/hiveworld-sim/core/simulator.mjs';
import { roomEventFeedTransitionShowcase, multiRoomEventFeedIsolation } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';
import { EVENT_SPECS } from '../../arcade/hiveworld-sim/core/events.mjs';
import { getHandler } from '../../arcade/hiveworld-sim/core/reducers/index.mjs';

const W = EVENT_WINDOW_TICKS;
const at = (windowIndex, offset = 1) => windowIndex * W + offset;
// main-floor (phase 0): window 3 → Pulse Hour (pulse), 4 → Signal Sprint Relay (signal), 5 → Neon Grid Rush (grid)
const mainFeed = (report) => arcadeRoom(report.finalWorldState.arcade, 'main-floor').feed;
const evtFor = (room, observeTick, atTick) => room.observeRoomEvents(observeTick, atTick);

// ── A. pure transition engine ─────────────────────────────────────────────────────
test('feed types + sideband map mirror the product set', () => {
  assert.deepEqual(ROOM_EVENT_FEED_TYPES, { started: 'room_event_started', ended: 'room_event_ended', featured_changed: 'featured_cabinet_changed' });
  assert.equal(ROOM_EVENT_FEED_SIDEBAND.room_event_started, 'weather');
  assert.equal(ROOM_EVENT_FEED_SIDEBAND.room_event_ended, 'weather');
  assert.equal(ROOM_EVENT_FEED_SIDEBAND.featured_cabinet_changed, 'discovery');
});

test('no active → active emits started (once); same active emits none', () => {
  const r1 = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', at(3));
  assert.deepEqual(r1.transitions.map((t) => t.transition_type), ['started']);
  assert.equal(r1.transitions[0].display_name, 'Pulse Hour');
  const r2 = deriveRoomEventTransitions(r1.state, 'main-floor', at(3, 9));
  assert.deepEqual(r2.transitions, []);
  assert.equal(r2.changed, false);
});

test('active A → active B emits ended(A) + started(B) + featured_changed', () => {
  const r1 = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', at(3));
  const r2 = deriveRoomEventTransitions(r1.state, 'main-floor', at(4));
  assert.deepEqual(r2.transitions.map((t) => t.transition_type), ['ended', 'started', 'featured_changed']);
  assert.equal(r2.transitions[0].display_name, 'Pulse Hour');
  assert.equal(r2.transitions[1].display_name, 'Signal Sprint Relay');
  assert.equal(r2.transitions[2].featured_cabinet_id, 'signal-sprint-01');
  assert.equal(r2.transitions[2].sideband, 'discovery');
});

test('featured_changed only fires when the featured cabinet actually differs', () => {
  // neon-training window 2 → training-focus (featured null) → window 3 → pulse-practice (pulse)
  const a = deriveRoomEventTransitions(initialRoomEventTracker(), 'neon-training', at(2));
  assert.deepEqual(a.transitions.map((t) => t.transition_type), ['started']);
  const b = deriveRoomEventTransitions(a.state, 'neon-training', at(3));
  assert.deepEqual(b.transitions.map((t) => t.transition_type), ['ended', 'started', 'featured_changed']);
});

test('repeated derivation across the SAME window never duplicates', () => {
  let tk = initialRoomEventTracker();
  let total = 0;
  for (let i = 0; i < 8; i += 1) { const r = deriveRoomEventTransitions(tk, 'main-floor', at(3, 1 + i)); tk = r.state; total += r.transitions.length; }
  assert.equal(total, 1);
});

test('reset (fresh tracker) re-announces current once; generation carried', () => {
  const r1 = deriveRoomEventTransitions(initialRoomEventTracker(7), 'main-floor', at(4));
  assert.equal(r1.state.generation, 7);
  const afterReset = deriveRoomEventTransitions(initialRoomEventTracker(8), 'main-floor', at(4, 8));
  assert.deepEqual(afterReset.transitions.map((t) => t.transition_type), ['started']);
  assert.equal(afterReset.state.generation, 8);
});

test('applyRoomEventTransitions advances dedup ids + monotonic checked tick', () => {
  const prev = initialRoomEventTracker();
  const { transitions } = deriveRoomEventTransitions(prev, 'main-floor', at(3));
  const cur = getCurrentRoomEvent('main-floor', at(3));
  const next = applyRoomEventTransitions(prev, transitions, cur, at(3));
  assert.equal(next.started_announced_id, cur.event_id);
  assert.equal(next.last_transition_checked_tick, at(3));
});

test('transition payloads + summaries are public-safe and non-monetary', () => {
  const r = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', at(4));
  const json = JSON.stringify(r.transitions);
  assert.equal(PRIVATE_FIELD_RE.test(json), false);
  assert.ok(!/agent:|token|balance|reward|jackpot|multiplier|payout|cash|profit/i.test(json), json);
  const ev = getCurrentRoomEvent('main-floor', at(4));
  const snap = { event_id: ev.event_id, display_name: ev.display_name, featured_cabinet_id: ev.featured_cabinet_id, featured_cabinet_type: ev.featured_cabinet_type };
  assert.equal(publicRoomEventSummary('started', snap), 'Signal Sprint Relay started.');
  assert.equal(publicRoomEventSummary('ended', snap), 'Signal Sprint Relay ended.');
  assert.equal(publicRoomEventSummary('featured_changed', snap), 'Signal Sprint Relay is now featuring Signal Sprint.');
});

// ── B. feed integration (through the fold) ────────────────────────────────────────
function obsSim(seed, observations) {
  const sim = new HiveSimulator({ seed, staleLockTicks: 1000 });
  const main = sim.addRoom({ id: 'main-floor', name: 'Main Floor' });
  sim.publish(main.announce(0));
  let tick = 2;
  for (const ot of observations) sim.publish(main.observeRoomEvents(ot, tick++));
  sim.advance(1);
  return sim.report();
}

test('started/ended/featured transitions each create a feed entry once', () => {
  const feed = mainFeed(obsSim('b-feed', [at(3), at(4)]));
  const types = feed.map((e) => e.event_type);
  assert.deepEqual(types, ['room_event_started', 'room_event_ended', 'room_event_started', 'featured_cabinet_changed']);
  assert.deepEqual(feed.map((e) => e.summary), ['Pulse Hour started.', 'Pulse Hour ended.', 'Signal Sprint Relay started.', 'Signal Sprint Relay is now featuring Signal Sprint.']);
});

test('a repeated observation at the same window does not duplicate the feed', () => {
  const feed = mainFeed(obsSim('b-dedup', [at(3), at(3, 9), at(3, 12)]));
  assert.equal(feed.length, 1);
});

test('feed entries are system-authored + public-safe (no private fields)', () => {
  const feed = mainFeed(obsSim('b-priv', [at(3), at(4)]));
  for (const e of feed) { assert.equal(e.actor_public_id, 'system'); assert.equal(e.source, 'room_events'); assert.equal(e.public_safe, true); }
  assert.equal(feedIsPublicSafe(feed), true);
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify(feed)), false);
});

test('feed stays bounded across many window transitions', () => {
  const obs = [];
  for (let w = 3; w < 3 + 80; w += 1) obs.push(at(w));
  const feed = mainFeed(obsSim('b-bound', obs));
  assert.ok(feed.length <= 50, `feed length ${feed.length}`);
});

test('the feed is room-scoped (other rooms unaffected)', () => {
  const report = multiRoomEventFeedIsolation({});
  const main = arcadeRoom(report.report.finalWorldState.arcade, 'main-floor').feed.map((e) => e.summary);
  const train = arcadeRoom(report.report.finalWorldState.arcade, 'neon-training').feed.map((e) => e.summary);
  assert.ok(main.some((s) => /Pulse Hour/.test(s)));
  assert.ok(!train.some((s) => /Pulse Hour/.test(s)));
  assert.ok(train.some((s) => /Training Focus/.test(s)));
});

// ── C. event fabric (validation + convergence + sideband) ─────────────────────────
test('room_event_transition_check is registered with a handler + weather sideband', () => {
  assert.equal(EVENT_SPECS.room_event_transition_check.sideband, 'weather');
  assert.equal(typeof getHandler('room_event_transition_check'), 'function');
  assert.equal(sidebandForEvent('room_event_transition_check'), 'weather');
  assert.equal(sidebandForRoomEvent('room_event_started'), 'weather');
  assert.equal(sidebandForRoomEvent('room_event_ended'), 'weather');
  assert.equal(sidebandForRoomEvent('featured_cabinet_changed'), 'discovery');
});

test('reducer validates room id, authority, and observe_tick', () => {
  const base = { arcade: { rooms: {} } };
  assert.equal(room_event_transition_check(base, { room_id: 'nope', actor_id: 'nope', payload: { observe_tick: 5 } }).reason, 'unknown_room');
  assert.equal(room_event_transition_check(base, { room_id: 'main-floor', actor_id: 'agent:x', payload: { observe_tick: 5 } }).reason, 'not_authority');
  assert.equal(room_event_transition_check(base, { room_id: 'main-floor', actor_id: 'main-floor', payload: { observe_tick: -1 } }).reason, 'invalid_observe_tick');
  assert.equal(room_event_transition_check(base, { room_id: 'main-floor', actor_id: 'main-floor', payload: { observe_tick: 1.5 } }).reason, 'invalid_observe_tick');
  assert.equal(room_event_transition_check(base, { room_id: 'main-floor', actor_id: 'main-floor', payload: { observe_tick: at(3) } }).accepted, true);
});

test('a stale/backward observation is a monotonic no-op (idempotent)', () => {
  // observe window 4 then window 3 (backward) → the window-3 check adds nothing.
  const feed = mainFeed(obsSim('c-mono', [at(4), at(3)]));
  // window 4 first establishes started(Signal Sprint Relay); backward window-3 is ignored.
  assert.deepEqual(feed.map((e) => e.event_type), ['room_event_started']);
  assert.deepEqual(feed.map((e) => e.summary), ['Signal Sprint Relay started.']);
});

test('out-of-order observation arrival converges (canonical fold)', () => {
  // Same observations, published in forward vs reversed order, fold to the same feed.
  const fwd = obsSim('c-conv', [at(3), at(4), at(5)]);
  const sim = new HiveSimulator({ seed: 'c-conv', staleLockTicks: 1000 });
  const main = sim.addRoom({ id: 'main-floor', name: 'Main Floor' });
  sim.publish(main.announce(0));
  // publish in REVERSED logical order is not possible (ticks increase), so reverse the
  // observe_ticks-to-tick assignment and rely on the canonical fold to re-sort by tick.
  sim.publish(main.observeRoomEvents(at(3), 2));
  sim.publish(main.observeRoomEvents(at(5), 4));
  sim.publish(main.observeRoomEvents(at(4), 3));
  sim.advance(1);
  assert.equal(sim.report().canonicalFingerprint, fwd.canonicalFingerprint);
  assert.equal(sim.report().desyncReport.finalConverged, true);
});

// ── D. scenarios ─────────────────────────────────────────────────────────────────
test('roomEventFeedTransitionShowcase: exactly four public-safe announcements, converged', () => {
  const { report } = roomEventFeedTransitionShowcase({});
  const feed = mainFeed(report);
  assert.deepEqual(feed.map((e) => e.event_type), ['room_event_started', 'room_event_ended', 'room_event_started', 'featured_cabinet_changed']);
  assert.equal(feed.length, 4);
  assert.equal(report.desyncReport.finalConverged, true);
  assert.equal(feedIsPublicSafe(feed), true);
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify(feed)), false);
});

test('roomEventFeedTransitionShowcase fingerprint is stable across reruns', () => {
  assert.equal(roomEventFeedTransitionShowcase({}).report.canonicalFingerprint, roomEventFeedTransitionShowcase({}).report.canonicalFingerprint);
});

test('multiRoomEventFeedIsolation: each room shows only its own active event', () => {
  const { report } = multiRoomEventFeedIsolation({});
  const sum = (id) => arcadeRoom(report.finalWorldState.arcade, id).feed.map((e) => e.summary);
  assert.deepEqual(sum('main-floor'), ['Pulse Hour started.']);
  assert.deepEqual(sum('neon-training'), ['Training Focus started.']);
  assert.deepEqual(sum('late-night-circuit'), ['Neon Grid Rush started.']);
  assert.equal(report.desyncReport.finalConverged, true);
});
