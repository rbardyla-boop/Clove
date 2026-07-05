/**
 * Voxel Lab Bench — metrics/readout room (Gate C).
 *
 * Aggregates the already-built Gate A/B measurement primitives — instanced-cubes vs
 * greedy-quads mesh stats (Slice 3), LOD fine/coarse instance reduction (Slice 4), and
 * light-volume resolution cost (Slice 5) — into ONE deterministic report, over the SAME
 * occupancy grid. This is the "budget/readout room" teaching surface: comparing all
 * three cost dimensions side by side so a player can see which lever (render strategy /
 * LOD level / lighting resolution) actually moves which cost (draw calls / triangles /
 * instances / bytes) — the decoupling lesson from plan Section 4.3, generalized across
 * every strategy this lab has built so far, not just lighting.
 *
 * Pure, dependency-free (no THREE.js, no Worker) so it's directly node:test-testable in
 * isolation, matching the sibling Slice 3/4/5 modules (mesh-greedy.mjs, lod.mjs,
 * light-volume.mjs). Timing (frame time / build time) is intentionally NOT computed
 * here — that is inherently a runtime/hardware measurement and belongs in the headless
 * proof script (scripts/metrics-room-headless.mjs), not in this deterministic,
 * byte-for-byte reproducible module.
 *
 * The instanced-cubes triangle-count convention here (`instanceCount * 12`, a full
 * unculled cube per instance) deliberately matches bench-boot.mjs's own
 * computeStrategyDelta() definition exactly — InstancedMesh renders a complete 12-
 * triangle cube per instance with no inter-instance face culling, so this is the
 * accurate cost, and keeping the SAME definition in both places is what makes this
 * room's numbers internally consistent with the live bench readout (proven by
 * scripts/metrics-room-headless.mjs).
 */

import { greedyMesh } from './mesh-greedy.mjs';
import { downsampleChunk } from './lod.mjs';
import { createLightVolume, injectFromOccupancy, estimateLightVolumeBytes } from './light-volume.mjs';

/** Cube triangle count per instance: 6 faces * 2 triangles, unculled (matches
 * bench-boot.mjs's computeStrategyDelta()). */
const TRIANGLES_PER_CUBE = 12;

/** Section 5's cited lighting-grid tier resolutions (Tier-1 8-16, Tier-2 32-64) —
 * matches scripts/light-volume-headless.mjs's own sweep set. */
const DEFAULT_LIGHT_GRID_RESOLUTIONS = Object.freeze([8, 16, 32, 64]);

/** Fixed LOD downsample factor, matching bench-boot.mjs's own lodCoarseGrid build. */
const DEFAULT_LOD_DOWNSAMPLE_FACTOR = 2;

/**
 * buildMetricsRoomReport({ grid, lodFineGrid, lightGridResolutions, lodDownsampleFactor })
 *   -> report
 *
 * `grid` (required): the occupancy grid to compare instanced-cubes vs greedy-quads and
 * light-volume cost over.
 * `lodFineGrid` (optional): a separate grid for the LOD fine/coarse comparison; defaults
 * to `grid` itself if omitted (a caller with a dedicated LOD fixture, like bench-boot.mjs's
 * lodFineGrid, can pass it explicitly instead).
 * `lightGridResolutions` (optional): resolutions to compute light-volume byte costs at;
 * defaults to the Section 5 tier-cited set.
 * `lodDownsampleFactor` (optional): passed straight through to downsampleChunk.
 *
 * Returns a plain, JSON-serializable object — safe to log, diff, or export as a teaching
 * artifact (Slice 7's future Markdown export is a natural consumer of this shape).
 */
export function buildMetricsRoomReport({
  grid,
  lodFineGrid = grid,
  lightGridResolutions = DEFAULT_LIGHT_GRID_RESOLUTIONS,
  lodDownsampleFactor = DEFAULT_LOD_DOWNSAMPLE_FACTOR,
} = {}) {
  if (!grid) throw new TypeError('buildMetricsRoomReport: grid is required');
  if (!lodFineGrid) throw new TypeError('buildMetricsRoomReport: lodFineGrid is required (or omit to default to grid)');

  const instanceCount = grid.occupiedCount;
  const greedyResult = greedyMesh(grid);

  const lodCoarseGrid = downsampleChunk(lodFineGrid, lodDownsampleFactor);
  const fineInstanceCount = lodFineGrid.occupiedCount;
  const coarseInstanceCount = lodCoarseGrid.occupiedCount;

  const lightVolume = lightGridResolutions.map((resolution) => {
    const volume = createLightVolume(grid.aabb, resolution);
    injectFromOccupancy(volume, [grid]);
    return { resolution, lightVolumeBytes: estimateLightVolumeBytes(volume).totalBytes };
  });

  return {
    instancedCubes: {
      drawCalls: instanceCount > 0 ? 1 : 0,
      instanceCount,
      triangleCount: instanceCount * TRIANGLES_PER_CUBE,
    },
    greedyQuads: {
      drawCalls: greedyResult.quadCount > 0 ? 1 : 0,
      quadCount: greedyResult.quadCount,
      triangleCount: greedyResult.triangleCount,
    },
    meshReduction: {
      // >1 means greedy meshing produced fewer triangles than the instanced-cubes
      // baseline over the SAME occupancy — the Slice 3 "same room, both strategies"
      // lesson, expressed as a single number.
      ratio: greedyResult.triangleCount > 0 ? (instanceCount * TRIANGLES_PER_CUBE) / greedyResult.triangleCount : 1,
    },
    lod: {
      fineInstanceCount,
      coarseInstanceCount,
      // <=1: the coarse (downsampled) level never has MORE occupied cells than fine.
      ratio: fineInstanceCount > 0 ? coarseInstanceCount / fineInstanceCount : 1,
    },
    lightVolume,
  };
}
