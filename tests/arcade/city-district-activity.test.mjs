/**
 * Phase 5E — pure unit tests for the district activity feed.
 *
 * Activity is DISPLAY-ONLY, CLIENT-DERIVED from already-public-safe server facts (Phase 5D presence
 * deltas + 5A route results + arrival). Every item is allowlist-projected; labels are observational
 * and carry no economy/ownership copy; the feed is deduped + bounded; inputs are never mutated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  activityItem, classifyBlockChange, deriveActivitiesFromDelta,
  activityForRouteRequested, activityForRouteResult, activityForArrival,
  appendActivity, labelFor,
  ACTIVITY_TYPES, ACTIVITY_FEED_MAX, ACTIVITY_KIND, ACTIVITY_SCHEMA,
} from '../../arcade/city/city-district-activity.mjs';
import { DISTRICT_ID } from '../../arcade/city/city-district.mjs';

const NOW = 1_000_000_000;
const block = (city_id, population, health = 'healthy', display_name = null) =>
  ({ city_id, population, health, display_name: display_name || city_id });

// ---- classification ----
test('classifyBlockChange: empty→populated is became_active; populated→empty is became_empty', () => {
  assert.equal(classifyBlockChange(block('downtown-01', 0), block('downtown-01', 2)), 'block_became_active');
  assert.equal(classifyBlockChange(block('downtown-01', 2), block('downtown-01', 0)), 'block_became_empty');
});

test('classifyBlockChange: health transitions map to stale/restored', () => {
  assert.equal(classifyBlockChange(block('harbor-02', 2, 'healthy'), block('harbor-02', 2, 'stale')), 'block_presence_stale');
  assert.equal(classifyBlockChange(block('harbor-02', 2, 'offline'), block('harbor-02', 2, 'healthy')), 'block_presence_restored');
});

test('classifyBlockChange: a pure count shift (both populated) is population_changed; no change is null', () => {
  assert.equal(classifyBlockChange(block('skyline-03', 2), block('skyline-03', 4)), 'block_population_changed');
  assert.equal(classifyBlockChange(block('skyline-03', 2), block('skyline-03', 2)), null);
});

test('classifyBlockChange: a never-seen block becoming populated is became_active (prev null)', () => {
  assert.equal(classifyBlockChange(null, block('downtown-01', 1)), 'block_became_active');
  assert.equal(classifyBlockChange(null, block('downtown-01', 0, 'unknown')), null); // 0/unknown → nothing
});

// ---- presence delta derivation ----
test('deriveActivitiesFromDelta derives one item per changed block; uses the static display name', () => {
  const manifest = { blocks: [block('downtown-01', 0, 'healthy', 'Downtown'), block('harbor-02', 1, 'healthy', 'Harbor')] };
  const delta = { blocks: [{ city_id: 'downtown-01', population: 2, health: 'healthy', population_is_estimated: false }] };
  const acts = deriveActivitiesFromDelta(delta, manifest, NOW);
  assert.equal(acts.length, 1);
  assert.equal(acts[0].type, 'block_became_active');
  assert.equal(acts[0].label, 'Downtown became active.');
  assert.equal(acts[0].city_id, 'downtown-01');
});

test('deriveActivitiesFromDelta does not mutate its inputs and is bounded by the delta', () => {
  const manifest = { blocks: [block('downtown-01', 1, 'healthy', 'Downtown')] };
  const delta = { blocks: [{ city_id: 'downtown-01', population: 0, health: 'healthy' }] };
  const before = JSON.stringify({ manifest, delta });
  const acts = deriveActivitiesFromDelta(delta, manifest, NOW);
  assert.equal(acts.length, 1);
  assert.ok(acts.length <= delta.blocks.length);
  assert.equal(JSON.stringify({ manifest, delta }), before);
});

// ---- route + arrival ----
test('route requested / confirmed / arrival derive safe items; a blocked route yields NO feed item', () => {
  assert.equal(activityForRouteRequested('skyline-03', 'Skyline', NOW).type, 'route_requested');
  assert.equal(activityForRouteRequested('skyline-03', 'Skyline', NOW).label, 'Routing to Skyline…');
  assert.equal(activityForRouteResult({ ok: true, target_city_id: 'skyline-03' }, 'Skyline', NOW).type, 'route_confirmed');
  assert.equal(activityForRouteResult({ ok: false, reason: 'not_adjacent' }, 'Skyline', NOW), null); // blocked → no feed item
  assert.equal(activityForRouteResult(null, 'Skyline', NOW), null);
  assert.equal(activityForArrival('skyline-03', 'Skyline', NOW).type, 'block_arrived');
  assert.equal(activityForArrival('skyline-03', 'Skyline', NOW).label, 'Arrived in Skyline.');
});

// ---- public-safety: allowlist projection ----
test('activityItem strips any private/extra field (allowlist projection)', () => {
  const item = activityItem({
    city_id: 'downtown-01', type: 'block_became_active', occurred_at: NOW, name: 'Downtown',
    // hostile extras that must never reach a feed item:
    playerId: 'p-secret', players: ['a', 'b'], balance: 99, ledger: [1], inventory: ['x'],
    connectionId: 'c1', socketId: 's1', accountId: 'acc', adminToken: 'tok', secret: 'z',
  });
  const json = JSON.stringify(item);
  assert.equal(/player|balance|ledger|inventory|connection|socket|account|admin|secret|token/i.test(json), false);
  assert.deepEqual(Object.keys(item).sort(), ['activity_id', 'city_id', 'district_id', 'kind', 'label', 'occurred_at', 'public_safe', 'schema_version', 'severity', 'type'].sort());
  assert.equal(item.public_safe, true);
  assert.equal(item.kind, ACTIVITY_KIND);
  assert.equal(item.schema_version, ACTIVITY_SCHEMA);
  assert.equal(item.district_id, DISTRICT_ID);
});

test('activityItem fails safe on an unknown type', () => {
  assert.equal(activityItem({ city_id: 'x', type: 'block_sold', occurred_at: NOW, name: 'X' }), null);
  assert.equal(activityItem({ city_id: 'x', type: 'owner_changed', occurred_at: NOW }), null);
  assert.equal(activityItem({}), null);
});

test('no activity LABEL contains forbidden economy/ownership copy', () => {
  const FORBIDDEN = /\b(buy|sell|trade|rent|own|owner|ownership|profit|payout|wager|bet|loot|stake|staking|yield|cash|crypto|token|nft|market|marketplace|landlord|tenant|income|claim)\b/i;
  for (const type of ACTIVITY_TYPES) {
    const label = labelFor(type, 'Downtown');
    assert.equal(FORBIDDEN.test(label), false, `forbidden copy in label for ${type}: "${label}"`);
  }
});

// ---- dedupe + bounding ----
test('appendActivity coalesces consecutive same (type, city_id) against the head', () => {
  let feed = [];
  feed = appendActivity(feed, activityItem({ city_id: 'downtown-01', type: 'block_population_changed', occurred_at: 1, name: 'Downtown' }));
  feed = appendActivity(feed, activityItem({ city_id: 'downtown-01', type: 'block_population_changed', occurred_at: 2, name: 'Downtown' }));
  assert.equal(feed.length, 1);            // coalesced
  assert.equal(feed[0].occurred_at, 2);    // newest wins
});

test('appendActivity keeps distinct items and is newest-first', () => {
  let feed = [];
  feed = appendActivity(feed, activityItem({ city_id: 'downtown-01', type: 'block_became_active', occurred_at: 1, name: 'Downtown' }));
  feed = appendActivity(feed, activityItem({ city_id: 'harbor-02', type: 'block_became_active', occurred_at: 2, name: 'Harbor' }));
  assert.equal(feed.length, 2);
  assert.equal(feed[0].city_id, 'harbor-02'); // newest first
});

test('appendActivity is bounded and never mutates the input feed', () => {
  let feed = [];
  const orig = feed;
  for (let i = 0; i < ACTIVITY_FEED_MAX + 8; i++) {
    feed = appendActivity(feed, activityItem({ city_id: `c-${i}`, type: 'block_became_active', occurred_at: i, name: `C${i}` }));
  }
  assert.equal(feed.length, ACTIVITY_FEED_MAX);
  assert.equal(orig.length, 0); // input array untouched
  // newest-first: the most recently appended is at the head
  assert.equal(feed[0].city_id, `c-${ACTIVITY_FEED_MAX + 7}`);
});

test('appendActivity ignores a null item and drops a non-public/unknown item', () => {
  const feed = [activityItem({ city_id: 'x', type: 'block_arrived', occurred_at: 1, name: 'X' })];
  assert.equal(appendActivity(feed, null).length, 1);
  assert.equal(appendActivity(feed, { type: 'block_arrived', city_id: 'y', public_safe: false }).length, 1); // not public → dropped
});
