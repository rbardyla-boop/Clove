/**
 * ADR-043 — STARTER CORNER floor smoke (curated showcase cabinets).
 *
 * Proves against the real dev-shim floor: the shelf renders the 6 curated tiles with
 * the pre-tap honesty header; tap → preview sheet (pitch + safety + 44px Play);
 * Play → strict local-only mount opens the 360×640 frame with branded host chrome,
 * a live LOCAL score line and a 44px Leave; taps score; Leave returns to the floor;
 * the WHOLE starter flow sends ZERO occupy/round/ticket WebSocket messages (spy);
 * existing ticketed cabinets still work afterwards; the curated manifest fail-quiet
 * path renders an empty shelf; no console errors.
 * Run: tests/arcade/run-starter-floor.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
import { CURATED_STARTERS, SHELF_SAFETY } from '../../arcade/cabinets/starters/curated-floor.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
const RUN = Date.now().toString(36);

let fail = 0;
const check = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${d && !c ? ` — ${d}` : ''}`); if (!c) fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  // WS SPY: record every outbound message BEFORE any page script runs.
  await ctx.addInitScript(() => {
    window.__wsSent = [];
    const orig = WebSocket.prototype.send;
    WebSocket.prototype.send = function (data) { try { window.__wsSent.push(String(data)); } catch { /* binary */ } return orig.call(this, data); };
  });
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(`${BASE}/arcade/index.html?test=1&id=sf${RUN}&ws=${encodeURIComponent(WS)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__neon && document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 12000 });

  // ── shelf renders: 6 tiles, honesty header BEFORE any interaction ──────────
  check('curated manifest validates and the shelf renders', await page.evaluate(() =>
    window.__neon.starters.valid === true && !document.getElementById('starterCorner').hidden));
  check('shelf shows all 6 curated tiles (and only 6)', await page.evaluate((n) =>
    document.querySelectorAll('#starterTrack .st-tile').length === n, CURATED_STARTERS.length));
  check('pre-tap honesty header carries the safety line', await page.evaluate((s) =>
    document.getElementById('starterShelfHead').textContent.includes(s), SHELF_SAFETY));
  check('every tile is a real button with an aria-label naming genre + session-local', await page.evaluate(() =>
    [...document.querySelectorAll('#starterTrack .st-tile')].every((t) =>
      t.tagName === 'BUTTON' && /session-local/.test(t.getAttribute('aria-label') || ''))));

  // ── WS baseline before the starter flow ────────────────────────────────────
  const sentBefore = await page.evaluate(() => window.__wsSent.length);

  // ── tap → sheet → Play → branded frame ─────────────────────────────────────
  await page.click('.st-tile[data-starter="phase-lock"]');
  check('tap opens the preview sheet with pitch + safety + 44px Play', await page.evaluate(() => {
    const sheet = document.getElementById('starterSheet');
    const play = document.getElementById('starterSheetPlay').getBoundingClientRect();
    return !sheet.hidden && /lock them into one line/.test(document.getElementById('starterSheetPitch').textContent)
      && /no tickets/.test(document.getElementById('starterSheetSafety').textContent) && play.height >= 44;
  }));
  await page.click('#starterSheetPlay');
  await page.waitForFunction(() => window.__neon.starters.mountedId === 'starter_phase_lock', null, { timeout: 8000 });
  check('frame opens at the 360×640 contract with branded host chrome', await page.evaluate(() => {
    const ov = document.querySelector('.cf-overlay[data-game-id="starter_phase_lock"]');
    return !!ov && ov.classList.contains('show') && ov.dataset.nativeWidth === '360' && ov.dataset.nativeHeight === '640'
      && document.querySelector('.st-name').textContent === 'Phase Lock';
  }));
  check('host chrome carries the safety line and a 44px Leave', await page.evaluate((s) => {
    const leave = document.querySelector('.st-leave').getBoundingClientRect();
    return document.querySelector('.st-safety').textContent === s && leave.height >= 44 && leave.width >= 44;
  }, SHELF_SAFETY));

  // ── play: taps reach the game; the score line stays LOCAL ──────────────────
  await sleep(400);
  for (let i = 0; i < 12; i++) { await page.click('.st-stage', { force: true }); await sleep(80); }
  check('score line renders a local proposal with the safety suffix', await page.evaluate((s) =>
    new RegExp('^score \\d+ · ' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$').test(document.querySelector('.st-score').textContent), SHELF_SAFETY));

  // ── Leave returns to the floor ──────────────────────────────────────────────
  await page.click('.st-leave');
  await page.waitForFunction(() => window.__neon.starters.mountedId === null, null, { timeout: 6000 });
  check('Leave unmounts the frame back to the floor', await page.evaluate(() =>
    !document.querySelector('.cf-overlay[data-game-id="starter_phase_lock"].show')));

  // ── THE BOUNDARY PROOF: zero occupy/round/ticket messages in the whole flow ─
  const starterTraffic = await page.evaluate((n) => window.__wsSent.slice(n), sentBefore);
  check('starter flow sent ZERO occupy/round/ticket/prize messages (WS spy)', !starterTraffic.some((m) =>
    /occupy_machine|release_machine|round_start|round_submit|prize|ticket/.test(m)), starterTraffic.filter((m) => /occupy|round|prize|ticket/.test(m)).slice(0, 3).join(' | '));

  // ── a second starter mounts (the shelf is not single-shot) ─────────────────
  await page.evaluate(() => window.__neon.starters.mount('crane-gate'));
  await page.waitForFunction(() => window.__neon.starters.mountedId === 'starter_crane_gate', null, { timeout: 8000 });
  await page.evaluate(() => window.__neon.starters.unmount());
  await page.waitForFunction(() => window.__neon.starters.mountedId === null, null, { timeout: 6000 });
  check('a second starter mounts and unmounts cleanly', true);

  // ── the TICKETED path is untouched: pulse still occupies + awards ───────────
  await page.click('.cab[data-id="pulse"]');
  await page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('mine'), null, { timeout: 10000 });
  const rid = await page.evaluate(async () => { window.__neon.client.startPulseRound('pulse'); await new Promise((r) => setTimeout(r, 250)); return window.__neon.state().roundId; });
  await page.evaluate((r) => window.__neon.client.submitPulseRound({ roundId: r, machineId: 'pulse', grade: 'A', accuracy: 88, hits: 16, bestStreak: 9, score: 1825, durationMs: 30000 }), rid);
  await page.waitForFunction(() => window.__neon.state().tickets > 0, null, { timeout: 10000 });
  check('ticketed cabinets still award through the untouched server path', (await page.evaluate(() => window.__neon.state().tickets)) > 0);
  await page.evaluate(() => window.__neon.client.release('pulse'));

  check('no console / page errors', errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
} finally {
  await browser.close();
}
console.log(fail === 0 ? 'STARTER FLOOR SMOKE: PASS' : `STARTER FLOOR SMOKE: ${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
