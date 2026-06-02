/**
 * Phase 2h — operator-tunable event presentation (PURE). Covers config resolution +
 * validation/clamping, env parsing, the config-threaded pre-roll lead (a wider/narrower
 * operator lead changes when `upcoming` fires + `event_upcoming` flips), the public
 * `presentation` block on the payloads, and the live m:ss countdown formatter. All
 * DISPLAY-ONLY: a config value can never change a ticket formula, reward, or authority.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_WINDOW_MS, PREROLL_LEAD_MS, DEFAULT_EVENT_PRESENTATION, PRESENTATION_BOUNDS,
  resolveEventPresentation, eventPresentationFromEnv, publicPresentation,
  deriveRoomEventTransitions, initialEventTracker, roomEventPublic, roomEventListPayload, attachRoomEvents,
} from '../../workers/arcade/src/room-events.mjs';
import { formatPrerollCountdown } from '../../arcade/room-recommend.mjs';

const W = EVENT_WINDOW_MS;

// ── config defaults + validation/clamping ────────────────────────────────────────
test('defaults match Phase 2g behaviour (preroll lead = PREROLL_LEAD_MS)', () => {
  assert.equal(DEFAULT_EVENT_PRESENTATION.preroll_lead_ms, PREROLL_LEAD_MS);
  assert.equal(DEFAULT_EVENT_PRESENTATION.countdown_refresh_ms, 1000);
  assert.equal(DEFAULT_EVENT_PRESENTATION.show_next_event, true);
  assert.equal(DEFAULT_EVENT_PRESENTATION.show_featured_chip, true);
  assert.deepEqual(resolveEventPresentation({}), DEFAULT_EVENT_PRESENTATION);
  assert.deepEqual(resolveEventPresentation(undefined), DEFAULT_EVENT_PRESENTATION);
});

test('preroll lead is clamped to safe bounds; bad values fall back to default', () => {
  assert.equal(resolveEventPresentation({ preroll_lead_ms: 999999999 }).preroll_lead_ms, PRESENTATION_BOUNDS.preroll_lead_ms.max);
  assert.equal(resolveEventPresentation({ preroll_lead_ms: 1 }).preroll_lead_ms, PRESENTATION_BOUNDS.preroll_lead_ms.min);
  assert.equal(resolveEventPresentation({ preroll_lead_ms: 'nope' }).preroll_lead_ms, PREROLL_LEAD_MS);
  assert.ok(PRESENTATION_BOUNDS.preroll_lead_ms.max < W); // never spans the whole window
});

test('countdown refresh is clamped; booleans are coerced from strings/numbers', () => {
  assert.equal(resolveEventPresentation({ countdown_refresh_ms: 1 }).countdown_refresh_ms, PRESENTATION_BOUNDS.countdown_refresh_ms.min);
  assert.equal(resolveEventPresentation({ countdown_refresh_ms: 10_000_000 }).countdown_refresh_ms, PRESENTATION_BOUNDS.countdown_refresh_ms.max);
  assert.equal(resolveEventPresentation({ show_next_event: 'false' }).show_next_event, false);
  assert.equal(resolveEventPresentation({ show_featured_chip: '0' }).show_featured_chip, false);
  assert.equal(resolveEventPresentation({ show_next_event: 'true' }).show_next_event, true);
  assert.equal(resolveEventPresentation({ show_next_event: 'garbage' }).show_next_event, true); // → default
});

test('the resolved config is frozen (immutable)', () => {
  const c = resolveEventPresentation({});
  assert.throws(() => { c.preroll_lead_ms = 5; }, TypeError);
});

test('eventPresentationFromEnv parses the EVENT_* keys with the same validation', () => {
  const c = eventPresentationFromEnv({ EVENT_PREROLL_LEAD_MS: '300000', EVENT_COUNTDOWN_REFRESH_MS: '500', EVENT_SHOW_NEXT: 'false', EVENT_SHOW_FEATURED: 'true' });
  assert.equal(c.preroll_lead_ms, 300000);
  assert.equal(c.countdown_refresh_ms, 500);
  assert.equal(c.show_next_event, false);
  assert.equal(c.show_featured_chip, true);
  assert.deepEqual(eventPresentationFromEnv({}), DEFAULT_EVENT_PRESENTATION); // absent → defaults
  assert.deepEqual(eventPresentationFromEnv(undefined), DEFAULT_EVENT_PRESENTATION);
});

// ── config-threaded pre-roll (the operator lead changes when upcoming fires) ──────
test('a wider operator pre-roll lead makes the upcoming fire earlier', () => {
  const wide = eventPresentationFromEnv({ EVENT_PREROLL_LEAD_MS: '300000' }); // 5 min
  // 4 min before window 4 → within a 5-min lead but NOT within the default 2-min lead
  let tk = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', 3 * W + 1000, wide).state;
  const r = deriveRoomEventTransitions(tk, 'main-floor', 4 * W - 4 * 60 * 1000, wide);
  assert.deepEqual(r.transitions.map((t) => t.transition_type), ['upcoming']);
  // same observation under the DEFAULT lead → no upcoming yet
  let tk2 = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', 3 * W + 1000).state;
  assert.deepEqual(deriveRoomEventTransitions(tk2, 'main-floor', 4 * W - 4 * 60 * 1000).transitions, []);
});

test('event_upcoming flag on the payloads honors the operator lead', () => {
  const wide = eventPresentationFromEnv({ EVENT_PREROLL_LEAD_MS: '300000' });
  const t = 4 * W - 4 * 60 * 1000; // 4 min out
  assert.equal(roomEventPublic('main-floor', t, wide).event_upcoming, true);
  assert.equal(roomEventPublic('main-floor', t).event_upcoming, false); // default 2-min lead
  assert.equal(roomEventListPayload('main-floor', t, wide).event_upcoming, true);
});

// ── public presentation block surfaced on the payloads ───────────────────────────
test('roomEventListPayload + attachRoomEvents surface the public presentation block', () => {
  const cfg = eventPresentationFromEnv({ EVENT_COUNTDOWN_REFRESH_MS: '2000', EVENT_SHOW_FEATURED: 'false' });
  const list = roomEventListPayload('main-floor', 3 * W + 1000, cfg);
  assert.deepEqual(list.presentation, publicPresentation(cfg));
  assert.equal(list.presentation.countdown_refresh_ms, 2000);
  assert.equal(list.presentation.show_featured_chip, false);
  const enriched = attachRoomEvents({ schema_version: 1, rooms: [{ room_id: 'main-floor' }] }, 3 * W + 1000, cfg);
  assert.deepEqual(enriched.presentation, publicPresentation(cfg));
  // presentation carries no private/economy data
  assert.ok(!/balance|ledger|inventory|token|reward/i.test(JSON.stringify(list.presentation)));
});

// ── live countdown formatter ─────────────────────────────────────────────────────
test('formatPrerollCountdown renders a live m:ss that ticks each second', () => {
  assert.equal(formatPrerollCountdown(120000), '2:00');
  assert.equal(formatPrerollCountdown(119000), '1:59');
  assert.equal(formatPrerollCountdown(65000), '1:05');
  assert.equal(formatPrerollCountdown(9000), '0:09');
  assert.equal(formatPrerollCountdown(0), '0:00');
  assert.equal(formatPrerollCountdown(-500), '0:00');
});
