/**
 * Cabinet config normalization — PURE, cross-env, no Three.js.
 *
 * The inspector only ever offers closed options, but `normalizeCabinet` is the safety net: it coerces
 * ANY partial/untrusted cabinet config into a fully-populated block whose every field is a valid
 * closed token. Unknown tokens fall back to a sensible default; marquee text is sanitized to clean,
 * bounded text. This guarantees the editor's render + export paths never see an out-of-vocabulary value.
 */

import {
  CABINET_TYPES, SCREEN_STYLES, MARQUEE_STYLES, CONTROL_PANELS, TRIM_STYLES, BEVEL_STYLES,
  GLOW_STYLES, SCANLINE_STYLES, CABINET_DECALS, ATTRACT_MODES, PALETTES, LIMITS,
} from '../validation/tokens.js';
import { utf8Bytes, FORBIDDEN_CONTENT_RE, FORBIDDEN_TERMS_RE } from '../validation/safety.js';
import { SeededRandom } from '../utils/random.js';

export const DEFAULT_CABINET = Object.freeze({
  type: 'upright',
  screen_style: 'crt-curve',
  marquee_style: 'backlit',
  marquee_text: 'ARCADE',
  control_panel: 'single-stick',
  trim_style: 'chrome',
  bevel_style: 'soft',
  palette: 'neon-cyan',
  glow_style: 'medium',
  scanline: 'fine',
  decal: 'none',
  attract_mode: 'slow-pulse',
});

const FIELD_SETS = {
  type: CABINET_TYPES,
  screen_style: SCREEN_STYLES,
  marquee_style: MARQUEE_STYLES,
  control_panel: CONTROL_PANELS,
  trim_style: TRIM_STYLES,
  bevel_style: BEVEL_STYLES,
  palette: PALETTES,
  glow_style: GLOW_STYLES,
  scanline: SCANLINE_STYLES,
  decal: CABINET_DECALS,
  attract_mode: ATTRACT_MODES,
};

/** Sanitize free-typed marquee text to clean, bounded text. Returns '' if it cannot be made safe. */
export function sanitizeMarquee(text) {
  if (typeof text !== 'string') return '';
  // Reject hostile content FIRST — never return a truncated piece of a script/url/template.
  if (FORBIDDEN_CONTENT_RE.test(text) || FORBIDDEN_TERMS_RE.test(text)) return '';
  // Then byte-bound safely (drop trailing chars until within the UTF-8 budget).
  let out = text;
  while (out.length && utf8Bytes(out) > LIMITS.MARQUEE_BYTES) out = out.slice(0, -1);
  return out.trim();
}

/** Coerce any partial config into a fully valid closed cabinet block. */
export function normalizeCabinet(partial = {}) {
  const out = {};
  for (const [field, set] of Object.entries(FIELD_SETS)) {
    out[field] = set.includes(partial[field]) ? partial[field] : DEFAULT_CABINET[field];
  }
  out.marquee_text = 'marquee_text' in partial ? sanitizeMarquee(partial.marquee_text) : DEFAULT_CABINET.marquee_text;
  return out;
}

/** A fresh default cabinet block. */
export function defaultCabinet() {
  return { ...DEFAULT_CABINET };
}

/** Deterministically generate a varied (but always valid) cabinet from a seed — used by "randomize". */
export function randomCabinet(seed = 'cabinet') {
  const r = new SeededRandom(seed);
  const block = {};
  for (const [field, set] of Object.entries(FIELD_SETS)) block[field] = r.pick(set);
  block.marquee_text = r.pick(['ARCADE', 'NEON', 'HI-SCORE', 'PLAYER 1', 'INSERT', 'BONUS STAGE', 'GAME ON']);
  return normalizeCabinet(block);
}
