/**
 * Headless browser smoke for the Voxel Lab Bench (Gate A, Slice 2). Drives the cached
 * Playwright chromium against a running static server, advancing the deterministic
 * `window.__bench.step()` loop (not rAF), then asserts:
 *   - the app booted (window.__bench.ready) with NO uncaught errors / console errors,
 *   - a WebGL2 context exists on the canvas,
 *   - the renderer issued exactly ONE draw call at the fixture's full occupancy
 *     (single-InstancedMesh Tier-1 render path, plan Section 3.3/7 Slice 2),
 *   - an in-page export -> import round-trip of the grid's occupancy is stable,
 *   - zero requests to any CDN host (jsdelivr/unpkg/cdnjs) fired during the whole run,
 *   - zero console errors / zero page errors.
 *
 * Structure mirrors arcade-studio/scripts/smoke-headless.mjs (same swiftshader launch
 * args, same console/pageerror capture, same PASS/FAIL exit-code convention).
 *
 * Run from the REPO ROOT so `import('playwright')` resolves there:
 *   node labs/voxel-bench/scripts/bench-headless.mjs http://127.0.0.1:PORT/labs/voxel-bench/index.html
 */

import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:4173/labs/voxel-bench/index.html';
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); else console.log(`  ✓ ${msg}`); };

const CDN_HOST_PATTERN = /(^|\.)((jsdelivr\.net)|(unpkg\.com)|(cdnjs\.cloudflare\.com))$/i;

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

const consoleErrors = [];
const pageErrors = [];
const cdnRequests = [];
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

// Route (not just observe) every request so a CDN reference would be BLOCKED, not
// silently allowed through — matching this repo's established offline-verification
// pattern for CDN-free vendored assets.
await page.route('**/*', (route) => {
  const reqUrl = route.request().url();
  let host = '';
  try {
    host = new URL(reqUrl).hostname;
  } catch {
    // relative/non-URL requests can't be a CDN host; fall through to continue.
  }
  if (CDN_HOST_PATTERN.test(host)) {
    cdnRequests.push(reqUrl);
    route.abort();
    return;
  }
  route.continue();
});

console.log(`[bench-headless] loading ${URL}`);
try {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__bench && window.__bench.ready === true, { timeout: 20000 });

  const ready = await page.evaluate(() => window.__bench.ready);
  ok(ready === true, 'bench booted (window.__bench.ready)');

  const hasGL2 = await page.evaluate(() => {
    const c = document.getElementById('viewport');
    const gl = c.getContext('webgl2');
    return !!gl && c.width > 0 && c.height > 0;
  });
  ok(hasGL2, 'WebGL2 context present and canvas sized');

  // Advance the deterministic loop a few frames (not rAF) before reading draw calls.
  await page.evaluate(() => { for (let i = 0; i < 10; i++) window.__bench.step(1 / 60); });

  const draws = await page.evaluate(() => window.__bench.drawCalls());
  ok(draws === 1, `single instanced draw call at full occupancy (drawCalls=${draws})`);

  const instanceCount = await page.evaluate(() => window.__bench.instanceCount());
  ok(instanceCount > 0, `fixture has occupied instances (instanceCount=${instanceCount})`);

  const rt = await page.evaluate(() => window.__bench.roundTrip());
  ok(rt.ok === true && rt.stable === true, `export→import round-trip stable (cellCount=${rt.cellCount})`);

  ok(cdnRequests.length === 0, `zero CDN requests fired${cdnRequests.length ? ' → ' + cdnRequests.join(' | ') : ''}`);
  ok(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? ' → ' + pageErrors.join(' | ') : ''}`);
  ok(consoleErrors.length === 0, `no console errors${consoleErrors.length ? ' → ' + consoleErrors.slice(0, 3).join(' | ') : ''}`);
} catch (err) {
  fails.push(`bench-headless threw: ${err.message}`);
} finally {
  await browser.close();
}

if (fails.length) {
  console.error('\n[bench-headless] FAIL:');
  for (const f of fails) console.error(`  ✕ ${f}`);
  process.exit(1);
}
console.log('\n[bench-headless] PASS — all checks green');
