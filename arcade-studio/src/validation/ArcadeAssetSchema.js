/**
 * Closed schema for an ARCADE CABINET ASSET — PURE, cross-env, no Three.js.
 *
 * Declares the exact allowed key sets and the closed-token bindings for each field. The validator
 * (validateArcadeAsset.js) enforces these. Every option is a token from validation/tokens.js or a
 * bounded clean string — there is no free-form runtime surface.
 */

import {
  ASSET_KIND, SCHEMA_VERSION,
  CABINET_TYPES, SCREEN_STYLES, MARQUEE_STYLES, CONTROL_PANELS, TRIM_STYLES, BEVEL_STYLES,
  GLOW_STYLES, SCANLINE_STYLES, CABINET_DECALS, ATTRACT_MODES, PALETTES,
  SCREEN_SHAKE_NAMES, PARTICLE_NAMES,
} from './tokens.js';

export const ASSET_TOP_KEYS = Object.freeze([
  'schema_version', 'asset_kind', 'asset_id', 'display_name', 'cabinet', 'effects', 'metadata', 'constraints',
]);
export const ASSET_REQUIRED_KEYS = Object.freeze([
  'schema_version', 'asset_kind', 'asset_id', 'cabinet', 'constraints',
]);

export const CABINET_KEYS = Object.freeze([
  'type', 'screen_style', 'marquee_style', 'marquee_text', 'control_panel', 'trim_style',
  'bevel_style', 'palette', 'glow_style', 'scanline', 'decal', 'attract_mode',
]);
export const CABINET_REQUIRED_KEYS = Object.freeze([
  'type', 'screen_style', 'marquee_style', 'control_panel', 'trim_style', 'bevel_style',
  'palette', 'glow_style', 'scanline', 'decal', 'attract_mode',
]);

/** Each cabinet field → the closed set it must belong to (marquee_text is bounded clean text). */
export const CABINET_ENUMS = Object.freeze({
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
});

export const EFFECTS_KEYS = Object.freeze(['screen_shake', 'particle']);
export const EFFECTS_ENUMS = Object.freeze({
  screen_shake: SCREEN_SHAKE_NAMES,
  particle: ['none', ...PARTICLE_NAMES],
});

export const METADATA_KEYS = Object.freeze(['tags', 'note']);

export const ASSET_IDENTITY = Object.freeze({ kind: ASSET_KIND, version: SCHEMA_VERSION });
