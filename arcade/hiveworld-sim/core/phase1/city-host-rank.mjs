/**
 * HiveWorld v1.1 — NON-CASH block Host Rank (mirror of product Phase 4E
 * `arcade/city/city-host-rank.mjs`).
 *
 * PURE, deterministic. A reputation tier + support-signal derived from recent public activity and the
 * (display-only) pressure. It is EXPLICITLY NOT money: there is no credit, balance, payout, or any
 * economic field anywhere in this module — only a tier label, a support signal, and a bounded score.
 * Stewardship eligibility keys off the tier (a display-edit right, not an economic effect).
 */
export const HOST_TIERS = Object.freeze(['observer', 'regular', 'host', 'steward']);
export const SUPPORT_SIGNALS = Object.freeze(['quiet', 'warm', 'strong']);

const CONTRIB_WEIGHT = Object.freeze({
  city_block_trial_completed: 4,
  city_block_trial_opened: 2,
  city_stewardship_applied: 2,
  city_route_confirmed: 1,
  city_block_arrived: 1,
});

/**
 * PURE: derive a NON-CASH host-rank snapshot for a block from recent world-log entries + pressure.
 * Returns { tier, support_signal, score, score_cap } — no economic field. Deterministic + bounded.
 */
export function deriveHostRank({ recentEvents = [], pressure = null } = {}) {
  let score = 0;
  for (const e of recentEvents) score += CONTRIB_WEIGHT[e && e.type] || 0;
  const moodBonus = pressure && (pressure.mood === 'surging' ? 3 : pressure.mood === 'lively' ? 2 : pressure.mood === 'calm' ? 1 : 0);
  score = Math.min(40, score + (moodBonus || 0));
  let tier;
  if (score >= 24) tier = 'steward';
  else if (score >= 14) tier = 'host';
  else if (score >= 6) tier = 'regular';
  else tier = 'observer';
  const support_signal = score >= 18 ? 'strong' : score >= 8 ? 'warm' : 'quiet';
  return { tier, support_signal, score, score_cap: 40 };
}

/** True if two host-rank snapshots are equal. */
export function hostRankEqual(a, b) {
  if (!a || !b) return false;
  return a.tier === b.tier && a.support_signal === b.support_signal && a.score === b.score;
}
