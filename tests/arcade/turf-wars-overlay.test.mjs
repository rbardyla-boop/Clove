/**
 * Turf Wars — Phase 3c MULTI-WRITER OVERLAY (O6, lab) · UNIT TESTS.
 *   node --test tests/arcade/turf-wars-overlay.test.mjs
 *
 * Covers the per-attacker single-writer mini-log (settlement-mini-log.mjs), the content-addressed convergent
 * overlay + keyless revocation (overlay-dag.mjs), and the evidence pack + suite (overlay-evidence.mjs). LAB
 * ONLY — these modules are denylisted from the curated production upload and imported by no production path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { identityFromSeed } from '../../arcade/hiveworld-agents/turf-wars/identity.mjs';
import { contentAddress } from '../../arcade/hiveworld-agents/turf-wars/canonical.mjs';
import { foldBlock, blockFingerprint } from '../../arcade/hiveworld-agents/turf-wars/block-log.mjs';
import { signSnapshot } from '../../arcade/hiveworld-agents/turf-wars/snapshot.mjs';
import { makeAttackPlan } from '../../arcade/hiveworld-agents/turf-wars/attack-plan.mjs';
import { settleAttack, proveFraud } from '../../arcade/hiveworld-agents/turf-wars/settlement.mjs';
import { SCORCH_CAP } from '../../arcade/hiveworld-agents/turf-wars/scorch.mjs';
import { buildSignedChain, blockIdFor, structureId } from '../../arcade/hiveworld-agents/turf-wars/turf-evidence.mjs';
import {
  makeMiniLogId, makeSettlementCommitOp, makeSettlementRevealOp, makeMiniOp,
  foldMiniLog, miniLogFingerprint, verifyMiniOp, MINI_OP_TYPES,
} from '../../arcade/hiveworld-agents/turf-wars/settlement-mini-log.mjs';
import {
  foldOverlay, overlayFingerprint, overlayEntryFromMiniLog, makeRevocationEntry,
  verifyRevocationEntry, overlayBoundsHold, ENTRY_STATUS,
} from '../../arcade/hiveworld-agents/turf-wars/overlay-dag.mjs';
import {
  buildOverlayEvidencePack, buildOverlayEvidenceSuite,
} from '../../arcade/hiveworld-agents/turf-wars/overlay-evidence.mjs';

// ── shared deterministic fixture ──────────────────────────────────────────────
function fixture(seed = 7) {
  const defender = identityFromSeed(`t-def/${seed}`);
  const block = blockIdFor(defender);
  const steps = [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('t-sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
    { type: 'build_structure', payload: { structure_id: structureId('t-node'), kind: 'resource_node', x: 2, y: 2 }, tick: 2 },
  ];
  const chain = buildSignedChain(defender, block, steps);
  const state = foldBlock(chain);
  const base = signSnapshot(defender, state);
  return { defender, block, chain, state, base, steps };
}

function buildAttacker(seed, idx, base, block, target = structureId('t-sign')) {
  const attacker = identityFromSeed(`t-atk/${seed}/${idx}`);
  const seedReveal = contentAddress({ seed, idx }).slice(7, 7 + 32);
  const beacon = contentAddress({ b: seed, idx }).slice(7, 7 + 16);
  const beaconHeight = 4;
  const plan = makeAttackPlan(attacker, {
    target_block: block, base_address: base.address, nonce: contentAddress({ n: seed, idx }).slice(7, 7 + 16),
    moves: [{ structure_id: target, intensity: 3 }, { structure_id: target, intensity: 3 }],
  });
  const st = settleAttack(base, plan, { seed_reveal: seedReveal, beacon, beacon_height: beaconHeight });
  const settlement = st.settlement;
  const mini_log_id = makeMiniLogId({ block_id: block, base_address: base.address, attacker_pubkey: attacker.publicRawHex });
  const commitOp = makeSettlementCommitOp(attacker, { mini_log_id, prev: null, seq: 0, tick: 0 },
    { base_address: settlement.base_address, plan_hash: settlement.plan_hash, seed_commit: settlement.seed_commit, beacon_height: beaconHeight });
  const revealOp = makeSettlementRevealOp(attacker, { mini_log_id, prev: commitOp.hash, seq: 1, tick: 1 }, settlement);
  const ops = [commitOp, revealOp];
  const folded = foldMiniLog(ops);
  return { attacker, plan, settlement, mini_log_id, commitOp, revealOp, ops, folded, entry: overlayEntryFromMiniLog(folded) };
}

const shuffle = (arr, n = 1) => { // deterministic rotate-shuffle (no Math.random)
  const out = [...arr];
  for (let r = 0; r < n; r++) out.push(out.shift());
  return out;
};

// ── makeMiniLogId ─────────────────────────────────────────────────────────────
test('makeMiniLogId is content-derived and deterministic; distinct attackers → distinct ids', () => {
  const { base, block } = fixture();
  const a = identityFromSeed('m/a'); const b = identityFromSeed('m/b');
  const idA1 = makeMiniLogId({ block_id: block, base_address: base.address, attacker_pubkey: a.publicRawHex });
  const idA2 = makeMiniLogId({ block_id: block, base_address: base.address, attacker_pubkey: a.publicRawHex });
  const idB = makeMiniLogId({ block_id: block, base_address: base.address, attacker_pubkey: b.publicRawHex });
  assert.equal(idA1, idA2, 'same inputs → same id (coordination-free)');
  assert.notEqual(idA1, idB, 'distinct attacker → distinct mini_log_id');
  assert.match(idA1, /^[0-9a-f]{64}$/);
});

// ── foldMiniLog single-writer + ordering ──────────────────────────────────────
test('foldMiniLog: honest commit→reveal folds; head + reveal recorded', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block);
  assert.equal(a.folded.seq_height, 1);
  assert.equal(a.folded.mini_log_head, a.revealOp.hash);
  assert.ok(a.folded.commit, 'commit recorded');
  assert.ok(a.folded.reveal, 'reveal recorded');
  assert.equal(a.folded.reveal.outcome_digest, a.settlement.outcome_digest);
  assert.equal(a.folded.rejected.length, 0);
});

test('foldMiniLog: foreign-signed mini-log op is rejected not_attacker and never folds', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block);
  const intruder = identityFromSeed('intruder');
  // intruder forges a settlement_reveal at seq 1 with correct id/prev but WRONG signer
  const foreign = makeMiniOp(intruder, { mini_log_id: a.mini_log_id, prev: a.commitOp.hash, seq: 1, tick: 1, type: 'settlement_reveal', payload: a.revealOp.payload });
  const folded = foldMiniLog([a.commitOp, foreign]);
  assert.ok(folded.rejected.some((r) => r.ref === foreign.hash && r.reason === 'not_attacker'), 'foreign op → not_attacker');
  assert.equal(folded.reveal, null, 'foreign reveal never folds');
  assert.ok(!folded.applied.includes(foreign.hash));
});

test('foldMiniLog: an intruder cannot even seed the mini-log at seq 0 with a foreign genesis', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block);
  const intruder = identityFromSeed('intruder2');
  // intruder tries to author the seq-0 commit on a DIFFERENT mini_log_id (their own) — then a.reveal (a's id)
  // cannot ride it: wrong_mini_log. Author a foreign commit on a's id is impossible because the id binds the
  // attacker pubkey; but a same-id foreign genesis is signed by intruder → its mini_log_id (a's) is fine to
  // VERIFY, yet at fold it becomes the genesis writer, and a's real reveal (signed by a) is then not_attacker.
  const foreignGenesis = makeMiniOp(intruder, { mini_log_id: a.mini_log_id, prev: null, seq: 0, tick: 0, type: 'settlement_commit', payload: a.commitOp.payload });
  const folded = foldMiniLog([foreignGenesis, a.revealOp]);
  // the lowest-hash genesis is chosen; if intruder's genesis wins, a's reveal is not_attacker; if a's
  // commit is absent, a's reveal can never be the sole writer either way — the reveal does not fold.
  assert.equal(folded.reveal, null, 'a real reveal cannot ride a foreign-seeded mini-log');
});

test('foldMiniLog: a reveal with no prior commit does not fold (no_prior_commit)', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block);
  const folded = foldMiniLog([a.revealOp]); // seq-1 reveal delivered alone (its seq-0 commit missing)
  assert.equal(folded.reveal, null);
  assert.ok(folded.rejected.some((r) => r.ref === a.revealOp.hash), 'orphan reveal rejected');
});

test('foldMiniLog: convergent over reorder + duplicate delivery (same fingerprint)', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block);
  const fp = miniLogFingerprint(a.folded);
  for (let n = 0; n < a.ops.length + 1; n++) {
    const withDups = [...shuffle(a.ops, n), a.ops[0], a.ops[1], a.ops[0]];
    assert.equal(miniLogFingerprint(foldMiniLog(withDups)), fp, `reorder/dup #${n} converges`);
  }
});

test('verifyMiniOp: closed envelope + only two op types', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block);
  assert.equal(verifyMiniOp(a.commitOp), null);
  assert.equal(verifyMiniOp(a.revealOp), null);
  assert.deepEqual([...MINI_OP_TYPES], ['settlement_commit', 'settlement_reveal']);
  const extra = { ...a.commitOp, sneaky: 1 };
  assert.equal(verifyMiniOp(extra), 'unknown_op_key', 'extra top-level key fails closed');
});

// ── foldOverlay dedup / canonical-sort / convergence ──────────────────────────
test('foldOverlay: dedup by mini_log_id keeps MAX seq_height, tie-break lowest head_hash', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block);
  const e1 = { ...a.entry, seq_height: 1, head_hash: 'zzz' };
  const e2 = { ...a.entry, seq_height: 3, head_hash: 'aaa' }; // higher seq wins
  const out = foldOverlay([e1, e2]);
  assert.equal(out.entries.length, 1);
  assert.equal(out.by_id[a.mini_log_id].seq_height, 3);
  // tie-break: same seq → lowest head_hash wins
  const t1 = { ...a.entry, seq_height: 2, head_hash: 'bbb' };
  const t2 = { ...a.entry, seq_height: 2, head_hash: 'aaa' };
  assert.equal(foldOverlay([t1, t2]).by_id[a.mini_log_id].head_hash, 'aaa');
});

test('foldOverlay: canonical-sort by mini_log_id; convergent across delivery order + dups', () => {
  const { base, block } = fixture();
  const entries = [0, 1, 2, 3].map((i) => buildAttacker(11, i, base, block, structureId(`tgt-${i}`)).entry);
  const ref = foldOverlay(entries);
  const sortedIds = entries.map((e) => e.mini_log_id).sort();
  assert.deepEqual(ref.entries.map((e) => e.mini_log_id), sortedIds, 'canonical mini_log_id order');
  for (let n = 0; n < 5; n++) {
    const withDups = [...shuffle(entries, n), entries[0], entries[2]];
    assert.equal(overlayFingerprint(foldOverlay(withDups)), overlayFingerprint(ref), `overlay reorder/dup #${n} converges`);
  }
});

test('foldOverlay: honest concurrent attackers stay within SCORCH_CAP per structure, additive', () => {
  const { base, block } = fixture();
  // two attackers on the SAME structure → additive, clamped at SCORCH_CAP
  const a = buildAttacker(13, 0, base, block, structureId('t-sign'));
  const b = buildAttacker(13, 1, base, block, structureId('t-sign'));
  const out = foldOverlay([a.entry, b.entry]);
  assert.ok(overlayBoundsHold(out), 'all applied scorch ≤ SCORCH_CAP');
  for (const v of Object.values(out.applied_scorch)) assert.ok(v <= SCORCH_CAP);
});

// ── revocation: valid fraud → revoked; honest → not revoked ──────────────────
test('verifyRevocationEntry: a forged settlement verifies a revocation; an honest one does not', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block);
  const forgedClaim = { ...a.settlement, outcome_digest: contentAddress({ forged: true }) };
  const forgedEntry = { ...a.entry, outcome_digest: forgedClaim.outcome_digest };
  assert.equal(verifyRevocationEntry(forgedEntry, base, a.plan, forgedClaim), true, 'fraud verifies');
  // honest settlement: proveFraud === null → revocation does not verify
  assert.equal(verifyRevocationEntry(a.entry, base, a.plan, a.settlement), false, 'honest does not verify');
  assert.equal(proveFraud(base, a.plan, a.settlement), null, 'honest settlement has no fraud-proof');
});

test('foldOverlay: a verified revocation marks the entry revoked and EXCLUDES its scorch', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block, structureId('t-sign'));
  const b = buildAttacker(7, 1, base, block, structureId('t-node')); // distinct target → separable scorch
  const forgedClaim = { ...a.settlement, outcome_digest: contentAddress({ forged: 1 }) };
  const forgedEntry = { ...a.entry, outcome_digest: forgedClaim.outcome_digest };
  const watcher = identityFromSeed('watcher');
  const fraud = proveFraud(base, a.plan, forgedClaim);
  const rev = makeRevocationEntry({ mini_log_id: a.mini_log_id, fraud_proof: fraud, revoker_identity: watcher });
  const isVerified = (r) => r.mini_log_id === a.mini_log_id
    ? verifyRevocationEntry(forgedEntry, base, a.plan, forgedClaim) : false;
  const noRev = foldOverlay([forgedEntry, b.entry], [], { isVerified });
  const withRev = foldOverlay([forgedEntry, b.entry], [rev], { isVerified });
  assert.ok(withRev.revoked.has(a.mini_log_id));
  assert.equal(withRev.by_id[a.mini_log_id].status, ENTRY_STATUS.REVOKED);
  assert.ok(withRev.applied_total < noRev.applied_total, 'revoked scorch excluded lowers the total');
});

test('foldOverlay: an UNVERIFIED revocation never applies (false revocation discarded)', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block);
  // honest settlement → no real fraud; a malicious revocation carrying mismatch:false must be discarded
  const badRev = makeRevocationEntry({ mini_log_id: a.mini_log_id, fraud_proof: { kind: 'fraud_proof', mismatch: false }, revoker_identity: identityFromSeed('liar') });
  const out = foldOverlay([a.entry], [badRev], { isVerified: () => false });
  assert.ok(!out.revoked.has(a.mini_log_id), 'false revocation does not apply');
  assert.equal(out.by_id[a.mini_log_id].status, ENTRY_STATUS.SETTLED);
});

// ── offline-owner: base fingerprint byte-identical before and after ───────────
test('offline-owner revocation: the owner is never online and blockFingerprint is byte-identical', () => {
  const { defender, base, block, chain, steps } = fixture();
  const fpBefore = blockFingerprint(foldBlock(chain));
  const a = buildAttacker(7, 0, base, block);
  const forgedClaim = { ...a.settlement, outcome_digest: contentAddress({ forged: 2 }) };
  const forgedEntry = { ...a.entry, outcome_digest: forgedClaim.outcome_digest };
  const watcher = identityFromSeed('watcher2'); // ANY peer, not the owner
  const fraud = proveFraud(base, a.plan, forgedClaim);
  const rev = makeRevocationEntry({ mini_log_id: a.mini_log_id, fraud_proof: fraud, revoker_identity: watcher });
  const out = foldOverlay([forgedEntry], [rev], { isVerified: () => verifyRevocationEntry(forgedEntry, base, a.plan, forgedClaim) });
  assert.ok(out.revoked.has(a.mini_log_id), 'revoked without owner participation');
  assert.notEqual(rev.revoker_pubkey, defender.publicRawHex, 'owner did not sign the revocation');
  // base fingerprint, recomputed from the SAME genesis steps, is byte-identical (base never mutated)
  const fpAfter = blockFingerprint(foldBlock(buildSignedChain(defender, block, steps)));
  assert.equal(fpAfter, fpBefore, 'owner blockFingerprint unchanged by overlay/revocation');
});

// ── revocation idempotency ────────────────────────────────────────────────────
test('revocation idempotency: re-delivering the same revocation does not change the fingerprint or grow audit state', () => {
  const { base, block } = fixture();
  const a = buildAttacker(7, 0, base, block);
  const forgedClaim = { ...a.settlement, outcome_digest: contentAddress({ forged: 3 }) };
  const forgedEntry = { ...a.entry, outcome_digest: forgedClaim.outcome_digest };
  const rev = makeRevocationEntry({ mini_log_id: a.mini_log_id, fraud_proof: proveFraud(base, a.plan, forgedClaim), revoker_identity: identityFromSeed('w') });
  const isVerified = () => verifyRevocationEntry(forgedEntry, base, a.plan, forgedClaim);
  const once = foldOverlay([forgedEntry], [rev], { isVerified });
  const flood = Array.from({ length: 50 }, () => rev);
  const many = foldOverlay([forgedEntry], flood, { isVerified });
  assert.equal(overlayFingerprint(many), overlayFingerprint(once), 'idempotent overlayFingerprint');
  // a never-verified revocation flood cannot grow the rejected audit log beyond one entry
  const badFlood = Array.from({ length: 50 }, () => makeRevocationEntry({ mini_log_id: a.mini_log_id, fraud_proof: { kind: 'fraud_proof', mismatch: false }, revoker_identity: identityFromSeed('w') }));
  const bad = foldOverlay([forgedEntry], badFlood, { isVerified: () => false });
  assert.ok(bad.rejected_revocations.length <= 1, 'dual-Set dedup bounds the rejected audit log');
});

// ── concurrent-attack determinism ─────────────────────────────────────────────
test('concurrent-attack determinism: N distinct attackers → N distinct mini_log_ids; canonical scorch order; cap respected', () => {
  const { base, block } = fixture();
  const N = 5;
  const attacks = Array.from({ length: N }, (_, i) => buildAttacker(21, i, base, block, structureId(`c-${i}`)));
  const ids = attacks.map((a) => a.mini_log_id);
  assert.equal(new Set(ids).size, N, 'N distinct mini_log_ids');
  const out = foldOverlay(attacks.map((a) => a.entry));
  assert.deepEqual(out.entries.map((e) => e.mini_log_id), [...ids].sort(), 'canonical mini_log_id order');
  assert.ok(overlayBoundsHold(out), 'no structure exceeds SCORCH_CAP');
  // identical across delivery orders
  const fp = overlayFingerprint(out);
  for (let n = 0; n < N; n++) assert.equal(overlayFingerprint(foldOverlay(shuffle(attacks.map((a) => a.entry), n))), fp);
});

// ── base-fingerprint independence ─────────────────────────────────────────────
test('base-fingerprint independence: overlay activity never changes blockFingerprint', () => {
  const { base, block, chain, defender, steps } = fixture();
  const fp = blockFingerprint(foldBlock(chain));
  const attacks = Array.from({ length: 3 }, (_, i) => buildAttacker(9, i, base, block, structureId(`bi-${i}`)));
  foldOverlay(attacks.map((a) => a.entry)); // overlay folded; base untouched
  assert.equal(blockFingerprint(foldBlock(buildSignedChain(defender, block, steps))), fp);
});

// ── evidence pack + suite ─────────────────────────────────────────────────────
test('overlay evidence pack passes (seed 42) with all O6 claims', () => {
  const pack = buildOverlayEvidencePack({ seed: 42 });
  assert.equal(pack.pass, true, JSON.stringify(pack.claims.filter((c) => !c.ok), null, 2));
  const ids = pack.claims.map((c) => c.id);
  for (const need of ['O6_1_single_writer_per_author', 'O6_2_minilog_convergence', 'O6_3_overlay_convergence',
    'O6_4_offline_owner_revocation', 'O6_5_concurrent_attack_determinism', 'O6_6_base_fingerprint_independence',
    'O6_7_revocation_idempotent', 'O6_8_relays_swappable']) {
    assert.ok(ids.includes(need), `pack carries ${need}`);
  }
  assert.ok(pack.deferred_residuals.some((r) => /sybil/i.test(r)), 'sybil-quorum disclosed, not closed');
  assert.ok(pack.deferred_residuals.some((r) => /owner reconciliation/i.test(r)), 'owner reconciliation deferred');
});

test('overlay evidence suite passes across seeds [42,1337,9001]', () => {
  const suite = buildOverlayEvidenceSuite({ seeds: [42, 1337, 9001] });
  assert.equal(suite.pass, true);
  assert.equal(suite.packs.length, 3);
  for (const p of suite.packs) assert.equal(p.pass, true, `seed ${p.seed} pack passes`);
});
