/**
 * Phase 4D — City Hive-Scheduler pressure browser smoke.
 *
 * Proves end-to-end against the local city dev shim (parity twin of the CityRoom DO):
 * the city-pressure panel renders, pressure appears after join, portal activity shifts
 * the pressure / emits a scheduler event, the client CANNOT forge a scheduler fact,
 * no private data appears, and the existing world log + in-place arcade interior still
 * work. Forces the 2D renderer for headless determinism.
 *
 * Run: see tests/arcade/run-city-scheduler.sh
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

  // pressure appears after join
  await A.page.waitForFunction(() => window.__neon_city.pressure() !== null, null, { timeout: 8000 }).catch(() => {});
  const p0 = await A.page.evaluate(() => window.__neon_city.pressure());
  check('city pressure snapshot is available after join', !!p0 && typeof p0.scheduler_mood === 'string');
  check('presence reflects the joined player (light)', p0 && p0.presence === 'light');
  check('city pressure panel is rendered + populated', await A.page.evaluate(() => { const el = document.getElementById('cityPressure'); return !!el && /CITY PRESSURE/.test(el.textContent); }));

  // client CANNOT forge a scheduler fact
  await A.page.evaluate(() => window.__neon_city.client.send({ t: 'city_scheduler_tick', event: { type: 'city_scheduler_tick', event_id: 'FORGED' } }));
  await A.page.waitForFunction(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type', null, { timeout: 5000 }).catch(() => {});
  check('forged scheduler event is rejected (unknown_type)', await A.page.evaluate(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type'));

  // repeated portal requests (far from zone) raise portal activity → pressure shifts
  for (let i = 0; i < 5; i++) { await A.page.evaluate(() => window.__neon_city.client.enterPortal('arcade')); await sleep(60); }
  await A.page.evaluate(() => window.__neon_city.requestScheduler());
  await A.page.waitForFunction(() => { const p = window.__neon_city.pressure(); return p && (p.portal_activity === 'active' || p.portal_activity === 'surging'); }, null, { timeout: 8000 }).catch(() => {});
  const p1 = await A.page.evaluate(() => window.__neon_city.pressure());
  check('portal activity rose after repeated portal requests', p1 && ['active', 'surging'].includes(p1.portal_activity));
  check('scheduler mood is no longer stable', p1 && p1.scheduler_mood !== 'stable');
  check('a scheduler/pressure event is visible in the world log', await A.page.evaluate(() => window.__neon_city.events().some((e) => e.type === 'city_scheduler_tick' || e.type === 'city_pressure_suggested')));

  // no private data anywhere in the pressure / event UI
  check('no private/economy data in pressure UI', await A.page.evaluate(() => {
    const txt = (document.getElementById('cityPressure').textContent + ' ' + document.getElementById('cityEventLog').textContent);
    return !/balance|ledger|inventory|ticket|token|cash|payout|owner/i.test(txt);
  }));

  // existing world log still renders
  check('world log panel still present', await A.page.evaluate(() => { const el = document.getElementById('cityEventLog'); return !!el && el.children.length >= 1; }));

  // existing in-place arcade interior still works (walk to portal zone, enter)
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
  await A.page.evaluate(() => window.__neon_city.enterPortal());
  await A.page.waitForFunction(() => window.__neon_city.interiorOpen, null, { timeout: 5000 }).catch(() => {});
  check('in-place arcade interior still opens (4C intact)', await A.page.evaluate(() => window.__neon_city.interiorOpen === true));
  await A.page.evaluate(() => window.__neon_city.closeInterior());

  const allErrors = [...A.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY SCHEDULER SMOKE: PASS' : `\nCITY SCHEDULER SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
