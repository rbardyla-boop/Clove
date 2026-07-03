/**
 * Voxel Lab Bench — Gate B Slice 3 mesh-greedy tests (Node-side, no browser).
 *   node --test labs/voxel-bench/test/mesh-greedy.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid } from '../src/bench-core.mjs';
import { greedyMesh, naiveFaceCount } from '../src/mesh-greedy.mjs';

function makeGrid(size, resolution = size) {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: size, y: size, z: size } };
  return new VoxelGrid(aabb, resolution, { sourceId: 'mesh-greedy-fixture' });
}

test('greedyMesh on an empty grid produces zero quads without throwing', () => {
  const grid = makeGrid(4);
  const result = greedyMesh(grid);
  assert.equal(result.quadCount, 0);
  assert.equal(result.triangleCount, 0);
  assert.equal(result.positions.length, 0);
  assert.equal(result.indices.length, 0);
});

test('greedyMesh throws on a missing grid', () => {
  assert.throws(() => greedyMesh(null), TypeError);
});

test('a single occupied cell emits exactly 6 quads (one per exposed face)', () => {
  const grid = makeGrid(4);
  grid.setOccupied(1, 1, 1, 1);
  const result = greedyMesh(grid);
  assert.equal(result.quadCount, 6);
  assert.equal(result.triangleCount, 12);
  assert.equal(result.indices.length, 12 * 3);
  // 4 unique vertices per quad, no cross-quad vertex sharing in this simple emitter.
  assert.equal(result.positions.length, 6 * 4 * 3);
});

test('a fully solid NxNxN block only emits the 6 outer faces worth of quads (interior faces culled)', () => {
  const n = 4;
  const grid = makeGrid(n);
  for (let z = 0; z < n; z += 1) {
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        grid.setOccupied(x, y, z, 1);
      }
    }
  }
  const result = greedyMesh(grid);
  // Every one of the 6 faces of a solid uniform-material cube is a single N x N
  // rectangle that greedy-merges into exactly ONE quad — so a solid block emits
  // exactly 6 quads total, regardless of N, and zero interior faces are ever emitted.
  assert.equal(result.quadCount, 6);
  assert.equal(result.triangleCount, 12);
});

test('greedy-mesh quad count is strictly lower than the naive per-face-per-cell baseline for a multi-cell fixture', () => {
  // Solid 2x2x2 block: naive baseline emits one face per occupied cell per exposed
  // direction (24 faces total: 6 faces x 4 exposed-cell-faces-per-side), greedy
  // merging should collapse each side's 2x2 exposed-face patch into a single quad,
  // i.e. 6 quads total — comfortably inside the plan's cited "~8x-of-optimal" ballpark
  // (24 naive faces vs 6 merged quads here is exactly optimal for this shape, well
  // under the 8x bound).
  const grid = makeGrid(4);
  for (let z = 1; z <= 2; z += 1) {
    for (let y = 1; y <= 2; y += 1) {
      for (let x = 1; x <= 2; x += 1) {
        grid.setOccupied(x, y, z, 1);
      }
    }
  }

  const naive = naiveFaceCount(grid);
  const result = greedyMesh(grid);

  assert.equal(naive, 24);
  assert.ok(
    result.quadCount < naive,
    `expected merged quadCount (${result.quadCount}) < naive face count (${naive})`,
  );
  assert.equal(result.quadCount, 6);
});

test('no face is emitted between two occupied cells (interior faces are culled) for an irregular shape', () => {
  const grid = makeGrid(6);
  // An L-shaped solid region.
  for (let x = 0; x < 4; x += 1) grid.setOccupied(x, 1, 1, 1);
  for (let y = 1; y < 4; y += 1) grid.setOccupied(0, y, 1, 1);

  const naive = naiveFaceCount(grid);
  const result = greedyMesh(grid);

  // Merged quad count must never exceed the naive (unmerged) baseline — greedy
  // merging can only reduce or match face count, never increase it.
  assert.ok(result.quadCount <= naive);
  assert.ok(result.quadCount > 0);

  // Independently verify zero interior faces: every quad's total area (in cells) must
  // sum to exactly the naive exposed-face count, proving no extra/interior faces were
  // fabricated and none were dropped.
  const totalMergedArea = quadAreaFromIndices(result);
  assert.equal(totalMergedArea, naive);
});

test('two different materials sharing a boundary never merge into one quad and no interior face is emitted between them', () => {
  const grid = makeGrid(4);
  grid.setOccupied(0, 0, 0, 1);
  grid.setOccupied(1, 0, 0, 2);

  const result = greedyMesh(grid);
  // Two distinct 1-cell cubes side by side: the touching faces between them are
  // interior (both cells occupied) and must be culled regardless of differing
  // material ids; each cube still exposes 5 faces (1 face is internal/touching).
  assert.equal(result.quadCount, 10);
});

/** Reconstruct total exposed-face-cell area (in unit cells) from emitted quad geometry. */
function quadAreaFromIndices(result) {
  const { positions, indices } = result;
  let totalArea = 0;
  for (let i = 0; i < indices.length; i += 6) {
    // Each quad is 2 triangles = 6 indices = vertices [a,b,c, a,c,d] over a shared
    // rectangle; reconstruct the 4 unique corners for this quad (indices i..i+5 span
    // exactly one quad given this module's emission order).
    const idxSet = [...new Set([indices[i], indices[i + 1], indices[i + 2], indices[i + 4]])];
    const pts = idxSet.map((idx) => [
      positions[idx * 3],
      positions[idx * 3 + 1],
      positions[idx * 3 + 2],
    ]);
    // Rectangle area = product of the two non-zero edge-length deltas from corner 0.
    const [p0, p1, p2] = pts;
    const edge1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const edge2 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
    const len1 = Math.hypot(...edge1);
    const len2 = Math.hypot(...edge2);
    totalArea += len1 * len2; // cellSize is 1 world unit per cell in these fixtures
  }
  return Math.round(totalArea);
}
