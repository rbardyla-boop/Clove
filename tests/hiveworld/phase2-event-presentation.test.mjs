/**
 * v0.8 parity — operator-tunable event presentation in the simulator.
 *
 * Mirrors product Phase 2h on the TICK clock. Proves the config model
 * (validation/clamping/freeze + ctx resolution), the config-threaded pre-roll lead (a
 * wider operator lead makes `upcoming` fire earlier — through the pure helper AND the
 * room_event_transition_check reducer via the sim ctx), the public `presentation` block
 * on the payloads, privacy, and the eventPresentationShowcase scenario. DISPLAY-ONLY: a
 * presentation value can never change a ticket formula, reward, fold authority, or economy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_WINDOW_TICKS, PREROLL_LEAD_TICKS, DEFAULT_EVENT_PRESENTATION, PRESENTATION_BOUNDS,
  resolveEventPresentation, eventPresentationFromCtx, publicPresentation,
  deriveRoomEventTransitions, initialRoomEventTracker, roomEventPublic, roomEventListPayload, attachRoomEvents,
} from '../../arcade/hiveworld-sim/core/phase1/room-events.mjs';
import { arcadeRoom } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import { PRIVATE_FIELD_RE, feedIsPublicSafe } from '../../arcade/hiveworld-sim/core/phase1/sideband-map.mjs';
import { HiveSimulator } from '../../arcade/hiveworld-sim/core/simulator.mjs';
import { eventPresentationShowcase } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';

const W = EVENT_WINDOW_TICKS;
const mainFeed = (report) => arcadeRoom(report.finalWorldState.arcade, 'main-floor').feed;

// ── config defaults + validation/clamping ────────────────────────────────────────
test('defaults match v0.7 behaviour (preroll lead = PREROLL_LEAD_TICKS)', () => {
  assert.equal(DEFAULT_EVENT_PRESENTATION.preroll_lead_ticks, PREROLL_LEAD_TICKS);
  assert.equal(DEFAULT_EVENT_PRESENTATION.countdown_refresh_ms, 1000);
  assert.equal(DEFAULT_EVENT_PRESENTATION.show_next_event, true);
  assert.equal(DEFAULT_EVENT_PRESENTATION.show_featured_chip, true);
  assert.deepEqual(resolveEventPresentation({}), DEFAULT_EVENT_PRESENTATION);
  assert.deepEqual(resolveEventPresentation(undefined), DEFAULT_EVENT_PRESENTATION);
});

test('preroll lead (ticks) is clamped to safe bounds; bad values fall back to default', () => {
  assert.equal(resolveEventPresentation({ preroll_lead_ticks: 999 }).preroll_lead_ticks, PRESENTATION_BOUNDS.preroll_lead_ticks.max);
  assert.equal(resolveEventPresentation({ preroll_lead_ticks: 0 }).preroll_lead_ticks, PRESENTATION_BOUNDS.preroll_lead_ticks.min);
  assert.equal(resolveEventPresentation({ preroll_lead_ticks: 'nope' }).preroll_lead_ticks, PREROLL_LEAD_TICKS);
  assert.ok(PRESENTATION_BOUNDS.preroll_lead_ticks.max < W); // never spans the whole window
});

test('countdown refresh is clamped; booleans are coerced from strings/numbers', () => {
  assert.equal(resolveEventPresentation({ countdown_refresh_ms: 1 }).countdown_refresh_ms, PRESENTATION_BOUNDS.countdown_refresh_ms.min);
  assert.equal(resolveEventPresentation({ countdown_refresh_ms: 10_000_000 }).countdown_refresh_ms, PRESENTATION_BOUNDS.countdown_refresh_ms.max);
  assert.equal(resolveEventPresentation({ show_next_event: 'false' }).show_next_event, false);
  assert.equal(resolveEventPresentation({ show_featured_chip: '0' }).show_featured_chip, false);
  assert.equal(resolveEventPresentation({ show_next_event: 'garbage' }).show_next_event, true); // → default
});

test('the resolved config is frozen (immutable)', () => {
  assert.throws(() => { resolveEventPresentation({}).preroll_lead_ticks = 5; }, TypeError);
});

test('eventPresentationFromCtx reads ctx.eventPresentation with the same validation', () => {
  const c = eventPresentationFromCtx({ eventPresentation: { preroll_lead_ticks: 5, show_featured_chip: 'false' } });
  assert.equal(c.preroll_lead_ticks, 5);
  assert.equal(c.show_featured_chip, false);
  assert.deepEqual(eventPresentationFromCtx({}), DEFAULT_EVENT_PRESENTATION);     // no override → defaults
  assert.deepEqual(eventPresentationFromCtx(undefined), DEFAULT_EVENT_PRESENTATION);
});

// ── config-threaded pre-roll (the operator lead changes when upcoming fires) ──────
test('a wider operator pre-roll lead makes the upcoming fire earlier (pure)', () => {
  const wide = eventPresentationFromCtx({ eventPresentation: { preroll_lead_ticks: 5 } });
  let tk = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', 3 * W + 1, wide).state;
  // 4 ticks before window 4 → within a 5-tick lead but NOT the default 2-tick lead
  assert.deepEqual(deriveRoomEventTransitions(tk, 'main-floor', 4 * W - 4, wide).transitions.map((t) => t.transition_type), ['upcoming']);
  let tk2 = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', 3 * W + 1).state;
  assert.deepEqual(deriveRoomEventTransitions(tk2, 'main-floor', 4 * W - 4).transitions, []);
});

test('event_upcoming on the payloads honors the operator lead', () => {
  const wide = eventPresentationFromCtx({ eventPresentation: { preroll_lead_ticks: 5 } });
  const t = 4 * W - 4;
  assert.equal(roomEventPublic('main-floor', t, wide).event_upcoming, true);
  assert.equal(roomEventPublic('main-floor', t).event_upcoming, false); // default 2-tick lead
  assert.equal(roomEventListPayload('main-floor', t, wide).event_upcoming, true);
});

test('the room_event_transition_check reducer reads the operator lead from the sim ctx', () => {
  // Same observation set; only the ctx pre-roll lead differs → different feed.
  const run = (ctx) => {
    const sim = new HiveSimulator({ seed: 'p2h-ctx', ctx, staleLockTicks: 1000 });
    const main = sim.addRoom({ id: 'main-floor', name: 'Main Floor' });
    sim.publish(main.announce(0));
    sim.publish(main.observeRoomEvents(3 * W + 1, 2));
    sim.publish(main.observeRoomEvents(4 * W - 4, 3)); // 4 ticks out
    sim.advance(1);
    return mainFeed(sim.report()).map((e) => e.event_type);
  };
  assert.deepEqual(run({ eventPresentation: { preroll_lead_ticks: 5 } }), ['room_event_started', 'room_event_upcoming']);
  assert.deepEqual(run({}), ['room_event_started']); // default lead → no pre-roll yet
});

// ── public presentation block + privacy ──────────────────────────────────────────
test('roomEventListPayload + attachRoomEvents surface the public presentation block', () => {
  const cfg = eventPresentationFromCtx({ eventPresentation: { countdown_refresh_ms: 2000, show_featured_chip: 'false' } });
  const list = roomEventListPayload('main-floor', 3 * W + 1, cfg);
  assert.deepEqual(list.presentation, publicPresentation(cfg));
  assert.equal(list.presentation.countdown_refresh_ms, 2000);
  assert.equal(list.presentation.show_featured_chip, false);
  const enriched = attachRoomEvents({ schema_version: 1, rooms: [{ room_id: 'main-floor' }] }, 3 * W + 1, cfg);
  assert.deepEqual(enriched.presentation, publicPresentation(cfg));
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify(list.presentation)), false);
  assert.ok(!/agent:|token|balance|reward/i.test(JSON.stringify(list.presentation)));
});

// ── scenario (presentation config affects display only) ──────────────────────────
test('eventPresentationShowcase: a wider lead fires the pre-roll earlier; converged + public-safe', () => {
  const { report } = eventPresentationShowcase({});
  const feed = mainFeed(report);
  assert.deepEqual(feed.map((e) => e.event_type), ['room_event_started', 'room_event_upcoming']);
  assert.equal(feed[1].summary, 'Signal Sprint Relay is up next.');
  assert.equal(report.desyncReport.finalConverged, true);
  assert.equal(feedIsPublicSafe(feed), true);
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify(feed)), false);
  // the same observations under the DEFAULT lead would NOT pre-roll yet (display-only effect)
  const def = eventPresentationShowcase({ prerollLeadTicks: PREROLL_LEAD_TICKS });
  assert.deepEqual(mainFeed(def.report).map((e) => e.event_type), ['room_event_started']);
});

test('eventPresentationShowcase fingerprint is stable across reruns', () => {
  assert.equal(eventPresentationShowcase({}).report.canonicalFingerprint, eventPresentationShowcase({}).report.canonicalFingerprint);
});
