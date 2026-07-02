/**
 * Voxel Lab Bench — Gate B Slice 3 mesh-worker integration-proof tests (Node-side).
 * Tests the Worker's pure message-handling function directly (no real Worker global
 * needed in Node) — this proves the worker boots, receives a grid-description
 * message, and returns the same result the pure greedyMesh() function would produce
 * for a small fixture, per the task's "keep this part modest" instruction.
 *   node --test labs/voxel-bench/test/mesh-worker.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid } from '../src/bench-core.mjs';
import { greedyMesh } from '../src/mesh-greedy.mjs';
import { handleMeshRequest, rebuildGridFromMessage } from '../src/workers/mesh-worker.mjs';

function buildFixtureMessage() {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 4, z: 4 } };
  const grid = new VoxelGrid(aabb, 8, { sourceId: 'mesh-worker-fixture' });
  grid.setOccupied(1, 1, 1, 1);
  grid.setOccupied(2, 1, 1, 1);
  return {
    grid,
    message: {
      aabb,
      resolution: 8,
      occupancy: grid.occupancy.buffer.slice(0), // simulate a transferred copy
      nx: grid.nx,
      ny: grid.ny,
      nz: grid.nz,
    },
  };
}

test('rebuildGridFromMessage reconstructs a grid with byte-identical occupancy', () => {
  const { grid, message } = buildFixtureMessage();
  const rebuilt = rebuildGridFromMessage(message);
  assert.equal(rebuilt.nx, grid.nx);
  assert.equal(rebuilt.ny, grid.ny);
  assert.equal(rebuilt.nz, grid.nz);
  assert.deepEqual(Array.from(rebuilt.occupancy), Array.from(grid.occupancy));
});

test('rebuildGridFromMessage throws on a missing aabb/occupancy', () => {
  assert.throws(() => rebuildGridFromMessage({}), TypeError);
});

test('rebuildGridFromMessage throws on a dims mismatch', () => {
  const { message } = buildFixtureMessage();
  assert.throws(() => rebuildGridFromMessage({ ...message, nx: message.nx + 1 }), RangeError);
});

test('handleMeshRequest returns the same result the pure greedyMesh() would produce for a small fixture', () => {
  const { grid, message } = buildFixtureMessage();
  const expected = greedyMesh(grid);

  const response = handleMeshRequest(message);
  assert.equal(response.ok, true);
  assert.equal(response.quadCount, expected.quadCount);
  assert.equal(response.triangleCount, expected.triangleCount);

  const positions = new Float32Array(response.positions);
  const IndexCtor = response.indexBpe === 4 ? Uint32Array : Uint16Array;
  const indices = new IndexCtor(response.indices);

  assert.deepEqual(Array.from(positions), Array.from(expected.positions));
  assert.deepEqual(Array.from(indices), Array.from(expected.indices));
});

test('handleMeshRequest returns an ok:false error response for a malformed message instead of throwing', () => {
  const response = handleMeshRequest({});
  assert.equal(response.ok, false);
  assert.equal(typeof response.error, 'string');
});

test('handleMeshRequest handles an empty-occupancy grid message with zero quads', () => {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 2, z: 2 } };
  const grid = new VoxelGrid(aabb, 4);
  const message = {
    aabb,
    resolution: 4,
    occupancy: grid.occupancy.buffer.slice(0),
    nx: grid.nx,
    ny: grid.ny,
    nz: grid.nz,
  };
  const response = handleMeshRequest(message);
  assert.equal(response.ok, true);
  assert.equal(response.quadCount, 0);
  assert.equal(response.triangleCount, 0);
});
