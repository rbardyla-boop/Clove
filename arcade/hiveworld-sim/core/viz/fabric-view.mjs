/**
 * HiveWorld v1.3 — Sideband / radio-fabric VIEW-MODELS (read-only diagnostic lens).
 *
 * PURE, deterministic. These functions DERIVE renderable view-models from data the simulator ALREADY
 * produces — the report, the canonical log, the folded state, and the SIDEBANDS registry. v1.3 is a LENS,
 * not a mechanism: NOTHING here adds an event, a reducer, authority, or any fold/cadence behaviour. The
 * prefix-replay below RE-FOLDS canonical prefixes read-only (it never mutates the live sim).
 *
 * Public-safety: the rejected/stripped view-model surfaces REASONS + COUNTS + the sideband only — never a
 * stripped private value. No economy/ownership. The "radio/sideband" naming is the existing metaphor only;
 * there is no real RF here.
 */
import { SIDEBANDS, SIDEBAND_NAMES } from '../sidebands.mjs';
import { SidebandCRDTLog } from '../log.mjs';
import { fold } from '../world.mjs';
import { CITY_IDS } from '../phase1/city-blocks.mjs';
import { ALARM_INTERVAL_TICKS } from '../phase1/district-presence-push.mjs';

const num = (v) => (Number.isFinite(v) ? v : 0);
const popOf = (summary) => (summary ? num(summary.population) : 0);

/** Read-only: ingest a raw event list into a FRESH canonical log (dedupe + canonical order). */
function freshLog(events) {
  const log = new SidebandCRDTLog();
  for (const ev of Array.isArray(events) ? events : []) log.ingest(ev);
  return log;
}

// ── 1. SIDEBAND CHANNELS ─────────────────────────────────────────────────────────
/** PURE: per-sideband channel summary (stable order), from SIDEBANDS + report traffic + the event log. */
export function sidebandChannels(report) {
  const traffic = (report && report.sidebandTraffic) || {};
  const evlog = (report && report.eventLog) || [];
  return SIDEBAND_NAMES.map((name) => {
    const recent = evlog.filter((e) => e.sideband === name).slice(-3).map((e) => e.type);
    return {
      name,
      klass: SIDEBANDS[name].klass,
      persistent: SIDEBANDS[name].persistent,
      traffic: num(traffic[name]),
      recent_types: recent,
    };
  });
}

// ── 2. PUSHED-VIEW TIMELINE (fold-prefix replay) ─────────────────────────────────
/**
 * PURE, read-only: re-fold canonical PREFIXES to capture, at each tick boundary, the registry population
 * per block and each block's PUSHED-view population of every block — so the cadence (same-block immediate
 * vs cross-block alarm-bound) is visible over time. Bounded to `maxSnapshots` tick boundaries.
 */
export function pushedViewTimeline(events, { maxSnapshots = 16 } = {}) {
  const ordered = freshLog(events).ordered();
  const ticks = [...new Set(ordered.map((e) => e.logical_tick))].sort((a, b) => a - b);
  const chosen = ticks.length <= maxSnapshots
    ? ticks
    : ticks.filter((_, i) => i % Math.ceil(ticks.length / maxSnapshots) === 0).concat(ticks[ticks.length - 1]);
  const frames = [];
  for (const T of [...new Set(chosen)]) {
    const prefix = ordered.filter((e) => e.logical_tick <= T);
    const d = fold(prefix).state.district;
    const registry = {};
    for (const id of CITY_IDS) registry[id] = popOf(d.blocks[id] && { population: d.blocks[id].population });
    const pushed = {};
    for (const viewer of CITY_IDS) {
      const view = d.pushedView[viewer] || {};
      pushed[viewer] = {};
      for (const block of CITY_IDS) pushed[viewer][block] = view[block] ? popOf(view[block]) : null;
    }
    frames.push({ tick: T, registry, pushed });
  }
  return frames;
}

// ── 3. PROPAGATION TRACE ─────────────────────────────────────────────────────────
/**
 * PURE: for `targetCityId`, the tick its FINAL registry population was first reached, vs the tick each
 * block's pushed view reflected it — labelling immediate (same-block) vs delayed (cross-block, ~one alarm).
 */
export function propagationTrace(events, targetCityId) {
  const frames = pushedViewTimeline(events, { maxSnapshots: 64 });
  if (!frames.length) return { target: targetCityId, change_tick: null, by_viewer: {} };
  const finalPop = frames[frames.length - 1].registry[targetCityId];
  let changeTick = null;
  for (const f of frames) { if (f.registry[targetCityId] === finalPop) { changeTick = f.tick; break; } }
  const byViewer = {};
  for (const viewer of CITY_IDS) {
    let reflectedTick = null;
    for (const f of frames) { if (f.pushed[viewer][targetCityId] === finalPop) { reflectedTick = f.tick; break; } }
    const kind = viewer === targetCityId ? 'immediate' : 'delayed';
    byViewer[viewer] = {
      reflected_tick: reflectedTick,
      lag: reflectedTick != null && changeTick != null ? reflectedTick - changeTick : null,
      kind: reflectedTick == null ? 'pending' : kind,
      alarm_interval: ALARM_INTERVAL_TICKS,
    };
  }
  return { target: targetCityId, final_population: finalPop, change_tick: changeTick, by_viewer: byViewer };
}

// ── 4. ACTIVITY BY SIDEBAND ──────────────────────────────────────────────────────
const ACTIVITY_SIDEBAND = Object.freeze({
  block_became_active: 'presence', block_became_empty: 'presence', block_population_changed: 'presence',
  block_health_changed: 'presence', block_presence_stale: 'presence', block_presence_restored: 'presence',
  route_requested: 'event_log', route_confirmed: 'event_log', route_rejected: 'event_log', block_arrived: 'event_log',
});
/** PURE: the public-safe activity labels grouped by the sideband whose events drive them. */
export function activityBySideband(report) {
  const activity = (report && report.finalWorldState && report.finalWorldState.district && report.finalWorldState.district.activity) || [];
  const out = {};
  for (const item of activity) {
    const sb = ACTIVITY_SIDEBAND[item.type] || 'event_log';
    (out[sb] = out[sb] || []).push(item.label);
  }
  return out;
}

// ── 5. CONVERGENCE / REPLAY ──────────────────────────────────────────────────────
/** Read-only: the canonical fingerprint + proof that arrival vs canonical vs reversed vs duplicated all
 *  fold to the SAME fingerprint (the convergence guarantee, made visible). */
export function convergenceDemo(events) {
  const fp = (arr) => fold(freshLog(arr).ordered()).fingerprint;
  const arr = Array.isArray(events) ? events : [];
  const canonical = fp(arr);
  const reversed = fp([...arr].reverse());
  const duplicated = fp([...arr, ...arr]);
  return {
    fingerprint: canonical,
    reversed_fingerprint: reversed,
    duplicated_fingerprint: duplicated,
    stable_under_reorder: canonical === reversed,
    stable_under_duplicate: canonical === duplicated,
  };
}

// ── 6. REJECTED / STRIPPED (public-safe: reasons + counts only) ───────────────────
/**
 * PURE: dropped/rejected events grouped by phase (ingest vs apply) + reason + sideband, as COUNTS only.
 * It NEVER surfaces a stripped private value — only the machine reason, the phase, and the sideband.
 */
export function rejectedSummary(report) {
  const rejected = (report && report.rejectedEvents) || [];
  const groups = new Map();
  for (const r of rejected) {
    const phase = r.phase || (r.summary ? 'apply' : 'ingest');
    const reason = r.reason || 'unknown';
    const sideband = (r.summary && r.summary.sideband) || r.sideband || null;
    const key = `${phase}|${reason}|${sideband || '-'}`;
    const g = groups.get(key) || { phase, reason, sideband, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => (a.phase + a.reason).localeCompare(b.phase + b.reason));
}

/** Convenience: all six view-models for a (report, events) pair. */
export function fabricView(report, events) {
  return {
    channels: sidebandChannels(report),
    timeline: pushedViewTimeline(events),
    activity_by_sideband: activityBySideband(report),
    convergence: convergenceDemo(events),
    rejected: rejectedSummary(report),
  };
}
