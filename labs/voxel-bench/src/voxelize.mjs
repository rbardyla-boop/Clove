/**
 * Voxel Lab Bench — triangle-box SAT voxelization (Gate A, Slice 1).
 *
 * Re-derived (not copy-pasted) from the behavioral contract described in
 * docs/VOXEL_LAB_BENCH_PLAN.md Section 3.2/7 (Slice 1), itself design-informed by the
 * sibling repo's Stage-16 Voxel Debug Lab (`webbroswer-assest-creator`) inspected
 * read-only for prior art. This module has NO runtime or build-time dependency on that
 * repo and copies none of its source.
 *
 * Scope: voxelizeMesh(triangles, aabb, config) only. Builds a fresh VoxelGrid (Slice 0,
 * bench-core.mjs) over the given world AABB and marks every cell whose axis-aligned box
 * overlaps at least one input triangle, using the standard 13-axis Akenine-Moller
 * triangle-box separating-axis test. This is SURFACE voxelization (a closed hollow
 * shell voxelizes to a hollow shell of occupied cells, not a solid fill).
 *
 * No RNG, no Date.now(), no wall-clock coupling — same determinism discipline as
 * bench-core.mjs (Section 3.6 of the plan).
 */

import { VoxelGrid } from './bench-core.mjs';

/** Hard ceiling on triangles considered, regardless of how large the input is. */
export const DEFAULT_TRIANGLE_BUDGET = 20000;

/**
 * Hard ceiling on total (triangle x candidate-cell) SAT tests performed, regardless of
 * how large or degenerate the input mesh/grid combination is. This is the genuine
 * global stop condition — the per-triangle cell-AABB loop is clamped to the triangle's
 * own bounds, but a pathological input (huge triangle over a high-resolution grid)
 * could still touch many cells; this budget caps that runaway case too.
 */
export const DEFAULT_SAT_TEST_BUDGET = 2_000_000;

const MATERIAL_ID = 1;

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function isFiniteVertex(v) {
  return v && isFiniteNumber(v.x) && isFiniteNumber(v.y) && isFiniteNumber(v.z);
}

function isFiniteTriangle(tri) {
  return tri && isFiniteVertex(tri.a) && isFiniteVertex(tri.b) && isFiniteVertex(tri.c);
}

function sub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

const AXIS_UNIT = [
  { x: 1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: 0, z: 1 },
];

const EDGE_AXIS_EPS = 1e-12;

/**
 * Akenine-Moller triangle-box overlap test. `boxCenter`/`boxHalfSize` describe the
 * candidate cell's AABB in the same world-space units as the triangle vertices.
 * Triangle vertices are pre-shifted so the box center is the origin (v0/v1/v2 already
 * relative to boxCenter) for cheaper per-axis projection.
 */
function triangleOverlapsBox(v0, v1, v2, boxHalfSize) {
  // 1) 3 box-face-normal axes: fast AABB-vs-triangle-AABB reject on each axis.
  const triMinMax = (axis) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of [v0, v1, v2]) {
      const p = axis === 'x' ? v.x : axis === 'y' ? v.y : v.z;
      if (p < lo) lo = p;
      if (p > hi) hi = p;
    }
    return [lo, hi];
  };
  {
    const [lo, hi] = triMinMax('x');
    if (hi < -boxHalfSize.x || lo > boxHalfSize.x) return false;
  }
  {
    const [lo, hi] = triMinMax('y');
    if (hi < -boxHalfSize.y || lo > boxHalfSize.y) return false;
  }
  {
    const [lo, hi] = triMinMax('z');
    if (hi < -boxHalfSize.z || lo > boxHalfSize.z) return false;
  }

  const e0 = sub(v1, v0);
  const e1 = sub(v2, v1);
  const e2 = sub(v0, v2);
  const edges = [e0, e1, e2];

  // 2) Triangle-normal axis.
  const normal = cross(e0, e1);
  if (!axisSeparates(normal, v0, v1, v2, boxHalfSize)) return false;

  // 3) 9 edge-cross-axes: each triangle edge crossed with each box unit axis.
  for (const edge of edges) {
    for (const unit of AXIS_UNIT) {
      const axis = cross(edge, unit);
      const lenSq = dot(axis, axis);
      if (lenSq < EDGE_AXIS_EPS) continue; // edge parallel to this box axis, skip
      if (!axisSeparates(axis, v0, v1, v2, boxHalfSize)) return false;
    }
  }

  return true;
}

/** Project triangle verts + box half-extents onto `axis`; false if axis separates them. */
function axisSeparates(axis, v0, v1, v2, boxHalfSize) {
  const p0 = dot(axis, v0);
  const p1 = dot(axis, v1);
  const p2 = dot(axis, v2);
  const triMin = Math.min(p0, p1, p2);
  const triMax = Math.max(p0, p1, p2);

  const boxRadius =
    boxHalfSize.x * Math.abs(axis.x) +
    boxHalfSize.y * Math.abs(axis.y) +
    boxHalfSize.z * Math.abs(axis.z);

  if (triMin > boxRadius || triMax < -boxRadius) return false;
  return true;
}

function triangleAabb(tri) {
  return {
    min: {
      x: Math.min(tri.a.x, tri.b.x, tri.c.x),
      y: Math.min(tri.a.y, tri.b.y, tri.c.y),
      z: Math.min(tri.a.z, tri.b.z, tri.c.z),
    },
    max: {
      x: Math.max(tri.a.x, tri.b.x, tri.c.x),
      y: Math.max(tri.a.y, tri.b.y, tri.c.y),
      z: Math.max(tri.a.z, tri.b.z, tri.c.z),
    },
  };
}

/** World-space coordinate -> the cell index containing it, clamped into [0, n-1]. */
function worldToCellCoord(worldValue, minValue, cellSize, n) {
  const raw = Math.floor((worldValue - minValue) / cellSize);
  return Math.min(Math.max(raw, 0), n - 1);
}

/**
 * voxelizeMesh(triangles, aabb, config) -> VoxelizeResult
 *
 * triangles: array of { a:{x,y,z}, b:{x,y,z}, c:{x,y,z} }.
 * aabb: world-space AABB the grid should cover (see bench-core.mjs VoxelGrid).
 * config: { resolution?, materialId?, triangleBudget?, satTestBudget? }
 *
 * Returns { grid: VoxelGrid|null, truncated: boolean, trianglesProcessed: number,
 *           satTestsPerformed: number } — grid is null only for genuinely empty input.
 */
export function voxelizeMesh(triangles, aabb, config = {}) {
  if (!Array.isArray(triangles) || triangles.length === 0) {
    return { grid: null, truncated: false, trianglesProcessed: 0, satTestsPerformed: 0 };
  }

  const materialId = config.materialId ?? MATERIAL_ID;
  const triangleBudget = config.triangleBudget ?? DEFAULT_TRIANGLE_BUDGET;
  const satTestBudget = config.satTestBudget ?? DEFAULT_SAT_TEST_BUDGET;

  const grid = new VoxelGrid(aabb, config.resolution, { sourceId: config.sourceId });

  let truncated = false;
  let trianglesProcessed = 0;
  let satTestsPerformed = 0;

  outer: for (let t = 0; t < triangles.length; t += 1) {
    if (t >= triangleBudget) {
      truncated = true;
      break outer;
    }

    const tri = triangles[t];
    if (!isFiniteTriangle(tri)) continue; // reject/skip non-finite geometry, never allocate on it

    trianglesProcessed += 1;

    const triAabb = triangleAabb(tri);
    // Clamp the triangle's own cell-AABB into the grid so we only ever scan the cells
    // that triangle's bounding box could touch, never the whole grid.
    const x0 = worldToCellCoord(triAabb.min.x, grid.aabb.min.x, grid.cellSize, grid.nx);
    const x1 = worldToCellCoord(triAabb.max.x, grid.aabb.min.x, grid.cellSize, grid.nx);
    const y0 = worldToCellCoord(triAabb.min.y, grid.aabb.min.y, grid.cellSize, grid.ny);
    const y1 = worldToCellCoord(triAabb.max.y, grid.aabb.min.y, grid.cellSize, grid.ny);
    const z0 = worldToCellCoord(triAabb.min.z, grid.aabb.min.z, grid.cellSize, grid.nz);
    const z1 = worldToCellCoord(triAabb.max.z, grid.aabb.min.z, grid.cellSize, grid.nz);

    const halfSize = {
      x: grid.cellSize / 2,
      y: grid.cellSize / 2,
      z: grid.cellSize / 2,
    };

    for (let z = z0; z <= z1; z += 1) {
      for (let y = y0; y <= y1; y += 1) {
        for (let x = x0; x <= x1; x += 1) {
          if (satTestsPerformed >= satTestBudget) {
            truncated = true;
            break outer;
          }
          satTestsPerformed += 1;

          if (grid.isOccupied(x, y, z)) continue; // already marked, skip the test

          const cellCenter = {
            x: grid.aabb.min.x + (x + 0.5) * grid.cellSize,
            y: grid.aabb.min.y + (y + 0.5) * grid.cellSize,
            z: grid.aabb.min.z + (z + 0.5) * grid.cellSize,
          };
          const v0 = sub(tri.a, cellCenter);
          const v1 = sub(tri.b, cellCenter);
          const v2 = sub(tri.c, cellCenter);

          if (triangleOverlapsBox(v0, v1, v2, halfSize)) {
            grid.setOccupied(x, y, z, materialId);
          }
        }
      }
    }
  }

  return { grid, truncated, trianglesProcessed, satTestsPerformed };
}
