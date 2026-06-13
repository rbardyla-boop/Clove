/**
 * Named cabinet preset library — PURE, cross-env, no Three.js.
 *
 * Each preset is a complete, valid, DISTINCT cabinet block (run through normalizeCabinet so it can
 * never drift out of vocabulary). These seed the asset library panel so a creator starts from a
 * characterful cabinet, not a blank default. Deliberately varied across shape/screen/panel/palette.
 */

import { normalizeCabinet } from './CabinetConfig.js';

const RAW = {
  'classic-upright': {
    type: 'upright', screen_style: 'crt-curve', marquee_style: 'backlit', marquee_text: 'NEON BLASTER',
    control_panel: 'single-stick', trim_style: 'woodgrain', bevel_style: 'hard', palette: 'neon-red',
    glow_style: 'medium', scanline: 'coarse', decal: 'star-burst', attract_mode: 'screen-cycle',
  },
  'vector-cockpit': {
    type: 'cockpit', screen_style: 'vector-glow', marquee_style: 'halo', marquee_text: 'STAR RUNNER',
    control_panel: 'flight-yoke', trim_style: 'brushed-steel', bevel_style: 'chamfer', palette: 'neon-cyan',
    glow_style: 'high', scanline: 'fine', decal: 'circuit-trace', attract_mode: 'demo-loop',
  },
  'candy-cab': {
    type: 'candy', screen_style: 'flat-lcd', marquee_style: 'blade', marquee_text: 'VERSUS',
    control_panel: 'six-button', trim_style: 'candy-gloss', bevel_style: 'rounded', palette: 'neon-magenta',
    glow_style: 'high', scanline: 'off', decal: 'chevron-stripe', attract_mode: 'marquee-chase',
  },
  'cocktail-table': {
    type: 'cocktail', screen_style: 'flat-lcd', marquee_style: 'none', marquee_text: '',
    control_panel: 'single-stick', trim_style: 'matte-black', bevel_style: 'soft', palette: 'mono-white',
    glow_style: 'low', scanline: 'fine', decal: 'grid-overlay', attract_mode: 'slow-pulse',
  },
  'racer-deluxe': {
    type: 'deluxe', screen_style: 'ultrawide', marquee_style: 'backlit', marquee_text: 'TURBO LAP',
    control_panel: 'flight-yoke', trim_style: 'neon-edge', bevel_style: 'chamfer', palette: 'neon-amber',
    glow_style: 'pulse', scanline: 'fine', decal: 'hazard-edge', attract_mode: 'screen-cycle',
  },
  'rhythm-deck': {
    type: 'widebody', screen_style: 'dual-stack', marquee_style: 'ticker', marquee_text: 'BEAT GRID',
    control_panel: 'dance-pad', trim_style: 'chrome', bevel_style: 'rounded', palette: 'vapor',
    glow_style: 'flicker', scanline: 'off', decal: 'wave-band', attract_mode: 'marquee-chase',
  },
  'shmup-tate': {
    type: 'slim', screen_style: 'portrait-tate', marquee_style: 'blade', marquee_text: 'SKY FORTRESS',
    control_panel: 'single-stick', trim_style: 'matte-black', bevel_style: 'hard', palette: 'neon-violet',
    glow_style: 'high', scanline: 'heavy', decal: 'diamond-row', attract_mode: 'demo-loop',
  },
  'fighter-six': {
    type: 'cabaret', screen_style: 'bubble', marquee_style: 'halo', marquee_text: 'COMBO KING',
    control_panel: 'six-button', trim_style: 'brushed-steel', bevel_style: 'soft', palette: 'toxic',
    glow_style: 'medium', scanline: 'coarse', decal: 'pixel-block', attract_mode: 'screen-cycle',
  },
};

export const CABINET_PRESET_NAMES = Object.freeze(Object.keys(RAW));

/** Get a fresh, normalized (guaranteed valid) cabinet block for a preset name. */
export function cabinetPreset(name) {
  const raw = RAW[name] || RAW['classic-upright'];
  return normalizeCabinet(raw);
}

/** All presets as { name, cabinet } pairs (fresh objects). */
export function listCabinetPresets() {
  return CABINET_PRESET_NAMES.map((name) => ({ name, cabinet: cabinetPreset(name) }));
}
