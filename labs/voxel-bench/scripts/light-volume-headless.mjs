/**
 * Voxel Lab Bench — headless coarse-lighting-grid (LPV) resolution-sweep measurement
 * harness (Gate B, Slice 5, Blocker #4).
 *
 * This is the harness Section 7 Slice 5's done-criteria calls for: "the four-row table
 * in Section 4.3's example is reproducible by running this slice's headless script and
 * matches (numerically, not exactly) the qualitative shape shown there" — i.e. this
 * script drives window.__bench.setLightGridResolution() across the Section 5 tier
 * resolutions (8/16/32/64), prints the SAME four-column table shape
 * (lightGridResolution | frameTimeMs | lightVolumeBytes | drawCalls) Section 4.3's
 * illustrative Markdown example shows, and asserts the qualitative shape actually holds
 * on real measurements from this running bench:
 *
 *   1. drawCalls is IDENTICAL across every resolution — the numeric proof that lighting
 *      cost is decoupled from geometry/draw-call count (bench-boot.mjs's
 *      setLightGridResolution/rebuildLightVolume never touch the active render strategy,
 *      scene contents, or draw-call count; see that file's Slice 5 comments).
 *   2. lightVolumeBytes strictly increases with resolution (structural: more cells, more
 *      bytes — checked numerically against this codebase's actual light-volume.mjs
 *      layout, not asserted from the plan doc's illustrative numbers).
 *   3. frameTimeMs (here: the light-volume build/propagate cost returned by
 *      setLightGridResolution, since the light volume is CPU-side-only bookkeeping at
 *      this slice and does not yet change per-frame render time at all — see
 *      bench-boot.mjs's rebuildLightVolume comment) is finite and non-negative at every
 *      resolution, and does not blow up unboundedly between the smallest and largest
 *      resolution — a generous ratio ceiling (not a hard absolute-ms budget), matching
 *      this repo's established house style for headless assertions under a
 *      software-rasterizer (see scripts/lod-pop-harness.mjs's frame-time-spike-ratio
 *      check for the same reasoning): swiftshader timing is real but noisy at
 *      sub-millisecond scale, so an absolute ms ceiling would be flaky where a
 *      structural ratio is not.
 *
 * Self-contained: spins up its own tiny static file server (Node's built-in `http`
 * module) rooted at the REPO ROOT, then drives the cached Playwright chromium against
 * it with the same swiftshader launch args bench-headless.mjs and lod-pop-harness.mjs
 * already use.
 *
 * Run from the REPO ROOT:
 *   node labs/voxel-bench/scripts/light-volume-headless.mjs
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

// The exact resolutions Section 5 cites across both fidelity tiers: Tier-1 8³-16³,
// Tier-2 32³-64³ — sweeping all four in one run makes the table span both tiers, same
// as Section 4.3's illustrative example (which used 16/32/64; 8 is added here since
// it's Tier-1's cited floor and costs nothing extra to include).
const TIER_RESOLUTIONS = [8, 16, 32, 64];

console.log(`[light-volume-headless] resolution sweep: ${TIER_RESOLUTIONS.join(', ')}`);

const server = await startStaticServer();
const { port } = server.address();
const url = `http://127.0.0.1:${port}${PAGE_PATH}`;
console.log(`[light-volume-headless] serving ${REPO_ROOT} -> ${url}`);

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

  // Render one steady-state frame first so drawCalls() reflects the active strategy
  // before the sweep starts (matches the other harnesses' convention of stepping once
  // before reading any renderer.info-derived metric).
  await page.evaluate(() => window.__bench.step(1 / 60));

  const rows = await page.evaluate((resolutions) => {
    return resolutions.map((r) => window.__bench.setLightGridResolution(r));
  }, TIER_RESOLUTIONS);

  ok(rows.length === TIER_RESOLUTIONS.length, `collected ${rows.length} measurements (expected ${TIER_RESOLUTIONS.length})`);

  console.log('\n[light-volume-headless] measured table (matches docs/VOXEL_LAB_BENCH_PLAN.md Section 4.3 shape):');
  console.log('| lightGridResolution | frameTimeMs | lightVolumeBytes | drawCalls |');
  console.log('|---|---|---|---|');
  for (const row of rows) {
    console.log(`| ${row.resolution} | ${row.buildTimeMs.toFixed(3)} | ${row.lightVolumeBytes.toLocaleString('en-US')} | ${row.drawCalls} |`);
  }
  console.log('');

  // --- Assertion 1: draw calls are IDENTICAL across every resolution — the numeric
  // proof that lighting cost is decoupled from geometry/draw-call count. ---
  const drawCallValues = new Set(rows.map((r) => r.drawCalls));
  ok(
    drawCallValues.size === 1,
    `drawCalls is identical across all ${TIER_RESOLUTIONS.length} resolutions (values: ${JSON.stringify([...drawCallValues])})`,
  );

  // --- Assertion 2: lightVolumeBytes strictly increases with resolution — a structural
  // check against THIS codebase's actual light-volume.mjs layout, not the plan doc's
  // illustrative numbers. ---
  let bytesStrictlyIncreasing = true;
  for (let i = 1; i < rows.length; i += 1) {
    if (!(rows[i].lightVolumeBytes > rows[i - 1].lightVolumeBytes)) bytesStrictlyIncreasing = false;
  }
  ok(
    bytesStrictlyIncreasing,
    `lightVolumeBytes strictly increases with resolution (${rows.map((r) => r.lightVolumeBytes).join(' < ')})`,
  );

  // --- Assertion 3: buildTimeMs is finite/non-negative at every resolution, and does
  // not blow up unboundedly from smallest to largest resolution. A RATIO ceiling, not an
  // absolute-ms budget — swiftshader timing is real but noisy at sub-millisecond scale
  // (same reasoning scripts/lod-pop-harness.mjs already documents for its own
  // frame-time-spike check), so a hard ms number would be flaky where a generous ratio
  // is not. The resolution range here is 8x (8³ -> 64³ is a 512x cell-count increase);
  // BUILD_TIME_RATIO_CEILING is set an order of magnitude above that so it tolerates
  // noise while still catching a genuinely pathological (e.g. accidentally-quadratic)
  // cost blowup. Skipped (not failed) below an absolute floor, since dividing by a
  // near-zero baseline on a fast machine would itself be the flaky thing.
  const allFinite = rows.every((r) => Number.isFinite(r.buildTimeMs) && r.buildTimeMs >= 0);
  ok(allFinite, 'buildTimeMs is finite and non-negative at every resolution');

  const baselineBuildTimeMs = rows[0].buildTimeMs;
  const largestBuildTimeMs = rows[rows.length - 1].buildTimeMs;
  const BUILD_TIME_RATIO_CEILING = 5000;
  const BASELINE_FLOOR_MS = 0.05;
  if (baselineBuildTimeMs > BASELINE_FLOOR_MS) {
    const ratio = largestBuildTimeMs / baselineBuildTimeMs;
    ok(
      ratio <= BUILD_TIME_RATIO_CEILING,
      `buildTimeMs at the largest resolution stays within ${BUILD_TIME_RATIO_CEILING}x of the smallest (ratio=${ratio.toFixed(2)}x)`,
    );
  } else {
    console.log(`  (skipped ratio check: baseline buildTimeMs=${baselineBuildTimeMs.toFixed(4)}ms is below the ${BASELINE_FLOOR_MS}ms noise floor)`);
  }

  ok(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? ' → ' + pageErrors.join(' | ') : ''}`);
  ok(consoleErrors.length === 0, `no console errors${consoleErrors.length ? ' → ' + consoleErrors.slice(0, 3).join(' | ') : ''}`);
} catch (err) {
  fails.push(`light-volume-headless threw: ${err.message}\n${err.stack || ''}`);
} finally {
  await browser.close();
  server.close();
}

if (fails.length) {
  console.error('\n[light-volume-headless] FAIL:');
  for (const f of fails) console.error(`  ✕ ${f}`);
  process.exit(1);
}
console.log('\n[light-volume-headless] PASS — lighting-resolution-cost table reproduced, decoupling proof green');
