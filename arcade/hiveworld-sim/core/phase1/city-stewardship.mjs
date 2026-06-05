/**
 * HiveWorld v1.1 — CONSTRAINED block Stewardship (mirror of product Phase 4F
 * `arcade/city/city-stewardship.mjs`).
 *
 * PURE, deterministic. A block's display-only style can be edited ONLY from a CLOSED allowlist
 * (palette / sign_variant / intensity) — never free text, URLs, or uploads. Edits are GATED by
 * host-rank eligibility, and are REVERSIBLE: reset restores the block default. Nothing here grants
 * economy, ownership, or permanence — it is a display overlay only.
 */
import { getBlock } from './city-blocks.mjs';

export const PALETTES = Object.freeze(['magenta', 'cyan', 'amber', 'violet', 'emerald']);
export const SIGN_VARIANTS = Object.freeze(['classic', 'bold', 'minimal']);
export const INTENSITIES = Object.freeze(['low', 'medium', 'high']);

/** The closed allowlist: field → its set of permitted values. Anything outside this is dropped. */
const ALLOWLIST = Object.freeze({
  palette: new Set(PALETTES),
  sign_variant: new Set(SIGN_VARIANTS),
  intensity: new Set(INTENSITIES),
});
export const STEWARD_FIELDS = Object.freeze(Object.keys(ALLOWLIST));

const THEME_PALETTE = Object.freeze({ 'downtown-magenta': 'magenta', 'harbor-cyan': 'cyan', 'skyline-amber': 'amber' });

/** PURE: a block's DEFAULT style (derived from its Phase 5B theme). The reset target. */
export function defaultStyle(cityId) {
  const b = getBlock(cityId);
  const palette = (b && THEME_PALETTE[b.theme]) || 'magenta';
  return { palette, sign_variant: 'classic', intensity: 'medium' };
}

/** PURE: keep ONLY allowlisted fields with permitted values; drop everything else (no free text). */
export function sanitizeStyleOverride(partial) {
  const out = {};
  const p = partial && typeof partial === 'object' ? partial : {};
  for (const f of STEWARD_FIELDS) {
    if (ALLOWLIST[f].has(p[f])) out[f] = p[f];
  }
  return out;
}

/** PURE: base ⊕ sanitized override → a complete, valid style (new object). */
export function mergeStyle(base, override) {
  return { ...base, ...sanitizeStyleOverride(override) };
}

/** PURE: a complete style is valid iff every field holds an allowlisted value. */
export function isValidStyle(style) {
  if (!style || typeof style !== 'object') return false;
  return STEWARD_FIELDS.every((f) => ALLOWLIST[f].has(style[f]));
}

/** Stewardship eligibility is conferred by Host Rank (host/steward tiers) — a display-edit right,
 *  NOT an economic effect. Below that tier, edits are rejected. */
export function isStewardEligible(hostRank) {
  const tier = hostRank && hostRank.tier;
  return tier === 'host' || tier === 'steward';
}
