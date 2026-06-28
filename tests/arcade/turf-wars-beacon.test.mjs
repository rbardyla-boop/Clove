/**
 * Turf Wars Phase 3a BEACON SOURCE (lab) — commit-derived cross-block checkpoint beacon + window-close.
 *   node --test tests/arcade/turf-wars-beacon.test.mjs
 *
 * Proves the beacon SOURCE that resolves the O1 beacon residual (D5 source) as a MECHANISM, and the
 * window-close fold rule that BOUNDS (does not eliminate) the K-of-N multi-commit vector:
 *   - deriveCohort: determinism, exclusion, non-grindability (cohort pinned by seed_commit)
 *   - deriveBeacon: determinism, null-before-H_b (post-commit property)
 *   - the fold's commit_window_closed rejection (commit at seq >= H_b → rejected, zero scorch) AND the
 *     honest path (commit at seq < H_b → settles)
 *   - bad_beacon_height schema rejection
 *   - the evidence pack + suite pass across seeds
 * Lab-only; authority = replay-determinism + the existing delegable fraud-proof; no central server.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityFromSeed } from '../../arcade/hiveworld-agents/turf-wars/identity.mjs';
import { contentAddress } from '../../arcade/hiveworld-agents/turf-wars/canonical.mjs';
import { validatePayload, BEACON_HEIGHT_MAX } from '../../arcade/hiveworld-agents/turf-wars/ops.mjs';
import { foldBlock } from '../../arcade/hiveworld-agents/turf-wars/block-log.mjs';
import { signSnapshot } from '../../arcade/hiveworld-agents/turf-wars/snapshot.mjs';
import { makeAttackPlan } from '../../arcade/hiveworld-agents/turf-wars/attack-plan.mjs';
import {
  settleAttack, makeCommitOp, makeSettleOp, makeSeedCommit,
} from '../../arcade/hiveworld-agents/turf-wars/settlement.mjs';
import {
  deriveCohort, deriveBeacon, COHORT_SIZE, BEACON_VERSION,
} from '../../arcade/hiveworld-agents/turf-wars/beacon.mjs';
import {
  buildBeaconEvidencePack, buildBeaconEvidenceSuite,
} from '../../arcade/hiveworld-agents/turf-wars/beacon-evidence.mjs';
import { buildSignedChain, blockIdFor, structureId } from '../../arcade/hiveworld-agents/turf-wars/turf-evidence.mjs';

const SEED = 'abcd1234ef567890';
const SEED_COMMIT = makeSeedCommit(SEED);
const PLAN_HASH = contentAddress({ plan: 1 });

/** Build a foreign block folded to `height` ops (head seq_height = height - 1) and its signed snapshot. */
function foreign(label, height) {
  const id = identityFromSeed(`bcn-foreign/${label}`);
  const block = blockIdFor(id);
  const steps = [{ type: 'init_block', payload: { theme: 'neon' }, tick: 0 }];
  for (let i = 1; i < height; i++) {
    steps.push({ type: 'build_structure', payload: { structure_id: structureId(`${label}-${i}`), kind: 'signage', x: i % 16, y: (i * 2) % 16 }, tick: i });
  }
  const state = foldBlock(buildSignedChain(id, block, steps));
  return { id, block, state, record: signSnapshot(id, state) };
}

const witnessFixture = (n, height) => {
  const blocks = Array.from({ length: n }, (_, i) => foreign(`w${i}`, height));
  return { witnessed: blocks.map((b) => b.block), recordOf: new Map(blocks.map((b) => [b.block, b.record])) };
};

test('deriveCohort is deterministic, sized, and order-independent in the witnessed set', () => {
  const { witnessed } = witnessFixture(6, 6);
  const args = { seed_commit: SEED_COMMIT, plan_hash: PLAN_HASH, beacon_height: 5 };
  const a = deriveCohort({ ...args, witnessed });
  const b = deriveCohort({ ...args, witnessed: [...witnessed].reverse() });
  assert.equal(a.length, COHORT_SIZE);
  assert.deepEqual(a, b, 'cohort is independent of witnessed input order');
});

test('deriveCohort excludes the attacker and defender blocks', () => {
  const { witnessed } = witnessFixture(6, 6);
  const exclude = [witnessed[0], witnessed[1]];
  const cohort = deriveCohort({ seed_commit: SEED_COMMIT, plan_hash: PLAN_HASH, beacon_height: 5, witnessed, exclude });
  assert.equal(cohort.length, COHORT_SIZE);
  for (const id of exclude) assert.ok(!cohort.includes(id), `${id} must be excluded`);
});

test('deriveCohort is non-grindable: fixed seed_commit → identical cohort; a different commit → different', () => {
  const { witnessed } = witnessFixture(8, 6);
  const args = { plan_hash: PLAN_HASH, beacon_height: 5, witnessed };
  const fixed1 = deriveCohort({ ...args, seed_commit: SEED_COMMIT });
  const fixed2 = deriveCohort({ ...args, seed_commit: SEED_COMMIT });
  const other = deriveCohort({ ...args, seed_commit: makeSeedCommit('ffffffffffffffff') });
  assert.deepEqual(fixed1, fixed2, 'cohort cannot change while seed_commit is fixed');
  assert.notDeepEqual(other, fixed1, 'a different seed_commit selects a different cohort');
});

test('deriveBeacon is deterministic and is a closed 32-hex token', () => {
  const { witnessed, recordOf } = witnessFixture(6, 6);
  const cohort = deriveCohort({ seed_commit: SEED_COMMIT, plan_hash: PLAN_HASH, beacon_height: 5, witnessed });
  const recs = cohort.map((id) => recordOf.get(id));
  const b1 = deriveBeacon({ cohortRecords: recs, beacon_height: 5 });
  const b2 = deriveBeacon({ cohortRecords: [...recs].reverse(), beacon_height: 5 });
  assert.match(b1, /^[0-9a-f]{32}$/);
  assert.equal(b1, b2, 'beacon is independent of cohort-record order (sorted by block_id)');
});

test('deriveBeacon is UNDEFINED (null) before the cohort reaches H_b (post-commit property)', () => {
  const tall = foreign('tall', 6);   // seq_height = 5
  const short = foreign('short', 5); // seq_height = 4  (< H_b)
  // at H_b = 5: tall qualifies, short does not
  assert.equal(deriveBeacon({ cohortRecords: [tall.record], beacon_height: 5 }) !== null, true);
  assert.equal(short.state.seq_height, 4);
  assert.equal(deriveBeacon({ cohortRecords: [tall.record, short.record], beacon_height: 5 }), null, 'any record below H_b → null');
  // a tampered record also yields null (verifySnapshot fails)
  const tampered = { ...tall.record, sig: '0'.repeat(128) };
  assert.equal(deriveBeacon({ cohortRecords: [tampered], beacon_height: 5 }), null, 'a record that fails verifySnapshot → null');
  // an empty cohort → null
  assert.equal(deriveBeacon({ cohortRecords: [], beacon_height: 5 }), null);
});

// ── fold: window-close rule ──────────────────────────────────────────────────
const defender = identityFromSeed('bcn-def');
const attacker = identityFromSeed('bcn-atk');
const BLOCK = blockIdFor(defender);

function defenderChain(padTo) {
  const steps = [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
  ];
  for (let i = 2; i < padTo; i++) steps.push({ type: 'build_structure', payload: { structure_id: structureId(`pad${i}`), kind: 'signage', x: i % 16, y: (i + 2) % 16 }, tick: i });
  return buildSignedChain(defender, BLOCK, steps);
}
function plan(base) {
  return makeAttackPlan(attacker, {
    target_block: BLOCK, base_address: base.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('sign'), intensity: 3 }, { structure_id: structureId('sign'), intensity: 3 }],
  });
}

test('honest path: a commit folded at seq < H_b settles (window open)', () => {
  const chain = defenderChain(2);   // length 2 → commit at seq 2
  const base = signSnapshot(defender, foldBlock(chain));
  const H_b = 5;                    // commit seq 2 < 5 → open
  const st = settleAttack(base, plan(base), { seed_reveal: SEED, beacon: 'deadbeefdeadbeef', beacon_height: H_b });
  const commitOp = makeCommitOp(defender, { block_id: BLOCK, prev: chain[chain.length - 1].hash, seq: chain.length, tick: chain.length },
    { base_address: st.settlement.base_address, plan_hash: st.settlement.plan_hash, seed_commit: st.settlement.seed_commit, beacon_height: H_b });
  const settleOp = makeSettleOp(defender, { block_id: BLOCK, prev: commitOp.hash, seq: chain.length + 1, tick: chain.length + 1 }, st.settlement);
  const state = foldBlock([...chain, commitOp, settleOp]);
  assert.ok(state.applied.includes(settleOp.hash), 'settle folds when the commit is below H_b');
  assert.equal(state.settlements.length, 1);
  assert.ok(Object.keys(state.scorch).length >= 1, 'bounded scorch applied');
});

test('window-close: a commit folded at seq >= H_b → settle econ-rejected commit_window_closed, ZERO scorch', () => {
  const chain = defenderChain(6);   // length 6 → commit at seq 6
  const base = signSnapshot(defender, foldBlock(chain));
  const H_b = 5;                    // commit seq 6 >= 5 → closed
  const st = settleAttack(base, plan(base), { seed_reveal: SEED, beacon: 'deadbeefdeadbeef', beacon_height: H_b });
  const commitOp = makeCommitOp(defender, { block_id: BLOCK, prev: chain[chain.length - 1].hash, seq: chain.length, tick: chain.length },
    { base_address: st.settlement.base_address, plan_hash: st.settlement.plan_hash, seed_commit: st.settlement.seed_commit, beacon_height: H_b });
  const settleOp = makeSettleOp(defender, { block_id: BLOCK, prev: commitOp.hash, seq: chain.length + 1, tick: chain.length + 1 }, st.settlement);
  const state = foldBlock([...chain, commitOp, settleOp]);
  assert.ok(!state.applied.includes(settleOp.hash), 'settle must not fold past the window');
  assert.ok(state.econ_rejected.some((r) => r.ref === settleOp.hash && r.reason === 'commit_window_closed'));
  assert.equal(Object.keys(state.scorch).length, 0, 'no scorch when the window is closed');
});

test('window-close: a settle whose beacon_height disagrees with its commit is rejected', () => {
  const chain = defenderChain(2);
  const base = signSnapshot(defender, foldBlock(chain));
  const H_b = 5;
  const st = settleAttack(base, plan(base), { seed_reveal: SEED, beacon: 'deadbeefdeadbeef', beacon_height: H_b });
  const commitOp = makeCommitOp(defender, { block_id: BLOCK, prev: chain[chain.length - 1].hash, seq: chain.length, tick: chain.length },
    { base_address: st.settlement.base_address, plan_hash: st.settlement.plan_hash, seed_commit: st.settlement.seed_commit, beacon_height: H_b });
  // settle declares a DIFFERENT H_b (6) than the commit (5) → mismatch
  const mismatched = { ...st.settlement, beacon_height: 6 };
  const settleOp = makeSettleOp(defender, { block_id: BLOCK, prev: commitOp.hash, seq: chain.length + 1, tick: chain.length + 1 }, mismatched);
  const state = foldBlock([...chain, commitOp, settleOp]);
  assert.ok(!state.applied.includes(settleOp.hash));
  assert.ok(state.econ_rejected.some((r) => r.ref === settleOp.hash && r.reason === 'commit_window_closed'));
});

test('schema: bad_beacon_height is rejected on both attack_commit and settle_attack', () => {
  const commit = { base_address: contentAddress({ b: 1 }), plan_hash: contentAddress({ p: 1 }), seed_commit: SEED_COMMIT, beacon_height: 5 };
  assert.equal(validatePayload('attack_commit', commit), null);
  assert.equal(validatePayload('attack_commit', { ...commit, beacon_height: 0 }), 'bad_beacon_height');
  assert.equal(validatePayload('attack_commit', { ...commit, beacon_height: 1.5 }), 'bad_beacon_height');
  assert.equal(validatePayload('attack_commit', { ...commit, beacon_height: BEACON_HEIGHT_MAX + 1 }), 'bad_beacon_height');
  assert.equal(validatePayload('attack_commit', { base_address: commit.base_address, plan_hash: commit.plan_hash, seed_commit: SEED_COMMIT }), 'attack_commit_shape');

  const settle = {
    base_address: contentAddress({ b: 1 }), plan_hash: contentAddress({ p: 1 }),
    seed_commit: SEED_COMMIT, seed_reveal: SEED, beacon: 'deadbeefdeadbeef', beacon_height: 5,
    scorch: { [structureId('sign')]: 10 }, outcome_digest: contentAddress({ o: 1 }),
  };
  assert.equal(validatePayload('settle_attack', settle), null);
  assert.equal(validatePayload('settle_attack', { ...settle, beacon_height: -1 }), 'bad_beacon_height');
  assert.equal(validatePayload('settle_attack', { ...settle, beacon_height: 'x' }), 'bad_beacon_height');
});

test('the beacon evidence pack resolves the D5 beacon source and passes across seeds', () => {
  const pack = buildBeaconEvidencePack({ seed: 42 });
  for (const c of pack.claims) assert.equal(c.ok, true, `${c.id} — ${c.detail}`);
  assert.equal(pack.pass, true);
  assert.equal(pack.beacon_version, BEACON_VERSION);
  assert.ok(pack.resolves.some((r) => /D5 beacon SOURCE/.test(r)), 'D5 beacon source resolved');
  // honest residuals are DISCLOSED, not faked as resolved
  assert.ok(pack.deferred_residuals.some((r) => /K bound is a bound NOT K=1/.test(r)));
  assert.ok(pack.deferred_residuals.some((r) => /sybil cohort/.test(r)));
  assert.ok(pack.deferred_residuals.length >= 4);
  const suite = buildBeaconEvidenceSuite({ seeds: [42, 1337, 9001, 24601] });
  assert.equal(suite.pass, true);
});
