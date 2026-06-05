/**
 * Phase 5D — Push-on-Change District Presence browser smoke.
 *
 * Proves against the local city dev shim (parity twin of the CityRoom DO + CityRegistry) that
 * district presence now PUSHES on change — the client updates WITHOUT polling requestBlocks():
 *   - a second client joining an adjacent block updates the first client's manifest LIVE,
 *     observed by reading district() only (never calling requestBlocks);
 *   - districtPushCount proves a delta was applied (not a poll);
 *   - the district panel shows a "live" indicator;
 *   - when the remote leaves, the first client sees the count drop LIVE (no ghosts);
 *   - the push delta + manifest stay public-safe (counts/health only — no player ids);
 *   - the manual requestBlocks() fallback still works; routing/adjacency still works.
 * Forces the 2D renderer for headless.
 *
 * Run: see tests/arcade/run-city-district-presence.sh
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

const readBlockPop = (page, cityId) => page.evaluate((id) => {
  const d = window.__neon_city.district();
  const b = d && d.blocks.find((x) => x.city_id === id);
  return b ? b.population : null;
}, cityId);

// PUSH proof: poll the LOCAL district() only — NEVER call requestBlocks(). If the value
// reaches `want`, it arrived via a server push delta, not a client-initiated refresh.
async function waitBlockPopNoPoll(page, cityId, want, timeout = 8000) {
  const deadline = Date.now() + timeout;
  let pop = null;
  while (Date.now() < deadline) {
    pop = await readBlockPop(page, cityId);
    if (pop === want) return pop;
    await page.waitForTimeout(200);
  }
  return pop;
}

const browser = await chromium.launch({ headless: true });
try {
  const A = await newClient(browser, `a${RUN}`);              // downtown-01 (default)
  check('city page loads and client A connects', await A.page.evaluate(() => window.__neon_city.connected));
  check('district panel renders', await A.page.evaluate(() => !!document.getElementById('cityDistrict') && document.getElementById('cityDistrict').textContent.length > 0));

  // A starts with harbor empty (no remote yet), observed without polling
  const harborStart = await waitBlockPopNoPoll(A.page, 'harbor-02', 0, 4000);
  check('A sees harbor empty before anyone joins (0)', harborStart === 0);
  const pushBefore = await A.page.evaluate(() => window.__neon_city.districtPushCount);

  // B joins harbor — A must see harbor population go to 1 via a PUSH (no requestBlocks call)
  const B = await newClient(browser, `b${RUN}`, 'harbor-02');
  const harborLive = await waitBlockPopNoPoll(A.page, 'harbor-02', 1);
  check('A sees harbor population = 1 WITHOUT polling (push-on-change)', harborLive === 1);
  check('A applied at least one push delta (districtPushCount increased)', await A.page.evaluate((b) => window.__neon_city.districtPushCount > b, pushBefore));
  check('the last push was a public-safe district_presence_delta', await A.page.evaluate(() => {
    const m = window.__neon_city.lastDistrictPresence;
    return !!m && m.kind === 'district_presence_delta' && m.public_safe === true && Array.isArray(m.blocks);
  }));

  // the district panel shows a "live" indicator (push freshness)
  check('district panel shows a "live" indicator', await A.page.evaluate(() => /live/i.test(document.getElementById('cityDistrict').textContent)));
  check('district panel still shows the live "N here" count', await A.page.evaluate(() => /\d+\s*here/.test(document.getElementById('cityDistrict').textContent)));

  // public-safety: neither the delta nor the manifest leaks private data
  check('push delta carries no player ids / private data', await A.page.evaluate(() => !/\b(player_id|playerId|players|connection|socket|balance|ledger|inventory|secret|account|admin|wager|payout)\b/i.test(JSON.stringify(window.__neon_city.lastDistrictPresence))));
  check('district manifest carries no player ids / private data', await A.page.evaluate(() => !/\b(player_id|playerId|connection|socket|balance|ledger|inventory|secret|account|admin|wager|payout)\b/i.test(JSON.stringify(window.__neon_city.district()))));
  check('block population is a server-derived number, not client-set', await A.page.evaluate(() => window.__neon_city.district().blocks.every((b) => typeof b.population === 'number' && b.population >= 0)));

  // B leaving updates A LIVE (no ghosts), still without polling
  await B.ctx.close();
  const harborAfter = await waitBlockPopNoPoll(A.page, 'harbor-02', 0);
  check('A sees harbor drop to 0 after the remote leaves WITHOUT polling (no ghosts)', harborAfter === 0);

  // backward-compat: the manual requestBlocks() fallback still returns a manifest
  const fallback = await A.page.evaluate(async () => {
    window.__neon_city.requestBlocks();
    await new Promise((r) => setTimeout(r, 500));
    const d = window.__neon_city.district();
    return d && Array.isArray(d.blocks) && d.blocks.length;
  });
  check('manual requestBlocks() fallback still works', fallback >= 1);

  // existing layers still work
  check('routing/adjacency still intact (harbor adjacent to downtown)', await A.page.evaluate(() => window.__neon_city.district().blocks.find((x) => x.city_id === 'downtown-01').adjacent.includes('harbor-02')));
  check('no console / page errors', A.errors.length === 0);
  if (A.errors.length) console.log('  errors:', JSON.stringify(A.errors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY DISTRICT PRESENCE PUSH SMOKE: PASS' : `\nCITY DISTRICT PRESENCE PUSH SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
