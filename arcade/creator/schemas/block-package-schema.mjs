/**
 * Creator Foundation CF-1 — Block Style Package SCHEMA (data-only), PURE + cross-env.
 *
 * A block package is a small, immutable, DATA-ONLY description of a constrained restyle of a
 * city block, composed locally and validated locally. It is NOT live state and carries NO code.
 * Strict keys: any unknown top-level or style key is a REJECTION (never a silent drop), so nothing
 * can smuggle in. All values are closed-allowlist tokens (see creator-tokens.mjs).
 */
import { PALETTES, FACADE_PATTERNS, SIGN_VARIANTS, LIGHTINGS, ACCENTS, TILE_ACCENTS, TARGET_CITY_IDS } from './creator-tokens.mjs';

export const PACKAGE_KIND = 'block_style';
export const SCHEMA_VERSION = 1;
/** A data-only block package serializes tiny; 8 KiB is generous for pure tokens. */
export const SIZE_BUDGET_BYTES = 8192;
export const PACKAGE_ID_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;     // kebab, 3..48
export const DISPLAY_NAME_MAX = 40;                                        // bounded human label

export const ALLOWED_TOP_KEYS = Object.freeze([
  'schema_version', 'package_kind', 'package_id', 'display_name', 'target_city_id', 'style', 'constraints',
]);
export const REQUIRED_TOP_KEYS = Object.freeze([
  'schema_version', 'package_kind', 'package_id', 'target_city_id', 'style', 'constraints',
]);

/** The ONLY style keys, each with its closed token allowlist. */
export const STYLE_FIELDS = Object.freeze({
  palette: PALETTES,
  facade_pattern: FACADE_PATTERNS,
  sign_variant: SIGN_VARIANTS,
  lighting: LIGHTINGS,
  accent: ACCENTS,
  tile_accent: TILE_ACCENTS,
});
export const STYLE_KEYS = Object.freeze(Object.keys(STYLE_FIELDS));

/** Constraints a block package MUST assert true (self-describing safety flags). */
export const REQUIRED_CONSTRAINTS = Object.freeze({ no_external_assets: true, no_scripts: true });

export { TARGET_CITY_IDS };
