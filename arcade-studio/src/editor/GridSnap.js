/**
 * Grid snapping + placement-collision helpers. PURE-ish (only depends on grid math + the model), so
 * placement stays predictable and collision-aware: cabinets can never overlap, and nothing may be
 * dropped on a cell already occupied by a cabinet.
 */

import { worldToCell, cellToWorld } from '../arcade/grid.js';

export function snapToCell(worldX, worldZ, model) {
  return worldToCell(worldX, worldZ, model.grid.cols, model.grid.rows);
}

export function cellCenter(gx, gy, model) {
  return cellToWorld(gx, gy, model.grid.cols, model.grid.rows);
}

/** Is there a cabinet at this cell? */
export function cabinetAtCell(model, gx, gy) {
  return (model.cabinets || []).some((c) => c.gx === gx && c.gy === gy);
}

/**
 * May an element of `kind` be placed at (gx, gy)? Collision rules:
 *  - never on a cell already holding a cabinet (cabinets are the large playfield objects),
 *  - no two elements of the SAME kind on the same cell; for props/cabinets that carry a `layer`,
 *    the same cell on a DIFFERENT layer is allowed (so set dressing can stack intentionally).
 */
export function canPlaceAt(model, kind, gx, gy, layer = null) {
  if (gx < 0 || gy < 0 || gx >= model.grid.cols || gy >= model.grid.rows) return false;
  if (cabinetAtCell(model, gx, gy)) return false;
  const sameKind = model[kind] || [];
  return !sameKind.some((e) => e.gx === gx && e.gy === gy
    && (layer == null || e.layer == null || e.layer === layer));
}
