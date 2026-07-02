/**
 * Voxel Lab Bench — Gate B Slice 5 light-volume tests (Node-side, no browser).
 *   node --test labs/voxel-bench/test/light-volume.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid } from '../src/bench-core.mjs';
import {
  createLightVolume,
  injectFromOccupancy,
  propagate,
  sampleLight,
  estimateLightVolumeBytes,
} from '../src/light-volume.mjs';

const ROOM_BOUNDS = { min: { x: 0, y: 0, z: 0 }, max: { x: 16, y: 16, z: 16 } };

test('createLightVolume produces expected cell/byte counts at each Section-5 tier resolution', () => {
  for (const resolution of [8, 16, 32, 64]) {
    const volume = createLightVolume(ROOM_BOUNDS, resolution);
    const expectedCellCount = resolution * resolution * resolution;

    assert.equal(volume.resolution, resolution);
    assert.equal(volume.nx, resolution);
    assert.equal(volume.ny, resolution);
    assert.equal(volume.nz, resolution);
    assert.equal(volume.occlusion.length, expectedCellCount);
    assert.equal(volume.energy.length, expectedCellCount * 3);

    const estimate = estimateLightVolumeBytes(volume);
    assert.equal(estimate.occlusionBytes, expectedCellCount); // Uint8Array: 1 byte/cell
    assert.equal(estimate.energyBytes, expectedCellCount * 3 * 4); // Float32Array RGB: 12 bytes/cell
    assert.equal(estimate.totalBytes, estimate.occlusionBytes + estimate.energyBytes);
  }
});

test('createLightVolume byte footprint strictly increases with resolution (8 < 16 < 32 < 64)', () => {
  const totals = [8, 16, 32, 64].map((resolution) => {
    const volume = createLightVolume(ROOM_BOUNDS, resolution);
    return estimateLightVolumeBytes(volume).totalBytes;
  });
  assert.ok(totals[0] < totals[1]);
  assert.ok(totals[1] < totals[2]);
  assert.ok(totals[2] < totals[3]);
});

test('createLightVolume rejects a non-finite bounds AABB', () => {
  assert.throws(() => createLightVolume({ min: { x: 0, y: 0, z: 0 }, max: { x: NaN, y: 1, z: 1 } }, 8), TypeError);
});

test('createLightVolume clamps a degenerate/zero-or-negative resolution to 1', () => {
  const volume = createLightVolume(ROOM_BOUNDS, 0);
  assert.equal(volume.resolution, 1);
  assert.equal(volume.occlusion.length, 1);
});

/**
 * Fixture: a single occupied "light source" cell surrounded by open space, in an
 * otherwise-empty VoxelGrid, plus a solid occluding wall segment placed between the
 * source and one far region of the light volume — set up so a correctness assertion can
 * check BOTH halves of the dual-purpose-occupancy contract:
 *   (a) nearer-to-source cells end up brighter than farther-but-otherwise-equal cells
 *   (b) a cell fully behind/inside the occluding wall ends up darker than an equally
 *       (or lesser) distant unoccupied cell that has a clear line through open cells
 */
function buildFixtureGrid() {
  const aabb = ROOM_BOUNDS;
  const grid = new VoxelGrid(aabb, 16, { sourceId: 'slice-5-light-fixture' });
  // A solid occluding wall: a full y-z plane at x=8, EXCEPT it does not cover the near
  // half of the room where the source sits, so most of the room is open and only the
  // cells on/behind the wall (x >= 8) are blocked from the source at x=2.
  for (let z = 0; z < grid.nz; z += 1) {
    for (let y = 0; y < grid.ny; y += 1) {
      grid.setOccupied(8, y, z, 1);
    }
  }
  return grid;
}

test('injectFromOccupancy + propagate: relative brightness ordering — nearer cells brighter than farther cells', () => {
  const grid = buildFixtureGrid();
  const volume = createLightVolume(ROOM_BOUNDS, 16);

  // Source sits well clear of the occluding wall, near x=2 (open region).
  const sourceWorldPos = { x: 2, y: 8, z: 8 };
  injectFromOccupancy(volume, [grid], { source: { worldPos: sourceWorldPos } });
  propagate(volume, 12);

  const near = sampleLight(volume, { x: 3, y: 8, z: 8 }); // 1 unit from source, open path
  const mid = sampleLight(volume, { x: 5, y: 8, z: 8 }); // farther, still open path
  const far = sampleLight(volume, { x: 7, y: 8, z: 8 }); // farthest open cell before the wall

  const brightness = (c) => c.r + c.g + c.b;

  assert.ok(brightness(near) > 0, 'near cell should have received non-zero energy');
  assert.ok(
    brightness(near) >= brightness(mid),
    `expected near (${brightness(near)}) >= mid (${brightness(mid)})`,
  );
  assert.ok(
    brightness(mid) >= brightness(far),
    `expected mid (${brightness(mid)}) >= far (${brightness(far)})`,
  );
});

test('injectFromOccupancy + propagate: an occluded cell is darker than an equally-distant open cell', () => {
  const grid = buildFixtureGrid();
  const volume = createLightVolume(ROOM_BOUNDS, 16);

  const sourceWorldPos = { x: 2, y: 8, z: 8 };
  injectFromOccupancy(volume, [grid], { source: { worldPos: sourceWorldPos } });
  propagate(volume, 12);

  // A cell ON the solid wall (x=8, same distance-ish from source as the open cell right
  // in front of it at x=7) must be forced to 0 energy (dual-purpose occlusion: a solid
  // cell never itself glows).
  const onWall = sampleLight(volume, { x: 8, y: 8, z: 8 });
  const justBeforeWall = sampleLight(volume, { x: 7, y: 8, z: 8 });

  const brightness = (c) => c.r + c.g + c.b;

  assert.equal(brightness(onWall), 0, 'a solid/occluded cell must have zero energy after propagation');
  assert.ok(
    brightness(justBeforeWall) > brightness(onWall),
    `expected open cell just before the wall (${brightness(justBeforeWall)}) to be brighter than the occluded wall cell (${brightness(onWall)})`,
  );

  // A cell just PAST the wall (x=9, shadowed — no direct open path around this simple
  // fixture within the propagate() iteration budget used here) should end up darker
  // than the equally-adjacent-to-source open cell on the near side (x=7 vs x=9, both are
  // 1 cell away from the wall, but only x=7 has an unobstructed path back to the source).
  const shadowedPastWall = sampleLight(volume, { x: 9, y: 8, z: 8 });
  assert.ok(
    brightness(justBeforeWall) > brightness(shadowedPastWall),
    `expected open near-side cell (${brightness(justBeforeWall)}) brighter than shadowed far-side cell (${brightness(shadowedPastWall)})`,
  );
});

test('injectFromOccupancy marks occlusion=255 exactly where the source grid reports occupied cells', () => {
  const grid = buildFixtureGrid();
  const volume = createLightVolume(ROOM_BOUNDS, 16);
  injectFromOccupancy(volume, [grid]);

  // Sample a handful of light-cell centers on/near x=8 (the wall) and off it.
  const wallOcclusion = sampleOcclusionAt(volume, { x: 8, y: 4, z: 4 });
  const openOcclusion = sampleOcclusionAt(volume, { x: 2, y: 4, z: 4 });

  assert.equal(wallOcclusion, 255);
  assert.equal(openOcclusion, 0);
});

function sampleOcclusionAt(volume, worldPos) {
  const fx = (worldPos.x - volume.bounds.min.x) / volume.cellSize.x;
  const fy = (worldPos.y - volume.bounds.min.y) / volume.cellSize.y;
  const fz = (worldPos.z - volume.bounds.min.z) / volume.cellSize.z;
  const cx = Math.min(volume.nx - 1, Math.max(0, Math.floor(fx)));
  const cy = Math.min(volume.ny - 1, Math.max(0, Math.floor(fy)));
  const cz = Math.min(volume.nz - 1, Math.max(0, Math.floor(fz)));
  const idx = cx + volume.nx * (cy + volume.ny * cz);
  return volume.occlusion[idx];
}

test('injectFromOccupancy with no grids leaves occlusion entirely open (no occluders)', () => {
  const volume = createLightVolume(ROOM_BOUNDS, 8);
  injectFromOccupancy(volume, []);
  assert.ok(volume.occlusion.every((v) => v === 0));
});

test('propagate with zero iterations leaves energy unchanged (only injection applied)', () => {
  const grid = buildFixtureGrid();
  const volume = createLightVolume(ROOM_BOUNDS, 16);
  injectFromOccupancy(volume, [grid], { source: { worldPos: { x: 2, y: 8, z: 8 } } });
  const beforeSnapshot = Array.from(volume.energy);
  propagate(volume, 0);
  assert.deepEqual(Array.from(volume.energy), beforeSnapshot);
});

test('sampleLight rejects a non-finite worldPos', () => {
  const volume = createLightVolume(ROOM_BOUNDS, 8);
  assert.throws(() => sampleLight(volume, { x: NaN, y: 0, z: 0 }), TypeError);
});

test('sampleLight clamps an out-of-bounds worldPos to the nearest edge cell rather than throwing', () => {
  const volume = createLightVolume(ROOM_BOUNDS, 8);
  injectFromOccupancy(volume, [], { source: { worldPos: { x: 1, y: 1, z: 1 } } });
  assert.doesNotThrow(() => sampleLight(volume, { x: -1000, y: -1000, z: -1000 }));
  assert.doesNotThrow(() => sampleLight(volume, { x: 1000, y: 1000, z: 1000 }));
});

test('estimateLightVolumeBytes requires a volume argument', () => {
  assert.throws(() => estimateLightVolumeBytes(undefined), TypeError);
});
