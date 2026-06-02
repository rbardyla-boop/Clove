/**
 * v0.5 parity — scheduled room events in the simulator.
 *
 * Mirrors product Phase 2e (workers/arcade/src/room-events.mjs). Proves the simulator's
 * room-event model is a deterministic projection of room id + logical TICK (the tick
 * analog of the product's ms window), that it enriches the v0.3 folded presence list +
 * annotates the catalog + drives event-aware recommendation copy, all DISPLAY-ONLY and
 * public-safe, with no fold authority and no economy change. Live feed transitions are
 * DEFERRED (mirroring the product) — the deterministic `event_id` is the documented basis.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_WINDOW_TICKS, EVENT_TYPES, EVENT_STATUSES, EVENT_SCHEDULES, EVENT_RULESET_VERSION,
  isEventType, isEventStatus, hasRoomEvents, windowIndexFor,
  getCurrentRoomEvent, getNextRoomEvent, getRoomEventSchedule, deriveEventStatus,
  roomEventPublic, attachRoomEvents, roomEventListPayload, annotateCatalogForRoom,
} from '../../arcade/hiveworld-sim/core/phase1/room-events.mjs';
import { CABINETS, cabinetCatalogPayload } from '../../arcade/hiveworld-sim/core/phase1/catalog.mjs';
import { roomPresenceListPayload } from '../../arcade/hiveworld-sim/core/phase1/rooms.mjs';
import {
  roomEventBadge, roomNextEventLabel, roomEventWarmupHint, formatEventCountdown,
  recommendRooms, sortRoomsForLobby, roomActivity,
} from '../../arcade/hiveworld-sim/core/phase1/room-recommend.mjs';
import { ROOM_EVENT_SIDEBAND, sidebandForRoomEvent, PRIVATE_FIELD_RE } from '../../arcade/hiveworld-sim/core/phase1/sideband-map.mjs';
import { roomEventWindowShowcase } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';

const W = EVENT_WINDOW_TICKS;
const atWindow = (index, offset = 1) => index * W + offset; // mid-window tick

// ── model integrity (mirror of product) ──────────────────────────────────────────
test('event type + status vocabularies match the product closed sets', () => {
  assert.deepEqual([...EVENT_TYPES].sort(), ['featured_cabinet', 'late_night_theme', 'quiet_room_prompt', 'room_warmup', 'training_focus'].sort());
  assert.deepEqual([...EVENT_STATUSES].sort(), ['active', 'disabled', 'ended', 'upcoming'].sort());
  assert.equal(isEventType('featured_cabinet'), true);
  assert.equal(isEventStatus('active'), true);
  assert.equal(EVENT_RULESET_VERSION, 'arcade-events/1'); // same version string as product
});

test('the three configured rooms each have a schedule; unknown rooms have none', () => {
  assert.equal(hasRoomEvents('main-floor'), true);
  assert.equal(hasRoomEvents('neon-training'), true);
  assert.equal(hasRoomEvents('late-night-circuit'), true);
  assert.equal(hasRoomEvents('nope'), false);
});

// ── A. schedule determinism + current/next + status (tick clock) ──────────────────
test('schedule is deterministic for the same room + tick', () => {
  const t = atWindow(1000);
  assert.deepEqual(getCurrentRoomEvent('main-floor', t), getCurrentRoomEvent('main-floor', t));
});

test('current event rotates by window bucket + room phase (same keys as product)', () => {
  assert.equal(getCurrentRoomEvent('main-floor', atWindow(0)).schedule_key, 'pulse-hour');
  assert.equal(getCurrentRoomEvent('main-floor', atWindow(1)).schedule_key, 'signal-sprint-relay');
  assert.equal(getCurrentRoomEvent('main-floor', atWindow(2)).schedule_key, 'neon-grid-rush');
  assert.equal(getCurrentRoomEvent('main-floor', atWindow(3)).schedule_key, 'pulse-hour'); // wraps
});

test('rooms are desynced by phase at the same tick', () => {
  const t = atWindow(0);
  assert.equal(getCurrentRoomEvent('main-floor', t).schedule_key, 'pulse-hour');         // phase 0 → slot 0
  assert.equal(getCurrentRoomEvent('neon-training', t).schedule_key, 'pulse-practice');  // phase 1 → slot 1
  assert.equal(getCurrentRoomEvent('late-night-circuit', t).schedule_key, 'neon-grid-rush'); // phase 2 → slot 2
});

test('next event is the following window slot and is upcoming', () => {
  const next = getNextRoomEvent('main-floor', atWindow(0));
  assert.equal(next.schedule_key, 'signal-sprint-relay');
  assert.equal(next.status, 'upcoming');
  assert.equal(next.starts_at_tick, 1 * W);
});

test('event status is active inside its window, upcoming before, ended after', () => {
  const ev = getCurrentRoomEvent('main-floor', atWindow(5));
  assert.equal(ev.status, 'active');
  assert.equal(deriveEventStatus(ev, ev.starts_at_tick - 1), 'upcoming');
  assert.equal(deriveEventStatus(ev, ev.starts_at_tick), 'active');
  assert.equal(deriveEventStatus(ev, ev.ends_at_tick - 1), 'active');
  assert.equal(deriveEventStatus(ev, ev.ends_at_tick), 'ended');
});

test('window index + bounds are deterministic from the tick', () => {
  assert.equal(windowIndexFor(atWindow(7)), 7);
  const ev = getCurrentRoomEvent('main-floor', atWindow(7));
  assert.equal(ev.starts_at_tick, 7 * W);
  assert.equal(ev.ends_at_tick, 8 * W);
  assert.equal(ev.duration_ticks, W);
});

test('unknown room returns null/empty safe defaults', () => {
  assert.equal(getCurrentRoomEvent('nope', atWindow(0)), null);
  assert.equal(getNextRoomEvent('nope', atWindow(0)), null);
  assert.deepEqual(getRoomEventSchedule('nope', atWindow(0)), []);
});

test('getRoomEventSchedule returns one full rotation from the current window', () => {
  const sched = getRoomEventSchedule('main-floor', atWindow(0));
  assert.deepEqual(sched.map((e) => e.schedule_key), ['pulse-hour', 'signal-sprint-relay', 'neon-grid-rush']);
  assert.equal(sched[0].status, 'active');
  assert.equal(sched[1].status, 'upcoming');
});

test('featured cabinet resolves to a real, live cabinet; room-wide events have none', () => {
  const pulseHour = getCurrentRoomEvent('main-floor', atWindow(0));
  assert.equal(pulseHour.featured_cabinet_id, 'pulse-tap-01');
  assert.equal(pulseHour.featured_cabinet_type, 'pulse_tap');
  const trainingFocus = getCurrentRoomEvent('neon-training', atWindow(2)); // phase1 → slot 0 → training-focus
  assert.equal(trainingFocus.schedule_key, 'training-focus');
  assert.equal(trainingFocus.featured_cabinet_id, null);
});

// ── public safety ────────────────────────────────────────────────────────────────
test('event payloads are public-safe (flagged, no private fold data)', () => {
  const ev = getCurrentRoomEvent('main-floor', atWindow(0));
  assert.equal(ev.public_safe, true);
  assert.equal(ev.visibility, 'public');
  const json = JSON.stringify(roomEventListPayload('main-floor', atWindow(0)));
  assert.equal(PRIVATE_FIELD_RE.test(json), false);
  assert.ok(!/agent:|token|occupied_cabinet|active_connection/i.test(json), json);
});

// ── B. registry/presence-list enrichment ─────────────────────────────────────────
test('attachRoomEvents enriches each presence entry with current/next + tick countdowns', () => {
  const t = atWindow(0, 3);
  const base = roomPresenceListPayload({}, {}, t); // empty heartbeats → unknown/0 pop
  const enriched = attachRoomEvents(base, t);
  assert.equal(enriched.event_ruleset_version, EVENT_RULESET_VERSION);
  const mf = enriched.rooms.find((r) => r.room_id === 'main-floor');
  assert.equal(mf.current_event.schedule_key, 'pulse-hour');
  assert.equal(mf.next_event.schedule_key, 'signal-sprint-relay');
  assert.equal(mf.featured_cabinet_id, 'pulse-tap-01');
  assert.equal(mf.event_ends_in_ticks, W - 3);
  assert.equal(mf.event_starts_in_ticks, W - 3);
  assert.ok('health' in mf && 'population' in mf && 'status' in mf); // v0.3 fields preserved
});

test('attachRoomEvents preserves closed/maintenance status while still showing events', () => {
  const t = atWindow(0);
  const enriched = attachRoomEvents(roomPresenceListPayload({}, { 'main-floor': 'maintenance' }, t), t);
  const mf = enriched.rooms.find((r) => r.room_id === 'main-floor');
  assert.equal(mf.status, 'maintenance');
  assert.ok(mf.current_event);
});

test('enriched presence list never leaks private data', () => {
  const t = atWindow(3);
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify(attachRoomEvents(roomPresenceListPayload({}, {}, t), t))), false);
});

// ── C. catalog annotation ────────────────────────────────────────────────────────
test('catalog annotation marks ONLY the current featured cabinet, others false', () => {
  const t = atWindow(0); // main-floor → Pulse Hour → pulse-tap-01
  const ann = annotateCatalogForRoom(cabinetCatalogPayload(), 'main-floor', t);
  const featured = ann.cabinets.filter((c) => c.is_featured);
  assert.equal(featured.length, 1);
  assert.equal(featured[0].cabinet_id, 'pulse-tap-01');
  assert.equal(featured[0].featured_reason, 'Pulse Hour');
  assert.ok(typeof featured[0].featured_event_id === 'string' && featured[0].featured_event_id.length > 0);
  for (const c of ann.cabinets) if (c.cabinet_id !== 'pulse-tap-01') assert.equal(c.is_featured, false);
});

test('annotation does NOT change ticket formula fields, status, or availability', () => {
  const ann = annotateCatalogForRoom(cabinetCatalogPayload(), 'main-floor', atWindow(0));
  for (const c of ann.cabinets) {
    const src = CABINETS.find((x) => x.cabinet_id === c.cabinet_id);
    assert.equal(c.status, src.status);
    assert.equal(c.ticket_enabled, src.ticket_enabled);
    assert.equal(c.ruleset_version, src.ruleset_version);
    assert.equal(c.machine_id, src.machine_id);
  }
});

test('annotation fails safe for a room-wide event and for unknown rooms', () => {
  const t = atWindow(2); // neon-training phase1 → slot 0 → training-focus (featured null)
  assert.equal(getCurrentRoomEvent('neon-training', t).featured_cabinet_id, null);
  assert.equal(annotateCatalogForRoom(cabinetCatalogPayload(), 'neon-training', t).cabinets.filter((c) => c.is_featured).length, 0);
  assert.equal(annotateCatalogForRoom(cabinetCatalogPayload(), 'nope', t).cabinets.filter((c) => c.is_featured).length, 0);
});

// ── D. feed transitions DEFERRED + sideband mapping ──────────────────────────────
test('event_id is stable within a window and flips across windows (transition basis)', () => {
  const a = getCurrentRoomEvent('main-floor', atWindow(10, 1)).event_id;
  const b = getCurrentRoomEvent('main-floor', atWindow(10, 9)).event_id;
  const c = getCurrentRoomEvent('main-floor', atWindow(11, 1)).event_id;
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('room-event sideband mapping: room-wide on weather, featured annotation on discovery', () => {
  assert.equal(sidebandForRoomEvent('room_event'), 'weather');
  assert.equal(sidebandForRoomEvent('cabinet_featured'), 'discovery');
  // deferred transitions are reserved on the same ambient channel (not emitted in v0.5)
  assert.equal(ROOM_EVENT_SIDEBAND.room_event_started, 'weather');
  assert.equal(ROOM_EVENT_SIDEBAND.room_event_ended, 'weather');
  assert.equal(sidebandForRoomEvent('nope'), null);
});

// ── E. client display helpers ────────────────────────────────────────────────────
const roomWith = (over = {}) => ({
  room_id: 'main-floor', display_name: 'Main Floor', status: 'open', health: 'healthy',
  capacity: 32, population: 5, ...over,
});

test('roomEventBadge surfaces the current event display fields (ticks; or null)', () => {
  const ev = getCurrentRoomEvent('main-floor', atWindow(0));
  const badge = roomEventBadge(roomWith({ current_event: ev, event_ends_in_ticks: 12 }));
  assert.equal(badge.label, 'Pulse Hour');
  assert.equal(badge.kind, 'featured_cabinet');
  assert.equal(badge.kind_label, 'Featured now');
  assert.equal(badge.featured_cabinet_id, 'pulse-tap-01');
  assert.equal(badge.ends_in_ticks, 12);
  assert.equal(roomEventBadge(roomWith({ current_event: null })), null);
});

test('roomNextEventLabel + roomEventWarmupHint behave like the product', () => {
  assert.equal(roomNextEventLabel(roomWith({ next_event: getNextRoomEvent('main-floor', atWindow(0)) })), 'Signal Sprint Relay');
  const ev = getCurrentRoomEvent('neon-training', atWindow(2)); // training-focus
  assert.match(roomEventWarmupHint(roomWith({ room_id: 'neon-training', population: 0, current_event: ev })), /warm up/i);
  assert.equal(roomEventWarmupHint(roomWith({ population: 12, current_event: getCurrentRoomEvent('main-floor', atWindow(0)) })), null);
  assert.equal(roomEventWarmupHint(roomWith({ status: 'closed', population: 0, current_event: ev })), null);
});

test('warmup copy carries no money/economy framing', () => {
  const hint = roomEventWarmupHint(roomWith({ population: 0, current_event: getCurrentRoomEvent('main-floor', atWindow(0)) })) || '';
  assert.ok(!/jackpot|multiplier|boost|payout|win more|reward|prize|profit|cash/i.test(hint), hint);
});

test('formatEventCountdown renders tick spans without leaking precision', () => {
  assert.equal(formatEventCountdown(0), 'now');
  assert.equal(formatEventCountdown(12), '12t');
});

// ── scenario-derived: events attach to the canonical fold's presence list ─────────
test('roomEventWindowShowcase: events enrich the folded presence list + flip across windows', () => {
  const { report } = roomEventWindowShowcase({});
  const reg = report.finalWorldState.roomRegistry;

  // Observe window 1 (tick 24) — heartbeats reported at tick 22 are fresh (age 2 ≤ 30).
  const t1 = 24;
  const presence1 = attachRoomEvents(roomPresenceListPayload(reg.heartbeats, reg.statusOverrides, t1), t1);
  const mf1 = presence1.rooms.find((r) => r.room_id === 'main-floor');
  assert.equal(mf1.health, 'healthy');
  assert.equal(mf1.population, 5);
  assert.equal(windowIndexFor(t1), 1);
  assert.equal(mf1.current_event.schedule_key, 'signal-sprint-relay'); // main phase0, window1 → slot1
  assert.equal(mf1.featured_cabinet_id, 'signal-sprint-01');

  // Observe window 2 (tick 41) — still fresh (age 19 ≤ 30); the event has flipped.
  const t2 = 41;
  const presence2 = attachRoomEvents(roomPresenceListPayload(reg.heartbeats, reg.statusOverrides, t2), t2);
  const mf2 = presence2.rooms.find((r) => r.room_id === 'main-floor');
  assert.equal(mf2.health, 'healthy');
  assert.equal(windowIndexFor(t2), 2);
  assert.equal(mf2.current_event.schedule_key, 'neon-grid-rush'); // window2 → slot2
  assert.notEqual(mf1.current_event.event_id, mf2.current_event.event_id); // window flip

  // Recommendations + sorting still derive from the (now event-enriched) presence list.
  const rec = recommendRooms(presence1.rooms, { currentRoomId: 'neon-training' });
  assert.equal(rec.busiest.room_id, 'main-floor');
  assert.equal(rec.training.room_id, 'neon-training');
  assert.equal(rec.revive.room_id, 'late-night-circuit');
  assert.equal(roomActivity(mf1).level, 'lively');
  assert.deepEqual(sortRoomsForLobby(presence1.rooms).map((r) => r.room_id), ['main-floor', 'neon-training', 'late-night-circuit']);

  // event-enriched presence list is public-safe + the run is deterministic.
  assert.equal(PRIVATE_FIELD_RE.test(JSON.stringify(presence1)), false);
  assert.equal(report.desyncReport.finalConverged, true);
  assert.equal(roomEventWindowShowcase({}).report.canonicalFingerprint, report.canonicalFingerprint);
});
