// Playable sandbox input — contract for the pointer-forwarding overlay (source-read; behavior browser-smoked).
// Real gestures over the cabinet (tap/hold/release/swipe/drag) must reach the game via the SAME postMessage
// input channel as the Tap button — no new capability, the iframe stays a null-origin sandbox.
// Run: node --test tests/creator/sandbox-input.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const JS = readFileSync(new URL('../../arcade/creator/arcade-sandbox/sandbox-runner.mjs', import.meta.url), 'utf8');
const HTML = readFileSync(new URL('../../arcade/creator/arcade-sandbox/index.html', import.meta.url), 'utf8');
const fn = (name) => { const i = JS.indexOf('function ' + name + '('); return i === -1 ? '' : JS.slice(i, JS.indexOf('\n}\n', i) + 2); };

test('run() wraps the frame with a transparent input overlay', () => {
  const run = JS.slice(JS.indexOf('export function run('));
  assert.match(run, /class = 'sb-input-overlay'|className = 'sb-input-overlay'/);
  assert.match(run, /wireOverlay\(overlay, frame, dims\)/);
  assert.match(run, /wrap\.appendChild\(frame\)/);
  assert.match(run, /wrap\.appendChild\(overlay\)/);
  // overlay is transparent + does not block touch scrolling handling (touch-action none so gestures are ours)
  assert.match(run, /background:transparent/);
  assert.match(run, /touch-action:none/);
});

test('overlay forwards press/move/release with frame coordinates via the existing input channel', () => {
  const w = fn('wireOverlay');
  assert.ok(w, 'wireOverlay exists');
  assert.match(w, /addEventListener\('pointerdown'[\s\S]*?sendInput\(\{ type: 'press', x: p\.x, y: p\.y \}\)/);
  assert.match(w, /addEventListener\('pointermove'[\s\S]*?sendInput\(\{ type: 'move', x: p\.x, y: p\.y \}\)/);
  assert.match(w, /sendInput\(\{ type: 'release', x: p\.x, y: p\.y \}\)/);
  assert.match(w, /addEventListener\('pointerup'/);
  assert.match(w, /addEventListener\('pointercancel'/);
  // move only fires while a press is active
  assert.match(w, /pointermove'.*\n?.*if \(!down\) return/);
  // coordinates are clamped into the frame and mapped through getBoundingClientRect (scale-correct)
  assert.match(w, /getBoundingClientRect\(\)/);
  assert.match(w, /Math\.max\(0, Math\.min\(dims\.width/);
  assert.match(w, /Math\.max\(0, Math\.min\(dims\.height/);
});

test('input still flows through the same postMessage channel (no new capability)', () => {
  assert.match(JS, /function sendInput\(event\) \{ if \(currentFrame && currentFrame\.contentWindow\) currentFrame\.contentWindow\.postMessage\(\{ type: 'input', event \}/);
  // the iframe is still a null-origin sandbox with no network
  assert.match(JS, /frame\.setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.match(JS, /default-src \\'none\\'/); // child CSP unchanged (no network/eval)
});

test('Tap button is retained as a fallback', () => {
  assert.match(JS, /el\('tapBtn'\)\?\.addEventListener\('click', \(\) => sendInput\(\{ type: 'tap' \}\)\)/);
  assert.match(HTML, /id="tapBtn"/);
  assert.match(HTML, /Tap, hold, or swipe the screen/i); // the play hint
});

test('the cabinet scales to fit (all frame contracts + small screens) and teardown removes the overlay', () => {
  const f = fn('fitFrame');
  assert.ok(f, 'fitFrame exists');
  assert.match(f, /Math\.min\(1, avail \/ dims\.width\)/);
  assert.match(f, /transform = scale < 1 \? 'scale\(/);
  const t = fn('teardown');
  assert.match(t, /currentWrap && currentWrap\.parentNode/);
  assert.match(JS, /window\.addEventListener\('resize'/); // re-fit on orientation change
});
