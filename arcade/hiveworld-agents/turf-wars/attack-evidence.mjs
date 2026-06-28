/**
 * Turf Wars — Phase 2 FOUNDATION (lab) · ATTACK EVIDENCE PACK (pure, deterministic).
 *
 * ⚠️ LAB ONLY — see attack-plan.mjs header. Denylisted from the curated upload; imported by no
 * production path. Mirrors the Phase-1 turf-evidence harness: fixture identities + a seeded LCG, every
 * claim a `{ id, ok, detail }`, the pack PASS iff all hold.
 *
 * Proves the O1/O2-AGNOSTIC slice of the Phase-2 plan's D-matrix. Two claims are DELIBERATELY NOT
 * proven here because they depend on the open decisions, and the pack lists them in `deferred` rather
 * than faking a pass:
 *   D5 seed-grinding resistance  — depends on O1 (commit-reveal seed binding); the seed is a parameter here.
 *   D7 offline-victim liveness   — depends on O2 (fraud-proof liveness window); no timing/settlement here.
 *
 * Proven (deterministic, bounded, reversible):
 *   D1 valid attack settles deterministically; recompute matches
 *   D2 forged outcome digest -> fraud-proof rejects
 *   D3 tampered base snapshot -> rejected
 *   D4 tampered / foreign-signed plan -> rejected
 *   D6 replay determinism (same inputs -> same digest; duplicate op deduped in fold)
 *   D8 scorch is bounded and reversible (clamps to cap, self-heals to empty)
 *   D9 no value transfer (base untouched; reward bounded AND the REWARD_CAP clamp is exercised; no transfer op)
 *   D10 base snapshot is immutable across simulation
 *   DRAR record_attack_result is structurally valid but settlement-deferred
 */
import { identityFromSeed } from './identity.mjs';
import { canonicalize, contentAddress } from './canonical.mjs';
import { makeOp, OP_TYPES } from './ops.mjs';
import { foldBlock } from './block-log.mjs';
import { signSnapshot } from './snapshot.mjs';
import { makeAttackPlan, verifyAttackPlan } from './attack-plan.mjs';
import { simulateAttack, verifyAttackOutcome, attackRejection } from './attack-sim.mjs';
import { emptyScorch, applyScorch, decayScorch, ticksToHeal, scorchBoundsHold, SCORCH_CAP } from './scorch.mjs';
import { buildSignedChain, blockIdFor, structureId } from './turf-evidence.mjs';

/** The Phase-2 foundation lab modules — for the denylist self-check (DRAR/boundary). */
export const PHASE2_LAB_MODULE_PATHS = Object.freeze([
  'arcade/hiveworld-agents/turf-wars/attack-plan.mjs',
  'arcade/hiveworld-agents/turf-wars/scorch.mjs',
  'arcade/hiveworld-agents/turf-wars/attack-sim.mjs',
  'arcade/hiveworld-agents/turf-wars/attack-evidence.mjs',
]);

/** A defender block with a defense_decoy (to exercise mitigation), plus signage + resource_node. */
function defenderSteps() {
  return [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('decoy'), kind: 'defense_decoy', x: 1, y: 1 }, tick: 1 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 2, y: 2 }, tick: 2 },
    { type: 'build_structure', payload: { structure_id: structureId('node'), kind: 'resource_node', x: 3, y: 3 }, tick: 3 },
  ];
}

/** PURE: build the D-matrix evidence pack for a seed. */
export function buildAttackEvidencePack({ seed = 42 } = {}) {
  const defender = identityFromSeed(`defender/${seed}`);
  const attacker = identityFromSeed(`attacker/${seed}`);
  const block = blockIdFor(defender);
  const settlementSeed = contentAddress({ seed }).slice(7, 7 + 32); // a closed hex seed (provenance = O1, deferred)
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  // defender base snapshot (immutable, signed)
  const defState = foldBlock(buildSignedChain(defender, block, defenderSteps()));
  const baseRecord = signSnapshot(defender, defState);
  const baseFrozen = canonicalize(baseRecord); // snapshot of the base bytes BEFORE any simulation
  const targetSign = structureId('sign');
  const targetNode = structureId('node');

  // an honest signed attack plan
  const plan = makeAttackPlan(attacker, {
    target_block: block, base_address: baseRecord.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: targetSign, intensity: 3 }, { structure_id: targetNode, intensity: 2 }, { structure_id: targetSign, intensity: 3 }],
  });

  // ── D1 valid attack settles deterministically; recompute matches ──
  const r1 = simulateAttack(baseRecord, plan, settlementSeed);
  const r1b = simulateAttack(baseRecord, plan, settlementSeed);
  claim('D1_valid_attack_deterministic',
    r1.ok && r1b.ok && r1.digest === r1b.digest && verifyAttackOutcome(baseRecord, plan, settlementSeed, r1.digest)
      && r1.outcome.total_scorch >= 0,
    `ok=${r1.ok}; total_scorch=${r1.outcome?.total_scorch}; recompute digest match; verifyOutcome=true`);

  // ── D2 forged outcome digest -> fraud-proof rejects ──
  claim('D2_forged_outcome_rejected',
    verifyAttackOutcome(baseRecord, plan, settlementSeed, contentAddress({ forged: true })) === false
      && verifyAttackOutcome(baseRecord, plan, settlementSeed, r1.digest) === true,
    `honest digest verifies; a forged digest fails the one-op fraud-proof`);

  // ── D3 tampered base snapshot -> rejected ──
  const tamperedBase = { ...baseRecord, snapshot: { ...baseRecord.snapshot, counters: { ...baseRecord.snapshot.counters, flux: baseRecord.snapshot.counters.flux + 1 } } };
  const r3 = simulateAttack(tamperedBase, plan, settlementSeed);
  claim('D3_tampered_base_rejected',
    !r3.ok && /^bad_base_snapshot:/.test(r3.reason),
    `tampered base → ${r3.reason}`);

  // ── D4 tampered / foreign-signed plan -> rejected ──
  const tamperedPlan = { ...plan, moves: [{ structure_id: targetSign, intensity: 1 }] }; // mutate after signing
  const foreignSig = makeAttackPlan(identityFromSeed('mallory'), { target_block: block, base_address: baseRecord.address, nonce: 'cafebabedeadbeef', moves: plan.moves }).sig;
  const spoofedPlan = { ...plan, sig: foreignSig };
  claim('D4_bad_plan_rejected',
    verifyAttackPlan(tamperedPlan) === 'hash_mismatch'
      && verifyAttackPlan(spoofedPlan) === 'bad_signature'
      && /^bad_plan:/.test(attackRejection(baseRecord, spoofedPlan) || ''),
    `tampered plan → hash_mismatch; foreign-signed plan → bad_signature`);

  // ── D6 replay determinism (same inputs -> same digest; duplicate op deduped) ──
  const head = buildSignedChain(defender, block, [{ type: 'init_block', payload: { theme: 'neon' }, tick: 0 }]);
  const rarPayload = { base_address: baseRecord.address, plan_hash: plan.hash, seed: settlementSeed, outcome_digest: r1.digest };
  const rar = makeOp(defender, { block_id: block, prev: head[0].hash, seq: 1, tick: 1, type: 'record_attack_result', payload: rarPayload });
  const sDup = foldBlock([...head, rar, rar, rar]); // triple-delivered
  claim('D6_replay_deterministic',
    r1.digest === simulateAttack(baseRecord, plan, settlementSeed).digest && sDup.settlement_deferred.length === 1,
    `recompute idempotent; triple-delivered record_attack_result → 1 settlement-deferred entry`);

  // ── D8 scorch bounded + reversible ──
  let ov = applyScorch(emptyScorch(), { [targetSign]: SCORCH_CAP * 3 }); // over-cap
  const healed = decayScorch(ov, ticksToHeal(ov));
  claim('D8_scorch_bounded_reversible',
    ov[targetSign] === SCORCH_CAP && scorchBoundsHold(ov) && Object.keys(healed).length === 0,
    `over-cap scorch clamps to ${SCORCH_CAP}; fully self-heals to empty in ${ticksToHeal(ov)} ticks`);

  // ── D9 no value transfer (base untouched; reward bounded AND the REWARD_CAP clamp exercised; no transfer op) ──
  const noTransferOp = !['transfer', 'cash_out', 'sell', 'buy', 'trade', 'payout'].some((t) => OP_TYPES.includes(t));
  // A dedicated decoy-free, 3-signage base whose UNCAPPED reward (30) exceeds REWARD_CAP (25), so the
  // `Math.min(REWARD_CAP, …)` clamp in simulateAttack is genuinely exercised — not vacuously bounded.
  // Deterministic for ANY seed: 4 intensity-3 moves per structure reach SCORCH_CAP=100 even in the
  // all-glancing worst case (4×25), so total_scorch=300 → uncapped floor(300/10)=30 → clamped to exactly 25.
  const capDef = identityFromSeed(`capdef/${seed}`);
  const capBlock = blockIdFor(capDef);
  const capBase = signSnapshot(capDef, foldBlock(buildSignedChain(capDef, capBlock, [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('cap1'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
    { type: 'build_structure', payload: { structure_id: structureId('cap2'), kind: 'signage', x: 2, y: 2 }, tick: 2 },
    { type: 'build_structure', payload: { structure_id: structureId('cap3'), kind: 'signage', x: 3, y: 3 }, tick: 3 },
  ])));
  const capMoves = ['cap1', 'cap2', 'cap3'].flatMap((c) => Array.from({ length: 4 }, () => ({ structure_id: structureId(c), intensity: 3 })));
  const capPlan = makeAttackPlan(attacker, { target_block: capBlock, base_address: capBase.address, nonce: 'cafebabedeadbeef', moves: capMoves });
  const capOut = simulateAttack(capBase, capPlan, settlementSeed).outcome;
  const capUncapped = Math.floor(capOut.total_scorch / 10); // REWARD_DIVISOR=10 → uncapped would be 30
  claim('D9_no_value_transfer',
    noTransferOp && r1.outcome.attacker_reward <= 25
      && capOut.total_scorch === 300 && capUncapped > 25 && capOut.attacker_reward === 25
      && JSON.stringify(defState.structures) === JSON.stringify(foldBlock(buildSignedChain(defender, block, defenderSteps())).structures),
    `no transfer/cash op; reward bounded (${r1.outcome.attacker_reward}); REWARD_CAP exercised: uncapped=${capUncapped}>25 → attacker_reward clamped to ${capOut.attacker_reward}; defender structures unchanged`);

  // ── D10 base snapshot immutable across simulation ──
  claim('D10_base_immutable',
    canonicalize(baseRecord) === baseFrozen,
    `base snapshot bytes identical before/after simulation — scorch is a separate overlay, never a base mutation`);

  // ── DRAR record_attack_result structurally valid but settlement-deferred ──
  const sRar = foldBlock([...head, rar]);
  claim('DRAR_combat_op_settlement_deferred',
    sRar.settlement_deferred.length === 1 && !sRar.applied.includes(rar.hash)
      && Object.keys(sRar.structures).length === 0,
    `record_attack_result folds to settlement-deferred (reason ${sRar.settlement_deferred[0]?.reason}); mutates nothing`);

  return {
    artifact_kind: 'turf_wars_phase2_attack_evidence',
    schema_version: 1,
    lab_only: true,
    never_production: 'arcade/hiveworld-agents/turf-wars/ is denylisted from the curated upload and imported by no Worker/DO/client path',
    seed,
    deferred: [
      'D5_seed_grinding_resistance — depends on O1 (commit-reveal settlement seed); seed is a bare parameter here',
      'D7_offline_victim_liveness — depends on O2 (fraud-proof liveness window); no settlement timing built here',
    ],
    claims,
    pass: claims.every((c) => c.ok),
  };
}

/** PURE: the multi-seed suite — independent seeds, one verdict. */
export function buildAttackEvidenceSuite({ seeds = [42, 1337, 9001] } = {}) {
  const packs = seeds.map((seed) => buildAttackEvidencePack({ seed }));
  return { schema_version: 1, lab_only: true, suite: 'turf-wars-attack-evidence-suite', seeds, packs, pass: packs.every((p) => p.pass) };
}

/** PURE: a timestamp-free replay artifact for the operator surface (docs/lab/). */
export function attackReplayArtifact(pack) {
  return {
    artifact_kind: 'turf_wars_phase2_replay',
    schema_version: 1,
    lab_only: true,
    never_production: pack.never_production,
    deferred: pack.deferred,
    replay: {
      module: 'arcade/hiveworld-agents/turf-wars/attack-evidence.mjs',
      call: `buildAttackEvidencePack({ seed: ${pack.seed} })`,
      determinism: 'fixture identities + seeded settlement seed — same call reproduces this artifact byte for byte',
    },
    result: pack,
  };
}
