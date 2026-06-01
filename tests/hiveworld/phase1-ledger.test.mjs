/**
 * Phase 1 parity — ticket ledger: per-source entries, shared balance, dedup, privacy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createArcade, startRound, submitRound, getBalance } from '../../arcade/hiveworld-sim/core/phase1/round-authority.mjs';
import { getLedger, appendLedger, makeLedgerId } from '../../arcade/hiveworld-sim/core/phase1/ledger.mjs';

const A = 'agent:a';
function earn(arcade, machine, cabinetType, rulesetVersion, result, roundId, tick) {
  const s = startRound(arcade, { machineId: machine, occupantId: A, actor: A, roundId, tick });
  return submitRound(s.arcade, { payload: { roundId, machineId: machine, cabinetType, rulesetVersion, ...result }, senderId: A, occupantId: A, tick: tick + 1 });
}
const pulse = { grade: 'A', score: 1825, accuracy: 88, hits: 16, bestStreak: 9, durationMs: 30000 };
const signal = { grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000 };
const grid = { grade: 'A', score: 5000, correctSteps: 40, completedPatterns: 6, mistakes: 2, bestStreak: 18, durationMs: 22000 };

test('all three cabinet awards land in ONE shared balance with one ledger entry each', () => {
  let arcade = createArcade();
  arcade = earn(arcade, 'pulse', 'pulse_tap', 'pulse-tap/1', pulse, 'p1', 10).arcade;
  arcade = earn(arcade, 'signal', 'signal_sprint', 'signal-sprint/1', signal, 's1', 20).arcade;
  arcade = earn(arcade, 'grid', 'neon_grid', 'neon-grid-v1', grid, 'g1', 30).arcade;
  assert.equal(getBalance(arcade, A), 20 + 24 + 26); // 70
  const led = getLedger(arcade, A);
  assert.equal(led.length, 3);
  assert.deepEqual(led.map((e) => e.cabinet_type).sort(), ['neon_grid', 'pulse_tap', 'signal_sprint']);
  assert.ok(led.every((e) => typeof e.public_safe_summary === 'string' && e.delta > 0));
});

test('appendLedger is idempotent by ledger_id (a replayed event never double-records)', () => {
  let arcade = createArcade();
  arcade = appendLedger(arcade, { actor: A, eventType: 'tickets_awarded', delta: 20, balanceAfter: 20, source: 'pulse', refId: 'r1', summary: 'earned 20', tick: 1 });
  arcade = appendLedger(arcade, { actor: A, eventType: 'tickets_awarded', delta: 20, balanceAfter: 20, source: 'pulse', refId: 'r1', summary: 'earned 20', tick: 2 });
  assert.equal(getLedger(arcade, A).length, 1);
  assert.equal(getLedger(arcade, A)[0].ledger_id, makeLedgerId('tickets_awarded', 'r1'));
});

test('the ledger is per-actor (B never sees A entries)', () => {
  let arcade = createArcade();
  arcade = earn(arcade, 'grid', 'neon_grid', 'neon-grid-v1', grid, 'g1', 10).arcade;
  assert.equal(getLedger(arcade, 'agent:b').length, 0);
});
