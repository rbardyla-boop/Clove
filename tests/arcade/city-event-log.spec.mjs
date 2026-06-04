/**
 * Phase 4C — City world event log + in-place arcade interior browser smoke.
 *
 * Proves end-to-end against the local city dev shim (parity twin of the CityRoom DO):
 * the server-authored event log is observable (join event, portal request/accept/reject,
 * interior open/close), the client CANNOT author a canonical event, the in-place arcade
 * interior overlay opens on a server-confirmed portal and closes back to the city, and
 * the existing arcade page still loads. Forces the 2D renderer for headless determinism.
 *
 * Run: see tests/arcade/run-city-event-log.sh
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
const hasEvent = (page, type) => page.evaluate((t) => window.__neon_city.events().some((e) => e.type === t), type);

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

  // own join is a server-authored event, surfaced in the city-OS log panel
  await A.page.waitForFunction(() => window.__neon_city.events().some((e) => e.type === 'city_player_joined'), null, { timeout: 8000 }).catch(() => {});
  check('join emits a server-authored city_player_joined event', await hasEvent(A.page, 'city_player_joined'));
  check('city event log panel is present + populated', await A.page.evaluate(() => { const el = document.getElementById('cityEventLog'); return !!el && el.children.length >= 1; }));

  // client CANNOT author a canonical event — a forged append is rejected
  await A.page.evaluate(() => window.__neon_city.client.send({ t: 'city_event', event: { type: 'city_player_joined', event_id: 'FORGED', actor_public_id: 'hacker' } }));
  await A.page.waitForFunction(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type', null, { timeout: 5000 }).catch(() => {});
  check('forged city_event append is rejected (unknown_type)', await A.page.evaluate(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type'));
  check('no forged event entered the client log', await A.page.evaluate(() => !window.__neon_city.events().some((e) => e.event_id === 'FORGED')));

  // far-from-portal request → server rejects + logs a rejected event
  await A.page.evaluate(() => window.__neon_city.client.enterPortal('arcade'));
  await sleep(300);
  check('far portal request is rejected (server gate)', await A.page.evaluate(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'portal_not_in_zone'));
  check('rejected portal request is logged as a world event', await hasEvent(A.page, 'city_portal_enter_rejected'));
  check('interior did NOT open from outside the zone', await A.page.evaluate(() => window.__neon_city.interiorOpen === false));

  // walk into the arcade portal zone (axis-priority seek), then request entry
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
  check('server-confirmed portal opens the IN-PLACE arcade interior', await A.page.evaluate(() => window.__neon_city.interiorOpen === true));
  check('interior overlay + iframe are present (no full-page navigation)', await A.page.evaluate(() => {
    const ov = document.getElementById('portalOverlay'); const fr = document.getElementById('interiorFrame');
    return ov && !ov.hidden && !!fr;
  }));
  check('portal target is the same-origin arcade path', await A.page.evaluate(() => window.__neon_city.lastPortalOk && window.__neon_city.lastPortalOk.target === '/arcade/'));
  check('accept + interior_opened are logged as world events', (await hasEvent(A.page, 'city_portal_enter_accepted')) && (await hasEvent(A.page, 'city_arcade_interior_opened')));

  // close the interior → returns to the city + logs interior_closed
  await A.page.evaluate(() => window.__neon_city.closeInterior());
  await A.page.waitForFunction(() => window.__neon_city.events().some((e) => e.type === 'city_arcade_interior_closed'), null, { timeout: 5000 }).catch(() => {});
  check('closing the interior returns to the city', await A.page.evaluate(() => window.__neon_city.interiorOpen === false && document.getElementById('portalOverlay').hidden));
  check('interior_closed is logged as a world event', await hasEvent(A.page, 'city_arcade_interior_closed'));

  // two-client: A sees B's public join/leave as world events
  const B = await newClient(browser, `b${RUN}`);
  await A.page.waitForFunction((bid) => window.__neon_city.events().some((e) => e.type === 'city_player_joined' && e.actor_public_id === bid), `b${RUN}`, { timeout: 8000 }).catch(() => {});
  check('A sees B join as a public world event', await A.page.evaluate((bid) => window.__neon_city.events().some((e) => e.type === 'city_player_joined' && e.actor_public_id === bid), `b${RUN}`));
  await B.page.close();
  await A.page.waitForFunction((bid) => window.__neon_city.events().some((e) => e.type === 'city_player_left' && e.actor_public_id === bid), `b${RUN}`, { timeout: 8000 }).catch(() => {});
  check('A sees B leave as a public world event', await A.page.evaluate((bid) => window.__neon_city.events().some((e) => e.type === 'city_player_left' && e.actor_public_id === bid), `b${RUN}`));
  check('no private data in the client event log', await A.page.evaluate(() => !/balance|ledger|inventory|token|secret/i.test(JSON.stringify(window.__neon_city.events()))));

  // existing arcade page still loads (isolation intact)
  const arc = await browser.newContext();
  const arcPage = await arc.newPage();
  await arcPage.goto(`${BASE}/arcade/index.html`, { waitUntil: 'load' });
  check('existing arcade page still loads (isolated)', /Neon Circuit Arcade/.test(await arcPage.title()));

  const allErrors = [...A.errors, ...B.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY EVENT LOG SMOKE: PASS' : `\nCITY EVENT LOG SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
