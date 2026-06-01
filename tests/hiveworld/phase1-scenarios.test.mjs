/**
 * Phase 1 parity — scenario determinism, convergence, and product-shaped outcomes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE1_SCENARIOS } from '../../arcade/hiveworld-sim/scenarios/phase1.mjs';

const A = 'agent:a';

test('every Phase 1 scenario converges and is byte-for-byte deterministic', () => {
  for (const [name, fn] of Object.entries(PHASE1_SCENARIOS)) {
    const r1 = fn({});
    const r2 = fn({});
    assert.equal(r1.report.desyncReport.finalConverged, true, `${name} not converged`);
    assert.equal(r1.report.canonicalFingerprint, r2.report.canonicalFingerprint, `${name} not deterministic`);
  }
});

test('threeCabinetTour: A earns 70 across all three and claims Three Cabinet Tour + Grid Rookie', () => {
  const { report } = PHASE1_SCENARIOS.threeCabinetTour({});
  const arcade = report.finalWorldState.arcade;
  assert.equal(arcade.balances[A], 70);
  assert.equal(arcade.challengeProgress[A]['three-cabinet-tour'].reward_claimed, true);
  assert.equal(arcade.challengeProgress[A]['grid-rookie'].reward_claimed, true);
  assert.ok(Object.values(arcade.inventory[A]).some((i) => i.prize_id === 'badge-circuit-voyager'));
});

test('prizeCounterLoop: combined-balance redeem works; already_owned + prize_disabled rejected', () => {
  const { report } = PHASE1_SCENARIOS.prizeCounterLoop({});
  const arcade = report.finalWorldState.arcade;
  assert.equal(arcade.balances[A], 35); // 70 − 35
  assert.ok(Object.values(arcade.inventory[A]).some((i) => i.prize_id === 'pulse-jacket'));
  const reasons = report.rejectedEvents.map((r) => r.reason);
  assert.ok(reasons.includes('already_owned'));
  assert.ok(reasons.includes('prize_disabled'));
});

test('challengeBoardLoop: A claims grid-rookie; duplicate + cross-player claims rejected', () => {
  const { report } = PHASE1_SCENARIOS.challengeBoardLoop({});
  const reasons = report.rejectedEvents.map((r) => r.reason);
  assert.ok(reasons.includes('already_claimed'));
  assert.ok(reasons.includes('not_completed')); // B never played
});

test('adapterFailureLoop: unsupported/invalid cabinets are unavailable and fail closed (no crash/desync)', () => {
  const { report, renderStates, adapterStates } = PHASE1_SCENARIOS.adapterFailureLoop({});
  assert.equal(renderStates['mystery-x-01'], 'unavailable');
  assert.equal(renderStates['glitch-cab-01'], 'unavailable');
  assert.equal(adapterStates['mystery-x-01'], 'missing_adapter');
  assert.equal(adapterStates['glitch-cab-01'], 'invalid_adapter');
  assert.ok(report.rejectedEvents.filter((r) => r.reason === 'invalid_cabinet').length >= 2);
  assert.equal(report.desyncReport.finalConverged, true);
});

test('reconnectReplayLoop: B diverges while offline, converges after replay', () => {
  const { divergedWhileOffline, divergedAfter, report } = PHASE1_SCENARIOS.reconnectReplayLoop({});
  assert.ok(divergedWhileOffline > 0);
  assert.equal(divergedAfter, 0);
  assert.equal(report.finalWorldState.arcade.balances[A], 44); // pulse 20 + signal 24
});

test('meshChurnPhase1: 10 agents tour three cabinets under faults and still converge', () => {
  const { report } = PHASE1_SCENARIOS.meshChurnPhase1({});
  assert.equal(report.desyncReport.finalConverged, true);
  assert.equal(report.agents.length, 10);
  // every honest player banked exactly 70 across the three cabinets
  for (const id of report.agents) {
    if (id === 'agent:j') continue; // the last agent also fires a malicious cross-game submit
    assert.equal(report.finalWorldState.arcade.balances[id], 70, `${id} balance`);
  }
});
