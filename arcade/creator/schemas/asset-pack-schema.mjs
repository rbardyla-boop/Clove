/**
 * Creator Foundation CF-5 — city asset-pack schema (PURE constants).
 *
 * An asset pack is a LOCAL tiled-isometric map COMPOSITION: a small bounded grid whose tiles each
 * reference an ALREADY-APPROVED, hash-addressed block package (CF-2 approved-package-registry). It is
 * data-only, references packages BY APPROVED HASH ONLY (never by URL / inline body / external asset),
 * and never loads anything into the live world. See docs/CREATOR_FOUNDATION_CF5_ASSET_PACK.md.
 */

export const PACK_KIND = 'city_asset_pack';
export const PACK_SCHEMA_VERSION = 1;

/** Bounds — a pack is a SMALL local composition, not a world. */
export const MAX_COLS = 8;
export const MAX_ROWS = 8;
export const MAX_TILES = 32;
export const PACK_SIZE_MAX_BYTES = 8192;
export const DISPLAY_NAME_MAX = 40;

/** Block package kinds a tile may reference (renderable blocks only). */
export const TILE_PACKAGE_KINDS = Object.freeze(['block_style', 'block_layered']);

export const PACK_ID_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/;
export const HASH_RE = /^sha256:[0-9a-f]{64}$/;

export const ALLOWED_TOP_KEYS = Object.freeze([
  'schema_version', 'pack_kind', 'pack_id', 'display_name', 'grid', 'tiles', 'constraints',
]);
export const REQUIRED_TOP_KEYS = Object.freeze([
  'schema_version', 'pack_kind', 'pack_id', 'grid', 'tiles', 'constraints',
]);
export const TILE_KEYS = Object.freeze(['gx', 'gy', 'package_hash', 'package_kind']);

/** Constraints a pack MUST carry — self-describing, all true, deny-by-default elsewhere. */
export const REQUIRED_CONSTRAINTS = Object.freeze({
  no_external_assets: true,
  no_live_world_load: true,
  approved_hashes_only: true,
});
