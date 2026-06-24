/**
 * Neon Circuit — per-block ARCADE NAME (cabinet-loop polish), PURE + client-only.
 *
 * DISPLAY-ONLY branding for the city⇄arcade seam: each block's arcade entrance carries the
 * block's landmark-derived house name ("Signal Spire Arcade"), shown on the portal prompt and
 * the interior overlay title — so entering from Garden visibly differs from entering from
 * Foundry even though every portal still opens the same server-authored target. This is a
 * CLIENT OVERLAY in the 8C-3 flavor family: the Worker-bundled portal config (city-block.mjs
 * PORTALS — id/zone/target/label) stays byte-identical, routing authority is untouched, and
 * nothing economic rides the name (a PLACE name, never an owner, never a person).
 *
 * Every string is static closed copy screened against the canonical FORBIDDEN_RE — see tests.
 * Unknown block → '' (callers fall back to the server-authored label).
 */
import { FORBIDDEN_RE } from './city-interactions.mjs';

/** Bound for an arcade house name (fits the portal prompt at 360px). */
export const ARCADE_NAME_MAX = 24;

/** Per-block arcade house names — landmark-derived (STATIC CONFIG, display-only). */
const ARCADE_NAMES = Object.freeze({
  'downtown-01': 'Signal Spire Arcade',
  'harbor-02':   'Tide Crane Arcade',
  'skyline-03':  'Beacon Crown Arcade',
  'foundry-04':  'Ember Gantry Arcade',
  'nexus-05':    'Junction Ring Arcade',
  'garden-06':   'Glass Arbor Arcade',
  'aurora-07':   'Aurora Spire Arcade',
  'relay-08':    'Relay Tower Arcade',
  'lumen-09':    'Lumen Beacon Arcade',
});

/** PURE: the block's arcade house name (fresh string). Unknown/missing → ''. */
export function arcadeName(cityId) {
  return (typeof cityId === 'string' && ARCADE_NAMES[cityId]) || '';
}

/** The block ids that carry an arcade name (a fresh array). */
export function arcadeNameIds() {
  return Object.keys(ARCADE_NAMES);
}

/** PURE: true iff a name is non-empty, within bound, and clean of forbidden vocabulary. */
export function arcadeNameIsClean(str) {
  return typeof str === 'string' && str.length > 0 && str.length <= ARCADE_NAME_MAX && !FORBIDDEN_RE.test(str);
}
