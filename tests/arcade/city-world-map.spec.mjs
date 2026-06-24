/**
 * Phase W-1 — World Map fast travel browser smoke.
 *
 * Proves against the local city dev shim (parity twin of the CityRoom DO): map nodes are
 * travel controls (B-1 clickable + 1 current), a NON-adjacent waypoint chains legal hops and
 * arrives (every hop server-validated — the client never skips adjacency), an adjacent map
 * click is a plain single hop, an unknown waypoint is rejected client-side and you stay put,
 * the zone-accent CSS var is painted, and no private/economy copy appears. 2D renderer.
 *
 * Run: tests/arcade/run-city-world-map.sh
 */
import { createRequire } from 'node:module';
import { CITY_IDS } from '../../arcade/city/city-block.mjs'; // canonical roster — node/clickable counts derive from B
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const B = CITY_IDS.length; // current block count (B=9 at the Phase 8B outer corridor)

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8788/arcade/city/ws';
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/city/index.html?test=1&renderer=2d&id=${id}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(`wm${RUN}`), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon_city && window.__neon_city.connected, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.district() !== null, null, { timeout: 6000 });

  // ── map nodes are travel controls ──────────────────────────────────────────
  check('world map renders one node per block', await page.evaluate((b) => document.querySelectorAll('#cityDistrict .dist-map-svg .dm-node').length === b, B));
  check('every non-current node is a clickable control (dm-click + role=button)', await page.evaluate((b) => {
    const c = [...document.querySelectorAll('#cityDistrict .dist-map-svg .dm-click')];
    return c.length === b - 1 && c.every((n) => n.getAttribute('role') === 'button' && n.getAttribute('tabindex') === '0');
  }, B));
  check('nodes carry zone-accent fills (inline style set)', await page.evaluate(() => [...document.querySelectorAll('#cityDistrict .dist-map-svg .dm-node')].every((n) => /^#[0-9a-f]{6}$/i.test(n.style.fill) || n.style.fill.startsWith('rgb'))));
  check('zone accent painted on the panel (CSS var --blk-accent)', await page.evaluate(() => /^#[0-9a-f]{6}$/i.test(document.getElementById('cityDistrict').style.getPropertyValue('--blk-accent').trim())));

  // ── multi-hop waypoint: downtown → skyline (never adjacent; 2 hops) ───────
  const d0 = await page.evaluate(() => window.__neon_city.district());
  check('start at downtown-01; skyline-03 is NOT adjacent', d0.current_city_id === 'downtown-01' && !d0.adjacency['downtown-01'].includes('skyline-03'));
  await page.evaluate(() => window.__neon_city.waypointTo('skyline-03'));
  check('waypoint is set while the first hop is in flight', await page.evaluate(() => window.__neon_city.waypoint === 'skyline-03'));
  await page.waitForFunction(() => window.__neon_city.cityId === 'skyline-03', null, { timeout: 12000 }).catch(() => {});
  check('waypoint travel ARRIVES at skyline-03 (two server-validated hops)', await page.evaluate(() => window.__neon_city.cityId === 'skyline-03'));
  await page.waitForFunction(() => window.__neon_city.waypoint === null, null, { timeout: 4000 }).catch(() => {});
  check('waypoint clears on arrival', await page.evaluate(() => window.__neon_city.waypoint === null));
  check('the journey passed through an intermediate block (route activity shows 2 hops)', await page.evaluate(() => {
    const hops = window.__neon_city.activity().filter((a) => a.type === 'route_requested' || a.type === 'travel_started' || /routing|route/i.test(a.type)).length;
    const arrivals = window.__neon_city.activity().filter((a) => /arriv/i.test(a.type) || /arriv/i.test(a.label)).length;
    return arrivals >= 2 || hops >= 2; // two hops → two route requests and/or two arrivals beyond the seed
  }));

  // ── adjacent map travel is a plain single hop ──────────────────────────────
  const d1 = await page.evaluate(() => window.__neon_city.district());
  check('harbor-02 is adjacent to skyline-03', d1.adjacency['skyline-03'].includes('harbor-02'));
  await page.evaluate(() => window.__neon_city.waypointTo('harbor-02'));
  check('single-hop map travel sets NO standing waypoint', await page.evaluate(() => window.__neon_city.waypoint === null));
  await page.waitForFunction(() => window.__neon_city.cityId === 'harbor-02', null, { timeout: 8000 }).catch(() => {});
  check('adjacent map click arrives at harbor-02', await page.evaluate(() => window.__neon_city.cityId === 'harbor-02'));

  // ── bad waypoint: client-side rejection, you stay put ──────────────────────
  await page.evaluate(() => window.__neon_city.waypointTo('mystery-99'));
  await sleep(300);
  check('unknown waypoint rejected (no waypoint, still in harbor-02)', await page.evaluate(() => window.__neon_city.waypoint === null && window.__neon_city.cityId === 'harbor-02'));
  check('rejection feedback shown in the panel', await page.evaluate(() => /waypoint blocked/.test(document.getElementById('cityDistrict').textContent)));

  // ── safety: copy + console ─────────────────────────────────────────────────
  const panelText = await page.evaluate(() => document.getElementById('cityDistrict').textContent);
  check('no economy/ownership copy in the panel', !/\b(buy|sell|own|price|wallet|cash|payout)\b/i.test(panelText));
  check('no private data in the panel', !/player_id|balance|ledger|email|secret/i.test(panelText));
  check('no page/console errors', errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
} finally {
  await browser.close();
}
console.log(failures === 0 ? 'WORLD MAP SMOKE: ALL GREEN' : `WORLD MAP SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
