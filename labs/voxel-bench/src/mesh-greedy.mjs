/**
 * Voxel Lab Bench — greedy-quads mesher (Gate B, Slice 3, Tier-2 renderer).
 *
 * Re-derived (not copy-pasted) from the "0fps" / Mikola Lysenko greedy-meshing
 * algorithm cited in docs/VOXEL_LAB_BENCH_PLAN.md Section 2a/2b/3.2/7 (Slice 3): for
 * each of the 6 face directions, sweep the grid one slice at a time, build a 2D mask of
 * exposed same-material faces on that slice, then greedily grow each mask cell into the
 * largest possible rectangle before moving on — merging many small per-cell faces into
 * far fewer, larger quads. Only EXPOSED faces are ever emitted (the neighboring cell in
 * that face's direction is empty or out of bounds); no interior face between two
 * occupied cells is ever produced.
 *
 * Kept a plain, synchronous, dependency-free function operating on a VoxelGrid (no
 * THREE.*, no Worker, no postMessage) by design, so it is directly node:test-testable
 * without needing a real Worker in Node — see workers/mesh-worker.mjs for the thin
 * async wrapper used by the browser page.
 */

/**
 * The 6 face directions a cube can expose, each as { axis, dir, normal }.
 * axis: 0=x, 1=y, 2=z. dir: +1 (facing the positive axis direction) or -1.
 */
const FACE_DIRECTIONS = [
  { axis: 0, dir: 1, normal: [1, 0, 0] },
  { axis: 0, dir: -1, normal: [-1, 0, 0] },
  { axis: 1, dir: 1, normal: [0, 1, 0] },
  { axis: 1, dir: -1, normal: [0, -1, 0] },
  { axis: 2, dir: 1, normal: [0, 0, 1] },
  { axis: 2, dir: -1, normal: [0, 0, -1] },
];

/** dims[axis] cell counts for a grid, in the fixed [nx, ny, nz] axis order. */
function gridDims(grid) {
  return [grid.nx, grid.ny, grid.nz];
}

/**
 * Build the 2D exposed-face mask for one slice along `axis` at grid coordinate
 * `sliceIndex`, for face direction `dir`. Mask is a flat Int32Array of size u*v (the
 * two axes other than `axis`, in ascending axis-index order), where 0 = no face, and a
 * non-zero value is the occupying cell's materialId (so adjacent same-material faces
 * merge, but different-material faces never do).
 *
 * A face at (sliceIndex along axis, u, v) is exposed iff the cell at sliceIndex is
 * occupied AND the neighbor at sliceIndex + dir (along axis) is empty or out of bounds.
 */
function buildSliceMask(grid, axis, dir, sliceIndex, uAxis, vAxis, uSize, vSize) {
  const mask = new Int32Array(uSize * vSize);
  const coord = [0, 0, 0];
  coord[axis] = sliceIndex;

  for (let v = 0; v < vSize; v += 1) {
    coord[vAxis] = v;
    for (let u = 0; u < uSize; u += 1) {
      coord[uAxis] = u;
      const materialId = grid.getOccupied(coord[0], coord[1], coord[2]);
      if (materialId === 0) continue;

      const neighbor = coord.slice();
      neighbor[axis] = sliceIndex + dir;
      const neighborOccupied =
        grid.inBounds(neighbor[0], neighbor[1], neighbor[2]) &&
        grid.getOccupied(neighbor[0], neighbor[1], neighbor[2]) !== 0;

      if (!neighborOccupied) {
        mask[u + v * uSize] = materialId;
      }
    }
  }
  return mask;
}

/**
 * Greedily merge a 2D mask into maximal rectangles, per-cell zeroing consumed entries
 * as it goes (standard 0fps mask-sweep: for each unvisited non-zero cell, grow width
 * along u while the material matches, then grow height along v while the whole
 * candidate row of width `w` still matches, then zero the consumed rectangle).
 * Returns an array of { materialId, u0, v0, w, h } rectangles.
 */
function greedyMergeMask(mask, uSize, vSize) {
  const rects = [];
  const visited = new Uint8Array(mask.length);

  for (let v = 0; v < vSize; v += 1) {
    for (let u = 0; u < uSize; u += 1) {
      const idx = u + v * uSize;
      if (visited[idx] || mask[idx] === 0) continue;

      const materialId = mask[idx];

      // Grow width along u.
      let w = 1;
      while (
        u + w < uSize &&
        !visited[u + w + v * uSize] &&
        mask[u + w + v * uSize] === materialId
      ) {
        w += 1;
      }

      // Grow height along v, requiring the ENTIRE row of width w to match.
      let h = 1;
      outer: while (v + h < vSize) {
        for (let du = 0; du < w; du += 1) {
          const checkIdx = u + du + (v + h) * uSize;
          if (visited[checkIdx] || mask[checkIdx] !== materialId) break outer;
        }
        h += 1;
      }

      // Mark the consumed w*h rectangle visited so it is never reconsidered.
      for (let dv = 0; dv < h; dv += 1) {
        for (let du = 0; du < w; du += 1) {
          visited[u + du + (v + dv) * uSize] = 1;
        }
      }

      rects.push({ materialId, u0: u, v0: v, w, h });
    }
  }

  return rects;
}

/**
 * Emit one quad (4 vertices, 2 triangles / 6 indices) for a merged rectangle on a given
 * slice, into the shared positions/indices accumulator arrays. Vertex winding follows
 * the face normal so backface culling (if enabled by a consumer) works correctly.
 *
 * World-space vertex position = grid.aabb.min + cellCoord * grid.cellSize, i.e. quad
 * corners sit exactly on cell boundaries (not cell centers), matching how a
 * cube-per-cell mesh's faces would tile if merged.
 */
function emitQuad(acc, grid, axis, dir, uAxis, vAxis, sliceIndex, rect) {
  const { u0, v0, w, h } = rect;
  const cellSize = grid.cellSize;
  const faceSlice = dir > 0 ? sliceIndex + 1 : sliceIndex;

  const corner = (u, v) => {
    const coord = [0, 0, 0];
    coord[axis] = faceSlice;
    coord[uAxis] = u;
    coord[vAxis] = v;
    return [
      grid.aabb.min.x + coord[0] * cellSize,
      grid.aabb.min.y + coord[1] * cellSize,
      grid.aabb.min.z + coord[2] * cellSize,
    ];
  };

  const p00 = corner(u0, v0);
  const p10 = corner(u0 + w, v0);
  const p11 = corner(u0 + w, v0 + h);
  const p01 = corner(u0, v0 + h);

  const baseIndex = acc.vertexCount;
  const quadCorners = dir > 0 ? [p00, p10, p11, p01] : [p00, p01, p11, p10];
  for (const p of quadCorners) {
    acc.positions.push(p[0], p[1], p[2]);
  }
  acc.vertexCount += 4;

  // Two triangles per quad, consistent winding with the corner order above.
  acc.indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
  acc.indices.push(baseIndex, baseIndex + 2, baseIndex + 3);
  acc.quadCount += 1;
}

/**
 * greedyMesh(grid) -> { positions: Float32Array, indices: Uint16Array|Uint32Array,
 *                        quadCount: number, triangleCount: number }
 *
 * Runs the full 6-direction greedy-quads sweep over a VoxelGrid's occupied cells,
 * emitting one merged quad per maximal same-material exposed-face rectangle. An empty
 * grid (occupiedCount === 0) produces zero quads without throwing.
 *
 * indices is Uint16Array when the vertex count fits (<= 65535), else Uint32Array —
 * mirroring the standard indexed-triangle-output convention the plan cites (Section
 * 2a) for the zeux/Kapoulkine technique.
 */
export function greedyMesh(grid) {
  if (!grid) throw new TypeError('greedyMesh: grid is required');

  const acc = { positions: [], indices: [], vertexCount: 0, quadCount: 0 };
  const dims = gridDims(grid);

  if (grid.occupiedCount === 0) {
    return { positions: new Float32Array(0), indices: new Uint16Array(0), quadCount: 0, triangleCount: 0 };
  }

  for (const { axis, dir } of FACE_DIRECTIONS) {
    const otherAxes = [0, 1, 2].filter((a) => a !== axis);
    const [uAxis, vAxis] = otherAxes;
    const uSize = dims[uAxis];
    const vSize = dims[vAxis];
    const sliceCount = dims[axis];

    for (let sliceIndex = 0; sliceIndex < sliceCount; sliceIndex += 1) {
      const mask = buildSliceMask(grid, axis, dir, sliceIndex, uAxis, vAxis, uSize, vSize);
      const rects = greedyMergeMask(mask, uSize, vSize);
      for (const rect of rects) {
        emitQuad(acc, grid, axis, dir, uAxis, vAxis, sliceIndex, rect);
      }
    }
  }

  const positions = Float32Array.from(acc.positions);
  const IndexArrayCtor = acc.vertexCount > 65535 ? Uint32Array : Uint16Array;
  const indices = IndexArrayCtor.from(acc.indices);

  return {
    positions,
    indices,
    quadCount: acc.quadCount,
    triangleCount: acc.quadCount * 2,
  };
}

/**
 * naiveFaceCount(grid) -> number
 *
 * Reference (non-merged) exposed-face count: one face per occupied cell per exposed
 * direction, matching what a cube-per-cell / per-face mesher would emit before any
 * greedy merging. Used by tests and the bench readout to compute the merge ratio —
 * kept here (rather than duplicated in the test file) so the baseline definition and
 * the merged algorithm can never drift apart silently.
 */
export function naiveFaceCount(grid) {
  if (!grid) throw new TypeError('naiveFaceCount: grid is required');
  let faces = 0;
  grid.forEachOccupied((x, y, z) => {
    for (const { axis, dir } of FACE_DIRECTIONS) {
      const neighbor = [x, y, z];
      neighbor[axis] += dir;
      const neighborOccupied =
        grid.inBounds(neighbor[0], neighbor[1], neighbor[2]) &&
        grid.getOccupied(neighbor[0], neighbor[1], neighbor[2]) !== 0;
      if (!neighborOccupied) faces += 1;
    }
  });
  return faces;
}

export const GREEDY_FACE_DIRECTIONS = FACE_DIRECTIONS;
