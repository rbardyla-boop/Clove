/**
 * Phase 1 parity — public arcade event feed: bounded, public-safe, replay-stable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFeed, feedPayload, MAX_EVENTS } from '../../arcade/hiveworld-sim/core/phase1/feed.mjs';
import { createArcade } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import { feedIsPublicSafe } from '../../arcade/hiveworld-sim/core/phase1/sideband-map.mjs';
import { threeCabinetTour, reconnectReplayLoop } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';

test('the feed is bounded to MAX_EVENTS', () => {
  let arcade = createArcade();
  for (let i = 0; i < MAX_EVENTS + 25; i++) arcade = appendFeed(arcade, { type: 'ticket_award', actor: 'agent:a', summary: `e${i}`, tick: i });
  assert.equal(feedPayload(arcade).events.length, MAX_EVENTS);
  assert.equal(arcade.feed[arcade.feed.length - 1].summary, `e${MAX_EVENTS + 24}`); // last survives
});

test('a played-out scenario feed carries only public-safe summaries (no balance/ledger/inventory)', () => {
  const { report } = threeCabinetTour({});
  const feed = report.finalWorldState.arcade.feed;
  assert.ok(feed.length > 0);
  assert.ok(feed.some((e) => e.event_type === 'ticket_award'));
  assert.ok(feed.some((e) => e.event_type === 'challenge_completed'));
  assert.ok(feed.some((e) => e.event_type === 'achievement_unlocked'));
  assert.equal(feedIsPublicSafe(feed), true);
  assert.ok(!/balance|ledger|inventory|redemption_id/i.test(JSON.stringify(feed)));
});

test('the feed survives reconnect/replay within the sim (converges)', () => {
  const { report, divergedAfter } = reconnectReplayLoop({});
  assert.equal(divergedAfter, 0);
  assert.equal(report.desyncReport.finalConverged, true);
  assert.equal(feedIsPublicSafe(report.finalWorldState.arcade.feed), true);
});
