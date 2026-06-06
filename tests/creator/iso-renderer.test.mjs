/**
 * Creator Foundation CF-1 — isometric renderer projection tests (pure, no canvas).
 *   node --test tests/creator/*.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldToScreen, tileDiamond, ISO } from '../../arcade/creator/render/iso-renderer.mjs';

test('worldToScreen at origin maps grid (0,0) to the origin', () => {
  const p = worldToScreen(0, 0, { originX: 100, originY: 50 });
  assert.deepEqual(p, { sx: 100, sy: 50 });
});

test('worldToScreen is the standard 2:1 iso projection', () => {
  const a = worldToScreen(1, 0);
  assert.equal(a.sx, ISO.tileW / 2);
  assert.equal(a.sy, ISO.tileH / 2);
  const b = worldToScreen(0, 1);
  assert.equal(b.sx, -ISO.tileW / 2);
  assert.equal(b.sy, ISO.tileH / 2);
});

test('worldToScreen is deterministic', () => {
  assert.deepEqual(worldToScreen(3, 2, { originX: 10, originY: 7 }), worldToScreen(3, 2, { originX: 10, originY: 7 }));
});

test('tileDiamond returns 4 corners forming a diamond around the tile center', () => {
  const d = tileDiamond(0, 0, { originX: 0, originY: 0 });
  assert.equal(d.length, 4);
  // top and bottom share x; left and right share y
  assert.equal(d[0].x, d[2].x);
  assert.equal(d[1].y, d[3].y);
  assert.equal(d[0].y < d[2].y, true); // top above bottom
});
