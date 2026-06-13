// Regression tests for findings from the adversarial hardening audit (2026-06-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateArcadeAsset } from '../src/validation/validateArcadeAsset.js';
import { validateArcadeLayout } from '../src/validation/validateArcadeLayout.js';
import { importArcadeAsset } from '../src/importExport/importArcadeAsset.js';
import { importArcadeLayout } from '../src/importExport/importArcadeLayout.js';
import { buildArcadeLayout, exportArcadeLayout } from '../src/importExport/exportArcadeLayout.js';
import { createEmptyLayout, addElement, resizeGrid } from '../src/arcade/ArcadeLayout.js';
import { canPlaceAt } from '../src/editor/GridSnap.js';
import { validLayoutModel } from './fixtures.mjs';

// HIGH: validators must FAIL CLOSED (never throw) on non-object JSON.
test('validators never throw on null/primitive input (fail closed)', async () => {
  for (const bad of [null, 'hello', 42, true, undefined]) {
    assert.doesNotThrow(() => validateArcadeAsset(bad), `asset validator threw on ${String(bad)}`);
    assert.doesNotThrow(() => validateArcadeLayout(bad), `layout validator threw on ${String(bad)}`);
    assert.equal(validateArcadeAsset(bad).ok, false);
    assert.equal(validateArcadeLayout(bad).ok, false);
  }
  for (const txt of ['null', '"hello"', '42', 'true']) {
    const a = await importArcadeAsset(txt);
    const l = await importArcadeLayout(txt);
    assert.equal(a.ok, false, `importArcadeAsset(${txt}) should fail closed`);
    assert.equal(l.ok, false, `importArcadeLayout(${txt}) should fail closed`);
  }
});

// MEDIUM: a zone footprint that spills past the grid edge is rejected.
test('a zone extending past the grid edge is rejected', () => {
  const m = validLayoutModel(); // 16x12
  m.zones[0] = { kind: 'lighting', preset: 'neon-strip', palette: 'neon-cyan', gx: 14, gy: 0, cols: 8, rows: 1, intensity: 'medium' };
  const r = validateArcadeLayout(buildArcadeLayout(m));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /footprint extends past the grid edge/);
});

// MEDIUM: a wall extending past the grid edge is rejected.
test('a wall extending past the grid edge is rejected', () => {
  const m = validLayoutModel();
  m.walls.push({ material: 'panel-dark', gx: 10, gy: 0, length: 10, orientation: 'north' }); // 10+10 > 16
  const r = validateArcadeLayout(buildArcadeLayout(m));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /extends past the grid edge/);
});

// LOW: collision-aware placement — cabinet cells block everything; same-kind+layer blocks; other layer ok.
test('canPlaceAt enforces collision-aware placement', () => {
  let m = createEmptyLayout({ id: 'coll', cols: 12, rows: 10 });
  m = addElement(m, 'cabinets', { cabinet: validLayoutModel().cabinets[0].cabinet, gx: 4, gy: 4, rotation: 0, layer: 2 });
  m = addElement(m, 'props', { type: 'bench', gx: 6, gy: 6, rotation: 0, layer: 1 });

  assert.equal(canPlaceAt(m, 'cabinets', 4, 4), false, 'cabinet cell occupied');
  assert.equal(canPlaceAt(m, 'props', 4, 4, 1), false, 'cabinet blocks any element');
  assert.equal(canPlaceAt(m, 'props', 6, 6, 1), false, 'same kind + same layer blocked');
  assert.equal(canPlaceAt(m, 'props', 6, 6, 3), true, 'same cell, different layer allowed');
  assert.equal(canPlaceAt(m, 'signs', 6, 6), true, 'different kind allowed where no cabinet');
  assert.equal(canPlaceAt(m, 'props', 99, 99, 1), false, 'out of grid blocked');
});

// resizeGrid must keep off-origin walls/zones valid (extent clamped to clamped origin).
test('resizeGrid keeps off-origin walls and zones schema-valid', async () => {
  let m = createEmptyLayout({ id: 'rg-layout', cols: 16, rows: 12 });
  m = addElement(m, 'walls', { material: 'panel-dark', gx: 12, gy: 0, length: 4, orientation: 'north' });
  m = addElement(m, 'zones', { kind: 'lighting', preset: 'neon-strip', palette: 'neon-cyan', gx: 12, gy: 0, cols: 4, rows: 1, intensity: 'medium' });
  const shrunk = resizeGrid(m, 8, 8);
  const res = await exportArcadeLayout(shrunk);
  assert.equal(res.ok, true, res.report.errors.join('; '));
});
