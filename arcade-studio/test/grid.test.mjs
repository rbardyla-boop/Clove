import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellToWorld, worldToCell, worldBounds, rotationToRadians, CELL } from '../src/arcade/grid.js';
import { resizeGrid, defaultLayoutModel } from '../src/arcade/ArcadeLayout.js';
import { exportArcadeLayout } from '../src/importExport/exportArcadeLayout.js';

test('cell ↔ world round-trips for every cell in a grid', () => {
  const cols = 16;
  const rows = 12;
  for (let gx = 0; gx < cols; gx++) {
    for (let gy = 0; gy < rows; gy++) {
      const w = cellToWorld(gx, gy, cols, rows);
      const back = worldToCell(w.x, w.z, cols, rows);
      assert.deepEqual(back, { gx, gy });
    }
  }
});

test('grid is centered on the origin', () => {
  const w = worldBounds(16, 12);
  assert.equal(w.minX, -16); // 16 cols * CELL(2) / 2
  assert.equal(w.maxZ, 12);
});

test('rotation token maps to radians', () => {
  assert.equal(rotationToRadians(0), 0);
  assert.ok(Math.abs(rotationToRadians(90) - Math.PI / 2) < 1e-9);
  assert.equal(CELL, 2);
});

test('resizeGrid clamps placements and stays schema-valid', async () => {
  const big = defaultLayoutModel();
  const shrunk = resizeGrid(big, 8, 8);
  assert.equal(shrunk.grid.cols, 8);
  assert.equal(shrunk.grid.rows, 8);
  for (const c of shrunk.cabinets) {
    assert.ok(c.gx < 8 && c.gy < 8, 'cabinet within new grid');
  }
  const res = await exportArcadeLayout(shrunk);
  assert.equal(res.ok, true, res.report.errors.join('; '));
});
