/**
 * Export an arcade CABINET asset to validated, deterministic JSON — PURE, cross-env.
 *
 * Assembles the schema envelope (identity + required safety constraints), validates it deny-by-default,
 * and returns the canonical pretty JSON plus the `sha256:` content hash. If validation fails the JSON
 * is still returned for inspection, but `ok` is false and `report.errors` explains why — nothing is
 * silently dropped. There is NO network/file side effect here; the caller decides what to do with the
 * string (e.g. trigger a local download or show it in the export panel).
 */

import { ASSET_KIND, SCHEMA_VERSION, REQUIRED_CONSTRAINTS } from '../validation/tokens.js';
import { validateArcadeAsset } from '../validation/validateArcadeAsset.js';
import { hashAsset, canonicalPretty } from './hashAsset.js';

/** Fresh copy of the required safety constraints (never share a frozen reference into exports). */
export function makeConstraints() {
  return { ...REQUIRED_CONSTRAINTS };
}

/** Build the schema-shaped asset envelope from an editor model (no validation, no async). */
export function buildArcadeAsset(model) {
  const asset = {
    schema_version: SCHEMA_VERSION,
    asset_kind: ASSET_KIND,
    asset_id: model.asset_id,
    cabinet: model.cabinet,
    constraints: makeConstraints(),
  };
  if (model.display_name) asset.display_name = model.display_name;
  if (model.effects) asset.effects = model.effects;
  if (model.metadata) asset.metadata = model.metadata;
  return asset;
}

/** Async: build → validate → hash. Returns { ok, asset, json, hash, report }. */
export async function exportArcadeAsset(model) {
  const asset = buildArcadeAsset(model);
  const report = validateArcadeAsset(asset);
  const json = canonicalPretty(asset);
  const hash = report.ok ? await hashAsset(asset) : null;
  return { ok: report.ok, asset, json, hash, report };
}
