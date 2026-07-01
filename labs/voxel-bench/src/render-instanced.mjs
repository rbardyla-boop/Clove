/**
 * Voxel Lab Bench — Tier-1 instanced-cube renderer (Gate A, Slice 2).
 *
 * Re-derived (not copy-pasted) from the behavioral contract described in
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 3.3/5/7 (Slice 2). This is a RENDERER SHELL:
 * it wires a Slice-0 VoxelGrid's occupancy to a single THREE.InstancedMesh (one draw
 * call for the whole bounded room), at Tier-1 budgets. No LOD, no lighting/light-volume
 * code, no chunking-across-many-grids, no gameplay/movement — those are later slices
 * (see the plan doc, Section 7).
 *
 * Imports the vendored Three.js r152 ES module already used by Mind Machine /
 * arcade-studio — no CDN reference, no other Three.js version, no new dependency.
 */

import * as THREE from '../../../game/vendor/three/three.module-0.152.2.js';

/** Tier-1 budgets (plan Section 5): mobile-safe ceilings for this renderer shell. */
export const TIER1_MAX_VISIBLE_CELLS = 65536;
export const TIER1_MAX_DRAW_CALLS = 50;
export const TIER1_HARD_MEMORY_CEILING_BYTES = 250 * 1024 * 1024;
export const TIER1_TARGET_MEMORY_BYTES = 150 * 1024 * 1024;

const scratchMatrix = new THREE.Matrix4();
const scratchPosition = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchScale = new THREE.Vector3(1, 1, 1);

/**
 * Count occupied cells in a VoxelGrid without allocating (used to size the
 * InstancedMesh's instance count and to enforce the Tier-1 visible-cell budget).
 */
function countOccupied(grid) {
  let count = 0;
  grid.forEachOccupied(() => {
    count += 1;
  });
  return count;
}

/**
 * buildInstancedVoxelMesh(grid, opts?) -> { mesh: THREE.InstancedMesh, instanceCount: number }
 *
 * Builds ONE THREE.InstancedMesh from a VoxelGrid's occupied cells: a single shared
 * BoxGeometry + single shared Material, one instance matrix per occupied cell, so the
 * whole bounded room renders in a single draw call (Tier-1 `instanced-cubes` strategy,
 * plan Section 3.3).
 *
 * grid: a Slice-0/1 VoxelGrid (bench-core.mjs) — reads grid.cellSize, grid.aabb,
 *   grid.forEachOccupied.
 * opts: { color?: number, maxVisibleCells?: number }
 *
 * Throws if the grid's occupied-cell count exceeds the Tier-1 visible-cell budget —
 * this renderer shell never silently truncates a room past its stated budget.
 */
export function buildInstancedVoxelMesh(grid, opts = {}) {
  if (!grid) throw new TypeError('buildInstancedVoxelMesh: grid is required');

  const maxVisibleCells = opts.maxVisibleCells ?? TIER1_MAX_VISIBLE_CELLS;
  const instanceCount = countOccupied(grid);

  if (instanceCount > maxVisibleCells) {
    throw new RangeError(
      `buildInstancedVoxelMesh: occupied cell count ${instanceCount} exceeds Tier-1 visible-cell budget ${maxVisibleCells}`,
    );
  }

  const cellSize = grid.cellSize;
  const geometry = new THREE.BoxGeometry(cellSize, cellSize, cellSize);
  const material = new THREE.MeshBasicMaterial({ color: opts.color ?? 0x3fa9f5 });

  // Zero instances is a valid (if degenerate) fixture state; InstancedMesh requires a
  // count >= 0, so this is safe, but callers typically want a non-empty room.
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(instanceCount, 0));
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  let instanceIndex = 0;
  grid.forEachOccupied((x, y, z) => {
    scratchPosition.set(
      grid.aabb.min.x + (x + 0.5) * cellSize,
      grid.aabb.min.y + (y + 0.5) * cellSize,
      grid.aabb.min.z + (z + 0.5) * cellSize,
    );
    scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale);
    mesh.setMatrixAt(instanceIndex, scratchMatrix);
    instanceIndex += 1;
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = instanceCount;

  return { mesh, instanceCount };
}

/**
 * estimateBytesForGrid(grid) -> { occupancyBytes, idsBytes, totalBytes }
 *
 * Computes the byte footprint of a VoxelGrid's CPU-side data (the occupancy
 * Uint8Array, plus an equal-sized "ids" allocation reserved for a future separate
 * material layer per plan Section 3.1 — Slice 2 keeps material data folded into
 * occupancy, so idsBytes is 0 today, but the field is reported explicitly so the
 * Tier-1 memory-budget test has a stable shape to assert against as that layer is
 * added later). Used by the Tier-1 memory-ceiling test (Section 5/7).
 */
export function estimateBytesForGrid(grid) {
  if (!grid) throw new TypeError('estimateBytesForGrid: grid is required');

  const occupancyBytes = grid.occupancy.byteLength;
  // No separate material/id layer exists yet in this kernel (plan Section 3.1 notes it
  // as optional); report 0 explicitly rather than omitting the field.
  const idsBytes = 0;

  return {
    occupancyBytes,
    idsBytes,
    totalBytes: occupancyBytes + idsBytes,
  };
}

/**
 * exportGridState(grid) -> plain object { resolution, nx, ny, nz, cellSize, aabb, occupancy }
 *
 * Minimal in-memory serialize of a VoxelGrid's occupancy + dims to a plain,
 * structured-clone-safe object (Uint8Array survives structured clone / plain reuse
 * directly; copied here via Array.from so the exported state has zero references back
 * into the source grid's live buffer). NOT the Markdown/JSON second-brain export
 * feature (plan Section 4.1 item 8 / Slice 7) — just enough to prove the data model
 * round-trips through a copy.
 */
export function exportGridState(grid) {
  if (!grid) throw new TypeError('exportGridState: grid is required');
  return {
    resolution: grid.resolution,
    nx: grid.nx,
    ny: grid.ny,
    nz: grid.nz,
    cellSize: grid.cellSize,
    aabb: {
      min: { x: grid.aabb.min.x, y: grid.aabb.min.y, z: grid.aabb.min.z },
      max: { x: grid.aabb.max.x, y: grid.aabb.max.y, z: grid.aabb.max.z },
    },
    occupancy: Array.from(grid.occupancy),
  };
}

/**
 * importGridState(state) -> VoxelGrid
 *
 * Rebuilds a fresh VoxelGrid from a plain object produced by exportGridState(), then
 * copies the occupancy bytes in verbatim (no re-voxelization, no re-derivation) so the
 * round-trip is byte-identical to the source grid's occupancy array.
 */
export function importGridState(state, VoxelGridCtor) {
  if (!state) throw new TypeError('importGridState: state is required');
  const grid = new VoxelGridCtor(state.aabb, state.resolution);
  if (grid.occupancy.length !== state.occupancy.length) {
    throw new RangeError(
      `importGridState: rebuilt grid cell count ${grid.occupancy.length} does not match exported occupancy length ${state.occupancy.length}`,
    );
  }
  grid.occupancy.set(state.occupancy);
  return grid;
}
