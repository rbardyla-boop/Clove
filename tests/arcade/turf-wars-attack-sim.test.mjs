/**
 * Turf Wars Phase 2 foundation (lab) — ATTACK SIMULATOR + SCORCH tests.
 *   node --test tests/arcade/turf-wars-attack-sim.test.mjs
 *
 * Proves: deterministic outcome from (base, plan, seed); the one-op fraud-proof (forged/wrong-seed
 * digests fail); base-snapshot immutability; bounded + reversible scorch; precondition rejection of a
 * mismatched/forged base or plan. The settlement seed is a bare parameter (O1 deferred) and there is no
 * settlement timing (O2 deferred). Lab-only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityFromSeed } from '../../arcade/hiveworld-agents/turf-wars/identity.mjs';
import { canonicalize, contentAddress } from '../../arcade/hiveworld-agents/turf-wars/canonical.mjs';
import { foldBlock } from '../../arcade/hiveworld-agents/turf-wars/block-log.mjs';
import { signSnapshot } from '../../arcade/hiveworld-agents/turf-wars/snapshot.mjs';
import { makeAttackPlan } from '../../arcade/hiveworld-agents/turf-wars/attack-plan.mjs';
import {
  simulateAttack, verifyAttackOutcome, attackRejection,
} from '../../arcade/hiveworld-agents/turf-wars/attack-sim.mjs';
import {
  emptyScorch, applyScorch, decayScorch, ticksToHeal, scorchBoundsHold, SCORCH_CAP, SCORCH_DECAY_PER_TICK,
} from '../../arcade/hiveworld-agents/turf-wars/scorch.mjs';
import { buildSignedChain, blockIdFor, structureId } from '../../arcade/hiveworld-agents/turf-wars/turf-evidence.mjs';

const defender = identityFromSeed('defender');
const attacker = identityFromSeed('attacker');
const BLOCK = blockIdFor(defender);
const SEED = 'abcd1234ef567890';

function defenderBase() {
  const state = foldBlock(buildSignedChain(defender, BLOCK, [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
    { type: 'build_structure', payload: { structure_id: structureId('node'), kind: 'resource_node', x: 2, y: 2 }, tick: 2 },
  ]));
  return { state, record: signSnapshot(defender, state) };
}
function honestPlan(baseRecord) {
  return makeAttackPlan(attacker, {
    target_block: BLOCK, base_address: baseRecord.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('sign'), intensity: 3 }, { structure_id: structureId('sign'), intensity: 3 }],
  });
}

test('a valid attack simulates deterministically and verifies', () => {
  const { record } = defenderBase();
  const plan = honestPlan(record);
  const a = simulateAttack(record, plan, SEED);
  const b = simulateAttack(record, plan, SEED);
  assert.equal(a.ok, true);
  assert.equal(a.digest, b.digest, 'same inputs → same digest');
  assert.equal(verifyAttackOutcome(record, plan, SEED, a.digest), true);
  assert.equal(a.outcome.total_scorch >= 0, true);
  assert.ok(a.outcome.attacker_reward <= 25, 'reward bounded');
});

test('the fraud-proof rejects a forged digest and a wrong seed', () => {
  const { record } = defenderBase();
  const plan = honestPlan(record);
  const a = simulateAttack(record, plan, SEED);
  assert.equal(verifyAttackOutcome(record, plan, SEED, contentAddress({ forged: 1 })), false);
  assert.equal(verifyAttackOutcome(record, plan, '0000000000000000', a.digest), false, 'wrong seed → different outcome');
});

test('the base snapshot is never mutated by simulation', () => {
  const { record } = defenderBase();
  const before = canonicalize(record);
  simulateAttack(record, honestPlan(record), SEED);
  assert.equal(canonicalize(record), before, 'base bytes unchanged after simulate');
});

test('preconditions reject a mismatched base / block', () => {
  const { record } = defenderBase();
  const plan = honestPlan(record);
  // plan targeting a different base address
  const otherBase = { ...record, address: contentAddress({ other: 1 }) };
  assert.equal(simulateAttack(otherBase, plan, SEED).ok, false);
  const r = attackRejection({ ...record, snapshot: { ...record.snapshot, block_id: 'block:0000000000000000' } }, plan);
  assert.ok(r === 'plan_block_mismatch' || /^bad_base_snapshot:/.test(r));
});

test('a tampered base is rejected (bad_base_snapshot)', () => {
  const { record } = defenderBase();
  const tampered = { ...record, snapshot: { ...record.snapshot, theme: 'neon' } };
  const res = simulateAttack(tampered, honestPlan(record), SEED);
  assert.equal(res.ok, false);
  assert.match(res.reason, /^bad_base_snapshot:/);
});

test('a move against a non-existent structure misses (no error, no scorch)', () => {
  const { record } = defenderBase();
  const plan = makeAttackPlan(attacker, {
    target_block: BLOCK, base_address: record.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('ghost'), intensity: 3 }],
  });
  const res = simulateAttack(record, plan, SEED);
  assert.equal(res.ok, true);
  assert.equal(res.outcome.total_scorch, 0, 'missing target → no scorch');
});

test('a bad seed parameter is rejected', () => {
  const { record } = defenderBase();
  assert.equal(simulateAttack(record, honestPlan(record), '').ok, false);
  assert.equal(simulateAttack(record, honestPlan(record), 42).ok, false);
});

// ── scorch model ──
test('scorch clamps to the cap and never goes negative', () => {
  const ov = applyScorch(emptyScorch(), { 's:1': SCORCH_CAP * 5 });
  assert.equal(ov['s:1'], SCORCH_CAP);
  assert.ok(scorchBoundsHold(ov));
  const ov2 = applyScorch(ov, { 's:1': -9999 }); // negative add cannot push below zero; entry drops at 0
  assert.ok((ov2['s:1'] || 0) >= 0 && scorchBoundsHold(ov2));
});

test('scorch fully self-heals to empty given enough ticks', () => {
  const ov = applyScorch(emptyScorch(), { 's:1': 55, 's:2': 30 });
  assert.deepEqual(decayScorch(ov, ticksToHeal(ov)), {}, 'reversible — heals to empty');
  // partial decay reduces by exactly the rate per tick
  const one = decayScorch(ov, 1);
  assert.equal(one['s:1'], 55 - SCORCH_DECAY_PER_TICK);
});

test('applyScorch and decayScorch never mutate their inputs', () => {
  const ov = applyScorch(emptyScorch(), { 's:1': 40 });
  const snapshot = JSON.stringify(ov);
  applyScorch(ov, { 's:1': 10 });
  decayScorch(ov, 2);
  assert.equal(JSON.stringify(ov), snapshot, 'inputs immutable');
});

test('scorchBoundsHold accepts only integers in [0, CAP] and rejects non-integer / out-of-range / non-number', () => {
  for (const v of [0, 1, 50, SCORCH_CAP]) assert.equal(scorchBoundsHold({ x: v }), true, `${v} should pass`);
  for (const v of [-1, SCORCH_CAP + 1, 50.5, 0.1, NaN, Infinity, -Infinity, '50', null, undefined, {}]) {
    assert.equal(scorchBoundsHold({ x: v }), false, `${String(v)} should fail`);
  }
  // runtime overlays from the real apply/decay path stay integer-bounded
  const ov = applyScorch(emptyScorch(), { 's:1': SCORCH_CAP * 3, 's:2': 137, 's:3': 40 });
  assert.ok(scorchBoundsHold(ov), 'applyScorch output passes the tightened predicate');
  assert.ok(scorchBoundsHold(decayScorch(ov, 1)), 'decayScorch output passes the tightened predicate');
});

test('applyScorch rounds fractional amounts so the integer scorchBoundsHold invariant always holds', () => {
  // a fractional outcome amount must NOT leak a non-integer into the overlay (the comment-documented
  // Math.round path) — otherwise scorchBoundsHold would reject the module's own output.
  const ov = applyScorch(emptyScorch(), { 's:1': 12.5, 's:2': 0.4, 's:3': 39.6 });
  assert.ok(scorchBoundsHold(ov), 'fractional inputs round to integers and pass the invariant');
  assert.equal(ov['s:1'], 13, '12.5 rounds to 13');
  assert.equal(ov['s:3'], 40, '39.6 rounds to 40');
  assert.equal(ov['s:2'], undefined, '0.4 rounds to 0 and is dropped (zero entries pruned)');
  // accumulation stays integer too
  const ov2 = applyScorch(ov, { 's:1': 1.5 });
  assert.ok(scorchBoundsHold(ov2) && ov2['s:1'] === 15, '13 + 1.5 rounds to 15');
});
