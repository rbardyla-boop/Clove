/**
 * Phase 1h/1l Challenge Board + achievements — SIMULATOR-LOCAL PORT of
 * workers/arcade/src/{challenges,achievements}.mjs.
 *
 * Pure helpers over an `arcade` state slice ({ balances, ledger, inventory,
 * challengeStats, challengeProgress, achievements }). Progress is driven ONLY by
 * authoritative accepted rounds / redemptions (the round-authority reducer calls
 * these). Rewards are internal-only — a session-bound badge and/or a small
 * server-computed ticket bonus. No money, no transferable value.
 */
import { appendLedger } from './ledger.mjs';

export const CLEAN_NOISE_MAX = 3;  // Signal Sprint clean-run ceiling
export const CLEAN_GRID_MAX = 2;   // Neon Grid clean-grid ceiling

export const CHALLENGES = Object.freeze([
  { challenge_id: 'pulse-rookie',       display_name: 'Pulse Rookie',     description: 'Complete one Pulse Tap round.',                        metric: 'pulseRounds',      target: 1,  reward: { achievement_id: 'pulse-rookie',    ticket_bonus: 0 }, enabled: true },
  { challenge_id: 'first-signal',       display_name: 'First Signal',     description: 'Complete one Signal Sprint round.',                    metric: 'signalRounds',     target: 1,  reward: { achievement_id: null,              ticket_bonus: 5 }, enabled: true },
  { challenge_id: 'two-cabinet-tour',   display_name: 'Two Cabinet Tour', description: 'Complete a Pulse Tap and a Signal Sprint round.',      metric: 'bothCabinets',     target: 2,  reward: { achievement_id: 'circuit-tourist', ticket_bonus: 0 }, enabled: true },
  { challenge_id: 'signal-clean-run',   display_name: 'Clean Signal',     description: `Finish Signal Sprint with ${CLEAN_NOISE_MAX} or fewer noise hits.`, metric: 'signalCleanRounds', target: 1, maxNoise: CLEAN_NOISE_MAX, reward: { achievement_id: 'clean-signal', ticket_bonus: 0 }, enabled: true },
  { challenge_id: 'first-redemption',   display_name: 'Counter Regular',  description: 'Redeem any item at the Prize Counter.',                metric: 'redemptions',      target: 1,  reward: { achievement_id: 'counter-regular', ticket_bonus: 0 }, enabled: true },
  { challenge_id: 'ticket-starter',     display_name: 'Ticket Starter',   description: 'Earn at least 25 arcade tickets.',                     metric: 'ticketsEarned',    target: 25, reward: { achievement_id: 'ticket-starter',  ticket_bonus: 0 }, enabled: true },
  // Phase 1l additions
  { challenge_id: 'grid-rookie',        display_name: 'Grid Rookie',      description: 'Complete one Neon Grid round.',                        metric: 'gridRounds',       target: 1,  reward: { achievement_id: 'grid-rookie',     ticket_bonus: 0 }, enabled: true },
  { challenge_id: 'clean-grid',         display_name: 'Clean Grid',       description: `Finish Neon Grid with ${CLEAN_GRID_MAX} or fewer mistakes.`, metric: 'gridCleanRounds', target: 1, maxMistakes: CLEAN_GRID_MAX, reward: { achievement_id: 'clean-grid', ticket_bonus: 0 }, enabled: true },
  { challenge_id: 'three-cabinet-tour', display_name: 'Three Cabinet Tour', description: 'Complete Pulse Tap, Signal Sprint and Neon Grid.',    metric: 'allCabinets',      target: 3,  reward: { achievement_id: 'circuit-voyager', ticket_bonus: 0 }, enabled: true },
]);

export const ACHIEVEMENTS = Object.freeze([
  { achievement_id: 'pulse-rookie',    display_name: 'Pulse Rookie',    badge_cosmetic_id: 'badge-pulse-rookie',    equip_slot: 'badge', public_safe_summary: 'unlocked Pulse Rookie' },
  { achievement_id: 'circuit-tourist', display_name: 'Circuit Tourist', badge_cosmetic_id: 'badge-circuit-tourist', equip_slot: 'badge', public_safe_summary: 'unlocked Circuit Tourist' },
  { achievement_id: 'clean-signal',    display_name: 'Clean Signal',    badge_cosmetic_id: 'badge-clean-signal',    equip_slot: 'badge', public_safe_summary: 'unlocked Clean Signal' },
  { achievement_id: 'counter-regular', display_name: 'Counter Regular', badge_cosmetic_id: 'badge-counter-regular', equip_slot: 'badge', public_safe_summary: 'unlocked Counter Regular' },
  { achievement_id: 'ticket-starter',  display_name: 'Ticket Starter',  badge_cosmetic_id: 'badge-ticket-starter',  equip_slot: 'badge', public_safe_summary: 'unlocked Ticket Starter' },
  { achievement_id: 'grid-rookie',     display_name: 'Grid Rookie',     badge_cosmetic_id: 'badge-grid-rookie',     equip_slot: 'badge', public_safe_summary: 'unlocked Grid Rookie' },
  { achievement_id: 'clean-grid',      display_name: 'Clean Grid',      badge_cosmetic_id: 'badge-clean-grid',      equip_slot: 'badge', public_safe_summary: 'unlocked Clean Grid' },
  { achievement_id: 'circuit-voyager', display_name: 'Circuit Voyager', badge_cosmetic_id: 'badge-circuit-voyager', equip_slot: 'badge', public_safe_summary: 'unlocked Circuit Voyager' },
]);

export function getChallenge(id) { return CHALLENGES.find((c) => c.challenge_id === id) || null; }
export function getAchievement(id) { return ACHIEVEMENTS.find((a) => a.achievement_id === id) || null; }

function emptyStats() {
  return { pulseRounds: 0, signalRounds: 0, signalCleanRounds: 0, gridRounds: 0, gridCleanRounds: 0, redemptions: 0, ticketsEarned: 0 };
}
function metricValue(stats, c) {
  if (c.metric === 'bothCabinets') return (stats.pulseRounds > 0 ? 1 : 0) + (stats.signalRounds > 0 ? 1 : 0);
  if (c.metric === 'allCabinets') return (stats.pulseRounds > 0 ? 1 : 0) + (stats.signalRounds > 0 ? 1 : 0) + (stats.gridRounds > 0 ? 1 : 0);
  return stats[c.metric] || 0;
}

/** Owner-only progress snapshot for every enabled challenge. */
export function getProgress(arcade, actor) {
  const stats = arcade.challengeStats[actor] || emptyStats();
  const stored = arcade.challengeProgress[actor] || {};
  return CHALLENGES.filter((c) => c.enabled).map((c) => {
    const v = metricValue(stats, c);
    const s = stored[c.challenge_id] || {};
    return { challenge_id: c.challenge_id, progress: Math.min(c.target, v), target: c.target, completed: !!s.completed || v >= c.target, reward_claimed: !!s.reward_claimed };
  });
}

function applyStats(arcade, actor, mutate, tick) {
  const stats = { ...emptyStats(), ...(arcade.challengeStats[actor] || {}) };
  mutate(stats);
  const challengeStats = { ...arcade.challengeStats, [actor]: stats };
  const prev = arcade.challengeProgress[actor] || {};
  const progress = { ...prev };
  const newlyCompleted = [];
  for (const c of CHALLENGES) {
    if (!c.enabled) continue;
    const v = metricValue(stats, c);
    const was = !!(prev[c.challenge_id] && prev[c.challenge_id].completed);
    const now = v >= c.target;
    progress[c.challenge_id] = {
      challenge_id: c.challenge_id, progress: Math.min(c.target, v), target: c.target,
      completed: was || now, completed_at: (prev[c.challenge_id] && prev[c.challenge_id].completed_at) || (now ? tick : null),
      reward_claimed: !!(prev[c.challenge_id] && prev[c.challenge_id].reward_claimed),
    };
    if (!was && now) newlyCompleted.push(c);
  }
  return { arcade: { ...arcade, challengeStats, challengeProgress: { ...arcade.challengeProgress, [actor]: progress } }, newlyCompleted };
}

export function recordRoundAccepted(arcade, { actor, cabinetType, noiseHits, mistakes, awarded, tick }) {
  return applyStats(arcade, actor, (s) => {
    if (cabinetType === 'pulse_tap') s.pulseRounds += 1;
    else if (cabinetType === 'signal_sprint') {
      s.signalRounds += 1;
      if (Number.isInteger(noiseHits) && noiseHits <= CLEAN_NOISE_MAX) s.signalCleanRounds += 1;
    } else if (cabinetType === 'neon_grid') {
      s.gridRounds += 1;
      if (Number.isInteger(mistakes) && mistakes <= CLEAN_GRID_MAX) s.gridCleanRounds += 1;
    }
    s.ticketsEarned += Math.max(0, awarded || 0);
  }, tick);
}

export function recordRedemption(arcade, { actor, tick }) {
  return applyStats(arcade, actor, (s) => { s.redemptions += 1; }, tick);
}

/** Grant an achievement badge (idempotent) into the owner's session inventory. */
export function grantAchievement(arcade, { actor, achievementId, tick }) {
  const a = getAchievement(achievementId);
  if (!a) return { arcade, granted: false, achievement: null, badge: null };
  const owned = arcade.inventory[actor] && arcade.inventory[actor][a.badge_cosmetic_id];
  if (owned) return { arcade, granted: false, achievement: a, badge: owned };
  const badge = { prize_id: a.badge_cosmetic_id, display_name: a.display_name, category: 'badge', equip_slot: a.equip_slot, bound_to: 'session', source: 'achievement', achievement_id: a.achievement_id, granted_at: tick };
  const inventory = { ...arcade.inventory, [actor]: { ...(arcade.inventory[actor] || {}), [a.badge_cosmetic_id]: badge } };
  return { arcade: { ...arcade, inventory }, granted: true, achievement: a, badge };
}

/** Claim a completed challenge's reward. Server-authoritative; client fields ignored. */
export function claimReward(arcade, { actor, challengeId, tick }) {
  if (typeof challengeId !== 'string' || !challengeId) return { arcade, ok: false, reason: 'malformed' };
  if (!actor) return { arcade, ok: false, reason: 'no_identity' };
  const challenge = getChallenge(challengeId);
  if (!challenge) return { arcade, ok: false, reason: 'unknown_challenge' };
  if (!challenge.enabled) return { arcade, ok: false, reason: 'challenge_disabled' };
  const entry = arcade.challengeProgress[actor] && arcade.challengeProgress[actor][challengeId];
  if (!entry || !entry.completed) return { arcade, ok: false, reason: 'not_completed' };
  if (entry.reward_claimed) return { arcade, ok: false, reason: 'already_claimed' };

  let next = arcade;
  let badge = null, achievement = null, ticketBonus = 0;
  let balance = next.balances[actor] || 0;
  if (challenge.reward.achievement_id) {
    const g = grantAchievement(next, { actor, achievementId: challenge.reward.achievement_id, tick });
    next = g.arcade; achievement = g.achievement || null;
    if (g.granted) badge = g.badge || null;
  }
  const bonus = Math.max(0, Math.floor(challenge.reward.ticket_bonus || 0));
  if (bonus > 0) {
    balance = (next.balances[actor] || 0) + bonus;
    ticketBonus = bonus;
    next = { ...next, balances: { ...next.balances, [actor]: balance } };
    next = appendLedger(next, { actor, eventType: 'challenge_reward', delta: bonus, balanceAfter: balance, source: 'challenge', refId: `claim:${challengeId}`, summary: `challenge reward: ${challenge.display_name}`, tick });
  }
  const prevEntry = next.challengeProgress[actor][challengeId];
  const updated = { ...prevEntry, reward_claimed: true };
  next = { ...next, challengeProgress: { ...next.challengeProgress, [actor]: { ...next.challengeProgress[actor], [challengeId]: updated } } };
  return { arcade: next, ok: true, reason: null, challenge, badge, achievement, ticketBonus, balance };
}
