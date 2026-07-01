/**
 * Voxel Lab Bench — Gate A Slice 2 render-instanced tests (Node-side, no browser).
 *   node --test labs/voxel-bench/test/render-instanced.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid } from '../src/bench-core.mjs';
import {
  estimateBytesForGrid,
  exportGridState,
  importGridState,
  TIER1_HARD_MEMORY_CEILING_BYTES,
  TIER1_TARGET_MEMORY_BYTES,
} from '../src/render-instanced.mjs';

const ROOM_AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 32, y: 16, z: 32 } };

function buildFixtureRoom() {
  // Same shape of fixture the bench page hand-authors: a "plus" cross through a
  // resolution-64 grid (the Tier-1 ceiling per bench-core.mjs MAX_RESOLUTION), i.e. the
  // worst-case per-cell byte footprint this renderer shell is asked to carry.
  const grid = new VoxelGrid(ROOM_AABB, 64, { sourceId: 'tier1-fixture-room' });
  const mid = Math.floor(grid.nx / 2);
  for (let i = 0; i < grid.nx; i += 1) {
    grid.setOccupied(i, mid % grid.ny, mid % grid.nz, 1);
    grid.setOccupied(mid % grid.nx, i % grid.ny, mid % grid.nz, 1);
    grid.setOccupied(mid % grid.nx, mid % grid.ny, i % grid.nz, 1);
  }
  return grid;
}

test('estimateBytesForGrid reports occupancyBytes equal to the grid Uint8Array length', () => {
  const grid = buildFixtureRoom();
  const estimate = estimateBytesForGrid(grid);
  assert.equal(estimate.occupancyBytes, grid.occupancy.byteLength);
  assert.equal(estimate.idsBytes, 0);
  assert.equal(estimate.totalBytes, estimate.occupancyBytes + estimate.idsBytes);
});

test('estimateBytesForGrid stays numerically under the Tier-1 250MB hard ceiling', () => {
  const grid = buildFixtureRoom();
  const estimate = estimateBytesForGrid(grid);
  const hardCeilingBytes = 250 * 1024 * 1024;

  assert.equal(TIER1_HARD_MEMORY_CEILING_BYTES, hardCeilingBytes);
  assert.ok(
    estimate.totalBytes < hardCeilingBytes,
    `expected totalBytes (${estimate.totalBytes}) < hard ceiling (${hardCeilingBytes})`,
  );
});

test('estimateBytesForGrid stays under the Tier-1 150MB target budget too', () => {
  const grid = buildFixtureRoom();
  const estimate = estimateBytesForGrid(grid);
  const targetBytes = 150 * 1024 * 1024;

  assert.equal(TIER1_TARGET_MEMORY_BYTES, targetBytes);
  assert.ok(
    estimate.totalBytes < targetBytes,
    `expected totalBytes (${estimate.totalBytes}) < target budget (${targetBytes})`,
  );
});

test('estimateBytesForGrid throws without allocating on a missing grid', () => {
  assert.throws(() => estimateBytesForGrid(null), TypeError);
  assert.throws(() => estimateBytesForGrid(undefined), TypeError);
});

test('exportGridState -> importGridState round-trips occupancy byte-identically', () => {
  const grid = buildFixtureRoom();
  const state = exportGridState(grid);

  assert.equal(state.resolution, grid.resolution);
  assert.equal(state.nx, grid.nx);
  assert.equal(state.ny, grid.ny);
  assert.equal(state.nz, grid.nz);
  assert.equal(state.occupancy.length, grid.occupancy.length);

  const reimported = importGridState(state, VoxelGrid);
  assert.equal(reimported.occupancy.length, grid.occupancy.length);
  assert.deepEqual(Array.from(reimported.occupancy), Array.from(grid.occupancy));
  assert.equal(reimported.nx, grid.nx);
  assert.equal(reimported.ny, grid.ny);
  assert.equal(reimported.nz, grid.nz);
});

test('exportGridState produces a state with no live reference back to the source buffer', () => {
  const grid = buildFixtureRoom();
  const state = exportGridState(grid);

  // Mutate the source grid after export; the exported plain-array state must be
  // unaffected (proves the export is a real copy, not a view).
  grid.setOccupied(0, 0, 0, 9);
  assert.notEqual(state.occupancy[0], 9);
});

test('importGridState throws on a state whose occupancy length does not match its own dims', () => {
  const grid = buildFixtureRoom();
  const state = exportGridState(grid);
  const corrupted = { ...state, occupancy: state.occupancy.slice(0, state.occupancy.length - 1) };
  assert.throws(() => importGridState(corrupted, VoxelGrid), RangeError);
});

test('round-trip is deterministic across repeated export/import cycles', () => {
  const grid = buildFixtureRoom();
  const first = Array.from(importGridState(exportGridState(grid), VoxelGrid).occupancy);
  const second = Array.from(importGridState(exportGridState(grid), VoxelGrid).occupancy);
  assert.deepEqual(first, second);
});
