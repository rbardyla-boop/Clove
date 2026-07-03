/**
 * Voxel Lab Bench — Gate B Slice 4 LOD tests (Node-side, no browser).
 *   node --test labs/voxel-bench/test/lod.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid } from '../src/bench-core.mjs';
import { downsampleChunk, computeLodLevel, densityThreshold, DEFAULT_LOD_TIER_CONFIG } from '../src/lod.mjs';

function makeGrid(size, resolution = size) {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: size, y: size, z: size } };
  return new VoxelGrid(aabb, resolution, { sourceId: 'lod-fixture' });
}

test('densityThreshold: majority-of-8 threshold for factor=2 (2^3=8 children) is 4', () => {
  assert.equal(densityThreshold(8), 4);
});

test('downsampleChunk throws on a missing grid', () => {
  assert.throws(() => downsampleChunk(null, 2), TypeError);
});

test('downsampleChunk throws on a non-positive-integer factor', () => {
  const grid = makeGrid(4);
  assert.throws(() => downsampleChunk(grid, 0), RangeError);
  assert.throws(() => downsampleChunk(grid, -1), RangeError);
  assert.throws(() => downsampleChunk(grid, 1.5), RangeError);
});

test('downsampleChunk factor=1 preserves occupancy 1:1 (each coarse cell has exactly one child)', () => {
  const grid = makeGrid(4);
  grid.setOccupied(1, 1, 1, 1);
  grid.setOccupied(2, 3, 0, 1);
  const coarse = downsampleChunk(grid, 1);
  assert.equal(coarse.nx, grid.nx);
  assert.equal(coarse.ny, grid.ny);
  assert.equal(coarse.nz, grid.nz);
  assert.deepEqual(Array.from(coarse.occupancy), Array.from(grid.occupancy));
});

test('downsampleChunk SHOULD merge to occupied: a fully-solid 2x2x2 block has 8/8 non-empty children (>= threshold 4)', () => {
  // 4^3 fine grid -> factor 2 -> 2x2x2 coarse grid, one coarse cell per 2x2x2 block.
  const grid = makeGrid(4);
  for (let z = 0; z < 2; z += 1) {
    for (let y = 0; y < 2; y += 1) {
      for (let x = 0; x < 2; x += 1) {
        grid.setOccupied(x, y, z, 1);
      }
    }
  }
  const coarse = downsampleChunk(grid, 2);
  assert.equal(coarse.nx, 2);
  assert.equal(coarse.ny, 2);
  assert.equal(coarse.nz, 2);
  // The block occupying fine cells [0,1]x[0,1]x[0,1] maps entirely into coarse cell (0,0,0):
  // all 8 children are non-empty (8 >= threshold 4) => coarse cell MUST be occupied.
  assert.ok(coarse.isOccupied(0, 0, 0), 'fully-solid 2x2x2 block must downsample to an occupied coarse cell');
  assert.equal(coarse.getOccupied(0, 0, 0), 1);
});

test('downsampleChunk SHOULD merge to empty: a single occupied fine cell out of 8 children (1/8 < threshold 4)', () => {
  const grid = makeGrid(4);
  // Only ONE of the 8 fine children in the (0,0,0) coarse block is occupied.
  grid.setOccupied(0, 0, 0, 1);
  const coarse = downsampleChunk(grid, 2);
  assert.equal(coarse.isOccupied(0, 0, 0), false, '1-of-8 non-empty children must NOT meet the >=4-of-8 majority threshold');
});

test('downsampleChunk boundary: exactly threshold (4 of 8) children non-empty merges to occupied', () => {
  const grid = makeGrid(4);
  // Occupy exactly 4 of the 8 fine children in coarse block (0,0,0).
  grid.setOccupied(0, 0, 0, 1);
  grid.setOccupied(1, 0, 0, 1);
  grid.setOccupied(0, 1, 0, 1);
  grid.setOccupied(0, 0, 1, 1);
  const coarse = downsampleChunk(grid, 2);
  assert.ok(coarse.isOccupied(0, 0, 0), 'exactly 4-of-8 (the threshold) must merge to occupied');
});

test('downsampleChunk boundary: one below threshold (3 of 8) children non-empty merges to empty', () => {
  const grid = makeGrid(4);
  grid.setOccupied(0, 0, 0, 1);
  grid.setOccupied(1, 0, 0, 1);
  grid.setOccupied(0, 1, 0, 1);
  const coarse = downsampleChunk(grid, 2);
  assert.equal(coarse.isOccupied(0, 0, 0), false, '3-of-8 (one below the threshold) must merge to empty');
});

test('downsampleChunk picks the majority material id among a coarse cell\'s occupied children', () => {
  const grid = makeGrid(4);
  // 5 of 8 children occupied (meets threshold), 3 with materialId=2, 2 with materialId=3.
  grid.setOccupied(0, 0, 0, 2);
  grid.setOccupied(1, 0, 0, 2);
  grid.setOccupied(0, 1, 0, 2);
  grid.setOccupied(1, 1, 0, 3);
  grid.setOccupied(0, 0, 1, 3);
  const coarse = downsampleChunk(grid, 2);
  assert.ok(coarse.isOccupied(0, 0, 0));
  assert.equal(coarse.getOccupied(0, 0, 0), 2, 'majority material id (3 of 5 occupied children) must win');
});

test('downsampleChunk never mutates the source grid', () => {
  const grid = makeGrid(4);
  grid.setOccupied(1, 1, 1, 1);
  const before = Array.from(grid.occupancy);
  downsampleChunk(grid, 2);
  assert.deepEqual(Array.from(grid.occupancy), before);
});

test('downsampleChunk on an empty grid produces an empty coarse grid without throwing', () => {
  const grid = makeGrid(4);
  const coarse = downsampleChunk(grid, 2);
  assert.equal(coarse.occupiedCount, 0);
});

// --- computeLodLevel ---

test('computeLodLevel returns level 0 for distance 0 (nearest)', () => {
  assert.equal(computeLodLevel(0, { switchDistances: [10, 50] }), 0);
});

test('computeLodLevel returns increasing levels for increasing distance across a multi-threshold table', () => {
  const tierConfig = { switchDistances: [10, 50, 200] };
  assert.equal(computeLodLevel(5, tierConfig), 0);
  assert.equal(computeLodLevel(15, tierConfig), 1);
  assert.equal(computeLodLevel(60, tierConfig), 2);
  assert.equal(computeLodLevel(500, tierConfig), 3);
});

test('computeLodLevel boundary: distance exactly AT a threshold belongs to the farther (coarser) level', () => {
  const tierConfig = { switchDistances: [10] };
  assert.equal(computeLodLevel(9.999, tierConfig), 0, 'just below threshold stays at level 0');
  assert.equal(computeLodLevel(10, tierConfig), 1, 'exactly at threshold switches to level 1');
  assert.equal(computeLodLevel(10.001, tierConfig), 1, 'just above threshold stays at level 1');
});

test('computeLodLevel with the default single-threshold tier config used by the bench room', () => {
  assert.equal(computeLodLevel(0, DEFAULT_LOD_TIER_CONFIG), 0);
  assert.equal(computeLodLevel(DEFAULT_LOD_TIER_CONFIG.switchDistances[0], DEFAULT_LOD_TIER_CONFIG), 1);
});

test('computeLodLevel throws on a negative distance', () => {
  assert.throws(() => computeLodLevel(-1, { switchDistances: [10] }), RangeError);
});

test('computeLodLevel throws on a non-finite distance', () => {
  assert.throws(() => computeLodLevel(NaN, { switchDistances: [10] }), RangeError);
  assert.throws(() => computeLodLevel(Infinity, { switchDistances: [10] }), RangeError);
});

test('computeLodLevel throws on a missing/empty switchDistances table', () => {
  assert.throws(() => computeLodLevel(5, {}), TypeError);
  assert.throws(() => computeLodLevel(5, { switchDistances: [] }), TypeError);
});

test('computeLodLevel throws on a non-monotonic switchDistances table', () => {
  assert.throws(() => computeLodLevel(5, { switchDistances: [50, 10] }), RangeError);
});
