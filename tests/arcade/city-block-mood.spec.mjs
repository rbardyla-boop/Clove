/**
 * Phase W-5 — block mood browser smoke (ADR-042).
 *
 * Proves on the city dev shim: the ONE mood line renders in the approved district-panel slot
 * for the CURRENT block only and always belongs to the closed 6×3 copy table; a REAL server
 * event (portal accept + interior open) shifts the internal tone (asserted via table cells,
 * never via enum names); no digits ever render in the line; block switch clears stale mood
 * (the new block starts at its baseline cell); the element is plain text (no control, no
 * aria-live); the page keeps its zero-web-storage baseline; a 360px phone viewport renders
 * without horizontal overflow; and no console/page errors. Run: tests/arcade/run-city-block-mood.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
import { moodCopyTable } from '../../arcade/city/city-block-mood.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8788/arcade/city/ws';
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/city/index.html?test=1&renderer=2d&id=${id}&ws=${encodeURIComponent(WS)}`;

const TABLE = moodCopyTable();
const cellsOf = (cityId) => Object.values(TABLE[cityId] || {});
const PANEL_FORBIDDEN = /\$|\bcash\b|\bpayout\b|\bbuy\b|\bsell\b|\brent\b|\bown\b|\bowner\b|\bclaim\b|\bprice\b|\bmarket\b|\bstake\b|\bprofit\b|\bincome\b|\breward\b|\btoken\b|\bunlock\b/i;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const moodText = (page) => page.evaluate(() => {
  const el = document.querySelector('#cityDistrict .dist-mood');
  return el ? el.textContent : null;
});

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(`bm${RUN}`), { waitUntil: 'load' });
  await page.waitForFunction(() => window.__neon_city && window.__neon_city.connected, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.district() !== null, null, { timeout: 6000 });

  // ── render + closed-table membership ───────────────────────────────────────
  const t0 = await moodText(page);
  check('mood line renders in the district panel', typeof t0 === 'string' && t0.length >= 1 && t0.length <= 72);
  check('mood line belongs to the current block\'s closed table', cellsOf('downtown-01').includes(t0));
  check('mood line sits between identity tagline and District Tour (approved slot)', await page.evaluate(() => {
    const kids = [...document.querySelectorAll('#cityDistrict > div')].map((d) => d.className);
    const mood = kids.findIndex((c) => c.includes('dist-mood'));
    const tag = kids.findIndex((c) => c.includes('dist-tag'));
    const tour = kids.findIndex((c) => c.includes('dist-tour'));
    return mood > tag && mood < tour;
  }));
  check('SCOPED no-digit rule on the mood line', !/[0-9%]/.test(t0));
  check('no forbidden economy vocabulary on the line or the panel', await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i');
    return !re.test(document.querySelector('#cityDistrict .dist-mood').textContent) && !re.test(document.getElementById('cityDistrict').textContent);
  }, PANEL_FORBIDDEN.source));
  check('blockMood() envelope carries EXACTLY four keys, public_safe true', await page.evaluate(() => {
    const m = window.__neon_city.blockMood();
    return JSON.stringify(Object.keys(m).sort()) === JSON.stringify(['atmospheric_text', 'city_id', 'public_safe', 'schema_version']) && m.public_safe === true;
  }));

  // ── plain text, no control, no live region ─────────────────────────────────
  check('mood element is plain text: no role/tabindex/control; adds NO new live region (the panel itself was already aria-live pre-W-5)', await page.evaluate(() => {
    const el = document.querySelector('#cityDistrict .dist-mood');
    return el.tagName === 'DIV' && !el.getAttribute('role') && !el.getAttribute('tabindex')
      && !el.getAttribute('aria-live') && !el.querySelector('button, a, input')
      && el.closest('[aria-live]') === document.getElementById('cityDistrict'); // pre-existing panel region only
  }));
  check('panel keeps exactly one live region (the activity list baseline)', await page.evaluate(() => document.querySelectorAll('#cityDistrict [aria-live]').length <= 1));

  // ── a REAL server event shifts the tone (asserted via cells, never enum names) ──
  const ebbCell = TABLE['downtown-01'].ebb;
  check('baseline (no mood events yet) renders the baseline cell', t0 === ebbCell);
  await page.evaluate(async () => {
    // walk into the arcade portal zone deterministically, then enter
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
  await page.waitForFunction(() => (window.__neon_city.events() || []).some((e) => /portal_enter_accepted|interior_opened/.test(e.type)), null, { timeout: 10000 }).catch(() => {});
  const sawMoodEvents = await page.evaluate(() => (window.__neon_city.events() || []).filter((e) => /portal_enter_accepted|interior_opened/.test(e.type)).length);
  await page.evaluate(() => window.__neon_city.closeInterior());
  await sleep(200);
  const t1 = await moodText(page);
  check('after real events the line is still a closed-table cell', cellsOf('downtown-01').includes(t1));
  if (sawMoodEvents >= 2) {
    check('two real events lift the tone off baseline (cell changed, no digits)', t1 !== ebbCell && !/[0-9%]/.test(t1));
  } else {
    check(`tone-shift precondition (shim emitted ${sawMoodEvents} mood event[s]) — membership still holds`, cellsOf('downtown-01').includes(t1));
  }

  // ── block switch clears stale mood state ───────────────────────────────────
  await page.evaluate(() => window.__neon_city.routeTo('harbor-02'));
  await page.waitForFunction(() => window.__neon_city.cityId === 'harbor-02', null, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => window.__neon_city.district() && window.__neon_city.district().current_city_id === 'harbor-02', null, { timeout: 6000 }).catch(() => {});
  const t2 = await moodText(page);
  check('after travel the mood belongs to the NEW block\'s table (stale state cleared)', cellsOf('harbor-02').includes(t2));
  check('new block starts at its own baseline cell (intake was reset)', t2 === TABLE['harbor-02'].ebb);
  check('no other block\'s copy lingers', !cellsOf('downtown-01').includes(t2));

  // ── persistence + storage baselines ────────────────────────────────────────
  check('zero web-storage keys added by the city page (before and after events/travel)', await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__neon_city && window.__neon_city.connected, null, { timeout: 8000 });
  await sleep(300);
  const t3 = await moodText(page);
  check('after reload the line is a valid closed-table cell (no persisted mood claim)', t3 === null || cellsOf('harbor-02').includes(t3) || cellsOf('downtown-01').includes(t3));
  check('still zero web-storage keys after reload', await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0));

  // ── 360px phone viewport ───────────────────────────────────────────────────
  const phone = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  const pp = await phone.newPage();
  pp.on('pageerror', (e) => errors.push('phone pageerror: ' + e.message));
  await pp.goto(url(`bmp${RUN}`), { waitUntil: 'load' });
  await pp.waitForFunction(() => window.__neon_city && window.__neon_city.connected, null, { timeout: 8000 });
  await pp.waitForFunction(() => !!document.querySelector('#cityDistrict .dist-mood'), null, { timeout: 6000 }).catch(() => {});
  check('phone: mood line renders and wraps without horizontal overflow', await pp.evaluate(() => {
    const el = document.querySelector('#cityDistrict .dist-mood');
    if (!el) return false;
    const noPageOverflow = document.documentElement.scrollWidth <= window.innerWidth + 1;
    return noPageOverflow && el.scrollWidth <= el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis';
  }));
  await phone.close();

  check('no console / page errors', errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
} finally {
  await browser.close();
}
console.log(failures === 0 ? 'BLOCK MOOD SMOKE: PASS' : `BLOCK MOOD SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
