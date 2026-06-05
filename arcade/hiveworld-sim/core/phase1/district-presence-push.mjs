/**
 * HiveWorld v1.2 — district presence PUSH CADENCE (mirror of product Phase 5C/5D/5E timing).
 *
 * PURE, deterministic. v1.0 folds a CONVERGED registry aggregate (state.district.blocks). v1.2 adds the
 * TIMED, PARTIAL view: what each block has PUSHED to its clients. Two cadences mirror the product:
 *   - SAME-block change  → that block's own pushed entry updates IMMEDIATELY (5D same-block immediacy).
 *   - CROSS-block change → reaches another block's pushed view only when THAT block's ALARM fires
 *                          (5D 30s-alarm bound) — modelled here as ALARM_INTERVAL_TICKS.
 * No-ghost leave: the registry drops to 0 at once; other blocks reflect 0 within one alarm.
 *
 * The pushed view + alarms are pure functions of the canonically-ordered log, so delayed / duplicated /
 * out-of-order cadence events fold to the same fingerprint. No economy/ownership; public-safe summaries.
 */
import { CITY_IDS } from './city-blocks.mjs';
import { publicBlockSummary } from './district.mjs';

/** The 30s-alarm analog on the sim's tick clock. Cross-block lag is bounded by this. */
export const ALARM_INTERVAL_TICKS = 30;

/** PURE: is `tick` an alarm boundary for a block with the given phase offset? (testbed countdown helper) */
export function isAlarmTick(tick, offset = 0) {
  const n = Math.floor(tick) - Math.floor(offset);
  return n >= 0 && n % ALARM_INTERVAL_TICKS === 0;
}

/** PURE: ticks remaining until the next alarm boundary for a block at `offset`. */
export function ticksToNextAlarm(tick, offset = 0) {
  const n = ((Math.floor(tick) - Math.floor(offset)) % ALARM_INTERVAL_TICKS + ALARM_INTERVAL_TICKS) % ALARM_INTERVAL_TICKS;
  return n === 0 ? 0 : ALARM_INTERVAL_TICKS - n;
}

/**
 * PURE: a full snapshot of every block's PUBLIC-SAFE summary from the registry aggregate at `nowTick`.
 * This is what a block pushes to its clients when its alarm fires (its refreshed cross-block view).
 */
export function snapshotAllBlocks(registry, nowTick = 0) {
  const reg = registry && typeof registry === 'object' ? registry : {};
  const snap = {};
  for (const id of CITY_IDS) snap[id] = publicBlockSummary(id, reg[id] || null, nowTick);
  return snap;
}

/** True if two public block summaries differ on a live field (population / health). */
function summaryDiffers(a, b) {
  if (!a || !b) return !!a !== !!b;
  return (Number(a.population) || 0) !== (Number(b.population) || 0) || a.health !== b.health;
}

/**
 * PURE: the bounded list of block ids whose summary changed between a block's PRIOR pushed view and its
 * NEXT pushed view (i.e. what its clients just learned about on this alarm). Sorted; ≤ CITY_IDS.length.
 * Never mutates inputs.
 */
export function diffPushedView(prev, next) {
  const p = prev && typeof prev === 'object' ? prev : {};
  const n = next && typeof next === 'object' ? next : {};
  const changed = [];
  for (const id of CITY_IDS) {
    if (n[id] && summaryDiffers(p[id], n[id])) changed.push(id);
  }
  return changed.sort();
}
