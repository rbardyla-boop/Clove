/**
 * G. Simulator scenario tests — the big mesh churn + recovery + determinism.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { meshChurn, baseStationFailureRecovery } from '../../arcade/hiveworld-sim/scenarios/canned.mjs';

test('10 agents / 2 rooms / 1000 ticks: honest nodes converge after churn', () => {
  const { report } = meshChurn({});
  assert.equal(report.agents.length, 10);
  assert.equal(report.rooms.length, 2);
  assert.equal(report.ticks, 1000);
  assert.equal(report.desyncReport.finalConverged, true);
  assert.equal(report.pendingUndelivered, 0);
  // a desync was actually observed mid-run (agent:e went dark)
  assert.equal(report.desyncReport.observedDesync, true);
  // the run exercised every failure mode we care about
  assert.ok(report.ingestRejectionCount >= 1, 'a malicious event was rejected at the fabric');
  assert.ok(report.applyRejectionCount >= 1, 'an authority/semantic rejection happened');
  assert.ok(report.authorityReport.timeouts.length >= 1, 'a stale lock was timed out');
  assert.ok(report.authorityReport.reconnects.length >= 1, 'an agent reconnected + replayed');
  assert.ok(report.authorityReport.roomOutages.length >= 2, 'a base station failed and recovered');
  assert.ok(report.authorityReport.occupancyTransitions.length >= 1);
});

test('base station failure + recovery preserves the occupant', () => {
  const { report, occupiedAfterRecovery } = baseStationFailureRecovery({});
  assert.equal(occupiedAfterRecovery, 'agent:alice');
  const kinds = report.authorityReport.roomOutages.map((o) => o.kind);
  assert.ok(kinds.includes('offline'));
  assert.ok(kinds.includes('recovered'));
});

test('the big scenario is deterministic across runs', () => {
  const a = meshChurn({}).report.canonicalFingerprint;
  const b = meshChurn({}).report.canonicalFingerprint;
  assert.equal(a, b);
});
