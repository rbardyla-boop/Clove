/**
 * Neon Circuit — City Hive Scheduler (Phase 4D), PURE.
 *
 * A deterministic, SUBORDINATE pressure layer. It READS recent server-authored city
 * world events (arcade/city/city-events.mjs) and produces a bounded, DISPLAY-ONLY
 * pressure snapshot + at most a couple of public-safe suggestions. It is an
 * atmosphere/pressure layer, not a god process:
 *   - it owns NO physics, position, collision, portal truth, rewards, tickets,
 *     inventory, economy, rank, or ownership;
 *   - it grants nothing and moves no one;
 *   - it never reads a client-authored fact as authoritative (it only reads the
 *     server-authored event log + a server-supplied occupancy count);
 *   - it is pure: no async/network/AI/LLM, no randomness, no input mutation.
 *
 * The seam future phases read from (4E Host Rank, 4F Stewardship) — none built here.
 * Imported by the CityRoom DO, the city dev shim, the unit tests, and the browser.
 */
import { SCHEMA_VERSION } from './city-block.mjs';

/** Recent-activity window used to classify pressure (ms). */
export const WINDOW_MS = 60_000;

/** Event types the scheduler counts as activity. Scheduler-authored events are
 *  deliberately EXCLUDED so emitting a tick can never feed back into pressure. */
const PORTAL_EVENTS = ['city_portal_enter_requested', 'city_portal_enter_accepted', 'city_portal_enter_rejected'];
const INTERIOR_EVENTS = ['city_arcade_interior_opened', 'city_arcade_interior_closed'];

/** Classification thresholds (small enough to be observable + testable). */
const TH = Object.freeze({
  portalActive: 2, portalSurging: 4,
  interiorOpen: 1, interiorCycling: 3,
  presenceLight: 1, presenceBusy: 4,
});

const clampOcc = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/**
 * PURE: classify recent city activity into a bounded, display-only pressure snapshot.
 * Deterministic for a given { now, recentEvents, occupancy }. Never mutates inputs.
 *
 * @returns {{ schema_version, city_id, evaluated_at, pressure, suggestions }}
 */
export function evaluatePressure({ cityId, now = Date.now(), recentEvents = [], occupancy = 0 } = {}) {
  const evs = Array.isArray(recentEvents) ? recentEvents : [];
  const inWindow = evs.filter((e) => e && typeof e.type === 'string' && Number.isFinite(e.server_time) && (now - e.server_time) <= WINDOW_MS && (now - e.server_time) >= 0);
  const count = (types) => inWindow.reduce((n, e) => (types.includes(e.type) ? n + 1 : n), 0);

  const portalN = count(PORTAL_EVENTS);
  const interiorN = count(INTERIOR_EVENTS);
  const occ = clampOcc(occupancy);

  const portal_activity = portalN >= TH.portalSurging ? 'surging' : portalN >= TH.portalActive ? 'active' : 'quiet';
  const presence = occ >= TH.presenceBusy ? 'busy' : occ >= TH.presenceLight ? 'light' : 'empty';
  const interior_activity = interiorN >= TH.interiorCycling ? 'cycling' : interiorN >= TH.interiorOpen ? 'open' : 'idle';

  const elevated = (portal_activity !== 'quiet' ? 1 : 0) + (interior_activity !== 'idle' ? 1 : 0) + (presence === 'busy' ? 1 : 0);
  const scheduler_mood = elevated >= 2 ? 'stirring' : elevated === 1 ? 'watching' : 'stable';

  const suggestions = [];
  if (portal_activity === 'surging') suggestions.push({ type: 'city_pressure_suggested', reason: 'portal_surge', severity: 'medium', public_safe: true });
  if (interior_activity === 'cycling') suggestions.push({ type: 'city_pressure_suggested', reason: 'interior_cycling', severity: 'low', public_safe: true });

  return {
    schema_version: SCHEMA_VERSION,
    city_id: (typeof cityId === 'string' && cityId) ? cityId : 'city',
    evaluated_at: now,
    pressure: { portal_activity, presence, interior_activity, scheduler_mood },
    suggestions: suggestions.slice(0, 2),
  };
}

/** PURE: have any pressure dimensions changed between two snapshots? */
export function pressureChanged(prev, next) {
  if (!prev || !prev.pressure) return true;
  const a = prev.pressure; const b = next.pressure;
  return a.portal_activity !== b.portal_activity
    || a.presence !== b.presence
    || a.interior_activity !== b.interior_activity
    || a.scheduler_mood !== b.scheduler_mood;
}

/** PURE: suggestion reasons present in a snapshot (for new-suggestion dedup). */
export function suggestionReasons(snapshot) {
  return (snapshot && Array.isArray(snapshot.suggestions)) ? snapshot.suggestions.map((s) => s.reason) : [];
}

/** PURE: true when a snapshot is the fully-idle baseline (quiet/empty/idle/stable).
 *  Used so the very first server-side eval on a cold start doesn't log a "news" tick
 *  for an empty city. */
export function isBaselinePressure(snapshot) {
  const p = snapshot && snapshot.pressure;
  return !!p && p.portal_activity === 'quiet' && p.presence === 'empty' && p.interior_activity === 'idle' && p.scheduler_mood === 'stable';
}

/** PURE: public-safe wire payload for the current scheduler state (display only). */
export function schedulerStatePayload(snapshot) {
  const p = (snapshot && snapshot.pressure) ? snapshot.pressure : { portal_activity: 'quiet', presence: 'empty', interior_activity: 'idle', scheduler_mood: 'stable' };
  const sugg = (snapshot && Array.isArray(snapshot.suggestions)) ? snapshot.suggestions : [];
  return {
    schema_version: SCHEMA_VERSION,
    city_id: snapshot ? snapshot.city_id : 'city',
    evaluated_at: snapshot ? snapshot.evaluated_at : Date.now(),
    pressure: { ...p },
    suggestions: sugg.map((s) => ({ reason: s.reason, severity: s.severity, public_safe: true })),
  };
}
