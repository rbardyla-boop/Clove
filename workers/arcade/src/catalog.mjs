/**
 * Server-authoritative arcade catalog — PURE, deterministic, runtime-agnostic.
 *
 * Cabinets, prizes and zones for Neon Circuit Phase 1f. The same module is used
 * by the Durable Object, the local dev shim and the unit tests, so the catalog
 * the client renders is the catalog the server validates against.
 *
 * Prizes are internal arcade cosmetics redeemed with arcade tickets (points).
 * They are NOT money, NOT transferable, and carry NO cash value. See
 * docs/NEON_CIRCUIT_PHASE1F_ARCADE_LOOP.md for scope + non-goals.
 */

/** The cosmetic slots a player can equip one item into. */
export const EQUIP_SLOTS = Object.freeze(['avatar_head', 'avatar_body', 'badge', 'cabinet_skin']);

/** Cabinet catalog. `pulse-tap-01` is the only playable/ticketed cabinet in 1f. */
export const CABINETS = Object.freeze([
  {
    cabinet_id: 'pulse-tap-01',
    machine_id: 'pulse',            // links to the Phase-1b occupancy machine
    display_name: 'Pulse Tap',
    cabinet_type: 'pulse_tap',
    zone_id: 'cabinet_row',
    position_hint: 1,
    status: 'live',
    ticket_enabled: true,
    min_players: 1,
    max_players: 1,
    ruleset_version: 'pulse-tap/1',
    public_description: 'Neon rhythm reflex cabinet. Tap when the ring meets the target.',
  },
  {
    cabinet_id: 'circuit-match-01',
    machine_id: null,
    display_name: 'Circuit Match',
    cabinet_type: 'match',
    zone_id: 'cabinet_row',
    position_hint: 2,
    status: 'coming_soon',
    ticket_enabled: false,
    min_players: 1,
    max_players: 1,
    ruleset_version: null,
    public_description: 'Pattern-matching cabinet. Coming soon.',
  },
  {
    cabinet_id: 'signal-sprint-01',
    machine_id: 'signal',           // Phase 1g occupancy machine (independent from pulse)
    display_name: 'Signal Sprint',
    cabinet_type: 'signal_sprint',
    zone_id: 'cabinet_row',
    position_hint: 3,
    status: 'live',
    ticket_enabled: true,
    min_players: 1,
    max_players: 1,
    ruleset_version: 'signal-sprint/1',
    public_description: 'Ride the signal lane: collect pulses, dodge the static.',
  },
  {
    // Phase 1l: the FIRST production cabinet activated for the adapter/import
    // path. The server catalog stays the authority — the client only renders it
    // after the imported adapter validates. `status: 'live'` is the catalog's
    // term for an active cabinet (see cabinetRenderState / isPlayableCabinet).
    cabinet_id: 'neon-grid-01',
    machine_id: 'grid',             // Phase 1l occupancy machine (independent from pulse/signal)
    display_name: 'Neon Grid',
    cabinet_type: 'neon_grid',
    zone_id: 'cabinet_row',
    position_hint: 4,
    status: 'live',
    ticket_enabled: true,
    min_players: 1,
    max_players: 1,
    ruleset_version: 'neon-grid-v1',
    public_description: 'Watch the path light up, then repeat it on the neon grid before time runs out.',
  },
]);

/** Prize Counter catalog. Costs are in arcade tickets (points), never currency. */
export const PRIZES = Object.freeze([
  { prize_id: 'founder-badge-local', display_name: 'Founder Badge', category: 'badge', equip_slot: 'badge', cost_tickets: 10, bound_to: 'session', rarity_label: 'common', unique: true, enabled: true, description: 'A local founder badge for early Neon Circuit players.' },
  { prize_id: 'pioneer-badge-local', display_name: 'Pioneer Badge', category: 'badge', equip_slot: 'badge', cost_tickets: 15, bound_to: 'session', rarity_label: 'uncommon', unique: true, enabled: true, description: 'A pioneer badge for the arcade.' },
  { prize_id: 'neon-visor', display_name: 'Neon Visor', category: 'avatar_cosmetic', equip_slot: 'avatar_head', cost_tickets: 20, bound_to: 'session', rarity_label: 'uncommon', unique: true, enabled: true, description: 'A glowing avatar visor.' },
  { prize_id: 'cabinet-glow-blue', display_name: 'Cabinet Glow (Blue)', category: 'cabinet_cosmetic', equip_slot: 'cabinet_skin', cost_tickets: 25, bound_to: 'session', rarity_label: 'uncommon', unique: true, enabled: true, description: 'A blue glow skin for your cabinet.' },
  { prize_id: 'pulse-jacket', display_name: 'Pulse Jacket', category: 'avatar_cosmetic', equip_slot: 'avatar_body', cost_tickets: 35, bound_to: 'session', rarity_label: 'rare', unique: true, enabled: true, description: 'A neon avatar jacket.' },
  { prize_id: 'mystery-unit-soon', display_name: 'Mystery Unit', category: 'badge', equip_slot: 'badge', cost_tickets: 50, bound_to: 'session', rarity_label: 'special', unique: true, enabled: false, description: 'Not yet available.' },
]);

export const ZONES = Object.freeze([
  { zone_id: 'main_floor', display_name: 'Main Floor', description: 'Arcade entrance and lobby.' },
  { zone_id: 'cabinet_row', display_name: 'Cabinet Row', description: 'Where the game cabinets live.' },
  { zone_id: 'prize_counter', display_name: 'Prize Counter', description: 'Redeem arcade tickets for cosmetics.' },
  { zone_id: 'lounge', display_name: 'Lounge', description: 'Hang out between rounds.' },
]);

export function getCabinet(cabinetId) {
  return CABINETS.find((c) => c.cabinet_id === cabinetId) || null;
}
/** Resolve a cabinet by its occupancy machine id (e.g. 'pulse' / 'signal'). */
export function getCabinetByMachineId(machineId) {
  if (typeof machineId !== 'string' || !machineId) return null;
  return CABINETS.find((c) => c.machine_id === machineId) || null;
}
/** Machine ids of live, ticket-enabled cabinets — the set the room can occupy. */
export function ticketedMachineIds() {
  return CABINETS
    .filter((c) => c.status === 'live' && c.ticket_enabled === true && typeof c.machine_id === 'string' && c.machine_id)
    .map((c) => c.machine_id);
}
export function getPrize(prizeId) {
  return PRIZES.find((p) => p.prize_id === prizeId) || null;
}
export function getZone(zoneId) {
  return ZONES.find((z) => z.zone_id === zoneId) || null;
}

/** True only for live, ticket-enabled cabinets (coming_soon cannot be played). */
export function isPlayableCabinet(cabinetId) {
  const c = getCabinet(cabinetId);
  return !!c && c.status === 'live' && c.ticket_enabled === true;
}

/** Deterministic catalog payload (cabinets + zones). */
export function cabinetCatalogPayload() {
  return { cabinets: CABINETS.map((c) => ({ ...c })), zones: ZONES.map((z) => ({ ...z })) };
}

/** Public prize catalog — enabled prizes only. */
export function prizeCatalogPayload() {
  return { prizes: PRIZES.filter((p) => p.enabled).map((p) => ({ ...p })) };
}
