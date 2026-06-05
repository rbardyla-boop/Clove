/**
 * Phase 6A — pure unit tests for scheduled district events + announcements.
 *
 * Events are DISPLAY/ATMOSPHERE only, a deterministic function of the clock + the static block
 * manifest. Proves: determinism (same time → same event + stable id), next-after-current, ids
 * change across windows, labels/summaries carry no economy/ownership copy, every event is
 * public_safe with ONLY the allowlisted fields (no private data), invalid input fails safe, the
 * focus block is always a known block, announcements dedupe + are bounded, and inputs are never
 * mutated. Also checks the activity-feed projection (the single allowlist choke point).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EVENT_SCHEMA, EVENT_TYPES, EVENT_STATUSES, WINDOW_MS, PREROLL_LEAD_MS, ANNOUNCE_MAX,
  windowIndexAt, windowBounds, typeForWindow, blockForWindow, eventId, eventLabel, eventSummary,
  buildDistrictEvent, currentDistrictEvent, nextDistrictEvent, districtEventWindow,
  deriveDistrictAnnouncements,
  districtEventSnapshot, resolveDistrictEventConfig, DEFAULT_DISTRICT_EVENT_CONFIG, DISTRICT_EVENT_BOUNDS,
  formatCountdown,
} from '../../arcade/city/city-district-events.mjs';
import { activityForDistrictEvent, appendActivity } from '../../arcade/city/city-district-activity.mjs';
import { CITY_IDS } from '../../arcade/city/city-block.mjs';
import { DISTRICT_ID } from '../../arcade/city/city-district.mjs';

const NOW = 1_000_000_000;                 // a fixed instant for determinism
const EVENT_FIELDS = [
  'schema_version', 'event_id', 'district_id', 'city_id',
  'type', 'status', 'starts_at', 'ends_at', 'label', 'summary', 'public_safe',
];
// Anything that smells of economy/ownership/gambling/private data is banned from public copy.
const FORBIDDEN = /\b(buy|sell|trade|rent|rental|own|owner|ownership|profit|payout|payment|wager|bet|loot|raid|steal|stake|staking|yield|crypto|token|nft|market|marketplace|landlord|tenant|income|cashout|cash-out|jackpot|multiplier|boost|boosted|reward|earn|prize|bonus|withdraw)\b/i;

// ---- determinism ----
test('currentDistrictEvent is deterministic for the same time (active status)', () => {
  const a = currentDistrictEvent(NOW);
  const b = currentDistrictEvent(NOW);
  assert.deepEqual(a, b);
  assert.equal(a.status, 'active');
  assert.equal(a.schema_version, EVENT_SCHEMA);
  assert.equal(a.district_id, DISTRICT_ID);
});

test('the same window yields the same stable event_id for different times within it', () => {
  const idx = windowIndexAt(NOW);
  const { starts_at, ends_at } = windowBounds(idx);
  const early = currentDistrictEvent(starts_at + 1);
  const late = currentDistrictEvent(ends_at - 1);
  assert.equal(early.event_id, late.event_id);
  assert.equal(early.event_id, eventId(idx, typeForWindow(idx), blockForWindow(idx)));
});

test('a different window changes the event_id (and the next window differs from the current)', () => {
  const idx = windowIndexAt(NOW);
  const { starts_at } = windowBounds(idx);
  const here = currentDistrictEvent(starts_at);
  const nextWindow = currentDistrictEvent(starts_at + WINDOW_MS);
  assert.notEqual(here.event_id, nextWindow.event_id);
});

// ---- next after current ----
test('nextDistrictEvent is the following window, upcoming, with a distinct id', () => {
  const cur = currentDistrictEvent(NOW);
  const nxt = nextDistrictEvent(NOW);
  assert.equal(nxt.status, 'upcoming');
  assert.notEqual(nxt.event_id, cur.event_id);
  assert.equal(nxt.starts_at, cur.ends_at);           // contiguous windows
  assert.equal(windowIndexAt(nxt.starts_at), windowIndexAt(cur.starts_at) + 1);
});

test('districtEventWindow exposes current + next + bounded remaining time + preroll flag', () => {
  const w = districtEventWindow(NOW);
  assert.equal(w.current.status, 'active');
  assert.equal(w.next.status, 'upcoming');
  assert.ok(w.ms_remaining >= 0 && w.ms_remaining <= WINDOW_MS);
  assert.equal(typeof w.preroll, 'boolean');
  // at NOW we are mid-window (not within the pre-roll lead)
  assert.equal(w.preroll, w.ms_remaining <= PREROLL_LEAD_MS);
});

// ---- public-safety: shape, fields, copy ----
test('every event is public_safe and carries ONLY the allowlisted fields (no private data)', () => {
  for (let d = -5; d <= 60; d++) {
    const ev = buildDistrictEvent(windowIndexAt(NOW) + d, 'active', NOW);
    assert.ok(ev, 'event built');
    assert.equal(ev.public_safe, true);
    assert.deepEqual(Object.keys(ev).sort(), [...EVENT_FIELDS].sort());
  }
});

test('labels and summaries across many windows contain no economy/ownership/gambling copy', () => {
  for (let i = 0; i < 120; i++) {
    for (const status of EVENT_STATUSES) {
      const ev = buildDistrictEvent(i, status, NOW);
      assert.ok(ev.label && typeof ev.label === 'string');
      assert.ok(ev.summary && typeof ev.summary === 'string');
      assert.ok(!FORBIDDEN.test(ev.label), `label clean: ${ev.label}`);
      assert.ok(!FORBIDDEN.test(ev.summary), `summary clean: ${ev.summary}`);
    }
  }
});

test('the focus block is ALWAYS a known block (never an unknown/invalid id)', () => {
  for (let i = -50; i < 200; i++) {
    assert.ok(CITY_IDS.includes(blockForWindow(i)), `known block for window ${i}`);
    assert.ok(CITY_IDS.includes(buildDistrictEvent(i, 'active', NOW).city_id));
  }
});

// ---- fail-safe ----
test('buildDistrictEvent returns null for an unknown status (fail-safe)', () => {
  assert.equal(buildDistrictEvent(windowIndexAt(NOW), 'bogus', NOW), null);
  assert.equal(buildDistrictEvent(windowIndexAt(NOW), '', NOW), null);
});

test('non-finite now falls back without throwing and still yields a valid event', () => {
  const ev = currentDistrictEvent(undefined);   // → Date.now()
  assert.equal(ev.status, 'active');
  assert.ok(CITY_IDS.includes(ev.city_id));
});

// ---- announcements: dedupe, bounded, witnessed-ended, no mutation ----
test('a cold start announces only the current active event (no stale ended / no early upcoming)', () => {
  const mid = windowBounds(windowIndexAt(NOW)).starts_at + 1000; // freshly into a window
  const { events, keys } = deriveDistrictAnnouncements(mid, new Set());
  assert.equal(events.length, 1);
  assert.equal(events[0].status, 'active');
  assert.equal(keys.length, 1);
  assert.ok(keys[0].endsWith('#active'));
});

test('announcements dedupe against the provided set (a reload does not re-announce)', () => {
  const mid = windowBounds(windowIndexAt(NOW)).starts_at + 1000;
  const seen = new Set();
  const first = deriveDistrictAnnouncements(mid, seen);
  for (const k of first.keys) seen.add(k);
  const second = deriveDistrictAnnouncements(mid, seen);
  assert.equal(second.events.length, 0);
});

test('within the pre-roll lead, the next (upcoming) event is announced too', () => {
  const idx = windowIndexAt(NOW);
  const { ends_at } = windowBounds(idx);
  const preroll = ends_at - Math.floor(PREROLL_LEAD_MS / 2);
  const { events } = deriveDistrictAnnouncements(preroll, new Set());
  const statuses = events.map((e) => e.status).sort();
  assert.ok(statuses.includes('active'));
  assert.ok(statuses.includes('upcoming'));
});

test('an ended announcement only fires for a window whose active was already witnessed', () => {
  const idx = windowIndexAt(NOW);
  const activeHere = buildDistrictEvent(idx, 'active', NOW);
  const nextStart = windowBounds(idx + 1).starts_at + 1000;
  // without having witnessed window idx active → no "ended" for it on cold entry to idx+1
  const cold = deriveDistrictAnnouncements(nextStart, new Set());
  assert.ok(!cold.events.some((e) => e.status === 'ended'));
  // having witnessed window idx active → entering idx+1 surfaces its "ended"
  const witnessed = new Set([`${activeHere.event_id}#active`]);
  const warm = deriveDistrictAnnouncements(nextStart, witnessed);
  const ended = warm.events.find((e) => e.status === 'ended');
  assert.ok(ended, 'ended announced after witnessing active');
  assert.equal(ended.event_id, activeHere.event_id);
});

test('deriveDistrictAnnouncements never mutates the provided announced set and is bounded', () => {
  const seen = new Set(['some-existing-key']);
  const before = seen.size;
  const { events } = deriveDistrictAnnouncements(NOW, seen);
  assert.equal(seen.size, before);                 // input untouched
  assert.ok(events.length <= ANNOUNCE_MAX);
});

// ---- activity-feed projection (single allowlist choke point) ----
test('activityForDistrictEvent projects an event into a public-safe, clean feed item', () => {
  const ev = currentDistrictEvent(NOW);
  const item = activityForDistrictEvent(ev, NOW);
  assert.ok(item);
  assert.equal(item.public_safe, true);
  assert.equal(item.type, 'district_event_active');
  assert.equal(item.city_id, ev.city_id);
  assert.ok(!FORBIDDEN.test(item.label), `feed label clean: ${item.label}`);
  // it is acceptable into the bounded feed
  const feed = appendActivity([], item);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].label, item.label);
});

test('activityForDistrictEvent fails safe on a non-public-safe or unknown-status event', () => {
  assert.equal(activityForDistrictEvent(null, NOW), null);
  assert.equal(activityForDistrictEvent({ status: 'active', public_safe: false, city_id: 'x', label: 'y' }, NOW), null);
  assert.equal(activityForDistrictEvent({ status: 'bogus', public_safe: true, city_id: 'x', label: 'y' }, NOW), null);
});

// ===================== Phase 6B: server-authored snapshot + operator config =====================

const SNAPSHOT_FIELDS = ['schema_version', 'enabled', 'window_ms', 'show_next', 'server_time', 'current', 'next'];

test('6B: the server snapshot matches the pure deterministic window helper', () => {
  const snap = districtEventSnapshot(NOW);
  const w = districtEventWindow(NOW);
  assert.deepEqual(snap.current, w.current);
  assert.deepEqual(snap.next, w.next);
  assert.equal(snap.enabled, true);
  assert.equal(snap.window_ms, WINDOW_MS);
  assert.equal(snap.show_next, true);
  assert.equal(snap.server_time, NOW);
  assert.deepEqual(Object.keys(snap).sort(), [...SNAPSHOT_FIELDS].sort());
});

test('6B: default config reproduces 6A (old-client fallback path is identical)', () => {
  const cfg = resolveDistrictEventConfig({});
  assert.deepEqual(cfg, DEFAULT_DISTRICT_EVENT_CONFIG);
  // computing with the resolved default config === computing with no config (6A behaviour)
  assert.deepEqual(districtEventWindow(NOW, cfg), districtEventWindow(NOW));
  assert.deepEqual(currentDistrictEvent(NOW, cfg), currentDistrictEvent(NOW));
});

test('6B: snapshot current/next are public_safe with no private fields', () => {
  const snap = districtEventSnapshot(NOW);
  for (const ev of [snap.current, snap.next]) {
    assert.equal(ev.public_safe, true);
    assert.ok(!FORBIDDEN.test(ev.label) && !FORBIDDEN.test(ev.summary));
    assert.ok(!('player_id' in ev) && !('players' in ev) && !('balance' in ev));
  }
});

test('6B: operator window clamps to safe bounds (min/max); invalid → default', () => {
  assert.equal(resolveDistrictEventConfig({ DISTRICT_EVENT_WINDOW_MS: '999999999' }).windowMs, DISTRICT_EVENT_BOUNDS.window_ms.max);
  assert.equal(resolveDistrictEventConfig({ DISTRICT_EVENT_WINDOW_MS: '1' }).windowMs, DISTRICT_EVENT_BOUNDS.window_ms.min);
  assert.equal(resolveDistrictEventConfig({ DISTRICT_EVENT_WINDOW_MS: 'not-a-number' }).windowMs, WINDOW_MS);
  assert.equal(resolveDistrictEventConfig({}).windowMs, WINDOW_MS);
});

test('6B: invalid/garbage env falls back to defaults (enabled, show_next)', () => {
  const cfg = resolveDistrictEventConfig({ DISTRICT_EVENT_ENABLED: 'maybe', DISTRICT_EVENT_SHOW_NEXT: 42 });
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.showNext, true);
  // explicit false is honoured
  assert.equal(resolveDistrictEventConfig({ DISTRICT_EVENT_ENABLED: 'false' }).enabled, false);
  assert.equal(resolveDistrictEventConfig({ DISTRICT_EVENT_SHOW_NEXT: 'false' }).showNext, false);
});

test('6B: a disabled snapshot exposes no event (current/next null, enabled false)', () => {
  const snap = districtEventSnapshot(NOW, resolveDistrictEventConfig({ DISTRICT_EVENT_ENABLED: 'false' }));
  assert.equal(snap.enabled, false);
  assert.equal(snap.current, null);
  assert.equal(snap.next, null);
});

test('6B: show_next=false hides next in the snapshot but keeps current', () => {
  const snap = districtEventSnapshot(NOW, resolveDistrictEventConfig({ DISTRICT_EVENT_SHOW_NEXT: 'false' }));
  assert.ok(snap.current && snap.current.status === 'active');
  assert.equal(snap.next, null);
  assert.equal(snap.show_next, false);
});

test('6B: a custom window size actually changes the window math (config threads through)', () => {
  const cfg = resolveDistrictEventConfig({ DISTRICT_EVENT_WINDOW_MS: String(WINDOW_MS * 2) });
  assert.equal(cfg.windowMs, WINDOW_MS * 2);
  const wDefault = districtEventWindow(NOW);
  const wCustom = districtEventWindow(NOW, cfg);
  // bounds differ because the bucket size differs
  assert.notEqual(wDefault.ends_at - wDefault.starts_at, wCustom.ends_at - wCustom.starts_at);
  assert.equal(wCustom.ends_at - wCustom.starts_at, WINDOW_MS * 2);
});

// ===================== Phase 6C: countdown formatting =====================

test('6C: formatCountdown renders m:ss, pads seconds, clamps at 0, ignores garbage', () => {
  assert.equal(formatCountdown(0), '0:00');
  assert.equal(formatCountdown(5000), '0:05');
  assert.equal(formatCountdown(59999), '0:59');
  assert.equal(formatCountdown(65000), '1:05');
  assert.equal(formatCountdown(600000), '10:00');
  assert.equal(formatCountdown(-5000), '0:00');     // clamp negative
  assert.equal(formatCountdown(NaN), '0:00');       // garbage → 0
  assert.equal(formatCountdown(undefined), '0:00');
});

test('6C: countdown matches the window remaining time (display of the pure schedule)', () => {
  const w = districtEventWindow(NOW);
  // remaining in the current window, formatted, equals formatting the window's ms_remaining
  assert.equal(formatCountdown(w.ends_at - NOW), formatCountdown(w.ms_remaining));
});

test('6B: resolveDistrictEventConfig and districtEventSnapshot never mutate their inputs', () => {
  const raw = { DISTRICT_EVENT_WINDOW_MS: '120000', DISTRICT_EVENT_ENABLED: 'true' };
  const rawCopy = { ...raw };
  resolveDistrictEventConfig(raw);
  assert.deepEqual(raw, rawCopy);
  const cfg = resolveDistrictEventConfig(raw);
  const cfgCopy = { ...cfg };
  districtEventSnapshot(NOW, cfg);
  assert.deepEqual({ ...cfg }, cfgCopy);
});
