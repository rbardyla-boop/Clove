/**
 * Voxel Lab Bench — LOD transition primitives (Gate B, Slice 4, Blocker #3).
 *
 * Re-derived (not copy-pasted) from the behavioral contract described in
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 3.2 ("--- LOD (NEW beyond Stage 16) ---") and
 * Section 7 Slice 4. This module is deliberately just the two pure functions the plan's
 * pseudo-IDL names — `downsampleChunk` and `computeLodLevel` — kept dependency-free
 * (no THREE.*, no Worker) so they are directly node:test-testable in isolation from the
 * rendering/measurement harness that consumes them (see bench-boot.mjs and
 * scripts/lod-pop-harness.mjs).
 *
 * Naming note: the plan's pseudo-IDL names the input/output type `Chunk`, but Slice 4
 * still operates on a single VoxelGrid (bench-core.mjs) — there is no multi-chunk
 * ChunkManager yet (that's Slice 6, explicitly out of scope for Gate B). `downsampleChunk`
 * here takes and returns a VoxelGrid; the name is kept to match the plan's public API
 * surface for when a future slice wraps a grid in a Chunk.
 */

import { VoxelGrid } from './bench-core.mjs';

/**
 * Density-merge threshold: a coarse cell is kept occupied iff at least this many of its
 * `factor^3` fine children are non-empty. Fixed at "majority of 8" (>=4 of 8) for the
 * canonical factor=2 case, i.e. a plain >=50% threshold — chosen over the plan's cited
 * illustrative ">=2 of 8" figure (25%) because a >=50% majority is the more defensible,
 * less noisy default (it does not manufacture solid-looking coarse geometry out of a
 * mostly-empty region, which a 25% threshold would for sparse/thin structures). The
 * general rule below is factor-agnostic: threshold = ceil(childCount / 2).
 */
export function densityThreshold(childCount) {
  return Math.ceil(childCount / 2);
}

/**
 * downsampleChunk(grid, factor=2) -> VoxelGrid
 *
 * Builds a NEW, coarser VoxelGrid covering the same world-space AABB, by partitioning
 * the fine grid into `factor x factor x factor` blocks of cells and marking each coarse
 * cell occupied iff at least `densityThreshold(factor^3)` of its children are non-empty
 * (density-threshold merge, NOT box-filter averaging — the plan explicitly calls this
 * out as the required technique, Section 3.2). The coarse cell's material id is the
 * majority (mode) material id among its occupied children, ties broken by the first
 * material id encountered in a fixed x/y/z scan order (deterministic, no RNG).
 *
 * The source grid is never mutated. `factor` must be a positive integer >= 1; factor=1
 * returns a grid with byte-identical occupancy to the source (each coarse cell has
 * exactly one child).
 */
export function downsampleChunk(grid, factor = 2) {
  if (!grid) throw new TypeError('downsampleChunk: grid is required');
  if (!Number.isInteger(factor) || factor < 1) {
    throw new RangeError(`downsampleChunk: factor must be a positive integer, got ${factor}`);
  }

  const coarseNx = Math.max(1, Math.ceil(grid.nx / factor));
  const coarseNy = Math.max(1, Math.ceil(grid.ny / factor));
  const coarseNz = Math.max(1, Math.ceil(grid.nz / factor));

  // The coarse grid's resolution is derived from its own largest axis count so the
  // VoxelGrid constructor's internal per-axis clamping (bench-core.mjs) reproduces
  // exactly coarseNx/coarseNy/coarseNz cells for this AABB, matching the fine grid's own
  // cellSize convention (cellSize = longest extent / resolution) scaled by `factor`.
  const coarseResolution = Math.max(coarseNx, coarseNy, coarseNz);
  const coarse = new VoxelGrid(grid.aabb, coarseResolution, {
    sourceId: grid.sourceId ? `${grid.sourceId}::lod-downsample-x${factor}` : null,
  });

  const childCount = factor * factor * factor;
  const threshold = densityThreshold(childCount);

  for (let cz = 0; cz < coarse.nz; cz += 1) {
    for (let cy = 0; cy < coarse.ny; cy += 1) {
      for (let cx = 0; cx < coarse.nx; cx += 1) {
        const counts = new Map();
        let nonEmpty = 0;

        for (let dz = 0; dz < factor; dz += 1) {
          const fz = cz * factor + dz;
          if (fz >= grid.nz) continue;
          for (let dy = 0; dy < factor; dy += 1) {
            const fy = cy * factor + dy;
            if (fy >= grid.ny) continue;
            for (let dx = 0; dx < factor; dx += 1) {
              const fx = cx * factor + dx;
              if (fx >= grid.nx) continue;
              const materialId = grid.getOccupied(fx, fy, fz);
              if (materialId === 0) continue;
              nonEmpty += 1;
              counts.set(materialId, (counts.get(materialId) ?? 0) + 1);
            }
          }
        }

        if (nonEmpty >= threshold) {
          let bestMaterialId = 0;
          let bestCount = -1;
          for (const [materialId, count] of counts) {
            if (count > bestCount) {
              bestCount = count;
              bestMaterialId = materialId;
            }
          }
          coarse.setOccupied(cx, cy, cz, bestMaterialId);
        }
      }
    }
  }

  return coarse;
}

/**
 * computeLodLevel(distanceFromCamera, tierConfig) -> int
 *
 * Returns an integer LOD level: 0 = finest/near, increasing = coarser/far. `tierConfig`
 * is a small config object `{ switchDistances: number[] }` where `switchDistances` is a
 * non-decreasing list of distance thresholds; level N is returned when
 * `switchDistances[N-1] <= distanceFromCamera < switchDistances[N]` (level 0 for
 * anything below the first threshold, and the final/coarsest level for anything at or
 * beyond the last threshold). Boundary values (distance exactly equal to a threshold)
 * belong to the FARTHER (coarser) level — i.e. thresholds are inclusive lower bounds for
 * the level they switch INTO, matching the intuitive "at this distance you've already
 * crossed into the next LOD tier" reading.
 *
 * Throws on a negative or non-finite distance, or a malformed tierConfig.
 */
export function computeLodLevel(distanceFromCamera, tierConfig) {
  if (typeof distanceFromCamera !== 'number' || !Number.isFinite(distanceFromCamera) || distanceFromCamera < 0) {
    throw new RangeError(`computeLodLevel: distanceFromCamera must be a finite non-negative number, got ${distanceFromCamera}`);
  }
  const switchDistances = tierConfig?.switchDistances;
  if (!Array.isArray(switchDistances) || switchDistances.length === 0) {
    throw new TypeError('computeLodLevel: tierConfig.switchDistances must be a non-empty array');
  }
  for (let i = 1; i < switchDistances.length; i += 1) {
    if (switchDistances[i] < switchDistances[i - 1]) {
      throw new RangeError('computeLodLevel: tierConfig.switchDistances must be non-decreasing');
    }
  }

  let level = 0;
  for (let i = 0; i < switchDistances.length; i += 1) {
    if (distanceFromCamera >= switchDistances[i]) {
      level = i + 1;
    } else {
      break;
    }
  }
  return level;
}

/** Default tier config used by the bench's LOD-capable room (bench-boot.mjs) and the
 * headless lod-pop-harness: a single switch distance, i.e. two levels (0 = near/fine,
 * 1 = far/coarse), consistent with Slice 4's "one designated transition frame" scope —
 * a richer multi-level table is left for a later slice, this is intentionally minimal.
 */
export const DEFAULT_LOD_TIER_CONFIG = Object.freeze({ switchDistances: Object.freeze([10]) });
