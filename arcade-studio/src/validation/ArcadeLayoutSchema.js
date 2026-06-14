/**
 * Closed schema for an ARCADE BUILDING LAYOUT — PURE, cross-env, no Three.js.
 *
 * A layout is a grid of placed elements (floor, walls, entrances, props, signs, cabinets, zones)
 * plus scene-level lighting/effects. Every element references closed tokens from validation/tokens.js
 * and bounded integers. Cabinets are embedded inline (their own closed cabinet block) so a layout
 * round-trips with no external registry.
 */

import {
  LAYOUT_KIND, SCHEMA_VERSION,
  THEMES, FLOOR_MATERIALS, WALL_MATERIALS, PROP_TYPES, SIGN_STYLES, SIGN_PLACEMENTS,
  ENTRANCE_STYLES, ZONE_KINDS, LIGHTING_ZONE_PRESETS, AMBIENCE_ZONE_PRESETS, PALETTES,
  SCREEN_SHAKE_NAMES, PARTICLE_NAMES,
} from './tokens.js';

export const LAYOUT_TOP_KEYS = Object.freeze([
  'schema_version', 'asset_kind', 'layout_id', 'display_name', 'theme', 'grid', 'floor',
  'walls', 'entrances', 'props', 'signs', 'cabinets', 'zones', 'lighting', 'effects',
  'metadata', 'constraints',
]);
export const LAYOUT_REQUIRED_KEYS = Object.freeze([
  'schema_version', 'asset_kind', 'layout_id', 'theme', 'grid', 'floor', 'constraints',
]);

export const INTENSITY_LEVELS = Object.freeze(['low', 'medium', 'high']);
export const FACINGS = Object.freeze(['north', 'south', 'east', 'west']);
export const ROTATIONS = Object.freeze([0, 90, 180, 270]);

export const GRID_KEYS = Object.freeze(['cols', 'rows']);
export const FLOOR_KEYS = Object.freeze(['material']);
export const WALL_KEYS = Object.freeze(['material', 'gx', 'gy', 'length', 'orientation']);
export const ENTRANCE_KEYS = Object.freeze(['style', 'gx', 'gy', 'facing']);
export const PROP_KEYS = Object.freeze(['type', 'gx', 'gy', 'rotation', 'layer']);
export const SIGN_KEYS = Object.freeze(['style', 'text', 'placement', 'gx', 'gy', 'palette']);
export const CABINET_PLACEMENT_KEYS = Object.freeze(['cabinet', 'source_hash', 'gx', 'gy', 'rotation', 'layer']);
export const ZONE_KEYS = Object.freeze(['kind', 'preset', 'palette', 'gx', 'gy', 'cols', 'rows', 'intensity']);
export const LIGHTING_KEYS = Object.freeze(['ambient', 'intensity', 'bloom', 'accent']);
export const EFFECTS_KEYS = Object.freeze(['screen_shake', 'particle']);
export const METADATA_KEYS = Object.freeze(['tags', 'note']);

export const ENUMS = Object.freeze({
  theme: THEMES,
  floorMaterial: FLOOR_MATERIALS,
  wallMaterial: WALL_MATERIALS,
  propType: PROP_TYPES,
  signStyle: SIGN_STYLES,
  signPlacement: SIGN_PLACEMENTS,
  entranceStyle: ENTRANCE_STYLES,
  zoneKind: ZONE_KINDS,
  lightingZonePreset: LIGHTING_ZONE_PRESETS,
  ambienceZonePreset: AMBIENCE_ZONE_PRESETS,
  palette: PALETTES,
  intensity: INTENSITY_LEVELS,
  facing: FACINGS,
  rotation: ROTATIONS,
  screenShake: SCREEN_SHAKE_NAMES,
  particle: ['none', ...PARTICLE_NAMES],
});

export const LAYOUT_IDENTITY = Object.freeze({ kind: LAYOUT_KIND, version: SCHEMA_VERSION });
