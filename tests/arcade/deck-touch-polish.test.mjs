import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../');
const js = fs.readFileSync(path.join(root, 'game/Arcade/deck-care.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'game/Arcade/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'game/Arcade/deck-care.css'), 'utf8');

test('touch controls mirror held keyboard repeat and always release safely', () => {
  assert.match(js, /setInterval\(\(\) => \{/);
  assert.match(js, /dispatchKey\('keydown', binding, true\)/);
  assert.match(js, /clearInterval\(state\.repeatTimer\)/);
  assert.match(js, /button\.addEventListener\('pointercancel', event =>/);
  assert.match(js, /suppressPointerClick = false;\s+release\(event\)/);
  assert.match(js, /window\.addEventListener\('blur', releaseAll\)/);
  assert.match(js, /if \(document\.hidden\) releaseAll\(\)/);
});

test('keyboard activation is not swallowed by pointer-click suppression', () => {
  assert.match(js, /event\.detail ===? 0|event\.detail > 0 && suppressPointerClick/);
  assert.match(js, /repeat, bubbles: true/);
  assert.match(js, /aria-label', 'Touch controls; hold a key to repeat'/);
});

test('briefs name the real WASD aliases without changing the 15-tab router', () => {
  for (const phrase of ['A/D or ←/→', 'W/↑', 'S/↓', 'Use WASD or arrows', 'Space fires']) {
    assert.match(js, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal((html.match(/data-target="[^"]+"/g) || []).length, 15);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /\.deck-care-touch-label/);
});
