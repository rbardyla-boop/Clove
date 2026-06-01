/**
 * Achievement badges — PURE, runtime-agnostic (Phase 1h).
 *
 * Achievement badges are internal, room/session-bound cosmetics granted when a
 * player completes a server-tracked challenge. They REUSE the Phase 1f inventory
 * model (the same `state.inventory[playerId]` map the Prize Counter uses), so an
 * unlocked badge is equip-compatible through the existing cosmetic equip path —
 * there is no second inventory system.
 *
 * Badges carry NO money, NO cash value, and are NOT transferable off their owning
 * session. See docs/NEON_CIRCUIT_PHASE1H_CHALLENGE_BOARD.md for scope + non-goals.
 */

/** Achievement catalog. Each badge maps to a `badge`-slot cosmetic entitlement. */
export const ACHIEVEMENTS = Object.freeze([
  { achievement_id: 'pulse-rookie',    display_name: 'Pulse Rookie',    description: 'Completed your first Pulse Tap round.',     category: 'badge', badge_cosmetic_id: 'badge-pulse-rookie',    equip_slot: 'badge', public_safe_summary: 'unlocked Pulse Rookie',    enabled: true },
  { achievement_id: 'circuit-tourist', display_name: 'Circuit Tourist', description: 'Played both arcade cabinets in one session.', category: 'badge', badge_cosmetic_id: 'badge-circuit-tourist', equip_slot: 'badge', public_safe_summary: 'unlocked Circuit Tourist', enabled: true },
  { achievement_id: 'clean-signal',    display_name: 'Clean Signal',    description: 'Finished a Signal Sprint run with almost no noise.', category: 'badge', badge_cosmetic_id: 'badge-clean-signal',    equip_slot: 'badge', public_safe_summary: 'unlocked Clean Signal',    enabled: true },
  { achievement_id: 'counter-regular', display_name: 'Counter Regular', description: 'Redeemed an item at the Prize Counter.',      category: 'badge', badge_cosmetic_id: 'badge-counter-regular', equip_slot: 'badge', public_safe_summary: 'unlocked Counter Regular', enabled: true },
  { achievement_id: 'ticket-starter',  display_name: 'Ticket Starter',  description: 'Earned 25 arcade tickets in a session.',    category: 'badge', badge_cosmetic_id: 'badge-ticket-starter',  equip_slot: 'badge', public_safe_summary: 'unlocked Ticket Starter',  enabled: true },
  // Phase 1l: Neon Grid badges (the first adapter-loaded production cabinet).
  { achievement_id: 'grid-rookie',     display_name: 'Grid Rookie',     description: 'Completed your first Neon Grid round.',      category: 'badge', badge_cosmetic_id: 'badge-grid-rookie',     equip_slot: 'badge', public_safe_summary: 'unlocked Grid Rookie',     enabled: true },
  { achievement_id: 'circuit-voyager', display_name: 'Circuit Voyager', description: 'Played all three arcade cabinets in one session.', category: 'badge', badge_cosmetic_id: 'badge-circuit-voyager', equip_slot: 'badge', public_safe_summary: 'unlocked Circuit Voyager', enabled: true },
  { achievement_id: 'clean-grid',      display_name: 'Clean Grid',      description: 'Finished a Neon Grid round with almost no mistakes.', category: 'badge', badge_cosmetic_id: 'badge-clean-grid',  equip_slot: 'badge', public_safe_summary: 'unlocked Clean Grid',      enabled: true },
]);

export function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.achievement_id === id) || null;
}
/** Resolve an achievement by its inventory badge cosmetic id (for display fallback). */
export function getAchievementByBadge(badgeCosmeticId) {
  return ACHIEVEMENTS.find((a) => a.badge_cosmetic_id === badgeCosmeticId) || null;
}
/** Public achievement catalog — enabled only, deep-cloned for determinism. */
export function achievementCatalogPayload() {
  return { achievements: ACHIEVEMENTS.filter((a) => a.enabled).map((a) => ({ ...a })) };
}

/** Owner-only: the achievements this player has unlocked. */
export function getAchievements(state, playerId) {
  return Object.values(state.achievements[playerId] || {});
}
export function hasAchievement(state, playerId, achievementId) {
  return !!(state.achievements[playerId] && state.achievements[playerId][achievementId]);
}

/**
 * Grant an achievement: records the unlock AND adds an equip-compatible badge
 * entitlement to the owner's existing inventory. Idempotent — re-granting an
 * already-unlocked achievement is a no-op (granted=false), so a badge is never
 * duplicated.
 */
export function grantAchievement(state, { playerId, achievementId, now }) {
  const a = getAchievement(achievementId);
  if (!a || !a.enabled) return { state, ok: false, reason: 'unknown_achievement', granted: false };
  if (hasAchievement(state, playerId, achievementId)) {
    return { state, ok: true, granted: false, achievement: a, badge: state.inventory[playerId]?.[a.badge_cosmetic_id] || null };
  }
  const entitlement = {
    prize_id: a.badge_cosmetic_id,
    display_name: a.display_name,
    category: 'badge',
    equip_slot: a.equip_slot,
    bound_to: 'session',
    source: 'achievement',
    achievement_id: a.achievement_id,
    granted_at: now,
  };
  const inventory = {
    ...state.inventory,
    [playerId]: { ...(state.inventory[playerId] || {}), [a.badge_cosmetic_id]: entitlement },
  };
  const achievements = {
    ...state.achievements,
    [playerId]: {
      ...(state.achievements[playerId] || {}),
      [achievementId]: { achievement_id: a.achievement_id, badge_cosmetic_id: a.badge_cosmetic_id, unlocked_at: now },
    },
  };
  return { state: { ...state, inventory, achievements }, ok: true, granted: true, achievement: a, badge: entitlement };
}
