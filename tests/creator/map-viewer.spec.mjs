/**
 * Creator Foundation CF-5 — local asset-pack map viewer browser smoke.
 *
 * Proves end-to-end (headless): the sample pack (approved tiles) validates + renders an iso composition;
 * a pack referencing an UNAPPROVED hash is BLOCKED (no render); no off-host network request is made.
 *
 * Run: tests/creator/run-map-viewer.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8098';
const URL_ = `${BASE}/arcade/creator/map-viewer/index.html`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const LOCAL = (u) => /^(http:\/\/(127\.0\.0\.1|localhost)|about:|data:|blob:)/.test(u);

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // phone viewport
  const page = await ctx.newPage();
  const errors = [];
  const offHost = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (req) => { if (!LOCAL(req.url())) offHost.push(req.url()); });

  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__cf5_map, null, { timeout: 8000 });

  // load + render the sample (approved) pack
  const report = await page.evaluate(() => window.__cf5_map.loadSampleAndRun());
  check('sample pack validates (approved hashes only)', !!report && report.ok === true);
  check('pack has 2 tiles', !!report && report.limits && report.limits.tile_count === 2);
  check('viewer rendered 2 approved tiles', await page.evaluate(() => window.__cf5_map.tilesRendered === 2));

  // canvas actually drew something (non-background pixels exist)
  const drewPixels = await page.evaluate(() => {
    const c = document.getElementById('mapCanvas'); const x = c.getContext('2d');
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let nonBg = 0;
    for (let i = 0; i < d.length; i += 4) { if (!(d[i] === 5 && d[i + 1] === 6 && d[i + 2] === 12)) nonBg++; }
    return nonBg;
  });
  check('canvas has rendered (non-background) pixels', drewPixels > 500);

  // tiles must render at distinct, CENTERED iso positions — not stacked at the origin (0,0).
  const bbox = await page.evaluate(() => {
    const c = document.getElementById('mapCanvas'); const x = c.getContext('2d');
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, maxX = 0, minY = c.height, maxY = 0;
    for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) {
      const i = (yy * c.width + xx) * 4;
      if (!(d[i] === 5 && d[i + 1] === 6 && d[i + 2] === 12)) { if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (yy < minY) minY = yy; if (yy > maxY) maxY = yy; }
    }
    return { minX, maxX, minY, maxY, w: c.width, h: c.height };
  });
  check('tiles render past the horizontal centre (not stacked at x=0)', bbox.maxX > bbox.w * 0.45);
  check('two tiles span distinct vertical positions', (bbox.maxY - bbox.minY) > 90);

  // a pack referencing an UNAPPROVED hash is BLOCKED (no render)
  const blocked = await page.evaluate(async () => {
    const s = await window.__cf5_map.loadSample();
    s.pack.tiles[0].package_hash = 'sha256:' + '0'.repeat(64); // not in the registry
    const rep = window.__cf5_map.run(s.pack, s.registry, s.packageStore);
    return { ok: (await rep).ok, tiles: window.__cf5_map.tilesRendered };
  });
  check('unapproved-hash pack is BLOCKED', blocked.ok === false);
  check('blocked pack renders 0 tiles', blocked.tiles === 0);

  check('NO off-host network request made', offHost.length === 0);
  if (offHost.length) console.log('off-host:', offHost.join(', '));
  check('no console/page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
} finally {
  await browser.close();
}

console.log(failures ? `\nMAP VIEWER SMOKE: ${failures} FAIL` : '\nMAP VIEWER SMOKE: PASS');
process.exit(failures ? 1 : 0);
