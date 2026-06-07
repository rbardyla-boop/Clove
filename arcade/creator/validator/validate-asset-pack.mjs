/**
 * Creator Foundation CF-5 — city asset-pack validator + resolver (PURE, cross-env).
 *
 * `validateAssetPack(pack, registry)` — deny-by-default validation of a tiled-map composition: strict
 * keys, bounded grid + tile count + size, unique tile positions, and — the core CF-5 rule — EVERY tile
 * must reference a package hash that is APPROVED-LOCAL in the CF-2 registry (`resolveApprovedPackage`),
 * with the tile's package_kind matching the registry entry. No external URLs / inline bodies / assets;
 * no economy/ownership terms; no live-world load.
 *
 * `resolveAssetPack(pack, registry, packageStore)` — given a local store of package bodies keyed by hash,
 * returns renderable tiles ONLY for approved hashes whose body's recomputed hash matches (tamper check)
 * and whose kind matches. Used by the LOCAL map viewer; never touches the live world.
 */

import {
  PACK_KIND, PACK_SCHEMA_VERSION, MAX_COLS, MAX_ROWS, MAX_TILES, PACK_SIZE_MAX_BYTES, DISPLAY_NAME_MAX,
  TILE_PACKAGE_KINDS, PACK_ID_RE, HASH_RE, ALLOWED_TOP_KEYS, REQUIRED_TOP_KEYS, TILE_KEYS, REQUIRED_CONSTRAINTS,
} from '../schemas/asset-pack-schema.mjs';
import { isPlainData, utf8Bytes, scanSafety, FORBIDDEN_TERMS_RE } from './validation-report.mjs';
import { canonicalize, packageHash } from './package-hash.mjs';
import { validateRegistry, resolveApprovedPackage } from '../approval/approved-package-registry.mjs';

const isInt = (v) => Number.isInteger(v);

export function validateAssetPack(pack, registry) {
  const errors = [];
  const warnings = [];
  const limits = { size_bytes: 0, tile_count: 0 };

  if (!isPlainData(pack) || typeof pack !== 'object' || Array.isArray(pack)) {
    errors.push('asset pack is not plain JSON data');
    return done(errors, warnings, limits);
  }
  limits.size_bytes = utf8Bytes(canonicalize(pack));
  if (limits.size_bytes > PACK_SIZE_MAX_BYTES) errors.push(`pack exceeds ${PACK_SIZE_MAX_BYTES} bytes`);
  scanSafety(pack, errors); // code/markup/url/private + (below) economy terms

  // the registry must itself be valid, else nothing can be approved
  const rv = validateRegistry(registry);
  if (!rv.ok) errors.push(`registry invalid: ${rv.errors[0] || 'unknown'}`);

  const keys = Object.keys(pack);
  for (const k of keys) if (!ALLOWED_TOP_KEYS.includes(k)) errors.push(`unknown top key: ${k}`);
  for (const k of REQUIRED_TOP_KEYS) if (!keys.includes(k)) errors.push(`missing key: ${k}`);

  if (pack.pack_kind !== PACK_KIND) errors.push(`pack_kind must be "${PACK_KIND}"`);
  if (pack.schema_version !== PACK_SCHEMA_VERSION) errors.push(`schema_version must be ${PACK_SCHEMA_VERSION}`);
  if (!(typeof pack.pack_id === 'string' && PACK_ID_RE.test(pack.pack_id) && !FORBIDDEN_TERMS_RE.test(pack.pack_id))) {
    errors.push('pack_id must be a clean kebab slug (3..48, no economy terms)');
  }
  if ('display_name' in pack) {
    if (typeof pack.display_name !== 'string' || pack.display_name.length === 0 || pack.display_name.length > DISPLAY_NAME_MAX) errors.push(`display_name must be 1..${DISPLAY_NAME_MAX} chars`);
    else if (FORBIDDEN_TERMS_RE.test(pack.display_name)) errors.push('display_name contains a forbidden economy term');
  }

  // grid bounds
  const g = pack.grid;
  let cols = 0, rows = 0;
  if (!g || typeof g !== 'object' || Array.isArray(g)) errors.push('grid must be an object { cols, rows }');
  else {
    const gk = Object.keys(g);
    if (gk.some((k) => !['cols', 'rows'].includes(k))) errors.push('grid has unknown keys (only cols, rows)');
    cols = g.cols; rows = g.rows;
    if (!(isInt(cols) && cols >= 1 && cols <= MAX_COLS)) errors.push(`grid.cols must be an integer 1..${MAX_COLS}`);
    if (!(isInt(rows) && rows >= 1 && rows <= MAX_ROWS)) errors.push(`grid.rows must be an integer 1..${MAX_ROWS}`);
  }

  // tiles
  if (!Array.isArray(pack.tiles)) errors.push('tiles must be an array');
  else {
    limits.tile_count = pack.tiles.length;
    if (pack.tiles.length < 1) errors.push('tiles must have at least 1 entry');
    if (pack.tiles.length > MAX_TILES) errors.push(`tiles exceeds ${MAX_TILES}`);
    const seen = new Set();
    pack.tiles.forEach((t, i) => {
      const at = `tiles[${i}]`;
      if (!t || typeof t !== 'object' || Array.isArray(t)) { errors.push(`${at} is not an object`); return; }
      for (const k of Object.keys(t)) if (!TILE_KEYS.includes(k)) errors.push(`${at} unknown key: ${k}`);
      for (const k of TILE_KEYS) if (!(k in t)) errors.push(`${at} missing key: ${k}`);
      if (!(isInt(t.gx) && t.gx >= 0 && t.gx < (cols || MAX_COLS))) errors.push(`${at}.gx must be 0..cols-1`);
      if (!(isInt(t.gy) && t.gy >= 0 && t.gy < (rows || MAX_ROWS))) errors.push(`${at}.gy must be 0..rows-1`);
      const pos = `${t.gx},${t.gy}`;
      if (seen.has(pos)) errors.push(`${at} duplicate tile position (${pos})`); else seen.add(pos);
      if (typeof t.package_hash !== 'string' || !HASH_RE.test(t.package_hash)) errors.push(`${at}.package_hash must be sha256:<64hex>`);
      if (!TILE_PACKAGE_KINDS.includes(t.package_kind)) errors.push(`${at}.package_kind must be one of ${TILE_PACKAGE_KINDS.join('|')}`);
      // THE CF-5 RULE: the referenced hash must be APPROVED-LOCAL, and kinds must agree
      if (rv.ok && HASH_RE.test(t.package_hash || '')) {
        const entry = resolveApprovedPackage(registry, t.package_hash);
        if (!entry) errors.push(`${at}.package_hash is not approved-local in the registry (approved hashes only)`);
        else if (entry.package_kind !== t.package_kind) errors.push(`${at}.package_kind (${t.package_kind}) != registry entry kind (${entry.package_kind})`);
      }
    });
  }

  // constraints
  const c = pack.constraints;
  if (!c || typeof c !== 'object' || Array.isArray(c)) errors.push('constraints must be an object');
  else {
    for (const k of Object.keys(c)) if (!(k in REQUIRED_CONSTRAINTS)) errors.push(`constraints unknown key: ${k}`);
    for (const [k, v] of Object.entries(REQUIRED_CONSTRAINTS)) if (c[k] !== v) errors.push(`constraints.${k} must be ${v}`);
  }

  return done(errors, warnings, limits);
}

function done(errors, warnings, limits) {
  return { ok: errors.length === 0, pack_kind: PACK_KIND, errors, warnings, limits };
}

/**
 * PURE (async): resolve a validated pack against a local package store (hash → package body). Returns
 * renderable tiles ONLY for tiles whose hash is approved-local, whose body is present, whose recomputed
 * canonical hash MATCHES the referenced hash (tamper check), and whose kind matches. Never live.
 */
export async function resolveAssetPack(pack, registry, packageStore) {
  const v = validateAssetPack(pack, registry);
  if (!v.ok) return { ok: false, tiles: [], errors: v.errors };
  const store = packageStore && typeof packageStore === 'object' ? packageStore : {};
  const errors = [];
  const tiles = [];
  for (let i = 0; i < pack.tiles.length; i++) {
    const t = pack.tiles[i];
    const at = `tiles[${i}]`;
    const body = store[t.package_hash];
    if (body === undefined) { errors.push(`${at}: package body missing from local store`); continue; }
    const recomputed = await packageHash(body);
    if (recomputed !== t.package_hash) { errors.push(`${at}: body hash ${recomputed} != approved hash ${t.package_hash}`); continue; }
    if (body.package_kind !== t.package_kind) { errors.push(`${at}: body kind ${body.package_kind} != tile kind ${t.package_kind}`); continue; }
    tiles.push({ gx: t.gx, gy: t.gy, package_kind: t.package_kind, package: body });
  }
  return { ok: errors.length === 0, tiles, errors };
}
