/**
 * Neon Circuit — City interaction zones / action prompts (Phase 7A).
 *
 * PURE, deterministic, runtime-agnostic. Second City Gameplay Kernel layer
 * (docs/NEON_CIRCUIT_CITY_GAMEPLAY_KERNEL.md §6). An interaction zone is a public-safe,
 * server-defined region that, when the player's position is inside it, surfaces an ACTION
 * PROMPT ("Enter arcade", "Travel to Harbor"). The prompt is local DISPLAY; any action that
 * changes canonical state is server-confirmed in Phase 7E (this module defines the
 * `action_request` shape that 7E validates and answers with a receipt).
 *
 * AUTHORITY: a visible prompt authorizes NOTHING. The client detects nearby zones for
 * display only; the server remains the authority for the action (7E). The arcade-entry zone
 * derives from the existing server-gated portal (city-block.mjs PORTALS / enterPortal), so
 * wiring this model to the live prompt changes no authority — the portal stays server-gated.
 *
 * No economy/ownership/gambling/crime zone kinds — those are rejected by construction.
 */

/** The only interaction kinds the kernel recognises. Anything else is rejected. */
export const INTERACTION_KINDS = Object.freeze([
  'arcade_entry',     // enter the arcade interior (server-gated portal)
  'block_travel',     // request a route to an adjacent block (server-validated)
  'district_event',   // acknowledge / focus the current district event (display)
  'activity_board',   // view the district activity feed (display)
  'block_preview',    // preview this block's style (display)
]);

/** kind → the action_request type the client sends and Phase 7E server-confirms. */
export const ACTION_REQUEST_TYPE = Object.freeze({
  arcade_entry: 'arcade_entry_request',
  block_travel: 'block_travel_request',
  district_event: 'district_event_ack',
  activity_board: 'activity_board_view',
  block_preview: 'block_preview_view',
});

/**
 * Forbidden vocabulary for zone kinds AND human-facing label/prompt text — keeps the
 * interaction surface free of economy/ownership/gambling/crime affordances. Mirrors the
 * charter non-goals and the creator validator's FORBIDDEN_TERMS family.
 */
// Exported (Phase 8C) so content modules + tests screen new display copy against the SAME canonical
// economy/ownership/gambling/crime vocabulary guard — one source of truth, no drift.
export const FORBIDDEN_RE = /\b(shop|store|market(place)?|buy|sell|sale|for[-\s]?sale|rent|rental|own(er|ed|ership)?|landlord|tenant|wager|bet|gambl\w*|jackpot|loot|raid|steal|theft|cash[-\s]?out|payout|payment|withdraw|profit|income|earn|price|cost|coin|crypto|token|nft|stake|staking|yield|trade|trading|multiplier|boost|bonus|prize|reward|weapon|gun|police|wanted|crime)\b/i;

const LABEL_MAX = 48;
const PROMPT_MAX = 64;

function isFiniteNum(v) { return typeof v === 'number' && Number.isFinite(v); }

/** True if a point is inside a zone — rectangle {x,y,w,h} or circle {cx,cy,radius}. */
export function pointInZone(pos, zone) {
  if (!pos || !zone) return false;
  const { x, y } = pos;
  if (!isFiniteNum(x) || !isFiniteNum(y)) return false;
  if (isFiniteNum(zone.radius) && isFiniteNum(zone.cx) && isFiniteNum(zone.cy)) {
    return Math.hypot(x - zone.cx, y - zone.cy) <= zone.radius;
  }
  if ([zone.x, zone.y, zone.w, zone.h].every(isFiniteNum)) {
    return x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
  }
  return false;
}

/**
 * Validate an interaction zone (deny-by-default). Returns { ok, errors[] }. Rejects unknown
 * or forbidden kinds, missing/garbage bounds, oversized or economy-laden label/prompt text,
 * a non-numeric priority, or public_safe !== true. Never throws; never silently rewrites.
 */
export function validateInteractionZone(zone) {
  const errors = [];
  if (!zone || typeof zone !== 'object') return { ok: false, errors: ['not_an_object'] };
  if (!INTERACTION_KINDS.includes(zone.kind)) errors.push('forbidden_or_unknown_kind');
  const hasRect = [zone.x, zone.y, zone.w, zone.h].every(isFiniteNum) && zone.w > 0 && zone.h > 0;
  const hasCircle = [zone.cx, zone.cy, zone.radius].every(isFiniteNum) && zone.radius > 0;
  if (!hasRect && !hasCircle) errors.push('invalid_bounds');
  if (typeof zone.zone_id !== 'string' || !/^[a-z0-9:_-]{1,48}$/i.test(zone.zone_id)) errors.push('invalid_zone_id');
  if (typeof zone.city_id !== 'string' || !zone.city_id) errors.push('invalid_city_id');
  for (const [field, max] of [['label', LABEL_MAX], ['prompt', PROMPT_MAX]]) {
    const v = zone[field];
    if (typeof v !== 'string' || v.length === 0 || v.length > max) errors.push(`invalid_${field}`);
    else if (FORBIDDEN_RE.test(v)) errors.push(`forbidden_copy_in_${field}`);
  }
  if (!isFiniteNum(zone.priority)) errors.push('invalid_priority');
  if (zone.public_safe !== true) errors.push('not_public_safe');
  if (zone.action_request_type && zone.action_request_type !== ACTION_REQUEST_TYPE[zone.kind]) {
    errors.push('action_request_type_mismatch');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * The nearest ACTIONABLE interaction zone for a position: among VALID zones that contain the
 * point, the highest `priority` wins; ties break stably by `zone_id` (ascending). Returns the
 * winning zone or null. Invalid zones are ignored (deny-by-default), so a malformed zone can
 * never drive a prompt.
 */
export function nearestInteractionZone(pos, zones) {
  if (!Array.isArray(zones)) return null;
  let best = null;
  for (const z of zones) {
    if (!validateInteractionZone(z).ok) continue;
    if (!pointInZone(pos, z)) continue;
    if (!best || z.priority > best.priority || (z.priority === best.priority && z.zone_id < best.zone_id)) {
      best = z;
    }
  }
  return best;
}

/**
 * The action request a client sends when it activates a zone. Phase 7E validates this against
 * the canonical position + zone availability and answers with a server-confirmed receipt.
 * Public-safe by construction: no private identifiers.
 */
export function actionRequestFor(zone) {
  if (!validateInteractionZone(zone).ok) return null;
  const req = {
    action_kind: zone.kind,
    action_request_type: ACTION_REQUEST_TYPE[zone.kind],
    zone_id: zone.zone_id,
    city_id: zone.city_id,
  };
  if (zone.kind === 'arcade_entry' && typeof zone.target === 'string') req.target = zone.target;
  if (zone.kind === 'block_travel' && typeof zone.target_city_id === 'string') req.target_city_id = zone.target_city_id;
  return req;
}

/** Public-safe projection of a zone for the wire / test hook (no private fields). */
export function publicZone(zone) {
  return {
    zone_id: zone.zone_id, city_id: zone.city_id, kind: zone.kind,
    label: zone.label, prompt: zone.prompt, priority: zone.priority,
    action_request_type: zone.action_request_type || ACTION_REQUEST_TYPE[zone.kind],
    public_safe: true,
  };
}

/**
 * Derive the canonical PHYSICAL interaction zones for a block from its public layout. Today
 * the only physical floor zone is the arcade-entry portal (city-block.mjs PORTALS), so this
 * yields one arcade_entry zone per portal — a backward-compatible SUPERSET of the portal
 * object (keeps id/x/y/w/h/target/label so existing portal code reads it unchanged) plus the
 * kernel fields. block_travel / district_event / activity_board / block_preview are surfaced
 * by their existing panels (district / event / activity / stewardship); their action_request
 * shapes are defined above for Phase 7E. PURE — derived from public layout only.
 */
export function deriveInteractionZones(cityId, layout) {
  const out = [];
  const portals = (layout && Array.isArray(layout.portals)) ? layout.portals : [];
  for (const p of portals) {
    if (!p || typeof p.id !== 'string') continue;
    out.push(Object.freeze({
      ...p,                                   // id, x, y, w, h, target, label (back-compat)
      zone_id: p.id,
      city_id: typeof cityId === 'string' ? cityId : '',
      kind: 'arcade_entry',
      label: p.label || 'ENTER ARCADE',
      prompt: p.label || 'Enter arcade',
      priority: 10,
      action_request_type: ACTION_REQUEST_TYPE.arcade_entry,
      public_safe: true,
    }));
  }
  return out;
}
