/**
 * Phase 2h — operator-tunable event presentation browser validation.
 *
 * Proves: the operator presentation config (a custom EVENT_COUNTDOWN_REFRESH_MS set on the
 * shim) flows env → config → room_events payload → client; and that, inside a pre-roll
 * window, the floor shows a LIVE m:ss "Up next in …" countdown that ticks DOWN over real
 * time (the Phase 2h live refresh). No money-like copy, zero console/page errors.
 *
 * Works on the dev shim AND a real Worker/DO under `wrangler dev` (ENVIRONMENT=development).
 * Run: tests/arcade/run-event-presentation.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
import { EVENT_WINDOW_MS } from '../../workers/arcade/src/room-events.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
const EXPECTED_REFRESH = Number(process.env.EVENT_COUNTDOWN_REFRESH_MS) || 1000;
const RUN = Date.now().toString(36);
const url = (id, room) => `${BASE}/arcade/index.html?test=1&id=${id}${room ? `&room=${room}` : ''}&ws=${encodeURIComponent(WS)}`;
const W = EVENT_WINDOW_MS;
const preroll4 = 4 * W - 60000; // 60s before window 4 → pre-roll (Signal Sprint Relay)

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };

async function open(browser, id, room) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(id, room), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon, null, { timeout: 8000 });
  await page.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });
  return { page, ctx, errors };
}

const prerollLine = (page) => page.evaluate(() => document.getElementById('roomEventNext')?.textContent || '');

const browser = await chromium.launch({ headless: true });
try {
  const A = await open(browser, `pres${RUN}`, 'main-floor');

  // The operator presentation config flowed env → config → room_events → client.
  await A.page.waitForFunction(() => !!window.__neon.eventPresentation(), null, { timeout: 8000 });
  const pres = await A.page.evaluate(() => window.__neon.eventPresentation());
  check('client receives the operator presentation config', !!pres && typeof pres.preroll_lead_ms === 'number');
  check('operator-tuned countdown_refresh_ms flows end-to-end', pres.countdown_refresh_ms === EXPECTED_REFRESH);

  // Enter the pre-roll window: the floor shows a live m:ss "Up next in …" countdown.
  await A.page.evaluate((now) => window.__neon.setEventNow(now), preroll4);
  await A.page.waitForFunction(() => window.__neon.eventUpcoming() === true, null, { timeout: 8000 });
  const line0 = await prerollLine(A.page);
  check('floor shows a live m:ss pre-roll countdown', /Up next in \d+:\d{2}/.test(line0) && /Signal Sprint Relay/.test(line0));
  const ms0 = await A.page.evaluate(() => window.__neon.eventCountdownMs());
  check('the pre-roll countdown has time remaining', typeof ms0 === 'number' && ms0 > 0);

  // …and it ticks DOWN over real time (the Phase 2h live refresh).
  await A.page.waitForTimeout(2200);
  const ms1 = await A.page.evaluate(() => window.__neon.eventCountdownMs());
  check('the countdown decreases over real time (live, not a static snapshot)', ms1 <= ms0 - 1500);
  const line1 = await prerollLine(A.page);
  check('the rendered m:ss countdown re-rendered to a smaller value', /Up next in \d+:\d{2}/.test(line1) && line1 !== line0);

  // No money-like copy anywhere.
  const all = line0 + ' ' + line1;
  check('no money-like copy in the pre-roll countdown', !/jackpot|multiplier|payout|cash ?out|win more|boosted|bonus cash|reward boost/i.test(all));

  check('no console / page errors', A.errors.length === 0);
  if (A.errors.length) console.log('  errors:', JSON.stringify(A.errors, null, 2));
} finally {
  await browser.close();
}
console.log(failures === 0 ? '\nEVENT-PRESENTATION VALIDATION: PASS' : `\nEVENT-PRESENTATION VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
