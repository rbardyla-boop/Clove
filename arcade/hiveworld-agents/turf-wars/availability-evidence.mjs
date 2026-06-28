/**
 * Turf Wars — Phase 3b AVAILABILITY (lab) · EVIDENCE PACK (pure, deterministic). RESOLVES O2 availability
 * (MECHANISM): seeded holder-set + deterministic challenge-window finalization.
 *
 * ⚠️ LAB ONLY — see availability.mjs / settlement.mjs headers. Denylisted from the curated upload; imported by
 * no production path. NO REAL NETWORK. Mirrors the settlement/beacon evidence harness: fixture identities + a
 * single seeded LCG, every claim a { id, ok, detail } with the MEASURED value in detail, the pack PASS iff all
 * hold, a frozen LAB_MODULE_PATHS denylist self-check. The roadmap stays DRAFT/DESIGN-ONLY and Phase 0 legal/
 * safety counsel remains BLOCKING for any live or minors-facing use.
 *
 * The settlement-evidence pack DEFERRED O2 availability: "that >=1 honest peer watches within the challenge
 * window is the Phase-3 availability fabric". This pack RESOLVES that as a MECHANISM (design:
 * docs/NEON_CIRCUIT_TURF_WARS_PHASE3_PLAN.md, Residual 2) — a seeded in-process holder set + a pure
 * finalization predicate over LOGICAL seq-heights. It does NOT close the honest-minority assumption or the
 * partition-past-window falsifier — both are DISCLOSED, and partition-past-window is REPRODUCED here and in the
 * stress suite as the residual's pinned witness (research-evidence honesty / the D5 lesson).
 */
import { identityFromSeed } from './identity.mjs';
import { canonicalize, contentAddress } from './canonical.mjs';
import { foldBlock, blockFingerprint } from './block-log.mjs';
import { signSnapshot, verifySnapshot } from './snapshot.mjs';
import { makeAttackPlan } from './attack-plan.mjs';
import {
  settleAttack, makeCommitOp, makeSettleOp, proveFraud,
} from './settlement.mjs';
import { scorchBoundsHold } from './scorch.mjs';
import {
  makeHolderIndex, assignHolders, protectedIffWatched, HOLDER_ROLE, lcg,
} from './availability.mjs';
import {
  finalize, watcherVerdict, FINALIZE_STATUS, CHALLENGE_WINDOW_HEIGHTS,
} from './challenge-window.mjs';
import { buildSignedChain, blockIdFor, structureId } from './turf-evidence.mjs';
import { isExcludedFromUpload, PUBLIC_CREATOR_ALLOW } from '../../../scripts/build-curated-client-upload.mjs';

/** The Phase-3b availability lab modules — for the denylist self-check. */
export const LAB_MODULE_PATHS = Object.freeze([
  'arcade/hiveworld-agents/turf-wars/availability.mjs',
  'arcade/hiveworld-agents/turf-wars/challenge-window.mjs',
  'arcade/hiveworld-agents/turf-wars/availability-evidence.mjs',
  'arcade/hiveworld-agents/turf-wars/availability-stress.mjs',
]);

const NO_VALUE_OPS = ['transfer', 'cash_out', 'sell', 'buy', 'trade', 'payout'];
const shuffled = (arr, rnd) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};

/** PURE: a defender block (signage + resource_node), its signed base snapshot, and the genesis chain. The
 * defender is the OFFLINE VICTIM throughout — it is never required online; proveFraud is delegable. */
function defenderFixture(seed) {
  const defender = identityFromSeed(`avail-def/${seed}`);
  const block = blockIdFor(defender);
  const chain = buildSignedChain(defender, block, [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
    { type: 'build_structure', payload: { structure_id: structureId('node'), kind: 'resource_node', x: 2, y: 2 }, tick: 2 },
  ]);
  const state = foldBlock(chain);
  return { defender, block, chain, state, base: signSnapshot(defender, state) };
}

/** PURE: build the two-phase commit→settle ops and the folded state, returning the settle op's seq as the
 * challenge-window open_height. The commit folds at chain.length; the settle at chain.length + 1. */
function foldSettlement(defender, block, chain, settlement) {
  const head = chain[chain.length - 1].hash;
  const commitOp = makeCommitOp(defender, { block_id: block, prev: head, seq: chain.length, tick: chain.length },
    { base_address: settlement.base_address, plan_hash: settlement.plan_hash, seed_commit: settlement.seed_commit, beacon_height: settlement.beacon_height });
  const settleOp = makeSettleOp(defender, { block_id: block, prev: commitOp.hash, seq: chain.length + 1, tick: chain.length + 1 }, settlement);
  const folded = foldBlock([...chain, commitOp, settleOp]);
  return { commitOp, settleOp, folded, open_height: settleOp.seq };
}

/** PURE: build the Phase-3b availability evidence pack for a seed. */
export function buildAvailabilityEvidencePack({ seed = 42 } = {}) {
  const rnd = lcg((seed >>> 0) ^ 0x0a7e1b21);
  const { defender, block, chain, state, base } = defenderFixture(seed);
  const attacker = identityFromSeed(`avail-atk/${seed}`);
  const seedReveal = contentAddress({ seed }).slice(7, 7 + 32); // a closed hex token (attacker's secret)
  const beacon = contentAddress({ beacon: seed }).slice(7, 7 + 16); // post-commit beacon (O1 residual = input)
  const beaconHeight = chain.length + 1; // H_b strictly above the commit's fold height (window open)
  const W = CHALLENGE_WINDOW_HEIGHTS;
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  const plan = makeAttackPlan(attacker, {
    target_block: block, base_address: base.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('sign'), intensity: 3 }, { structure_id: structureId('sign'), intensity: 3 }],
  });

  // honest settlement + a FORGED variant (tampered outcome_digest — caught by any delegable proveFraud)
  const st = settleAttack(base, plan, { seed_reveal: seedReveal, beacon, beacon_height: beaconHeight });
  const honest = st.settlement;
  const forged = { ...honest, outcome_digest: contentAddress({ forged: seed }) };
  const { open_height } = foldSettlement(defender, block, chain, honest);

  // a seeded holder population; the DEFENDER (victim) is offline by construction. We additionally model
  // OTHER honest/byzantine/offline peers — at least one honest OTHER peer holds & watches.
  const pop = assignHolders({ seed, count: 6 });
  const honestSet = new Set(pop.filter((h) => h.role === HOLDER_ROLE.HONEST).map((h) => h.id));
  // guarantee >=1 honest OTHER peer exists (seeds could in principle yield zero honest); inject a pinned one
  const honestPeer = `holder/${seed}/honest-pinned`;
  honestSet.add(honestPeer);

  // ── A1 offline victim protected iff an honest watcher holds+watches in-window ──
  // build a holder index where the defender is OFFLINE (never caches/serves) but the honest peer caches the
  // valid base snapshot; a forged settlement is REFUTED with the defender never online.
  const idxA1 = makeHolderIndex();
  idxA1.put(honestPeer, base); // honest OTHER peer caches the offline victim's snapshot
  const watchingA1 = new Set([honestPeer]);
  const protectedA1 = protectedIffWatched(forged, base, plan, idxA1, watchingA1, honestSet);
  // the watcher produces a real proveFraud and finalize() returns 'refuted' at an in-window height
  const fraudA1 = proveFraud(base, plan, forged);
  const finA1 = finalize({ open_height }, open_height, open_height, [watcherVerdict({ height: open_height, fraud_proof: fraudA1 })], W);
  // and with NO honest watcher (only an offline peer), it is NOT protected
  const protectedA1None = protectedIffWatched(forged, base, plan, makeHolderIndex(), new Set(), honestSet);
  claim('A1_offline_victim_protected_iff_honest_watcher',
    protectedA1 === true && finA1.status === FINALIZE_STATUS.REFUTED && protectedA1None === false,
    `defender offline; honest peer holds+watches -> protected=${protectedA1} refuted=${finA1.status}; no watcher -> protected=${protectedA1None}`);

  // ── A2 a single valid fraud-proof refutes a forged provisional settlement at an in-window height ──
  const fraud = proveFraud(base, plan, forged);
  // before the proof lands: provisional (window open, no verdict)
  const beforeA2 = finalize({ open_height }, open_height, open_height + 1, [], W);
  // one valid fraud-proof at the earliest in-window height (open_height, i.e. delta 0) flips it
  const refutedA2 = finalize({ open_height }, open_height, open_height + 1, [watcherVerdict({ height: open_height, fraud_proof: fraud })], W);
  claim('A2_single_fraud_proof_refutes_in_window',
    beforeA2.status === FINALIZE_STATUS.PROVISIONAL && !!fraud && fraud.mismatch === true
      && refutedA2.status === FINALIZE_STATUS.REFUTED,
    `before=${beforeA2.status}; one fraud-proof@open_height -> ${refutedA2.status} (single proof flips, even delta 0)`);

  // ── A3 an honest settlement with no valid in-window fraud-proof finalizes to 'final' EXACTLY at W ──
  const honestNoFraud = proveFraud(base, plan, honest) === null; // honest -> no fraud-proof exists
  const atWMinus1 = finalize({ open_height }, open_height, open_height + W - 1, [], W); // not yet
  const atW = finalize({ open_height }, open_height, open_height + W, [], W);           // exactly W
  // an honest watcher verdict (null fraud_proof) NEVER refutes a clean settlement
  const cleanVerdict = finalize({ open_height }, open_height, open_height + W, [watcherVerdict({ height: open_height + 1, fraud_proof: proveFraud(base, plan, honest) })], W);
  claim('A3_window_finalizes_clean',
    honestNoFraud && atWMinus1.status === FINALIZE_STATUS.PROVISIONAL && atW.status === FINALIZE_STATUS.FINAL
      && cleanVerdict.status === FINALIZE_STATUS.FINAL,
    `honest no-fraud=${honestNoFraud}; @W-1=${atWMinus1.status}; @W=${atW.status} (final exactly when delta>=${W}); clean watcher verdict -> ${cleanVerdict.status}`);

  // ── A4 holder validation: a one-byte-tampered cached record is excluded; swap-the-index = identical ──
  const tamperedRec = { ...base, snapshot: { ...base.snapshot, counters: { ...base.snapshot.counters, flux: base.snapshot.counters.flux + 1 } } };
  const idxA4 = makeHolderIndex();
  idxA4.put('honest-holds-valid', base);
  idxA4.put('byz-holds-tampered', tamperedRec);
  const valid = idxA4.validHoldersOf(base.address);
  const tamperExcluded = valid.has('honest-holds-valid') && !valid.has('byz-holds-tampered');
  // swap the index for a PLAIN MAP performing the same verifySnapshot gate -> identical valid set
  const plainMap = new Map(); // address -> Map<holderId, record>
  const plainPut = (h, r) => { if (!plainMap.has(r.address)) plainMap.set(r.address, new Map()); plainMap.get(r.address).set(h, r); };
  plainPut('honest-holds-valid', base); plainPut('byz-holds-tampered', tamperedRec);
  // authority traces to the owner key: a plain map applying the SAME verifySnapshot gate yields the same set
  const plainValid = new Set();
  for (const [h, r] of plainMap.get(base.address)) { if (verifySnapshotGate(r)) plainValid.add(h); }
  const swapIdentical = setsEqual(valid, plainValid);
  claim('A4_holder_validation',
    tamperExcluded && swapIdentical,
    `tampered record excluded=${tamperExcluded}; swap-index identical valid set=${swapIdentical} (authority = owner key, not the index)`);

  // ── A5 scorch overlay (and thus provisional/final status, which only RIDES the scorch overlay) never
  //    perturbs blockFingerprint — the convergence oracle stays a base-state oracle ──
  // Fold the honest settlement; it applies scorch (>=1 entry). Then take the SAME folded state and vary ONLY
  // the scorch overlay (mutate it heavily, then empty it): the fingerprint is byte-identical each time, so
  // settlement status (which lives entirely on the scorch overlay) can never perturb base-state convergence.
  const settledHonest = foldSettlement(defender, block, chain, honest).folded;
  const fpWithScorch = blockFingerprint(settledHonest);
  const fpScorchMutated = blockFingerprint({ ...settledHonest, scorch: { [structureId('sign')]: 99, [structureId('node')]: 1 } });
  const fpScorchEmpty = blockFingerprint({ ...settledHonest, scorch: {} });
  const scorchOutsideFp = fpWithScorch === fpScorchMutated && fpWithScorch === fpScorchEmpty;
  // status is a pure VIEW over fold output; computing it does not change the fold or the fingerprint
  const _statusProvisional = finalize({ open_height }, open_height, open_height, [], W).status;
  const _statusFinal = finalize({ open_height }, open_height, open_height + W, [], W).status;
  const fpUnchangedByStatus = blockFingerprint(settledHonest) === fpWithScorch;
  claim('A5_scorch_outside_fingerprint',
    scorchOutsideFp && fpUnchangedByStatus && scorchBoundsHold(settledHonest.scorch)
      && Object.keys(settledHonest.scorch).length >= 1,
    `scorch overlay outside fp (mutate/empty -> same fp)=${scorchOutsideFp}; status view (${_statusProvisional}/${_statusFinal}) does not perturb fp`);

  // ── A6 convergence under storm: a seeded reorder/dup/drop delivery storm yields the SAME blockFingerprint;
  //    a rejected-settle flood (no_prior_commit / bad_seed_commit) cannot grow audit state ──
  const { commitOp, settleOp } = foldSettlement(defender, block, chain, honest);
  const opSet = [...chain, commitOp, settleOp];
  const baseStormFp = blockFingerprint(foldBlock(opSet));
  let stormOk = true;
  for (let k = 0; k < 12; k++) {
    // shuffle + duplicate-deliver a random subset (dup/drop within the same op-set, dedup'd by op.hash)
    const dups = [];
    for (let i = 0; i < 8; i++) dups.push(opSet[Math.floor(rnd() * opSet.length)]);
    if (blockFingerprint(foldBlock(shuffled([...opSet, ...dups], rnd))) !== baseStormFp) { stormOk = false; break; }
  }
  // rejected-settle flood: settle ops with NO prior commit (no_prior_commit) re-delivered N times — econ
  // rejections are recorded once per distinct op.hash; re-delivery of the SAME op cannot grow audit state.
  const orphanSettle = makeSettleOp(defender, { block_id: block, prev: chain[chain.length - 1].hash, seq: chain.length, tick: chain.length }, honest);
  const floodBase = foldBlock([...chain, orphanSettle]);
  const flood = [];
  for (let i = 0; i < 50; i++) flood.push(orphanSettle); // SAME op re-delivered
  const floodState = foldBlock([...chain, ...flood]);
  const floodBounded = floodState.econ_rejected.filter((r) => r.ref === orphanSettle.hash).length
    === floodBase.econ_rejected.filter((r) => r.ref === orphanSettle.hash).length
    && Object.keys(floodState.scorch).length === 0;
  claim('A6_convergence_under_storm',
    stormOk && floodBounded
      && floodState.econ_rejected.some((r) => r.ref === orphanSettle.hash && r.reason === 'no_prior_commit'),
    `12 reorder/dup storms -> same fp=${stormOk}; 50× rejected-settle flood -> audit bounded=${floodBounded}`);

  // ── A7 invariants preserved: base never mutated; scorch bounded reversible; no transfer/value field ──
  const baseUnchanged = canonicalize(signSnapshot(defender, foldBlock(chain))) === canonicalize(base);
  const countersUnchanged = settledHonest.counters.flux === state.counters.flux && settledHonest.counters.cores === state.counters.cores;
  const structsUnchanged = JSON.stringify(settledHonest.structures) === JSON.stringify(state.structures);
  const noValueField = !('attacker_reward' in settledHonest) && !('reward' in settledHonest.counters)
    && !NO_VALUE_OPS.some((t) => t in settledHonest);
  const scorchReversibleBounded = scorchBoundsHold(settledHonest.scorch) && honest.attacker_reward <= 25;
  claim('A7_invariants_preserved',
    baseUnchanged && countersUnchanged && structsUnchanged && noValueField && scorchReversibleBounded,
    `base/counters/structs unchanged=${baseUnchanged && countersUnchanged && structsUnchanged}; no value field=${noValueField}; scorch bounded & reward<=25=${scorchReversibleBounded}`);

  // ── denylist self-check ──
  const allExcluded = LAB_MODULE_PATHS.every((p) => isExcludedFromUpload(p));
  const notAllowlisted = LAB_MODULE_PATHS.every((p) => !PUBLIC_CREATOR_ALLOW.has(p));
  claim('A0_production_denylist_proven', allExcluded && notAllowlisted,
    `${LAB_MODULE_PATHS.length}/${LAB_MODULE_PATHS.length} availability lab modules excluded from curated upload; none allowlisted`);

  return {
    artifact_kind: 'turf_wars_phase3b_availability_evidence',
    schema_version: 1,
    lab_only: true,
    never_production: 'arcade/hiveworld-agents/turf-wars/ is denylisted from the curated upload and imported by no Worker/DO/client path',
    resolves: ['O2 availability — seeded holder-set + deterministic challenge-window finalization (mechanism)'],
    deferred_residuals: [
      'honest-minority assumption (NOT guaranteed in deployment)',
      'partition-past-window (forgery finalizes — reproduced as residual witness)',
      'real-network liveness / sybil / eclipse (B6/B7/D11)',
      'window-length calibration W',
    ],
    seed,
    window_heights: W,
    claims,
    pass: claims.every((c) => c.ok),
  };
}

// ── small local helpers (kept here so the pack is self-contained over public inputs) ──
function verifySnapshotGate(record) { return verifySnapshot(record) === null; }
function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/** PURE: the multi-seed suite. */
export function buildAvailabilityEvidenceSuite({ seeds = [42, 1337, 9001] } = {}) {
  const packs = seeds.map((seed) => buildAvailabilityEvidencePack({ seed }));
  return { schema_version: 1, lab_only: true, suite: 'turf-wars-availability-evidence-suite', seeds, packs, pass: packs.every((p) => p.pass) };
}
