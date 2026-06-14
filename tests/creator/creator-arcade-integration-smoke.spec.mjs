/**
 * Creator Corner ↔ Arcade Studio integration smoke.
 *
 * Served from the REPO ROOT with the production mapping /arcade-studio/ → arcade-studio/dist/ (simulating
 * the Option A static deploy). Proves: the Creator Corner hub exposes the Arcade Studio tile as its 5th
 * link (the production path /arcade-studio/), stays a static no-active-control surface, and that FOLLOWING
 * that link reaches the built Arcade Studio app and it BOOTS (window.__studio.ready) with no errors.
 * Arcade Studio stays a separate, data-only app.
 *
 * Run: tests/creator/run-creator-arcade-integration-smoke.sh  (builds the dist, serves repo root + maps /arcade-studio/)
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8098';
let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const EXPECTED_LINKS = ['/arcade-studio/', '../arcade-builder/', '../arcade-sandbox/',
  '../block-editor/', '../layered-editor/'].sort();

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const hubUrl = `${BASE}/arcade/creator/creator-corner/`;

  // 1. HUB exposes the Arcade Studio tile + stays static.
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(hubUrl, { waitUntil: 'load' });
  const links = await page.$$eval('a.tool-link', (as) => as.map((a) => a.getAttribute('href')).sort());
  check('hub exposes exactly the 5 tool links incl. Arcade Studio', JSON.stringify(links) === JSON.stringify(EXPECTED_LINKS));
  const studioHref = await page.$$eval('a.tool-link',
    (as) => { const a = as.find((x) => /arcade-studio/.test(x.getAttribute('href'))); return a ? a.getAttribute('href') : null; });
  check('Arcade Studio tile is present and labelled', !!studioHref);
  const activeControls = await page.$$eval('button, form, input, [onclick]', (n) => n.length);
  check('hub remains static (no button/form/input/onclick)', activeControls === 0);
  check('hub loads with no console/page errors', errors.length === 0);

  // 2. FOLLOW the hub link → Arcade Studio built app boots.
  const studioUrl = new URL(studioHref || '', hubUrl).href;
  const sPage = await ctx.newPage();
  const sErrors = [];
  sPage.on('pageerror', (e) => sErrors.push('pageerror: ' + e.message));
  sPage.on('console', (m) => { if (m.type() === 'error') sErrors.push('console: ' + m.text()); });
  await sPage.goto(studioUrl, { waitUntil: 'load' });
  const ready = await sPage.waitForFunction(() => !!(window.__studio && window.__studio.ready), null, { timeout: 15000 })
    .then(() => true).catch(() => false);
  check('hub link resolves to the built Arcade Studio app and it BOOTS (window.__studio.ready)', ready);
  check('Arcade Studio loads with no console/page errors', sErrors.length === 0);
  if (sErrors.length) console.log('  studio errors:', sErrors.join(' | '));

  await page.close();
  await sPage.close();
} finally {
  await browser.close();
}

console.log(failures ? `\nCREATOR<->ARCADE INTEGRATION SMOKE: ${failures} FAIL` : '\nCREATOR<->ARCADE INTEGRATION SMOKE: PASS');
process.exit(failures ? 1 : 0);
