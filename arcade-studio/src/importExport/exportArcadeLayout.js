/**
 * Export an arcade BUILDING LAYOUT to validated, deterministic JSON — PURE, cross-env.
 * Same contract as exportArcadeAsset: build envelope → validate → canonical pretty JSON + hash.
 */

import { LAYOUT_KIND, SCHEMA_VERSION } from '../validation/tokens.js';
import { validateArcadeLayout } from '../validation/validateArcadeLayout.js';
import { hashAsset, canonicalPretty } from './hashAsset.js';
import { makeConstraints } from './exportArcadeAsset.js';

/** Optional keys copied through only when present, so canonical output stays minimal + readable. */
const OPTIONAL = ['display_name', 'walls', 'entrances', 'props', 'signs', 'cabinets', 'zones', 'lighting', 'effects', 'metadata'];

export function buildArcadeLayout(model) {
  const layout = {
    schema_version: SCHEMA_VERSION,
    asset_kind: LAYOUT_KIND,
    layout_id: model.layout_id,
    theme: model.theme,
    grid: model.grid,
    floor: model.floor,
    constraints: makeConstraints(),
  };
  for (const k of OPTIONAL) if (model[k] != null) layout[k] = model[k];
  return layout;
}

export async function exportArcadeLayout(model) {
  const layout = buildArcadeLayout(model);
  const report = validateArcadeLayout(layout);
  const json = canonicalPretty(layout);
  const hash = report.ok ? await hashAsset(layout) : null;
  return { ok: report.ok, layout, json, hash, report };
}
