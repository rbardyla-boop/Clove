/**
 * Turf Wars Phase 2 SETTLEMENT (lab) — O1 commit-reveal + O2 delegable fraud-proof + fold application.
 *   node --test tests/arcade/turf-wars-settlement.test.mjs
 *
 * Proves the settlement layer that resolves D5 (seed grinding) and D7 (offline-victim liveness) as
 * mechanisms, and the hard invariants: cosmetic/reversible scorch only, base never mutated, no value
 * transfer, attacker_reward credited to nothing. Lab-only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityFromSeed } from '../../arcade/hiveworld-agents/turf-wars/identity.mjs';
import { canonicalize, contentAddress } from '../../arcade/hiveworld-agents/turf-wars/canonical.mjs';
import { validatePayload } from '../../arcade/hiveworld-agents/turf-wars/ops.mjs';
import { foldBlock } from '../../arcade/hiveworld-agents/turf-wars/block-log.mjs';
import { signSnapshot } from '../../arcade/hiveworld-agents/turf-wars/snapshot.mjs';
import { makeAttackPlan } from '../../arcade/hiveworld-agents/turf-wars/attack-plan.mjs';
import {
  settleAttack, makeCommitOp, makeSettleOp, verifySettlement, proveFraud, makeSeedCommit, verifySeedReveal, deriveSettlementSeed,
} from '../../arcade/hiveworld-agents/turf-wars/settlement.mjs';
import { decayScorch, ticksToHeal, scorchBoundsHold, SCORCH_CAP } from '../../arcade/hiveworld-agents/turf-wars/scorch.mjs';
import { buildSettlementEvidencePack, buildSettlementEvidenceSuite } from '../../arcade/hiveworld-agents/turf-wars/settlement-evidence.mjs';
import { buildSignedChain, blockIdFor, structureId } from '../../arcade/hiveworld-agents/turf-wars/turf-evidence.mjs';

const defender = identityFromSeed('s-def');
const attacker = identityFromSeed('s-atk');
const BLOCK = blockIdFor(defender);
const SEED = 'abcd1234ef567890';
const BEACON = 'deadbeefdeadbeef';
// Phase-3a: the test fixture chain has 2 ops, so the commit folds at seq=2 and the settle at seq=3;
// H_b must be strictly greater than the commit's fold height for the window-close rule to pass.
const BEACON_HEIGHT = 3;

function fixture() {
  const chain = buildSignedChain(defender, BLOCK, [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
  ]);
  const state = foldBlock(chain);
  return { chain, state, base: signSnapshot(defender, state) };
}
function honestPlan(base) {
  return makeAttackPlan(attacker, {
    target_block: BLOCK, base_address: base.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('sign'), intensity: 3 }, { structure_id: structureId('sign'), intensity: 3 }],
  });
}
/** Build the two-phase ops: an attack_commit at seq=chain.length then its settle_attack at seq+1. */
function commitThenSettle(chain, settlement, tamperReveal) {
  const head = chain[chain.length - 1].hash;
  const commitOp = makeCommitOp(defender, { block_id: BLOCK, prev: head, seq: chain.length, tick: chain.length },
    { base_address: settlement.base_address, plan_hash: settlement.plan_hash, seed_commit: settlement.seed_commit, beacon_height: settlement.beacon_height });
  const s = tamperReveal ? { ...settlement, seed_reveal: tamperReveal } : settlement;
  const settleOp = makeSettleOp(defender, { block_id: BLOCK, prev: commitOp.hash, seq: chain.length + 1, tick: chain.length + 1 }, s);
  return { commitOp, settleOp };
}

test('settleAttack is deterministic and the commit binds the reveal', () => {
  const { base } = fixture();
  const a = settleAttack(base, honestPlan(base), { seed_reveal: SEED, beacon: BEACON, beacon_height: BEACON_HEIGHT });
  const b = settleAttack(base, honestPlan(base), { seed_reveal: SEED, beacon: BEACON, beacon_height: BEACON_HEIGHT });
  assert.equal(a.ok, true);
  assert.equal(a.settlement.outcome_digest, b.settlement.outcome_digest, 'same inputs -> same settlement');
  assert.equal(a.settlement.seed_commit, makeSeedCommit(SEED));
  assert.equal(verifySeedReveal(a.settlement.seed_commit, SEED), true);
});

test('O1: a wrong reveal is rejected and a post-commit beacon changes the outcome (grind resistance)', () => {
  const { base } = fixture();
  const a = settleAttack(base, honestPlan(base), { seed_reveal: SEED, beacon: BEACON, beacon_height: BEACON_HEIGHT });
  assert.equal(verifySeedReveal(a.settlement.seed_commit, 'ffffffffffffffff'), false, 'reveal must match commit');
  const other = settleAttack(base, honestPlan(base), { seed_reveal: SEED, beacon: '00000000ffffffff' });
  assert.notEqual(other.settlement.outcome_digest, a.settlement.outcome_digest, 'beacon binds the seed');
  // derive is pure
  const args = { base_address: base.address, plan_hash: honestPlan(base).hash, seed_reveal: SEED, beacon: BEACON };
  assert.equal(deriveSettlementSeed(args), deriveSettlementSeed(args));
});

test('O1: bad seed/beacon tokens are rejected', () => {
  const { base } = fixture();
  assert.equal(settleAttack(base, honestPlan(base), { seed_reveal: 'XYZ', beacon: BEACON }).reason, 'bad_seed_reveal');
  assert.equal(settleAttack(base, honestPlan(base), { seed_reveal: SEED, beacon: 'nothex' }).reason, 'bad_beacon');
});

test('O2: verification is delegable to any peer; a forged settlement against an offline victim is caught', () => {
  const { base } = fixture();
  const plan = honestPlan(base);
  const st = settleAttack(base, plan, { seed_reveal: SEED, beacon: BEACON, beacon_height: BEACON_HEIGHT });
  // a third party (only public inputs) verifies the honest settlement and finds NO fraud
  assert.equal(verifySettlement(base, plan, st.settlement), true);
  assert.equal(proveFraud(base, plan, st.settlement), null);
  // a forged outcome digest -> third-party fraud-proof (the victim need not be online)
  const forged = { ...st.settlement, outcome_digest: contentAddress({ forged: 1 }) };
  assert.equal(verifySettlement(base, plan, forged), false);
  const fraud = proveFraud(base, plan, forged);
  assert.equal(fraud.mismatch, true);
  assert.equal(fraud.honest_digest, st.settlement.outcome_digest);
});

test('settle_attack folds (after its prior commit): bounded cosmetic scorch only — base, counters, structures untouched', () => {
  const { chain, state, base } = fixture();
  const st = settleAttack(base, honestPlan(base), { seed_reveal: SEED, beacon: BEACON, beacon_height: BEACON_HEIGHT });
  const { commitOp, settleOp } = commitThenSettle(chain, st.settlement);
  const settled = foldBlock([...chain, commitOp, settleOp]);
  assert.ok(settled.applied.includes(settleOp.hash));
  assert.equal(settled.settlements.length, 1);
  assert.ok(scorchBoundsHold(settled.scorch));
  assert.ok(Object.keys(settled.scorch).length >= 1, 'scorch applied to the overlay');
  // hard invariants
  assert.equal(JSON.stringify(settled.structures), JSON.stringify(state.structures), 'structures unchanged');
  assert.equal(settled.counters.flux, state.counters.flux, 'flux unchanged');
  assert.equal(settled.counters.cores, state.counters.cores, 'cores unchanged');
  assert.equal(canonicalize(signSnapshot(defender, foldBlock(chain))), canonicalize(base), 'base snapshot bytes unchanged');
});

test('O1: a settle_attack with NO prior attack_commit fails to fold (no_prior_commit) — commit-before-settle enforced', () => {
  const { chain, base } = fixture();
  const st = settleAttack(base, honestPlan(base), { seed_reveal: SEED, beacon: BEACON, beacon_height: BEACON_HEIGHT });
  const settleOp = makeSettleOp(defender, { block_id: BLOCK, prev: chain[chain.length - 1].hash, seq: chain.length, tick: chain.length }, st.settlement);
  const settled = foldBlock([...chain, settleOp]);
  assert.ok(!settled.applied.includes(settleOp.hash));
  assert.ok(settled.econ_rejected.some((r) => r.ref === settleOp.hash && r.reason === 'no_prior_commit'));
  assert.equal(Object.keys(settled.scorch).length, 0, 'no scorch without a prior commit');
});

test('settled scorch is reversible — it self-heals to empty', () => {
  const { chain, base } = fixture();
  const st = settleAttack(base, honestPlan(base), { seed_reveal: SEED, beacon: BEACON, beacon_height: BEACON_HEIGHT });
  const { commitOp, settleOp } = commitThenSettle(chain, st.settlement);
  const settled = foldBlock([...chain, commitOp, settleOp]);
  assert.deepEqual(decayScorch(settled.scorch, ticksToHeal(settled.scorch)), {});
});

test('a settle_attack whose reveal does not match its commit fails to fold (bad_seed_commit)', () => {
  const { chain, base } = fixture();
  const st = settleAttack(base, honestPlan(base), { seed_reveal: SEED, beacon: BEACON, beacon_height: BEACON_HEIGHT });
  const { commitOp, settleOp } = commitThenSettle(chain, st.settlement, '0000000011111111'); // reveal sha256 != commit
  const settled = foldBlock([...chain, commitOp, settleOp]);
  assert.ok(!settled.applied.includes(settleOp.hash));
  assert.ok(settled.econ_rejected.some((r) => r.ref === settleOp.hash && r.reason === 'bad_seed_commit'));
  assert.equal(Object.keys(settled.scorch).length, 0, 'no scorch applied on a bad binding');
});

test('attack_commit op schema is closed', () => {
  const good = { base_address: contentAddress({ b: 1 }), plan_hash: contentAddress({ p: 1 }), seed_commit: makeSeedCommit(SEED), beacon_height: BEACON_HEIGHT };
  assert.equal(validatePayload('attack_commit', good), null);
  assert.equal(validatePayload('attack_commit', { ...good, seed_commit: 'short' }), 'bad_seed_commit');
  assert.equal(validatePayload('attack_commit', { ...good, base_address: 'nope' }), 'bad_base_address');
  assert.equal(validatePayload('attack_commit', { ...good, beacon_height: -1 }), 'bad_beacon_height');
  assert.equal(validatePayload('attack_commit', { ...good, evil: 1 }), 'attack_commit_shape');
});

test('settle_attack op schema is closed: out-of-range scorch, unknown key, bad beacon all rejected', () => {
  const good = {
    base_address: contentAddress({ b: 1 }), plan_hash: contentAddress({ p: 1 }),
    seed_commit: makeSeedCommit(SEED), seed_reveal: SEED, beacon: BEACON, beacon_height: BEACON_HEIGHT,
    scorch: { [structureId('sign')]: 50 }, outcome_digest: contentAddress({ o: 1 }),
  };
  assert.equal(validatePayload('settle_attack', good), null);
  assert.equal(validatePayload('settle_attack', { ...good, scorch: { [structureId('sign')]: SCORCH_CAP + 1 } }), 'bad_scorch_value');
  assert.equal(validatePayload('settle_attack', { ...good, scorch: { 'not-an-id': 10 } }), 'bad_scorch_key');
  assert.equal(validatePayload('settle_attack', { ...good, beacon: 'nothex!!' }), 'bad_beacon');
  assert.equal(validatePayload('settle_attack', { ...good, seed_commit: 'short' }), 'bad_seed_commit');
  assert.equal(validatePayload('settle_attack', { ...good, beacon_height: 0 }), 'bad_beacon_height');
  assert.equal(validatePayload('settle_attack', { ...good, evil: 1 }), 'settle_attack_shape');
});

test('the settlement evidence pack resolves D5 + D7 and passes across seeds', () => {
  const pack = buildSettlementEvidencePack({ seed: 42 });
  for (const c of pack.claims) assert.equal(c.ok, true, `${c.id} — ${c.detail}`);
  assert.equal(pack.pass, true);
  assert.ok(pack.resolves.some((r) => /D5/.test(r)) && pack.resolves.some((r) => /D7/.test(r)), 'D5+D7 resolved');
  assert.ok(pack.claims.some((c) => c.id === 'D5_seed_grinding_resistant') && pack.claims.some((c) => c.id === 'D7_offline_victim_liveness'));
  // honest residuals are stated, not faked as resolved
  assert.ok(pack.deferred_residuals.length >= 2);
  const suite = buildSettlementEvidenceSuite({ seeds: [42, 1337, 9001, 24601] });
  assert.equal(suite.pass, true);
});
