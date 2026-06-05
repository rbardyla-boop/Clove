/**
 * Event envelope: the unit that travels the Sideband CRDT Log.
 *
 * One event_type maps to exactly one sideband (EVENT_SPECS) so a malformed or
 * malicious event that puts, say, an `occupy_cabinet` on the `market` sideband
 * is rejected structurally. Semantic/authority checks (is the cabinet free? is
 * the actor a moderator?) live in the reducers, not here.
 *
 * FORBIDDEN_EVENT_TYPES are recognised on purpose: v0 must be able to *receive*
 * a transfer/cashout/stake attempt and visibly REJECT it, proving the economy is
 * internal-only. They are never applied.
 */
import { hashContent, makeEventId, mockSign, mockVerify, canonicalStringify } from './hash.mjs';
import { isKnownSideband } from './sidebands.mjs';

/** event_type -> the single sideband it is allowed on. */
export const EVENT_SPECS = Object.freeze({
  // discovery
  agent_announce:   { sideband: 'discovery' },
  room_announce:    { sideband: 'discovery' },
  // presence
  presence_ping:    { sideband: 'presence' },
  // occupancy
  occupy_cabinet:   { sideband: 'occupancy' },
  release_cabinet:  { sideband: 'occupancy' },
  cabinet_timeout:  { sideband: 'occupancy' },
  // object_state
  lock_object:      { sideband: 'object_state' },
  unlock_object:    { sideband: 'object_state' },
  // ar_anchor
  set_ar_anchor:    { sideband: 'ar_anchor' },
  // asset_sync / cosmetics
  equip_good:       { sideband: 'asset_sync' },
  unequip_good:     { sideband: 'asset_sync' },
  // agent_intent (proposal only)
  agent_intent:     { sideband: 'agent_intent' },
  // market (internal economy)
  grant_credits:    { sideband: 'market' },
  spend_credits:    { sideband: 'market' },
  mint_bound_good:  { sideband: 'market' },
  // moderation
  suspend_slot:     { sideband: 'moderation' },
  suspend_object:   { sideband: 'moderation' },
  // event_log (durable)
  finish_round:     { sideband: 'event_log' },
  lease_slot:       { sideband: 'event_log' },
  renew_slot:       { sideband: 'event_log' },
  expire_slot:      { sideband: 'event_log' },
  place_object:     { sideband: 'event_log' },
  remove_object:    { sideband: 'event_log' },
  // weather
  weather_set:      { sideband: 'weather' },
  // ── Phase 1 arcade parity (v0.1) ──────────────────────────────────────────
  // discovery: the catalog announce
  cabinet_catalog:        { sideband: 'discovery' },
  // event_log: authoritative round lifecycle + challenge claims
  arcade_round_start:     { sideband: 'event_log' },
  arcade_round_submit:    { sideband: 'event_log' },
  arcade_claim_challenge: { sideband: 'event_log' },
  // market: prize redemption (validated economy)
  arcade_redeem:          { sideband: 'market' },
  // asset_sync: cosmetic / badge equip
  arcade_equip:           { sideband: 'asset_sync' },
  arcade_unequip:         { sideband: 'asset_sync' },
  // ── v0.3 room presence health ──────────────────────────────────────────────
  // presence: a room reports its own heartbeat (population/health freshness)
  room_heartbeat:         { sideband: 'presence' },
  // moderation: admin room-lifecycle ops (both-gated in the reducer)
  room_status_set:        { sideband: 'moderation' },
  room_reset:             { sideband: 'moderation' },
  // ── v0.6 live room-event feed transitions ──────────────────────────────────
  // weather: a room observes its own scheduled-event window (ambient/time observation);
  // the reducer appends public-safe started/ended/featured_cabinet_changed feed entries.
  room_event_transition_check: { sideband: 'weather' },
  // ── v0.9 per-room display-only presentation override ────────────────────────
  // weather: a room sets/clears its display-only presentation override (live-ops analog
  // of product Phase 2i). The reducer sanitizes + stores it; effective config = base⊕override.
  room_presentation_override_set: { sideband: 'weather' },
  // ── v1.0 city/district foundation (product Phase 5A–5E mirror) ───────────────
  // presence: per-block actor location + the block-authored public presence summary
  city_player_joined:        { sideband: 'presence' },
  city_player_left:          { sideband: 'presence' },
  district_presence_delta:   { sideband: 'presence' },
  // event_log: cross-block routing semantics + arrival + (optional) explicitly-logged activity
  city_route_requested:      { sideband: 'event_log' },
  city_route_confirmed:      { sideband: 'event_log' },
  city_route_rejected:       { sideband: 'event_log' },
  city_block_arrived:        { sideband: 'event_log' },
  district_activity_derived: { sideband: 'event_log' },
  // ── v1.1 city systems (product Phase 4C–4G mirror) ──────────────────────────
  city_world_event:            { sideband: 'event_log' },  // 4C: explicit append-only world note
  city_pressure_observed:      { sideband: 'weather' },    // 4D: non-authoritative atmosphere
  city_host_rank_evaluated:    { sideband: 'event_log' },  // 4E: non-cash reputation evaluation
  city_stewardship_applied:    { sideband: 'event_log' },  // 4F: constrained, gated, reversible
  city_stewardship_reset:      { sideband: 'event_log' },
  city_block_trial_opened:     { sideband: 'event_log' },  // 4G: instanced, non-destructive
  city_block_trial_joined:     { sideband: 'event_log' },
  city_block_trial_stepped:    { sideband: 'event_log' },
  city_block_trial_closed:     { sideband: 'event_log' },
});

/**
 * Economy actions that v0 must explicitly refuse. They are valid *shapes* (so we
 * can test rejection) but are never applied to state. This is the whole point of
 * "internal-only, no cash-out / no resale / no staking / no yield".
 */
export const FORBIDDEN_EVENT_TYPES = Object.freeze(new Set([
  'transfer_good',
  'transfer_forbidden_test',
  'cashout_credits',
  'withdraw_credits',
  'stake_credits',
  'yield_credits',
  'list_for_resale',
  'sell_good',
  'token_trade',
]));

export function isForbiddenType(type) {
  return FORBIDDEN_EVENT_TYPES.has(type);
}

export function isKnownType(type) {
  return isForbiddenType(type) || Object.prototype.hasOwnProperty.call(EVENT_SPECS, type);
}

/**
 * Build a signed event. `prevEvent` is the actor's previous event (its source
 * chain head) or null for genesis. The returned object is frozen so nothing
 * downstream can mutate protocol content in place.
 */
export function createEvent({
  actorId,
  eventType,
  sideband,
  roomId = null,
  cellId = null,
  payload = {},
  logicalTick,
  prevEvent = null,
  seq = 0,
}) {
  const prevHash = prevEvent ? prevEvent.content_hash : null;
  const content = {
    logical_tick: logicalTick,
    actor_id: actorId,
    room_id: roomId,
    cell_id: cellId,
    sideband,
    event_type: eventType,
    payload,
    prev_hash: prevHash,
    seq,
  };
  const contentHash = hashContent(content);
  return Object.freeze({
    event_id: makeEventId(actorId, seq, contentHash),
    logical_tick: logicalTick,
    timestamp: logicalTick, // mirror; logical_tick is the canonical clock
    actor_id: actorId,
    room_id: roomId,
    cell_id: cellId,
    sideband,
    event_type: eventType,
    payload,
    prev_hash: prevHash,
    seq,
    signature: mockSign(actorId, contentHash),
    content_hash: contentHash,
  });
}

/** Recompute the content hash for an event exactly as createEvent did. */
export function recomputeContentHash(ev) {
  return hashContent({
    logical_tick: ev.logical_tick,
    actor_id: ev.actor_id,
    room_id: ev.room_id,
    cell_id: ev.cell_id,
    sideband: ev.sideband,
    event_type: ev.event_type,
    payload: ev.payload,
    prev_hash: ev.prev_hash,
    seq: ev.seq,
  });
}

/**
 * Structural validation of one envelope (no world context required).
 * Returns { ok, reason }. Reason is a stable machine string.
 */
const VALIDATED = new WeakSet(); // memoize successful validation of frozen events

export function validateEnvelope(ev) {
  if (!ev || typeof ev !== 'object') return { ok: false, reason: 'malformed' };
  // Frozen, content-addressed events never change validity; tampered copies are
  // always NEW objects, so this memo is sound and skips re-hashing on re-delivery.
  if (VALIDATED.has(ev)) return { ok: true, reason: null };
  if (typeof ev.actor_id !== 'string' || !ev.actor_id) return { ok: false, reason: 'missing_actor' };
  if (typeof ev.event_type !== 'string') return { ok: false, reason: 'missing_event_type' };
  if (typeof ev.sideband !== 'string') return { ok: false, reason: 'missing_sideband' };
  if (typeof ev.logical_tick !== 'number' || !Number.isFinite(ev.logical_tick)) {
    return { ok: false, reason: 'bad_tick' };
  }
  if (!isKnownSideband(ev.sideband)) return { ok: false, reason: 'unknown_sideband' };
  if (!isKnownType(ev.event_type)) return { ok: false, reason: 'unknown_event_type' };

  if (isForbiddenType(ev.event_type)) {
    // Recognised but never permitted in v0.
    return { ok: false, reason: 'forbidden_event_type' };
  }

  const spec = EVENT_SPECS[ev.event_type];
  if (ev.sideband !== spec.sideband) return { ok: false, reason: 'sideband_mismatch' };

  // Content integrity: the hash must match the content, and the (mock) signature
  // must match the actor + hash. Tampering with any field breaks one of these.
  if (recomputeContentHash(ev) !== ev.content_hash) return { ok: false, reason: 'bad_content_hash' };
  if (ev.event_id !== makeEventId(ev.actor_id, ev.seq, ev.content_hash)) {
    return { ok: false, reason: 'bad_event_id' };
  }
  if (!mockVerify(ev.actor_id, ev.content_hash, ev.signature)) return { ok: false, reason: 'bad_signature' };

  VALIDATED.add(ev);
  return { ok: true, reason: null };
}

/** Compact summary used in reports and the UI event stream. */
export function summarizeEvent(ev) {
  return {
    event_id: ev.event_id,
    tick: ev.logical_tick,
    actor: ev.actor_id,
    sideband: ev.sideband,
    type: ev.event_type,
    room: ev.room_id,
    cell: ev.cell_id,
    payload: canonicalStringify(ev.payload),
  };
}
