/**
 * Phase 6A — Scheduled District Events browser smoke (against the local city dev shim).
 *
 * District events are CLIENT-DERIVED, display/atmosphere only, from a deterministic schedule (clock
 * + static block manifest). Proves: the district-event banner renders with current + next copy; the
 * District Activity feed receives a public-safe event announcement; driving the deterministic clock
 * across a window boundary surfaces a pre-roll "upcoming" then an "ended" + new "active"; existing
 * route/arrival activity and district presence still work; no private data / no forbidden economy
 * copy in the UI; no console/page errors; the banner is usable at a phone viewport.
 * Forces the 2D renderer for headless. Adds NO server change (Phase 6A is client-only).
 *
 * Run: see tests/arcade/run-city-district-events.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8788/arcade/city/ws';
const url = (id, city) => `${BASE}/arcade/city/index.html?test=1&renderer=2d&id=${id}${city ? `&city=${city}` : ''}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };

async function newClient(browser, id, city, viewport) {
  const ctx = await browser.newContext(viewport ? { viewport } : undefined);
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(id, city), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon_city, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.connected, null, { timeout: 8000 });
  // wait for the district manifest so the panel (and the event banner) is rendered
  await page.waitForFunction(() => !!window.__neon_city.district(), null, { timeout: 8000 });
  return { ctx, page, errors };
}

const activity = (page) => page.evaluate(() => window.__neon_city.activity());
const distEvent = (page) => page.evaluate(() => window.__neon_city.districtEvent());
const distText = (page) => page.evaluate(() => document.getElementById('cityDistrict').textContent);
const bannerText = (page) => page.evaluate(() => {
  const ev = document.querySelector('.city-district .dist-event');
  return ev ? ev.textContent : '';
});
async function poll(page, nowMs) { return page.evaluate((n) => window.__neon_city.pollDistrictEvents(n), nowMs); }
async function waitActivity(page, pred, timeout = 8000) {
  const t0 = Date.now();
  let acts = [];
  while (Date.now() - t0 < timeout) {
    acts = await activity(page);
    if (acts.some(pred)) return acts;
    await page.waitForTimeout(150);
  }
  return acts;
}

const FORBIDDEN = /\b(buy|sell|trade|rent|own|owner|ownership|profit|payout|wager|bet|loot|stake|staking|yield|crypto|token|nft|market|marketplace|landlord|tenant|income|cashout|jackpot|multiplier|boosted)\b/i;
const PRIVATE = /\b(player_id|playerId|connection|socket|balance|ledger|inventory|secret|account|admin)\b/i;

const browser = await chromium.launch({ headless: true });
try {
  const c = await newClient(browser, 'evt-a', 'downtown-01');

  // 1. banner renders with current + next copy
  const w0 = await distEvent(c.page);
  check('district-event window present (current + next)', !!(w0 && w0.current && w0.next));
  const banner0 = await bannerText(c.page);
  check('banner shows the current event label', !!w0 && banner0.includes(w0.current.label));
  check('banner shows a "now" chip', /now/i.test(banner0));
  check('banner shows an "Up next" line with the next label', !!w0 && banner0.includes('Up next') && banner0.includes(w0.next.label));

  // 2. feed received the current active announcement (cold-start poll)
  let acts = await waitActivity(c.page, (a) => a.type === 'district_event_active');
  check('District Activity feed received a district_event_active item', acts.some((a) => a.type === 'district_event_active'));
  check('the announcement is public_safe', acts.filter((a) => a.type.startsWith('district_event_')).every((a) => a.public_safe === true));

  // 3. no forbidden economy copy / no private data anywhere in the district panel
  const txt0 = await distText(c.page);
  check('no forbidden economy/ownership copy in district panel', !FORBIDDEN.test(txt0));
  check('no private data in district panel', !PRIVATE.test(txt0));

  // 4. drive the deterministic clock to just before the window end → pre-roll "upcoming"
  const preroll = await poll(c.page, w0.ends_at - 1000);
  check('pre-roll flag set near window end', preroll && preroll.preroll === true);
  acts = await waitActivity(c.page, (a) => a.type === 'district_event_upcoming');
  check('feed received a district_event_upcoming announcement in pre-roll', acts.some((a) => a.type === 'district_event_upcoming'));

  // 5. cross the window boundary → the witnessed window ends + a new active begins
  const w1 = await poll(c.page, w0.ends_at + 1000);
  check('window advanced past the boundary', !!w1 && w1.current.event_id !== w0.current.event_id);
  acts = await waitActivity(c.page, (a) => a.type === 'district_event_ended');
  check('feed received a district_event_ended announcement after the boundary', acts.some((a) => a.type === 'district_event_ended'));
  const banner1 = await bannerText(c.page);
  check('banner updated to the new window event', banner1.includes(w1.current.label));
  check('post-flip district panel still clean of forbidden/private copy', !FORBIDDEN.test(await distText(c.page)) && !PRIVATE.test(await distText(c.page)));

  // 6. existing district presence + route/arrival path still works (non-regression)
  const manifest = await c.page.evaluate(() => window.__neon_city.district());
  check('district presence manifest still present (blocks listed)', !!manifest && Array.isArray(manifest.blocks) && manifest.blocks.length >= 1);
  await c.page.evaluate(() => { const b = document.querySelector('.city-district .dist-travel'); if (b) b.click(); });
  acts = await waitActivity(c.page, (a) => a.type === 'route_confirmed' || a.type === 'block_arrived' || a.type === 'route_requested');
  check('route/arrival activity still works after a Travel', acts.some((a) => ['route_requested', 'route_confirmed', 'block_arrived'].includes(a.type)));

  check('no console/page errors (client a)', c.errors.length === 0);
  if (c.errors.length) console.log('   errors:', c.errors.join(' | '));

  // 7. phone viewport: the banner is still rendered and the panel usable
  const m = await newClient(browser, 'evt-m', 'harbor-02', { width: 390, height: 844 });
  const mBanner = await bannerText(m.page);
  const mEvent = await distEvent(m.page);
  check('phone viewport renders the district-event banner', !!mEvent && mBanner.includes(mEvent.current.label));
  check('phone viewport: no forbidden/private copy', !FORBIDDEN.test(await distText(m.page)) && !PRIVATE.test(await distText(m.page)));
  check('no console/page errors (phone client)', m.errors.length === 0);
  if (m.errors.length) console.log('   errors:', m.errors.join(' | '));

  await c.ctx.close();
  await m.ctx.close();
} finally {
  await browser.close();
}

console.log(failures ? `\nDISTRICT EVENTS SMOKE: ${failures} FAIL` : '\nDISTRICT EVENTS SMOKE: PASS');
process.exit(failures ? 1 : 0);
