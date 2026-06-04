/**
 * Phase 4A — City Block browser smoke.
 *
 * Proves the playable slice end-to-end against the local city dev shim (the parity
 * twin of the CityRoom DO): the page loads with no console errors, the player
 * renders, INPUT INTENT moves the avatar AND the SERVER snapshot confirms a clamped
 * (non-teleport) position, the authority status reads "live", and the server-gated
 * arcade portal only fires from inside its zone. A second client verifies presence.
 *
 * Forces the 2D renderer (?renderer=2d) for deterministic headless runs (headless
 * WebGL is flaky); the Three.js path is exercised in real browsers.
 *
 * Run: see tests/arcade/run-city-block.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8788/arcade/city/ws';
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/city/index.html?test=1&renderer=2d&id=${id}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newClient(browser, id) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const isExternalNoise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t)
    || /net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_)/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isExternalNoise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(id), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon_city, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.connected, null, { timeout: 8000 });
  return { page, errors };
}

const browser = await chromium.launch({ headless: true });
try {
  const A = await newClient(browser, `a${RUN}`);
  check('city page connects to the authority (status live)', await A.page.evaluate(() => window.__neon_city.status === 'live'));
  // (#statusTxt is CSS-uppercased, so read textContent, not the rendered innerText)
  check('authority status pill shows live', (await A.page.locator('#statusTxt').textContent()).trim().toLowerCase() === 'live');

  // player renders + a renderer is reported
  check('player avatar exists (server-confirmed identity)', await A.page.evaluate(() => !!window.__neon_city.you && !!window.__neon_city.serverYou()));
  check('renderer is reported (2d forced for headless)', await A.page.evaluate(() => window.__neon_city.renderer === 'canvas2d'));
  check('canvas is present and sized', await A.page.evaluate(() => { const c = document.getElementById('cityCanvas'); return !!c && c.width > 0 && c.height > 0; }));

  // movement: input intent moves the avatar AND the server confirms a clamped position.
  // Hold a fixed window so both predicted + server advance well past the margin.
  const start = await A.page.evaluate(() => ({ ...window.__neon_city.you, sx: window.__neon_city.serverYou().x }));
  await A.page.evaluate(() => window.__neon_city.setInput(1, 0)); // hold "east"
  await sleep(700);
  const moved = await A.page.evaluate(() => ({ x: window.__neon_city.you.x, sx: window.__neon_city.serverYou().x }));
  await A.page.evaluate(() => window.__neon_city.setInput(0, 0));
  check('client prediction moved the avatar east', moved.x > start.x + 30);
  check('SERVER snapshot confirms the move (server owns truth)', moved.sx > start.sx + 30);
  check('movement is clamped, never teleported off-map', moved.sx < 1000 && moved.x < 1000);

  // the server snapshot is the source of truth (snapshots arriving)
  check('server snapshots are arriving', await A.page.evaluate(() => window.__neon_city.lastSnapshotAt > 0));

  // server-gated portal: a raw request from OUTSIDE any zone is denied by the server.
  // (The UI guards this, so we drive the net client directly to exercise the gate.)
  await A.page.evaluate(() => window.__neon_city.client.enterPortal('arcade'));
  await sleep(300);
  check('portal entry is denied away from the zone (server gate)',
    await A.page.evaluate(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'portal_not_in_zone')
    && await A.page.evaluate(() => window.__neon_city.lastPortalOk === null));

  // walk to the arcade portal (axis-priority seek: west along the open road, then south)
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
  check('avatar reached the arcade portal zone (prompt shown)', await A.page.evaluate(() => !document.getElementById('portalPrompt').hidden));
  await A.page.evaluate(() => window.__neon_city.enterPortal());
  await A.page.waitForFunction(() => !!window.__neon_city.lastPortalOk, null, { timeout: 5000 }).catch(() => {});
  check('server validates portal entry from inside the zone (→ /arcade/)',
    await A.page.evaluate(() => window.__neon_city.lastPortalOk && window.__neon_city.lastPortalOk.target === '/arcade/'));

  // presence: a second client appears in A's roster, and leaving removes it
  const B = await newClient(browser, `b${RUN}`);
  await A.page.waitForFunction((bid) => window.__neon_city.players().includes(bid), `b${RUN}`, { timeout: 8000 }).catch(() => {});
  check('client A sees client B join the block', await A.page.evaluate((bid) => window.__neon_city.players().includes(bid), `b${RUN}`));
  await B.page.close();
  await A.page.waitForFunction((bid) => !window.__neon_city.players().includes(bid), `b${RUN}`, { timeout: 8000 }).catch(() => {});
  check('client A sees client B leave the block', await A.page.evaluate((bid) => !window.__neon_city.players().includes(bid), `b${RUN}`));

  const allErrors = [...A.errors, ...B.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY BLOCK SMOKE: PASS' : `\nCITY BLOCK SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
