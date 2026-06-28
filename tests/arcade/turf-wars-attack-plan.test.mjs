/**
 * Turf Wars Phase 2 foundation (lab) — ATTACK PLAN vocabulary/signing tests.
 *   node --test tests/arcade/turf-wars-attack-plan.test.mjs
 *
 * Proves the closed attack-plan grammar: deterministic + signed; tampered moves, foreign signatures,
 * unknown keys, out-of-vocab intensities/ids, and unbounded plans are all rejected. Lab-only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityFromSeed } from '../../arcade/hiveworld-agents/turf-wars/identity.mjs';
import { contentAddress } from '../../arcade/hiveworld-agents/turf-wars/canonical.mjs';
import {
  makeAttackPlan, verifyAttackPlan, validateMove, MOVE_INTENSITIES, MAX_MOVES,
} from '../../arcade/hiveworld-agents/turf-wars/attack-plan.mjs';
import { blockIdFor, structureId } from '../../arcade/hiveworld-agents/turf-wars/turf-evidence.mjs';

const attacker = identityFromSeed('attacker');
const mallory = identityFromSeed('mallory');
const BLOCK = blockIdFor(identityFromSeed('defender'));
const BASE = contentAddress({ base: 1 });
const okPlan = () => makeAttackPlan(attacker, {
  target_block: BLOCK, base_address: BASE, nonce: 'cafebabedeadbeef',
  moves: [{ structure_id: structureId('a'), intensity: 2 }],
});

test('a well-formed signed plan verifies; fixtures are deterministic', () => {
  assert.equal(verifyAttackPlan(okPlan()), null);
  assert.equal(okPlan().hash, okPlan().hash, 'same inputs → same hash');
});

test('a tampered move breaks the hash (hash_mismatch)', () => {
  const p = okPlan();
  const bad = { ...p, moves: [{ structure_id: structureId('a'), intensity: 3 }] }; // mutate after signing
  assert.equal(verifyAttackPlan(bad), 'hash_mismatch');
});

test('a foreign signature is rejected (bad_signature)', () => {
  const p = okPlan();
  const foreign = makeAttackPlan(mallory, { target_block: BLOCK, base_address: BASE, nonce: 'cafebabedeadbeef', moves: p.moves });
  assert.equal(verifyAttackPlan({ ...p, sig: foreign.sig }), 'bad_signature');
});

test('an unknown top-level key is rejected (unknown_plan_key)', () => {
  assert.equal(verifyAttackPlan({ ...okPlan(), evil: 1 }), 'unknown_plan_key');
});

test('out-of-vocab moves are rejected', () => {
  assert.equal(validateMove({ structure_id: structureId('a'), intensity: 9 }), 'bad_intensity');
  assert.equal(validateMove({ structure_id: 'not-an-id', intensity: 1 }), 'bad_structure_id');
  assert.equal(validateMove({ structure_id: structureId('a'), intensity: 1, extra: 1 }), 'move_shape');
  for (const i of MOVE_INTENSITIES) assert.equal(validateMove({ structure_id: structureId('a'), intensity: i }), null);
});

test('plan move count is bounded [1, MAX_MOVES]', () => {
  const empty = makeAttackPlan(attacker, { target_block: BLOCK, base_address: BASE, nonce: 'cafebabedeadbeef', moves: [] });
  assert.equal(verifyAttackPlan(empty), 'bad_moves_count');
  const tooMany = makeAttackPlan(attacker, {
    target_block: BLOCK, base_address: BASE, nonce: 'cafebabedeadbeef',
    moves: Array.from({ length: MAX_MOVES + 1 }, () => ({ structure_id: structureId('a'), intensity: 1 })),
  });
  assert.equal(verifyAttackPlan(tooMany), 'bad_moves_count');
});

test('malformed envelope fields are rejected with specific reasons', () => {
  assert.equal(verifyAttackPlan({ ...okPlan(), target_block: 'nope' }), 'bad_target_block');
  assert.equal(verifyAttackPlan({ ...okPlan(), base_address: 'nope' }), 'bad_base_address');
  assert.equal(verifyAttackPlan({ ...okPlan(), nonce: 'XYZ' }), 'bad_nonce');
  assert.equal(verifyAttackPlan(null), 'malformed_plan');
  assert.equal(verifyAttackPlan([1, 2]), 'malformed_plan');
});

test('no free text / URL can ride in a move (forbidden-content scan)', () => {
  // structure_id is regex-bound so a URL cannot be a valid move field; an injected extra key is caught
  // by validateMove (move_shape) before the scan — either way the plan is rejected, never accepted.
  const sneaky = makeAttackPlan(attacker, {
    target_block: BLOCK, base_address: BASE, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('a'), intensity: 1, note: 'http://evil' }],
  });
  assert.notEqual(verifyAttackPlan(sneaky), null);
});
