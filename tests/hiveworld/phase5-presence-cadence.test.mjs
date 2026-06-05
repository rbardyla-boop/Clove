/**
 * HiveWorld v1.2 — presence push cadence tests (product Phase 5C/5D/5E timing).
 *
 * Proves the TIMED, PARTIAL view: a block's own change is pushed IMMEDIATELY (same-block immediacy); a
 * cross-block change reaches another block's pushed view ONLY after that block's ALARM (cross-block lag
 * bounded by ALARM_INTERVAL_TICKS) — never before; a leave drops to 0 with NO ghost; activity follows the
 * push cadence; and the whole thing converges under reorder/dup. Pure helpers tested directly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ALARM_INTERVAL_TICKS, isAlarmTick, ticksToNextAlarm, snapshotAllBlocks, diffPushedView,
} from '../../arcade/hiveworld-sim/core/phase1/district-presence-push.mjs';
import { CITY_IDS } from '../../arcade/hiveworld-sim/core/phase1/city-blocks.mjs';
import { CITY_EVENT_SIDEBAND } from '../../arcade/hiveworld-sim/core/phase1/city-events.mjs';
import { EVENT_SPECS } from '../../arcade/hiveworld-sim/core/events.mjs';
import { getHandler } from '../../arcade/hiveworld-sim/core/reducers/index.mjs';
import {
  PRESENCE_CADENCE_SCENARIOS, sameBlockImmediate, crossBlockAlarmBound, noGhostLeaveDropsToZero,
  activityFollowsCadence, cadenceReplayStable, refold,
} from '../../arcade/hiveworld-sim/scenarios/presence-cadence.mjs';

const PRIVATE_RE = /\b(player_id|playerId|playerIds|balance|ledger|inventory|socket|connection|account|admin|secret|token)\b/i;
const pv = (report, viewer, block) => report.finalWorldState.district.pushedView[viewer]?.[block]?.population;

// ── pure helpers ──────────────────────────────────────────────────────────────
test('alarm clock: ALARM_INTERVAL_TICKS bounds the cadence; isAlarmTick / ticksToNextAlarm are pure', () => {
  assert.equal(ALARM_INTERVAL_TICKS, 30);
  assert.equal(isAlarmTick(0), true);
  assert.equal(isAlarmTick(30), true);
  assert.equal(isAlarmTick(15), false);
  assert.equal(ticksToNextAlarm(0), 0);
  assert.equal(ticksToNextAlarm(5), 25);
  assert.equal(ticksToNextAlarm(30), 0);
});

test('snapshotAllBlocks is public-safe across all blocks; diffPushedView is bounded + sorted', () => {
  const snap = snapshotAllBlocks({ 'harbor-02': { population: 2, health: 'healthy', last_seen_tick: 1, secret: 'z' } }, 1);
  assert.equal(Object.keys(snap).length, CITY_IDS.length);
  assert.equal(PRIVATE_RE.test(JSON.stringify(snap)), false);
  const before = snapshotAllBlocks({}, 0);
  assert.deepEqual(diffPushedView(before, snap), ['harbor-02']); // only harbor changed
  assert.deepEqual(diffPushedView(snap, snap), []);              // no change
});

// ── coverage ──────────────────────────────────────────────────────────────────
test('city_presence_alarm rides presence + has a handler', () => {
  assert.equal(EVENT_SPECS['city_presence_alarm'].sideband, 'presence');
  assert.equal(CITY_EVENT_SIDEBAND['city_presence_alarm'], 'presence');
  assert.ok(getHandler('city_presence_alarm'));
});

// ── 5D same-block immediacy ──────────────────────────────────────────────────────
test('5D same-block: a block pushes its OWN change to its clients immediately', () => {
  const { report } = sameBlockImmediate();
  assert.equal(pv(report, 'downtown-01', 'downtown-01'), 3); // immediate self-push
  assert.equal(report.finalWorldState.district.blocks['downtown-01'].population, 3); // registry aggregate
  assert.equal(report.desyncReport.finalConverged, true);
});

// ── 5D cross-block alarm-bound ───────────────────────────────────────────────────
test('5D cross-block: A learns B only AFTER A\'s alarm — not before (lag bounded by the alarm)', () => {
  const { report, reportBeforeAlarm } = crossBlockAlarmBound();
  // BEFORE downtown's alarm: harbor sees itself (immediate) but downtown's view of harbor is STALE
  assert.equal(pv(reportBeforeAlarm, 'harbor-02', 'harbor-02'), 2, 'harbor immediate');
  assert.equal(pv(reportBeforeAlarm, 'downtown-01', 'harbor-02'), 0, 'downtown stale until its alarm');
  assert.equal(reportBeforeAlarm.finalWorldState.district.blocks['harbor-02'].population, 2, 'registry already knows');
  // AFTER downtown's alarm: downtown now sees harbor = 2 (cross-block, alarm-bound)
  assert.equal(pv(report, 'downtown-01', 'harbor-02'), 2, 'downtown fresh after its alarm');
  assert.equal(report.desyncReport.finalConverged, true);
});

// ── 5D no-ghost leave ────────────────────────────────────────────────────────────
test('5D no-ghost: a leave drops to 0 — own view immediate, others within one alarm, no lingering ghost', () => {
  const { report, reportPopulated } = noGhostLeaveDropsToZero();
  assert.equal(pv(reportPopulated, 'downtown-01', 'harbor-02'), 1, 'downtown saw harbor populated');
  assert.equal(pv(report, 'harbor-02', 'harbor-02'), 0, 'harbor own view drops to 0 immediately');
  assert.equal(pv(report, 'downtown-01', 'harbor-02'), 0, 'downtown drops to 0 after its next alarm (no ghost)');
  assert.equal(report.finalWorldState.district.blocks['harbor-02'].population, 0);
});

// ── 5E activity follows cadence ──────────────────────────────────────────────────
test('5E: a cross-block activity item is derived when the OBSERVING block\'s alarm fires', () => {
  const { report, reportBeforeAlarm } = activityFollowsCadence();
  // before harbor's alarm, harbor's pushed view does NOT reflect skyline's change
  assert.equal(pv(reportBeforeAlarm, 'harbor-02', 'skyline-03'), 0, 'cross-block not yet pushed to harbor');
  // after harbor's alarm, harbor's view is fresh AND a public-safe "Skyline became active" exists
  assert.equal(pv(report, 'harbor-02', 'skyline-03'), 4);
  const labels = report.finalWorldState.district.activity.map((a) => a.label);
  assert.ok(labels.some((l) => /Skyline became active/.test(l)), 'cadence activity derived at the alarm');
  assert.equal(PRIVATE_RE.test(JSON.stringify(report.finalWorldState.district.activity)), false);
});

// ── convergence + public-safety ──────────────────────────────────────────────────
test('cadence converges under reorder + duplicate delivery (same fingerprint)', () => {
  const { events, report } = cadenceReplayStable();
  assert.equal(refold(events).fingerprint, refold([...events].reverse()).fingerprint, 'reorder converges');
  assert.equal(refold(events).fingerprint, refold([...events, ...events]).fingerprint, 'duplicates dedupe');
  assert.equal(refold(events).fingerprint, report.canonicalFingerprint);
});

test('the pushed view + cadence activity carry no private data; scenarios are deterministic', () => {
  for (const fn of Object.values(PRESENCE_CADENCE_SCENARIOS)) {
    const r = fn();
    assert.equal(PRIVATE_RE.test(JSON.stringify(r.report.finalWorldState.district.pushedView)), false, fn.name);
    assert.equal(fn().report.canonicalFingerprint, r.report.canonicalFingerprint, fn.name);
    assert.equal(r.report.desyncReport.finalConverged, true, fn.name);
  }
});
