/**
 * Voxel Lab Bench — Gate A Slice 0 kernel scaffolding tests.
 *   node --test labs/voxel-bench/test/bench-core.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VoxelGrid,
  setCell,
  getCell,
  indexOf,
  clampResolution,
  createVoxelConfig,
  MIN_RESOLUTION,
  MAX_RESOLUTION,
  DEFAULT_RESOLUTION,
} from '../src/bench-core.mjs';

const UNIT_AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } };

test('setCell/getCell round-trip on a freshly built grid', () => {
  const grid = new VoxelGrid(UNIT_AABB, 8);
  assert.equal(getCell(grid, 1, 2, 3), 0);
  setCell(grid, 1, 2, 3, 5);
  assert.equal(getCell(grid, 1, 2, 3), 5);
  assert.equal(grid.isOccupied(1, 2, 3), true);
  assert.equal(grid.occupiedCount, 1);
});

test('setCell/getCell round-trip for every corner of the grid', () => {
  const grid = new VoxelGrid(UNIT_AABB, 4);
  const corners = [
    [0, 0, 0], [grid.nx - 1, 0, 0], [0, grid.ny - 1, 0], [0, 0, grid.nz - 1],
    [grid.nx - 1, grid.ny - 1, grid.nz - 1],
  ];
  for (const [x, y, z] of corners) {
    setCell(grid, x, y, z, 9);
    assert.equal(getCell(grid, x, y, z), 9, `corner (${x},${y},${z})`);
  }
  assert.equal(grid.occupiedCount, corners.length);
});

test('out-of-bounds getCell returns 0 (empty), not a throw', () => {
  const grid = new VoxelGrid(UNIT_AABB, 4);
  assert.equal(getCell(grid, -1, 0, 0), 0);
  assert.equal(getCell(grid, 999, 0, 0), 0);
});

test('out-of-bounds setCell is a safe no-op', () => {
  const grid = new VoxelGrid(UNIT_AABB, 4);
  setCell(grid, -1, 0, 0, 3);
  setCell(grid, 999, 0, 0, 3);
  assert.equal(grid.occupiedCount, 0);
});

test('non-finite AABB bounds are rejected before any allocation', () => {
  const badAabbs = [
    { min: { x: NaN, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
    { min: { x: 0, y: 0, z: 0 }, max: { x: Infinity, y: 1, z: 1 } },
    { min: { x: 0, y: -Infinity, z: 0 }, max: { x: 1, y: 1, z: 1 } },
    { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: NaN } },
    null,
    { min: { x: 0, y: 0, z: 0 } }, // missing max
  ];
  for (const aabb of badAabbs) {
    assert.throws(() => new VoxelGrid(aabb, 8), /finite/i);
  }
});

test('non-finite AABB throw happens before occupancy is allocated (no partial grid observable)', () => {
  let threw = false;
  let grid;
  try {
    grid = new VoxelGrid({ min: { x: NaN, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } }, 8);
  } catch {
    threw = true;
  }
  assert.equal(threw, true);
  assert.equal(grid, undefined);
});

test('resolution clamp: too-high input clamps to MAX_RESOLUTION (64)', () => {
  const grid = new VoxelGrid(UNIT_AABB, 999);
  assert.equal(grid.resolution, MAX_RESOLUTION);
  assert.equal(createVoxelConfig({ resolution: 999 }).resolution, MAX_RESOLUTION);
  assert.equal(clampResolution(999), 64);
});

test('resolution clamp: too-low / negative input clamps to MIN_RESOLUTION (2)', () => {
  const grid = new VoxelGrid(UNIT_AABB, 0);
  assert.equal(grid.resolution, MIN_RESOLUTION);
  assert.equal(clampResolution(0), 2);
  assert.equal(clampResolution(-50), 2);
});

test('resolution clamp: non-numeric / missing input defaults to DEFAULT_RESOLUTION (24)', () => {
  assert.equal(clampResolution(undefined), DEFAULT_RESOLUTION);
  assert.equal(clampResolution(null), DEFAULT_RESOLUTION);
  assert.equal(clampResolution('garbage'), DEFAULT_RESOLUTION);
  assert.equal(clampResolution(NaN), DEFAULT_RESOLUTION);
  assert.equal(createVoxelConfig().resolution, DEFAULT_RESOLUTION);
  assert.equal(createVoxelConfig({}).resolution, DEFAULT_RESOLUTION);
});

test('indexOf is x-fastest: index = x + nx*(y + ny*z)', () => {
  const nx = 4;
  const ny = 3;
  assert.equal(indexOf(0, 0, 0, nx, ny), 0);
  assert.equal(indexOf(1, 0, 0, nx, ny), 1);
  assert.equal(indexOf(3, 0, 0, nx, ny), 3);
  // stepping y by 1 should jump by exactly nx
  assert.equal(indexOf(0, 1, 0, nx, ny), nx);
  assert.equal(indexOf(2, 1, 0, nx, ny), nx + 2);
  // stepping z by 1 should jump by exactly nx*ny
  assert.equal(indexOf(0, 0, 1, nx, ny), nx * ny);
  assert.equal(indexOf(1, 2, 3, nx, ny), 1 + nx * (2 + ny * 3));
});

test('forEachOccupied iterates in fixed deterministic order (z outer, y, x inner)', () => {
  const grid = new VoxelGrid(UNIT_AABB, 4);
  setCell(grid, 2, 0, 0, 1);
  setCell(grid, 0, 1, 0, 2);
  setCell(grid, 0, 0, 1, 3);
  setCell(grid, 1, 1, 1, 4);

  const visited = [];
  grid.forEachOccupied((x, y, z, materialId) => {
    visited.push([x, y, z, materialId]);
  });

  assert.deepEqual(visited, [
    [2, 0, 0, 1],
    [0, 1, 0, 2],
    [0, 0, 1, 3],
    [1, 1, 1, 4],
  ]);
});

test('cellCount matches occupancy array length and equals nx*ny*nz', () => {
  const grid = new VoxelGrid(UNIT_AABB, 8);
  assert.equal(grid.cellCount, grid.occupancy.length);
  assert.equal(grid.cellCount, grid.nx * grid.ny * grid.nz);
});

test('degenerate (flat) AABB does not produce a zero or negative cellSize', () => {
  const flatAabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 5, y: 0, z: 5 } };
  const grid = new VoxelGrid(flatAabb, 8);
  assert.ok(grid.cellSize > 0);
  assert.ok(Number.isFinite(grid.cellSize));
  assert.ok(grid.ny >= 1);
});

test('VoxelGrid construction is deterministic (same input -> identical occupancy shape)', () => {
  const a = new VoxelGrid(UNIT_AABB, 16);
  const b = new VoxelGrid(UNIT_AABB, 16);
  assert.equal(a.nx, b.nx);
  assert.equal(a.ny, b.ny);
  assert.equal(a.nz, b.nz);
  assert.equal(a.cellSize, b.cellSize);
  assert.deepEqual(Array.from(a.occupancy), Array.from(b.occupancy));
});
