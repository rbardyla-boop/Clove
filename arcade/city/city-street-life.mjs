/**
 * Neon Circuit — STREET LIFE ambient happenings (next-density pass), PURE + client-only.
 *
 * DISPLAY-ONLY street-level atmosphere: one short, static line per block that slowly ROTATES on a
 * coarse client-time bucket, so the same corner reads slightly differently across a session ("a tram
 * hums past", "the noodle cart steams"). It is a CLIENT-SIDE OVERLAY in the same family as the 8C-3
 * voice lines: closed copy tables only, NO wire field, NO server/DO change, NO state ownership, and
 * NOTHING economic — no reward, score, count, buff, or ownership ever rides this surface.
 *
 * Determinism: the line shown is a pure function of (city_id, now) — bucket = floor(now / STREET_
 * BUCKET_MS) indexes the block's closed line table. Two clients in the same bucket see the same line;
 * nothing is random, persisted, or comparative. Every string is screened against the canonical
 * FORBIDDEN_RE (economy/ownership/gambling/reward vocabulary) — see the unit tests.
 *
 * Imported by the browser scene (arcade/city/city-scene.js) + tests.
 */
import { FORBIDDEN_RE } from './city-interactions.mjs';

/** Bound for a single street line (same readability budget as the 8C-3 voice lines). */
export const STREET_LINE_MAX = 72;

/** Rotation bucket — coarse on purpose (a slow city, not a ticker). */
export const STREET_BUCKET_MS = 90_000;

/**
 * Per-block STREET HAPPENINGS (STATIC CONFIG, display-only). Three lines per block, rotated by time
 * bucket. Pure scenery: vehicles, vendors, weather-adjacent texture — never people by name, never a
 * number, never anything grantable.
 */
const STREET_LINES = Object.freeze({
  'downtown-01': Object.freeze([
    'A tram hums through the crossroads, lights trailing.',
    'The noodle cart by the Signal Spire steams in neon.',
    'Crosswalk chimes echo between the towers.',
  ]),
  'harbor-02': Object.freeze([
    'A ferry horn rolls in across the dark water.',
    'Gulls wheel around the Tide Crane in the haze.',
    'Rope and salt — the dockside smells like rain.',
  ]),
  'skyline-03': Object.freeze([
    'Wind sings along the upper walkways tonight.',
    'The Beacon Crown sweeps its light across the glass.',
    'An elevator chimes somewhere far above the street.',
  ]),
  'foundry-04': Object.freeze([
    'Sparks drift from a gantry weld and fade out.',
    'A freight lift clanks its slow way up the works.',
    'Steam vents sigh between the amber floodlights.',
  ]),
  'nexus-05': Object.freeze([
    'Route boards flicker as the crossing re-syncs.',
    'Footsteps cross the Junction Ring from every side.',
    'A courier drone threads the interchange lights.',
  ]),
  'garden-06': Object.freeze([
    'Leaves tick softly against the Glass Arbor panes.',
    'A sprinkler arcs slow rainbows over the green.',
    'Lanterns blink on one by one along the path.',
  ]),
  'aurora-07': Object.freeze([
    'Cold light ripples off the Aurora Spire panels.',
    'A polar wind threads the arc, thin and bright.',
    'The tram glides in along the Aurora line.',
  ]),
  'relay-08': Object.freeze([
    'Relay boards click and re-sync down the junction.',
    'Static hums in the diner sign by the tower.',
    'A signal pulse runs the length of the line.',
  ]),
  'lumen-09': Object.freeze([
    'The Lumen Beacon sweeps a slow arc of light.',
    'Warm glow spills from the kitchen onto the path.',
    'Lanterns of light blink along the beacon line.',
  ]),
});

/**
 * PURE: the street happening for a block at a moment. Same (block, bucket) → same line; unknown
 * block or bad clock → '' (renders nothing). Display-only copy from the closed table above.
 */
export function streetHappening(cityId, now) {
  const lines = (typeof cityId === 'string' && STREET_LINES[cityId]) || null;
  if (!lines || !Number.isFinite(now) || now < 0) return '';
  const bucket = Math.floor(now / STREET_BUCKET_MS);
  return lines[bucket % lines.length];
}

/** The block ids that carry street lines (a fresh array). */
export function streetBlockIds() {
  return Object.keys(STREET_LINES);
}

/** All lines for a block (fresh array; for tests/screens). Unknown → []. */
export function streetLines(cityId) {
  const lines = (typeof cityId === 'string' && STREET_LINES[cityId]) || null;
  return lines ? [...lines] : [];
}

/** PURE: true iff a street line is non-empty, within bound, and clean of forbidden vocabulary. */
export function streetIsClean(str) {
  return typeof str === 'string' && str.length > 0 && str.length <= STREET_LINE_MAX && !FORBIDDEN_RE.test(str);
}
