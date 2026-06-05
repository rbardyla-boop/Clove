/**
 * Phase 5E — District Activity Feed browser smoke (against the local city dev shim).
 *
 * The activity feed is CLIENT-DERIVED, display-only, from already-server-authored facts: Phase 5D
 * presence deltas, 5A route results, and arrival. Proves: the panel is visible; a presence change
 * creates a public-safe activity item; a real Travel logs route + arrival and updates the current
 * block; a non-adjacent route is safely rejected and leaves the player put; no private data / no
 * forbidden economy copy in the UI; presence push still works; no console/page errors.
 * Forces the 2D renderer for headless.
 *
 * Run: see tests/arcade/run-city-district-activity.sh
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

const activity = (page) => page.evaluate(() => window.__neon_city.activity());
// poll LOCAL derived activity (no server poll) until a predicate matches
async function waitActivity(page, pred, timeout = 8000) {
  const t0 = Date.now();
  let acts = [];
  while (Date.now() - t0 < timeout) {
    acts = await activity(page);
    if (acts.some(pred)) return acts;
    await page.waitForTimeout(200);
  }
  return acts;
}
const distText = (page) => page.evaluate(() => document.getElementById('cityDistrict').textContent);
const FORBIDDEN = /\b(buy|sell|trade|rent|own|owner|ownership|profit|payout|wager|bet|loot|stake|staking|yield|crypto|token|nft|market|marketplace|landlord|tenant|income|cashout|jackpot)\b/i;
const PRIVATE = /\b(player_id|playerId|players|connection|socket|balance|ledger|inventory|secret|account|admin|wager|payout)\b/i;

const browser = await chromium.launch({ headless: true });
try {
  const A = await newClient(browser, `a${RUN}`, 'downtown-01');
  check('city page loads and client A connects', await A.page.evaluate(() => window.__neon_city.connected));
  check('district panel is present', await A.page.evaluate(() => !!document.getElementById('cityDistrict')));

  // initial arrival item seeds the feed
  await waitActivity(A.page, (a) => a.type === 'block_arrived');
  check('feed seeds an arrival item on connect', (await activity(A.page)).some((a) => a.type === 'block_arrived' && a.city_id === 'downtown-01'));
  check('DISTRICT ACTIVITY panel is visible with the arrival', /DISTRICT ACTIVITY/.test(await distText(A.page)) && /Arrived in/i.test(await distText(A.page)));

  // a presence change creates a public-safe activity item (B appears in harbor)
  const pushBefore = await A.page.evaluate(() => window.__neon_city.districtPushCount);
  const B = await newClient(browser, `b${RUN}`, 'harbor-02');
  await waitActivity(A.page, (a) => a.type === 'block_became_active' && a.city_id === 'harbor-02');
  check('presence change creates an activity ("Harbor became active.")', (await activity(A.page)).some((a) => a.type === 'block_became_active' && a.city_id === 'harbor-02'));
  check('the activity is marked public_safe', (await activity(A.page)).every((a) => a.public_safe === true));
  check('district presence push still works (pushCount increased)', await A.page.evaluate((b) => window.__neon_city.districtPushCount > b, pushBefore));

  // public-safety + no forbidden copy in the activity feed AND the district panel DOM
  check('activity feed carries no private data', !PRIVATE.test(JSON.stringify(await activity(A.page))));
  check('activity feed carries no forbidden economy/ownership copy', !FORBIDDEN.test(JSON.stringify(await activity(A.page))));
  check('district panel DOM carries no private data', !PRIVATE.test(await distText(A.page)));
  check('district panel DOM carries no forbidden copy', !FORBIDDEN.test(await distText(A.page)));

  // a NON-adjacent route is safely rejected and leaves the player in the current block
  await A.page.evaluate(() => window.__neon_city.routeTo('skyline-03')); // downtown↛skyline (not adjacent)
  await A.page.waitForTimeout(700);
  check('non-adjacent route shows safe "blocked" copy', /blocked/i.test(await distText(A.page)));
  check('rejected route leaves the player in the current block (downtown)', await A.page.evaluate(() => window.__neon_city.cityId === 'downtown-01'));
  check('rejected route did NOT log a confirmed/arrival for skyline', !(await activity(A.page)).some((a) => a.city_id === 'skyline-03' && (a.type === 'route_confirmed' || a.type === 'block_arrived')));
  await A.page.waitForTimeout(1100); // let the transient "blocked" line clear

  // a real Travel (button handler) to an ADJACENT block logs route + arrival and updates the current
  // block. Fire the button's own click handler via JS (the District/Block-Trial panels overlap in the
  // right column — a pre-existing z-order collision unrelated to the feed — so a pointer click can be
  // intercepted; element.click() still runs the real wired handler we are validating).
  await A.page.evaluate(() => document.querySelector('.dist-travel').click()); // downtown's only adjacent Travel is harbor
  await A.page.waitForFunction(() => window.__neon_city.cityId === 'harbor-02', null, { timeout: 8000 });
  await A.page.waitForFunction(() => window.__neon_city.connected, null, { timeout: 8000 });
  await waitActivity(A.page, (a) => a.type === 'block_arrived' && a.city_id === 'harbor-02');
  const acts = await activity(A.page);
  check('Travel logged route_requested for harbor', acts.some((a) => a.type === 'route_requested' && a.city_id === 'harbor-02'));
  check('Travel logged route_confirmed for harbor', acts.some((a) => a.type === 'route_confirmed' && a.city_id === 'harbor-02'));
  check('arrival logged for harbor after the transition', acts.some((a) => a.type === 'block_arrived' && a.city_id === 'harbor-02'));
  check('current block updated to harbor after the transition', await A.page.evaluate(() => { const d = window.__neon_city.district(); return d && d.current_city_id === 'harbor-02'; }));
  check('district presence push still works after travel', await A.page.evaluate(() => window.__neon_city.districtPushCount >= 1));

  check('no console / page errors', A.errors.length === 0);
  if (A.errors.length) console.log('  errors:', JSON.stringify(A.errors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY DISTRICT ACTIVITY SMOKE: PASS' : `\nCITY DISTRICT ACTIVITY SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
