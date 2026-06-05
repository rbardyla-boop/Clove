/**
 * HiveWorld v1.3 — sideband / radio-fabric VISUALIZATION tests (read-only diagnostic lens).
 *
 * The view-models are PURE, deterministic functions of data the simulator already produces. v1.3 is a
 * lens: it must add NO event/reducer/authority and change NO fold. These tests prove the view-models are
 * faithful + bounded + deterministic, that the cadence is legible over time, that convergence holds, and
 * that the rejected/stripped view surfaces reasons/counts only — NEVER a private value.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  sidebandChannels, pushedViewTimeline, propagationTrace, activityBySideband, convergenceDemo,
  rejectedSummary, fabricView,
} from '../../arcade/hiveworld-sim/core/viz/fabric-view.mjs';
import { SIDEBAND_NAMES } from '../../arcade/hiveworld-sim/core/sidebands.mjs';
import { EVENT_SPECS } from '../../arcade/hiveworld-sim/core/events.mjs';
import { ALARM_INTERVAL_TICKS } from '../../arcade/hiveworld-sim/core/phase1/district-presence-push.mjs';
import { crossBlockAlarmBound, sameBlockImmediate, cadenceReplayStable } from '../../arcade/hiveworld-sim/scenarios/presence-cadence.mjs';
import { districtRejectsUnknownBlock } from '../../arcade/hiveworld-sim/scenarios/city-district.mjs';

const PRIVATE_RE = /\b(player_id|playerId|playerIds|balance|ledger|inventory|socket|connection|account|admin|secret|token|agent:)\b/i;

// ── READ-ONLY attestation: the lens registers no fold machinery ───────────────────
test('v1.3 is a LENS: importing/running the view-models adds NO event types to the fabric', () => {
  const before = Object.keys(EVENT_SPECS).sort();
  fabricView(crossBlockAlarmBound().report, crossBlockAlarmBound().events); // run everything
  const after = Object.keys(EVENT_SPECS).sort();
  assert.deepEqual(after, before, 'EVENT_SPECS unchanged — no new fold-bearing event');
  assert.equal(EVENT_SPECS['city_presence_alarm'].sideband, 'presence'); // v1.2 still the latest event
});

// ── 1. sideband channels ─────────────────────────────────────────────────────────
test('sidebandChannels covers every sideband in stable order with traffic + class', () => {
  const ch = sidebandChannels(crossBlockAlarmBound().report);
  assert.deepEqual(ch.map((c) => c.name), SIDEBAND_NAMES); // stable, complete
  const presence = ch.find((c) => c.name === 'presence');
  assert.equal(presence.klass, 'ephemeral');
  assert.ok(presence.traffic >= 1, 'presence carried cadence traffic');
  assert.ok(Array.isArray(presence.recent_types));
});

// ── 2. pushed-view timeline (the cadence made visible) ───────────────────────────
test('pushedViewTimeline shows same-block immediate vs cross-block alarm-bound over time', () => {
  const { events } = crossBlockAlarmBound();
  const tl = pushedViewTimeline(events);
  assert.ok(tl.length >= 2 && tl.length <= 16, 'bounded frames');
  const atDelta = tl.find((f) => f.tick === 5);
  assert.equal(atDelta.registry['harbor-02'], 2, 'registry immediate');
  assert.equal(atDelta.pushed['harbor-02']['harbor-02'], 2, 'same-block immediate');
  assert.equal(atDelta.pushed['downtown-01']['harbor-02'], 0, 'cross-block STALE before downtown alarm');
  const last = tl[tl.length - 1];
  assert.equal(last.pushed['downtown-01']['harbor-02'], 2, 'cross-block fresh after downtown alarm');
});

test('pushedViewTimeline is deterministic + read-only (re-fold does not mutate the report)', () => {
  const { report, events } = crossBlockAlarmBound();
  const before = JSON.stringify(report.finalWorldState.district.pushedView);
  const a = pushedViewTimeline(events);
  const b = pushedViewTimeline(events);
  assert.deepEqual(a, b, 'deterministic');
  assert.equal(JSON.stringify(report.finalWorldState.district.pushedView), before, 'report untouched');
});

// ── 3. propagation trace ─────────────────────────────────────────────────────────
test('propagationTrace labels same-block immediate vs cross-block delayed (lag bounded by the alarm)', () => {
  const same = propagationTrace(sameBlockImmediate().events, 'downtown-01');
  assert.equal(same.by_viewer['downtown-01'].kind, 'immediate');
  assert.equal(same.by_viewer['downtown-01'].lag, 0);
  const cross = propagationTrace(crossBlockAlarmBound().events, 'harbor-02');
  const dt = cross.by_viewer['downtown-01'];
  assert.equal(dt.kind, 'delayed');
  assert.ok(dt.lag > 0 && dt.lag <= ALARM_INTERVAL_TICKS, `cross-block lag ${dt.lag} within one alarm`);
});

// ── 4. activity by sideband ──────────────────────────────────────────────────────
test('activityBySideband groups public-safe labels by their driving sideband', () => {
  const a = activityBySideband(crossBlockAlarmBound().report);
  assert.ok(Array.isArray(a.presence) && a.presence.some((l) => /Harbor became active/.test(l)));
  assert.equal(PRIVATE_RE.test(JSON.stringify(a)), false);
});

// ── 5. convergence / replay ──────────────────────────────────────────────────────
test('convergenceDemo proves arrival vs reversed vs duplicated all fold to one fingerprint', () => {
  const { report, events } = cadenceReplayStable();
  const c = convergenceDemo(events);
  assert.equal(c.stable_under_reorder, true);
  assert.equal(c.stable_under_duplicate, true);
  assert.equal(c.fingerprint, report.canonicalFingerprint);
});

// ── 6. rejected / stripped (public-safe) ─────────────────────────────────────────
test('rejectedSummary surfaces phase + reason + sideband + count — NEVER a private value', () => {
  const summary = rejectedSummary(districtRejectsUnknownBlock().report);
  assert.ok(summary.length >= 1);
  const ghost = summary.find((g) => g.reason === 'no_confirmed_route');
  assert.ok(ghost && ghost.count >= 1 && ghost.phase === 'apply');
  assert.equal(PRIVATE_RE.test(JSON.stringify(summary)), false, 'no private value in the rejected view');
  // every group is just {phase, reason, sideband, count}
  for (const g of summary) assert.deepEqual(Object.keys(g).sort(), ['count', 'phase', 'reason', 'sideband']);
});

test('fabricView bundles all six view-models and carries no private data', () => {
  const { report, events } = crossBlockAlarmBound();
  const v = fabricView(report, events);
  assert.deepEqual(Object.keys(v).sort(), ['activity_by_sideband', 'channels', 'convergence', 'rejected', 'timeline']);
  assert.equal(PRIVATE_RE.test(JSON.stringify(v)), false);
});
