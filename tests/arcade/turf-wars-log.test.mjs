/**
 * Turf Wars Phase 1 lab — SIGNED HASH-CHAINED LOG + FOLD tests.
 *   node --test tests/arcade/turf-wars-log.test.mjs
 *
 * Proves chain integrity (signature, hash, prev-chaining, seq monotonicity, fork/gap/replay),
 * deterministic convergent fold, bounded non-cash counters (no negative, capped mint, clamp,
 * cooldown), the closed op/structure vocabulary (no free text/URL/code, no transfer/cash op), and
 * owner authority. Lab-only — denylisted from the production upload.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityFromSeed } from '../../arcade/hiveworld-agents/turf-wars/identity.mjs';
import { contentAddress } from '../../arcade/hiveworld-agents/turf-wars/canonical.mjs';
import {
  makeOp, verifyOp, validatePayload, scanForbidden,
  OP_TYPES, OP_ENVELOPE_KEYS, RESERVED_OP_TYPES, STRUCTURE_KINDS, STRUCTURE_SPEC, BLOCK_THEMES, COUNTERS,
  STARTER_GRANT, FLUX_MINT_CAP, MAX_STRUCTURES,
} from '../../arcade/hiveworld-agents/turf-wars/ops.mjs';
import {
  foldBlock, blockFingerprint, boundsHold, assembleChain, upgradeCost, collectYield,
} from '../../arcade/hiveworld-agents/turf-wars/block-log.mjs';
import {
  buildSignedChain, honestSteps, blockIdFor, structureId, crewId,
} from '../../arcade/hiveworld-agents/turf-wars/turf-evidence.mjs';

const alice = identityFromSeed('alice');
const mallory = identityFromSeed('mallory');
const BLOCK = blockIdFor(alice);

// ── chain integrity ──────────────────────────────────────────────────────────
test('a valid honest chain folds with every op applied and bounds intact', () => {
  const s = foldBlock(buildSignedChain(alice, BLOCK, honestSteps()));
  assert.equal(s.rejected.length, 0);
  assert.equal(s.econ_rejected.length, 0);
  assert.equal(s.applied.length, honestSteps().length);
  assert.ok(boundsHold(s));
  assert.equal(s.owner, alice.publicRawHex);
  assert.equal(s.owner_player_id, alice.playerId);
});

test('reordered + duplicated delivery folds to the SAME fingerprint (convergence)', () => {
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  const base = blockFingerprint(foldBlock(ops));
  const shuffles = [
    [...ops].reverse(),
    [ops[3], ops[0], ops[6], ops[1], ops[5], ops[2], ops[4]],
    [...ops, ...ops, ...ops], // triple replay
  ];
  for (const variant of shuffles) assert.equal(blockFingerprint(foldBlock(variant)), base);
});

test('a duplicate op (same hash) is an idempotent no-op', () => {
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  const s = foldBlock([...ops, ops[2], ops[2]]);
  assert.equal(blockFingerprint(s), blockFingerprint(foldBlock(ops)));
});

test('a tampered payload breaks the hash and is rejected (hash_mismatch)', () => {
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  const bad = { ...ops[1], payload: { ...ops[1].payload, x: 14 } };
  const s = foldBlock([ops[0], bad, ...ops.slice(2)]);
  assert.ok(s.rejected.some((r) => r.ref === bad.hash && r.reason === 'hash_mismatch'));
});

test('a foreign signature on an owner op is rejected (bad_signature)', () => {
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  const foreign = makeOp(mallory, { block_id: BLOCK, prev: ops[0].hash, seq: 1, tick: 1, type: ops[1].type, payload: ops[1].payload });
  const spoof = { ...ops[1], sig: foreign.sig };
  const s = foldBlock([ops[0], spoof]);
  assert.ok(s.rejected.some((r) => r.ref === spoof.hash && r.reason === 'bad_signature'));
});

// ── PR #103 review hardening (M1 envelope strictness, M2 type tamper, M3 actor tamper) ──
test('M1: verifyOp rejects an op carrying unknown top-level envelope keys (fail closed)', () => {
  // the closed envelope is exactly the 8 signed core keys + hash + sig
  assert.deepEqual([...OP_ENVELOPE_KEYS].sort(),
    ['actor', 'block_id', 'hash', 'payload', 'prev', 'seq', 'sig', 'tick', 'type', 'v'].sort());
  const good = makeOp(alice, { block_id: BLOCK, prev: null, seq: 0, tick: 0, type: 'init_block', payload: { theme: 'neon' } });
  assert.equal(verifyOp(good), null, 'a clean op still verifies');
  // any extra top-level key is rejected BEFORE signature verification — an unsigned field cannot ride along
  assert.equal(verifyOp({ ...good, evil: { hidden: true } }), 'unknown_op_key');
  assert.equal(verifyOp({ ...good, amount: 999 }), 'unknown_op_key');
  // and such an op never enters the fold
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  const sneaky = { ...ops[1], rogue: 'smuggled' };
  const s = foldBlock([ops[0], sneaky]);
  assert.ok(!s.applied.includes(sneaky.hash));
  assert.ok(s.rejected.some((r) => r.ref === sneaky.hash && r.reason === 'unknown_op_key'));
});

test('M2: mutating a signed op\'s type is rejected and never applied', () => {
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  // (a) swap to a type whose strict schema rejects the original payload → schema rejection
  const buildOp = ops[1]; // build_structure payload {structure_id, kind, x, y}
  const swappedIncompatible = { ...buildOp, type: 'collect_resource' }; // collect_resource expects only {structure_id}
  assert.equal(verifyOp(swappedIncompatible), 'collect_resource_shape');
  const sa = foldBlock([ops[0], swappedIncompatible]);
  assert.ok(!sa.applied.includes(swappedIncompatible.hash));
  // (b) swap between two same-shaped types ({structure_id}) so the schema passes but the HASH no longer matches
  const collectOp = ops[2]; // collect_resource payload {structure_id} — also a valid upgrade_structure shape
  const swappedSameShape = { ...collectOp, type: 'upgrade_structure' };
  assert.equal(verifyOp(swappedSameShape), 'hash_mismatch', 'type is in the signed core → hash breaks');
});

test('M3: mutating a signed op\'s actor is rejected (hash_mismatch) and never applied', () => {
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  const actorSwapped = { ...ops[1], actor: mallory.publicRawHex }; // actor is part of the signed core
  assert.equal(verifyOp(actorSwapped), 'hash_mismatch');
  const s = foldBlock([ops[0], actorSwapped]);
  assert.ok(!s.applied.includes(actorSwapped.hash));
  assert.ok(s.rejected.some((r) => r.ref === actorSwapped.hash && r.reason === 'hash_mismatch'));
});

test('a wrong prev hash breaks the chain (chain_break)', () => {
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  // re-sign seq 2 with a bogus prev so it is crypto-valid but does not chain
  const broken = makeOp(alice, { block_id: BLOCK, prev: 'sha256:' + 'a'.repeat(64), seq: 2, tick: 2, type: ops[2].type, payload: ops[2].payload });
  const s = foldBlock([ops[0], ops[1], broken]);
  assert.ok(s.rejected.some((r) => r.ref === broken.hash && r.reason === 'chain_break'));
  assert.ok(!s.applied.includes(broken.hash));
});

test('a sequence gap stops the chain and orphans later ops (seq_gap)', () => {
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  // drop seq 1, keep seq 0 and seq 2 — seq 2 cannot connect
  const s = foldBlock([ops[0], ops[2]]);
  assert.equal(s.applied.length, 1, 'only the genesis applies');
  assert.ok(s.rejected.some((r) => r.ref === ops[2].hash && r.reason === 'seq_gap'));
});

test('a fork (two distinct ops at one seq) keeps the lowest-hash op, rejects the sibling', () => {
  const genesis = makeOp(alice, { block_id: BLOCK, prev: null, seq: 0, tick: 0, type: 'init_block', payload: { theme: 'neon' } });
  const a = makeOp(alice, { block_id: BLOCK, prev: genesis.hash, seq: 1, tick: 1, type: 'build_structure', payload: { structure_id: structureId('A'), kind: 'signage', x: 1, y: 1 } });
  const b = makeOp(alice, { block_id: BLOCK, prev: genesis.hash, seq: 1, tick: 1, type: 'build_structure', payload: { structure_id: structureId('B'), kind: 'light_rig', x: 2, y: 2 } });
  const s = foldBlock([genesis, a, b]);
  const winner = a.hash < b.hash ? a : b;
  const loser = a.hash < b.hash ? b : a;
  assert.ok(s.applied.includes(winner.hash));
  assert.ok(s.rejected.some((r) => r.ref === loser.hash && r.reason === 'fork_detected'));
  // deterministic regardless of delivery order
  assert.equal(blockFingerprint(foldBlock([b, a, genesis])), blockFingerprint(s));
});

test('a non-owner cannot write to the block (not_owner), but anyone could fold it', () => {
  const genesis = makeOp(alice, { block_id: BLOCK, prev: null, seq: 0, tick: 0, type: 'init_block', payload: { theme: 'neon' } });
  const intrusion = makeOp(mallory, { block_id: BLOCK, prev: genesis.hash, seq: 1, tick: 1, type: 'build_structure', payload: { structure_id: structureId('x'), kind: 'signage', x: 1, y: 1 } });
  const s = foldBlock([genesis, intrusion]);
  assert.ok(s.rejected.some((r) => r.ref === intrusion.hash && r.reason === 'not_owner'));
  assert.ok(!s.applied.includes(intrusion.hash));
});

test('an op targeting a different block id is rejected (wrong_block)', () => {
  const genesis = makeOp(alice, { block_id: BLOCK, prev: null, seq: 0, tick: 0, type: 'init_block', payload: { theme: 'neon' } });
  const otherBlock = blockIdFor(mallory);
  const stray = makeOp(alice, { block_id: otherBlock, prev: genesis.hash, seq: 1, tick: 1, type: 'join_crew', payload: { crew_id: crewId('c') } });
  const s = foldBlock([genesis, stray]);
  assert.ok(s.rejected.some((r) => r.ref === stray.hash && r.reason === 'wrong_block'));
});

// ── bounded non-cash counters ─────────────────────────────────────────────────
test('flux mint is capped; over-cap collects are rejected and minted never exceeds the cap', () => {
  const node = structureId('cap');
  const steps = [
    { type: 'init_block', payload: { theme: 'toxic' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: node, kind: 'resource_node', x: 0, y: 0 }, tick: 1 },
  ];
  for (let t = 0; t < 70; t++) steps.push({ type: 'collect_resource', payload: { structure_id: node }, tick: 100 + t });
  const s = foldBlock(buildSignedChain(alice, BLOCK, steps));
  assert.equal(s.minted.flux, FLUX_MINT_CAP);
  assert.ok(s.econ_rejected.some((r) => r.reason === 'flux_cap_reached'));
  assert.ok(boundsHold(s));
});

test('collect clamps the final grant to the remaining cap (partial mint)', () => {
  const node = structureId('clamp');
  const steps = [
    { type: 'init_block', payload: { theme: 'toxic' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: node, kind: 'resource_node', x: 0, y: 0 }, tick: 1 },
  ];
  for (let t = 0; t < 49; t++) steps.push({ type: 'collect_resource', payload: { structure_id: node }, tick: 10 + t }); // 49×10 = 490
  steps.push({ type: 'upgrade_structure', payload: { structure_id: node }, tick: 200 }); // level 2 → yield 20
  steps.push({ type: 'collect_resource', payload: { structure_id: node }, tick: 201 });  // remaining 10, yield 20 → grant 10
  const s = foldBlock(buildSignedChain(alice, BLOCK, steps));
  assert.equal(s.minted.flux, FLUX_MINT_CAP, 'clamped to exactly the cap, not 510');
});

test('an unaffordable build is rejected; no balance ever goes negative', () => {
  const steps = [{ type: 'init_block', payload: { theme: 'noir' }, tick: 0 }];
  for (let i = 0; i < 5; i++) steps.push({ type: 'build_structure', payload: { structure_id: structureId(`n${i}`), kind: 'resource_node', x: i, y: 0 }, tick: i + 1 });
  const s = foldBlock(buildSignedChain(alice, BLOCK, steps));
  assert.equal(Object.keys(s.structures).length, 4, 'starter 20 cores funds exactly 4 nodes');
  assert.ok(s.econ_rejected.some((r) => r.reason === 'insufficient_cores'));
  assert.ok(s.counters.cores >= 0 && s.counters.flux >= 0);
});

test('one collect per (structure, tick) — same-tick re-collect is on cooldown', () => {
  const node = structureId('cd');
  const ops = buildSignedChain(alice, BLOCK, [
    { type: 'init_block', payload: { theme: 'neon' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: node, kind: 'resource_node', x: 0, y: 0 }, tick: 1 },
    { type: 'collect_resource', payload: { structure_id: node }, tick: 5 },
    { type: 'collect_resource', payload: { structure_id: node }, tick: 5 }, // same tick → cooldown
  ]);
  const s = foldBlock(ops);
  assert.ok(s.econ_rejected.some((r) => r.reason === 'collect_cooldown'));
});

test('cores are minted once (starter) and never re-minted; supply stays bounded', () => {
  const s = foldBlock(buildSignedChain(alice, BLOCK, honestSteps()));
  assert.equal(s.minted.cores, STARTER_GRANT.cores);
  // there is no op that mints cores — only init grants them
  assert.ok(boundsHold(s));
});

test('upgrade cost and collect yield scale deterministically with level', () => {
  assert.deepEqual(upgradeCost('resource_node', 1), { flux: 0, cores: 5 });
  assert.deepEqual(upgradeCost('resource_node', 2), { flux: 0, cores: 10 });
  assert.equal(collectYield('resource_node', 1), 10);
  assert.equal(collectYield('resource_node', 3), 30);
  assert.equal(collectYield('signage', 5), 0, 'non-producers yield nothing');
});

test('M4: over-upgrading past maxLevel is rejected; level never exceeds the cap', () => {
  const node = structureId('maxlvl');
  const max = STRUCTURE_SPEC.resource_node.maxLevel; // reachable within the starter grant (build 5 + up 5 + up 10 = 20 cores)
  const steps = [
    { type: 'init_block', payload: { theme: 'neon' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: node, kind: 'resource_node', x: 0, y: 0 }, tick: 1 },
  ];
  // upgrade up to the cap, then attempt one upgrade beyond it
  for (let i = 0; i < max; i++) steps.push({ type: 'upgrade_structure', payload: { structure_id: node }, tick: 10 + i });
  const s = foldBlock(buildSignedChain(alice, BLOCK, steps));
  assert.equal(s.structures[node].level, max, 'reached exactly the cap, no further');
  assert.ok(s.econ_rejected.some((r) => r.reason === 'max_level'), 'the over-cap upgrade is rejected max_level');
  assert.ok(s.counters.cores >= 0 && s.counters.flux >= 0, 'no balance went negative');
  assert.ok(boundsHold(s));
});

// ── closed vocabulary ─────────────────────────────────────────────────────────
test('the op vocabulary is closed: an unknown op type is rejected, no transfer/cash op exists', () => {
  for (const forbidden of ['transfer', 'cash_out', 'sell', 'buy', 'mint_coin', 'trade', 'payout']) {
    assert.equal(OP_TYPES.includes(forbidden), false, `${forbidden} must not be a real op`);
    const op = makeOp(alice, { block_id: BLOCK, prev: null, seq: 0, tick: 0, type: forbidden, payload: {} });
    assert.equal(verifyOp(op), 'unknown_op');
  }
});

test('record_attack_result (Phase-2) is structurally valid but settlement-deferred in the fold', () => {
  // Promoted out of RESERVED by the Phase-2 foundation: a real op type with a closed schema, whose
  // SETTLEMENT is deferred (live settlement needs O1 seed + O2 fraud-proof liveness, both open).
  assert.ok(!RESERVED_OP_TYPES.includes('record_attack_result'), 'no longer reserved');
  assert.ok(OP_TYPES.includes('record_attack_result'), 'now a real op type');
  const validPayload = {
    base_address: contentAddress({ b: 1 }), plan_hash: contentAddress({ p: 1 }),
    seed: 'abcd1234ef567890', outcome_digest: contentAddress({ o: 1 }),
  };
  assert.equal(verifyOp(makeOp(alice, { block_id: BLOCK, prev: null, seq: 0, tick: 0, type: 'record_attack_result', payload: validPayload })), null,
    'a well-formed signed record_attack_result verifies structurally');
  assert.equal(verifyOp(makeOp(alice, { block_id: BLOCK, prev: null, seq: 0, tick: 0, type: 'record_attack_result', payload: { winner: 1 } })), 'record_attack_result_shape',
    'a bogus payload is rejected by the closed schema');
  // in a fold it is recorded settlement-deferred and mutates NOTHING (no scorch/counter/structure change)
  const head = buildSignedChain(alice, BLOCK, [{ type: 'init_block', payload: { theme: 'neon' }, tick: 0 }]);
  const rar = makeOp(alice, { block_id: BLOCK, prev: head[0].hash, seq: 1, tick: 1, type: 'record_attack_result', payload: validPayload });
  const s = foldBlock([...head, rar]);
  assert.equal(s.settlement_deferred.length, 1);
  assert.equal(s.settlement_deferred[0].reason, 'settlement_deferred_pending_o1_o2');
  assert.ok(!s.applied.includes(rar.hash), 'not applied — settlement deferred');
  assert.equal(Object.keys(s.structures).length, 0, 'no state mutation');
});

test('an unknown structure kind and an off-grid position are rejected', () => {
  assert.equal(validatePayload('build_structure', { structure_id: 's:00000000', kind: 'casino', x: 1, y: 1 }), 'bad_structure_kind');
  assert.equal(validatePayload('build_structure', { structure_id: 's:00000000', kind: 'signage', x: 99, y: 1 }), 'off_grid');
  for (const k of STRUCTURE_KINDS) assert.equal(validatePayload('build_structure', { structure_id: 's:00000000', kind: k, x: 1, y: 1 }), null);
});

test('an unknown block theme and an unknown extra key are rejected', () => {
  assert.equal(validatePayload('init_block', { theme: 'casino' }), 'bad_theme');
  assert.equal(validatePayload('init_block', { theme: 'neon', name: 'My Block' }), 'init_block_shape', 'free-text name field rejected');
  for (const t of BLOCK_THEMES) assert.equal(validatePayload('init_block', { theme: t }), null);
});

test('scanForbidden catches URLs, markup, code/asset field names, and over-long strings', () => {
  assert.equal(scanForbidden({ theme: 'neon' }), null);
  assert.equal(scanForbidden({ note: 'http://x.example' }), 'url_or_markup');
  assert.equal(scanForbidden({ note: '<script>alert(1)</script>' }), 'url_or_markup');
  assert.equal(scanForbidden({ url: 'x' }), 'forbidden_key:url');
  assert.equal(scanForbidden({ code: 'x' }), 'forbidden_key:code');
  assert.equal(scanForbidden({ img: 'x' }), 'forbidden_key:img');
  assert.equal(scanForbidden({ blob: 'x'.repeat(65) }), 'string_too_long');
  assert.equal(scanForbidden({ go: () => 1 }), 'bad_type', 'functions/code values rejected');
});

test('COUNTERS are exactly the two non-cash gauges (no money concept)', () => {
  assert.deepEqual([...COUNTERS], ['flux', 'cores']);
});

// ── assembleChain isolation ────────────────────────────────────────────────────
test('assembleChain reports owner + block id from the genesis and drops orphans', () => {
  const ops = buildSignedChain(alice, BLOCK, honestSteps());
  const { chain, owner, block_id, rejected } = assembleChain(ops);
  assert.equal(chain.length, ops.length);
  assert.equal(owner, alice.publicRawHex);
  assert.equal(block_id, BLOCK);
  assert.equal(rejected.length, 0);
});

test('empty / no-genesis input folds to a safe empty state', () => {
  const s = foldBlock([]);
  assert.equal(s.owner, null);
  assert.equal(s.seq_height, 0);
  assert.ok(boundsHold(s));
  // an op with no genesis present is rejected no_genesis
  const orphan = makeOp(alice, { block_id: BLOCK, prev: null, seq: 1, tick: 1, type: 'join_crew', payload: { crew_id: crewId('c') } });
  const s2 = foldBlock([orphan]);
  assert.equal(s2.owner, null);
  assert.ok(s2.rejected.some((r) => r.reason === 'no_genesis' || r.reason === 'seq_gap'));
});
