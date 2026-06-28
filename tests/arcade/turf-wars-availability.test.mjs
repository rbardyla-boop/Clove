/**
 * Turf Wars Phase 3b AVAILABILITY (lab) — holder-set view-model + deterministic challenge-window predicate.
 *   node --test tests/arcade/turf-wars-availability.test.mjs
 *
 * Proves the O2 availability MECHANISM: a seeded in-process holder set (signing-keyless, swappable) and a
 * pure finalization predicate over LOGICAL seq-heights. Covers holder validation (tamper excluded, swap-index
 * identical), finalize() provisional/final/refuted transitions, offline-victim-protected-iff-honest-watcher,
 * partition-past-window finalizes the forgery (the EXPECTED RESIDUAL — protection is conditional, not closed),
 * scorch-outside-fingerprint, convergence under storm, and that the evidence/stress packs pass across seeds.
 * Lab-only; no real network; the honest-minority assumption and partition-past-window are DISCLOSED residuals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityFromSeed } from '../../arcade/hiveworld-agents/turf-wars/identity.mjs';
import { contentAddress } from '../../arcade/hiveworld-agents/turf-wars/canonical.mjs';
import { foldBlock, blockFingerprint } from '../../arcade/hiveworld-agents/turf-wars/block-log.mjs';
import { signSnapshot, verifySnapshot } from '../../arcade/hiveworld-agents/turf-wars/snapshot.mjs';
import { makeAttackPlan } from '../../arcade/hiveworld-agents/turf-wars/attack-plan.mjs';
import { settleAttack, makeCommitOp, makeSettleOp, proveFraud } from '../../arcade/hiveworld-agents/turf-wars/settlement.mjs';
import {
  makeHolderIndex, assignHolders, protectedIffWatched, HOLDER_ROLE, lcg, AVAILABILITY_VERSION,
} from '../../arcade/hiveworld-agents/turf-wars/availability.mjs';
import {
  finalize, watcherVerdict, FINALIZE_STATUS, CHALLENGE_WINDOW_HEIGHTS,
} from '../../arcade/hiveworld-agents/turf-wars/challenge-window.mjs';
import {
  buildAvailabilityEvidencePack, buildAvailabilityEvidenceSuite, LAB_MODULE_PATHS,
} from '../../arcade/hiveworld-agents/turf-wars/availability-evidence.mjs';
import {
  buildAvailabilityStressPack, buildAvailabilityStressSuite,
} from '../../arcade/hiveworld-agents/turf-wars/availability-stress.mjs';
import { buildSignedChain, blockIdFor, structureId } from '../../arcade/hiveworld-agents/turf-wars/turf-evidence.mjs';

const defender = identityFromSeed('avail-test-def');
const attacker = identityFromSeed('avail-test-atk');
const BLOCK = blockIdFor(defender);
const W = CHALLENGE_WINDOW_HEIGHTS;

function fixture() {
  const chain = buildSignedChain(defender, BLOCK, [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
    { type: 'build_structure', payload: { structure_id: structureId('node'), kind: 'resource_node', x: 2, y: 2 }, tick: 2 },
  ]);
  const state = foldBlock(chain);
  const base = signSnapshot(defender, state);
  const plan = makeAttackPlan(attacker, {
    target_block: BLOCK, base_address: base.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('sign'), intensity: 3 }, { structure_id: structureId('sign'), intensity: 3 }],
  });
  const beaconHeight = chain.length + 1;
  const honest = settleAttack(base, plan, { seed_reveal: 'abcd1234ef567890', beacon: 'deadbeefdeadbeef', beacon_height: beaconHeight }).settlement;
  const forged = { ...honest, outcome_digest: contentAddress({ forged: 1 }) };
  const head = chain[chain.length - 1].hash;
  const commitOp = makeCommitOp(defender, { block_id: BLOCK, prev: head, seq: chain.length, tick: chain.length },
    { base_address: honest.base_address, plan_hash: honest.plan_hash, seed_commit: honest.seed_commit, beacon_height: beaconHeight });
  const settleOp = makeSettleOp(defender, { block_id: BLOCK, prev: commitOp.hash, seq: chain.length + 1, tick: chain.length + 1 }, honest);
  return { chain, state, base, plan, honest, forged, commitOp, settleOp, open_height: settleOp.seq };
}

// ── holder index: validation + keyless + swappable ──

test('holder index counts only holders whose cached snapshot verifies; a tampered copy is excluded', () => {
  const { base } = fixture();
  const tampered = { ...base, snapshot: { ...base.snapshot, counters: { ...base.snapshot.counters, flux: base.snapshot.counters.flux + 1 } } };
  assert.equal(verifySnapshot(base), null, 'honest record verifies');
  assert.notEqual(verifySnapshot(tampered), null, 'tampered record fails verification');
  const idx = makeHolderIndex();
  idx.put('honest', base);
  idx.put('byz', tampered);
  assert.deepEqual([...idx.holdersOf(base.address)].sort(), ['byz', 'honest'], 'both claim to cache (valid or not)');
  const valid = idx.validHoldersOf(base.address);
  assert.ok(valid.has('honest') && !valid.has('byz'), 'only the valid cache is counted');
  assert.equal(valid.size, 1);
});

test('swapping the holder index for a plain map with the same verifySnapshot gate yields identical valid sets', () => {
  const { base } = fixture();
  const tampered = { ...base, snapshot: { ...base.snapshot, theme: 'TAMPERED' } };
  const idx = makeHolderIndex();
  idx.put('a', base); idx.put('b', tampered); idx.put('c', base);
  const fromIndex = [...idx.validHoldersOf(base.address)].sort();
  // a plain Map applying the same gate (authority = owner key inside the record, not the index)
  const plain = new Map();
  const put = (h, r) => { if (!plain.has(r.address)) plain.set(r.address, new Map()); plain.get(r.address).set(h, r); };
  put('a', base); put('b', tampered); put('c', base);
  const fromPlain = [];
  for (const [h, r] of plain.get(base.address)) if (verifySnapshot(r) === null) fromPlain.push(h);
  assert.deepEqual(fromIndex, fromPlain.sort(), 'index swap does not change any outcome');
});

test('holder roles are assigned deterministically from a seed (no wall clock)', () => {
  const a = assignHolders({ seed: 7, count: 10 });
  const b = assignHolders({ seed: 7, count: 10 });
  assert.deepEqual(a, b, 'same seed -> identical population');
  assert.equal(a.length, 10);
  for (const h of a) assert.ok(Object.values(HOLDER_ROLE).includes(h.role));
  assert.equal(AVAILABILITY_VERSION, 1);
  const rnd = lcg(123); assert.equal(typeof rnd(), 'number');
});

// ── finalize() transitions ──

test('finalize: provisional before W, final exactly at W, with no in-window fraud-proof', () => {
  const { open_height } = fixture();
  assert.equal(finalize({ open_height }, open_height, open_height, [], W).status, FINALIZE_STATUS.PROVISIONAL);
  assert.equal(finalize({ open_height }, open_height, open_height + W - 1, [], W).status, FINALIZE_STATUS.PROVISIONAL);
  assert.equal(finalize({ open_height }, open_height, open_height + W, [], W).status, FINALIZE_STATUS.FINAL);
  assert.equal(finalize({ open_height }, open_height, open_height + W + 5, [], W).status, FINALIZE_STATUS.FINAL);
});

test('finalize: a single valid in-window fraud-proof flips to refuted at any in-window height, even delta 0', () => {
  const { base, plan, forged, open_height } = fixture();
  const fraud = proveFraud(base, plan, forged);
  assert.equal(fraud.mismatch, true);
  // delta 0 (the earliest in-window height)
  assert.equal(finalize({ open_height }, open_height, open_height, [watcherVerdict({ height: open_height, fraud_proof: fraud })], W).status, FINALIZE_STATUS.REFUTED);
  // mid-window
  assert.equal(finalize({ open_height }, open_height, open_height + 3, [watcherVerdict({ height: open_height + 2, fraud_proof: fraud })], W).status, FINALIZE_STATUS.REFUTED);
  // even after the window would otherwise finalize, an in-window proof still refutes
  assert.equal(finalize({ open_height }, open_height, open_height + W + 10, [watcherVerdict({ height: open_height + 1, fraud_proof: fraud })], W).status, FINALIZE_STATUS.REFUTED);
});

test('finalize: an OUT-of-window fraud-proof does NOT refute; a clean settlement finalizes', () => {
  const { base, plan, forged, honest, open_height } = fixture();
  const fraud = proveFraud(base, plan, forged);
  // a fraud-proof at open_height + W (just outside [open, open+W)) is ignored -> final
  assert.equal(finalize({ open_height }, open_height, open_height + W, [watcherVerdict({ height: open_height + W, fraud_proof: fraud })], W).status, FINALIZE_STATUS.FINAL);
  // an honest settlement has no fraud-proof at all (proveFraud null) -> never refuted
  assert.equal(proveFraud(base, plan, honest), null);
  assert.equal(finalize({ open_height }, open_height, open_height + W, [watcherVerdict({ height: open_height, fraud_proof: proveFraud(base, plan, honest) })], W).status, FINALIZE_STATUS.FINAL);
});

// ── offline victim protected iff an honest watcher holds+watches ──

test('offline victim is protected when >=1 OTHER honest peer holds a valid snapshot and watches in-window', () => {
  const { base, plan, forged } = fixture();
  const idx = makeHolderIndex();
  idx.put('honest-peer', base); // the defender (victim) is OFFLINE — a different honest peer caches the snapshot
  const honestSet = new Set(['honest-peer']);
  const watching = new Set(['honest-peer']);
  assert.equal(protectedIffWatched(forged, base, plan, idx, watching, honestSet), true, 'honest watcher refutes for the offline victim');
  // a peer that holds but is NOT honest -> not protected
  assert.equal(protectedIffWatched(forged, base, plan, idx, watching, new Set()), false, 'a non-honest holder does not protect');
  // a peer that is honest but NOT watching -> not protected
  assert.equal(protectedIffWatched(forged, base, plan, idx, new Set(), honestSet), false, 'an honest non-watcher does not protect');
});

test('an honest (non-forged) settlement has nothing to refute — protectedIffWatched is false', () => {
  const { base, plan, honest } = fixture();
  const idx = makeHolderIndex();
  idx.put('honest-peer', base);
  assert.equal(protectedIffWatched(honest, base, plan, idx, new Set(['honest-peer']), new Set(['honest-peer'])), false);
});

// ── partition past window: the EXPECTED RESIDUAL ──

test('EXPECTED RESIDUAL: a partition isolating victim + all honest holders past W lets the forgery FINALIZE', () => {
  const { base, plan, forged, open_height } = fixture();
  // no honest holder reached the snapshot, no one watches in-window
  const partitionedIndex = makeHolderIndex();
  const protectedUnderPartition = protectedIffWatched(forged, base, plan, partitionedIndex, new Set(), new Set(['would-be-honest']));
  assert.equal(protectedUnderPartition, false, 'no honest holder reached the snapshot -> not protected');
  // with no in-window verdict, the forged settlement finalizes after W
  assert.equal(finalize({ open_height }, open_height, open_height + W, [], W).status, FINALIZE_STATUS.FINAL,
    'partition-past-window: forgery finalizes — honest-minority assumption broken, DISCLOSED not closed');
});

// ── scorch outside fingerprint ──

test('the scorch overlay (and thus settlement status) is excluded from blockFingerprint', () => {
  const { chain, commitOp, settleOp } = fixture();
  const settled = foldBlock([...chain, commitOp, settleOp]);
  assert.ok(Object.keys(settled.scorch).length >= 1, 'a settlement applied some scorch');
  const fp = blockFingerprint(settled);
  // mutate the scorch overlay arbitrarily -> fingerprint unchanged
  assert.equal(blockFingerprint({ ...settled, scorch: { [structureId('sign')]: 77 } }), fp);
  assert.equal(blockFingerprint({ ...settled, scorch: {} }), fp);
});

// ── convergence under storm ──

test('a seeded reorder/dup storm over the settlement op-set folds to the same blockFingerprint', () => {
  const { chain, commitOp, settleOp } = fixture();
  const opSet = [...chain, commitOp, settleOp];
  const baseFp = blockFingerprint(foldBlock(opSet));
  const rnd = lcg(999);
  for (let k = 0; k < 20; k++) {
    const dups = [];
    for (let i = 0; i < 6; i++) dups.push(opSet[Math.floor(rnd() * opSet.length)]);
    const storm = [...opSet, ...dups];
    for (let i = storm.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [storm[i], storm[j]] = [storm[j], storm[i]]; }
    assert.equal(blockFingerprint(foldBlock(storm)), baseFp, `shuffle ${k} converges`);
  }
});

test('re-delivering a rejected (no_prior_commit) settle op N times cannot grow audit state or apply scorch', () => {
  const { chain, honest } = fixture();
  const orphan = makeSettleOp(defender, { block_id: BLOCK, prev: chain[chain.length - 1].hash, seq: chain.length, tick: chain.length }, honest);
  const once = foldBlock([...chain, orphan]);
  const flood = []; for (let i = 0; i < 100; i++) flood.push(orphan);
  const many = foldBlock([...chain, ...flood]);
  assert.equal(
    many.econ_rejected.filter((r) => r.ref === orphan.hash).length,
    once.econ_rejected.filter((r) => r.ref === orphan.hash).length,
    'audit state bounded under flood');
  assert.ok(many.econ_rejected.some((r) => r.ref === orphan.hash && r.reason === 'no_prior_commit'));
  assert.equal(Object.keys(many.scorch).length, 0, 'no scorch from a rejected settle');
});

// ── evidence + stress packs ──

test('the availability evidence pack resolves O2 availability and passes across seeds', () => {
  const pack = buildAvailabilityEvidencePack({ seed: 42 });
  for (const c of pack.claims) assert.equal(c.ok, true, `${c.id} — ${c.detail}`);
  assert.equal(pack.pass, true);
  assert.ok(pack.resolves.some((r) => /O2 availability/.test(r)), 'O2 availability resolved as a mechanism');
  // residuals are DISCLOSED, not faked as resolved
  assert.ok(pack.deferred_residuals.some((r) => /honest-minority/.test(r)));
  assert.ok(pack.deferred_residuals.some((r) => /partition-past-window/.test(r)));
  const suite = buildAvailabilityEvidenceSuite({ seeds: [42, 1337, 9001, 24601] });
  assert.equal(suite.pass, true);
});

test('the availability stress pack passes across seeds and pins the partition-past-window residual', () => {
  const pack = buildAvailabilityStressPack({ seed: 42 });
  for (const c of pack.claims) assert.equal(c.ok, true, `${c.id} — ${c.detail}`);
  assert.equal(pack.pass, true);
  assert.equal(pack.expected_residual_witness, 'SP_partition_past_window_finalizes_forgery_EXPECTED_RESIDUAL');
  assert.ok(pack.claims.some((c) => c.id === 'SP_partition_past_window_finalizes_forgery_EXPECTED_RESIDUAL'),
    'the partition falsifier is reproduced as a pinned, expected claim — not hidden');
  const suite = buildAvailabilityStressSuite({ seeds: [42, 1337, 9001] });
  assert.equal(suite.pass, true);
});

test('the four Phase-3b availability lab modules are enumerated for the denylist self-check', () => {
  assert.deepEqual([...LAB_MODULE_PATHS], [
    'arcade/hiveworld-agents/turf-wars/availability.mjs',
    'arcade/hiveworld-agents/turf-wars/challenge-window.mjs',
    'arcade/hiveworld-agents/turf-wars/availability-evidence.mjs',
    'arcade/hiveworld-agents/turf-wars/availability-stress.mjs',
  ]);
});
