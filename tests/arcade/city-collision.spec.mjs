/**
 * Phase 7B — city walkable-boundary browser smoke.
 *
 * Proves end-to-end, in a real (headless) browser against the city dev shim:
 *   1. the player cannot walk outside the block bounds (server-confirmed clamp);
 *   2. the kernel boundary model (city-collision.mjs) loads + runs in the browser and
 *      rejects a blocked-zone fixture / clamps out of it / finds nearest-safe;
 *   3. the arcade portal stays server-gated (arcade entry path intact);
 *   4. a phone viewport stays usable with no console/page errors.
 *
 * Run: tests/arcade/run-city-collision.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8082';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8790/arcade/city/ws';
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/city/index.html?test=1&debug=1&renderer=2d&id=${id}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // phone viewport
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_)/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(url(`c${RUN}`), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon_city, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.connected, null, { timeout: 8000 });
  check('city connects (status live)', await page.evaluate(() => window.__neon_city.status === 'live'));

  // ── 1. server-confirmed walkable bounds: drive EAST hard, the server clamps inside world ──
  await page.evaluate(() => window.__neon_city.setInput(1, 0));
  await sleep(2500); // long enough to reach the east wall along the open y~500 corridor
  await page.evaluate(() => window.__neon_city.setInput(0, 0));
  await sleep(200);
  const you = await page.evaluate(() => window.__neon_city.serverYou());
  check('server position stays inside world bounds (east clamp)', you.x > 0 && you.x < 1000 - 12 + 0.6);
  check('server position y stays inside world bounds', you.y > 0 && you.y < 1000 - 12 + 0.6);

  // ── 2. kernel boundary model runs IN-BROWSER (import the real module) ──
  await page.addScriptTag({
    type: 'module',
    content: `import * as C from '/arcade/city/city-collision.mjs';
      const FIX=[{id:'closed-lot',x:460,y:460,w:80,h:80,label:'CLOSED'}];
      window.__cc = {
        liveZonesEmpty: Object.keys(C.BLOCKED_ZONES).length === 0,
        centerWalkable: C.isPointWalkable(500,500,'downtown-01'),
        buildingBlocked: C.isPointWalkable(200,200,'downtown-01') === false,
        zoneBlocked: C.isPointWalkable(500,500,FIX) === false,
        clampSafe: (() => { const o=C.clampToWalkable({x:500,y:430},{x:500,y:500},FIX); return C.isPointWalkable(o.x,o.y,FIX); })(),
        nearestSafe: (() => { const o=C.nearestSafePoint(500,500,FIX); return C.isPointWalkable(o.x,o.y,FIX); })(),
        segCross: C.segmentIntersectsBlocked({x:400,y:500},{x:600,y:500},FIX) === true,
        segClear: C.segmentIntersectsBlocked({x:400,y:100},{x:600,y:100},FIX) === false,
        downtownArrival: (() => { const a=C.safeArrivalPoint('downtown-01'); return C.isPointWalkable(a.x,a.y,'downtown-01'); })(),
        foundryArrival: (() => { const a=C.safeArrivalPoint('foundry-04'); return C.isPointWalkable(a.x,a.y,'foundry-04'); })(),
      };`,
  });
  await page.waitForFunction(() => !!window.__cc, null, { timeout: 5000 });
  const cc = await page.evaluate(() => window.__cc);
  check('live BLOCKED_ZONES empty (model-ready)', cc.liveZonesEmpty);
  check('kernel: center is walkable', cc.centerWalkable);
  check('kernel: building point not walkable', cc.buildingBlocked);
  check('kernel: blocked-zone point rejected (fixture)', cc.zoneBlocked);
  check('kernel: clampToWalkable escapes a blocked zone', cc.clampSafe);
  check('kernel: nearestSafePoint is walkable', cc.nearestSafe);
  check('kernel: segmentIntersectsBlocked detects crossing', cc.segCross);
  check('kernel: segment not crossing is clear', cc.segClear);
  check('kernel: downtown arrival walkable', cc.downtownArrival);
  check('kernel: foundry-04 arrival walkable', cc.foundryArrival);

  // ── 3. arcade portal stays server-gated (entry path intact) ──
  await page.evaluate(() => window.__neon_city.client.enterPortal('arcade'));
  await sleep(250);
  check('portal denied outside zone (server gate intact)', await page.evaluate(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'portal_not_in_zone'));

  // ── 4. phone viewport usable, avatar rendered, no errors ──
  check('canvas present + sized on phone viewport', await page.evaluate(() => { const c = document.querySelector('canvas'); return !!c && c.width > 0 && c.height > 0; }));
  check('no console/page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
} finally {
  await browser.close();
}

console.log(failures ? `\nCITY COLLISION SMOKE: ${failures} FAIL` : '\nCITY COLLISION SMOKE: PASS');
process.exit(failures ? 1 : 0);
