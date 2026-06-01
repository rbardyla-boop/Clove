/**
 * Phase 1 arcade catalog — SIMULATOR-LOCAL PORT of workers/arcade/src/catalog.mjs.
 *
 * The product catalog is not present on this branch (the simulator branch forked
 * before Phase 1d–1l landed), so the Phase 1 semantics are PORTED here as a pure,
 * deterministic, zero-dependency module. This is a testbed mirror, never the
 * canonical authority — see docs/HIVEWORLD_V0_1_PHASE1_PARITY.md.
 *
 * Adds the Phase 1j/1k fields the simulator needs (`game_id`, `adapter_mode`,
 * `frame_contract_id`) plus two deliberately-broken cabinets so the testbed can
 * exercise the fail-closed adapter paths (unsupported / invalid). Prizes are
 * internal arcade points only — no money, no transfer, no cash value.
 */

export const EQUIP_SLOTS = Object.freeze(['avatar_head', 'avatar_body', 'badge', 'cabinet_skin']);

/**
 * Cabinet catalog. The first three mirror the real Phase 1 product cabinets.
 * `circuit-match-01` is a coming_soon placeholder. `mystery-x-01` is active but
 * has NO client adapter (fails closed → unavailable). `glitch-cab-01` is active
 * but ships an INVALID adapter/manifest (fails closed → unavailable).
 */
export const CABINETS = Object.freeze([
  { cabinet_id: 'pulse-tap-01',    machine_id: 'pulse',  display_name: 'Pulse Tap',     cabinet_type: 'pulse_tap',     game_id: 'pulse_tap',     ruleset_version: 'pulse-tap/1',     zone_id: 'cabinet_row', position_hint: 1, status: 'live',        ticket_enabled: true,  min_players: 1, max_players: 1, adapter_mode: 'builtin',  frame_contract_id: 'pulse_tap',     public_description: 'Neon rhythm reflex cabinet.' },
  { cabinet_id: 'signal-sprint-01', machine_id: 'signal', display_name: 'Signal Sprint', cabinet_type: 'signal_sprint', game_id: 'signal_sprint', ruleset_version: 'signal-sprint/1', zone_id: 'cabinet_row', position_hint: 2, status: 'live',        ticket_enabled: true,  min_players: 1, max_players: 1, adapter_mode: 'builtin',  frame_contract_id: 'signal_sprint', public_description: 'Ride the signal lane.' },
  { cabinet_id: 'neon-grid-01',    machine_id: 'grid',   display_name: 'Neon Grid',     cabinet_type: 'neon_grid',     game_id: 'neon_grid',     ruleset_version: 'neon-grid-v1',    zone_id: 'cabinet_row', position_hint: 3, status: 'live',        ticket_enabled: true,  min_players: 1, max_players: 1, adapter_mode: 'imported', frame_contract_id: 'neon_grid',     public_description: 'Repeat the lit path on the grid.' },
  { cabinet_id: 'circuit-match-01', machine_id: null,    display_name: 'Circuit Match',  cabinet_type: 'match',         game_id: null,            ruleset_version: null,              zone_id: 'cabinet_row', position_hint: 4, status: 'coming_soon', ticket_enabled: false, min_players: 1, max_players: 1, adapter_mode: 'none',     frame_contract_id: null,            public_description: 'Coming soon.' },
  { cabinet_id: 'mystery-x-01',    machine_id: 'myx',    display_name: 'Mystery X',      cabinet_type: 'mystery_x',     game_id: 'mystery_x',     ruleset_version: 'mystery-x/1',     zone_id: 'cabinet_row', position_hint: 5, status: 'live',        ticket_enabled: true,  min_players: 1, max_players: 1, adapter_mode: 'builtin',  frame_contract_id: 'mystery_x',     public_description: 'Active but this client has no adapter (fails closed).' },
  { cabinet_id: 'glitch-cab-01',   machine_id: 'glx',    display_name: 'Glitch Cab',     cabinet_type: 'glitch',        game_id: 'glitch',        ruleset_version: 'glitch/1',        zone_id: 'cabinet_row', position_hint: 6, status: 'live',        ticket_enabled: true,  min_players: 1, max_players: 1, adapter_mode: 'imported', frame_contract_id: 'glitch',        public_description: 'Active but ships an invalid adapter (fails closed).' },
]);

/** The cabinets that mirror real Phase 1 production cabinets (used by parity tests). */
export const PRODUCT_CABINET_IDS = Object.freeze(['pulse-tap-01', 'signal-sprint-01', 'neon-grid-01']);

/** Prize Counter catalog (Phase 1f). Costs are arcade tickets (points), never currency. */
export const PRIZES = Object.freeze([
  { prize_id: 'founder-badge-local', display_name: 'Founder Badge', category: 'badge', equip_slot: 'badge', cost_tickets: 10, bound_to: 'session', unique: true, enabled: true },
  { prize_id: 'pioneer-badge-local', display_name: 'Pioneer Badge', category: 'badge', equip_slot: 'badge', cost_tickets: 15, bound_to: 'session', unique: true, enabled: true },
  { prize_id: 'neon-visor',          display_name: 'Neon Visor',    category: 'avatar_cosmetic', equip_slot: 'avatar_head', cost_tickets: 20, bound_to: 'session', unique: true, enabled: true },
  { prize_id: 'cabinet-glow-blue',   display_name: 'Cabinet Glow (Blue)', category: 'cabinet_cosmetic', equip_slot: 'cabinet_skin', cost_tickets: 25, bound_to: 'session', unique: true, enabled: true },
  { prize_id: 'pulse-jacket',        display_name: 'Pulse Jacket',  category: 'avatar_cosmetic', equip_slot: 'avatar_body', cost_tickets: 35, bound_to: 'session', unique: true, enabled: true },
  { prize_id: 'mystery-unit-soon',   display_name: 'Mystery Unit',  category: 'badge', equip_slot: 'badge', cost_tickets: 50, bound_to: 'session', unique: true, enabled: false },
]);

export const ZONES = Object.freeze([
  { zone_id: 'main_floor',    display_name: 'Main Floor' },
  { zone_id: 'cabinet_row',   display_name: 'Cabinet Row' },
  { zone_id: 'prize_counter', display_name: 'Prize Counter' },
  { zone_id: 'lounge',        display_name: 'Lounge' },
]);

export function getCabinet(cabinetId) {
  return CABINETS.find((c) => c.cabinet_id === cabinetId) || null;
}
export function getCabinetByMachineId(machineId) {
  if (typeof machineId !== 'string' || !machineId) return null;
  return CABINETS.find((c) => c.machine_id === machineId) || null;
}
export function getCabinetByType(cabinetType) {
  return CABINETS.find((c) => c.cabinet_type === cabinetType) || null;
}
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
export function isLiveTicketed(cabinetId) {
  const c = getCabinet(cabinetId);
  return !!c && c.status === 'live' && c.ticket_enabled === true;
}
/** Deterministic catalog payload (cabinets + zones), deep-cloned. */
export function cabinetCatalogPayload() {
  return { cabinets: CABINETS.map((c) => ({ ...c })), zones: ZONES.map((z) => ({ ...z })) };
}
/** Public prize catalog — enabled prizes only. */
export function prizeCatalogPayload() {
  return { prizes: PRIZES.filter((p) => p.enabled).map((p) => ({ ...p })) };
}
