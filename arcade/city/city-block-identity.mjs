/**
 * Neon Circuit — Per-block DISPLAY IDENTITY + District Tour (Phase 8C), PURE + cross-env.
 *
 * Content depth, DISPLAY-ONLY. Gives each of the six static blocks a short "what is this place"
 * (`tagline`) and a one-line "why go there" (`why_visit`), drawn to be consistent with the signage the
 * player already reads (the per-block `BLOCK_LABELS` + `theme` in city-block.mjs). It is rendered as
 * supplementary copy ALONGSIDE the existing `display_name`; it interpolates no runtime, player, or
 * economic data, adds NO wire field / DO behaviour / schema bump, and grants NOTHING economic. "Crossing",
 * "calm", "industrial", "hub" are mood/wayfinding copy — not a toll, fee, reward, or buff.
 *
 * The District Tour (OBJ-1) is a SESSION-LOCAL, NON-REWARD traversal count: "N of 6 blocks seen". It is
 * derived purely client-side from the blocks the session has been in, resets on reload, and is never
 * written to a DO/account/ledger. Completing it (6/6) structurally requires using BOTH corridors (the new
 * downtown⇄garden⇄nexus⇄skyline path can't be skipped) — that is the new corridor's "reason to move".
 * It unlocks nothing.
 *
 * Imported by the browser scene (arcade/city/city-scene.js) and the unit tests. See
 * docs/PHASE_8C_DISTRICT_CONTENT_DEPTH.md §1, §3 (OBJ-1), §4 (Polish 1).
 */
import { CITY_IDS } from './city-block.mjs';
import { FORBIDDEN_RE } from './city-interactions.mjs';

/** Longest a tagline/why_visit may be (keeps the district panel readable on a 360px phone). */
export const IDENTITY_TAGLINE_MAX = 24;
export const IDENTITY_WHY_MAX = 64;

/** The neutral fallback for a block with no configured identity (renders no extra copy). */
const NEUTRAL = Object.freeze({ tagline: '', why_visit: '' });

/**
 * Per-block display identity (STATIC CONFIG, display-only). Keyed by canonical city_id; values are pure
 * copy. Every string is screened by the canonical FORBIDDEN_RE guard (see identityCopyIsClean / tests).
 */
const BLOCK_IDENTITY = Object.freeze({
  'downtown-01': Object.freeze({ tagline: 'the hub',        why_visit: 'Central crossroads — three ways out.' }),
  'harbor-02':   Object.freeze({ tagline: 'the waterfront', why_visit: 'Quiet dockside route toward Skyline.' }),
  'skyline-03':  Object.freeze({ tagline: 'the heights',    why_visit: 'High ground where both corridors meet.' }),
  'foundry-04':  Object.freeze({ tagline: 'the works',      why_visit: 'Industrial spur on the original ring.' }),
  'nexus-05':    Object.freeze({ tagline: 'the crossing',   why_visit: "New corridor's pivot, Garden to Skyline." }),
  'garden-06':   Object.freeze({ tagline: 'the green',      why_visit: 'Calm new-corridor entry from Downtown.' }),
});

/** Display identity for a block (fresh object). Unknown/missing cityId → the neutral (empty) fallback. */
export function blockIdentity(cityId) {
  const src = (typeof cityId === 'string' && BLOCK_IDENTITY[cityId]) || NEUTRAL;
  return { tagline: src.tagline, why_visit: src.why_visit };
}

/** The block ids that carry an identity entry (a fresh array). */
export function identityBlockIds() {
  return Object.keys(BLOCK_IDENTITY);
}

/** PURE: true iff a copy string is non-empty, within bounds, and clean of forbidden vocabulary. */
export function identityCopyIsClean(str, max) {
  return typeof str === 'string' && str.length > 0 && str.length <= max && !FORBIDDEN_RE.test(str);
}

/**
 * District Tour progress (OBJ-1) — NON-REWARD, display-only. `visited` is a Set/array of city_ids the
 * session has been in. Returns the count of KNOWN blocks seen out of the live block total (auto-scales
 * with CITY_IDS). Grants nothing; purely a display string.
 */
export function tourProgress(visited) {
  const set = visited instanceof Set ? visited : new Set(Array.isArray(visited) ? visited : []);
  const seen = CITY_IDS.filter((id) => set.has(id)).length;
  const total = CITY_IDS.length;
  return { seen, total, complete: seen >= total };
}
