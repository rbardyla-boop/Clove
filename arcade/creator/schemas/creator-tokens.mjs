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
