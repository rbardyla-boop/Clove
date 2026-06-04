/**
 * Phase 4C — City append-only world event log (PURE). Proves the log is
 * server-authored (ignores any client-supplied id/seq/timestamp), monotonic,
 * bounded + deterministically pruned, public-safe (payload allowlist, no private
 * fields), and that event ids stay unique across pruning.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEventLog, appendCityEvent, recentEvents, cityEventsPayload,
  sanitizeEventPayload, isCityEventType, EVENT_TYPES, MAX_CITY_EVENTS,
} from '../../arcade/city/city-events.mjs';
import { SCHEMA_VERSION } from '../../arcade/city/city-block.mjs';

const CITY = 'downtown-01';

test('appendCityEvent authors a public-safe event with the protocol schema_version', () => {
  const { log, event } = appendCityEvent(createEventLog(), { type: 'city_player_joined', cityId: CITY, actorPublicId: 'city-abc', now: 1000 });
  assert.equal(event.schema_version, SCHEMA_VERSION);
  assert.equal(event.type, 'city_player_joined');
  assert.equal(event.city_id, CITY);
  assert.equal(event.actor_public_id, 'city-abc');
  assert.equal(event.server_time, 1000);
  assert.equal(event.seq, 1);
  assert.equal(event.public_safe, true);
  assert.equal(event.event_id, 'downtown-01:1:city_player_joined');
  assert.equal(log.seq, 1);
});

test('events append monotonically; old events are never mutated', () => {
  let log = createEventLog();
  const a = appendCityEvent(log, { type: 'city_player_joined', cityId: CITY, now: 1 }); log = a.log;
  const b = appendCityEvent(log, { type: 'city_player_left', cityId: CITY, now: 2 }); log = b.log;
  assert.deepEqual(log.events.map((e) => e.seq), [1, 2]);
  assert.ok(Object.isFrozen(a.event)); // prior event object is immutable
  assert.equal(log.events[0].type, 'city_player_joined');
});

test('the server authors id/seq/timestamp — client-supplied values are ignored', () => {
  const { event } = appendCityEvent(createEventLog(), {
    type: 'city_player_joined', cityId: CITY, now: 1000,
    event_id: 'FAKE', seq: 999, server_time: 5, public_safe: false,
  });
  assert.notEqual(event.event_id, 'FAKE');
  assert.equal(event.seq, 1);
  assert.equal(event.server_time, 1000);
  assert.equal(event.public_safe, true);
});

test('the log is bounded (FIFO) but seq stays monotonic so event ids never collide', () => {
  let log = createEventLog();
  const ids = new Set();
  for (let i = 0; i < MAX_CITY_EVENTS + 25; i++) {
    const r = appendCityEvent(log, { type: 'city_player_joined', cityId: CITY, now: i }); log = r.log;
    ids.add(r.event.event_id);
  }
  assert.equal(log.events.length, MAX_CITY_EVENTS, 'log is bounded');
  assert.equal(log.seq, MAX_CITY_EVENTS + 25, 'seq keeps climbing past the prune');
  assert.equal(ids.size, MAX_CITY_EVENTS + 25, 'every event id was unique across pruning');
  // oldest retained event is the (overflow+1)th, never seq 1
  assert.equal(log.events[0].seq, 26);
});

test('payload is filtered to a public-safe allowlist (no private/economy data rides an event)', () => {
  const p = sanitizeEventPayload({ portalId: 'arcade', target: '/arcade/', reason: 'not_in_zone', balance: 9999, ledger: [1], token: 'x', fn: () => {} });
  assert.deepEqual(p, { portalId: 'arcade', target: '/arcade/', reason: 'not_in_zone' });
  const { event } = appendCityEvent(createEventLog(), { type: 'city_portal_enter_accepted', cityId: CITY, payload: { target: '/arcade/', balance: 50 }, now: 1 });
  assert.deepEqual(event.payload, { target: '/arcade/' });
  assert.ok(!/balance|ledger|token/.test(JSON.stringify(event)));
});

test('recentEvents + cityEventsPayload return the last N, schema-versioned and bounded', () => {
  let log = createEventLog();
  for (let i = 0; i < 10; i++) log = appendCityEvent(log, { type: 'city_player_joined', cityId: CITY, now: i }).log;
  assert.equal(recentEvents(log, 3).length, 3);
  assert.equal(recentEvents(log, 999).length, 10); // capped at available
  const payload = cityEventsPayload(log);
  assert.equal(payload.schema_version, SCHEMA_VERSION);
  assert.ok(Array.isArray(payload.events));
});

test('the city event types are exactly the documented set (4C facts + 4D scheduler + 4E host rank + 4F stewardship + 4G trial); unknown types are not honored', () => {
  assert.deepEqual([...EVENT_TYPES].sort(), [
    'city_arcade_interior_closed', 'city_arcade_interior_opened',
    'city_block_trial_closed', 'city_block_trial_completed', 'city_block_trial_joined',
    'city_block_trial_rejected', 'city_block_trial_requested', 'city_block_trial_started', 'city_block_trial_updated',
    'city_host_rank_changed', 'city_host_rank_evaluated',
    'city_player_joined', 'city_player_left',
    'city_portal_enter_accepted', 'city_portal_enter_rejected', 'city_portal_enter_requested',
    'city_pressure_suggested', 'city_scheduler_tick',
    'city_stewardship_applied', 'city_stewardship_previewed', 'city_stewardship_rejected', 'city_stewardship_reset',
  ]);
  assert.equal(isCityEventType('city_player_joined'), true);
  assert.equal(isCityEventType('city_scheduler_tick'), true);
  assert.equal(isCityEventType('city_host_rank_changed'), true);
  assert.equal(isCityEventType('totally_bogus'), false);
  const { event } = appendCityEvent(createEventLog(), { type: 'totally_bogus', cityId: CITY, now: 1 });
  assert.equal(event.type, 'city_unknown'); // arbitrary type is not recorded as-is
});

test('4D scheduler payload fields (pressure/severity) are allowlisted; private fields still dropped', () => {
  const { event } = appendCityEvent(createEventLog(), {
    type: 'city_pressure_suggested', cityId: CITY, now: 1,
    payload: { pressure: 'watching', severity: 'low', reason: 'portal_surge', balance: 99, secret: 'x' },
  });
  assert.deepEqual(event.payload, { reason: 'portal_surge', pressure: 'watching', severity: 'low' });
  assert.ok(!/balance|secret/.test(JSON.stringify(event)));
});

test('4E host-rank payload fields (tier/support_signal/score/score_cap) are allowlisted; private dropped', () => {
  const { event } = appendCityEvent(createEventLog(), {
    type: 'city_host_rank_changed', cityId: CITY, now: 1,
    payload: { tier: 'helper', support_signal: 'steady', score: 34, score_cap: 100, reason: 'portal_presence', balance: 7, owner: 'x' },
  });
  assert.deepEqual(event.payload, { reason: 'portal_presence', tier: 'helper', support_signal: 'steady', score: 34, score_cap: 100 });
  assert.ok(!/balance|owner/.test(JSON.stringify(event)));
});

test('4F stewardship payload fields (target/palette/sign_variant/intensity) are allowlisted; injection/private dropped', () => {
  const { event } = appendCityEvent(createEventLog(), {
    type: 'city_stewardship_applied', cityId: CITY, now: 1,
    payload: { target: 'arcade_front', palette: 'amber', sign_variant: 'circuit', intensity: 'high', reason: 'applied', css: 'body{}', url: 'https://evil', owner: 'x', balance: 9 },
  });
  assert.deepEqual(event.payload, { target: 'arcade_front', reason: 'applied', palette: 'amber', sign_variant: 'circuit', intensity: 'high' });
  assert.ok(!/css|evil|owner|balance/.test(JSON.stringify(event)));
});

test('4G trial payload fields (instance_id/objective/status/score/node counts/duration) are allowlisted; wager/payout/private dropped', () => {
  const { event } = appendCityEvent(createEventLog(), {
    type: 'city_block_trial_completed', cityId: CITY, now: 1,
    payload: { instance_id: 'trial-1', objective: 'signal_grid_trial', status: 'complete', score: 3, score_cap: 3, node_count: 3, stabilized_count: 3, duration_ms: 4200, reason: 'stabilized', wager: 50, payout: 999, entry_fee: 5, owner: 'x', balance: 9 },
  });
  assert.deepEqual(event.payload, { reason: 'stabilized', score: 3, score_cap: 3, instance_id: 'trial-1', objective: 'signal_grid_trial', status: 'complete', node_count: 3, stabilized_count: 3, duration_ms: 4200 });
  assert.ok(!/wager|payout|entry_fee|owner|balance/.test(JSON.stringify(event)));
});
