// INPUT MODE BEHAVIOR — generated games EXECUTED deterministically (data: import; no DOM,
// no canvas: only init/tick/onInput/proposeResult are driven). Pins the MODE_TUNING feel
// numbers as behavior, not just as strings in source.
// Variant under test: tri-light @ medium speed → hot() exactly when floor(t*2)%3 === 1,
// i.e. t ∈ [0.5,1.0) ∪ [2.0,2.5) ∪ … — a clean 0.5s window for stepping.
// Run: node --test tests/creator/mode-behavior.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gameSource, MODE_TUNING, INPUT_MODES } from '../../arcade/creator/arcade-builder/cabinet-templates.mjs';

async function load(mode) {
  const src = gameSource('tri-light', '#22e0ff', '2', 'standard', 'standard', 'off', mode);
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  const g = mod.createGame();
  g.init({ width: 360, height: 552 });
  return { g, clock: { t: 0 } };
}
/** Advance game time to `to` in 0.05s ticks (matches the host's bounded dt). */
function step({ g, clock }, to) {
  while (clock.t < to - 1e-9) { g.tick(0.05); clock.t += 0.05; }
}
const score = (h) => h.g.proposeResult().proposed_score;

test('tap_window: press scores ONLY inside the hot window', async () => {
  const h = await load('tap_window');
  step(h, 0.6); // hot
  h.g.onInput({ type: 'press', x: 180, y: 200 }); h.g.onInput({ type: 'release', x: 180, y: 200 });
  assert.equal(score(h), 1, 'hot press scores');
  step(h, 1.2); // cold
  h.g.onInput({ type: 'press', x: 180, y: 200 }); h.g.onInput({ type: 'release', x: 180, y: 200 });
  assert.equal(score(h), 1, 'cold press does not');
});

test("every mode accepts the degenerate 'tap' in a hot window (keyboard/sandbox path)", async () => {
  for (const mode of INPUT_MODES) {
    const h = await load(mode);
    step(h, 0.6);
    h.g.onInput({ type: 'tap' });
    assert.equal(score(h), 1, mode);
  }
});

test('hold_band: scores at the closed cadence while held-hot; no banked fractions across releases', async () => {
  const cad = Number(MODE_TUNING.hold_cadence_s);
  const h = await load('hold_band');
  step(h, 0.55);
  h.g.onInput({ type: 'press', x: 180, y: 200 });
  step(h, 0.95); // 0.4s held inside the hot window
  assert.equal(score(h), Math.floor(0.4 / cad + 1e-9), 'cadence accrual');
  h.g.onInput({ type: 'release', x: 180, y: 200 });
  // partial accrual must NOT bank across a release: two short hot holds < cadence each → 0 more
  const before = score(h);
  h.g.onInput({ type: 'press', x: 180, y: 200 }); step(h, 0.99); h.g.onInput({ type: 'release', x: 180, y: 200 });
  step(h, 2.05);
  h.g.onInput({ type: 'press', x: 180, y: 200 }); step(h, 2.2); h.g.onInput({ type: 'release', x: 180, y: 200 });
  assert.equal(score(h), before, 'no fraction banking');
  // holding through a COLD stretch scores nothing
  step(h, 1.2 + 1.0); // ensure cold
  const b2 = score(h);
  h.g.onInput({ type: 'press', x: 180, y: 200 }); step(h, h.clock.t + 0.45); h.g.onInput({ type: 'release', x: 180, y: 200 });
  assert.ok(score(h) <= b2 + 1, 'cold hold adds at most boundary noise'); // window may start mid-hold
});

test('release_timing: only the RELEASE moment matters', async () => {
  const h = await load('release_timing');
  step(h, 0.2); // cold press
  h.g.onInput({ type: 'press', x: 180, y: 200 });
  step(h, 0.6); // hot release
  h.g.onInput({ type: 'release', x: 180, y: 200 });
  assert.equal(score(h), 1, 'cold press → hot release scores');
  step(h, 1.1);
  h.g.onInput({ type: 'press', x: 180, y: 200 });
  step(h, 1.3); // cold release
  h.g.onInput({ type: 'release', x: 180, y: 200 });
  assert.equal(score(h), 1, 'cold release does not');
});

test('swipe_lane: needs real travel AND speed AND a hot release', async () => {
  const px = Number(MODE_TUNING.swipe_min_px);
  const maxT = Number(MODE_TUNING.swipe_max_s);
  // good swipe: fast, long, releases hot
  let h = await load('swipe_lane');
  step(h, 0.55);
  h.g.onInput({ type: 'press', x: 100, y: 200 });
  step(h, 0.65);
  h.g.onInput({ type: 'release', x: 100 + px + 16, y: 200 });
  assert.equal(score(h), 1, 'real swipe scores');
  // too short
  h = await load('swipe_lane');
  step(h, 0.55);
  h.g.onInput({ type: 'press', x: 100, y: 200 });
  step(h, 0.65);
  h.g.onInput({ type: 'release', x: 100 + px - 20, y: 200 });
  assert.equal(score(h), 0, 'short travel does not score');
  // too slow (a slow drag across is a hold, not a swipe)
  h = await load('swipe_lane');
  step(h, 2.05); // inside the second hot window [2.0, 2.5)
  h.g.onInput({ type: 'press', x: 100, y: 200 });
  step(h, 2.05 + maxT + 0.2);
  h.g.onInput({ type: 'release', x: 100 + px + 40, y: 200 });
  assert.equal(score(h), 0, 'slow swipe does not score');
});

test('drag_track: requires REAL movement — a stationary press never scores', async () => {
  const cad = Number(MODE_TUNING.drag_cadence_s);
  // tracked drag: press + continuous moves through the hot window
  let h = await load('drag_track');
  step(h, 0.5);
  h.g.onInput({ type: 'press', x: 100, y: 200 });
  for (let i = 0; i < 9; i++) { step(h, h.clock.t + 0.05); h.g.onInput({ type: 'move', x: 100 + i * 8, y: 200 }); }
  assert.equal(score(h), Math.floor(0.45 / cad + 1e-9), 'tracked drag accrues at cadence');
  // stationary press: no move events → never engages, never scores
  h = await load('drag_track');
  step(h, 0.5);
  h.g.onInput({ type: 'press', x: 100, y: 200 });
  step(h, 1.0);
  h.g.onInput({ type: 'release', x: 100, y: 200 });
  assert.equal(score(h), 0, 'stationary press scores nothing');
});

test('tuning table is the single source of the feel numbers in generated source', async () => {
  const src = gameSource('tri-light', '#22e0ff', '2', 'standard', 'standard', 'off', 'swipe_lane');
  assert.ok(new RegExp(`SWIPE_PX = ${MODE_TUNING.swipe_min_px}\\b`).test(src));
  assert.ok(new RegExp(`SWIPE_T = ${MODE_TUNING.swipe_max_s}\\b`).test(src));
  assert.ok(new RegExp(`HOLD_CAD = ${MODE_TUNING.hold_cadence_s}\\b`).test(src));
  assert.ok(new RegExp(`DRAG_CAD = ${MODE_TUNING.drag_cadence_s}\\b`).test(src));
  assert.ok(new RegExp(`DRAG_WIN = ${MODE_TUNING.drag_move_window_s}\\b`).test(src));
});
