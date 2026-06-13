/**
 * CLOSED token vocabulary for Arcade Studio — PURE, cross-env, no Three.js.
 *
 * Single source of truth for every authorable option. Deliberately RICH (many palettes, shapes,
 * screens, panels, props, themes) so authored arcades feel alive and distinct — never a template
 * world where every cabinet is the same — while staying a CLOSED set: no free-form colors, numbers,
 * images, URLs, or scripts. Schemas, validators, the editor inspector, and the Three.js builders all
 * resolve choices through these tables. Hex values are in-house neon, not sampled from any product.
 *
 * The screen-shake and particle preset TABLES live here too (bounded numbers only) so validation can
 * stay Three.js-free while the effect modules consume the exact same source of truth.
 */

import { hexToInt } from '../utils/colors.js';

/* ──────────────────────────────────────────────────────────────────────────
 * Bounds / limits (named constants — no magic numbers downstream)
 * ────────────────────────────────────────────────────────────────────────── */
export const LIMITS = Object.freeze({
  GRID_MIN: 4,
  GRID_MAX: 48,
  CELL_SIZE: 2, // world units per grid cell
  MAX_CABINETS: 256,
  MAX_PROPS: 512,
  MAX_SIGNS: 64,
  MAX_ZONES: 64,
  MAX_WALLS: 256,
  MAX_TAGS: 8,
  TAG_BYTES: 24,
  MARQUEE_BYTES: 24,
  NAME_BYTES: 48,
  NOTE_BYTES: 160,
  ROTATION_STEPS: 4, // 0, 90, 180, 270
  MAX_LAYER: 7,
  ASSET_BYTES: 16384,
  LAYOUT_BYTES: 262144,
});

/* ──────────────────────────────────────────────────────────────────────────
 * Palettes — each token resolves to a coordinated 5-color set (base/accent/screen/glow/trim).
 * ────────────────────────────────────────────────────────────────────────── */
export const PALETTE_HEX = Object.freeze({
  'neon-blue': { base: '#16203f', accent: '#2b5cff', screen: '#7fa8ff', glow: '#2b5cff', trim: '#9ec2ff' },
  'neon-cyan': { base: '#08303a', accent: '#22e0ff', screen: '#9bf3ff', glow: '#22e0ff', trim: '#caffff' },
  'neon-magenta': { base: '#2a0a24', accent: '#ff2d95', screen: '#ff8fc6', glow: '#ff2d95', trim: '#ffc4e3' },
  'neon-amber': { base: '#2e1c05', accent: '#ffb020', screen: '#ffd984', glow: '#ffb020', trim: '#ffe9bf' },
  'neon-green': { base: '#06281b', accent: '#36f5a2', screen: '#9bffd6', glow: '#36f5a2', trim: '#d2ffec' },
  'neon-violet': { base: '#1c1033', accent: '#a06bff', screen: '#cdb4ff', glow: '#a06bff', trim: '#e7dbff' },
  'neon-red': { base: '#2c0b0b', accent: '#ff5a5a', screen: '#ffa1a1', glow: '#ff5a5a', trim: '#ffd0d0' },
  'mono-white': { base: '#1a1d22', accent: '#eaf6ff', screen: '#ffffff', glow: '#cfe7ff', trim: '#ffffff' },
  sunset: { base: '#2b1233', accent: '#ff7a3d', screen: '#ffd1a6', glow: '#ff4f7a', trim: '#ffd9c2' },
  vapor: { base: '#1b1145', accent: '#ff71ce', screen: '#b9f7ff', glow: '#01cdfe', trim: '#fff7a1' },
  toxic: { base: '#0e2207', accent: '#b6ff2e', screen: '#e6ff9b', glow: '#7cff00', trim: '#dcffb0' },
  'mono-noir': { base: '#0c0d10', accent: '#3a4046', screen: '#9aa3ad', glow: '#5b6670', trim: '#c2cad2' },
});
export const PALETTES = Object.freeze(Object.keys(PALETTE_HEX));

/** Resolve a palette token to integer colors for Three.js (closed; bad token → neon-cyan). */
export function resolvePalette(token) {
  const p = PALETTE_HEX[token] || PALETTE_HEX['neon-cyan'];
  return {
    base: hexToInt(p.base),
    accent: hexToInt(p.accent),
    screen: hexToInt(p.screen),
    glow: hexToInt(p.glow),
    trim: hexToInt(p.trim),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Cabinet vocabulary
 * ────────────────────────────────────────────────────────────────────────── */
export const CABINET_TYPES = Object.freeze([
  'upright', 'cabaret', 'cocktail', 'deluxe', 'cockpit', 'candy', 'slim', 'widebody',
]);
export const SCREEN_STYLES = Object.freeze([
  'crt-curve', 'flat-lcd', 'vector-glow', 'dual-stack', 'ultrawide', 'portrait-tate', 'bubble',
]);
export const MARQUEE_STYLES = Object.freeze(['backlit', 'halo', 'blade', 'ticker', 'none']);
export const CONTROL_PANELS = Object.freeze([
  'single-stick', 'dual-stick', 'six-button', 'trackball', 'spinner', 'flight-yoke', 'dance-pad', 'none',
]);
export const TRIM_STYLES = Object.freeze([
  'chrome', 'matte-black', 'woodgrain', 'neon-edge', 'brushed-steel', 'candy-gloss',
]);
export const BEVEL_STYLES = Object.freeze(['hard', 'soft', 'chamfer', 'rounded']);
export const SCANLINE_STYLES = Object.freeze(['off', 'fine', 'coarse', 'heavy']);
export const ATTRACT_MODES = Object.freeze(['off', 'slow-pulse', 'marquee-chase', 'screen-cycle', 'demo-loop']);
export const CABINET_DECALS = Object.freeze([
  'none', 'star-burst', 'chevron-stripe', 'grid-overlay', 'hazard-edge', 'circuit-trace',
  'pixel-block', 'diamond-row', 'wave-band',
]);

/** Glow token → emissive intensity multiplier the materials layer applies. */
export const GLOW_INTENSITY = Object.freeze({ off: 0, low: 0.4, medium: 0.9, high: 1.6, pulse: 1.1, flicker: 1.0 });
export const GLOW_STYLES = Object.freeze(Object.keys(GLOW_INTENSITY));

/** Scanline token → overlay opacity. */
export const SCANLINE_OPACITY = Object.freeze({ off: 0, fine: 0.12, coarse: 0.22, heavy: 0.36 });

/* ──────────────────────────────────────────────────────────────────────────
 * Building / layout vocabulary
 * ────────────────────────────────────────────────────────────────────────── */
export const THEMES = Object.freeze(['neon-circuit', 'foundry', 'garden', 'harbor', 'skyline', 'nexus']);

/** Theme token → coordinated environment tokens (all closed). */
export const THEME_DEF = Object.freeze({
  'neon-circuit': { floor: 'neon-grid', wall: 'panel-dark', fog: '#0a0f1f', fogDensity: 'low', ambient: 'neon-blue', accent: 'neon-cyan' },
  foundry: { floor: 'concrete-seal', wall: 'ribbed-metal', fog: '#1a120a', fogDensity: 'medium', ambient: 'neon-amber', accent: 'neon-red' },
  garden: { floor: 'carpet-retro', wall: 'mural-abstract', fog: '#0c1a10', fogDensity: 'low', ambient: 'neon-green', accent: 'neon-violet' },
  harbor: { floor: 'glossy-tile', wall: 'glass-tint', fog: '#081820', fogDensity: 'medium', ambient: 'neon-cyan', accent: 'neon-blue' },
  skyline: { floor: 'circuit-weave', wall: 'glass-tint', fog: '#101326', fogDensity: 'low', ambient: 'neon-violet', accent: 'neon-magenta' },
  nexus: { floor: 'hazard-grid', wall: 'panel-dark', fog: '#160a22', fogDensity: 'high', ambient: 'neon-magenta', accent: 'vapor' },
});

export const FLOOR_MATERIALS = Object.freeze([
  'glossy-tile', 'hazard-grid', 'circuit-weave', 'carpet-retro', 'concrete-seal', 'neon-grid',
]);
export const WALL_MATERIALS = Object.freeze([
  'panel-dark', 'brick-neon', 'glass-tint', 'ribbed-metal', 'mural-abstract', 'concrete-seal',
]);
export const FOG_DENSITY = Object.freeze({ off: 0, low: 0.012, medium: 0.025, high: 0.045 });

/** Closed prop library — neutral arcade-interior set pieces (no economy/ownership objects). */
export const PROP_TYPES = Object.freeze([
  'stool', 'bench', 'planter', 'speaker-stack', 'rope-post', 'standee', 'pillar', 'trash-bin',
  'neon-arch', 'crate-stack', 'info-kiosk', 'water-cooler',
]);

/** Closed signage vocabulary. */
export const SIGN_STYLES = Object.freeze(['blade', 'halo', 'ticker', 'billboard', 'arrow', 'none']);
export const SIGN_PLACEMENTS = Object.freeze(['apex', 'entrance', 'wall-left', 'wall-right', 'ceiling']);

/** Entrance presets. */
export const ENTRANCE_STYLES = Object.freeze(['open-arch', 'glass-doors', 'turnstile-gate', 'neon-portal', 'none']);

/** Zone kinds and their closed preset vocabularies. */
export const ZONE_KINDS = Object.freeze(['lighting', 'ambience']);
export const LIGHTING_ZONE_PRESETS = Object.freeze(['neon-strip', 'spotlight', 'wash', 'accent', 'ambient-fill']);
export const AMBIENCE_ZONE_PRESETS = Object.freeze(['fog-light', 'haze', 'glow-pool', 'calm', 'none']);

/* ──────────────────────────────────────────────────────────────────────────
 * Screen-shake presets (bounded numbers only). Axis is a closed enum.
 * amplitude in world units, frequency in Hz, duration in seconds, falloff curve, axis mask.
 * ────────────────────────────────────────────────────────────────────────── */
export const SHAKE_AXES = Object.freeze(['xy', 'x', 'y', 'xyz']);
export const SHAKE_FALLOFFS = Object.freeze(['linear', 'ease-out', 'ease-in-out', 'bounce']);

export const SHAKE_BOUNDS = Object.freeze({
  amplitude: [0, 0.6], frequency: [0, 40], duration: [0, 2.5],
});

export const SCREEN_SHAKE_PRESETS = Object.freeze({
  none: { amplitude: 0, frequency: 0, duration: 0, falloff: 'linear', axis: 'xy' },
  subtle: { amplitude: 0.025, frequency: 14, duration: 0.18, falloff: 'ease-out', axis: 'xy' },
  pulse: { amplitude: 0.06, frequency: 9, duration: 0.32, falloff: 'ease-in-out', axis: 'y' },
  impact: { amplitude: 0.16, frequency: 22, duration: 0.28, falloff: 'ease-out', axis: 'xy' },
  rumble: { amplitude: 0.09, frequency: 30, duration: 0.9, falloff: 'linear', axis: 'xyz' },
  cinematic: { amplitude: 0.22, frequency: 6, duration: 1.2, falloff: 'bounce', axis: 'xy' },
});
export const SCREEN_SHAKE_NAMES = Object.freeze(Object.keys(SCREEN_SHAKE_PRESETS));

/* ──────────────────────────────────────────────────────────────────────────
 * Particle presets (bounded). count is a HARD cap; spawn shapes + blend modes are closed enums.
 * ────────────────────────────────────────────────────────────────────────── */
export const PARTICLE_SPAWN_SHAPES = Object.freeze(['point', 'disc', 'ring', 'box', 'cone', 'column']);
export const PARTICLE_BLEND_MODES = Object.freeze(['additive', 'normal']);

export const PARTICLE_BOUNDS = Object.freeze({
  count: [0, 600], lifetime: [0.1, 8], size: [0.01, 0.6], speed: [0, 6],
});

export const PARTICLE_PRESETS = Object.freeze({
  sparks: { count: 120, lifetime: 0.7, size: 0.05, speed: 3.2, palette: 'neon-amber', spawn: 'cone', blend: 'additive', gravity: -3.0, fade: 'out' },
  dust: { count: 80, lifetime: 4.0, size: 0.04, speed: 0.25, palette: 'mono-white', spawn: 'box', blend: 'normal', gravity: -0.05, fade: 'inout' },
  'neon-motes': { count: 140, lifetime: 5.0, size: 0.06, speed: 0.4, palette: 'neon-cyan', spawn: 'column', blend: 'additive', gravity: 0.08, fade: 'inout' },
  'pixel-burst': { count: 200, lifetime: 0.6, size: 0.08, speed: 4.0, palette: 'neon-magenta', spawn: 'ring', blend: 'additive', gravity: -1.5, fade: 'out' },
  'smoke-puff': { count: 60, lifetime: 2.4, size: 0.22, speed: 0.6, palette: 'mono-noir', spawn: 'disc', blend: 'normal', gravity: 0.4, fade: 'inout' },
  'portal-shimmer': { count: 180, lifetime: 3.0, size: 0.05, speed: 1.0, palette: 'neon-violet', spawn: 'ring', blend: 'additive', gravity: 0.0, fade: 'inout' },
  'cabinet-glow': { count: 90, lifetime: 2.0, size: 0.045, speed: 0.3, palette: 'neon-blue', spawn: 'column', blend: 'additive', gravity: 0.15, fade: 'inout' },
});
export const PARTICLE_NAMES = Object.freeze(Object.keys(PARTICLE_PRESETS));
export const PARTICLE_FADES = Object.freeze(['in', 'out', 'inout', 'none']);

/* ──────────────────────────────────────────────────────────────────────────
 * Schema identity constants
 * ────────────────────────────────────────────────────────────────────────── */
export const ASSET_KIND = 'arcade_cabinet_asset';
export const LAYOUT_KIND = 'arcade_building_layout';
export const SCHEMA_VERSION = 1;

/** Required self-describing safety constraints every export must assert true. */
export const REQUIRED_CONSTRAINTS = Object.freeze({
  no_external_assets: true,
  no_scripts: true,
  no_live_world_load: true,
  local_only: true,
});

export const ID_RE = /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/;
export const TAG_RE = /^[a-z0-9][a-z0-9-]{0,22}[a-z0-9]$/;
export const HASH_RE = /^sha256:[0-9a-f]{64}$/;
