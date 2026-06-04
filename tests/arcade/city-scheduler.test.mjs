/**
 * Phase 4D — City Hive Scheduler (PURE). Proves the scheduler is deterministic,
 * bounded, display-only, derived ONLY from the server-authored event log + a
 * server-supplied occupancy, ignores malformed/unknown/out-of-window/scheduler
 * events, never mutates its input, and carries no money/economy/ownership fields.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePressure, pressureChanged, suggestionReasons, schedulerStatePayload, isBaselinePressure, WINDOW_MS,
} from '../../arcade/city/city-scheduler.mjs';
import { SCHEMA_VERSION } from '../../arcade/city/city-block.mjs';

const NOW = 5_000_000;
const ev = (type, dt = 1000) => ({ type, server_time: NOW - dt, public_safe: true });
const portals = (n) => Array.from({ length: n }, (_, i) => ev('city_portal_enter_requested', 1000 + i));

test('empty log + no occupancy → quiet/empty/idle/stable, no suggestions', () => {
  const s = evaluatePressure({ cityId: 'downtown-01', now: NOW, recentEvents: [], occupancy: 0 });
  assert.deepEqual(s.pressure, { portal_activity: 'quiet', presence: 'empty', interior_activity: 'idle', scheduler_mood: 'stable' });
  assert.equal(s.suggestions.length, 0);
  assert.equal(s.schema_version, SCHEMA_VERSION);
  assert.equal(s.city_id, 'downtown-01');
});

test('deterministic: same input yields a deep-equal snapshot', () => {
  const input = { cityId: 'downtown-01', now: NOW, recentEvents: portals(3), occupancy: 2 };
  assert.deepEqual(evaluatePressure(input), evaluatePressure(input));
});

test('portal activity escalates quiet → active → surging by count', () => {
  assert.equal(evaluatePressure({ now: NOW, recentEvents: portals(1) }).pressure.portal_activity, 'quiet');
  assert.equal(evaluatePressure({ now: NOW, recentEvents: portals(2) }).pressure.portal_activity, 'active');
  assert.equal(evaluatePressure({ now: NOW, recentEvents: portals(5) }).pressure.portal_activity, 'surging');
});

test('interior activity escalates idle → open → cycling; presence from occupancy', () => {
  assert.equal(evaluatePressure({ now: NOW, recentEvents: [ev('city_arcade_interior_opened')] }).pressure.interior_activity, 'open');
  const cyc = evaluatePressure({ now: NOW, recentEvents: [ev('city_arcade_interior_opened', 1), ev('city_arcade_interior_closed', 2), ev('city_arcade_interior_opened', 3)] });
  assert.equal(cyc.pressure.interior_activity, 'cycling');
  assert.equal(evaluatePressure({ now: NOW, recentEvents: [], occupancy: 0 }).pressure.presence, 'empty');
  assert.equal(evaluatePressure({ now: NOW, recentEvents: [], occupancy: 2 }).pressure.presence, 'light');
  assert.equal(evaluatePressure({ now: NOW, recentEvents: [], occupancy: 6 }).pressure.presence, 'busy');
});

test('mood aggregates elevated dimensions (stable → watching → stirring)', () => {
  // light presence alone is NOT elevated (only "busy" counts) → stable
  assert.equal(evaluatePressure({ now: NOW, recentEvents: [], occupancy: 1 }).pressure.scheduler_mood, 'stable');
  // portal active = exactly one elevated dimension → watching
  assert.equal(evaluatePressure({ now: NOW, recentEvents: portals(2) }).pressure.scheduler_mood, 'watching');
  // portal surging + interior open = two elevated dimensions → stirring
  assert.equal(evaluatePressure({ now: NOW, recentEvents: [...portals(5), ev('city_arcade_interior_opened')] }).pressure.scheduler_mood, 'stirring');
});

test('suggestions are bounded (<=2) and public-safe', () => {
  const s = evaluatePressure({ now: NOW, recentEvents: [...portals(5), ev('city_arcade_interior_opened', 1), ev('city_arcade_interior_closed', 2), ev('city_arcade_interior_opened', 3)] });
  assert.ok(s.suggestions.length <= 2);
  for (const sg of s.suggestions) { assert.equal(sg.public_safe, true); assert.ok(['low', 'medium'].includes(sg.severity)); }
  assert.deepEqual(suggestionReasons(s).sort(), ['interior_cycling', 'portal_surge']);
});

test('ignores out-of-window, malformed, unknown, and scheduler-authored events (no feedback loop)', () => {
  const events = [
    ...portals(5).map((e) => ({ ...e, server_time: NOW - (WINDOW_MS + 10_000) })), // all too old
    { type: 'city_scheduler_tick', server_time: NOW - 1 },   // scheduler events are not counted
    { type: 'city_pressure_suggested', server_time: NOW - 1 },
    { type: 'totally_bogus', server_time: NOW - 1 },          // unknown type
    { server_time: NOW - 1 }, null, { type: 'city_portal_enter_requested', server_time: 'x' }, // malformed
  ];
  const s = evaluatePressure({ now: NOW, recentEvents: events, occupancy: 0 });
  assert.equal(s.pressure.portal_activity, 'quiet');
  assert.equal(s.pressure.scheduler_mood, 'stable');
});

test('does not mutate the input event array', () => {
  const events = portals(3);
  const copy = JSON.parse(JSON.stringify(events));
  evaluatePressure({ now: NOW, recentEvents: events, occupancy: 3 });
  assert.deepEqual(events, copy);
});

test('output carries no money/economy/ownership fields', () => {
  const json = JSON.stringify(evaluatePressure({ now: NOW, recentEvents: portals(5), occupancy: 6 }));
  assert.ok(!/balance|ledger|inventory|ticket|token|cash|payout|reward|price|own(er|ership)|stake|wager/i.test(json));
});

test('isBaselinePressure detects the fully-idle snapshot (so a cold-start eval logs no tick)', () => {
  assert.equal(isBaselinePressure(evaluatePressure({ now: NOW, recentEvents: [], occupancy: 0 })), true);
  assert.equal(isBaselinePressure(evaluatePressure({ now: NOW, recentEvents: [], occupancy: 1 })), false); // light presence
  assert.equal(isBaselinePressure(evaluatePressure({ now: NOW, recentEvents: portals(2) })), false);       // portal active
  assert.equal(isBaselinePressure(null), false);
});

test('schedulerStatePayload is defensive against malformed snapshots', () => {
  const pl = schedulerStatePayload({});
  assert.ok(pl.pressure && Array.isArray(pl.suggestions));
  assert.equal(pl.schema_version, SCHEMA_VERSION);
});

test('pressureChanged + schedulerStatePayload behave', () => {
  const a = evaluatePressure({ now: NOW, recentEvents: [], occupancy: 0 });
  const b = evaluatePressure({ now: NOW, recentEvents: portals(5), occupancy: 6 });
  assert.equal(pressureChanged(null, a), true);
  assert.equal(pressureChanged(a, a), false);
  assert.equal(pressureChanged(a, b), true);
  const pl = schedulerStatePayload(b);
  assert.equal(pl.schema_version, SCHEMA_VERSION);
  assert.ok(pl.pressure && Array.isArray(pl.suggestions));
});
