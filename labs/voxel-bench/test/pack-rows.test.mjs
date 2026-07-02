/**
 * Voxel Lab Bench — Gate B Slice 3 pack-rows tests (Node-side, no browser).
 *   node --test labs/voxel-bench/test/pack-rows.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoxelGrid } from '../src/bench-core.mjs';
import {
  packRow,
  unpackRow,
  packedByteSize,
  packGridRows,
  unpackGridRows,
} from '../src/pack-rows.mjs';

test('unpackRow(packRow(row)) is byte-identical for a uniform (all-empty) row', () => {
  const row = new Uint8Array(16); // all zeros
  const packed = packRow(row);
  assert.equal(packed.uniform, true);
  const roundTripped = unpackRow(packed);
  assert.deepEqual(Array.from(roundTripped), Array.from(row));
});

test('unpackRow(packRow(row)) is byte-identical for a uniform (all-solid) row', () => {
  const row = new Uint8Array(16).fill(3);
  const packed = packRow(row);
  assert.equal(packed.uniform, true);
  assert.equal(packed.value, 3);
  const roundTripped = unpackRow(packed);
  assert.deepEqual(Array.from(roundTripped), Array.from(row));
});

test('unpackRow(packRow(row)) is byte-identical for a mixed row', () => {
  const row = Uint8Array.from([0, 0, 1, 1, 1, 0, 2, 2, 0, 5]);
  const packed = packRow(row);
  assert.equal(packed.uniform, false);
  const roundTripped = unpackRow(packed);
  assert.deepEqual(Array.from(roundTripped), Array.from(row));
});

test('unpackRow(packRow(row)) round-trips a fully alternating (worst-case) row', () => {
  const row = new Uint8Array(20);
  for (let i = 0; i < row.length; i += 1) row[i] = i % 2 === 0 ? 1 : 0;
  const packed = packRow(row);
  assert.equal(packed.uniform, false);
  const roundTripped = unpackRow(packed);
  assert.deepEqual(Array.from(roundTripped), Array.from(row));
});

test('packRow handles a zero-length row as a degenerate uniform row', () => {
  const row = new Uint8Array(0);
  const packed = packRow(row);
  assert.equal(packed.uniform, true);
  assert.equal(packed.length, 0);
  const roundTripped = unpackRow(packed);
  assert.equal(roundTripped.length, 0);
});

test('packRow throws on non-Uint8Array input', () => {
  assert.throws(() => packRow([1, 2, 3]), TypeError);
  assert.throws(() => packRow(null), TypeError);
});

test('unpackRow throws on a malformed mixed PackedRow', () => {
  assert.throws(() => unpackRow({ uniform: false, length: 3, bytes: Uint8Array.from([1, 2]) }), TypeError);
  assert.throws(() => unpackRow(null), TypeError);
});

test('packedByteSize is constant (2 bytes) for a uniform row regardless of length', () => {
  const shortRow = packRow(new Uint8Array(4));
  const longRow = packRow(new Uint8Array(4096));
  assert.equal(packedByteSize(shortRow), 2);
  assert.equal(packedByteSize(longRow), 2);
});

test('packedByteSize is length + 2 for a mixed row', () => {
  const row = Uint8Array.from([1, 0, 1, 0, 1]);
  const packed = packRow(row);
  assert.equal(packedByteSize(packed), row.length + 2);
});

test('packGridRows/unpackGridRows round-trips a grid occupancy buffer byte-identically', () => {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 8, y: 8, z: 8 } };
  const grid = new VoxelGrid(aabb, 16, { sourceId: 'pack-rows-fixture' });
  // Solid interior block plus a hollow shell pocket, giving a mix of uniform and
  // mixed rows across the grid.
  for (let z = 2; z < 10; z += 1) {
    for (let y = 2; y < 10; y += 1) {
      for (let x = 2; x < 10; x += 1) {
        grid.setOccupied(x, y, z, 1);
      }
    }
  }
  grid.setOccupied(0, 0, 0, 7);
  grid.setOccupied(15, 15, 15, 7);

  const { rows, rawBytes, packedBytes, bytesPerVoxel } = packGridRows(grid);
  assert.equal(rawBytes, grid.occupancy.byteLength);
  assert.ok(packedBytes > 0);
  assert.ok(bytesPerVoxel > 0);

  const rebuilt = unpackGridRows(rows, grid.nx);
  assert.deepEqual(Array.from(rebuilt), Array.from(grid.occupancy));
});

test('packGridRows measures a real bytes/voxel reduction vs. raw 1 byte/voxel on a mostly-uniform fixture', () => {
  // A mostly-empty room with one solid interior block: the overwhelmingly-common
  // "mostly air or mostly solid" shape zeux's row-packing scheme targets.
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 16, y: 16, z: 16 } };
  const grid = new VoxelGrid(aabb, 32, { sourceId: 'bytes-per-voxel-fixture' });
  for (let z = 8; z < 24; z += 1) {
    for (let y = 8; y < 24; y += 1) {
      for (let x = 8; x < 24; x += 1) {
        grid.setOccupied(x, y, z, 1);
      }
    }
  }

  const { bytesPerVoxel } = packGridRows(grid);
  // Raw occupancy is 1 byte/voxel; assert a real, numeric reduction on THIS codebase's
  // own implementation (not just cited from zeux's 2.97 -> 0.49 result).
  assert.ok(
    bytesPerVoxel < 1,
    `expected packed bytesPerVoxel (${bytesPerVoxel}) < raw 1 byte/voxel`,
  );
});

test('packGridRows on an all-empty grid packs to the minimum constant per-row size', () => {
  const aabb = { min: { x: 0, y: 0, z: 0 }, max: { x: 4, y: 4, z: 4 } };
  const grid = new VoxelGrid(aabb, 8, { sourceId: 'empty-fixture' });

  const { rows, packedBytes, bytesPerVoxel } = packGridRows(grid);
  const expectedRowCount = grid.ny * grid.nz;
  assert.equal(rows.length, expectedRowCount);
  assert.equal(packedBytes, expectedRowCount * 2);
  assert.ok(bytesPerVoxel < 1);
});
