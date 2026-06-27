/**
 * Turf Wars — Phase 2 FOUNDATION (lab) · REVERSIBLE COSMETIC SCORCH OVERLAY (pure, deterministic).
 *
 * ⚠️ LAB ONLY — see attack-plan.mjs header. No production exposure / live combat / economy.
 *
 * "Loss" in Turf Wars is REVERSIBLE and COSMETIC by construction. An attack outcome produces *scorch*,
 * recorded as a SEPARATE overlay keyed by structure id — never a mutation of the defender's signed base
 * snapshot, never a transfer of structures or counters, never a deletion. Scorch is bounded per
 * structure and SELF-HEALS: it decays to zero over ticks, so no attack can ever permanently destroy or
 * drain a block. These are the hard invariants of the design; they hold independently of the open
 * settlement decisions (O1 seed, O2 fraud-proof liveness), so they are built here.
 *
 * All functions are PURE and IMMUTABLE — they return new overlays and never mutate their inputs (so the
 * base snapshot object a caller holds can never be touched through this module).
 */

export const SCORCH_CAP = 100;            // max cosmetic scorch on any one structure
export const SCORCH_DECAY_PER_TICK = 10;  // self-heal rate — scorch always trends back to zero

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** PURE: an empty scorch overlay. */
export function emptyScorch() {
  return {};
}

/**
 * PURE: apply an attack outcome's per-structure scorch to an overlay, returning a NEW overlay. Each
 * structure's scorch is clamped to [0, SCORCH_CAP]; the input overlay and the outcome are not mutated.
 * `outcomeScorch` is a plain map { structure_id: amount } (the `scorch` field of a simulator outcome).
 */
export function applyScorch(overlay, outcomeScorch) {
  const next = { ...(overlay || {}) };
  for (const id of Object.keys(outcomeScorch || {})) {
    const add = Number(outcomeScorch[id]) || 0;
    const total = clamp((next[id] || 0) + add, 0, SCORCH_CAP);
    if (total > 0) next[id] = total; else delete next[id];
  }
  return next;
}

/**
 * PURE: decay every scorch value toward zero by SCORCH_DECAY_PER_TICK per tick, returning a NEW overlay.
 * Entries that reach zero are removed — so a block always fully heals given enough quiet ticks.
 */
export function decayScorch(overlay, ticks = 1) {
  const t = Math.max(0, Math.floor(ticks));
  const next = {};
  for (const id of Object.keys(overlay || {})) {
    const v = clamp((overlay[id] || 0) - SCORCH_DECAY_PER_TICK * t, 0, SCORCH_CAP);
    if (v > 0) next[id] = v;
  }
  return next;
}

/** PURE: total ticks needed for an overlay to fully self-heal back to empty. */
export function ticksToHeal(overlay) {
  let max = 0;
  for (const id of Object.keys(overlay || {})) max = Math.max(max, overlay[id] || 0);
  return Math.ceil(max / SCORCH_DECAY_PER_TICK);
}

/** PURE: invariant — every scorch value is an integer-ish number within [0, SCORCH_CAP]. */
export function scorchBoundsHold(overlay) {
  for (const id of Object.keys(overlay || {})) {
    const v = overlay[id];
    if (typeof v !== 'number' || v < 0 || v > SCORCH_CAP) return false;
  }
  return true;
}
