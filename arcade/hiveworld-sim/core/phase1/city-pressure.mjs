/**
 * HiveWorld v1.1 — non-authoritative block "pressure" / mood (mirror of product Phase 4D
 * `arcade/city/city-scheduler.mjs`, the Hive Scheduler).
 *
 * PURE, deterministic, and DELIBERATELY NON-AUTHORITATIVE: pressure is a display-only atmosphere
 * derived from recent public activity + current population. It grants nothing, moves no one, and NO
 * reducer reads it back as authority (host rank derives FROM it; nothing acts ON it). No economy.
 */
export const PRESSURE_MOODS = Object.freeze(['dormant', 'calm', 'lively', 'surging']);

/** A small activity-weight table — purely for a deterministic, bounded "buzz" score. */
const ACTIVITY_WEIGHT = Object.freeze({
  city_block_arrived: 2,
  city_route_confirmed: 1,
  city_route_requested: 1,
  city_block_trial_opened: 2,
  city_block_trial_completed: 3,
  city_stewardship_applied: 1,
  city_player_joined: 1,
});

/**
 * PURE: derive a block's pressure snapshot from recent world-log entries (for that block) + its
 * current population. Bounded, deterministic. Returns { mood, score, population } — display only.
 */
export function derivePressure({ recentEvents = [], population = 0 } = {}) {
  let buzz = 0;
  for (const e of recentEvents) buzz += ACTIVITY_WEIGHT[e && e.type] || 0;
  const pop = Math.max(0, Math.floor(Number(population) || 0));
  const score = Math.min(100, buzz * 4 + pop * 3); // bounded 0..100, deterministic
  let mood;
  if (score >= 60) mood = 'surging';
  else if (score >= 30) mood = 'lively';
  else if (score >= 8) mood = 'calm';
  else mood = 'dormant';
  return { mood, score, population: pop };
}

/** True if two pressure snapshots are equal (so the fold can avoid no-op churn). */
export function pressureEqual(a, b) {
  if (!a || !b) return false;
  return a.mood === b.mood && a.score === b.score && a.population === b.population;
}
