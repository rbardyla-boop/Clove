/**
 * v0.9 parity — per-room presentation overrides in the simulator.
 *
 * Mirrors product Phase 2i on the TICK clock. Proves the override model (sanitize: only
 * set+valid keys, drop invalid, clamp; merge: base⊕override, fall-through, frozen), the
 * resolver-capable attachRoomEvents (each room reflects its EFFECTIVE config, top-level
 * stays base), the room-authored room_presentation_override_set reducer (set/clear +
 * authority gate), per-room isolation through the room_event_transition_check reducer (an
 * override changes that room's pre-roll display ONLY), schedule-invariance, privacy, and
 * the presentationOverrideShowcase scenario. DISPLAY-ONLY: an override can never change a
 * ticket formula, reward, fold authority, the deterministic schedule, or economy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_WINDOW_TICKS, DEFAULT_EVENT_PRESENTATION, PRESENTATION_BOUNDS, PRESENTATION_KEYS,
  eventPresentationFromCtx, resolveEventPresentation, publicPresentation,
  sanitizeEventPresentationOverride, mergeEventPresentation,
  attachRoomEvents, initialRoomEventTracker, deriveRoomEventTransitions,
} from '../../arcade/hiveworld-sim/core/phase1/room-events.mjs';
import { arcadeRoom } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import { room_presentation_override_set } from '../../arcade/hiveworld-sim/core/reducers/arcade.mjs';
import { createInitialState } from '../../arcade/hiveworld-sim/core/state-util.mjs';
import { PRIVATE_FIELD_RE, feedIsPublicSafe } from '../../arcade/hiveworld-sim/core/phase1/sideband-map.mjs';
import { HiveSimulator } from '../../arcade/hiveworld-sim/core/simulator.mjs';
import { presentationOverrideShowcase } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';

const W = EVENT_WINDOW_TICKS;
const BASE = eventPresentationFromCtx(null); // == DEFAULT_EVENT_PRESENTATION
const feedOf = (report, rid) => arcadeRoom(report.finalWorldState.arcade, rid).feed;
const overrideOf = (report, rid) => arcadeRoom(report.finalWorldState.arcade, rid).presentationOverride;
const overrideEvent = (roomId, override, actor = roomId) => ({
  event_type: 'room_presentation_override_set', actor_id: actor, room_id: roomId, logical_tick: 1,
  payload: { room_id: roomId, override },
});

// ── sanitize: only known + set + valid keys, clamped; invalid dropped ──────────────
test('the tunable keys are exactly the four presentation fields', () => {
  assert.deepEqual([...PRESENTATION_KEYS].sort(), ['countdown_refresh_ms', 'preroll_lead_ticks', 'show_featured_chip', 'show_next_event']);
});

test('sanitize keeps only set+valid keys (clamped); empty/garbage → {}', () => {
  assert.deepEqual(sanitizeEventPresentationOverride({}), {});
  assert.deepEqual(sanitizeEventPresentationOverride(null), {});
  assert.deepEqual(sanitizeEventPresentationOverride({ bogus: 1 }), {});
  assert.deepEqual(sanitizeEventPresentationOverride({ preroll_lead_ticks: 5 }), { preroll_lead_ticks: 5 });
  assert.deepEqual(sanitizeEventPresentationOverride({ preroll_lead_ticks: 5, show_next_event: 'false', bogus: 9 }), { preroll_lead_ticks: 5, show_next_event: false });
});

test('sanitize DROPS invalid values (fall through to base) instead of storing a default', () => {
  assert.deepEqual(sanitizeEventPresentationOverride({ preroll_lead_ticks: 'abc' }), {});
  assert.deepEqual(sanitizeEventPresentationOverride({ show_next_event: 'maybe' }), {});
  assert.deepEqual(sanitizeEventPresentationOverride({ preroll_lead_ticks: 'abc', show_featured_chip: false }), { show_featured_chip: false });
});

test('sanitize clamps an out-of-bounds value to the bound (and only that key)', () => {
  assert.deepEqual(sanitizeEventPresentationOverride({ preroll_lead_ticks: 999 }), { preroll_lead_ticks: PRESENTATION_BOUNDS.preroll_lead_ticks.max });
  assert.deepEqual(sanitizeEventPresentationOverride({ preroll_lead_ticks: 0 }), { preroll_lead_ticks: PRESENTATION_BOUNDS.preroll_lead_ticks.min });
});

// ── merge: base ⊕ override, fall-through, frozen + clamped ─────────────────────────
test('merge applies the override on top of the base; missing keys fall through', () => {
  const eff = mergeEventPresentation(BASE, { preroll_lead_ticks: 5 });
  assert.equal(eff.preroll_lead_ticks, 5);
  assert.equal(eff.countdown_refresh_ms, BASE.countdown_refresh_ms);
  assert.equal(eff.show_next_event, BASE.show_next_event);
});

test('merge with an empty/garbage override == the base config', () => {
  assert.deepEqual(publicPresentation(mergeEventPresentation(BASE, {})), publicPresentation(BASE));
  assert.deepEqual(publicPresentation(mergeEventPresentation(BASE, { preroll_lead_ticks: 'xyz' })), publicPresentation(BASE));
  assert.deepEqual(publicPresentation(mergeEventPresentation(BASE, null)), publicPresentation(BASE));
});

test('merge layers on a NON-default base (ctx operator config), not just the hard default', () => {
  const ctxBase = eventPresentationFromCtx({ eventPresentation: { preroll_lead_ticks: 4, show_featured_chip: 'false' } });
  const eff = mergeEventPresentation(ctxBase, { show_next_event: false });
  assert.equal(eff.preroll_lead_ticks, 4);     // from ctx base
  assert.equal(eff.show_featured_chip, false); // from ctx base
  assert.equal(eff.show_next_event, false);    // from override
});

test('the merged effective config is frozen + clamped (an override cannot escape bounds)', () => {
  const eff = mergeEventPresentation(BASE, { preroll_lead_ticks: 999 });
  assert.equal(eff.preroll_lead_ticks, PRESENTATION_BOUNDS.preroll_lead_ticks.max);
  assert.ok(eff.preroll_lead_ticks < W);
  assert.throws(() => { eff.preroll_lead_ticks = 1; }, TypeError);
});

// ── resolver-capable attachRoomEvents ─────────────────────────────────────────────
test('attachRoomEvents accepts a per-room resolver: rooms get effective, top-level stays base', () => {
  const overrides = { 'neon-training': { preroll_lead_ticks: 5, show_next_event: false } };
  const resolve = (roomId) => roomId ? mergeEventPresentation(BASE, overrides[roomId]) : BASE;
  const out = attachRoomEvents({ schema_version: 1, rooms: [{ room_id: 'main-floor' }, { room_id: 'neon-training' }] }, 3 * W + 1, resolve);
  assert.deepEqual(out.presentation, publicPresentation(BASE)); // top-level = base
  assert.deepEqual(out.rooms.find((r) => r.room_id === 'main-floor').presentation, publicPresentation(BASE));
  const nt = out.rooms.find((r) => r.room_id === 'neon-training');
  assert.equal(nt.presentation.preroll_lead_ticks, 5);
  assert.equal(nt.presentation.show_next_event, false);
});

test('attachRoomEvents stays backward-compatible with a plain config object (v0.5–v0.8 callers)', () => {
  const cfg = eventPresentationFromCtx({ eventPresentation: { countdown_refresh_ms: 2000 } });
  const out = attachRoomEvents({ schema_version: 1, rooms: [{ room_id: 'main-floor' }] }, 3 * W + 1, cfg);
  assert.deepEqual(out.presentation, publicPresentation(cfg));
  assert.deepEqual(out.rooms[0].presentation, publicPresentation(cfg));
});

// ── reducer: room_presentation_override_set (set / clear / authority gate) ─────────
test('reducer stores a sanitized override for the authoring room', () => {
  const res = room_presentation_override_set(createInitialState(), overrideEvent('neon-training', { preroll_lead_ticks: 5, bogus: 1 }));
  assert.equal(res.accepted, true);
  assert.deepEqual(arcadeRoom(res.state.arcade, 'neon-training').presentationOverride, { preroll_lead_ticks: 5 });
});

test('reducer clears the override when the sanitized override is empty', () => {
  let st = room_presentation_override_set(createInitialState(), overrideEvent('neon-training', { preroll_lead_ticks: 5 })).state;
  assert.deepEqual(arcadeRoom(st.arcade, 'neon-training').presentationOverride, { preroll_lead_ticks: 5 });
  st = room_presentation_override_set(st, overrideEvent('neon-training', {})).state;       // explicit clear
  assert.equal(arcadeRoom(st.arcade, 'neon-training').presentationOverride, null);
  // an all-invalid override also clears (sanitizes to {})
  st = room_presentation_override_set(createInitialState(), overrideEvent('neon-training', { preroll_lead_ticks: 5 })).state;
  st = room_presentation_override_set(st, overrideEvent('neon-training', { preroll_lead_ticks: 'nope' })).state;
  assert.equal(arcadeRoom(st.arcade, 'neon-training').presentationOverride, null);
});

test('reducer rejects a non-authoring actor and an unknown room', () => {
  assert.equal(room_presentation_override_set(createInitialState(), overrideEvent('neon-training', { preroll_lead_ticks: 5 }, 'someone-else')).reason, 'not_authority');
  assert.equal(room_presentation_override_set(createInitialState(), overrideEvent('no-such-room', { preroll_lead_ticks: 5 })).reason, 'unknown_room');
});

// ── per-room isolation through the transition_check reducer (display-only) ─────────
test('a per-room override drives that room\'s pre-roll ONLY (isolation, same clock)', () => {
  const sim = new HiveSimulator({ seed: 'v09-iso', staleLockTicks: 1000 });
  const main = sim.addRoom({ id: 'main-floor', name: 'Main Floor' });
  const train = sim.addRoom({ id: 'neon-training', name: 'Neon Training' });
  sim.publish(main.announce(0)); sim.publish(train.announce(0));
  sim.publish(train.setPresentationOverride({ preroll_lead_ticks: 5 }, 1)); // wider lead on neon-training only
  sim.publish(main.observeRoomEvents(4 * W - 4, 2));   // base 2-tick lead → no upcoming at 4 out
  sim.publish(train.observeRoomEvents(4 * W - 4, 3));  // 5-tick override lead → upcoming at 4 out
  sim.advance(1);
  const report = sim.report();
  assert.equal(feedOf(report, 'main-floor').some((e) => e.event_type === 'room_event_upcoming'), false);
  assert.equal(feedOf(report, 'neon-training').some((e) => e.event_type === 'room_event_upcoming'), true);
  assert.deepEqual(overrideOf(report, 'neon-training'), { preroll_lead_ticks: 5 });
  assert.equal(overrideOf(report, 'main-floor'), null);
  assert.equal(report.desyncReport.finalConverged, true);
});

test('an override is presentation-only: the derived schedule transitions are identical to base', () => {
  // A featured-chip override must NOT shift the deterministic start/end schedule.
  const hidden = mergeEventPresentation(BASE, { show_featured_chip: false });
  const a = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', 4 * W, hidden);
  const b = deriveRoomEventTransitions(initialRoomEventTracker(), 'main-floor', 4 * W, BASE);
  assert.deepEqual(a.transitions.map((t) => t.transition_type), b.transitions.map((t) => t.transition_type));
});

test('override + effective config carry no private/economy data', () => {
  const eff = mergeEventPresentation(BASE, { preroll_lead_ticks: 5 });
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify(publicPresentation(eff))), false);
  assert.ok(!/agent:|token|reward|prize|secret/i.test(JSON.stringify(publicPresentation(eff))));
});

// ── scenario ──────────────────────────────────────────────────────────────────────
test('presentationOverrideShowcase: only the overridden room pre-rolls; converged + public-safe', () => {
  const { report } = presentationOverrideShowcase({});
  const main = feedOf(report, 'main-floor');
  const train = feedOf(report, 'neon-training');
  assert.equal(main.some((e) => e.event_type === 'room_event_upcoming'), false);     // base lead → no pre-roll
  assert.deepEqual(train.map((e) => e.event_type), ['room_event_started', 'room_event_upcoming']); // override lead → pre-roll
  assert.deepEqual(overrideOf(report, 'neon-training'), { preroll_lead_ticks: 5 });
  assert.equal(report.desyncReport.finalConverged, true);
  assert.equal(feedIsPublicSafe(main) && feedIsPublicSafe(train), true);
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify([main, train])), false);
  // Under the DEFAULT lead the same observations would NOT pre-roll (display-only effect).
  const def = presentationOverrideShowcase({ overrideLeadTicks: DEFAULT_EVENT_PRESENTATION.preroll_lead_ticks });
  assert.equal(feedOf(def.report, 'neon-training').some((e) => e.event_type === 'room_event_upcoming'), false);
});

test('presentationOverrideShowcase fingerprint is stable across reruns', () => {
  assert.equal(presentationOverrideShowcase({}).report.canonicalFingerprint, presentationOverrideShowcase({}).report.canonicalFingerprint);
});
