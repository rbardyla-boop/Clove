/**
 * Headless browser smoke for Arcade Studio. Drives the cached Playwright chromium against a running
 * dev/preview server, advancing the deterministic `window.__studio.step()` loop (not rAF), then asserts:
 *   - the app booted (window.__studio.ready) with NO uncaught errors / console errors,
 *   - a WebGL context exists and the renderer issued draw calls (the scene actually rendered),
 *   - the debug panel reports live stats,
 *   - an in-page export → import round-trip reproduces an identical hash,
 *   - the layout validates, and switching to player-preview mode and back does not throw.
 *
 * Run from the REPO ROOT so `import('playwright')` resolves there:
 *   node arcade-studio/scripts/smoke-headless.mjs http://localhost:4173
 */

import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://localhost:4173';
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); else console.log(`  ✓ ${msg}`); };

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log(`[smoke] loading ${URL}`);
try {
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__studio && window.__studio.ready === true, { timeout: 20000 });

  // advance the deterministic loop ~2s of frames
  await page.evaluate(() => { for (let i = 0; i < 120; i++) window.__studio.step(1 / 60); });

  const ready = await page.evaluate(() => window.__studio.ready);
  ok(ready === true, 'app booted (window.__studio.ready)');

  const hasGL = await page.evaluate(() => {
    const c = document.getElementById('viewport');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    return !!gl && c.width > 0 && c.height > 0;
  });
  ok(hasGL, 'WebGL context present and canvas sized');

  const draws = await page.evaluate(() => window.__studio.drawCalls());
  ok(draws > 0, `renderer issued draw calls (${draws})`);

  const validation = await page.evaluate(() => window.__studio.getValidation());
  ok(validation.ok === true, `default layout validates (${validation.ok ? 'ok' : validation.errors.join('; ')})`);

  const rt = await page.evaluate(() => window.__studio.roundTrip());
  ok(rt.ok && rt.stable, `in-page export→import round-trip stable (${rt.hash ? rt.hash.slice(0, 18) + '…' : 'n/a'})`);

  // exercise player-preview mode then back to orbit
  await page.evaluate(() => { window.__studio.setCameraMode('player'); for (let i = 0; i < 30; i++) window.__studio.step(1 / 60); window.__studio.setCameraMode('orbit'); for (let i = 0; i < 10; i++) window.__studio.step(1 / 60); });
  ok(true, 'camera mode orbit↔player toggled without throwing');

  const debugText = await page.evaluate(() => document.getElementById('debug-panel').textContent);
  ok(/FPS/.test(debugText) && /Draw calls/.test(debugText) && /Validation/.test(debugText), 'debug panel reports FPS/draw-calls/validation');

  const counts = await page.evaluate(() => {
    const m = window.__studio.getModel();
    return { cabinets: m.cabinets.length, props: m.props.length, signs: m.signs.length };
  });
  ok(counts.cabinets > 0 && counts.props > 0 && counts.signs > 0, `starter hall populated (cab ${counts.cabinets}, props ${counts.props}, signs ${counts.signs})`);

  ok(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? ' → ' + pageErrors.join(' | ') : ''}`);
  ok(consoleErrors.length === 0, `no console errors${consoleErrors.length ? ' → ' + consoleErrors.slice(0, 3).join(' | ') : ''}`);
} catch (err) {
  fails.push(`smoke threw: ${err.message}`);
} finally {
  await browser.close();
}

if (fails.length) {
  console.error('\n[smoke] FAIL:');
  for (const f of fails) console.error(`  ✕ ${f}`);
  process.exit(1);
}
console.log('\n[smoke] PASS — all checks green');
