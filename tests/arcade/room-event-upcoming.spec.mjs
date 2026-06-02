/**
 * Phase 2g — room-event pre-roll ("upcoming") browser validation.
 *
 * Drives the TEST-ONLY event clock to a normal window (no pre-roll), then into the
 * pre-roll lead of the next event, and proves: the floor shows the live "Up next in …"
 * countdown + the server `event_upcoming` flag, the public feed gets ONE
 * `room_event_upcoming` announcement (deduped on re-request), no money-like copy, and
 * zero console/page errors. The pre-roll LOGIC is unit-tested in
 * tests/arcade/room-event-upcoming.test.mjs; this checks the live wiring.
 *
 * Works on the dev shim AND a real Worker/DO under `wrangler dev` (ENVIRONMENT=development).
 * Run: tests/arcade/run-room-event-upcoming.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
import { EVENT_WINDOW_MS } from '../../workers/arcade/src/room-events.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
const RUN = Date.now().toString(36);
const url = (id, room) => `${BASE}/arcade/index.html?test=1&id=${id}${room ? `&room=${room}` : ''}&ws=${encodeURIComponent(WS)}`;
const W = EVENT_WINDOW_MS;
const mid3 = 3 * W + 1000;        // window 3 (Pulse Hour), not pre-roll
const preroll4 = 4 * W - 60000;   // 60s before window 4 (Signal Sprint Relay) → pre-roll

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

const feedSummaries = (page) => page.evaluate(() => window.__neon.feed().map((e) => e.summary));
const countMatch = (arr, re) => arr.filter((s) => re.test(s)).length;

const browser = await chromium.launch({ headless: true });
try {
  const A = await open(browser, `up${RUN}`, 'main-floor');

  // Window 3 (Pulse Hour) — not in pre-roll. The floor shows the plain next-event line.
  await A.page.evaluate((now) => window.__neon.setEventNow(now), mid3);
  await A.page.waitForFunction(() => window.__neon.roomEvent() && /Pulse Hour/.test(window.__neon.roomEvent().display_name), null, { timeout: 8000 });
  check('not upcoming during a normal window (server flag false)', (await A.page.evaluate(() => window.__neon.eventUpcoming())) === false);
  const nextNormal = await A.page.evaluate(() => document.getElementById('roomEventNext')?.textContent || '');
  check('floor shows the plain next-event preview (no pre-roll)', /Next ·/.test(nextNormal) && !/Up next/.test(nextNormal));

  // Advance into the pre-roll lead of window 4 (Signal Sprint Relay).
  await A.page.evaluate((now) => window.__neon.setEventNow(now), preroll4);
  await A.page.waitForFunction(() => window.__neon.eventUpcoming() === true, null, { timeout: 8000 });
  check('server flags the next event as upcoming (event_upcoming=true)', (await A.page.evaluate(() => window.__neon.eventUpcoming())) === true);

  // The floor next-event line becomes a live "Up next in …" pre-roll countdown.
  const prerollLine = await A.page.evaluate(() => document.getElementById('roomEventNext')?.textContent || '');
  const prerollAttr = await A.page.evaluate(() => document.getElementById('roomEventNext')?.dataset.preroll || '');
  check('floor shows the pre-roll countdown for the next event', /Up next in/.test(prerollLine) && /Signal Sprint Relay/.test(prerollLine));
  check('floor marks the pre-roll line (data-preroll)', prerollAttr === '1');

  // The public feed receives exactly one room_event_upcoming announcement.
  await A.page.waitForFunction(() => window.__neon.feed().some((e) => /Signal Sprint Relay is up next\./.test(e.summary)), null, { timeout: 8000 });
  check('a room_event_upcoming announcement appears in the feed', countMatch(await feedSummaries(A.page), /Signal Sprint Relay is up next\./) === 1);
  const upType = await A.page.evaluate(() => window.__neon.feed().filter((e) => e.event_type === 'room_event_upcoming').length);
  check('the announcement has the room_event_upcoming type', upType === 1);

  // Re-requesting at the same pre-roll clock must NOT duplicate it.
  for (let i = 0; i < 3; i += 1) await A.page.evaluate(() => window.__neon.client.requestRoomEvents());
  await A.page.waitForTimeout(200);
  check('repeated requests do not duplicate the pre-roll announcement', countMatch(await feedSummaries(A.page), /Signal Sprint Relay is up next\./) === 1);

  // No money-like copy anywhere.
  const all = (await feedSummaries(A.page)).join(' ') + ' ' + prerollLine;
  check('no money-like copy in pre-roll feed / floor copy', !/jackpot|multiplier|payout|cash ?out|win more|boosted|bonus cash|reward boost/i.test(all));

  check('no console / page errors', A.errors.length === 0);
  if (A.errors.length) console.log('  errors:', JSON.stringify(A.errors, null, 2));
} finally {
  await browser.close();
}
console.log(failures === 0 ? '\nROOM-EVENT-UPCOMING VALIDATION: PASS' : `\nROOM-EVENT-UPCOMING VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
