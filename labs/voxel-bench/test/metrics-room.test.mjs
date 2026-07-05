/**
 * Voxel Lab Bench — Gate C metrics/readout room tests (Node-side, no browser).
 *   node --test labs/voxel-bench/test/metrics-room.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid } from '../src/bench-core.mjs';
import { buildMetricsRoomReport } from '../src/metrics-room.mjs';

function makeSolidBlockGrid(size, resolution = size) {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: size, y: size, z: size } };
  const grid = new VoxelGrid(aabb, resolution, { sourceId: 'metrics-room-fixture' });
  for (let z = 0; z < grid.nz; z += 1) {
    for (let y = 0; y < grid.ny; y += 1) {
      for (let x = 0; x < grid.nx; x += 1) {
        grid.setOccupied(x, y, z, 1);
      }
    }
  }
  return grid;
}

test('buildMetricsRoomReport throws on a missing grid', () => {
  assert.throws(() => buildMetricsRoomReport({}), TypeError);
});

test('buildMetricsRoomReport: instancedCubes.instanceCount matches grid.occupiedCount exactly', () => {
  const grid = makeSolidBlockGrid(4);
  const report = buildMetricsRoomReport({ grid });
  assert.equal(report.instancedCubes.instanceCount, grid.occupiedCount);
  assert.equal(report.instancedCubes.instanceCount, 4 * 4 * 4);
});

test('buildMetricsRoomReport: instancedCubes.triangleCount is exactly instanceCount * 12 (matches bench-boot.mjs\'s own convention)', () => {
  const grid = makeSolidBlockGrid(4);
  const report = buildMetricsRoomReport({ grid });
  assert.equal(report.instancedCubes.triangleCount, report.instancedCubes.instanceCount * 12);
});

test('buildMetricsRoomReport: greedyQuads produces strictly fewer triangles than instancedCubes for a solid block (meshReduction.ratio > 1)', () => {
  const grid = makeSolidBlockGrid(8);
  const report = buildMetricsRoomReport({ grid });
  assert.ok(
    report.greedyQuads.triangleCount < report.instancedCubes.triangleCount,
    `expected greedy (${report.greedyQuads.triangleCount}) < instanced (${report.instancedCubes.triangleCount}) for a solid block`,
  );
  assert.ok(report.meshReduction.ratio > 1, `expected meshReduction.ratio > 1, got ${report.meshReduction.ratio}`);
});

test('buildMetricsRoomReport: both render strategies report exactly 1 draw call for a non-empty grid', () => {
  const grid = makeSolidBlockGrid(4);
  const report = buildMetricsRoomReport({ grid });
  assert.equal(report.instancedCubes.drawCalls, 1);
  assert.equal(report.greedyQuads.drawCalls, 1);
});

test('buildMetricsRoomReport: an empty grid reports zero draw calls and a meshReduction.ratio of 1 (no divide-by-zero)', () => {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 4, z: 4 } };
  const grid = new VoxelGrid(aabb, 4, { sourceId: 'metrics-room-empty-fixture' });
  const report = buildMetricsRoomReport({ grid });
  assert.equal(report.instancedCubes.drawCalls, 0);
  assert.equal(report.greedyQuads.drawCalls, 0);
  assert.equal(report.meshReduction.ratio, 1);
});

test('buildMetricsRoomReport: LOD coarse level never has MORE occupied cells than fine (ratio <= 1) for a solid block', () => {
  const grid = makeSolidBlockGrid(8);
  const report = buildMetricsRoomReport({ grid, lodFineGrid: grid });
  assert.ok(report.lod.coarseInstanceCount <= report.lod.fineInstanceCount);
  assert.ok(report.lod.ratio <= 1, `expected lod.ratio <= 1, got ${report.lod.ratio}`);
});

test('buildMetricsRoomReport: a separate lodFineGrid is used independently of the mesh-comparison grid', () => {
  const meshGrid = makeSolidBlockGrid(4);
  const lodGrid = makeSolidBlockGrid(8);
  const report = buildMetricsRoomReport({ grid: meshGrid, lodFineGrid: lodGrid });
  assert.equal(report.lod.fineInstanceCount, lodGrid.occupiedCount);
  assert.notEqual(report.lod.fineInstanceCount, meshGrid.occupiedCount);
});

test('buildMetricsRoomReport: lightVolume defaults to the four Section-5 tier resolutions (8/16/32/64)', () => {
  const grid = makeSolidBlockGrid(4);
  const report = buildMetricsRoomReport({ grid });
  assert.deepEqual(report.lightVolume.map((r) => r.resolution), [8, 16, 32, 64]);
});

test('buildMetricsRoomReport: lightVolume bytes strictly increase with resolution (decoupled from mesh strategy)', () => {
  const grid = makeSolidBlockGrid(4);
  const report = buildMetricsRoomReport({ grid });
  for (let i = 1; i < report.lightVolume.length; i += 1) {
    assert.ok(
      report.lightVolume[i].lightVolumeBytes > report.lightVolume[i - 1].lightVolumeBytes,
      `expected strictly increasing bytes at index ${i}`,
    );
  }
});

test('buildMetricsRoomReport: lightVolume accepts a custom resolution set', () => {
  const grid = makeSolidBlockGrid(4);
  const report = buildMetricsRoomReport({ grid, lightGridResolutions: [4, 12] });
  assert.deepEqual(report.lightVolume.map((r) => r.resolution), [4, 12]);
});

test('buildMetricsRoomReport: report is a plain JSON-serializable object (round-trips through JSON.stringify/parse unchanged)', () => {
  const grid = makeSolidBlockGrid(4);
  const report = buildMetricsRoomReport({ grid });
  const roundTripped = JSON.parse(JSON.stringify(report));
  assert.deepEqual(roundTripped, report);
});

test('buildMetricsRoomReport: deterministic — repeated calls on the same grid produce byte-identical (deepEqual) reports', () => {
  const grid = makeSolidBlockGrid(6);
  const first = buildMetricsRoomReport({ grid });
  const second = buildMetricsRoomReport({ grid });
  assert.deepEqual(first, second);
});
