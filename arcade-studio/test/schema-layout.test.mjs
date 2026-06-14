import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArcadeLayout } from '../src/importExport/exportArcadeLayout.js';
import { validateArcadeLayout } from '../src/validation/validateArcadeLayout.js';
import { validLayoutModel } from './fixtures.mjs';

test('a well-formed building layout passes validation', () => {
  const r = validateArcadeLayout(buildArcadeLayout(validLayoutModel()));
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.kind, 'arcade_building_layout');
});

test('a prop placed outside the grid is rejected', () => {
  const m = validLayoutModel();
  m.props[0].gx = 999;
  const r = validateArcadeLayout(buildArcadeLayout(m));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /props\[0\]\.gx must be an integer in/);
});

test('two cabinets in the same cell are rejected', () => {
  const m = validLayoutModel();
  m.cabinets.push({ cabinet: m.cabinets[0].cabinet, gx: 2, gy: 3, rotation: 0, layer: 2 });
  const r = validateArcadeLayout(buildArcadeLayout(m));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /duplicate cabinet cell/);
});

test('unknown theme token is rejected', () => {
  const m = validLayoutModel();
  m.theme = 'cyberpunk-2099';
  const r = validateArcadeLayout(buildArcadeLayout(m));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /theme must be one of/);
});

test('grid below minimum is rejected', () => {
  const m = validLayoutModel();
  m.grid = { cols: 1, rows: 1 };
  // placements would now be out of grid too; the grid bound itself must fail
  const r = validateArcadeLayout(buildArcadeLayout(m));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /grid\.cols must be an integer in/);
});

test('a lighting zone using an ambience preset is rejected', () => {
  const m = validLayoutModel();
  m.zones[0] = { kind: 'lighting', preset: 'haze', palette: 'neon-cyan', gx: 0, gy: 0, cols: 2, rows: 1, intensity: 'low' };
  const r = validateArcadeLayout(buildArcadeLayout(m));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /zones\[0\]\.preset must be one of/);
});

test('an embedded cabinet with a bad token fails the layout', () => {
  const m = validLayoutModel();
  m.cabinets[0].cabinet.palette = 'rainbow-explosion';
  const r = validateArcadeLayout(buildArcadeLayout(m));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /cabinets\[0\]\.cabinet\.palette must be one of/);
});

test('non-quarter rotation is rejected', () => {
  const m = validLayoutModel();
  m.props[0].rotation = 45;
  const r = validateArcadeLayout(buildArcadeLayout(m));
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /props\[0\]\.rotation must be one of/);
});
