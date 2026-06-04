/**
 * Neon Circuit — City Host Rank v0 (Phase 4E), PURE.
 *
 * A deterministic, NON-CASH, block/city-scoped reputation signal. It reads recent
 * SERVER-AUTHORED city events + the scheduler-reviewed pressure snapshot and derives a
 * bounded, DISPLAY-ONLY "support" standing for the block. It is reputation/atmosphere
 * only — it is NOT:
 *   money / cash value / token / NFT / staking / yield / resale / ownership /
 *   account identity / transferable good / marketplace reputation / paid hosting /
 *   server-rental payout / persistent global profile.
 * It grants nothing, moves no one, and touches no collision/portal/economy state.
 *
 * Scope: one signal per city BLOCK (collective recent support standing), parallel to
 * city pressure. Per-player host attribution is deferred (4F) — there is no account or
 * persistent player profile here. The seam future phases read from; none built here.
 *
 * Imported by the CityRoom DO, the city dev shim, the unit tests, and the browser.
 */
import { SCHEMA_VERSION } from './city-block.mjs';

/** Recent-activity window used to classify support (ms) — matches the scheduler window. */
export const WINDOW_MS = 60_000;
/** The (bounded) display gauge ceiling. Non-cash, non-cumulative. */
export const SCORE_CAP = 100;

/** Server-authored event types that signal block support, with their weights. */
const SUPPORT_WEIGHTS = Object.freeze({
  city_portal_enter_accepted: 10,
  city_arcade_interior_opened: 8,
  city_arcade_interior_closed: 4,
  city_player_joined: 6,
});

/** Tier thresholds on the bounded score (display only). */
const TIERS = Object.freeze([
  { tier: 'anchor', min: 75 },
  { tier: 'signaler', min: 45 },
  { tier: 'helper', min: 20 },
  { tier: 'observer', min: 0 },
]);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Scheduler mood → non-cash support signal (the "scheduler-reviewed" tie-in). */
function signalFromMood(mood) {
  if (mood === 'stirring') return 'active';
  if (mood === 'watching') return 'steady';
  return 'quiet';
}

/**
 * PURE: derive a bounded, non-cash Host Rank snapshot. Deterministic for a given
 * { now, recentEvents, schedulerState }. Never mutates inputs; reads only
 * server-authored events + the server's scheduler snapshot (no client field).
 *
 * @returns {{ schema_version, city_id, evaluated_at, host_rank }}
 */
export function evaluateHostRank({ cityId, now = Date.now(), recentEvents = [], schedulerState = null } = {}) {
  const evs = Array.isArray(recentEvents) ? recentEvents : [];
  const inWindow = evs.filter((e) => e && typeof e.type === 'string' && Number.isFinite(e.server_time) && (now - e.server_time) <= WINDOW_MS && (now - e.server_time) >= 0);
  const count = (type) => inWindow.reduce((n, e) => (e.type === type ? n + 1 : n), 0);

  const portalAccepted = count('city_portal_enter_accepted');
  const interiorN = count('city_arcade_interior_opened') + count('city_arcade_interior_closed');
  const joins = count('city_player_joined');

  let score = 0;
  for (const e of inWindow) score += SUPPORT_WEIGHTS[e.type] || 0;

  const pressure = schedulerState && schedulerState.pressure ? schedulerState.pressure : null;
  const mood = pressure ? pressure.scheduler_mood : 'stable';
  if (mood === 'stirring') score += 20;
  else if (mood === 'watching') score += 10;
  score = clamp(Math.round(score), 0, SCORE_CAP);

  const tier = (TIERS.find((t) => score >= t.min) || TIERS[TIERS.length - 1]).tier;
  const support_signal = signalFromMood(mood);

  const reasons = [];
  if (portalAccepted > 0) reasons.push('portal_presence');
  if (interiorN > 0) reasons.push('interior_support');
  if ((pressure && pressure.presence === 'busy') || joins >= 3) reasons.push('sustained_presence');
  if (mood === 'watching' || mood === 'stirring') reasons.push('scheduler_active');

  return {
    schema_version: SCHEMA_VERSION,
    city_id: (typeof cityId === 'string' && cityId) ? cityId : 'city',
    evaluated_at: now,
    host_rank: { tier, score, score_cap: SCORE_CAP, support_signal, reasons: reasons.slice(0, 3), public_safe: true },
  };
}

/** PURE: have the headline-display fields (tier / support / reasons) changed? */
export function hostRankChanged(prev, next) {
  if (!prev || !prev.host_rank) return true;
  const a = prev.host_rank; const b = next.host_rank;
  return a.tier !== b.tier || a.support_signal !== b.support_signal
    || a.reasons.join(',') !== b.reasons.join(',');
}

/** PURE: has the tier or support signal changed (the "changed" headline event)? */
export function hostRankTierChanged(prev, next) {
  if (!prev || !prev.host_rank) return true;
  return prev.host_rank.tier !== next.host_rank.tier || prev.host_rank.support_signal !== next.host_rank.support_signal;
}

/** PURE: the fully-idle baseline (observer / quiet / no reasons), so a cold-start eval
 *  logs no "news" for an empty block. */
export function isBaselineHostRank(snapshot) {
  const h = snapshot && snapshot.host_rank;
  return !!h && h.tier === 'observer' && h.support_signal === 'quiet' && h.reasons.length === 0;
}

/** PURE: public-safe wire payload for the current Host Rank state (display only). */
export function hostRankStatePayload(snapshot) {
  const h = (snapshot && snapshot.host_rank) ? snapshot.host_rank : { tier: 'observer', score: 0, score_cap: SCORE_CAP, support_signal: 'quiet', reasons: [] };
  return {
    schema_version: SCHEMA_VERSION,
    city_id: snapshot ? snapshot.city_id : 'city',
    evaluated_at: snapshot ? snapshot.evaluated_at : Date.now(),
    host_rank: { tier: h.tier, score: h.score, score_cap: h.score_cap, support_signal: h.support_signal, reasons: [...h.reasons], public_safe: true },
  };
}
