/**
 * Turf Wars — Phase 3a BEACON SOURCE (lab) · EVIDENCE PACK (pure, deterministic). RESOLVES D5 beacon SOURCE.
 *
 * ⚠️ LAB ONLY — see beacon.mjs / settlement.mjs headers. Denylisted from the curated upload; imported by no
 * production path. Mirrors the settlement-evidence harness: fixture identities + a seeded LCG, every claim a
 * { id, ok, detail } with the MEASURED value in detail, the pack PASS iff all hold. Determinism: fixture
 * identities + a single seeded LCG — no Date.now, no Math.random, no wall clock.
 *
 * The settlement-evidence pack DEFERRED the beacon SOURCE to Phase 3/4: "the commit-before-settle ORDERING
 * is enforced in-fold (no_prior_commit); the remaining O1 residual is the beacon — it must be fixed AFTER
 * the commit and be party-uncontrolled, and the fair-beacon definition must specify WHEN the commit window
 * closes". This pack RESOLVES that source as a MECHANISM (design: docs/NEON_CIRCUIT_TURF_WARS_PHASE3_PLAN.md,
 * Residual 1): a commit-derived cross-block checkpoint beacon + a window-close-at-H_b fold rule that BOUNDS
 * (does NOT eliminate) the K-of-N multi-commit vector. The honest residuals (real-world entropy liveness,
 * colluding/sybil cohort, K bound != K=1, witnessed-set agreement, cross-peer fraud-proof application) are
 * DISCLOSED, not asserted closed — research-evidence honesty.
 */
import { identityFromSeed } from './identity.mjs';
import { canonicalize, contentAddress } from './canonical.mjs';
import { foldBlock } from './block-log.mjs';
import { signSnapshot } from './snapshot.mjs';
import { makeAttackPlan } from './attack-plan.mjs';
import { settleAttack, makeCommitOp, makeSettleOp, makeSeedCommit } from './settlement.mjs';
import { scorchBoundsHold } from './scorch.mjs';
import { deriveCohort, deriveBeacon, COHORT_SIZE, BEACON_VERSION } from './beacon.mjs';
import { buildSignedChain, blockIdFor, structureId } from './turf-evidence.mjs';
import { isExcludedFromUpload, PUBLIC_CREATOR_ALLOW } from '../../../scripts/build-curated-client-upload.mjs';

/** The Phase-3a beacon lab modules — for the denylist self-check. */
export const LAB_MODULE_PATHS = Object.freeze([
  'arcade/hiveworld-agents/turf-wars/beacon.mjs',
  'arcade/hiveworld-agents/turf-wars/beacon-evidence.mjs',
]);

const NO_VALUE_OPS = ['transfer', 'cash_out', 'sell', 'buy', 'trade', 'payout'];

/** Tiny deterministic PRNG (mulberry32) — same generator family the other turf-wars packs use. */
function lcg(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffled = (arr, rnd) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/** A foreign block that has folded to at least `height` ops (so its snapshot seq_height >= H_b). The block
 * is a chain of init + N signage builds; with `height` total ops the head seq_height is `height - 1`. */
function foreignBlock(label, height) {
  const id = identityFromSeed(`beacon-foreign/${label}`);
  const block = blockIdFor(id);
  const steps = [{ type: 'init_block', payload: { theme: 'neon' }, tick: 0 }];
  for (let i = 1; i < height; i++) {
    steps.push({ type: 'build_structure', payload: { structure_id: structureId(`${label}-s${i}`), kind: 'signage', x: i % 16, y: (i * 3) % 16 }, tick: i });
  }
  const state = foldBlock(buildSignedChain(id, block, steps));
  return { id, block, state, record: signSnapshot(id, state) };
}

/** A defender block (signage target) + signed base snapshot + genesis chain. */
function defenderFixture(seed) {
  const defender = identityFromSeed(`beacon-def/${seed}`);
  const block = blockIdFor(defender);
  const chain = buildSignedChain(defender, block, [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
  ]);
  const state = foldBlock(chain);
  return { defender, block, chain, state, base: signSnapshot(defender, state) };
}

/** PURE: build the Phase-3a beacon evidence pack for a seed. */
export function buildBeaconEvidencePack({ seed = 42 } = {}) {
  const rnd = lcg(seed ^ 0x3a9c1f57);
  const { defender, block, chain, state, base } = defenderFixture(seed);
  const attacker = identityFromSeed(`beacon-atk/${seed}`);
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  const seedReveal = contentAddress({ seed }).slice(7, 7 + 32); // the attacker's secret (closed hex token)
  const seedCommit = makeSeedCommit(seedReveal);
  const plan = makeAttackPlan(attacker, {
    target_block: block, base_address: base.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('sign'), intensity: 3 }, { structure_id: structureId('sign'), intensity: 3 }],
  });

  // H_b: the beacon height the cohort must reach. Build a pool of foreign blocks tall enough to reach it.
  const BEACON_HEIGHT = 5;
  const FOREIGN_COUNT = 6; // a witnessed pool larger than COHORT_SIZE so cohort selection is non-trivial
  const foreigns = Array.from({ length: FOREIGN_COUNT }, (_, i) => foreignBlock(`${seed}-${i}`, BEACON_HEIGHT + 1));
  const witnessed = foreigns.map((f) => f.block);
  const recordOf = new Map(foreigns.map((f) => [f.block, f.record]));
  const exclude = [block]; // exclude the defender's block (attacker has no block in this fixture)

  // ── B1 beacon deterministic: two peers, same witnessed signed-snapshot set → byte-identical beacon ──
  const cohortA = deriveCohort({ seed_commit: seedCommit, plan_hash: plan.hash, beacon_height: BEACON_HEIGHT, witnessed, exclude });
  const cohortB = deriveCohort({ seed_commit: seedCommit, plan_hash: plan.hash, beacon_height: BEACON_HEIGHT, witnessed: shuffled(witnessed, rnd), exclude });
  const recsA = cohortA.map((id) => recordOf.get(id));
  const recsB = cohortB.map((id) => recordOf.get(id));
  const beaconA = deriveBeacon({ cohortRecords: recsA, beacon_height: BEACON_HEIGHT });
  const beaconB = deriveBeacon({ cohortRecords: recsB, beacon_height: BEACON_HEIGHT });
  claim('B1_beacon_deterministic',
    cohortA.length === COHORT_SIZE && JSON.stringify(cohortA) === JSON.stringify(cohortB)
      && typeof beaconA === 'string' && /^[0-9a-f]{32}$/.test(beaconA) && beaconA === beaconB,
    `cohort=${JSON.stringify(cohortA)} (size ${cohortA.length}); beacon=${beaconA}; two peers (one with a shuffled witnessed set) agree=${beaconA === beaconB}`);

  // ── B2 post-commit undefined: deriveBeacon returns null when any cohort record's seq_height < H_b ──
  const tooEarly = foreignBlock(`${seed}-early`, BEACON_HEIGHT); // head seq_height = H_b - 1 (< H_b)
  const earlyRecs = [tooEarly.record, ...recsA.slice(1)];
  const beaconEarly = deriveBeacon({ cohortRecords: earlyRecs, beacon_height: BEACON_HEIGHT });
  claim('B2_post_commit_undefined',
    beaconEarly === null && tooEarly.state.seq_height === BEACON_HEIGHT - 1 && beaconA !== null,
    `a cohort head at seq_height=${tooEarly.state.seq_height} (< H_b=${BEACON_HEIGHT}) → beacon=null; at/after H_b → beacon defined (${beaconA})`);

  // ── B3 cohort non-grindable: with seed_commit FIXED the cohort is identical; changing only a settle-time
  //    value (a different beacon TOKEN, an unrelated input) cannot change it. Only a different seed_commit can ──
  const cohortSameCommit = deriveCohort({ seed_commit: seedCommit, plan_hash: plan.hash, beacon_height: BEACON_HEIGHT, witnessed, exclude });
  const cohortOtherCommit = deriveCohort({ seed_commit: makeSeedCommit('ffffffffffffffff'), plan_hash: plan.hash, beacon_height: BEACON_HEIGHT, witnessed, exclude });
  const sameAsFirst = JSON.stringify(cohortSameCommit) === JSON.stringify(cohortA);
  const differsOnNewCommit = JSON.stringify(cohortOtherCommit) !== JSON.stringify(cohortA);
  claim('B3_cohort_non_grindable',
    sameAsFirst && differsOnNewCommit,
    `fixed seed_commit → identical cohort=${sameAsFirst}; a DIFFERENT seed_commit → different cohort=${differsOnNewCommit} (cohort cannot be re-picked at settle time without changing the locked commit)`);

  // ── B4 beacon binds outcome: two different witnessed-head sets yield different settlement_seed/outcome ──
  const altForeigns = Array.from({ length: FOREIGN_COUNT }, (_, i) => foreignBlock(`${seed}-alt-${i}`, BEACON_HEIGHT + 1));
  const altWitnessed = altForeigns.map((f) => f.block);
  const altRecordOf = new Map(altForeigns.map((f) => [f.block, f.record]));
  const altCohort = deriveCohort({ seed_commit: seedCommit, plan_hash: plan.hash, beacon_height: BEACON_HEIGHT, witnessed: altWitnessed, exclude });
  const altBeacon = deriveBeacon({ cohortRecords: altCohort.map((id) => altRecordOf.get(id)), beacon_height: BEACON_HEIGHT });
  const stA = settleAttack(base, plan, { seed_reveal: seedReveal, beacon: beaconA, beacon_height: BEACON_HEIGHT });
  const stAlt = settleAttack(base, plan, { seed_reveal: seedReveal, beacon: altBeacon, beacon_height: BEACON_HEIGHT });
  claim('B4_beacon_binds_outcome',
    stA.ok && stAlt.ok && beaconA !== altBeacon
      && stA.settlement.settlement_seed !== stAlt.settlement.settlement_seed
      && stA.settlement.outcome_digest !== stAlt.settlement.outcome_digest,
    `beaconA=${beaconA} vs altBeacon=${altBeacon}; settlement_seed differs=${stA.settlement.settlement_seed !== stAlt.settlement.settlement_seed}; outcome_digest differs=${stA.settlement.outcome_digest !== stAlt.settlement.outcome_digest}`);

  // ── B5 window-close enforced: a settle_attack whose prior attack_commit folded at seq >= H_b is
  //    econ-rejected commit_window_closed AND applies ZERO scorch (folded through foldBlock) ──
  // Build a long defender chain so the commit lands at a seq >= H_b. The commit at seq=L, with H_b small,
  // means prior.seq (L) >= beacon_height → window closed.
  const longSteps = [{ type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 }];
  for (let i = 2; i <= BEACON_HEIGHT; i++) longSteps.push({ type: 'build_structure', payload: { structure_id: structureId(`pad${i}`), kind: 'signage', x: i % 16, y: (i + 1) % 16 }, tick: i });
  const longChain = buildSignedChain(defender, block, longSteps); // length = BEACON_HEIGHT + 1
  const longState = foldBlock(longChain);
  const longBase = signSnapshot(defender, longState);
  const longPlan = makeAttackPlan(attacker, {
    target_block: block, base_address: longBase.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('sign'), intensity: 3 }, { structure_id: structureId('sign'), intensity: 3 }],
  });
  const stLong = settleAttack(longBase, longPlan, { seed_reveal: seedReveal, beacon: beaconA, beacon_height: BEACON_HEIGHT });
  const lateCommitSeq = longChain.length; // >= H_b (BEACON_HEIGHT+1 > BEACON_HEIGHT)
  const lateCommit = makeCommitOp(defender, { block_id: block, prev: longChain[longChain.length - 1].hash, seq: lateCommitSeq, tick: lateCommitSeq },
    { base_address: stLong.settlement.base_address, plan_hash: stLong.settlement.plan_hash, seed_commit: stLong.settlement.seed_commit, beacon_height: BEACON_HEIGHT });
  const lateSettle = makeSettleOp(defender, { block_id: block, prev: lateCommit.hash, seq: lateCommitSeq + 1, tick: lateCommitSeq + 1 }, stLong.settlement);
  const closedState = foldBlock([...longChain, lateCommit, lateSettle]);
  claim('B5_window_close_enforced',
    lateCommitSeq >= BEACON_HEIGHT
      && !closedState.applied.includes(lateSettle.hash)
      && closedState.econ_rejected.some((r) => r.ref === lateSettle.hash && r.reason === 'commit_window_closed')
      && Object.keys(closedState.scorch).length === 0,
    `commit folded at seq=${lateCommitSeq} (>= H_b=${BEACON_HEIGHT}) → settle econ-rejected commit_window_closed; scorch applied=${Object.keys(closedState.scorch).length} (zero)`);

  // ── B6 K-bound measured: fold K attack_commits before H_b; exactly those at seq < H_b are settleable.
  //    The bound = the pre-H_b chain-op budget. We measure K by folding distinct commits at seqs 2..H_b-1
  //    (all < H_b → open) plus one at seq H_b (>= H_b → closed) and counting settleable ones. ──
  // Use the SHORT base (genesis chain length 2). Commits occupy seqs 2,3,...; H_b = 5 → seqs 2,3,4 are
  // open (< 5), seq 5 is closed (>= 5). Each commit carries a DISTINCT seed (the multi-commit grind vector).
  const kBaseChain = chain; // length 2
  let prevHash = kBaseChain[kBaseChain.length - 1].hash;
  const kOps = [];
  const kSettleResults = [];
  let openCount = 0;
  let closedCount = 0;
  // seqs 2 .. H_b inclusive → (H_b - 2 + 1) = 4 commits; the last (seq=H_b) is the closed one.
  for (let seq = 2; seq <= BEACON_HEIGHT; seq++) {
    const kReveal = contentAddress({ k: seq, seed }).slice(7, 7 + 32);
    const kCommit = makeSeedCommit(kReveal);
    const commitOp = makeCommitOp(defender, { block_id: block, prev: prevHash, seq, tick: seq },
      { base_address: base.address, plan_hash: plan.hash, seed_commit: kCommit, beacon_height: BEACON_HEIGHT });
    kOps.push(commitOp);
    prevHash = commitOp.hash;
    kSettleResults.push({ seq, kReveal, kCommit });
  }
  // settle each: the settle op goes at seq = (last commit seq) + 1 ... but a fold needs ONE contiguous chain.
  // Measure structurally instead: for each commit, fold a chain that ends with ITS settle at the next seq.
  let settleableK = 0;
  for (const { seq, kReveal } of kSettleResults) {
    // a chain of the genesis + THIS single commit at its seq is non-contiguous; build a contiguous chain
    // genesis + commits[0..idx] then the settle right after.
    const idx = seq - 2;
    const prefix = [...kBaseChain, ...kOps.slice(0, idx + 1)];
    const stK = settleAttack(base, plan, { seed_reveal: kReveal, beacon: beaconA, beacon_height: BEACON_HEIGHT });
    const settleSeq = prefix[prefix.length - 1].seq + 1;
    const settleOp = makeSettleOp(defender, { block_id: block, prev: prefix[prefix.length - 1].hash, seq: settleSeq, tick: settleSeq }, stK.settlement);
    const st = foldBlock([...prefix, settleOp]);
    const settled = st.applied.includes(settleOp.hash);
    if (seq < BEACON_HEIGHT) { openCount++; if (settled) settleableK++; }
    else { closedCount++; if (!settled) { /* correctly closed */ } }
  }
  claim('B6_k_bound_measured',
    openCount === settleableK && openCount === (BEACON_HEIGHT - 2) && closedCount === 1,
    `K measured: ${settleableK} commits at seq < H_b (=${BEACON_HEIGHT}) are settleable (= the pre-H_b chain-op budget); ${closedCount} at seq >= H_b is window-closed. K is BOUNDED, not 1.`);

  // ── B7 invariants preserved: the beacon path adds NO value/transfer field; the base is never mutated; the
  //    folded scorch stays bounded reversible. Re-assert against the honest folded settlement. ──
  const head = chain[chain.length - 1].hash;
  const commitOk = makeCommitOp(defender, { block_id: block, prev: head, seq: chain.length, tick: chain.length },
    { base_address: stA.settlement.base_address, plan_hash: stA.settlement.plan_hash, seed_commit: stA.settlement.seed_commit, beacon_height: BEACON_HEIGHT });
  const settleOk = makeSettleOp(defender, { block_id: block, prev: commitOk.hash, seq: chain.length + 1, tick: chain.length + 1 }, stA.settlement);
  const okState = foldBlock([...chain, commitOk, settleOk]);
  const baseUnchanged = canonicalize(signSnapshot(defender, foldBlock(chain))) === canonicalize(base);
  const countersUnchanged = okState.counters.flux === state.counters.flux && okState.counters.cores === state.counters.cores;
  const structsUnchanged = JSON.stringify(okState.structures) === JSON.stringify(state.structures);
  const rewardNowhere = !('attacker_reward' in okState) && !('reward' in okState.counters);
  const beaconAddsNoValueField = !NO_VALUE_OPS.some((k) => k in stA.settlement);
  claim('B7_invariants_preserved',
    okState.applied.includes(settleOk.hash) && scorchBoundsHold(okState.scorch) && Object.keys(okState.scorch).length >= 1
      && baseUnchanged && countersUnchanged && structsUnchanged && rewardNowhere
      && stA.settlement.attacker_reward <= 25 && beaconAddsNoValueField,
    `base/counters/structures unchanged=${baseUnchanged && countersUnchanged && structsUnchanged}; scorch bounded=${scorchBoundsHold(okState.scorch)}; reward=${stA.settlement.attacker_reward} credited to NOTHING=${rewardNowhere}; no transfer/value field on the beacon path=${beaconAddsNoValueField}`);

  // ── denylist self-check (boundary): the beacon lab modules never reach the curated production upload ──
  const allExcluded = LAB_MODULE_PATHS.every((p) => isExcludedFromUpload(p));
  const notAllowlisted = LAB_MODULE_PATHS.every((p) => !PUBLIC_CREATOR_ALLOW.has(p));
  claim('B_denylist_self_check', allExcluded && notAllowlisted,
    `${LAB_MODULE_PATHS.length}/${LAB_MODULE_PATHS.length} beacon lab modules excluded from curated upload; none allowlisted`);

  return {
    artifact_kind: 'turf_wars_phase3a_beacon_evidence',
    schema_version: 1,
    lab_only: true,
    beacon_version: BEACON_VERSION,
    never_production: 'arcade/hiveworld-agents/turf-wars/ is denylisted from the curated upload and imported by no Worker/DO/client path',
    seed,
    resolves: [
      'D5 beacon SOURCE — commit-derived cross-block checkpoint + window-close-at-H_b',
    ],
    deferred_residuals: [
      'real-world entropy liveness',
      'colluding/sybil cohort (measured not closed)',
      'K bound is a bound NOT K=1',
      'witnessed-set agreement (O2/O6)',
      'cross-peer fraud-proof application (O6)',
    ],
    claims,
    pass: claims.every((c) => c.ok),
  };
}

/** PURE: the multi-seed suite. */
export function buildBeaconEvidenceSuite({ seeds = [42, 1337, 9001] } = {}) {
  const packs = seeds.map((seed) => buildBeaconEvidencePack({ seed }));
  return { schema_version: 1, lab_only: true, suite: 'turf-wars-beacon-evidence-suite', seeds, packs, pass: packs.every((p) => p.pass) };
}
