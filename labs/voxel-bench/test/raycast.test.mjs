/**
 * Voxel Lab Bench — Gate A Slice 1 Amanatides-Woo raycast tests.
 *   node --test labs/voxel-bench/test/raycast.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid, setCell } from '../src/bench-core.mjs';
import { raycastVoxels, RAYCAST_REASON } from '../src/raycast.mjs';

/** A 4x4x4 grid over [0,4]^3 (cellSize = 1) with exactly one occupied cell at (2,2,2). */
function singleVoxelGrid() {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 4, z: 4 } };
  const grid = new VoxelGrid(aabb, 4, { sourceId: 'test-grid' });
  setCell(grid, 2, 2, 2, 1);
  return grid;
}

test('clean hit: ray straight down -x reports correct voxel/face/normal/distance', () => {
  const grid = singleVoxelGrid();
  // Occupied cell (2,2,2) spans x in [2,3], y in [2,3], z in [2,3].
  const origin = { x: 0, y: 2.5, z: 2.5 };
  const direction = { x: 1, y: 0, z: 0 };

  const result = raycastVoxels(grid, origin, direction);

  assert.equal(result.hit, true);
  assert.deepEqual(result.cell, [2, 2, 2]);
  assert.equal(result.face, '-x');
  assert.deepEqual(result.normal, { x: -1, y: 0, z: 0 });
  assert.equal(result.distance, 2);
  assert.equal(result.inside, false);
  assert.equal(result.sourceId, 'test-grid');
});

test('miss: ray never enters the grid at all', () => {
  const grid = singleVoxelGrid();
  const origin = { x: -10, y: 100, z: 100 };
  const direction = { x: 1, y: 0, z: 0 };

  const result = raycastVoxels(grid, origin, direction);

  assert.equal(result.hit, false);
  assert.equal(result.reason, RAYCAST_REASON.MISS);
});

test('bounds-exit: ray enters the grid but finds no occupied cell before exiting', () => {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 4, z: 4 } };
  const emptyGrid = new VoxelGrid(aabb, 4); // no occupied cells at all
  const origin = { x: -1, y: 0.5, z: 0.5 };
  const direction = { x: 1, y: 0, z: 0 };

  const result = raycastVoxels(emptyGrid, origin, direction);

  assert.equal(result.hit, false);
  assert.equal(result.reason, RAYCAST_REASON.BOUNDS_EXIT);
});

test('parallel axis: a zero direction component on one axis does not divide by zero', () => {
  const grid = singleVoxelGrid();
  // Direction has y=0 exactly; ray travels along x at a fixed y,z that clips the voxel.
  const origin = { x: 0, y: 2.5, z: 2.5 };
  const direction = { x: 1, y: 0, z: 0.0000000001 }; // near-zero but the y is exactly 0
  // Re-run with an exact zero y-component to hit the parallel-axis path directly.
  const exactParallel = { x: 1, y: 0, z: 0 };

  const result = raycastVoxels(grid, origin, exactParallel);

  assert.equal(result.hit, true);
  assert.deepEqual(result.cell, [2, 2, 2]);
  assert.ok(Number.isFinite(result.distance));

  // Sanity: the near-zero-but-not-exact variant also produces a finite, sane result.
  const result2 = raycastVoxels(grid, origin, direction);
  assert.equal(result2.hit, true);
  assert.ok(Number.isFinite(result2.distance));
});

test('negative direction: ray travels backward along an axis and still resolves correctly', () => {
  const grid = singleVoxelGrid();
  const origin = { x: 4, y: 2.5, z: 2.5 };
  const direction = { x: -1, y: 0, z: 0 };

  const result = raycastVoxels(grid, origin, direction);

  assert.equal(result.hit, true);
  assert.deepEqual(result.cell, [2, 2, 2]);
  assert.equal(result.face, '+x');
  assert.deepEqual(result.normal, { x: 1, y: 0, z: 0 });
  assert.equal(result.distance, 1);
});

test('non-finite direction component is rejected cleanly, not a slow spin or NaN result', () => {
  const grid = singleVoxelGrid();
  const origin = { x: 0, y: 2.5, z: 2.5 };

  const nanResult = raycastVoxels(grid, origin, { x: NaN, y: 0, z: 0 });
  assert.equal(nanResult.hit, false);
  assert.equal(nanResult.reason, RAYCAST_REASON.NON_FINITE_DIRECTION);

  const infResult = raycastVoxels(grid, origin, { x: Infinity, y: 0, z: 0 });
  assert.equal(infResult.hit, false);
  assert.equal(infResult.reason, RAYCAST_REASON.NON_FINITE_DIRECTION);
});

test('zero-length direction is rejected cleanly', () => {
  const grid = singleVoxelGrid();
  const origin = { x: 0, y: 2.5, z: 2.5 };

  const result = raycastVoxels(grid, origin, { x: 0, y: 0, z: 0 });

  assert.equal(result.hit, false);
  assert.equal(result.reason, RAYCAST_REASON.ZERO_LENGTH_DIRECTION);
});

test('ray starting inside the occupied grid cell reports a distinct inside case', () => {
  const grid = singleVoxelGrid();
  // Origin placed directly inside the occupied cell (2,2,2), which spans [2,3]^3.
  const origin = { x: 2.5, y: 2.5, z: 2.5 };
  const direction = { x: 1, y: 0, z: 0 };

  const result = raycastVoxels(grid, origin, direction);

  assert.equal(result.hit, true);
  assert.equal(result.inside, true);
  assert.deepEqual(result.cell, [2, 2, 2]);
  assert.equal(result.face, null);
  assert.equal(result.normal, null);
  assert.equal(result.distance, 0);
});

test('behind: grid AABB is entirely behind the ray origin', () => {
  const grid = singleVoxelGrid();
  const origin = { x: 10, y: 2.5, z: 2.5 };
  const direction = { x: 1, y: 0, z: 0 }; // pointing away from the grid entirely

  const result = raycastVoxels(grid, origin, direction);

  assert.equal(result.hit, false);
  assert.ok(
    result.reason === RAYCAST_REASON.BEHIND || result.reason === RAYCAST_REASON.MISS,
    `expected BEHIND or MISS, got ${result.reason}`,
  );
});

test('pure function: identical grid+origin+direction always produces the identical result', () => {
  const grid = singleVoxelGrid();
  const origin = { x: 0, y: 2.5, z: 2.5 };
  const direction = { x: 1, y: 0, z: 0 };

  const a = raycastVoxels(grid, origin, direction);
  const b = raycastVoxels(grid, origin, direction);

  assert.deepEqual(a, b);
});

test('maxDist option reports a miss when the hit distance exceeds it', () => {
  const grid = singleVoxelGrid();
  const origin = { x: 0, y: 2.5, z: 2.5 };
  const direction = { x: 1, y: 0, z: 0 };

  const result = raycastVoxels(grid, origin, direction, { maxDist: 1 });

  assert.equal(result.hit, false);
});

test('no grid provided returns a clean rejection, not a throw', () => {
  const result = raycastVoxels(null, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
  assert.equal(result.hit, false);
  assert.equal(result.reason, RAYCAST_REASON.NO_GRID);
});
