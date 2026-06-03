/**
 * Phase 2e — room-scoped scheduled events (PURE, deterministic). Covers the schedule
 * model, current/next derivation, status, registry-list enrichment, catalog
 * annotation, public-safety, and the client-side display helpers. Uses a FAKE `now`
 * everywhere — no test depends on the real time of day.
 *
 * Economy boundary: these tests also assert events never touch a ticket formula, a
 * prize cost, a reward, or a cabinet's availability/status.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_WINDOW_MS, EVENT_TYPES, EVENT_STATUSES, EVENT_SCHEDULES, EVENT_RULESET_VERSION,
  isEventType, isEventStatus, hasRoomEvents, windowIndexFor,
  getCurrentRoomEvent, getNextRoomEvent, getRoomEventSchedule, deriveEventStatus,
  roomEventPublic, attachRoomEvents, roomEventListPayload, annotateCatalogForRoom,
} from '../../workers/arcade/src/room-events.mjs';
import { CABINETS, cabinetCatalogPayload } from '../../workers/arcade/src/catalog.mjs';
import { roomPresenceListPayload } from '../../workers/arcade/src/rooms.mjs';
import {
  roomEventBadge, roomNextEventLabel, roomEventWarmupHint, formatEventCountdown,
} from '../../arcade/room-recommend.mjs';

const W = EVENT_WINDOW_MS;
// A `now` anchored at the MIDDLE of a known window so status is unambiguously active.
const atWindow = (index, offsetMs = 5000) => index * W + offsetMs;

// ── model integrity ──────────────────────────────────────────────────────────────
test('event type + status vocabularies are closed sets', () => {
  assert.deepEqual([...EVENT_TYPES].sort(), ['featured_cabinet', 'late_night_theme', 'quiet_room_prompt', 'room_warmup', 'training_focus'].sort());
  assert.deepEqual([...EVENT_STATUSES].sort(), ['active', 'disabled', 'ended', 'upcoming'].sort());
  assert.equal(isEventType('featured_cabinet'), true);
  assert.equal(isEventType('nope'), false);
  assert.equal(isEventStatus('active'), true);
  assert.equal(isEventStatus('nope'), false);
});

test('the three configured rooms each have a schedule; unknown rooms have none', () => {
  assert.equal(hasRoomEvents('main-floor'), true);
  assert.equal(hasRoomEvents('neon-training'), true);
  assert.equal(hasRoomEvents('late-night-circuit'), true);
  assert.equal(hasRoomEvents('nope'), false);
  for (const def of EVENT_SCHEDULES['main-floor'].events) {
    assert.ok(isEventType(def.event_type), def.event_type);
    assert.equal(typeof def.display_name, 'string');
  }
});

// ── A. schedule determinism + current/next + status ──────────────────────────────
test('schedule is deterministic for the same room + time', () => {
  const now = atWindow(1000);
  const a = getCurrentRoomEvent('main-floor', now);
  const b = getCurrentRoomEvent('main-floor', now);
  assert.equal(a.event_id, b.event_id);
  assert.deepEqual(a, b);
});

test('current event is selected by window bucket + room phase (rotates each window)', () => {
  // main-floor phase 0, 3 events. window 0 -> slot 0 (Pulse Hour), window 1 -> slot 1, ...
  assert.equal(getCurrentRoomEvent('main-floor', atWindow(0)).schedule_key, 'pulse-hour');
  assert.equal(getCurrentRoomEvent('main-floor', atWindow(1)).schedule_key, 'signal-sprint-relay');
  assert.equal(getCurrentRoomEvent('main-floor', atWindow(2)).schedule_key, 'neon-grid-rush');
  assert.equal(getCurrentRoomEvent('main-floor', atWindow(3)).schedule_key, 'pulse-hour'); // wraps
});

test('rooms are desynced by phase (different slot at the same time)', () => {
  const now = atWindow(0);
  assert.equal(getCurrentRoomEvent('main-floor', now).schedule_key, 'pulse-hour');       // phase 0 -> slot 0
  assert.equal(getCurrentRoomEvent('neon-training', now).schedule_key, 'pulse-practice'); // phase 1 -> slot 1
  assert.equal(getCurrentRoomEvent('late-night-circuit', now).schedule_key, 'neon-grid-rush'); // phase 2 -> slot 2
});

test('next event is the following window slot and is upcoming', () => {
  const now = atWindow(0);
  const next = getNextRoomEvent('main-floor', now);
  assert.equal(next.schedule_key, 'signal-sprint-relay');
  assert.equal(next.status, 'upcoming');
  assert.equal(next.starts_at, 1 * W);
});

test('event status is active inside its window, upcoming before, ended after', () => {
  const ev = getCurrentRoomEvent('main-floor', atWindow(5));
  assert.equal(ev.status, 'active');
  assert.equal(deriveEventStatus(ev, ev.starts_at - 1), 'upcoming');
  assert.equal(deriveEventStatus(ev, ev.starts_at), 'active');
  assert.equal(deriveEventStatus(ev, ev.ends_at - 1), 'active');
  assert.equal(deriveEventStatus(ev, ev.ends_at), 'ended');
});

test('window index + bounds are deterministic from now', () => {
  assert.equal(windowIndexFor(atWindow(7)), 7);
  const ev = getCurrentRoomEvent('main-floor', atWindow(7));
  assert.equal(ev.starts_at, 7 * W);
  assert.equal(ev.ends_at, 8 * W);
  assert.equal(ev.duration_ms, W);
});

test('unknown room returns null/empty safe defaults', () => {
  assert.equal(getCurrentRoomEvent('nope', atWindow(0)), null);
  assert.equal(getNextRoomEvent('nope', atWindow(0)), null);
  assert.deepEqual(getRoomEventSchedule('nope', atWindow(0)), []);
});

test('getRoomEventSchedule returns one full rotation starting at the current window', () => {
  const sched = getRoomEventSchedule('main-floor', atWindow(0));
  assert.equal(sched.length, 3);
  assert.deepEqual(sched.map((e) => e.schedule_key), ['pulse-hour', 'signal-sprint-relay', 'neon-grid-rush']);
  assert.equal(sched[0].status, 'active');
  assert.equal(sched[1].status, 'upcoming');
});

test('featured cabinet resolves to a real, playable cabinet; room-wide events have none', () => {
  const pulseHour = getCurrentRoomEvent('main-floor', atWindow(0));
  assert.equal(pulseHour.featured_cabinet_id, 'pulse-tap-01');
  assert.equal(pulseHour.featured_cabinet_type, 'pulse_tap');
  const trainingFocus = getCurrentRoomEvent('neon-training', atWindow(2)); // phase1 -> slot (2+1)%3=0 -> training-focus
  assert.equal(trainingFocus.schedule_key, 'training-focus');
  assert.equal(trainingFocus.featured_cabinet_id, null);
  assert.equal(trainingFocus.featured_cabinet_type, null);
});

// ── public safety ────────────────────────────────────────────────────────────────
test('event payloads are public-safe (no private data, flagged public_safe)', () => {
  const ev = getCurrentRoomEvent('main-floor', atWindow(0));
  assert.equal(ev.public_safe, true);
  assert.equal(ev.visibility, 'public');
  assert.equal(ev.ruleset_version, EVENT_RULESET_VERSION);
  const json = JSON.stringify(roomEventListPayload('main-floor', atWindow(0)));
  assert.ok(!/balance|ledger|inventory|player|actor|token|socket|secret/i.test(json), json);
});

// ── B. registry-list enrichment ──────────────────────────────────────────────────
test('attachRoomEvents enriches each room entry with current/next + countdowns', () => {
  const now = atWindow(0, 1000);
  const base = roomPresenceListPayload({}, {}, now); // empty heartbeats -> all rooms unknown/0 pop
  const enriched = attachRoomEvents(base, now);
  assert.equal(enriched.event_ruleset_version, EVENT_RULESET_VERSION);
  const mf = enriched.rooms.find((r) => r.room_id === 'main-floor');
  assert.equal(mf.current_event.schedule_key, 'pulse-hour');
  assert.equal(mf.next_event.schedule_key, 'signal-sprint-relay');
  assert.equal(mf.featured_cabinet_id, 'pulse-tap-01');
  assert.equal(mf.event_ends_in_ms, W - 1000);
  assert.equal(mf.event_starts_in_ms, W - 1000); // ms until next window begins
  // health/population fields from Phase 2c are preserved
  assert.ok('health' in mf && 'population' in mf && 'status' in mf);
});

test('attachRoomEvents preserves closed/maintenance status while still showing events', () => {
  const now = atWindow(0);
  const base = roomPresenceListPayload({}, { 'main-floor': 'maintenance' }, now);
  const enriched = attachRoomEvents(base, now);
  const mf = enriched.rooms.find((r) => r.room_id === 'main-floor');
  assert.equal(mf.status, 'maintenance'); // join gating unchanged
  assert.ok(mf.current_event); // event still displays
});

test('enriched room list never leaks private data', () => {
  const now = atWindow(3);
  const json = JSON.stringify(attachRoomEvents(roomPresenceListPayload({}, {}, now), now));
  assert.ok(!/balance|ledger|inventory|"player|actor_public|token|secret/i.test(json), json);
});

// ── C. catalog annotation ────────────────────────────────────────────────────────
test('catalog annotation marks ONLY the current featured cabinet, others false', () => {
  const now = atWindow(0); // main-floor -> Pulse Hour -> pulse-tap-01
  const ann = annotateCatalogForRoom(cabinetCatalogPayload(), 'main-floor', now);
  const featured = ann.cabinets.filter((c) => c.is_featured);
  assert.equal(featured.length, 1);
  assert.equal(featured[0].cabinet_id, 'pulse-tap-01');
  assert.equal(featured[0].featured_reason, 'Pulse Hour');
  assert.ok(typeof featured[0].featured_event_id === 'string' && featured[0].featured_event_id.length > 0);
  for (const c of ann.cabinets) if (c.cabinet_id !== 'pulse-tap-01') assert.equal(c.is_featured, false);
});

test('annotation does NOT change ticket formula fields, status, or availability', () => {
  const now = atWindow(0);
  const ann = annotateCatalogForRoom(cabinetCatalogPayload(), 'main-floor', now);
  for (const c of ann.cabinets) {
    const src = CABINETS.find((x) => x.cabinet_id === c.cabinet_id);
    assert.equal(c.status, src.status);                 // availability untouched
    assert.equal(c.ticket_enabled, src.ticket_enabled); // economy untouched
    assert.equal(c.ruleset_version, src.ruleset_version);
    assert.equal(c.machine_id, src.machine_id);
  }
});

test('annotation fails safe when the event has no valid featured cabinet (room-wide event)', () => {
  // neon-training at window 0 -> Pulse Practice (featured pulse). Use window where it is a room-wide event.
  const now = atWindow(2); // neon-training phase1 -> slot 0 -> training-focus (featured null)
  assert.equal(getCurrentRoomEvent('neon-training', now).featured_cabinet_id, null);
  const ann = annotateCatalogForRoom(cabinetCatalogPayload(), 'neon-training', now);
  assert.equal(ann.cabinets.filter((c) => c.is_featured).length, 0);
});

test('annotation for an unknown room marks nothing featured', () => {
  const ann = annotateCatalogForRoom(cabinetCatalogPayload(), 'nope', atWindow(0));
  assert.equal(ann.cabinets.filter((c) => c.is_featured).length, 0);
});

// ── D. feed transitions (DEFERRED in Phase 2e) ───────────────────────────────────
// Live room-feed event_started/ended transitions are intentionally deferred to keep
// the ArcadeRoom DO authority surface minimal and the DO/shim feed byte-identical
// (the DO has a 30s alarm; the shim has no timer — announcing on a tick would diverge).
// Instead we assert the deterministic event_id that a future transition detector would
// compare is stable within a window and flips across windows.
test('event_id is stable within a window and flips across windows (transition basis)', () => {
  const a = getCurrentRoomEvent('main-floor', atWindow(10, 1000)).event_id;
  const b = getCurrentRoomEvent('main-floor', atWindow(10, 9000)).event_id;
  const c = getCurrentRoomEvent('main-floor', atWindow(11, 1000)).event_id;
  assert.equal(a, b);          // same window -> same id (no feed spam)
  assert.notEqual(a, c);       // window flip -> new id (a transition point)
});

// ── E. client display helpers (room-recommend Phase 2e additions) ────────────────
const roomWith = (over = {}) => ({
  room_id: 'main-floor', display_name: 'Main Floor', status: 'open', health: 'healthy',
  capacity: 32, population: 5, ...over,
});

test('roomEventBadge surfaces the current event display fields (or null)', () => {
  const ev = getCurrentRoomEvent('main-floor', atWindow(0));
  const badge = roomEventBadge(roomWith({ current_event: ev, event_ends_in_ms: 120000 }));
  assert.equal(badge.label, 'Pulse Hour');
  assert.equal(badge.kind, 'featured_cabinet');
  assert.equal(badge.kind_label, 'Featured now');
  assert.equal(badge.featured_cabinet_id, 'pulse-tap-01');
  assert.equal(badge.ends_in_ms, 120000);
  assert.equal(roomEventBadge(roomWith({ current_event: null })), null);
  assert.equal(roomEventBadge(roomWith({})), null);
});

test('roomNextEventLabel reads next_event display name (or null)', () => {
  const nx = getNextRoomEvent('main-floor', atWindow(0));
  assert.equal(roomNextEventLabel(roomWith({ next_event: nx })), 'Signal Sprint Relay');
  assert.equal(roomNextEventLabel(roomWith({})), null);
});

test('roomEventWarmupHint fires for an empty/quiet joinable room with an event, not a busy one', () => {
  const ev = getCurrentRoomEvent('neon-training', atWindow(2)); // training-focus
  const empty = roomWith({ room_id: 'neon-training', population: 0, current_event: ev });
  assert.match(roomEventWarmupHint(empty), /warm up/i);
  const busy = roomWith({ population: 12, current_event: getCurrentRoomEvent('main-floor', atWindow(0)) });
  assert.equal(roomEventWarmupHint(busy), null);
  const closed = roomWith({ status: 'closed', population: 0, current_event: ev });
  assert.equal(roomEventWarmupHint(closed), null); // not joinable
});

test('warmup hint copy carries no money/economy framing', () => {
  const ev = getCurrentRoomEvent('main-floor', atWindow(0));
  const hint = roomEventWarmupHint(roomWith({ population: 0, current_event: ev })) || '';
  assert.ok(!/jackpot|multiplier|boost|payout|win more|reward|prize|profit|cash/i.test(hint), hint);
});

test('formatEventCountdown renders human spans without leaking precision', () => {
  assert.equal(formatEventCountdown(0), 'now');
  assert.equal(formatEventCountdown(500), 'now');
  assert.equal(formatEventCountdown(45000), '45s');
  assert.equal(formatEventCountdown(12 * 60000), '12m');
  assert.equal(formatEventCountdown(2 * 3600000), '2h');
});
