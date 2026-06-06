/**
 * Creator Foundation CF-3 — Layered Block Package SCHEMA (data-only), PURE + cross-env.
 *
 * A `block_layered` package is a small, immutable, DATA-ONLY description of a constrained, LAYERED
 * restyle of a city block: a facade + windows + roof + per-zone lighting (required) and an optional
 * sign + up to 6 symbol/decal marks, plus an optional single palette-variant recolor theme. It is a
 * NEW package kind — the flat `block_style` (CF-1) contract is untouched. Like block_style it is NOT
 * live state and carries NO code: every value is a CLOSED token (creator-tokens.mjs), every count is
 * bounded, and any unknown top-level / layer / element key is a REJECTION (never a silent drop).
 */
import {
  FACADE_PATTERNS_LAYERED, SIGN_VARIANTS, SIGN_PLACEMENTS,
  DECAL_TOKENS, DECAL_POSITIONS, DECAL_SCALES, COLOR_SLOT_TOKENS,
  WINDOW_GRID_TYPES, WINDOW_DENSITIES, ROOF_ACCENTS, ROOF_PATTERNS,
  LIGHTING_ZONE_IDS, LIGHTINGS, PALETTES, ACCENTS, PALETTE_VARIANTS, TARGET_CITY_IDS,
} from './creator-tokens.mjs';

export const PACKAGE_KIND = 'block_layered';
export const SCHEMA_VERSION = 1;

/** A layered package is still tiny (procedural-only). 12 KiB is generous for the full layer tree. */
export const SIZE_BUDGET_BYTES = 12288;
export const PACKAGE_ID_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;   // kebab, 3..48 (shared with block_style)
export const DISPLAY_NAME_MAX = 40;

export const MAX_SYMBOLS = 6;     // APB faces rarely exceed ~6 decals; tighter than isPlainData's 64 ceiling
export const MAX_ZONES = 4;       // exactly the four LIGHTING_ZONE_IDS

export const ALLOWED_TOP_KEYS = Object.freeze([
  'schema_version', 'package_kind', 'package_id', 'display_name', 'target_city_id',
  'palette_variant', 'layers', 'constraints',
]);
export const REQUIRED_TOP_KEYS = Object.freeze([
  'schema_version', 'package_kind', 'package_id', 'target_city_id', 'layers', 'constraints',
]);

/** `layers` is a fixed-key object (NOT an array) so every sub-schema is statically known. */
export const ALLOWED_LAYER_KINDS = Object.freeze(['facade', 'sign', 'symbols', 'windows', 'roof', 'lighting_zones']);
export const REQUIRED_LAYER_KINDS = Object.freeze(['facade', 'windows', 'roof', 'lighting_zones']);

/** Each layer's exact key set + the closed token allowlist for each field. */
export const FACADE_KEYS = Object.freeze(['pattern', 'primary_color', 'secondary_color', 'trim']);
export const FACADE_FIELDS = Object.freeze({
  pattern: FACADE_PATTERNS_LAYERED, primary_color: PALETTES, secondary_color: PALETTES, trim: ACCENTS,
});

export const SIGN_KEYS = Object.freeze(['variant', 'color', 'placement']);
export const SIGN_FIELDS = Object.freeze({ variant: SIGN_VARIANTS, color: PALETTES, placement: SIGN_PLACEMENTS });

export const SYMBOL_KEYS = Object.freeze(['token', 'position', 'color', 'scale']);
export const SYMBOL_FIELDS = Object.freeze({ token: DECAL_TOKENS, position: DECAL_POSITIONS, color: COLOR_SLOT_TOKENS, scale: DECAL_SCALES });

export const WINDOW_KEYS = Object.freeze(['grid_type', 'density', 'glow_color']);
export const WINDOW_FIELDS = Object.freeze({ grid_type: WINDOW_GRID_TYPES, density: WINDOW_DENSITIES, glow_color: PALETTES });

export const ROOF_KEYS = Object.freeze(['accent_type', 'highlight', 'pattern']);
export const ROOF_FIELDS = Object.freeze({ accent_type: ROOF_ACCENTS, highlight: ACCENTS, pattern: ROOF_PATTERNS });

export const ZONE_KEYS = Object.freeze(['zone_id', 'glow', 'flicker']);
export const ZONE_FIELDS = Object.freeze({ zone_id: LIGHTING_ZONE_IDS, glow: LIGHTINGS });   // flicker = strict boolean

/** Self-describing safety flags a layered package MUST assert true. CF-3 adds no_live_world_load. */
export const REQUIRED_CONSTRAINTS = Object.freeze({ no_external_assets: true, no_scripts: true, no_live_world_load: true });

export { PALETTE_VARIANTS, TARGET_CITY_IDS };
