/**
 * Voxel Lab Bench — headless LOD-popping measurement harness (Gate B, Slice 4,
 * Blocker #3).
 *
 * This is the harness the plan explicitly calls out as "the harness the Reddit engine
 * never showed us it had" (docs/VOXEL_LAB_BENCH_PLAN.md Section 7 Slice 4 done-
 * criteria): it does not just assert "LOD exists", it drives a scripted simulated-
 * camera-distance sweep across the LOD switch boundary (src/lod.mjs's
 * DEFAULT_LOD_TIER_CONFIG, switchDistances=[10]) over N frames, and at every frame
 * transition measures TWO real numeric signals:
 *
 *   1. Pixel-difference "popping magnitude" — mean absolute per-channel RGBA delta
 *      between consecutive frames, computed from a raw gl.readPixels() sample
 *      (window.__bench.samplePixels(), a 64x64 RGBA region) of the ACTUAL rendered
 *      frame. No external image-diff library — this is deliberately just arithmetic
 *      over two Uint8Arrays.
 *   2. Frame-time-spike — wall-clock ms spent in window.__bench.step(dt) per frame,
 *      compared against a rolling non-transition baseline, to catch a frame-time cost
 *      spike at the LOD switch (not just a visual pop).
 *
 * Both numbers are printed in FULL, per frame-transition, in this script's console
 * output — the plan is explicit that "watch the seam" means the measurement itself is
 * the lesson, so nothing here is summarized or hidden behind a single pass/fail bit.
 *
 * Self-contained: spins up its own tiny static file server (Node's built-in `http`
 * module, no new dependency) rooted at the REPO ROOT (so labs/voxel-bench/index.html's
 * relative `../../../game/vendor/three/...` import resolves the same way it does for
 * bench-headless.mjs), then drives the cached Playwright chromium against it with the
 * same swiftshader launch args bench-headless.mjs already uses.
 *
 * Run from the REPO ROOT:
 *   node labs/voxel-bench/scripts/lod-pop-harness.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../');
const PAGE_PATH = '/labs/voxel-bench/index.html';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

/** Minimal static file server, repo-root-rooted, GET-only, no directory listing. */
function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url, 'http://127.0.0.1');
        const relPath = decodeURIComponent(reqUrl.pathname);
        const filePath = path.join(REPO_ROOT, relPath);
        // Defense in depth: refuse to serve outside the repo root.
        if (!filePath.startsWith(REPO_ROOT)) {
          res.writeHead(403);
          res.end('forbidden');
          return;
        }
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      } catch (err) {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const N_FRAMES = 60;
// Simulated camera-distance sweep crossing the LOD boundary (switchDistances=[10]) at
// roughly the midpoint of the run — distance ramps 0 -> 20 linearly over N_FRAMES, so
// the transition frame is deterministic and known ahead of time (frame index where
// distance first reaches 10).
const START_DISTANCE = 0;
const END_DISTANCE = 20;
const LOD_SWITCH_DISTANCE = 10; // must match src/lod.mjs DEFAULT_LOD_TIER_CONFIG

function distanceAtFrame(frameIndex) {
  const t = frameIndex / (N_FRAMES - 1);
  return START_DISTANCE + t * (END_DISTANCE - START_DISTANCE);
}

const expectedTransitionFrame = (() => {
  for (let i = 0; i < N_FRAMES; i += 1) {
    if (distanceAtFrame(i) >= LOD_SWITCH_DISTANCE) return i;
  }
  return -1;
})();

/** Mean absolute per-channel byte difference between two equal-length Uint8Arrays. */
function meanAbsDiff(a, b) {
  if (a.length !== b.length) throw new RangeError('meanAbsDiff: sample length mismatch');
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += Math.abs(a[i] - b[i]);
  }
  return total / a.length;
}

console.log(`[lod-pop-harness] N_FRAMES=${N_FRAMES}, distance sweep ${START_DISTANCE} -> ${END_DISTANCE}, LOD switch at distance=${LOD_SWITCH_DISTANCE}, expected transition frame index=${expectedTransitionFrame}`);

const server = await startStaticServer();
const { port } = server.address();
const url = `http://127.0.0.1:${port}${PAGE_PATH}`;
console.log(`[lod-pop-harness] serving ${REPO_ROOT} -> ${url}`);

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); else console.log(`  ✓ ${msg}`); };

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__bench && window.__bench.ready === true, { timeout: 20000 });
  ok(await page.evaluate(() => window.__bench.ready === true), 'bench booted (window.__bench.ready)');

  // Aim the camera at the Slice 4 LOD object (it lives at a separate AABB from the
  // default fixture) so samplePixels() actually observes the geometry under test.
  await page.evaluate(() => window.__bench.aimAtLodObject());

  // Activate the LOD object BEFORE the measured sweep starts (its first activation is
  // itself a one-time "transitioned:true" event per bench-boot.mjs's lazy opt-in
  // design — see setCameraDistance's doc comment — which is not the LOD-LEVEL
  // transition this harness is scripted to cross, so it must happen outside the
  // measured frame loop, not be conflated with it).
  await page.evaluate((startDistance) => {
    window.__bench.setCameraDistance(startDistance);
    window.__bench.step(1 / 60);
  }, START_DISTANCE);

  // Drive the sweep and collect per-frame measurements in-page (avoids N round-trips'
  // worth of IPC jitter polluting the frame-time measurement).
  const frames = await page.evaluate(
    ({ nFrames, startDistance, endDistance }) => {
      const results = [];
      for (let i = 0; i < nFrames; i += 1) {
        const t = i / (nFrames - 1);
        const distance = startDistance + t * (endDistance - startDistance);

        const stepStart = performance.now();
        const lodResult = window.__bench.setCameraDistance(distance);
        window.__bench.step(1 / 60);
        const stepEnd = performance.now();

        const sample = Array.from(window.__bench.samplePixels(64));
        results.push({
          frameIndex: i,
          distance,
          lodLevel: lodResult.lodLevel,
          transitioned: lodResult.transitioned,
          frameTimeMs: stepEnd - stepStart,
          sample,
        });
      }
      return results;
    },
    { nFrames: N_FRAMES, startDistance: START_DISTANCE, endDistance: END_DISTANCE },
  );

  ok(frames.length === N_FRAMES, `collected ${frames.length} frames (expected ${N_FRAMES})`);

  // Compute frame-to-frame pixel-diff + baseline frame time, then print EVERY
  // transition's numbers in full (not summarized) per the task's requirement.
  const nonTransitionFrameTimes = [];
  const poppingMagnitudes = [];
  console.log('\n[lod-pop-harness] per-frame-transition measurements:');
  console.log('  frame  distance  lodLevel  transitioned  frameTimeMs   poppingMagnitude(mean-abs-RGBA-delta)');
  for (let i = 1; i < frames.length; i += 1) {
    const prev = frames[i - 1];
    const cur = frames[i];
    const popping = meanAbsDiff(Uint8Array.from(prev.sample), Uint8Array.from(cur.sample));
    poppingMagnitudes.push({ frameIndex: i, popping, transitioned: cur.transitioned });
    if (!cur.transitioned) nonTransitionFrameTimes.push(cur.frameTimeMs);
    console.log(
      `  ${String(i).padStart(5)}  ${cur.distance.toFixed(2).padStart(8)}  ${String(cur.lodLevel).padStart(8)}` +
      `  ${String(cur.transitioned).padStart(12)}  ${cur.frameTimeMs.toFixed(3).padStart(11)}   ${popping.toFixed(4)}`,
    );
  }

  const actualTransitionFrames = frames.filter((f) => f.transitioned).map((f) => f.frameIndex);
  ok(actualTransitionFrames.length === 1, `exactly one LOD transition frame observed (got frames ${JSON.stringify(actualTransitionFrames)})`);
  ok(
    actualTransitionFrames[0] === expectedTransitionFrame,
    `LOD transition occurred at the expected frame index (expected ${expectedTransitionFrame}, got ${actualTransitionFrames[0]})`,
  );

  const baselineMeanFrameTime = nonTransitionFrameTimes.reduce((a, b) => a + b, 0) / Math.max(1, nonTransitionFrameTimes.length);
  const FRAME_TIME_SPIKE_MULTIPLE = 10; // fixed multiple of baseline; the transition frame does real work a
  // steady-state frame does not (disposes the old renderable, rebuilds a fresh
  // InstancedMesh/BufferGeometry+matrices for the new LOD level), so some spike over a
  // sub-millisecond swiftshader-software-rasterizer baseline is EXPECTED, not a bug —
  // this multiple is generous enough to tolerate CI/software-rasterizer noise while
  // still catching a genuinely pathological spike (e.g. 50x+) if one were introduced.
  const transitionEntry = poppingMagnitudes.find((p) => p.transitioned);
  const transitionFrameTime = frames[transitionEntry.frameIndex].frameTimeMs;
  const frameTimeSpikeRatio = baselineMeanFrameTime > 0 ? transitionFrameTime / baselineMeanFrameTime : 0;

  console.log(`\n[lod-pop-harness] baseline (non-transition) mean frame time: ${baselineMeanFrameTime.toFixed(3)}ms`);
  console.log(`[lod-pop-harness] transition-frame frame time: ${transitionFrameTime.toFixed(3)}ms (ratio to baseline: ${frameTimeSpikeRatio.toFixed(2)}x)`);
  console.log(`[lod-pop-harness] transition-frame popping magnitude: ${transitionEntry.popping.toFixed(4)}`);

  ok(
    frameTimeSpikeRatio <= FRAME_TIME_SPIKE_MULTIPLE,
    `frame time at the LOD transition stays within ${FRAME_TIME_SPIKE_MULTIPLE}x of baseline (ratio=${frameTimeSpikeRatio.toFixed(2)}x)`,
  );

  // "Popping" as a FAILURE MODE is a large pixel-delta at a frame OTHER than the
  // designated transition frame — the fixed threshold below is set from the observed
  // steady-state (non-transition) popping magnitudes on THIS grid/camera setup, not an
  // arbitrary guess: steady-state frames render an unchanging static scene (no camera
  // animation, no lighting) so their popping magnitude should be ~0 (only WebGL/AA
  // jitter noise); the transition frame is expected to exceed that by a wide margin.
  const steadyStateMagnitudes = poppingMagnitudes.filter((p) => !p.transitioned).map((p) => p.popping);
  const maxSteadyStateMagnitude = steadyStateMagnitudes.length ? Math.max(...steadyStateMagnitudes) : 0;
  const STEADY_STATE_NOISE_CEILING = 2.0; // generous ceiling for a static, non-animated scene
  const unexpectedPoppingFrames = poppingMagnitudes.filter((p) => !p.transitioned && p.popping > STEADY_STATE_NOISE_CEILING);

  console.log(`[lod-pop-harness] max steady-state (non-transition) popping magnitude: ${maxSteadyStateMagnitude.toFixed(4)} (ceiling: ${STEADY_STATE_NOISE_CEILING})`);

  ok(
    unexpectedPoppingFrames.length === 0,
    `no unexpected popping outside the designated transition frame (found ${unexpectedPoppingFrames.length} such frames${unexpectedPoppingFrames.length ? ': ' + JSON.stringify(unexpectedPoppingFrames.map((p) => p.frameIndex)) : ''})`,
  );
  ok(
    transitionEntry.popping > maxSteadyStateMagnitude,
    `the designated transition frame's popping magnitude (${transitionEntry.popping.toFixed(4)}) exceeds the steady-state ceiling (${maxSteadyStateMagnitude.toFixed(4)}), proving the harness actually measures the LOD seam`,
  );

  ok(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? ' → ' + pageErrors.join(' | ') : ''}`);
  ok(consoleErrors.length === 0, `no console errors${consoleErrors.length ? ' → ' + consoleErrors.slice(0, 3).join(' | ') : ''}`);
} catch (err) {
  fails.push(`lod-pop-harness threw: ${err.message}\n${err.stack || ''}`);
} finally {
  await browser.close();
  server.close();
}

if (fails.length) {
  console.error('\n[lod-pop-harness] FAIL:');
  for (const f of fails) console.error(`  ✕ ${f}`);
  process.exit(1);
}
console.log('\n[lod-pop-harness] PASS — LOD-pop measurement harness green, numeric baseline recorded above');
