/**
 * Challenge Board authority — PURE, runtime-agnostic (Phase 1h).
 *
 * Server-authoritative challenges that give players a reason to keep playing
 * without any money mechanics. Progress is driven ONLY by authoritative server
 * events (accepted rounds, ticket awards, redemptions) — a client can never
 * force progress or completion, supply a reward amount, or grant itself a badge.
 *
 * Rewards are internal-only: a session-bound achievement badge (via
 * ./achievements.mjs, reusing the Phase 1f inventory) and/or a small,
 * server-computed arcade-ticket award. No money, no transferable value. See
 * docs/NEON_CIRCUIT_PHASE1H_CHALLENGE_BOARD.md for scope + non-goals.
 */
import { grantAchievement } from './achievements.mjs';
import { appendLedger } from './ledger.mjs';

/** Signal Sprint "clean run" noise ceiling. */
export const CLEAN_NOISE_MAX = 3;

/**
 * Challenge catalog. `criteria.metric` is computed from per-session counters the
 * server maintains; `reward` is internal-only (achievement badge and/or a small
 * server-computed ticket award). `marathon-soon` is a disabled placeholder.
 */
export const CHALLENGES = Object.freeze([
  { challenge_id: 'pulse-rookie',     display_name: 'Pulse Rookie',     description: 'Complete one Pulse Tap round.',                                  challenge_type: 'play',     scope: 'session', criteria: { metric: 'pulseRounds', target: 1 },                              reward: { achievement_id: 'pulse-rookie',    ticket_bonus: 0 }, repeatable: false, enabled: true,  public_safe: true, sort_order: 1 },
  { challenge_id: 'first-signal',     display_name: 'First Signal',     description: 'Complete one Signal Sprint round.',                              challenge_type: 'play',     scope: 'session', criteria: { metric: 'signalRounds', target: 1 },                             reward: { achievement_id: null,              ticket_bonus: 5 }, repeatable: false, enabled: true,  public_safe: true, sort_order: 2 },
  { challenge_id: 'two-cabinet-tour', display_name: 'Two Cabinet Tour', description: 'Complete a Pulse Tap round and a Signal Sprint round this session.', challenge_type: 'play',  scope: 'session', criteria: { metric: 'bothCabinets', target: 2 },                             reward: { achievement_id: 'circuit-tourist', ticket_bonus: 0 }, repeatable: false, enabled: true,  public_safe: true, sort_order: 3 },
  { challenge_id: 'signal-clean-run', display_name: 'Clean Signal',     description: `Finish a Signal Sprint round with ${CLEAN_NOISE_MAX} or fewer noise hits.`, challenge_type: 'skill', scope: 'session', criteria: { metric: 'signalCleanRounds', target: 1, maxNoise: CLEAN_NOISE_MAX }, reward: { achievement_id: 'clean-signal', ticket_bonus: 0 }, repeatable: false, enabled: true,  public_safe: true, sort_order: 4 },
  { challenge_id: 'first-redemption', display_name: 'Counter Regular',  description: 'Redeem any item at the Prize Counter.',                          challenge_type: 'loop',     scope: 'session', criteria: { metric: 'redemptions', target: 1 },                              reward: { achievement_id: 'counter-regular', ticket_bonus: 0 }, repeatable: false, enabled: true,  public_safe: true, sort_order: 5 },
  { challenge_id: 'ticket-starter',   display_name: 'Ticket Starter',   description: 'Earn at least 25 arcade tickets this session.',                  challenge_type: 'progress', scope: 'session', criteria: { metric: 'ticketsEarned', target: 25 },                           reward: { achievement_id: 'ticket-starter',  ticket_bonus: 0 }, repeatable: false, enabled: true,  public_safe: true, sort_order: 6 },
  { challenge_id: 'marathon-soon',    display_name: 'Marathon',         description: 'Coming soon.',                                                   challenge_type: 'progress', scope: 'session', criteria: { metric: 'pulseRounds', target: 50 },                             reward: { achievement_id: null,              ticket_bonus: 0 }, repeatable: false, enabled: false, public_safe: true, sort_order: 99 },
]);

export function getChallenge(id) {
  return CHALLENGES.find((c) => c.challenge_id === id) || null;
}

/** Public catalog — enabled challenges only, deep-cloned for determinism. */
export function challengeCatalogPayload() {
  return {
    challenges: CHALLENGES.filter((c) => c.enabled).map((c) => ({
      ...c, criteria: { ...c.criteria }, reward: { ...c.reward },
    })),
  };
}

function emptyStats() {
  return { pulseRounds: 0, signalRounds: 0, signalCleanRounds: 0, redemptions: 0, ticketsEarned: 0 };
}

function metricValue(stats, challenge) {
  const m = challenge.criteria.metric;
  if (m === 'bothCabinets') return (stats.pulseRounds > 0 ? 1 : 0) + (stats.signalRounds > 0 ? 1 : 0);
  return stats[m] || 0;
}

/** Owner-only progress snapshot for every enabled challenge. */
export function getProgress(state, playerId) {
  const stats = state.challengeStats[playerId] || emptyStats();
  const stored = state.challengeProgress[playerId] || {};
  return CHALLENGES.filter((c) => c.enabled).map((c) => {
    const target = c.criteria.target;
    const v = metricValue(stats, c);
    const s = stored[c.challenge_id] || {};
    return {
      challenge_id: c.challenge_id,
      progress: Math.min(target, v),
      target,
      completed: !!s.completed || v >= target,
      completed_at: s.completed_at || null,
      reward_claimed: !!s.reward_claimed,
    };
  });
}

/**
 * Apply a stats mutation for one player, then re-evaluate every enabled
 * challenge. Returns the new state plus the list of challenges that JUST became
 * complete (for emitting challenge_completed + a public feed event).
 */
function applyStats(state, playerId, mutate, now) {
  const stats = { ...(state.challengeStats[playerId] || emptyStats()) };
  mutate(stats);
  const challengeStats = { ...state.challengeStats, [playerId]: stats };

  const prev = state.challengeProgress[playerId] || {};
  const progress = { ...prev };
  const newlyCompleted = [];
  for (const c of CHALLENGES) {
    if (!c.enabled) continue;
    const target = c.criteria.target;
    const v = metricValue(stats, c);
    const wasCompleted = !!(prev[c.challenge_id] && prev[c.challenge_id].completed);
    const nowCompleted = v >= target;
    progress[c.challenge_id] = {
      challenge_id: c.challenge_id,
      progress: Math.min(target, v),
      target,
      completed: wasCompleted || nowCompleted,
      completed_at: (prev[c.challenge_id] && prev[c.challenge_id].completed_at) || (nowCompleted ? now : null),
      reward_claimed: !!(prev[c.challenge_id] && prev[c.challenge_id].reward_claimed),
      reward_granted: !!(prev[c.challenge_id] && prev[c.challenge_id].reward_granted),
    };
    if (!wasCompleted && nowCompleted) newlyCompleted.push(c);
  }
  const challengeProgress = { ...state.challengeProgress, [playerId]: progress };
  return { state: { ...state, challengeStats, challengeProgress }, newlyCompleted };
}

/** Authoritative: an accepted round bumps round counters + tickets earned. */
export function recordRoundAccepted(state, { playerId, cabinetType, noiseHits, awarded, now }) {
  return applyStats(state, playerId, (s) => {
    if (cabinetType === 'pulse_tap') s.pulseRounds += 1;
    else if (cabinetType === 'signal_sprint') {
      s.signalRounds += 1;
      if (Number.isInteger(noiseHits) && noiseHits <= CLEAN_NOISE_MAX) s.signalCleanRounds += 1;
    }
    s.ticketsEarned += Math.max(0, awarded || 0);
  }, now);
}

/** Authoritative: an accepted prize redemption bumps the redemption counter. */
export function recordRedemption(state, { playerId, now }) {
  return applyStats(state, playerId, (s) => { s.redemptions += 1; }, now);
}

/**
 * Claim a completed challenge's reward. Server-authoritative: validates the
 * challenge exists + is enabled + completed + not already claimed, then grants
 * the badge and/or a server-computed ticket bonus. Any client-supplied reward
 * amount or badge ownership is ignored entirely.
 */
export function claimReward(state, { playerId, challengeId, now }) {
  if (typeof challengeId !== 'string' || !challengeId) return { state, ok: false, reason: 'malformed' };
  if (!playerId) return { state, ok: false, reason: 'no_identity' };
  const challenge = getChallenge(challengeId);
  if (!challenge) return { state, ok: false, reason: 'unknown_challenge' };
  if (!challenge.enabled) return { state, ok: false, reason: 'challenge_disabled' };
  const entry = state.challengeProgress[playerId] && state.challengeProgress[playerId][challengeId];
  if (!entry || !entry.completed) return { state, ok: false, reason: 'not_completed' };
  if (entry.reward_claimed) return { state, ok: false, reason: 'already_claimed' };

  let next = state;
  let badge = null;
  let achievement = null;
  let ticketBonus = 0;
  let balance = next.balances[playerId] || 0;

  // 1) achievement badge reward (reuses the Phase 1f inventory; idempotent)
  if (challenge.reward.achievement_id) {
    const g = grantAchievement(next, { playerId, achievementId: challenge.reward.achievement_id, now });
    next = g.state;
    achievement = g.achievement || null;
    if (g.granted) badge = g.badge || null;
  }

  // 2) small ticket bonus — server-computed from the catalog, never the client
  const bonus = Math.max(0, Math.floor(challenge.reward.ticket_bonus || 0));
  if (bonus > 0) {
    balance = (next.balances[playerId] || 0) + bonus;
    ticketBonus = bonus;
    next = { ...next, balances: { ...next.balances, [playerId]: balance } };
    next = appendLedger(next, {
      playerId, eventType: 'challenge_reward', delta: bonus, balanceAfter: balance,
      source: 'challenge', refId: `claim:${challengeId}`, cabinetId: null, cabinetType: null,
      summary: `challenge reward: ${challenge.display_name}`, now,
    }).state;
  }

  // 3) mark claimed (non-repeatable challenges cannot be re-claimed)
  const prevEntry = next.challengeProgress[playerId][challengeId];
  const updated = { ...prevEntry, reward_claimed: true, reward_granted: true };
  next = {
    ...next,
    challengeProgress: { ...next.challengeProgress, [playerId]: { ...next.challengeProgress[playerId], [challengeId]: updated } },
  };

  return { state: next, ok: true, reason: null, challenge, badge, achievement, ticketBonus, balance };
}
