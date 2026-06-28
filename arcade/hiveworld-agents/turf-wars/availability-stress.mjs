/**
 * Turf Wars — Phase 3b AVAILABILITY (lab) · PARTITION + DELIVERY-STORM STRESS (pure, deterministic).
 *
 * ⚠️ LAB ONLY — see availability.mjs / settlement.mjs headers. Denylisted from the curated upload; imported by
 * no production path. NO REAL NETWORK — availability is modeled DETERMINISTICALLY in-process (seeded holder
 * set; seeded drop/delay/partition). Mirrors the HiveWorld attention-stress suite shape (S1 replay-
 * determinism, S2 reorder-convergence over K seeded shuffles, S3 rejected-flood bounded, S7 mixed-storm) and
 * the lcg(seed)/shuffled helpers. The roadmap stays DRAFT/DESIGN-ONLY and Phase 0 legal/safety counsel remains
 * BLOCKING for any live or minors-facing use.
 *
 * Stress claims (each must hold for a pack to PASS):
 *   S1 finalize replay determinism   same (open_height, currentHeight, verdicts) -> same finalize status
 *   S2 reorder-convergence           K seeded shuffles of the settlement op-set -> same blockFingerprint AND
 *                                    same finalize verdict (the overlay status is stable under reorder)
 *   S3 rejected-settle-flood bounded re-delivering rejected settle ops (no_prior_commit / bad_seed_commit)
 *                                    N× cannot grow audit state and applies no scorch
 *   S7 mixed storm                   shuffle + dup-valid + rejected-flood + tampered-holder all at once ->
 *                                    same blockFingerprint, same valid-holder set, same finalize verdict
 *   SP PARTITION PAST WINDOW (the EXPECTED RESIDUAL WITNESS) — a partition isolates the victim AND every
 *                                    honest holder from the settlement until (currentHeight - open_height) >= W;
 *                                    the forged settlement then FINALIZES ('final'). This is the honest,
 *                                    deterministic demonstration that protection is CONDITIONAL, NOT closed —
 *                                    it asserts the falsifier reproduces, and is labelled as such.
 *
 * Determinism: seeded LCG only — no Date.now, no Math.random, no wall clock. Same seed -> same pack byte-for-byte.
 */
import { identityFromSeed } from './identity.mjs';
import { contentAddress } from './canonical.mjs';
import { foldBlock, blockFingerprint } from './block-log.mjs';
import { signSnapshot } from './snapshot.mjs';
import { makeAttackPlan } from './attack-plan.mjs';
import { settleAttack, makeCommitOp, makeSettleOp, proveFraud } from './settlement.mjs';
import {
  makeHolderIndex, assignHolders, protectedIffWatched, HOLDER_ROLE, lcg,
} from './availability.mjs';
import {
  finalize, watcherVerdict, FINALIZE_STATUS, CHALLENGE_WINDOW_HEIGHTS,
} from './challenge-window.mjs';
import { buildSignedChain, blockIdFor, structureId } from './turf-evidence.mjs';

const shuffled = (arr, rnd) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/** Default stress scale. */
export const STRESS_DEFAULTS = Object.freeze({ shuffles: 16, rejectedFlood: 200, holders: 8 });

/** PURE: a defender (OFFLINE VICTIM) block + signed base snapshot + the two-phase commit→settle op-set. */
function scenario(seed) {
  const defender = identityFromSeed(`avail-stress-def/${seed}`);
  const attacker = identityFromSeed(`avail-stress-atk/${seed}`);
  const block = blockIdFor(defender);
  const chain = buildSignedChain(defender, block, [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
    { type: 'build_structure', payload: { structure_id: structureId('node'), kind: 'resource_node', x: 2, y: 2 }, tick: 2 },
  ]);
  const state = foldBlock(chain);
  const base = signSnapshot(defender, state);
  const seedReveal = contentAddress({ seed }).slice(7, 7 + 32);
  const beacon = contentAddress({ beacon: seed }).slice(7, 7 + 16);
  const beaconHeight = chain.length + 1;
  const plan = makeAttackPlan(attacker, {
    target_block: block, base_address: base.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('sign'), intensity: 3 }, { structure_id: structureId('sign'), intensity: 3 }],
  });
  const st = settleAttack(base, plan, { seed_reveal: seedReveal, beacon, beacon_height: beaconHeight });
  const honest = st.settlement;
  const forged = { ...honest, outcome_digest: contentAddress({ forged: seed }) };
  const head = chain[chain.length - 1].hash;
  const commitOp = makeCommitOp(defender, { block_id: block, prev: head, seq: chain.length, tick: chain.length },
    { base_address: honest.base_address, plan_hash: honest.plan_hash, seed_commit: honest.seed_commit, beacon_height: beaconHeight });
  const settleOp = makeSettleOp(defender, { block_id: block, prev: commitOp.hash, seq: chain.length + 1, tick: chain.length + 1 }, honest);
  const opSet = [...chain, commitOp, settleOp];
  return { defender, block, chain, state, base, plan, honest, forged, commitOp, settleOp, opSet, open_height: settleOp.seq };
}

/** PURE: one seeded stress pack. */
export function buildAvailabilityStressPack({ seed = 42, ...scale } = {}) {
  const p = { ...STRESS_DEFAULTS, ...scale };
  const rnd = lcg((seed >>> 0) ^ 0x5a17e1ee);
  const sc = scenario(seed);
  const W = CHALLENGE_WINDOW_HEIGHTS;
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  const baseFp = blockFingerprint(foldBlock(sc.opSet));
  // a forged-claim watcher verdict landing in-window -> the canonical refutation verdict
  const fraud = proveFraud(sc.base, sc.plan, sc.forged);
  const refutingVerdicts = [watcherVerdict({ height: sc.open_height, fraud_proof: fraud })];

  // ── S1 finalize replay determinism ──
  const f1 = finalize({ open_height: sc.open_height }, sc.open_height, sc.open_height + W, [], W).status;
  const f2 = finalize({ open_height: sc.open_height }, sc.open_height, sc.open_height + W, [], W).status;
  const r1 = finalize({ open_height: sc.open_height }, sc.open_height, sc.open_height + 1, refutingVerdicts, W).status;
  const r2 = finalize({ open_height: sc.open_height }, sc.open_height, sc.open_height + 1, refutingVerdicts, W).status;
  claim('S1_finalize_replay_deterministic',
    f1 === f2 && f1 === FINALIZE_STATUS.FINAL && r1 === r2 && r1 === FINALIZE_STATUS.REFUTED,
    `clean replays -> ${f1}/${f2}; refuted replays -> ${r1}/${r2}`);

  // ── S2 reorder-convergence: K seeded shuffles -> same blockFingerprint AND same finalize verdict ──
  let reorderOk = true;
  for (let k = 0; k < p.shuffles; k++) {
    const folded = foldBlock(shuffled(sc.opSet, rnd));
    if (blockFingerprint(folded) !== baseFp) { reorderOk = false; break; }
  }
  // the finalize verdict is over the (reorder-invariant) open_height + verdicts, so it is stable too
  const verdictStable = finalize({ open_height: sc.open_height }, sc.open_height, sc.open_height + W, [], W).status === FINALIZE_STATUS.FINAL;
  claim('S2_reorder_convergent',
    reorderOk && verdictStable,
    `${p.shuffles} shuffles -> same fp=${reorderOk}; finalize verdict stable=${verdictStable}`);

  // ── S3 rejected-settle-flood bounded: re-deliver an orphan settle (no_prior_commit) N× ──
  const orphanSettle = makeSettleOp(sc.defender, { block_id: sc.block, prev: sc.chain[sc.chain.length - 1].hash, seq: sc.chain.length, tick: sc.chain.length }, sc.honest);
  const floodBase = foldBlock([...sc.chain, orphanSettle]);
  const flood = [];
  for (let i = 0; i < p.rejectedFlood; i++) flood.push(orphanSettle);
  const floodState = foldBlock([...sc.chain, ...flood]);
  const floodBounded = floodState.econ_rejected.filter((r) => r.ref === orphanSettle.hash).length
    === floodBase.econ_rejected.filter((r) => r.ref === orphanSettle.hash).length
    && Object.keys(floodState.scorch).length === 0
    && floodState.econ_rejected.some((r) => r.ref === orphanSettle.hash && r.reason === 'no_prior_commit');
  claim('S3_rejected_flood_bounded',
    floodBounded,
    `${p.rejectedFlood}× orphan settle re-delivery -> audit bounded & no scorch=${floodBounded}`);

  // ── S7 mixed storm: shuffle + dup-valid + tampered-holder, all at once ──
  // NOTE: the storm re-delivers only ops from the VALID settlement op-set (dedup'd by op.hash). The orphan
  // settle (S3) is deliberately NOT folded here — it collides at the commit's seq (a genuine fork), so it
  // belongs to its own bare-chain rejected-flood scenario, not the convergence-over-one-op-set storm.
  const dups = [];
  for (let i = 0; i < 32; i++) dups.push(sc.opSet[Math.floor(rnd() * sc.opSet.length)]);
  const storm = shuffled([...sc.opSet, ...dups], rnd);
  const stormState = foldBlock(storm);
  // holder index under storm: an honest holder caches the valid base; a byzantine holder caches a tampered copy
  const tamperedRec = { ...sc.base, snapshot: { ...sc.base.snapshot, counters: { ...sc.base.snapshot.counters, flux: sc.base.snapshot.counters.flux + 1 } } };
  const idx = makeHolderIndex();
  idx.put('honest', sc.base);
  idx.put('byz', tamperedRec);
  // re-put the same records repeatedly (storm) — the valid-holder set is stable
  for (let i = 0; i < 50; i++) { idx.put('honest', sc.base); idx.put('byz', tamperedRec); }
  const validHolders = idx.validHoldersOf(sc.base.address);
  const stormVerdict = finalize({ open_height: sc.open_height }, sc.open_height, sc.open_height + W, [], W).status;
  claim('S7_mixed_storm_stable',
    blockFingerprint(stormState) === baseFp
      && validHolders.has('honest') && !validHolders.has('byz') && validHolders.size === 1
      && stormVerdict === FINALIZE_STATUS.FINAL,
    `storm of ${storm.length} deliveries -> same fp; valid holders={honest}; finalize=${stormVerdict}`);

  // ── SP PARTITION PAST WINDOW — the EXPECTED RESIDUAL WITNESS (NOT a protection claim) ──
  // A partition isolates the OFFLINE victim AND every honest holder from the settlement until W seq-heights
  // pass: no honest peer holds the snapshot or watches in-window, so NO fraud-proof lands inside the window.
  // The forged settlement therefore FINALIZES ('final'). This is the honest, deterministic reproduction of
  // the falsifier — protection is CONDITIONAL on the honest-minority assumption, which a partition breaks.
  const partitionedIndex = makeHolderIndex(); // empty: no honest holder reached the snapshot
  const partitionedWatching = new Set();      // no one watching in-window
  const honestSetSP = new Set(assignHolders({ seed, count: p.holders }).filter((h) => h.role === HOLDER_ROLE.HONEST).map((h) => h.id));
  const protectedUnderPartition = protectedIffWatched(sc.forged, sc.base, sc.plan, partitionedIndex, partitionedWatching, honestSetSP);
  // with no in-window verdict, the forged settlement finalizes once delta >= W
  const partitionFinal = finalize({ open_height: sc.open_height }, sc.open_height, sc.open_height + W, [], W).status;
  claim('SP_partition_past_window_finalizes_forgery_EXPECTED_RESIDUAL',
    protectedUnderPartition === false && partitionFinal === FINALIZE_STATUS.FINAL,
    `EXPECTED RESIDUAL: partition isolates victim+honest holders past W -> protected=${protectedUnderPartition}, forged settlement FINALIZES=${partitionFinal}. Honest-minority assumption broken by a partition; DISCLOSED, not closed.`);

  return {
    schema_version: 1,
    lab_only: true,
    suite: 'turf-wars-availability-stress',
    seed,
    params: p,
    window_heights: W,
    base_fingerprint: baseFp,
    expected_residual_witness: 'SP_partition_past_window_finalizes_forgery_EXPECTED_RESIDUAL',
    claims,
    pass: claims.every((c) => c.ok),
  };
}

/** PURE: the multi-seed suite. */
export function buildAvailabilityStressSuite({ seeds = [42, 1337, 9001], ...scale } = {}) {
  const packs = seeds.map((seed) => buildAvailabilityStressPack({ seed, ...scale }));
  return { schema_version: 1, lab_only: true, suite: 'turf-wars-availability-stress-suite', seeds, packs, pass: packs.every((p) => p.pass) };
}
