/**
 * Grid ↔ world coordinate helpers. The grid is centered on the origin; each cell is CELL_SIZE units.
 * PURE (no Three.js) so placement math is testable.
 */

import { LIMITS } from '../validation/tokens.js';

export const CELL = LIMITS.CELL_SIZE;

/** Cell (gx, gy) → world center { x, z } for a grid of cols×rows. */
export function cellToWorld(gx, gy, cols, rows) {
  return {
    x: (gx - (cols - 1) / 2) * CELL,
    z: (gy - (rows - 1) / 2) * CELL,
  };
}

/** World { x, z } → nearest cell { gx, gy }, clamped to the grid. */
export function worldToCell(x, z, cols, rows) {
  const gx = Math.round(x / CELL + (cols - 1) / 2);
  const gy = Math.round(z / CELL + (rows - 1) / 2);
  return {
    gx: Math.max(0, Math.min(cols - 1, gx)),
    gy: Math.max(0, Math.min(rows - 1, gy)),
  };
}

/** World-space extent of the grid floor. */
export function worldBounds(cols, rows) {
  const halfX = (cols * CELL) / 2;
  const halfZ = (rows * CELL) / 2;
  return { minX: -halfX, maxX: halfX, minZ: -halfZ, maxZ: halfZ };
}

/** Rotation token (degrees) → radians. */
export function rotationToRadians(deg) {
  return ((deg % 360) * Math.PI) / 180;
}
