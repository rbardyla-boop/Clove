/**
 * Voxel Lab Bench — kernel scaffolding (Gate A, Slice 0).
 *
 * Re-derived (not copy-pasted) from the behavioral contract described in
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 3.1/3.2, itself design-informed by the sibling
 * repo's Stage-16 Voxel Debug Lab (`webbroswer-assest-creator`, tag
 * `world-builder-stage16-voxel-lab`) inspected read-only for prior art. This module has
 * NO runtime or build-time dependency on that repo and copies none of its source.
 *
 * Slice 0 scope ONLY: the bounded occupancy grid + cell accessors + config clamping.
 * NO voxelizeMesh, NO raycast — those are Slice 1 (see the plan doc, Section 7).
 *
 * Dependency-free by design: plain {x,y,z} objects for vectors, no THREE.* import, so
 * this module is trivially testable with plain `node --test`.
 */

/** Resolution bounds shared by every clamp in this module (plan Section 3.5 kernel cap). */
export const MIN_RESOLUTION = 2;
export const MAX_RESOLUTION = 64;
export const DEFAULT_RESOLUTION = 24;

/** Hard cell-count ceiling: MAX_RESOLUTION^3, defense in depth against a bad clamp path. */
export const MAX_CELL_COUNT = MAX_RESOLUTION * MAX_RESOLUTION * MAX_RESOLUTION;

/** Smallest extent a degenerate/flat AABB axis is padded to, so cellSize never hits 0. */
const MIN_AABB_EXTENT = 1e-6;

/**
 * Clamp an integer-ish input into [MIN_RESOLUTION, MAX_RESOLUTION].
 * Non-finite / non-numeric input falls back to DEFAULT_RESOLUTION.
 * Out-of-range finite input is clamped to the nearest bound (not defaulted).
 */
export function clampResolution(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_RESOLUTION;
  const intVal = Math.trunc(value);
  if (intVal < MIN_RESOLUTION) return MIN_RESOLUTION;
  if (intVal > MAX_RESOLUTION) return MAX_RESOLUTION;
  return intVal;
}

/**
 * Build a config object for a voxel grid, clamping resolution per clampResolution().
 * Framework-agnostic: `overrides.resolution` is the only field Slice 0 needs.
 */
export function createVoxelConfig(overrides = {}) {
  return {
    resolution: clampResolution(overrides?.resolution),
  };
}

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function assertFiniteAabb(aabb) {
  const bad =
    !aabb || !aabb.min || !aabb.max ||
    !isFiniteNumber(aabb.min.x) || !isFiniteNumber(aabb.min.y) || !isFiniteNumber(aabb.min.z) ||
    !isFiniteNumber(aabb.max.x) || !isFiniteNumber(aabb.max.y) || !isFiniteNumber(aabb.max.z);
  if (bad) {
    throw new TypeError('VoxelGrid: aabb.min/max must be finite {x,y,z} numbers');
  }
}

/** x-fastest flat index: index = x + nx*(y + ny*z). */
export function indexOf(x, y, z, nx, ny) {
  return x + nx * (y + ny * z);
}

/**
 * Bounded uniform-cubic-cell occupancy grid.
 *
 * Constructed from a world-space AABB {min:{x,y,z}, max:{x,y,z}} and a resolution.
 * Rejects non-finite AABB bounds by throwing BEFORE any allocation (fail-fast).
 * cellSize = longest AABB extent / resolution, with degenerate/flat axes padded so
 * cellSize never becomes 0 or negative.
 * Per-axis cell counts are clamped into [1, resolution] so total cells never exceed
 * resolution^3 (hard cap MAX_CELL_COUNT, guard-throw if it would ever be exceeded).
 */
export class VoxelGrid {
  constructor(aabb, resolution, opts = {}) {
    assertFiniteAabb(aabb);

    const config = createVoxelConfig({ resolution });
    this.resolution = config.resolution;

    const extentX = Math.max(aabb.max.x - aabb.min.x, MIN_AABB_EXTENT);
    const extentY = Math.max(aabb.max.y - aabb.min.y, MIN_AABB_EXTENT);
    const extentZ = Math.max(aabb.max.z - aabb.min.z, MIN_AABB_EXTENT);
    const longestExtent = Math.max(extentX, extentY, extentZ);

    this.cellSize = longestExtent / this.resolution;
    if (!Number.isFinite(this.cellSize) || this.cellSize <= 0) {
      // Defense in depth: should be unreachable given the padding above.
      throw new RangeError('VoxelGrid: computed cellSize must be a positive finite number');
    }

    const clampAxisCount = (extent) => {
      const count = Math.ceil(extent / this.cellSize);
      return Math.min(Math.max(count, 1), this.resolution);
    };

    this.nx = clampAxisCount(extentX);
    this.ny = clampAxisCount(extentY);
    this.nz = clampAxisCount(extentZ);

    const cellCount = this.nx * this.ny * this.nz;
    if (cellCount > MAX_CELL_COUNT) {
      // Defense in depth: per-axis clamping above should already prevent this.
      throw new RangeError(
        `VoxelGrid: cell count ${cellCount} exceeds hard cap ${MAX_CELL_COUNT} (${MAX_RESOLUTION}^3)`,
      );
    }

    this.aabb = {
      min: { x: aabb.min.x, y: aabb.min.y, z: aabb.min.z },
      max: { x: aabb.max.x, y: aabb.max.y, z: aabb.max.z },
    };
    this.sourceId = opts.sourceId ?? null;
    this.occupancy = new Uint8Array(cellCount);
  }

  get cellCount() {
    return this.occupancy.length;
  }

  inBounds(x, y, z) {
    return x >= 0 && x < this.nx && y >= 0 && y < this.ny && z >= 0 && z < this.nz;
  }

  /** Set the material id (0 = empty, >0 = occupied) for a cell. No-op if out of bounds. */
  setOccupied(x, y, z, materialId = 1) {
    if (!this.inBounds(x, y, z)) return;
    this.occupancy[indexOf(x, y, z, this.nx, this.ny)] = materialId;
  }

  /** Get the material id for a cell; 0 (empty) if out of bounds. */
  getOccupied(x, y, z) {
    if (!this.inBounds(x, y, z)) return 0;
    return this.occupancy[indexOf(x, y, z, this.nx, this.ny)];
  }

  isOccupied(x, y, z) {
    return this.getOccupied(x, y, z) !== 0;
  }

  get occupiedCount() {
    let count = 0;
    for (let i = 0; i < this.occupancy.length; i += 1) {
      if (this.occupancy[i] !== 0) count += 1;
    }
    return count;
  }

  /** Deterministic fixed-order iteration: z outer, y, x inner. Calls fn(x,y,z,materialId). */
  forEachOccupied(fn) {
    for (let z = 0; z < this.nz; z += 1) {
      for (let y = 0; y < this.ny; y += 1) {
        for (let x = 0; x < this.nx; x += 1) {
          const materialId = this.occupancy[indexOf(x, y, z, this.nx, this.ny)];
          if (materialId !== 0) fn(x, y, z, materialId);
        }
      }
    }
  }
}

/** Free-function wrapper matching the plan's pseudo-IDL: setCell(grid, x, y, z, materialId). */
export function setCell(grid, x, y, z, materialId = 1) {
  grid.setOccupied(x, y, z, materialId);
}

/** Free-function wrapper matching the plan's pseudo-IDL: getCell(grid, x, y, z). */
export function getCell(grid, x, y, z) {
  return grid.getOccupied(x, y, z);
}
