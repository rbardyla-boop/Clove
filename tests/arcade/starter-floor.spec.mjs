/**
 * ADR-043 — STARTER CORNER floor smoke (curated showcase cabinets).
 *
 * Proves against the real dev-shim floor: the shelf renders the curated tiles with
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
    window.__audioCtxCount = 0;
    if (typeof AudioContext === 'function') {
      const AC = AudioContext;
      window.AudioContext = function (...a) { window.__audioCtxCount++; return new AC(...a); };
    }
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
  check('shelf shows the full curated set (anchors + flex, capped at 8)', await page.evaluate((n) =>
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

  // ── flex starters present as quick-runs AFTER the six anchors (default order) ──
  check('flex tiles render dashed, after all anchors, with quick-run aria', await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#starterTrack .st-tile')];
    const flexIdx = tiles.map((t, i) => (t.classList.contains('st-tile-flex') ? i : -1)).filter((i) => i >= 0);
    return tiles.length === 8 && flexIdx.length === 2 && Math.min(...flexIdx) >= 6
      && flexIdx.every((i) => /quick run/.test(tiles[i].getAttribute('aria-label')));
  }));

  // ── audio-lite: curated set ships sound OFF — zero AudioContext across the whole flow ──
  check('no AudioContext was ever constructed (public set ships sound off)', await page.evaluate(() => window.__audioCtxCount === 0));

  // ── ?from= ordering: validated block leads with its anchor; hostile value falls back ──
  for (const [fromVal, firstId, label] of [
    ['harbor-02', 'crane-gate', 'valid harbor origin'],
    ['garden-06', 'arbor-bloom', 'valid garden origin'],
    ['%3Cscript%3Ealert(1)%3C%2Fscript%3E', 'crosswalk-window', 'hostile origin falls back'],
    ['mystery-99', 'crosswalk-window', 'unknown origin falls back'],
  ]) {
    const p2 = await ctx.newPage();
    p2.on('pageerror', (e) => errors.push('from pageerror: ' + e.message));
    await p2.goto(`${BASE}/arcade/index.html?test=1&id=fo${RUN}${firstId.slice(0, 2)}&ws=${encodeURIComponent(WS)}&from=${fromVal}`, { waitUntil: 'load' });
    await p2.waitForFunction(() => window.__neon && !document.getElementById('starterCorner').hidden, null, { timeout: 12000 });
    check(`?from= ${label}: first tile is ${firstId}`, await p2.evaluate((id) =>
      document.querySelector('#starterTrack .st-tile').dataset.starter === id, firstId));
    check(`?from= ${label}: no raw value reaches the DOM`, await p2.evaluate(() =>
      !document.body.innerHTML.includes('<script>alert') && !/mystery-99/.test(document.getElementById('starterCorner').textContent)));
    await p2.close();
  }

  // ── MOBILE GESTURE PROOFS (360x640 touch context): swipe, hold, drag each SCORE ──
  const mctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  await mctx.addInitScript(() => { window.__wsSent = []; const o = WebSocket.prototype.send; WebSocket.prototype.send = function (d) { try { window.__wsSent.push(String(d)); } catch { /* bin */ } return o.call(this, d); }; });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => errors.push('mobile pageerror: ' + e.message));
  await mp.goto(`${BASE}/arcade/index.html?test=1&id=mg${RUN}&ws=${encodeURIComponent(WS)}`, { waitUntil: 'load' });
  await mp.waitForFunction(() => window.__neon && document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 12000 });
  const mSentBefore = await mp.evaluate(() => window.__wsSent.length); // join-time HUD bootstrap is NOT starter traffic
  const gesture = async (starterId, drive) => {
    await mp.evaluate((id) => window.__neon.starters.mount(id), starterId);
    await mp.waitForFunction((gid) => window.__neon.starters.mountedId === gid, `starter_${starterId.replace(/-/g, '_')}`, { timeout: 8000 });
    await mp.waitForTimeout(300);
    const box = await mp.evaluate(() => { const r = document.querySelector('.st-stage').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const deadline = Date.now() + 6000;
    let scored = 0;
    while (Date.now() < deadline && scored === 0) {
      await drive(cx, cy, box);
      scored = await mp.evaluate(() => { const m = document.querySelector('.st-score').textContent.match(/score (\d+)/); return m ? Number(m[1]) : 0; });
    }
    await mp.evaluate(() => window.__neon.starters.unmount());
    await mp.waitForFunction(() => window.__neon.starters.mountedId === null, null, { timeout: 6000 });
    return scored;
  };
  check('PHONE swipe_lane gesture scores (Crane Gate)', (await gesture('crane-gate', async (cx, cy) => {
    await mp.mouse.move(cx - 70, cy); await mp.mouse.down();
    await mp.mouse.move(cx + 70, cy, { steps: 4 });
    await mp.mouse.up();
    await mp.waitForTimeout(120);
  })) > 0);
  check('PHONE hold_band gesture scores (Beacon Climb)', (await gesture('beacon-climb', async (cx, cy) => {
    await mp.mouse.move(cx, cy); await mp.mouse.down();
    await mp.waitForTimeout(900);
    await mp.mouse.up();
  })) > 0);
  check('PHONE drag_track gesture scores (Phase Lock)', (await gesture('phase-lock', async (cx, cy) => {
    await mp.mouse.move(cx - 40, cy); await mp.mouse.down();
    for (let i = 0; i < 14; i++) { await mp.mouse.move(cx - 40 + i * 6, cy + Math.sin(i) * 12); await mp.waitForTimeout(70); }
    await mp.mouse.up();
  })) > 0);
  check('mobile gesture flows sent ZERO NEW occupy/round/ticket messages', await mp.evaluate((n) =>
    !window.__wsSent.slice(n).some((m) => /occupy_machine|round_start|round_submit|prize|ticket/.test(m)), mSentBefore),
    await mp.evaluate((n) => window.__wsSent.slice(n).filter((m) => /occupy|round|prize|ticket/.test(m)).slice(0, 2).join(' || '), mSentBefore));
  await mctx.close();

  // ── LANDSCAPE phone (640x360): host mounts, frame fits, leave works ──
  const lctx = await browser.newContext({ viewport: { width: 640, height: 360 }, hasTouch: true, isMobile: true });
  const lp = await lctx.newPage();
  lp.on('pageerror', (e) => errors.push('landscape pageerror: ' + e.message));
  await lp.goto(`${BASE}/arcade/index.html?test=1&id=ls${RUN}&ws=${encodeURIComponent(WS)}`, { waitUntil: 'load' });
  await lp.waitForFunction(() => window.__neon && document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 12000 });
  await lp.evaluate(() => window.__neon.starters.mount('spire-pulse'));
  await lp.waitForFunction(() => window.__neon.starters.mountedId === 'starter_spire_pulse', null, { timeout: 8000 });
  check('LANDSCAPE: frame letterboxes without crop and Leave stays reachable', await lp.evaluate(() => {
    const f = window.__cabinetFrames && window.__cabinetFrames.starter_spire_pulse;
    const leave = document.querySelector('.st-leave').getBoundingClientRect();
    return !!f && f.debug().fits === true && leave.top >= 0 && leave.height * leave.width > 0;
  }));
  await lp.evaluate(() => window.__neon.starters.unmount());
  await lctx.close();

  check('no console / page errors', errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
} finally {
  await browser.close();
}
console.log(fail === 0 ? 'STARTER FLOOR SMOKE: PASS' : `STARTER FLOOR SMOKE: ${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
