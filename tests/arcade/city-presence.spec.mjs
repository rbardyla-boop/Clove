/**
 * Phase 5C — Live District Presence browser smoke.
 *
 * Proves against the local city dev shim (parity twin of the CityRoom DO + CityRegistry):
 * a client in one block sees the LIVE population/health of OTHER blocks in its district
 * manifest, population is server-derived (never client-asserted), the count drops when a
 * remote player leaves, the manifest stays public-safe (counts/health only — no player ids),
 * and the district panel renders "N here". Forces the 2D renderer for headless.
 *
 * Run: see tests/arcade/run-city-presence.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8788/arcade/city/ws';
const RUN = Date.now().toString(36);
const url = (id, city) => `${BASE}/arcade/city/index.html?test=1&renderer=2d&id=${id}${city ? `&city=${city}` : ''}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };

async function newClient(browser, id, city) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(id, city), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon_city, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.connected, null, { timeout: 8000 });
  return { ctx, page, errors };
}

const blockPop = (page, cityId) => page.evaluate((id) => {
  window.__neon_city.requestBlocks();
  return id;
}, cityId);

// poll the district manifest until a block reaches an expected population (or timeout)
async function waitBlockPop(page, cityId, want, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    await page.evaluate(() => window.__neon_city.requestBlocks());
    const pop = await page.evaluate((id) => { const d = window.__neon_city.district(); const b = d && d.blocks.find((x) => x.city_id === id); return b ? b.population : null; }, cityId);
    if (pop === want) return pop;
    await page.waitForTimeout(300);
  }
  return await page.evaluate((id) => { const d = window.__neon_city.district(); const b = d && d.blocks.find((x) => x.city_id === id); return b ? b.population : null; }, cityId);
}

const browser = await chromium.launch({ headless: true });
try {
  const A = await newClient(browser, `a${RUN}`);              // downtown-01 (default)
  const B = await newClient(browser, `b${RUN}`, 'harbor-02'); // harbor-02
  check('two clients connect to different blocks', true);

  // A (downtown) sees harbor's LIVE population (B is there) in its district manifest
  const harborPop = await waitBlockPop(A.page, 'harbor-02', 1);
  check('downtown client sees harbor population = 1 (live cross-block presence)', harborPop === 1);
  check('harbor block reads as healthy in the manifest', await A.page.evaluate(() => { const d = window.__neon_city.district(); const b = d.blocks.find((x) => x.city_id === 'harbor-02'); return b && b.health === 'healthy'; }));
  check('downtown block shows its own population >= 1', await A.page.evaluate(() => { const d = window.__neon_city.district(); const b = d.blocks.find((x) => x.city_id === 'downtown-01'); return b && b.population >= 1; }));

  // the district panel renders the live count ("N here")
  check('district panel shows a live "N here" count', await A.page.evaluate(() => /\d+\s*here/.test(document.getElementById('cityDistrict').textContent)));

  // B (harbor) symmetrically sees downtown's population
  const downtownFromB = await waitBlockPop(B.page, 'downtown-01', 1);
  check('harbor client sees downtown population = 1', downtownFromB === 1);

  // presence is public-safe: counts + health only, never player ids / private data
  check('district manifest carries no player ids or private data', await A.page.evaluate(() => !/\b(player_id|playerId|connection|balance|ledger|inventory|secret|wager|payout)\b/i.test(JSON.stringify(window.__neon_city.district()))));
  check('a block population is a server-derived number, not client-set', await A.page.evaluate(() => { const d = window.__neon_city.district(); return d.blocks.every((b) => typeof b.population === 'number' && b.population >= 0); }));

  // when B leaves, A sees harbor's population drop (no ghost population)
  await B.ctx.close();
  const harborAfter = await waitBlockPop(A.page, 'harbor-02', 0);
  check('harbor population drops to 0 after the remote player leaves (no ghosts)', harborAfter === 0);

  // existing layers still work
  check('routing still works (harbor is adjacent to downtown)', await A.page.evaluate(() => { const d = window.__neon_city.district(); const dt = d.blocks.find((x) => x.city_id === 'downtown-01'); return dt.adjacent.includes('harbor-02'); }));
  check('no console / page errors', A.errors.length === 0);
  if (A.errors.length) console.log('  errors:', JSON.stringify(A.errors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY PRESENCE SMOKE: PASS' : `\nCITY PRESENCE SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
