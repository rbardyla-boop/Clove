/**
 * Phase 1 → Sideband mapping (Part 10 parity).
 *
 * Maps the real Phase 1 arcade event flow onto the simulator's existing 11
 * sidebands. Two layers:
 *
 *  PHASE1_EVENT_SIDEBAND — the ACTUAL fabric event types the simulator ingests for
 *    the arcade flow (the round-authority reducer derives ticket awards, ledger,
 *    challenge progress and the public feed from these). Tested for exactness.
 *
 *  PHASE1_PRODUCT_MAP — the CONCEPTUAL product-event → sideband mapping, for
 *    documentation parity with the product (ticket_awarded / round_accepted /
 *    achievement_unlocked are DERIVED state in the simulator, not raw fabric
 *    events, but they belong on these channels logically).
 *
 * Private data (balance, ledger, full inventory) must NEVER ride a public/ephemeral
 * sideband — only public-safe summaries do (the feed is built from event_log +
 * market state into safe strings).
 */

/** Actual simulator arcade fabric event types and their sidebands. */
export const PHASE1_EVENT_SIDEBAND = Object.freeze({
  cabinet_catalog:        'discovery',
  zone_state:             'discovery',
  arcade_round_start:     'event_log',
  arcade_round_submit:    'event_log',
  arcade_claim_challenge: 'event_log',
  arcade_redeem:          'market',
  arcade_equip:           'asset_sync',
  arcade_unequip:         'asset_sync',
  // v0.3 room presence health
  room_heartbeat:         'presence',
  room_status_set:        'moderation',
  room_reset:             'moderation',
});

/** Conceptual product-event → sideband mapping (documentation parity). */
export const PHASE1_PRODUCT_MAP = Object.freeze({
  discovery:     ['cabinet_catalog', 'zone_state'],
  presence:      ['player_join', 'player_leave', 'reconnect', 'room_heartbeat'],
  occupancy:     ['cabinet_occupied', 'cabinet_released', 'cabinet_timeout'],
  object_state:  ['cabinet_state', 'frame_contract_state', 'adapter_mount_state'],
  asset_sync:    ['adapter_manifest_loaded', 'frame_contract_loaded', 'cosmetic_equipped'],
  market:        ['ticket_awarded', 'ticket_spent', 'prize_redeemed', 'inventory_state'],
  agent_intent:  ['round_start_requested', 'prize_redeem_requested', 'challenge_reward_claim_requested'],
  event_log:     ['round_accepted', 'round_rejected', 'ledger_entry', 'challenge_completed', 'achievement_unlocked'],
  moderation:    ['invalid_adapter_rejected', 'forbidden_capability_rejected', 'malformed_event_rejected', 'room_status_set', 'room_reset'],
  weather:       ['arcade_activity_summary', 'room_mood', 'room_health'],
});

export function sidebandForEvent(eventType) {
  return PHASE1_EVENT_SIDEBAND[eventType] || null;
}

/** Private field names that must never appear on a public feed event. */
export const PRIVATE_FIELD_RE = /balance|ledger|inventory|redemption_id|cost_tickets/i;

/** True if every feed entry is public-safe (no private fields in its JSON). */
export function feedIsPublicSafe(feed) {
  const events = Array.isArray(feed) ? feed : [];
  return events.every((e) => e.public_safe === true && !PRIVATE_FIELD_RE.test(JSON.stringify(e)));
}
