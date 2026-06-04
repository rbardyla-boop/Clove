/**
 * Phase 4E — City Host Rank v0 (PURE). Proves the rank is deterministic, bounded,
 * NON-CASH, derived ONLY from server-authored events + the scheduler snapshot,
 * ignores malformed/private/unknown events, never mutates its input, and carries no
 * money/economy/ownership fields.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateHostRank, hostRankChanged, hostRankTierChanged, isBaselineHostRank,
  hostRankStatePayload, WINDOW_MS, SCORE_CAP,
} from '../../arcade/city/city-host-rank.mjs';
import { SCHEMA_VERSION } from '../../arcade/city/city-block.mjs';

const NOW = 6_000_000;
const ev = (type, dt = 1000) => ({ type, server_time: NOW - dt, public_safe: true });
const sched = (mood, presence = 'light') => ({ pressure: { portal_activity: 'quiet', presence, interior_activity: 'idle', scheduler_mood: mood } });

test('empty log + no scheduler → observer / quiet baseline, no reasons', () => {
  const s = evaluateHostRank({ cityId: 'downtown-01', now: NOW, recentEvents: [], schedulerState: null });
  assert.equal(s.host_rank.tier, 'observer');
  assert.equal(s.host_rank.support_signal, 'quiet');
  assert.equal(s.host_rank.score, 0);
  assert.equal(s.host_rank.score_cap, SCORE_CAP);
  assert.deepEqual(s.host_rank.reasons, []);
  assert.equal(s.schema_version, SCHEMA_VERSION);
  assert.equal(s.city_id, 'downtown-01');
  assert.equal(isBaselineHostRank(s), true);
});

test('deterministic: same input yields a deep-equal snapshot', () => {
  const input = { cityId: 'downtown-01', now: NOW, recentEvents: [ev('city_portal_enter_accepted'), ev('city_player_joined')], schedulerState: sched('watching') };
  assert.deepEqual(evaluateHostRank(input), evaluateHostRank(input));
});

test('support activity raises score + tier (portal accept + interior open + join)', () => {
  const s = evaluateHostRank({
    now: NOW,
    recentEvents: [ev('city_portal_enter_accepted'), ev('city_arcade_interior_opened'), ev('city_player_joined')],
    schedulerState: sched('watching'),
  });
  // 10 + 8 + 6 + 10 (watching bonus) = 34 → helper
  assert.equal(s.host_rank.tier, 'helper');
  assert.ok(s.host_rank.reasons.includes('portal_presence'));
  assert.ok(s.host_rank.reasons.includes('interior_support'));
  assert.ok(s.host_rank.reasons.includes('scheduler_active'));
});

test('support_signal is the scheduler-reviewed tie-in (mood → quiet/steady/active)', () => {
  assert.equal(evaluateHostRank({ now: NOW, recentEvents: [], schedulerState: sched('stable') }).host_rank.support_signal, 'quiet');
  assert.equal(evaluateHostRank({ now: NOW, recentEvents: [], schedulerState: sched('watching') }).host_rank.support_signal, 'steady');
  assert.equal(evaluateHostRank({ now: NOW, recentEvents: [], schedulerState: sched('stirring') }).host_rank.support_signal, 'active');
});

test('score is bounded at score_cap and reasons are bounded (<=3)', () => {
  const many = Array.from({ length: 40 }, (_, i) => ev('city_portal_enter_accepted', 100 + i));
  const s = evaluateHostRank({ now: NOW, recentEvents: [...many, ev('city_arcade_interior_opened'), ev('city_player_joined', 5)], schedulerState: sched('stirring', 'busy') });
  assert.equal(s.host_rank.score, SCORE_CAP);
  assert.equal(s.host_rank.tier, 'anchor');
  assert.ok(s.host_rank.reasons.length <= 3);
});

test('ignores out-of-window, malformed, unknown, and scheduler/host-rank events', () => {
  const events = [
    ev('city_portal_enter_accepted', WINDOW_MS + 10_000), // too old
    { type: 'city_scheduler_tick', server_time: NOW - 1 },
    { type: 'city_host_rank_evaluated', server_time: NOW - 1 },
    { type: 'totally_bogus', server_time: NOW - 1 },
    { server_time: NOW - 1 }, null, { type: 'city_portal_enter_accepted', server_time: 'x' },
  ];
  const s = evaluateHostRank({ now: NOW, recentEvents: events, schedulerState: sched('stable') });
  assert.equal(s.host_rank.tier, 'observer');
  assert.equal(s.host_rank.score, 0);
});

test('does not mutate the input event array', () => {
  const events = [ev('city_portal_enter_accepted'), ev('city_player_joined')];
  const copy = JSON.parse(JSON.stringify(events));
  evaluateHostRank({ now: NOW, recentEvents: events, schedulerState: sched('watching') });
  assert.deepEqual(events, copy);
});

test('output carries no money/economy/ownership fields', () => {
  const json = JSON.stringify(evaluateHostRank({ now: NOW, recentEvents: [ev('city_portal_enter_accepted')], schedulerState: sched('stirring', 'busy') }));
  assert.ok(!/balance|ledger|inventory|ticket|token|cash|payout|reward|price|own(er|ership)|stake|wager|rent|income|market/i.test(json));
});

test('change/tier helpers + payload behave; baseline is not "news"', () => {
  const base = evaluateHostRank({ now: NOW, recentEvents: [], schedulerState: sched('stable', 'empty') });
  const up = evaluateHostRank({ now: NOW, recentEvents: [ev('city_portal_enter_accepted'), ev('city_arcade_interior_opened')], schedulerState: sched('watching') });
  assert.equal(hostRankChanged(null, base), true);
  assert.equal(hostRankChanged(base, base), false);
  assert.equal(hostRankChanged(base, up), true);
  assert.equal(hostRankTierChanged(base, up), true);
  assert.equal(isBaselineHostRank(base), true);
  const pl = hostRankStatePayload(up);
  assert.equal(pl.schema_version, SCHEMA_VERSION);
  assert.ok(pl.host_rank && Array.isArray(pl.host_rank.reasons));
});

test('rank derives only from server-authored events + scheduler state (no client field is read)', () => {
  // a "client-supplied" object with rogue fields contributes nothing
  const rogue = { type: 'city_portal_enter_accepted', server_time: NOW - 1, score: 999, tier: 'anchor', payload: { balance: 1e9 } };
  const s = evaluateHostRank({ now: NOW, recentEvents: [rogue], schedulerState: sched('stable') });
  assert.equal(s.host_rank.score, 10); // only the weighted event type counts; rogue fields ignored
  assert.equal(s.host_rank.tier, 'observer');
});
