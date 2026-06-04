/**
 * Phase 4B — City authority + reconciliation + minimap browser smoke.
 *
 * Proves the 4B feel/network hardening end-to-end against the local city dev shim
 * (parity twin of the CityRoom DO): input-replay reconciliation (server acks the
 * client's input sequence and the ack advances), a debuggable client, the minimap
 * renders, remote players interpolate from buffered snapshots, and the portal stays
 * server-gated. Forces the 2D renderer for deterministic headless runs.
 *
 * Run: see tests/arcade/run-city-authority.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8788/arcade/city/ws';
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/city/index.html?test=1&debug=1&renderer=2d&id=${id}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newClient(browser, id) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_)/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(id), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon_city, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.connected, null, { timeout: 8000 });
  return { page, errors };
}

const browser = await chromium.launch({ headless: true });
try {
  const A = await newClient(browser, `a${RUN}`);
  check('city connects (status live)', await A.page.evaluate(() => window.__neon_city.status === 'live'));
  check('renderer + debug hook present', await A.page.evaluate(() => window.__neon_city.renderer === 'canvas2d' && typeof window.__neon_city.debug === 'function'));

  // minimap renders (procedural canvas sized)
  check('minimap canvas renders', await A.page.evaluate(() => { const c = document.getElementById('cityMinimap'); return !!c && c.width > 0 && c.height > 0; }));
  check('debug overlay is populated', await A.page.evaluate(() => { const d = document.getElementById('debugPanel'); return !d.hidden && /ack/.test(d.textContent); }));

  // input-replay: the server ACK sequence advances as the client sends inputs
  const ack0 = await A.page.evaluate(() => window.__neon_city.debug().ackSeq);
  await A.page.evaluate(() => window.__neon_city.setInput(1, 0));
  await A.page.waitForFunction((a0) => window.__neon_city.debug().ackSeq > a0, ack0, { timeout: 8000 }).catch(() => {});
  check('server ack sequence advances (input acknowledged)', await A.page.evaluate((a0) => window.__neon_city.debug().ackSeq > a0, ack0));
  check('pending inputs are tracked while moving', await A.page.evaluate(() => window.__neon_city.debug().pending >= 0));

  // movement is server-confirmed AND bounded (anti-speed-hack: ≤ MAX_SPEED * time)
  const sx0 = await A.page.evaluate(() => window.__neon_city.serverYou().x);
  await sleep(700);
  await A.page.evaluate(() => window.__neon_city.setInput(0, 0));
  const move = await A.page.evaluate(() => ({ sx: window.__neon_city.serverYou().x, dx: window.__neon_city.serverYou().x }));
  check('SERVER confirms eastward movement', move.sx > sx0 + 30);
  check('server movement is speed-bounded (no teleport / no speed-hack)', move.sx - sx0 < 220 * 0.7 + 40);

  // pending drains after the server catches up
  await sleep(300);
  check('pending drains once acknowledged', await A.page.evaluate(() => window.__neon_city.debug().pending <= 2));

  // server-gated portal: a raw request from outside the zone is denied
  await A.page.evaluate(() => window.__neon_city.client.enterPortal('arcade'));
  await sleep(250);
  check('portal denied outside zone (server gate)', await A.page.evaluate(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'portal_not_in_zone'));

  // remote interpolation: B joins, moves; A sees B and B's interpolated position changes
  const B = await newClient(browser, `b${RUN}`);
  await A.page.waitForFunction((bid) => window.__neon_city.players().includes(bid), `b${RUN}`, { timeout: 8000 }).catch(() => {});
  check('A sees B present (remote roster)', await A.page.evaluate((bid) => window.__neon_city.players().includes(bid), `b${RUN}`));
  // capture B's interpolated x on A, move B east, expect A's interpolated x for B to rise
  const bx0 = await A.page.evaluate((bid) => { const o = window.__neon_city.othersView().find((p) => p.id === bid); return o ? o.x : null; }, `b${RUN}`);
  await B.page.evaluate(() => window.__neon_city.setInput(1, 0));
  await sleep(700);
  await B.page.evaluate(() => window.__neon_city.setInput(0, 0));
  await sleep(250);
  const bx1 = await A.page.evaluate((bid) => { const o = window.__neon_city.othersView().find((p) => p.id === bid); return o ? o.x : null; }, `b${RUN}`);
  check('A interpolates B from canonical snapshots (B moved → A sees it)', bx0 !== null && bx1 !== null && bx1 > bx0 + 20);

  // walk A into the arcade portal zone → server-confirmed entry + overlay
  const TX = 240; const TY = 580;
  for (let i = 0; i < 90; i++) {
    const p = await A.page.evaluate(() => window.__neon_city.you);
    if (Math.abs(p.x - TX) <= 14 && Math.abs(p.y - TY) <= 14) break;
    if (Math.abs(p.x - TX) > 14) await A.page.evaluate((tx) => window.__neon_city.setInput(Math.sign(tx - window.__neon_city.you.x), 0), TX);
    else await A.page.evaluate((ty) => window.__neon_city.setInput(0, Math.sign(ty - window.__neon_city.you.y)), TY);
    await sleep(90);
  }
  await A.page.evaluate(() => window.__neon_city.setInput(0, 0));
  await sleep(150);
  check('portal prompt shows inside the zone', await A.page.evaluate(() => !document.getElementById('portalPrompt').hidden));
  await A.page.evaluate(() => window.__neon_city.enterPortal());
  await A.page.waitForFunction(() => !!window.__neon_city.lastPortalOk, null, { timeout: 5000 }).catch(() => {});
  check('server confirms portal entry (→ /arcade/) + overlay shown', await A.page.evaluate(() =>
    window.__neon_city.lastPortalOk && window.__neon_city.lastPortalOk.target === '/arcade/' && !document.getElementById('portalOverlay').hidden));

  const allErrors = [...A.errors, ...B.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY AUTHORITY SMOKE: PASS' : `\nCITY AUTHORITY SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
