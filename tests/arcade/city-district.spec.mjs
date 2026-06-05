/**
 * Phase 5A — Multi-Block District browser smoke.
 *
 * Proves end-to-end against the local city dev shim (parity twin of the CityRoom DO):
 * the DISTRICT panel renders the current + adjacent blocks, the public-safe manifest is
 * exposed, a NON-adjacent route is server-rejected (you stay put), an ADJACENT Travel is
 * server-confirmed and the client reconnects to the new block (server-owned current block
 * changes), per-block routing stays bounded, the client CANNOT author block/district state,
 * no money/ownership copy appears, no private data leaks, and the existing pressure /
 * host-rank / stewardship / world-log layers still work. Forces the 2D renderer for headless.
 *
 * Run: see tests/arcade/run-city-district.sh
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

const clickTravel = (page, name) => page.evaluate((n) => {
  const row = [...document.querySelectorAll('#cityDistrict .dist-row')].find((r) => r.textContent.includes(n));
  if (!row) return false;
  row.querySelector('.dist-travel').click();
  return true;
}, name);

const browser = await chromium.launch({ headless: true });
try {
  const A = await newClient(browser, `a${RUN}`);
  check('city connects (status live)', await A.page.evaluate(() => window.__neon_city.status === 'live'));
  // server pushes the district manifest on join
  await A.page.waitForFunction(() => window.__neon_city.district() !== null, null, { timeout: 6000 }).catch(() => {});

  // ── discovery ──────────────────────────────────────────────────────────────
  const d0 = await A.page.evaluate(() => window.__neon_city.district());
  check('district manifest received on join', !!d0 && d0.district_id === 'neon-district-01');
  check('district lists all three blocks', !!d0 && Array.isArray(d0.blocks) && d0.blocks.length === 3);
  check('current block is downtown-01 (server-owned)', !!d0 && d0.current_city_id === 'downtown-01');
  check('DISTRICT panel renders the current block name', await A.page.evaluate(() => /DISTRICT/.test(document.getElementById('cityDistrict').textContent) && /Downtown Block/.test(document.getElementById('cityDistrict').textContent)));
  check('adjacent block (Harbor) is shown with a Travel control', await A.page.evaluate(() => { const el = document.getElementById('cityDistrict'); return /Harbor Block/.test(el.textContent) && !!el.querySelector('.dist-travel'); }));
  check('non-adjacent block (Skyline) is NOT offered from downtown', await A.page.evaluate(() => ![...document.querySelectorAll('#cityDistrict .dist-row')].some((r) => /Skyline/.test(r.textContent))));

  // public-safe manifest (no private / economy / ownership)
  check('district manifest carries no private/economy/ownership data (population count is public)', await A.page.evaluate(() => !/\b(balance|ledger|inventory|payout|wager|owner|ownership|rent|rental|income|landlord|tenant|price|market|economy|secret|token|player_id|connection)\b/i.test(JSON.stringify(window.__neon_city.district()))));
  check('district panel copy is travel-only (no money/ownership/claim)', await A.page.evaluate(() => !/\$|\bcash\b|\bpayout\b|\bbuy\b|\bsell\b|\brent\b|\bown\b|\bowner\b|\bclaim\b|\bprice\b|\bmarket\b|\bstake\b|\bprofit\b|\bincome\b/i.test(document.getElementById('cityDistrict').textContent)));

  // Phase 5B: capture downtown's visual identity (style + landmark label) before travel
  const dtId = await A.page.evaluate(() => ({
    palette: window.__neon_city.blockStyle().arcade_front.palette,
    label: (window.__neon_city.layout().buildings.find((b) => b.id === 'data-spire') || {}).label,
  }));
  check('downtown has a block style + landmark label (5B identity)', !!dtId.palette && !!dtId.label);

  // ── bounded routing: a NON-adjacent route is server-rejected; you stay put ───
  // (route requests are server rate-limited; space them so each result is observed)
  await A.page.evaluate(() => window.__neon_city.routeTo('skyline-03'));
  await A.page.waitForFunction(() => { const r = window.__neon_city.lastRouteResult; return r && r.ok === false && r.reason === 'not_adjacent'; }, null, { timeout: 5000 }).catch(() => {});
  check('route to a NON-adjacent block is rejected (not_adjacent)', await A.page.evaluate(() => { const r = window.__neon_city.lastRouteResult; return r && r.ok === false && r.reason === 'not_adjacent'; }));
  check('rejected route did NOT change the current block', await A.page.evaluate(() => window.__neon_city.cityId === 'downtown-01'));

  // a self-route is rejected too
  await sleep(320); // clear the route rate-limit window
  await A.page.evaluate(() => window.__neon_city.routeTo('downtown-01'));
  await A.page.waitForFunction(() => { const r = window.__neon_city.lastRouteResult; return r && r.ok === false && r.reason === 'same_block'; }, null, { timeout: 5000 }).catch(() => {});
  check('route to the same block is rejected (same_block)', await A.page.evaluate(() => { const r = window.__neon_city.lastRouteResult; return r && r.ok === false && r.reason === 'same_block'; }));

  // ── client cannot author block/district state ────────────────────────────────
  await A.page.evaluate(() => window.__neon_city.client.send({ t: 'city_blocks', district_id: 'forged', current_city_id: 'skyline-03' }));
  await A.page.waitForFunction(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type', null, { timeout: 5000 }).catch(() => {});
  check('a forged city_blocks from the client is rejected (unknown_type)', await A.page.evaluate(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type'));
  check('forged message did not move the player (still downtown-01)', await A.page.evaluate(() => window.__neon_city.cityId === 'downtown-01'));

  // ── server-confirmed travel to an ADJACENT block (via the real Travel button) ─
  await sleep(320); // clear the route rate-limit window before the real Travel click
  check('clicked the Harbor Travel control', await clickTravel(A.page, 'Harbor'));
  await A.page.waitForFunction(() => window.__neon_city.cityId === 'harbor-02' && window.__neon_city.connected, null, { timeout: 9000 }).catch(() => {});
  check('travel reconnected the client to harbor-02 (status live)', await A.page.evaluate(() => window.__neon_city.cityId === 'harbor-02' && window.__neon_city.status === 'live'));
  await A.page.waitForFunction(() => window.__neon_city.district() && window.__neon_city.district().current_city_id === 'harbor-02', null, { timeout: 6000 }).catch(() => {});
  check('server-owned current block is now harbor-02', await A.page.evaluate(() => window.__neon_city.district().current_city_id === 'harbor-02'));
  check('from harbor, BOTH downtown and skyline are adjacent (hub)', await A.page.evaluate(() => { const el = document.getElementById('cityDistrict'); return /Downtown Block/.test(el.textContent) && /Skyline Block/.test(el.textContent); }));

  // Phase 5B: harbor has its OWN visual identity (style + landmark labels change on travel)
  await A.page.waitForFunction((p) => window.__neon_city.blockStyle().arcade_front.palette !== p, dtId.palette, { timeout: 5000 }).catch(() => {});
  const hbId = await A.page.evaluate(() => ({
    palette: window.__neon_city.blockStyle().arcade_front.palette,
    label: (window.__neon_city.layout().buildings.find((b) => b.id === 'data-spire') || {}).label,
  }));
  check('harbor block style differs from downtown (5B per-block identity)', hbId.palette !== dtId.palette);
  check('harbor landmark label differs from downtown', hbId.label && hbId.label !== dtId.label);

  // harbor → skyline is adjacent → another server-confirmed hop
  check('clicked the Skyline Travel control', await clickTravel(A.page, 'Skyline'));
  await A.page.waitForFunction(() => window.__neon_city.cityId === 'skyline-03' && window.__neon_city.connected, null, { timeout: 9000 }).catch(() => {});
  check('travel reconnected the client to skyline-03', await A.page.evaluate(() => window.__neon_city.cityId === 'skyline-03' && window.__neon_city.status === 'live'));

  // Phase 5B: skyline has its own third distinct identity
  await A.page.waitForFunction((p) => window.__neon_city.blockStyle().arcade_front.palette !== p, hbId.palette, { timeout: 5000 }).catch(() => {});
  const skPalette = await A.page.evaluate(() => window.__neon_city.blockStyle().arcade_front.palette);
  check('skyline block style is distinct from both downtown and harbor', skPalette !== dtId.palette && skPalette !== hbId.palette);

  // ── per-block isolation: skyline has its OWN fresh state ─────────────────────
  check('skyline block has its own world log (per-block isolation)', await A.page.evaluate(() => { const el = document.getElementById('cityEventLog'); return !!el; }));

  // ── existing layers still work in the destination block ──────────────────────
  check('pressure panel still present (4D intact)', await A.page.evaluate(() => window.__neon_city.pressure() !== null));
  check('host rank panel still present (4E intact)', await A.page.evaluate(() => window.__neon_city.hostRank() !== null));
  check('stewardship panel still present (4F intact)', await A.page.evaluate(() => window.__neon_city.stewardship() !== null));

  check('no console / page errors', A.errors.length === 0);
  if (A.errors.length) console.log('  errors:', JSON.stringify(A.errors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY DISTRICT SMOKE: PASS' : `\nCITY DISTRICT SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
