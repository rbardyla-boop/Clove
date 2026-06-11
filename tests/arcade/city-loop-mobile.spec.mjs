/**
 * Cabinet-loop polish — MOBILE city loop smoke (walk → see → enter → play → return → re-enter).
 *
 * Proves on a 360×640 phone context against the city dev shim: the portal prompt carries the
 * block's arcade house name; entering opens the branded interior (idempotent); the return
 * button is thumb-sized (≥44px); browser BACK closes the interior (phone back gesture); the
 * return paints a transient arrival cue; re-entry works; no economy vocabulary on the seam;
 * zero web storage; no horizontal overflow; no console errors.
 * Run: tests/arcade/run-city-loop-mobile.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
import { arcadeName } from '../../arcade/city/city-arcade-identity.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8788/arcade/city/ws';
const RUN = Date.now().toString(36);
const SEAM_FORBIDDEN = /\$|\bcash\b|\bpayout\b|\bbuy\b|\bsell\b|\bown(er)?\b|\bprice\b|\bmarket\b|\bearn\b|\btoken\b|\bjackpot\b|\bwager\b/i;

let failures = 0;
const check = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${d && !c ? ` — ${d}` : ''}`); if (!c) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Walk into the portal zone deterministically, then request entry (same recipe as the mood smoke). */
async function enterArcade(page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 240 && !window.__neon_city.interiorOpen; i++) {
      const me = window.__neon_city.you; const L = window.__neon_city.layout();
      const p = (L.portals && L.portals[0]) || L.portal; if (!me || !p) break;
      const px = p.x ?? (p.zone && p.zone.x); const py = p.y ?? (p.zone && p.zone.y);
      window.__neon_city.setInput(Math.sign(px - me.x), Math.sign(py - me.y));
      window.__neon_city.enterPortal();
      await new Promise((r) => setTimeout(r, 50));
    }
    window.__neon_city.setInput(0, 0);
  });
}

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(`${BASE}/arcade/city/index.html?test=1&renderer=2d&id=lm${RUN}&ws=${encodeURIComponent(WS)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__neon_city && window.__neon_city.connected, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.district() !== null, null, { timeout: 6000 });
  const HOUSE = arcadeName('downtown-01');

  // ── walk → see: the prompt names THIS block's arcade house ─────────────────
  await page.evaluate(async () => {
    // walk to the ZONE CENTER and stop only when the prompt is actually showing — corner
    // proximity is not zone membership (the zone is x/y/w/h with x/y at the corner).
    for (let i = 0; i < 240 && document.getElementById('portalPrompt').hidden; i++) {
      const me = window.__neon_city.you; const L = window.__neon_city.layout();
      const p = (L.portals && L.portals[0]) || L.portal; if (!me || !p) break;
      const cx = (p.x ?? (p.zone && p.zone.x)) + ((p.w ?? (p.zone && p.zone.w)) || 0) / 2;
      const cy = (p.y ?? (p.zone && p.zone.y)) + ((p.h ?? (p.zone && p.zone.h)) || 0) / 2;
      window.__neon_city.setInput(Math.sign(cx - me.x), Math.sign(cy - me.y));
      await new Promise((r) => setTimeout(r, 50));
    }
    window.__neon_city.setInput(0, 0);
  });
  await page.waitForFunction(() => !document.getElementById('portalPrompt').hidden, null, { timeout: 8000 }).catch(() => {});
  check('walk → see: portal prompt names the block arcade house', await page.evaluate((h) => {
    const pp = document.getElementById('portalPrompt');
    return !pp.hidden && pp.querySelector('.pp-name').textContent === h;
  }, HOUSE));

  // ── enter: branded interior opens (server-gated) ───────────────────────────
  await enterArcade(page);
  await page.waitForFunction(() => window.__neon_city.interiorOpen === true, null, { timeout: 8000 });
  check('enter: interior opens with the block-branded house name', await page.evaluate((h) => {
    return !document.getElementById('portalOverlay').hidden
      && document.getElementById('interiorName').textContent === h.toUpperCase();
  }, HOUSE));
  check('return button is thumb-sized (≥44px) and reachable', await page.evaluate(() => {
    const r = document.getElementById('interiorClose').getBoundingClientRect();
    return r.height >= 44 && r.width >= 44 && r.top >= 0 && r.right <= window.innerWidth;
  }));
  check('no economy vocabulary on the interior seam', await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i');
    return !re.test(document.querySelector('.interior-bar').textContent);
  }, SEAM_FORBIDDEN.source));

  // ── return via the phone BACK gesture (popstate), arrival cue paints ───────
  await page.goBack();
  await page.waitForFunction(() => window.__neon_city.interiorOpen === false, null, { timeout: 6000 });
  check('phone back gesture closes the interior (history-integrated)', await page.evaluate(() =>
    document.getElementById('portalOverlay').hidden === true));
  check('arrival cue paints in the district panel (transient, display-only)', await page.evaluate(() =>
    /back on the .+ corner/.test(document.getElementById('cityDistrict').textContent)));
  await sleep(1800);
  check('arrival cue clears on its own', await page.evaluate(() =>
    !/back on the .+ corner/.test(document.getElementById('cityDistrict').textContent)));
  check('page did not navigate away on back (the entry was ours)', /arcade\/city/.test(page.url()));

  // ── re-enter: the loop repeats cleanly ─────────────────────────────────────
  await enterArcade(page);
  await page.waitForFunction(() => window.__neon_city.interiorOpen === true, null, { timeout: 8000 });
  check('re-enter: loop repeats (interior opens again)', true);
  // close via the button this time (the other exit path) — history entry is consumed, no nav away
  await page.click('#interiorClose');
  await page.waitForFunction(() => window.__neon_city.interiorOpen === false, null, { timeout: 6000 });
  await sleep(150);
  check('button return also closes + stays on the city page', /arcade\/city/.test(page.url()));

  // ── baselines ──────────────────────────────────────────────────────────────
  check('no horizontal overflow at 360px through the whole loop', await page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  check('zero web-storage keys through the whole loop', await page.evaluate(() =>
    localStorage.length === 0 && sessionStorage.length === 0));
  check('no console / page errors', errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  await ctx.close();
} finally {
  await browser.close();
}
console.log(failures === 0 ? 'CITY LOOP MOBILE SMOKE: PASS' : `CITY LOOP MOBILE SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
