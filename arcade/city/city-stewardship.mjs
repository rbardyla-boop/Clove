/**
 * Neon Circuit — Block Stewardship + Constrained Editor (Phase 4F), PURE.
 *
 * A deterministic, NON-CASH, manifest-constrained, reversible visual customization
 * layer for a city BLOCK. A player who has earned enough non-cash Host Rank standing
 * (Phase 4E) on a block becomes *eligible* to make small, server-validated VISUAL
 * edits — arcade-front palette/sign, street-light accent, sidewalk trim — via
 * preview / apply / reset. It is stewardship, not ownership. It is NOT:
 *   land / ownership / rent / income / payout / staking / yield / marketplace /
 *   token / NFT / asset sale / real estate / account entitlement / permanent claim /
 *   free-form UGC / file upload / external asset / arbitrary CSS-HTML-JS injection.
 * It grants nothing economic, moves no one, and touches no collision/portal/economy.
 *
 * Authority: the SERVER owns the canonical block style. The client may PREVIEW edits
 * locally and REQUEST an edit; it can never assert canonical style. This module only
 * VALIDATES and DESCRIBES the outcome — it persists nothing and performs no I/O.
 *
 * Safety by construction: the manifest is a set of CLOSED enum allowlists, and the
 * sanitizer reads ONLY those enum keys. Any css/html/js/url/text/script field a client
 * sends is simply never copied out, so it cannot survive into canonical state, an
 * event payload, the wire, or the renderer.
 *
 * Imported by the CityRoom DO, the city dev shim, the unit tests, the browser scene,
 * and (for accent mapping) the renderers.
 */
import { SCHEMA_VERSION } from './city-block.mjs';

// ===================== constrained-editor manifest (closed allowlists) =====================

/** The only block elements a steward may restyle. */
export const ALLOWED_TARGETS = Object.freeze(['arcade_front', 'street_lights', 'sidewalk_trim']);
/** The only palettes (mapped to the existing in-house neon palette — no arbitrary color). */
export const ALLOWED_PALETTES = Object.freeze(['cyan', 'magenta', 'amber', 'white']);
/** The only arcade sign variants (procedural; arcade_front only). */
export const ALLOWED_SIGN_VARIANTS = Object.freeze(['classic', 'circuit', 'signal']);
/** The only glow intensities. */
export const ALLOWED_INTENSITY = Object.freeze(['low', 'medium', 'high']);

/** Palette token → existing in-palette hex. No free-form color can enter the system. */
export const PALETTE_HEX = Object.freeze({ cyan: '#22e0ff', magenta: '#ff2d95', amber: '#ffb020', white: '#eaf6ff' });
/** Intensity token → glow multiplier the renderers apply to their base shadow blur. */
export const INTENSITY_MULT = Object.freeze({ low: 0.6, medium: 1.0, high: 1.5 });

/** Which sanitized keys each target accepts (everything else is dropped). */
const TARGET_KEYS = Object.freeze({
  arcade_front: Object.freeze(['palette', 'sign_variant', 'intensity']),
  street_lights: Object.freeze(['palette', 'intensity']),
  sidewalk_trim: Object.freeze(['palette']),
});

/** Host Rank tiers / support signals that confer current stewardship eligibility. */
const ELIGIBLE_TIERS = new Set(['helper', 'signaler', 'anchor']);
const ELIGIBLE_SIGNALS = new Set(['steady', 'active']);

/** Stewardship actions a client may request. */
const ACTIONS = new Set(['preview', 'apply', 'reset']);

/**
 * The city-default block style — aligned with the current procedural look (arcade =
 * magenta, street/portal = cyan, sidewalk trim = cyan, classic sign, medium glow), so
 * `reset` returns the block to the canonical city appearance. Deep-cloned on read so
 * callers can never mutate the canonical default.
 */
const DEFAULT_INTERNAL = Object.freeze({
  arcade_front: Object.freeze({ palette: 'magenta', sign_variant: 'classic', intensity: 'medium' }),
  street_lights: Object.freeze({ palette: 'cyan', intensity: 'medium' }),
  sidewalk_trim: Object.freeze({ palette: 'cyan' }),
});
export const DEFAULT_BLOCK_STYLE = DEFAULT_INTERNAL;

/** A fresh, deeply-frozen copy of the city-default block style. */
export function defaultBlockStyle() {
  return freezeStyle({
    arcade_front: { ...DEFAULT_INTERNAL.arcade_front },
    street_lights: { ...DEFAULT_INTERNAL.street_lights },
    sidewalk_trim: { ...DEFAULT_INTERNAL.sidewalk_trim },
  });
}

function freezeStyle(s) {
  for (const t of ALLOWED_TARGETS) if (s[t]) Object.freeze(s[t]);
  return Object.freeze(s);
}

// ===================== eligibility (non-cash, current, non-permanent) =====================

/**
 * PURE: is the block's current Host Rank standing enough to steward? Accepts either the
 * inner `host_rank` object or the full snapshot `{ host_rank }`. Eligibility is a
 * CURRENT block signal — never an ownership right, never permanent, never account-bound.
 */
export function isStewardshipEligible(hostRank) {
  const h = hostRank && typeof hostRank === 'object' ? (hostRank.host_rank || hostRank) : null;
  if (!h || typeof h !== 'object') return false;
  return ELIGIBLE_TIERS.has(h.tier) || ELIGIBLE_SIGNALS.has(h.support_signal);
}

// ===================== sanitize + merge (immutable, allowlist-only) =====================

/**
 * PURE: keep ONLY the manifest-allowed enum fields valid for `target`. Any unknown key
 * (css/html/js/url/text/script/…) and any out-of-enum value is dropped. Returns a new
 * plain object; never mutates `raw`.
 */
export function sanitizeStyle(target, raw) {
  const out = {};
  if (!ALLOWED_TARGETS.includes(target) || !raw || typeof raw !== 'object') return out;
  const keys = TARGET_KEYS[target];
  if (keys.includes('palette') && ALLOWED_PALETTES.includes(raw.palette)) out.palette = raw.palette;
  if (keys.includes('sign_variant') && ALLOWED_SIGN_VARIANTS.includes(raw.sign_variant)) out.sign_variant = raw.sign_variant;
  if (keys.includes('intensity') && ALLOWED_INTENSITY.includes(raw.intensity)) out.intensity = raw.intensity;
  return out;
}

/**
 * PURE: normalize an untrusted/partial canonical block style onto the city default,
 * dropping anything outside the manifest. Guarantees a clean, fully-populated, frozen
 * canonical map regardless of what was stored or sent.
 */
export function normalizeBlockStyle(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const base = defaultBlockStyle();
  const out = {};
  for (const t of ALLOWED_TARGETS) out[t] = { ...base[t], ...sanitizeStyle(t, src[t]) };
  return freezeStyle(out);
}

/** PURE: return a new canonical map with one target's sanitized fields merged in. */
export function mergeBlockStyle(current, target, style) {
  const base = normalizeBlockStyle(current);
  if (!ALLOWED_TARGETS.includes(target)) return base;
  const clean = sanitizeStyle(target, style);
  const out = {};
  for (const t of ALLOWED_TARGETS) out[t] = t === target ? { ...base[t], ...clean } : { ...base[t] };
  return freezeStyle(out);
}

// ===================== evaluate a stewardship request (the entry point) =====================

/**
 * PURE: validate a stewardship request against current Host Rank + canonical style.
 * Deterministic; never mutates inputs; performs no I/O. The caller (DO/shim) decides to
 * persist ONLY on a successful apply/reset — preview never persists.
 *
 * request = { request_id?, action: 'preview'|'apply'|'reset', target?, style? }
 *
 * @returns on success: { ok:true, action, target?, canonical_style, preview_style, reason, public_safe:true }
 *          on failure: { ok:false, action, reason, public_safe:true }
 */
export function evaluateStewardship({ cityId, now = Date.now(), hostRank = null, currentStewardship = null, request = null } = {}) {
  const current = normalizeBlockStyle(currentStewardship);
  const req = request && typeof request === 'object' ? request : {};
  const action = req.action;
  const base = { public_safe: true, city_id: (typeof cityId === 'string' && cityId) ? cityId : 'city', evaluated_at: now };

  if (!ACTIONS.has(action)) return { ok: false, action: null, reason: 'bad_action', ...base };

  // Stewardship — preview, apply, AND reset — requires CURRENT block eligibility.
  if (!isStewardshipEligible(hostRank)) return { ok: false, action, reason: 'host_rank_too_low', ...base };

  if (action === 'reset') {
    const canonical = defaultBlockStyle();
    return { ok: true, action, target: null, canonical_style: canonical, preview_style: canonical, reason: 'reset_to_default', ...base };
  }

  // preview / apply both need a valid target + at least one valid style field.
  const target = req.target;
  if (!ALLOWED_TARGETS.includes(target)) return { ok: false, action, reason: 'bad_target', ...base };
  const clean = sanitizeStyle(target, req.style);
  if (Object.keys(clean).length === 0) return { ok: false, action, reason: 'no_valid_style', ...base };

  const merged = mergeBlockStyle(current, target, clean);
  if (action === 'preview') {
    // canonical is UNCHANGED; the merged style is a non-persistent preview only.
    return { ok: true, action, target, canonical_style: current, preview_style: merged, reason: 'preview', ...base };
  }
  // apply: the merged style becomes canonical (the caller persists it).
  return { ok: true, action, target, canonical_style: merged, preview_style: merged, reason: 'applied', ...base };
}

// ===================== renderer accent mapping + wire payload =====================

/**
 * PURE: map a canonical block style to renderer-friendly accents (hex + glow multiplier).
 * Renderers consume this so the apply/reset outcome is actually visible. Display only.
 */
export function styleToAccents(blockStyle) {
  const s = normalizeBlockStyle(blockStyle);
  const hex = (p) => PALETTE_HEX[p] || PALETTE_HEX.cyan;
  const mult = (i) => INTENSITY_MULT[i] || INTENSITY_MULT.medium;
  return Object.freeze({
    arcade_front: Object.freeze({ color: hex(s.arcade_front.palette), blur: mult(s.arcade_front.intensity), sign_variant: s.arcade_front.sign_variant }),
    street_lights: Object.freeze({ color: hex(s.street_lights.palette), blur: mult(s.street_lights.intensity) }),
    sidewalk_trim: Object.freeze({ color: hex(s.sidewalk_trim.palette) }),
  });
}

/** PURE: public-safe wire payload of the current canonical block style (tokens only). */
export function stewardshipStatePayload(blockStyle) {
  return { schema_version: SCHEMA_VERSION, stewardship: normalizeBlockStyle(blockStyle) };
}

/** PURE: have the canonical block-style tokens changed (apply/reset detection)? */
export function blockStyleChanged(prev, next) {
  return JSON.stringify(normalizeBlockStyle(prev)) !== JSON.stringify(normalizeBlockStyle(next));
}
