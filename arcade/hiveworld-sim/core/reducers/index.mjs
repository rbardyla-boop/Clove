/**
 * Reducer dispatch table: event_type -> pure reducer (state, event, ctx) -> result.
 *
 * Every non-forbidden event_type in EVENT_SPECS must have a handler here, or the
 * fold will reject it with `no_handler` (a coverage guard, surfaced by a test).
 */
import * as discovery from './discovery.mjs';
import * as presence from './presence.mjs';
import * as occupancy from './occupancy.mjs';
import * as slots from './slots.mjs';
import * as economy from './economy.mjs';
import * as assets from './assets.mjs';
import * as ambient from './ambient.mjs';
import * as arcade from './arcade.mjs';
import * as registry from './registry.mjs';

export const HANDLERS = Object.freeze({
  // discovery
  agent_announce: discovery.agent_announce,
  room_announce: discovery.room_announce,
  // presence
  presence_ping: presence.presence_ping,
  // occupancy
  occupy_cabinet: occupancy.occupy_cabinet,
  release_cabinet: occupancy.release_cabinet,
  cabinet_timeout: occupancy.cabinet_timeout,
  // object_state
  lock_object: assets.lock_object,
  unlock_object: assets.unlock_object,
  // ar_anchor
  set_ar_anchor: assets.set_ar_anchor,
  // asset_sync
  equip_good: assets.equip_good,
  unequip_good: assets.unequip_good,
  // agent_intent
  agent_intent: ambient.agent_intent,
  // market
  grant_credits: economy.grant_credits,
  spend_credits: economy.spend_credits,
  mint_bound_good: economy.mint_bound_good,
  // moderation
  suspend_slot: slots.suspend_slot,
  suspend_object: slots.suspend_object,
  // event_log
  finish_round: ambient.finish_round,
  lease_slot: slots.lease_slot,
  renew_slot: slots.renew_slot,
  expire_slot: slots.expire_slot,
  place_object: slots.place_object,
  remove_object: slots.remove_object,
  // weather
  weather_set: ambient.weather_set,
  // Phase 1 arcade parity (v0.1)
  cabinet_catalog: arcade.cabinet_catalog,
  arcade_round_start: arcade.arcade_round_start,
  arcade_round_submit: arcade.arcade_round_submit,
  arcade_claim_challenge: arcade.arcade_claim_challenge,
  arcade_redeem: arcade.arcade_redeem,
  arcade_equip: arcade.arcade_equip,
  arcade_unequip: arcade.arcade_unequip,
  // v0.3 room presence health
  room_heartbeat: registry.room_heartbeat,
  room_status_set: registry.room_status_set,
  room_reset: registry.room_reset,
  // v0.6 live room-event feed transitions
  room_event_transition_check: arcade.room_event_transition_check,
  // v0.9 per-room display-only presentation override (live-ops analog of Phase 2i)
  room_presentation_override_set: arcade.room_presentation_override_set,
});

export function getHandler(eventType) {
  return HANDLERS[eventType] || null;
}
