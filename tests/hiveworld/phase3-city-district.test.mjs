/**
 * HiveWorld v1.0 — city/district foundation tests (product Phase 5A–5E mirror).
 *
 * Covers: district topology + bounded routing, the location-authority invariant (an actor moves ONLY
 * after a confirmed route + arrival; forged/non-adjacent confirms can't teleport), public-safe presence
 * (private payload fields stripped), the bounded/deduped activity feed, and deterministic convergence
 * under duplicated / out-of-order delivery. Pure modules are tested directly; fold behaviour via scenarios.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CITY_IDS, DISTRICT_ID, isKnownBlock, getBlock,
} from '../../arcade/hiveworld-sim/core/phase1/city-blocks.mjs';
import {
  adjacentBlocks, areAdjacent, validateRoute, publicBlockSummary, districtManifest,
} from '../../arcade/hiveworld-sim/core/phase1/district.mjs';
import {
  activityItem, activityForPresence, appendActivity, labelFor, ACTIVITY_TYPES, ACTIVITY_FEED_MAX,
} from '../../arcade/hiveworld-sim/core/phase1/district-activity.mjs';
import { CITY_EVENT_SIDEBAND } from '../../arcade/hiveworld-sim/core/phase1/city-events.mjs';
import { EVENT_SPECS } from '../../arcade/hiveworld-sim/core/events.mjs';
import { getHandler } from '../../arcade/hiveworld-sim/core/reducers/index.mjs';
import { HiveSimulator } from '../../arcade/hiveworld-sim/core/simulator.mjs';
import {
  joinBlock, requestRoute, confirmRoute, arriveBlock, presenceDelta,
} from '../../arcade/hiveworld-sim/core/phase1/city-events.mjs';
import {
  districtRouteConverges, districtRejectsUnknownBlock, districtPresenceDeltaPublicSafe,
  districtActivityReplayStable, multiActorCrossBlockChurn, refold,
} from '../../arcade/hiveworld-sim/scenarios/city-district.mjs';

const PRIVATE_RE = /\b(player_id|playerId|playerIds|balance|ledger|inventory|socket|socketId|connection|account|admin|adminToken|secret|token)\b/i;
const ECONOMY_RE = /\b(buy|sell|trade|rent|own|owner|ownership|profit|payout|wager|bet|loot|stake|staking|yield|cash|crypto|nft|market|marketplace|landlord|tenant|income|claim)\b/i;

// ── topology + routing (pure) ───────────────────────────────────────────────────
test('district topology: three known blocks on a line; adjacency is symmetric + bounded', () => {
  assert.deepEqual(CITY_IDS, ['downtown-01', 'harbor-02', 'skyline-03']);
  assert.deepEqual(adjacentBlocks('downtown-01'), ['harbor-02']);
  assert.deepEqual(adjacentBlocks('harbor-02'), ['downtown-01', 'skyline-03']);
  assert.deepEqual(adjacentBlocks('skyline-03'), ['harbor-02']);
  assert.equal(areAdjacent('downtown-01', 'harbor-02'), true);
  assert.equal(areAdjacent('downtown-01', 'skyline-03'), false); // line: not directly adjacent
  assert.equal(isKnownBlock('atlantis-99'), false);
});

test('validateRoute: adjacent ok; unknown / non-adjacent / same / forged rejected', () => {
  assert.deepEqual(validateRoute('downtown-01', 'harbor-02'), { ok: true, target_city_id: 'harbor-02' });
  assert.equal(validateRoute('downtown-01', 'skyline-03').reason, 'not_adjacent');
  assert.equal(validateRoute('downtown-01', 'atlantis-99').reason, 'unknown_block');
  assert.equal(validateRoute('downtown-01', 'downtown-01').reason, 'same_block');
  assert.equal(validateRoute('nowhere', 'harbor-02').reason, 'unknown_source');
  assert.equal(validateRoute('downtown-01', '').reason, 'invalid_target');
});

test('publicBlockSummary strips private fields and never ghosts an offline population', () => {
  const summary = publicBlockSummary('harbor-02', { population: 5, health: 'healthy', last_seen_tick: 2, playerIds: ['x'], balance: 9 }, 2);
  assert.deepEqual(Object.keys(summary).sort(), ['adjacent', 'city_id', 'display_name', 'health', 'population', 'theme']);
  assert.equal(PRIVATE_RE.test(JSON.stringify(summary)), false);
  assert.equal(publicBlockSummary('skyline-03', { population: 9, health: 'offline', last_seen_tick: 0 }, 0).population, 0);
  assert.equal(publicBlockSummary('atlantis-99', null, 0), null);
});

test('districtManifest is public-safe across all blocks', () => {
  const m = districtManifest({ 'downtown-01': { population: 2, health: 'healthy', last_seen_tick: 1, secret: 'z' } }, 1);
  assert.equal(m.district_id, DISTRICT_ID);
  assert.equal(m.blocks.length, 3);
  assert.equal(PRIVATE_RE.test(JSON.stringify(m)), false);
});

// ── activity feed (pure) ─────────────────────────────────────────────────────────
test('activityItem allowlist-projects and fails safe on unknown types', () => {
  const item = activityItem({ city_id: 'downtown-01', type: 'block_became_active', occurred_tick: 3, playerId: 'p', balance: 9, socketId: 's' });
  assert.equal(PRIVATE_RE.test(JSON.stringify(item)), false);
  assert.deepEqual(Object.keys(item).sort(), ['activity_id', 'city_id', 'district_id', 'kind', 'label', 'occurred_tick', 'public_safe', 'severity', 'type'].sort());
  assert.equal(activityItem({ city_id: 'x', type: 'block_sold', occurred_tick: 1 }), null);
  assert.equal(activityItem({ city_id: 'x', type: 'owner_changed', occurred_tick: 1 }), null);
});

test('no activity label contains forbidden economy/ownership copy', () => {
  for (const type of ACTIVITY_TYPES) assert.equal(ECONOMY_RE.test(labelFor(type, 'Downtown')), false, `forbidden copy in ${type}`);
});

test('activityForPresence classifies became-active / empty / health transitions', () => {
  const s = (population, health) => ({ city_id: 'harbor-02', population, health });
  assert.equal(activityForPresence(s(0, 'healthy'), s(2, 'healthy'), 1).type, 'block_became_active');
  assert.equal(activityForPresence(s(2, 'healthy'), s(0, 'healthy'), 1).type, 'block_became_empty');
  assert.equal(activityForPresence(s(2, 'healthy'), s(2, 'stale'), 1).type, 'block_presence_stale');
  assert.equal(activityForPresence(s(2, 'healthy'), s(2, 'healthy'), 1), null);
});

test('appendActivity coalesces against the head, is bounded, and never mutates input', () => {
  let feed = [];
  feed = appendActivity(feed, activityItem({ city_id: 'a', type: 'block_population_changed', occurred_tick: 1 }));
  feed = appendActivity(feed, activityItem({ city_id: 'a', type: 'block_population_changed', occurred_tick: 2 }));
  assert.equal(feed.length, 1);                  // coalesced
  assert.equal(feed[0].occurred_tick, 2);
  const orig = [];
  let big = orig;
  for (let i = 0; i < ACTIVITY_FEED_MAX + 6; i++) big = appendActivity(big, activityItem({ city_id: `c${i}`, type: 'block_became_active', occurred_tick: i }));
  assert.equal(big.length, ACTIVITY_FEED_MAX);
  assert.equal(orig.length, 0);                  // input untouched
});

// ── coverage: 3-place registration ───────────────────────────────────────────────
test('every city event type rides its declared sideband and has a fold handler', () => {
  for (const [type, sideband] of Object.entries(CITY_EVENT_SIDEBAND)) {
    assert.ok(EVENT_SPECS[type], `${type} missing from EVENT_SPECS`);
    assert.equal(EVENT_SPECS[type].sideband, sideband, `${type} sideband`);
    assert.ok(getHandler(type), `${type} has a handler`);
  }
});

// ── fold behaviour via scenarios ─────────────────────────────────────────────────
test('districtRouteConverges: a confirmed route + arrival moves the actor to the adjacent block', () => {
  const { report } = districtRouteConverges();
  assert.equal(report.finalWorldState.district.actorBlock['agent:a'], 'harbor-02');
  assert.equal(report.desyncReport.finalConverged, true);
  const types = report.finalWorldState.district.activity.map((a) => a.type);
  for (const t of ['route_requested', 'route_confirmed', 'block_arrived']) assert.ok(types.includes(t), `feed has ${t}`);
});

test('location authority: a request alone does NOT move; arrival without a confirm is refused', () => {
  const sim = new HiveSimulator({ seed: 'auth' });
  const downtown = sim.addRoom({ id: 'downtown-01', name: 'downtown-01' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  sim.publish(joinBlock(a, 'downtown-01', 0));
  sim.publish(requestRoute(a, 'harbor-02', 1));                 // request only
  sim.publish(arriveBlock(a, 'harbor-02', 2));                  // arrive WITHOUT a confirm
  let d = sim.report().finalWorldState.district;
  assert.equal(d.actorBlock['agent:a'], 'downtown-01', 'still downtown — no confirm');
  assert.ok(sim.report().applyRejectionCount >= 1, 'the unconfirmed arrival was refused');
  sim.publish(confirmRoute(downtown, 'agent:a', 'downtown-01', 'harbor-02', 3));
  sim.publish(arriveBlock(a, 'harbor-02', 4));
  d = sim.report().finalWorldState.district;
  assert.equal(d.actorBlock['agent:a'], 'harbor-02', 'moved only after confirm + arrival');
});

test('a forged confirm to a NON-ADJACENT block cannot teleport the actor (fold rejects it)', () => {
  const sim = new HiveSimulator({ seed: 'forge' });
  const downtown = sim.addRoom({ id: 'downtown-01', name: 'downtown-01' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  sim.publish(joinBlock(a, 'downtown-01', 0));
  sim.publish(requestRoute(a, 'skyline-03', 1));                          // non-adjacent
  sim.publish(confirmRoute(downtown, 'agent:a', 'downtown-01', 'skyline-03', 2)); // forged confirm
  sim.publish(arriveBlock(a, 'skyline-03', 3));
  const d = sim.report().finalWorldState.district;
  assert.equal(d.actorBlock['agent:a'], 'downtown-01', 'stayed put');
  assert.ok(sim.report().applyRejectionCount >= 1);
});

test('districtRejectsUnknownBlock: rejected route keeps the actor in place and is counted', () => {
  const { report } = districtRejectsUnknownBlock();
  const d = report.finalWorldState.district;
  assert.equal(d.actorBlock['agent:a'], 'downtown-01');
  assert.equal(d.rejectedRoutes, 1);
  assert.ok(report.applyRejectionCount >= 1);                  // the attempted arrival was refused
  assert.equal(report.desyncReport.finalConverged, true);
});

test('district presence is public-safe: injected private payload fields never reach the fold', () => {
  const { report } = districtPresenceDeltaPublicSafe();
  const d = report.finalWorldState.district;
  assert.equal(PRIVATE_RE.test(JSON.stringify(d.blocks)), false, 'no private data in stored summaries');
  assert.equal(PRIVATE_RE.test(JSON.stringify(d.activity)), false, 'no private data in the activity feed');
  assert.deepEqual(Object.keys(d.blocks['harbor-02']).sort(), ['health', 'last_seen_tick', 'population']);
});

test('duplicate + out-of-order delivery converges to the same fingerprint and state', () => {
  const { events, report } = districtActivityReplayStable();
  const inOrder = refold(events);
  const reversed = refold([...events].reverse());
  const duplicated = refold([...events, ...events]); // every event delivered twice
  assert.equal(inOrder.fingerprint, reversed.fingerprint, 'reorder converges');
  assert.equal(inOrder.fingerprint, duplicated.fingerprint, 'duplicates dedupe');
  assert.equal(inOrder.fingerprint, report.canonicalFingerprint);
});

test('district activity feed stays bounded under churn', () => {
  const { report } = multiActorCrossBlockChurn();
  assert.ok(report.finalWorldState.district.activity.length <= ACTIVITY_FEED_MAX);
  assert.equal(report.desyncReport.finalConverged, true);
});

test('scenarios are deterministic: re-running yields the same canonical fingerprint', () => {
  for (const fn of [districtRouteConverges, districtPresenceDeltaPublicSafe, multiActorCrossBlockChurn]) {
    assert.equal(fn().report.canonicalFingerprint, fn().report.canonicalFingerprint, fn.name);
  }
});
