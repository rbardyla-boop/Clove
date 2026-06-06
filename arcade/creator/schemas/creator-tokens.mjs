/**
 * Creator Foundation CF-1 — shared TOKEN VOCABULARY (closed allowlists), PURE + cross-env.
 *
 * Original, procedural, neon-arcade tokens. Deliberately rich (8 palettes x 8 facades x 5 signs
 * x 5 lighting x 7 accents x 5 tile accents) so authored blocks feel ALIVE and distinct — never a
 * template world where every block is the same — while staying a CLOSED set: no free-form colors,
 * no external assets, no copied franchise art. Hex values are in-house neon, not sampled from any
 * commercial game. Imported by the schemas, the validator, the iso renderer, and the editor.
 */

/** Palette token → in-house neon hex (procedural fills/strokes only — no textures). */
export const PALETTE_HEX = Object.freeze({
  'neon-blue': '#2b5cff', 'neon-cyan': '#22e0ff', 'neon-magenta': '#ff2d95', 'neon-amber': '#ffb020',
  'neon-green': '#36f5a2', 'neon-violet': '#a06bff', 'neon-red': '#ff5a5a', 'mono-white': '#eaf6ff',
});
export const PALETTES = Object.freeze(Object.keys(PALETTE_HEX));

/** Accent (trim) token → hex, plus an explicit "none". */
export const ACCENT_HEX = Object.freeze({
  'cyan-trim': '#22e0ff', 'magenta-trim': '#ff2d95', 'amber-trim': '#ffb020',
  'green-trim': '#36f5a2', 'violet-trim': '#a06bff', 'white-trim': '#eaf6ff', 'none': 'transparent',
});
export const ACCENTS = Object.freeze(Object.keys(ACCENT_HEX));

/** Procedural facade geometry presets (drawn as shapes, never images). */
export const FACADE_PATTERNS = Object.freeze([
  'grid-window', 'grid-window-tall', 'lattice', 'terraced', 'panel-stack', 'ribbed', 'billboard-face', 'arches',
]);

/** Procedural sign presets (arcade marquee shapes). */
export const SIGN_VARIANTS = Object.freeze(['small-marquee', 'blade', 'halo', 'ticker', 'none']);

/** Lighting token → glow multiplier the renderer applies to base shadow blur. */
export const LIGHTING_GLOW = Object.freeze({ off: 0, low: 0.5, medium: 1, high: 1.6, pulse: 1.2 });
export const LIGHTINGS = Object.freeze(Object.keys(LIGHTING_GLOW));

/** Ground/tile accent presets. */
export const TILE_ACCENTS = Object.freeze(['plain', 'hazard-stripe', 'dotmatrix', 'circuit', 'none']);

/** Which live block a style targets (display routing only — never ownership). */
export const TARGET_CITY_IDS = Object.freeze(['downtown-01', 'harbor-02', 'skyline-03', 'foundry-04', 'generic']);

export const hexForPalette = (t) => PALETTE_HEX[t] || PALETTE_HEX['neon-cyan'];
export const hexForAccent = (t) => ACCENT_HEX[t] || 'transparent';
export const glowForLighting = (t) => (t in LIGHTING_GLOW ? LIGHTING_GLOW[t] : 1);

/* ─────────────────────────────────────────────────────────────────────────────────────────────
 * CF-3 — LAYERED block customization tokens. ADDITIVE ONLY: every export below is NEW; nothing
 * above is changed, so the closed `block_style` (CF-1) contract stays byte-frozen. These extend the
 * vocabulary so a `block_layered` package can compose 6 procedural layer dimensions from a still
 * CLOSED, validatable token set — no free-form colors, numbers, images, or URLs.
 * ───────────────────────────────────────────────────────────────────────────────────────────── */

/** Facade patterns for LAYERED blocks = the CF-1 set + 5 new procedural presets. (block_style keeps FACADE_PATTERNS.) */
export const FACADE_PATTERNS_LAYERED = Object.freeze([
  ...FACADE_PATTERNS, 'brutalist-block', 'pixel-columns', 'neon-mesh', 'wave-ribbed', 'stepped-terrace',
]);

/** Where a sign sits on the building (offsets the existing SIGN_VARIANTS shape; closed enum). */
export const SIGN_PLACEMENTS = Object.freeze(['apex', 'upper-left', 'upper-center', 'upper-right', 'none']);

/** Symbol/decal marks — each is a PROCEDURAL shape in the renderer's decal switch (no images). 'none' = nothing. */
export const DECAL_TOKENS = Object.freeze([
  'decal-star-burst', 'decal-light-burst', 'decal-circuit-burst',          // burst family
  'decal-grid-overlay', 'decal-grid-sparse', 'decal-neon-grid',            // grid family
  'decal-chevron-up', 'decal-chevron-down', 'decal-diamond', 'decal-hexagon', // angular family
  'decal-hazard-stripe', 'decal-diagonal-stripe',                          // stripe family
  'decal-circuit-path', 'decal-dot-trail', 'decal-pixel-block', 'none',    // tech family + explicit none
]);
/** Nine anchor cells on a face; mapped to a face fraction by the renderer. */
export const DECAL_POSITIONS = Object.freeze([
  'upper-left', 'upper-center', 'upper-right', 'center-left', 'center', 'center-right',
  'lower-left', 'lower-center', 'lower-right',
]);
/** Decal scale as a closed STRING enum (never a free number → no arbitrary-value surface). */
export const DECAL_SCALES = Object.freeze(['0.5', '0.75', '1.0', '1.25', '1.5']);
export const DECAL_SCALE_MUL = Object.freeze({ '0.5': 0.5, '0.75': 0.75, '1.0': 1, '1.25': 1.25, '1.5': 1.5 });

/** Window grid presets (procedural) + density token → [cols,rows]. No free col/row integers. */
export const WINDOW_GRID_TYPES = Object.freeze([
  'glass-bright', 'glass-dark', 'glass-neon', 'shutter-closed', 'shutter-half', 'shutter-open', 'neon-tube',
]);
export const WINDOW_DENSITIES = Object.freeze(['sparse', 'medium', 'dense', 'ultra']);
export const WINDOW_DENSITY_GRID = Object.freeze({ sparse: [2, 2], medium: [4, 4], dense: [6, 6], ultra: [8, 8] });

/** Roof accents (apex shapes) + optional decorative roof pattern. Highlight reuses ACCENTS. */
export const ROOF_ACCENTS = Object.freeze(['ridge-sharp', 'ridge-soft', 'dome-profile', 'flat-parapet', 'antenna-spike', 'beacon-pod']);
export const ROOF_PATTERNS = Object.freeze(['none', 'ridges', 'vents', 'lights']);

/** The four nameable glow zones. Per-zone glow reuses LIGHTINGS/LIGHTING_GLOW; flicker is a boolean. */
export const LIGHTING_ZONE_IDS = Object.freeze(['left-face', 'right-face', 'roof', 'tile']);

/** Optional single coherent recolor theme — applied procedurally by the renderer (no per-color overrides). */
export const PALETTE_VARIANTS = Object.freeze(['neon-arcade-v1', 'neon-arcade-dark', 'neon-arcade-warm', 'neon-arcade-cool', 'retro-mono']);
export const PALETTE_VARIANT_TRANSFORM = Object.freeze({
  'neon-arcade-v1': { hueShift: 0, sat: 1.0, val: 1.0 },
  'neon-arcade-dark': { hueShift: 0, sat: 0.9, val: 0.45 },
  'neon-arcade-warm': { hueShift: 20, sat: 1.0, val: 1.0 },
  'neon-arcade-cool': { hueShift: -20, sat: 1.0, val: 1.0 },
  'retro-mono': { hueShift: 0, sat: 0.0, val: 1.0 },
});

/** Color slot that accepts EITHER a palette or an accent token (used by decals). */
export const COLOR_SLOT_TOKENS = Object.freeze([...PALETTES, ...ACCENTS]);
export const hexForColorSlot = (t) => (t in PALETTE_HEX ? PALETTE_HEX[t] : (t in ACCENT_HEX ? ACCENT_HEX[t] : 'transparent'));
export const decalScaleMul = (t) => (t in DECAL_SCALE_MUL ? DECAL_SCALE_MUL[t] : 1);
