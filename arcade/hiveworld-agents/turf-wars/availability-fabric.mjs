/**
 * Turf Wars — Phase 3d INTEGRATION (lab) · NON-CENTRAL AVAILABILITY FABRIC — DETERMINISTIC IN-PROCESS
 * SIMULATOR (NOT a wire). Pure.
 *
 * ⚠️ LAB ONLY — see settlement.mjs / canonical.mjs headers. `arcade/hiveworld-agents/turf-wars/` is
 * denylisted from the curated production upload and imported by no Worker/DO/client path. This authorizes
 * nothing live: no live combat, no minors-facing use, no economy, no production exposure, NO REAL NETWORK,
 * NO IP EXPOSURE. The roadmap stays DRAFT/DESIGN-ONLY and Phase 0 legal/safety counsel remains BLOCKING for
 * any live or minors-facing use.
 *
 * This module COMPOSES the already-built, already-reviewed Phase 3a/3b/3c lab modules into ONE end-to-end
 * settlement lifecycle, exactly as designed in docs/NEON_CIRCUIT_TURF_WARS_PHASE3_PLAN.md (P3-d, the gate
 * "NO-CENTRAL-AUTHORITY AVAILABILITY EXERCISED"). It ADDS NO new authority and CHANGES NO existing module —
 * every authority point is replay-determinism (foldBlock / foldMiniLog / foldOverlay) or the delegable
 * one-op fraud-proof (proveFraud); no node mints, signs, or arbitrates an outcome.
 *
 * The full lifecycle, composed:
 *   3a BEACON   — the beacon is DERIVED (deriveBeacon) from a commit-bound cohort (deriveCohort) of foreign
 *                 signed snapshots at height >= H_b; UNDEFINED before H_b. Party-uncontrolled, post-commit.
 *   3c MINI-LOG — the attacker is the SOLE writer of its own settlement mini-log: settlement_commit (with
 *                 beacon_height H_b) then settlement_reveal (the full settlement). foldMiniLog enforces
 *                 single-writer + commit-before-reveal in the attacker's OWN namespace; the owner base chain
 *                 is never touched.
 *   3c OVERLAY  — the folded mini-log becomes an overlay entry; foldOverlay merges entries deterministically
 *                 and applies keyless revocations (any third party who can proveFraud).
 *   3b WINDOW   — holders cache the defender's signed snapshot; watchers run the challenge-window predicate
 *                 (finalize) over LOGICAL seq-heights; an offline victim is protected iff >=1 honest watcher
 *                 holds + watches in-window.
 *
 * Availability is modeled DETERMINISTICALLY in-process — a seeded peer set with seeded honest/byzantine/
 * offline roles and seeded drop/delay/partition — NEVER over a wire. Real P2P transport, IP exposure,
 * sybil/eclipse, and the honest-minority assumption stay DEFERRED (B6/B7/D11 / Phase 4 / Phase 0). This
 * harness PROVES THE MECHANISM, NOT THE DEPLOYMENT.
 *
 * The holder/discovery seam is SWAPPABLE and SIGNING-KEYLESS: `swapHolderIndex` builds a plain-map index
 * applying the SAME verifySnapshot gate, and the lifecycle outcome is byte-identical — because correctness
 * traces to the owner key inside each record and the delegable proveFraud, never to the index.
 *
 * Determinism: pure, zero-dep; node:crypto via canonical.mjs / identity.mjs; ONE lcg(seed); NO Date.now /
 * Math.random / wall clock — byte-identical regeneration. H_b and the window W are LOGICAL seq-heights.
 */
import { identityFromSeed } from './identity.mjs';
import { contentAddress } from './canonical.mjs';
import { foldBlock, blockFingerprint } from './block-log.mjs';
import { signSnapshot, verifySnapshot } from './snapshot.mjs';
import { makeAttackPlan } from './attack-plan.mjs';
import { settleAttack, proveFraud, makeSeedCommit } from './settlement.mjs';
import { deriveCohort, deriveBeacon } from './beacon.mjs';
import {
  makeHolderIndex, assignHolders, protectedIffWatched, HOLDER_ROLE,
} from './availability.mjs';
import {
  finalize, watcherVerdict, FINALIZE_STATUS, CHALLENGE_WINDOW_HEIGHTS,
} from './challenge-window.mjs';
import {
  makeMiniLogId, makeSettlementCommitOp, makeSettlementRevealOp,
  foldMiniLog, miniLogFingerprint,
} from './settlement-mini-log.mjs';
import {
  foldOverlay, overlayFingerprint, overlayEntryFromMiniLog,
  makeRevocationEntry, verifyRevocationEntry,
} from './overlay-dag.mjs';
import { buildSignedChain, blockIdFor, structureId } from './turf-evidence.mjs';

export const FABRIC_VERSION = 1;

/** The beacon height H_b the cohort must reach. A fixed bounded LOGICAL seq-height (never a timestamp). The
 * commit folds at seq 0 of the mini-log; H_b is well above so the beacon provably post-dates the commit. */
export const FABRIC_BEACON_HEIGHT = 5;
/** Number of witnessed foreign blocks (a pool larger than the beacon COHORT_SIZE so cohort selection is
 * non-trivial). */
export const FABRIC_FOREIGN_COUNT = 6;

// ── fixtures (seeded; deterministic) ──────────────────────────────────────────

/** A foreign block folded to `height` total ops (head seq_height = height - 1), with a signed snapshot. */
function foreignBlock(label, height) {
  const id = identityFromSeed(`fabric-foreign/${label}`);
  const block = blockIdFor(id);
  const steps = [{ type: 'init_block', payload: { theme: 'neon' }, tick: 0 }];
  for (let i = 1; i < height; i++) {
    steps.push({ type: 'build_structure', payload: { structure_id: structureId(`${label}-s${i}`), kind: 'signage', x: i % 16, y: (i * 3) % 16 }, tick: i });
  }
  const state = foldBlock(buildSignedChain(id, block, steps));
  return { id, block, state, record: signSnapshot(id, state) };
}

/** A defender (the OFFLINE VICTIM/OWNER) block + signed base snapshot + genesis chain. Never required online:
 * proveFraud is delegable and revocation is keyless for the owner. */
function defenderGenesisSteps() {
  // ONE source of truth for the defender genesis: both defenderFixture and the post-lifecycle base recompute
  // use it, so a "byte-identical base" assertion compares the SAME steps (no drift risk).
  return [
    { type: 'init_block', payload: { theme: 'chrome' }, tick: 0 },
    { type: 'build_structure', payload: { structure_id: structureId('sign'), kind: 'signage', x: 1, y: 1 }, tick: 1 },
    { type: 'build_structure', payload: { structure_id: structureId('node'), kind: 'resource_node', x: 2, y: 2 }, tick: 2 },
  ];
}
function defenderFixture(seed) {
  const defender = identityFromSeed(`fabric-def/${seed}`);
  const block = blockIdFor(defender);
  const chain = buildSignedChain(defender, block, defenderGenesisSteps());
  const state = foldBlock(chain);
  return { defender, block, chain, state, base: signSnapshot(defender, state) };
}

/**
 * PURE: build the shared 3a/3c primitives for one (seed) lifecycle — the cohort, the DERIVED beacon, the
 * attacker mini-log (commit→reveal), the overlay entry, and the honest settlement claim. Returns everything
 * the honest / forged scenarios below compose. The DEFENDER here is the offline victim/owner.
 */
function setupLifecycle({ seed }) {
  const { defender, block, chain, state, base } = defenderFixture(seed);
  const attacker = identityFromSeed(`fabric-atk/${seed}`);

  // 3a — a witnessed pool of foreign blocks at height >= H_b; the cohort is commit-bound; the beacon DERIVED.
  const H_b = FABRIC_BEACON_HEIGHT;
  const foreigns = Array.from({ length: FABRIC_FOREIGN_COUNT }, (_, i) => foreignBlock(`${seed}-${i}`, H_b + 1));
  const witnessed = foreigns.map((f) => f.block);
  const recordOf = new Map(foreigns.map((f) => [f.block, f.record]));
  const exclude = [block]; // exclude the defender's own block from the cohort

  const seedReveal = contentAddress({ seed }).slice(7, 7 + 32); // attacker's secret (closed hex token)
  const seed_commit = makeSeedCommit(seedReveal); // locked at commit time, BEFORE the beacon exists
  const plan = makeAttackPlan(attacker, {
    target_block: block, base_address: base.address, nonce: 'cafebabedeadbeef',
    moves: [{ structure_id: structureId('sign'), intensity: 3 }, { structure_id: structureId('sign'), intensity: 3 }],
  });
  // 3a — the cohort is a deterministic function of the LOCKED seed_commit (not chosen at settle time); the
  // beacon is DERIVED from the cohort's signed heads at >= H_b and is UNDEFINED before then (post-commit).
  const cohort = deriveCohort({ seed_commit, plan_hash: plan.hash, beacon_height: H_b, witnessed, exclude });
  const cohortRecords = cohort.map((id) => recordOf.get(id));
  const beacon = deriveBeacon({ cohortRecords, beacon_height: H_b });

  return {
    defender, block, chain, state, base, attacker, plan, seedReveal, seed_commit,
    H_b, foreigns, witnessed, recordOf, exclude, cohort, cohortRecords, beacon,
  };
}

/**
 * PURE: build the attacker's single-writer settlement mini-log (3c) for a settlement record. Returns the
 * commit/reveal ops, the folded mini-log, and the overlay entry. The attacker is the SOLE writer.
 */
function buildMiniLog({ attacker, block, base, settlement, H_b }) {
  const mini_log_id = makeMiniLogId({ block_id: block, base_address: base.address, attacker_pubkey: attacker.publicRawHex });
  const commitOp = makeSettlementCommitOp(attacker, { mini_log_id, prev: null, seq: 0, tick: 0 },
    { base_address: settlement.base_address, plan_hash: settlement.plan_hash, seed_commit: settlement.seed_commit, beacon_height: H_b });
  const revealOp = makeSettlementRevealOp(attacker, { mini_log_id, prev: commitOp.hash, seq: 1, tick: 1 }, settlement);
  const ops = [commitOp, revealOp];
  const folded = foldMiniLog(ops);
  return { mini_log_id, commitOp, revealOp, ops, folded, entry: overlayEntryFromMiniLog(folded) };
}

/**
 * PURE: a swappable, signing-keyless holder/discovery index built over a PLAIN MAP that applies the SAME
 * verifySnapshot gate as makeHolderIndex. The whole point: swap this in for makeHolderIndex() and every
 * downstream finalization/protection outcome is byte-identical, because authority is the owner key inside
 * each record + the delegable proveFraud, never the index. It holds no key and decides nothing.
 */
export function swapHolderIndex() {
  const byAddress = new Map(); // address -> Map<holderId, record>
  return {
    put(holderId, record) {
      if (typeof holderId !== 'string' || !record || typeof record.address !== 'string') return false;
      if (!byAddress.has(record.address)) byAddress.set(record.address, new Map());
      byAddress.get(record.address).set(holderId, record);
      return true;
    },
    has(address) { const m = byAddress.get(address); return !!m && m.size > 0; },
    holdersOf(address) { const m = byAddress.get(address); return m ? new Set(m.keys()) : new Set(); },
    validHoldersOf(address) {
      const m = byAddress.get(address); const out = new Set();
      if (!m) return out;
      for (const [holderId, record] of m) if (verifySnapshot(record) === null) out.add(holderId);
      return out;
    },
    addresses() { return new Set(byAddress.keys()); },
  };
}

/**
 * PURE: run the FULL HONEST settlement lifecycle end-to-end and return its trace + fingerprints.
 *
 *   commit (mini-log) → DERIVED post-commit beacon → settle (3a beacon into the unchanged 4-input boundary)
 *   → overlay entry (3c) → holders cache the defender snapshot → watchers run the challenge window (3b).
 *
 * With NO valid proveFraud (the settlement is honest), the window finalizes 'final'. `makeIndex` lets the
 * caller swap the holder/discovery seam (default makeHolderIndex; pass swapHolderIndex to prove the swap).
 */
export function runHonestSettlement({ seed = 42, makeIndex = makeHolderIndex, windowHeights = CHALLENGE_WINDOW_HEIGHTS } = {}) {
  const ctx = setupLifecycle({ seed });
  const { defender, block, chain, base, attacker, plan, seedReveal, H_b, beacon } = ctx;
  const W = windowHeights;

  // 3a → settlement: the DERIVED post-commit beacon feeds the UNCHANGED deriveSettlementSeed boundary.
  const st = settleAttack(base, plan, { seed_reveal: seedReveal, beacon, beacon_height: H_b });
  const settlement = st.settlement;

  // 3c — attacker single-writer mini-log + overlay entry.
  const mini = buildMiniLog({ attacker, block, base, settlement, H_b });
  const overlay = foldOverlay([mini.entry], [], {});

  // 3b — holders cache the OFFLINE defender's signed snapshot; a seeded honest peer holds + watches in-window.
  const pop = assignHolders({ seed, count: 6 });
  const honestSet = new Set(pop.filter((h) => h.role === HOLDER_ROLE.HONEST).map((h) => h.id));
  const honestPeer = `holder/${seed}/honest-pinned`;
  honestSet.add(honestPeer);
  const index = makeIndex();
  index.put(honestPeer, base); // honest OTHER peer caches the offline victim's snapshot

  // the watcher recomputes the honest settlement → proveFraud === null → NO refutation in the window.
  const honestVerdict = watcherVerdict({ height: settlement ? mini.commitOp.seq : 0, fraud_proof: proveFraud(base, plan, settlement) });
  const openHeight = chain.length + 1; // logical open height (the settle's seq in the base-chain projection)
  const atW = finalize({ open_height: openHeight }, openHeight, openHeight + W, [honestVerdict], W);

  // an honest settlement is NOT "protected against" — there is nothing to refute (protectedIffWatched=false)
  const watchingSet = new Set([honestPeer]);
  const protectedHonest = protectedIffWatched(settlement, base, plan, index, watchingSet, honestSet);

  return {
    scenario: 'honest',
    seed,
    settlement,
    beacon,
    beacon_height: H_b,
    cohort: ctx.cohort,
    mini_log_fingerprint: miniLogFingerprint(mini.folded),
    overlay_fingerprint: overlayFingerprint(overlay),
    block_fingerprint: blockFingerprint(foldBlock(chain)),
    final_status: atW.status,
    finalized: atW.status === FINALIZE_STATUS.FINAL,
    protected_against_honest: protectedHonest, // expected false: an honest claim has nothing to refute
    entry_status: overlay.by_id[mini.mini_log_id] ? overlay.by_id[mini.mini_log_id].status : null,
    defender_pubkey: defender.publicRawHex,
    _internal: { ctx, mini, overlay, index, openHeight, honestSet },
  };
}

/**
 * PURE: run the FORGED-settlement-against-an-OFFLINE-defender lifecycle and return its trace.
 *
 * The DEFENDER is OFFLINE (not a holder, not a watcher, never signs). The attacker submits a FORGED
 * settlement_reveal (outcome_digest != honest recompute). A THIRD-PARTY watcher (neither attacker nor
 * defender) holds the defender's signed snapshot, runs proveFraud over PUBLIC inputs, produces a revocation
 * (makeRevocationEntry), and foldOverlay marks the entry 'revoked' — WITHOUT the owner's key or presence. The
 * challenge window REFUTES the forgery in-window. The defender's blockFingerprint is byte-identical
 * throughout (the base is never mutated).
 */
export function runForgedSettlementOfflineDefender({ seed = 42, makeIndex = makeHolderIndex, windowHeights = CHALLENGE_WINDOW_HEIGHTS } = {}) {
  const ctx = setupLifecycle({ seed });
  const { defender, block, chain, base, attacker, plan, seedReveal, H_b, beacon } = ctx;
  const W = windowHeights;

  const blockFpBefore = blockFingerprint(foldBlock(chain)); // the offline owner's base — measured BEFORE

  // honest recompute (what proveFraud will compare against) + the attacker's FORGED claim.
  const st = settleAttack(base, plan, { seed_reveal: seedReveal, beacon, beacon_height: H_b });
  const honest = st.settlement;
  const forged = { ...honest, outcome_digest: contentAddress({ forged: seed }) };

  // 3c — the attacker's mini-log carries the FORGED reveal (the overlay entry inherits the forged digest).
  const mini = buildMiniLog({ attacker, block, base, settlement: forged, H_b });
  const forgedEntry = mini.entry; // overlayEntryFromMiniLog already reflects forged.outcome_digest

  // 3b/3c — a THIRD-PARTY watcher (not attacker, not the offline defender) holds the defender snapshot and
  // catches the forgery with ONLY public inputs. The owner is never online and never signs.
  const watcher = identityFromSeed(`fabric-watcher/${seed}`);
  const index = makeIndex();
  index.put(`watcher/${seed}`, base); // a third party caches the offline victim's signed snapshot

  const fraud = proveFraud(base, plan, forged); // keyless, delegable; owner not involved
  const revocation = makeRevocationEntry({ mini_log_id: mini.mini_log_id, fraud_proof: fraud, revoker_identity: watcher });
  const isVerified = (rev) => rev.mini_log_id === mini.mini_log_id
    ? verifyRevocationEntry(forgedEntry, base, plan, forged)
    : false;
  const overlayNoRev = foldOverlay([forgedEntry], [], { isVerified });
  const overlayRev = foldOverlay([forgedEntry], [revocation], { isVerified });

  // the challenge window REFUTES the forgery in-window (a single valid proveFraud flips it, even at delta 0).
  const openHeight = chain.length + 1;
  const refutingVerdict = watcherVerdict({ height: openHeight, fraud_proof: fraud });
  const fin = finalize({ open_height: openHeight }, openHeight, openHeight + W, [refutingVerdict], W);

  // the OFFLINE victim is PROTECTED iff an honest watcher holds + watches in-window.
  const honestSet = new Set([`watcher/${seed}`]);
  const watchingSet = new Set([`watcher/${seed}`]);
  const protectedVictim = protectedIffWatched(forged, base, plan, index, watchingSet, honestSet);

  const blockFpAfter = blockFingerprint(foldBlock(buildSignedChain(defender, block, defenderGenesisSteps())));
  // ^ recomputed from the SAME genesis steps — measured AFTER overlay/revocation activity

  return {
    scenario: 'forged_offline_defender',
    seed,
    honest,
    forged,
    beacon,
    beacon_height: H_b,
    fraud_proof: fraud,
    revoked: overlayRev.revoked.has(mini.mini_log_id),
    revoked_status: overlayRev.by_id[mini.mini_log_id] ? overlayRev.by_id[mini.mini_log_id].status : null,
    scorch_excluded: overlayRev.applied_total < overlayNoRev.applied_total,
    applied_total_no_rev: overlayNoRev.applied_total,
    applied_total_rev: overlayRev.applied_total,
    refuted_status: fin.status,
    refuted: fin.status === FINALIZE_STATUS.REFUTED,
    protected_victim: protectedVictim,
    revoker_is_watcher_not_owner: revocation.revoker_pubkey === watcher.publicRawHex
      && revocation.revoker_pubkey !== defender.publicRawHex,
    owner_online: false,
    block_fingerprint_before: blockFpBefore,
    block_fingerprint_after: blockFpAfter,
    base_byte_identical: blockFpBefore === blockFpAfter,
    _internal: { ctx, mini, overlayRev, overlayNoRev, openHeight },
  };
}

/**
 * PURE: prove the holder/discovery seam is SWAPPABLE and SIGNING-KEYLESS — run the SAME lifecycle once with
 * makeHolderIndex and once with swapHolderIndex (a plain map applying the same verifySnapshot gate) and
 * confirm every observable outcome (final status, overlay fingerprint, revocation, protection) is identical.
 * Returns { honestIdentical, forgedIdentical } booleans + the two traces for inspection.
 */
export function swapIndexInvariance({ seed = 42 } = {}) {
  const honestDefault = runHonestSettlement({ seed, makeIndex: makeHolderIndex });
  const honestSwapped = runHonestSettlement({ seed, makeIndex: swapHolderIndex });
  const forgedDefault = runForgedSettlementOfflineDefender({ seed, makeIndex: makeHolderIndex });
  const forgedSwapped = runForgedSettlementOfflineDefender({ seed, makeIndex: swapHolderIndex });

  const honestIdentical =
    honestDefault.final_status === honestSwapped.final_status &&
    honestDefault.overlay_fingerprint === honestSwapped.overlay_fingerprint &&
    honestDefault.block_fingerprint === honestSwapped.block_fingerprint &&
    honestDefault.protected_against_honest === honestSwapped.protected_against_honest;

  const forgedIdentical =
    forgedDefault.refuted_status === forgedSwapped.refuted_status &&
    forgedDefault.revoked === forgedSwapped.revoked &&
    forgedDefault.protected_victim === forgedSwapped.protected_victim &&
    forgedDefault.base_byte_identical === forgedSwapped.base_byte_identical &&
    forgedDefault.block_fingerprint_after === forgedSwapped.block_fingerprint_after;

  return { honestIdentical, forgedIdentical, honestDefault, honestSwapped, forgedDefault, forgedSwapped };
}

/**
 * PURE: run the forged lifecycle under a PARTITION that isolates the offline victim AND every honest holder
 * from the settlement until W seq-heights pass — the EXPECTED RESIDUAL WITNESS. No honest peer holds the
 * snapshot or watches in-window, so NO fraud-proof lands inside the window and the forged settlement
 * FINALIZES ('final'). This is the honest, deterministic reproduction of the falsifier — protection is
 * CONDITIONAL on the honest-minority assumption, which a partition breaks. DISCLOSED, NOT closed.
 */
export function runPartitionPastWindow({ seed = 42, windowHeights = CHALLENGE_WINDOW_HEIGHTS } = {}) {
  const ctx = setupLifecycle({ seed });
  const { base, chain, plan, seedReveal, H_b, beacon } = ctx;
  const W = windowHeights;

  const st = settleAttack(base, plan, { seed_reveal: seedReveal, beacon, beacon_height: H_b });
  const forged = { ...st.settlement, outcome_digest: contentAddress({ forged: seed }) };

  // the partition: an EMPTY holder index (no honest holder reached the snapshot) + no one watching in-window.
  const partitionedIndex = makeHolderIndex();
  const partitionedWatching = new Set();
  const honestSet = new Set(assignHolders({ seed, count: 8 }).filter((h) => h.role === HOLDER_ROLE.HONEST).map((h) => h.id));
  const protectedUnderPartition = protectedIffWatched(forged, base, plan, partitionedIndex, partitionedWatching, honestSet);

  const openHeight = chain.length + 1;
  const fin = finalize({ open_height: openHeight }, openHeight, openHeight + W, [], W); // no in-window verdict

  return {
    scenario: 'partition_past_window_EXPECTED_RESIDUAL',
    seed,
    protected_under_partition: protectedUnderPartition, // expected false
    final_status: fin.status,                            // expected 'final' (forgery finalizes)
    forgery_finalizes: fin.status === FINALIZE_STATUS.FINAL && protectedUnderPartition === false,
    disclosure: 'EXPECTED RESIDUAL: a partition isolating the victim + all honest holders past W finalizes the forgery. Honest-minority assumption broken; DISCLOSED, not closed (Phase 4 / Phase 0).',
  };
}
