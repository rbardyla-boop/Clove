/**
 * Turf Wars — Phase 3d INTEGRATION (lab) · END-TO-END FABRIC STRESS (pure, deterministic).
 *
 * ⚠️ LAB ONLY — see availability-fabric.mjs / settlement.mjs headers. Denylisted from the curated upload;
 * imported by no production path. NO REAL NETWORK, NO IP EXPOSURE — the fabric is a DETERMINISTIC in-process
 * simulator (seeded peer set; seeded drop/delay/partition). Mirrors the HiveWorld attention-stress / the 3b
 * availability-stress suite shape and the lcg(seed)/shuffled helpers. The roadmap stays DRAFT/DESIGN-ONLY and
 * Phase 0 legal/safety counsel remains BLOCKING for any live or minors-facing use.
 *
 * This stresses the FULL composed lifecycle (3a beacon → 3c mini-log/overlay → 3b window), end to end:
 *   FS1 lifecycle replay determinism   the honest lifecycle replays byte-for-byte (same overlay + block
 *                                      fingerprints, same final status) for one seed.
 *   FS2 reorder/dup convergence        K seeded reorder/dup storms over the integrated overlay entry set fold
 *                                      to the SAME overlayFingerprint; the base blockFingerprint is stable.
 *   FS3 forged-lifecycle determinism   the forged-offline-defender lifecycle replays identically (same
 *                                      revoked status, same refuted status, base byte-identical).
 *   FSP PARTITION PAST WINDOW (EXPECTED RESIDUAL WITNESS) — a partition isolating the victim + every honest
 *                                      holder past W finalizes the forgery ('final'). The disclosed residual,
 *                                      exercised end-to-end. Protection is CONDITIONAL, not closed.
 *
 * Determinism: seeded LCG only — no Date.now, no Math.random, no wall clock. Same seed → same pack byte-for-byte.
 */
import { overlayFingerprint, foldOverlay } from './overlay-dag.mjs';
import { FINALIZE_STATUS, CHALLENGE_WINDOW_HEIGHTS } from './challenge-window.mjs';
import {
  runHonestSettlement, runForgedSettlementOfflineDefender, runPartitionPastWindow,
} from './availability-fabric.mjs';

/** Tiny deterministic PRNG (mulberry32) — the ONE generator family every turf-wars pack uses. */
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

/** Default stress scale. */
export const FABRIC_STRESS_DEFAULTS = Object.freeze({ shuffles: 24, dupsPerStorm: 6 });

/** PURE: one seeded end-to-end fabric stress pack. */
export function buildFabricStressPack({ seed = 42, ...scale } = {}) {
  const p = { ...FABRIC_STRESS_DEFAULTS, ...scale };
  const rnd = lcg((seed >>> 0) ^ 0x3d57e1aa);
  const W = CHALLENGE_WINDOW_HEIGHTS;
  const claims = [];
  const claim = (id, ok, detail) => claims.push({ id, ok: !!ok, detail });

  const honest = runHonestSettlement({ seed });
  const forged = runForgedSettlementOfflineDefender({ seed });
  const partition = runPartitionPastWindow({ seed });

  // ── FS1 lifecycle replay determinism ──
  const honest2 = runHonestSettlement({ seed });
  claim('FS1_lifecycle_replay_deterministic',
    honest.overlay_fingerprint === honest2.overlay_fingerprint
      && honest.block_fingerprint === honest2.block_fingerprint
      && honest.final_status === honest2.final_status && honest.final_status === FINALIZE_STATUS.FINAL
      && honest.mini_log_fingerprint === honest2.mini_log_fingerprint,
    `two honest lifecycle replays → same overlay/block/mini-log fingerprints + same final status (${honest.final_status})`);

  // ── FS2 reorder/dup convergence over the integrated overlay; base fingerprint stable ──
  const entry = honest._internal.mini.entry;
  const baseOverlayFp = overlayFingerprint(foldOverlay([entry], [], {}));
  let convergent = true;
  for (let k = 0; k < p.shuffles; k++) {
    const dups = [];
    for (let i = 0; i < p.dupsPerStorm; i++) dups.push(entry); // dup delivery (dedup'd by mini_log_id)
    const fp = overlayFingerprint(foldOverlay(shuffled([entry, ...dups], rnd), [], {}));
    if (fp !== baseOverlayFp) { convergent = false; break; }
  }
  const baseStable = honest.block_fingerprint === runHonestSettlement({ seed }).block_fingerprint;
  claim('FS2_reorder_dup_convergent',
    convergent && baseStable,
    `${p.shuffles} reorder/dup storms over the integrated overlay → same overlayFingerprint=${convergent}; base blockFingerprint stable=${baseStable}`);

  // ── FS3 forged-lifecycle determinism: replay identical (revoked, refuted, base byte-identical) ──
  const forged2 = runForgedSettlementOfflineDefender({ seed });
  claim('FS3_forged_lifecycle_deterministic',
    forged.revoked === forged2.revoked && forged.revoked === true
      && forged.refuted_status === forged2.refuted_status && forged.refuted_status === FINALIZE_STATUS.REFUTED
      && forged.base_byte_identical === true && forged2.base_byte_identical === true
      && forged.block_fingerprint_after === forged2.block_fingerprint_after
      && overlayFingerprint(forged._internal.overlayRev) === overlayFingerprint(forged2._internal.overlayRev),
    `forged-offline lifecycle replays identical: revoked=${forged.revoked}, refuted=${forged.refuted_status}, base byte-identical=${forged.base_byte_identical}, overlayFingerprint stable`);

  // ── FSP PARTITION PAST WINDOW — the EXPECTED RESIDUAL WITNESS (NOT a protection claim) ──
  claim('FSP_partition_past_window_finalizes_forgery_EXPECTED_RESIDUAL',
    partition.protected_under_partition === false && partition.final_status === FINALIZE_STATUS.FINAL
      && partition.forgery_finalizes === true,
    `EXPECTED RESIDUAL: a partition isolating the victim + all honest holders past W → protected=${partition.protected_under_partition}, forged settlement FINALIZES=${partition.final_status}. Honest-minority assumption broken by a partition; DISCLOSED, not closed (Phase 4 / Phase 0).`);

  return {
    schema_version: 1,
    lab_only: true,
    suite: 'turf-wars-fabric-stress',
    seed,
    params: p,
    window_heights: W,
    honest_overlay_fingerprint: honest.overlay_fingerprint,
    block_fingerprint: honest.block_fingerprint,
    expected_residual_witness: 'FSP_partition_past_window_finalizes_forgery_EXPECTED_RESIDUAL',
    claims,
    pass: claims.every((c) => c.ok),
  };
}

/** PURE: the multi-seed suite. */
export function buildFabricStressSuite({ seeds = [42, 1337, 9001], ...scale } = {}) {
  const packs = seeds.map((seed) => buildFabricStressPack({ seed, ...scale }));
  return { schema_version: 1, lab_only: true, suite: 'turf-wars-fabric-stress-suite', seeds, packs, pass: packs.every((p) => p.pass) };
}
