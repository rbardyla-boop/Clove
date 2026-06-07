/**
 * Neon Circuit — server-confirmed interaction receipts (Phase 7E).
 *
 * PURE, deterministic, runtime-agnostic. Closes the authority loop for Phase 7A interaction
 * prompts: a prompt is local display, but an ACTION is only real when the server confirms it
 * against the player's CANONICAL position + the block's zones + (for travel) adjacency, and
 * answers with a public-safe, EPHEMERAL receipt. Imported UNCHANGED by the CityRoom DO
 * (workers/arcade/src/city-room.ts) and the dev shim (workers/arcade/city-dev-shim.mjs), so
 * both produce byte-identical receipts.
 *
 * Single source of validation truth — REUSES the existing validators rather than copying them:
 *   - block_travel : validateRouteRequest (city-district.mjs) — same adjacency gate as routing
 *   - arcade_entry : pointInZone over the portal-derived zone — the same inclusive rect test the
 *                    server portal gate (enterPortal) uses, on the same PORTALS geometry
 *   - display acks : district_event_ack / activity_board_view / block_preview_view confirm context
 *
 * NO persistence, NO ledger, NO ticket/prize/Host-Rank/Stewardship/Block-Trial coupling, NO
 * economy/account/ownership semantics. The receipt is a transient confirmation, not a credit.
 */

import { publicLayout } from './city-block.mjs';
import { validateRouteRequest } from './city-district.mjs';
import {
  INTERACTION_KINDS, ACTION_REQUEST_TYPE, deriveInteractionZones, pointInZone,
} from './city-interactions.mjs';

export const INTERACTION_RECEIPT_KIND = 'city_interaction_receipt';

/** Normalize an UNTRUSTED interaction request — read only the safe fields, ignore the rest. */
export function normalizeInteractionRequest(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = {
    action_kind: typeof r.action_kind === 'string' ? r.action_kind : '',
    zone_id: typeof r.zone_id === 'string' ? r.zone_id : '',
  };
  if (typeof r.target_city_id === 'string') out.target_city_id = r.target_city_id;
  return out;
}

/**
 * Build a public-safe, ephemeral interaction receipt. The caller (DO/shim) supplies the
 * SERVER-OWNED inputs: `playerPos` (canonical {x,y} or null if not joined), `cityId` (the
 * server-owned current block), a unique `receiptId`, and `now`. PURE — no I/O, no mutation.
 *
 * Receipt shape (public-safe; no private identifiers):
 *   { kind, receipt_id, action_kind, city_id, [zone_id|target|target_city_id], accepted, reason,
 *     issued_at, public_safe:true }
 */
export function buildInteractionReceipt({ playerPos, cityId, request, receiptId, now }) {
  const req = normalizeInteractionRequest(request);
  const base = {
    kind: INTERACTION_RECEIPT_KIND,
    receipt_id: typeof receiptId === 'string' ? receiptId : '',
    action_kind: req.action_kind,
    city_id: typeof cityId === 'string' ? cityId : '',
    accepted: false,
    reason: 'unknown_action',
    issued_at: Number.isFinite(now) ? now : 0,
    public_safe: true,
  };

  // 1. the action must be a known interaction kind (deny-by-default)
  if (!INTERACTION_KINDS.includes(req.action_kind)) return base;
  // 2. the player must be joined with a canonical position (server-owned)
  if (!playerPos || !Number.isFinite(playerPos.x) || !Number.isFinite(playerPos.y)) {
    return { ...base, reason: 'not_joined' };
  }

  switch (req.action_kind) {
    case 'arcade_entry': {
      // must be physically inside an arcade_entry zone — same gate as the server portal
      const zones = deriveInteractionZones(cityId, publicLayout(cityId)).filter((z) => z.kind === 'arcade_entry');
      const zone = (req.zone_id && zones.find((z) => z.zone_id === req.zone_id)) || zones[0];
      if (!zone) return { ...base, reason: 'unknown_zone' };
      if (!pointInZone(playerPos, zone)) return { ...base, reason: 'not_in_zone', zone_id: zone.zone_id };
      return { ...base, accepted: true, reason: 'ok', zone_id: zone.zone_id, target: zone.target };
    }
    case 'block_travel': {
      // server-validated adjacency; SOURCE is the server-owned cityId, target is untrusted
      const r = validateRouteRequest(cityId, req.target_city_id);
      if (!r.ok) return { ...base, reason: r.reason, target_city_id: req.target_city_id };
      return { ...base, accepted: true, reason: 'ok', target_city_id: r.target_city_id };
    }
    case 'district_event':
    case 'activity_board':
    case 'block_preview': {
      // display-only views: the server confirms the player is in a valid block context. No state
      // change, no reward — purely an acknowledgment that the view request is well-formed.
      return { ...base, accepted: true, reason: 'ok' };
    }
    default:
      return base; // unreachable (kind already validated), defensive
  }
}

/** Sanity check that a kind maps to its declared action_request_type (for callers/tests). */
export function expectedRequestType(actionKind) {
  return ACTION_REQUEST_TYPE[actionKind] || null;
}
