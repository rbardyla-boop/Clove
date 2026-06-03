/**
 * Phase 2i — per-room presentation overrides (PURE). Covers the sanitize/merge helpers
 * (validate, clamp, drop-invalid, store-only-set-keys), the resolver-capable
 * attachRoomEvents (each room reflects its EFFECTIVE config while the top-level stays the
 * base), and the new admin op set. All DISPLAY-ONLY: an override can never change a ticket
 * formula, reward, schedule, or authority — only how an event is presented.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_WINDOW_MS, DEFAULT_EVENT_PRESENTATION, PRESENTATION_BOUNDS, PRESENTATION_KEYS,
  resolveEventPresentation, eventPresentationFromEnv, publicPresentation,
  sanitizeEventPresentationOverride, mergeEventPresentation,
  attachRoomEvents, roomEventListPayload, initialEventTracker, deriveRoomEventTransitions,
} from '../../workers/arcade/src/room-events.mjs';
import { ADMIN_OPS, isAdminOp } from '../../workers/arcade/src/admin.mjs';

const W = EVENT_WINDOW_MS;
const BASE = eventPresentationFromEnv({}); // == DEFAULT_EVENT_PRESENTATION

// ── sanitize: only known + set + valid keys, clamped; invalid dropped ──────────────
test('sanitize keeps only the known, set, valid keys (clamped) — never fills defaults', () => {
  // empty / garbage → no override at all
  assert.deepEqual(sanitizeEventPresentationOverride({}), {});
  assert.deepEqual(sanitizeEventPresentationOverride(null), {});
  assert.deepEqual(sanitizeEventPresentationOverride('nope'), {});
  assert.deepEqual(sanitizeEventPresentationOverride({ bogus: 1, what: 'x' }), {});
  // only the keys the operator actually set survive
  assert.deepEqual(sanitizeEventPresentationOverride({ preroll_lead_ms: 300000 }), { preroll_lead_ms: 300000 });
  assert.deepEqual(
    sanitizeEventPresentationOverride({ preroll_lead_ms: 300000, show_next_event: 'false', bogus: 9 }),
    { preroll_lead_ms: 300000, show_next_event: false },
  );
});

test('sanitize DROPS invalid values (they fall through to base) instead of storing a default', () => {
  // a non-numeric numeric field is dropped, not coerced to the default
  assert.deepEqual(sanitizeEventPresentationOverride({ preroll_lead_ms: 'abc' }), {});
  assert.deepEqual(sanitizeEventPresentationOverride({ countdown_refresh_ms: '' }), {});
  // a bad boolean literal is dropped
  assert.deepEqual(sanitizeEventPresentationOverride({ show_next_event: 'maybe' }), {});
  // mixed: valid kept, invalid dropped
  assert.deepEqual(
    sanitizeEventPresentationOverride({ preroll_lead_ms: 'abc', show_featured_chip: false }),
    { show_featured_chip: false },
  );
});

test('sanitize clamps an out-of-bounds value to the bound (and only that key)', () => {
  assert.deepEqual(sanitizeEventPresentationOverride({ preroll_lead_ms: 999999999 }), { preroll_lead_ms: PRESENTATION_BOUNDS.preroll_lead_ms.max });
  assert.deepEqual(sanitizeEventPresentationOverride({ preroll_lead_ms: 1 }), { preroll_lead_ms: PRESENTATION_BOUNDS.preroll_lead_ms.min });
  assert.deepEqual(sanitizeEventPresentationOverride({ countdown_refresh_ms: 10_000_000 }), { countdown_refresh_ms: PRESENTATION_BOUNDS.countdown_refresh_ms.max });
});

test('the tunable keys are exactly the four presentation fields', () => {
  assert.deepEqual([...PRESENTATION_KEYS].sort(), ['countdown_refresh_ms', 'preroll_lead_ms', 'show_featured_chip', 'show_next_event']);
});

// ── merge: base ⊕ override, missing keys fall through, result re-validated + frozen ──
test('merge applies the override on top of the base; missing keys fall through to base', () => {
  const eff = mergeEventPresentation(BASE, { preroll_lead_ms: 300000 });
  assert.equal(eff.preroll_lead_ms, 300000);                                  // overridden
  assert.equal(eff.countdown_refresh_ms, BASE.countdown_refresh_ms);          // fell through
  assert.equal(eff.show_next_event, BASE.show_next_event);                    // fell through
});

test('merge with an empty/garbage override == the base config', () => {
  assert.deepEqual(publicPresentation(mergeEventPresentation(BASE, {})), publicPresentation(BASE));
  assert.deepEqual(publicPresentation(mergeEventPresentation(BASE, { preroll_lead_ms: 'xyz' })), publicPresentation(BASE));
  assert.deepEqual(publicPresentation(mergeEventPresentation(BASE, null)), publicPresentation(BASE));
});

test('merge layers on a NON-default base (env operator config), not just the hard default', () => {
  const envBase = eventPresentationFromEnv({ EVENT_PREROLL_LEAD_MS: '180000', EVENT_SHOW_FEATURED: 'false' });
  const eff = mergeEventPresentation(envBase, { show_next_event: false });
  assert.equal(eff.preroll_lead_ms, 180000);        // from env base
  assert.equal(eff.show_featured_chip, false);      // from env base
  assert.equal(eff.show_next_event, false);         // from override
});

test('the merged effective config is frozen + clamped (an override cannot escape bounds)', () => {
  const eff = mergeEventPresentation(BASE, { preroll_lead_ms: 999999999 });
  assert.equal(eff.preroll_lead_ms, PRESENTATION_BOUNDS.preroll_lead_ms.max);
  assert.ok(eff.preroll_lead_ms < W);
  assert.throws(() => { eff.preroll_lead_ms = 5; }, TypeError);
});

// ── attachRoomEvents resolver: each room reflects its effective config ──────────────
test('attachRoomEvents accepts a per-room resolver: rooms get effective, top-level stays base', () => {
  const overrides = { 'neon-training': { preroll_lead_ms: 300000, show_next_event: false } };
  const resolve = (roomId) => roomId ? mergeEventPresentation(BASE, overrides[roomId]) : BASE;
  const list = { schema_version: 1, rooms: [{ room_id: 'main-floor' }, { room_id: 'neon-training' }] };
  const out = attachRoomEvents(list, 3 * W + 1000, resolve);
  // top-level presentation = base
  assert.deepEqual(out.presentation, publicPresentation(BASE));
  const main = out.rooms.find((r) => r.room_id === 'main-floor');
  const training = out.rooms.find((r) => r.room_id === 'neon-training');
  // main-floor has no override → base; neon-training reflects its override
  assert.deepEqual(main.presentation, publicPresentation(BASE));
  assert.equal(training.presentation.preroll_lead_ms, 300000);
  assert.equal(training.presentation.show_next_event, false);
});

test('attachRoomEvents stays backward-compatible with a plain config object (Phase 2e/2h callers)', () => {
  const cfg = eventPresentationFromEnv({ EVENT_COUNTDOWN_REFRESH_MS: '2000' });
  const list = { schema_version: 1, rooms: [{ room_id: 'main-floor' }] };
  const out = attachRoomEvents(list, 3 * W + 1000, cfg);
  assert.deepEqual(out.presentation, publicPresentation(cfg));
  assert.deepEqual(out.rooms[0].presentation, publicPresentation(cfg));
});

test('a per-room override changes ONLY that room — schedule/economy stay identical', () => {
  const overrides = { 'neon-training': { show_featured_chip: false } };
  const resolve = (roomId) => roomId ? mergeEventPresentation(BASE, overrides[roomId]) : BASE;
  const out = attachRoomEvents({ schema_version: 1, rooms: [{ room_id: 'main-floor' }, { room_id: 'neon-training' }] }, 3 * W + 1000, resolve);
  const baseline = attachRoomEvents({ schema_version: 1, rooms: [{ room_id: 'main-floor' }, { room_id: 'neon-training' }] }, 3 * W + 1000, BASE);
  const mainOv = out.rooms.find((r) => r.room_id === 'main-floor');
  const mainBase = baseline.rooms.find((r) => r.room_id === 'main-floor');
  // The non-overridden room's event fields (current/next/featured machine) are unchanged.
  assert.equal(mainOv.event_id, mainBase.event_id);
  assert.equal(mainOv.next_event_id, mainBase.next_event_id);
  assert.equal(mainOv.featured_machine_id, mainBase.featured_machine_id);
});

test('override is presentation-only: the derived schedule transitions are identical to base', () => {
  // A featured-chip override must NOT shift the deterministic start/end schedule.
  const cfgHidden = mergeEventPresentation(BASE, { show_featured_chip: false });
  const a = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', 4 * W, cfgHidden);
  const b = deriveRoomEventTransitions(initialEventTracker(), 'main-floor', 4 * W, BASE);
  assert.deepEqual(a.transitions.map((t) => t.transition_type), b.transitions.map((t) => t.transition_type));
});

test('override carries no private/economy data', () => {
  const eff = mergeEventPresentation(BASE, { preroll_lead_ms: 300000 });
  assert.ok(!/balance|ledger|inventory|token|reward|prize|secret/i.test(JSON.stringify(publicPresentation(eff))));
});

// ── admin op set (Phase 2i) ────────────────────────────────────────────────────────
test('the four presentation ops are registered admin ops', () => {
  for (const op of ['set_presentation', 'clear_presentation', 'preview_presentation', 'presentation_diagnostics']) {
    assert.equal(isAdminOp(op), true);
    assert.ok(ADMIN_OPS.includes(op));
  }
  assert.equal(isAdminOp('grant_tickets'), false); // economy ops are not admin ops
});
