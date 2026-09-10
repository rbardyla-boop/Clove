import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../');
const js = fs.readFileSync(path.join(root, 'game/Arcade/deck-care.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'game/Arcade/deck-care.css'), 'utf8');
const targets = ['imm', 'unblock', 'mario', 'c2048', 'serpent', 'match', 'stacker', 'mine', 'rally', 'break', 'push', 'switch', 'scorch', 'asteroids', 'invaders'];

test('deck care defines one goal target for all 15 arcade tabs', () => {
  for (const target of targets) assert.match(js, new RegExp(`id: '${target}'`));
  assert.equal((js.match(/id: '/g) || []).length, 15);
  assert.match(js, /panel-\$\{definition\.id\}/);
  assert.match(js, /:scope > \.game-layout/);
  assert.match(js, /YOUR GOAL/);
  for (const phrase of ['2048', '10 focus markers', 'five lines', 'every safe cell', 'five times', 'every block', 'all three crates', 'zero HP', 'every rock', 'all invaders']) {
    assert.match(js, new RegExp(phrase));
  }
});

test('deck care touch keys carry exact key and code pairs', () => {
  assert.match(js, /new KeyboardEvent\(type, \{ key: binding\.key, code: binding\.code/);
  assert.match(js, /dataset\.key = binding\.key/);
  assert.match(js, /dataset\.code = binding\.code/);
  assert.match(js, /id: 'serpent'.*keys: ARROWS/s);
  assert.doesNotMatch(js, /WASD/);
  assert.doesNotMatch(js, /keys: .*concat\(ARROWS\)/);
  assert.match(js, /id: 'mine', goal: 'Reveal every safe cell\.'/);
  assert.doesNotMatch(js, /flag every mine/);
});

test('touch inputs release on normal and interrupted lifecycles', () => {
  assert.match(js, /pointerup', release/);
  assert.match(js, /pointercancel', release/);
  assert.match(js, /lostpointercapture', release/);
  assert.match(js, /window\.addEventListener\('blur', releaseAll\)/);
  assert.match(js, /tab\.addEventListener\('click', releaseAll/);
  assert.match(js, /dispatchKey\('keyup', pressed\.get\(button\)\)/);
  assert.match(js, /pressed\.clear\(\)/);
  assert.match(js, /button\.addEventListener\('click', click\)/);
  assert.match(js, /if \(pointerGesture\) \{ pointerGesture = false; return; \}/);
});

test('care pass preserves compact red black cream UI and mobile hit targets', () => {
  assert.match(css, /background: var\(--bg2\)/);
  assert.match(css, /border-left: 3px solid var\(--red\)/);
  assert.match(css, /min-width: 44px/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.top-bar > div:last-child \{[^}]*flex-wrap: wrap/s);
  assert.match(css, /data-effects="calm"/);
  assert.match(css, /canvas-frame-tag\.live::before \{ animation: none; \}/);
  assert.match(css, /@media \(max-width: 430px\)/);
});
