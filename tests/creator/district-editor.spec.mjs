/**
 * Creator Foundation CF-3.5 — District Asset Editor browser smoke.
 *
 * Loads the offline top-world composer, checks: sample palette loads, the empty grid is honestly
 * BLOCKED (validator demands ≥1 tile), placing approved tiles flips it VALID and renders the iso
 * preview, an economy-term pack id flips it BLOCKED, clearing a tile works, export gates on
 * validity, the receipt note says not-live-authorized, no off-host network, no console errors.
 * Run: tests/creator/run-district-editor.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8097';

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const offHost = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname)) offHost.push(r.url()); });

  await page.goto(`${BASE}/arcade/creator/district-editor/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.__cf35_editor && window.__cf35_editor.paletteSize >= 2, null, { timeout: 8000 });

  check('sample palette loads (block_style + block_layered)', await page.evaluate(() => window.__cf35_editor.paletteSize >= 2));
  check('empty grid is honestly BLOCKED (≥1 tile required)', await page.evaluate(() => {
    const r = window.__cf35_editor.lastReport;
    return r && r.ok === false && r.errors.some((e) => /at least 1/.test(e));
  }));
  check('export disabled while blocked', await page.evaluate(() => document.getElementById('exportPack').disabled === true));

  // place two approved tiles (one of each kind) → VALID + preview renders
  const blank = await page.evaluate(() => document.getElementById('preview').toDataURL());
  await page.evaluate(() => { window.__cf35_editor.selectPalette(0); window.__cf35_editor.placeAt(0, 0); });
  await page.evaluate(() => { window.__cf35_editor.selectPalette(1); window.__cf35_editor.placeAt(1, 1); });
  await page.waitForFunction(() => window.__cf35_editor.lastReport && window.__cf35_editor.lastReport.ok === true, null, { timeout: 4000 });
  check('two approved tiles → VALID', /VALID/.test(await page.evaluate(() => document.getElementById('verdict').textContent)));
  check('grid shows both tile kinds (S + L cells)', await page.evaluate(() => !!document.querySelector('#grid .cell-style') && !!document.querySelector('#grid .cell-layered')));
  const drawn = await page.evaluate(() => document.getElementById('preview').toDataURL());
  check('iso preview renders the composition (canvas changed)', drawn !== blank && drawn.length > 200);
  check('export enabled on valid', !(await page.evaluate(() => document.getElementById('exportPack').disabled)));
  check('pack hash rendered (sha256:64hex)', /^sha256:[0-9a-f]{64}$/.test(await page.evaluate(() => document.getElementById('hash').textContent)));
  check('receipt note: not authorized for live world', /live_world_authorized=false/.test(await page.evaluate(() => document.getElementById('receiptNote').textContent)));
  check('exported pack carries the CF-5 constraints', await page.evaluate(() => {
    const p = window.__cf35_editor.lastPack;
    return p && p.constraints && p.constraints.no_live_world_load === true && p.constraints.approved_hashes_only === true && p.pack_kind === 'city_asset_pack';
  }));

  // economy term in pack id → BLOCKED (shared validator owns the rule)
  await page.fill('#packId', 'sell-this-district');
  await page.waitForFunction(() => window.__cf35_editor.lastReport && window.__cf35_editor.lastReport.ok === false, null, { timeout: 4000 });
  check('economy term in pack id → BLOCKED', /BLOCKED/.test(await page.evaluate(() => document.getElementById('verdict').textContent)));
  await page.fill('#packId', 'my-district-corner');
  await page.waitForFunction(() => window.__cf35_editor.lastReport && window.__cf35_editor.lastReport.ok === true, null, { timeout: 4000 });

  // toggling an occupied cell clears it
  await page.evaluate(() => window.__cf35_editor.placeAt(1, 1));
  check('clicking an occupied cell clears the tile', await page.evaluate(() => window.__cf35_editor.tileCount === 1));

  // load-test ergonomics: import an existing pack JSON → grid repopulates and validates
  const { fileURLToPath } = await import('node:url');
  const SAMPLE_PACK = fileURLToPath(new URL('../../arcade/creator/samples/sample-asset-pack/pack.json', import.meta.url));
  await page.setInputFiles('#importPack', SAMPLE_PACK);
  await page.waitForFunction(() => window.__cf35_editor.tileCount === 2, null, { timeout: 4000 });
  check('pack import repopulates the grid from the file (2 tiles)', await page.evaluate(() => window.__cf35_editor.tileCount === 2));
  check('pack import restores pack id + grid dims', await page.evaluate(() => document.getElementById('packId').value === 'downtown-mini-map' && document.getElementById('cols').value === '2'));
  await page.waitForFunction(() => window.__cf35_editor.lastReport && window.__cf35_editor.lastReport.ok === true, null, { timeout: 4000 });
  check('imported sample pack validates VALID against the sample registry', /VALID/.test(await page.evaluate(() => document.getElementById('verdict').textContent)));

  check('no off-host network requests', offHost.length === 0);
  check('no console / page errors', errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
} finally {
  await browser.close();
}
console.log(fail === 0 ? 'DISTRICT EDITOR SMOKE: PASS' : `DISTRICT EDITOR SMOKE: ${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
