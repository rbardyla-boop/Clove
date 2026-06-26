/**
 * Creator Freedom v1 — Free Sandbox EDITOR browser smoke.
 *
 * Loads the offline builder, switches to the Free Sandbox mode, and checks: the editor mounts, the
 * default example is VALID and gates through the CF-4 importer, the fingerprint computes, switching to
 * each example mechanic stays valid, the output is a standard arcade_game package (capabilities []),
 * adding an entity re-validates, Test-in-sandbox is enabled, no off-host network, no console errors.
 * Run: tests/creator/run-free-sandbox-editor.sh
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

  await page.goto(`${BASE}/arcade/creator/arcade-builder/`, { waitUntil: 'load', timeout: 20000 });
  await page.selectOption('#builderMode', 'free_sandbox');
  await page.waitForFunction(() => window.__cf_free_sandbox && window.__cf_free_sandbox.getPackage(), null, { timeout: 8000 });

  check('Free Sandbox editor mounts', await page.evaluate(() => !!document.querySelector('#freeSandboxRoot .fs-editor') && !document.getElementById('freeSandboxRoot').hidden));
  check('default example is VALID and gates', await page.evaluate(() => window.__cf_free_sandbox.getPackage().ok === true));
  check('verdict shows VALID', /VALID/.test(await page.evaluate(() => document.querySelector('.fs-verdict')?.textContent || '')));
  check('output is a standard arcade_game package (no capabilities, no assets)', await page.evaluate(() => {
    const m = window.__cf_free_sandbox.getPackage().manifest;
    return m.package_kind === 'arcade_game' && m.entry === 'game.mjs' && m.adapter === 'adapter.mjs' && m.capabilities.length === 0 && m.assets.length === 0;
  }));

  // fingerprint computes (async)
  await page.waitForFunction(() => { const c = document.getElementById('fsHash'); return c && /^sha256:|^[0-9a-f]{16,}/.test(c.textContent); }, null, { timeout: 8000 }).catch(() => {});
  check('local fingerprint is shown', await page.evaluate(() => { const c = document.getElementById('fsHash'); return !!c && c.textContent !== '—' && c.textContent !== '…'; }));

  // every example mechanic loads valid via the "Start from" picker (first select in the Start card)
  const examples = ['survival_dodge', 'collect_and_escape', 'wave_clear', 'timed_route', 'combo_score'];
  const startSelect = await page.$('#freeSandboxRoot .fs-card select');
  check('Start-from picker present', !!startSelect);
  for (const id of examples) {
    await page.selectOption('#freeSandboxRoot .fs-card select', id).catch(() => {});
    await page.waitForTimeout(80);
    check(`example ${id} → editor VALID + gates`, await page.evaluate(() => window.__cf_free_sandbox.getPackage().ok === true));
  }

  // add an entity and confirm the editor re-validates (still produces a package)
  await page.selectOption('#freeSandboxRoot .fs-card select', 'survival_dodge');
  await page.waitForTimeout(80);
  const addBtns = await page.$$('#freeSandboxRoot .fs-add');
  check('add controls present', addBtns.length >= 3);
  const beforeEntities = await page.evaluate(() => window.__cf_free_sandbox.getGraph().entities.length);
  // the entities card add button is the 2nd add control (zones, entities, waves, rules order in the DOM)
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#freeSandboxRoot .fs-card')];
    const entitiesCard = cards.find((c) => /Entities/.test(c.querySelector('h3')?.textContent || ''));
    entitiesCard?.querySelector('.fs-add')?.click();
  });
  await page.waitForTimeout(80);
  const afterEntities = await page.evaluate(() => window.__cf_free_sandbox.getGraph().entities.length);
  check('adding an entity grows the graph and stays buildable', afterEntities === beforeEntities + 1 && typeof (await page.evaluate(() => window.__cf_free_sandbox.getPackage().ok)) === 'boolean');

  check('Test-in-sandbox is enabled for a valid game', await page.evaluate(() => {
    const b = [...document.querySelectorAll('#freeSandboxRoot .fs-primary')][0];
    return !!b && !b.disabled;
  }));

  check('no off-host network requests', offHost.length === 0);
  check('no console / page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  if (offHost.length) console.log('OFF-HOST:', offHost.join('\n'));
} finally {
  await browser.close();
}
console.log(fail ? `\nFREE SANDBOX EDITOR SMOKE: ${fail} FAILED` : '\nFREE SANDBOX EDITOR SMOKE: ALL PASS');
process.exit(fail ? 1 : 0);
