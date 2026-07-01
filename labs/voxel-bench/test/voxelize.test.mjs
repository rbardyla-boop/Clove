/**
 * Voxel Lab Bench — Gate A Slice 1 voxelization tests.
 *   node --test labs/voxel-bench/test/voxelize.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { voxelizeMesh } from '../src/voxelize.mjs';

const UNIT_AABB = { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } };

/** A unit box built from 12 triangles (2 per face), corners at (0,0,0)-(1,1,1). */
function unitBoxTriangles() {
  const p = {
    a: { x: 0, y: 0, z: 0 },
    b: { x: 1, y: 0, z: 0 },
    c: { x: 1, y: 1, z: 0 },
    d: { x: 0, y: 1, z: 0 },
    e: { x: 0, y: 0, z: 1 },
    f: { x: 1, y: 0, z: 1 },
    g: { x: 1, y: 1, z: 1 },
    h: { x: 0, y: 1, z: 1 },
  };
  const quad = (v0, v1, v2, v3) => [
    { a: v0, b: v1, c: v2 },
    { a: v0, b: v2, c: v3 },
  ];
  return [
    ...quad(p.a, p.b, p.c, p.d), // -z face
    ...quad(p.e, p.h, p.g, p.f), // +z face
    ...quad(p.a, p.e, p.f, p.b), // -y face
    ...quad(p.d, p.c, p.g, p.h), // +y face
    ...quad(p.a, p.d, p.h, p.e), // -x face
    ...quad(p.b, p.f, p.g, p.c), // +x face
  ];
}

test('voxelizing the same input twice produces byte-identical occupancy (determinism)', () => {
  const triangles = unitBoxTriangles();
  const resultA = voxelizeMesh(triangles, UNIT_AABB, { resolution: 8 });
  const resultB = voxelizeMesh(triangles, UNIT_AABB, { resolution: 8 });

  assert.equal(resultA.truncated, false);
  assert.equal(resultB.truncated, false);
  assert.deepEqual(
    Array.from(resultA.grid.occupancy),
    Array.from(resultB.grid.occupancy),
  );
});

test('a hollow closed box (12 triangles) voxelizes to a hollow shell, not a solid fill', () => {
  const triangles = unitBoxTriangles();
  const result = voxelizeMesh(triangles, UNIT_AABB, { resolution: 8 });

  assert.ok(result.grid, 'expected a grid to be produced');
  assert.equal(result.truncated, false);
  assert.ok(
    result.grid.occupiedCount < result.grid.cellCount,
    `expected hollow shell (occupied < total), got occupied=${result.grid.occupiedCount} total=${result.grid.cellCount}`,
  );
  assert.ok(result.grid.occupiedCount > 0, 'expected at least some occupied surface cells');

  // The exact center of the box must be empty (interior), proving it is a shell.
  const centerIdx = Math.floor(result.grid.nx / 2);
  assert.equal(
    result.grid.isOccupied(centerIdx, centerIdx, centerIdx),
    false,
    'expected the box interior to be empty (surface voxelization, not solid fill)',
  );
});

test('an adversarial triangle-budget input triggers truncation without exceeding the budget', () => {
  const triangles = [];
  // Build far more triangles than a small budget allows, all inside the unit AABB.
  for (let i = 0; i < 500; i += 1) {
    const t = i / 500;
    triangles.push({
      a: { x: t, y: 0, z: 0 },
      b: { x: t, y: 1, z: 0 },
      c: { x: t, y: 0, z: 1 },
    });
  }

  const triangleBudget = 10;
  const result = voxelizeMesh(triangles, UNIT_AABB, {
    resolution: 8,
    triangleBudget,
  });

  assert.equal(result.truncated, true);
  assert.ok(
    result.trianglesProcessed <= triangleBudget,
    `expected trianglesProcessed (${result.trianglesProcessed}) <= budget (${triangleBudget})`,
  );
});

test('an adversarial SAT-test-count input triggers truncation without exceeding the budget', () => {
  // A single triangle whose bounding box spans the whole grid at high resolution
  // generates many candidate cells; a tiny SAT-test budget must still cap the work.
  const triangles = [
    { a: { x: 0, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 }, c: { x: 0, y: 1, z: 1 } },
  ];

  const satTestBudget = 5;
  const result = voxelizeMesh(triangles, UNIT_AABB, {
    resolution: 64,
    satTestBudget,
  });

  assert.equal(result.truncated, true);
  assert.ok(
    result.satTestsPerformed <= satTestBudget,
    `expected satTestsPerformed (${result.satTestsPerformed}) <= budget (${satTestBudget})`,
  );
});

test('non-finite triangle coordinates are rejected without crashing or being voxelized', () => {
  const triangles = [
    { a: { x: NaN, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 }, c: { x: 0, y: 1, z: 0 } },
    { a: { x: 0, y: 0, z: 0 }, b: { x: Infinity, y: 0, z: 0 }, c: { x: 0, y: 1, z: 0 } },
    { a: { x: 0, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 }, c: { x: 0, y: -Infinity, z: 0 } },
    // one valid triangle mixed in, to prove the grid is still usable afterward
    { a: { x: 0, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 }, c: { x: 0, y: 1, z: 0 } },
  ];

  const result = voxelizeMesh(triangles, UNIT_AABB, { resolution: 8 });

  assert.equal(result.truncated, false);
  assert.equal(result.trianglesProcessed, 1, 'only the single finite triangle should be processed');
  assert.ok(result.grid, 'expected a grid from the one valid triangle');
  assert.ok(result.grid.occupiedCount > 0);
});

test('empty input (no triangles) returns a clean empty result, not a throw', () => {
  const result = voxelizeMesh([], UNIT_AABB, { resolution: 8 });
  assert.equal(result.grid, null);
  assert.equal(result.truncated, false);
  assert.equal(result.trianglesProcessed, 0);
  assert.equal(result.satTestsPerformed, 0);
});

test('missing/undefined triangles input returns a clean empty result, not a throw', () => {
  const result = voxelizeMesh(undefined, UNIT_AABB, { resolution: 8 });
  assert.equal(result.grid, null);
  assert.equal(result.truncated, false);
});
