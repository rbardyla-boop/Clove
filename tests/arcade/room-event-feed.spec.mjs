/**
 * Phase 2f — live room-event feed announcements browser validation.
 *
 * Drives the TEST-ONLY event clock (__test_set_event_now, dev-gated server-side) to a
 * known window, then to the next window, and proves the public room feed receives ONE
 * `room_event_started`, then `room_event_ended` + `room_event_started` +
 * `featured_cabinet_changed`, with NO duplicates on repeated requests, no money-like
 * copy, and zero console/page errors. The transition LOGIC is unit-tested in
 * tests/arcade/room-event-transitions.test.mjs; this checks the live wiring.
 *
 * Works on the dev shim AND a real Worker/DO under `wrangler dev` (ENVIRONMENT=development).
 * Run: tests/arcade/run-room-event-feed.sh
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
// main-floor (phase 0): window 3 → Pulse Hour, window 4 → Signal Sprint Relay (featured signal).

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
const feedLen = (page) => page.evaluate(() => window.__neon.feed().length);
const has = (arr, re) => arr.some((s) => re.test(s));
const countMatch = (arr, re) => arr.filter((s) => re.test(s)).length;
// Delta-based: the floor sends a room_events_request on connect at the REAL clock, which
// establishes a baseline. We assert on the entries added AFTER pinning a known window, so
// the test is independent of whatever real-time window the run happens to fall in.

const browser = await chromium.launch({ headless: true });
try {
  const A = await open(browser, `evf${RUN}`, 'main-floor');

  // Pin window 3 (Pulse Hour). A 'started' for Pulse Hour must appear.
  await A.page.evaluate((now) => window.__neon.setEventNow(now), 3 * W + 1000);
  await A.page.waitForFunction(() => window.__neon.feed().some((e) => /Pulse Hour started\./.test(e.summary)), null, { timeout: 8000 });
  check('room_event_started appears in the public feed (Pulse Hour started.)', has(await feedSummaries(A.page), /Pulse Hour started\./));

  // Baseline length at window 3 (let the window-3 transitions settle); repeated requests
  // must then add NOTHING (no spam).
  await A.page.waitForTimeout(200);
  const len3 = await feedLen(A.page);
  for (let i = 0; i < 3; i += 1) {
    await A.page.evaluate(() => window.__neon.client.requestRoomEvents());
    await A.page.evaluate(() => window.__neon.client.requestRoomState());
    await A.page.evaluate(() => window.__neon.client.requestCabinetCatalog());
  }
  await A.page.waitForTimeout(200);
  check('repeated room_events/state/catalog requests do not duplicate the feed', (await feedLen(A.page)) === len3);

  // Pin window 4 (Signal Sprint Relay, featured Signal) → exactly ended + started + featured_changed.
  await A.page.evaluate((now) => window.__neon.setEventNow(now), 4 * W + 1000);
  await A.page.waitForFunction(() => window.__neon.feed().some((e) => e.event_type === 'featured_cabinet_changed'), null, { timeout: 8000 });
  const after4 = (await feedSummaries(A.page)).slice(len3); // entries added by the window flip
  check('room_event_ended appears for the previous event (Pulse Hour ended.)', countMatch(after4, /Pulse Hour ended\./) === 1);
  check('a new room_event_started appears (Signal Sprint Relay started.)', countMatch(after4, /Signal Sprint Relay started\./) === 1);
  check('featured_cabinet_changed appears (now featuring Signal Sprint)', countMatch(after4, /is now featuring Signal Sprint/) === 1);
  check('the window flip added EXACTLY three announcements (no spam)', after4.length === 3);

  // Re-trigger at window 4 → still exactly three new entries (deduped).
  const len4 = await feedLen(A.page);
  for (let i = 0; i < 3; i += 1) await A.page.evaluate(() => window.__neon.client.requestRoomEvents());
  await A.page.waitForTimeout(200);
  check('no duplicate transitions on re-request at the same window', (await feedLen(A.page)) === len4);

  // A second client joining the same room sees the already-announced feed, with no re-spam.
  const B = await open(browser, `evfB${RUN}`, 'main-floor');
  await B.page.evaluate((now) => window.__neon.setEventNow(now), 4 * W + 1000);
  await B.page.waitForTimeout(200);
  check('a late joiner does not re-trigger duplicate announcements (room A unchanged)', (await feedLen(A.page)) === len4);

  // No money-like copy anywhere in the feed.
  const all = (await feedSummaries(A.page)).join(' ');
  check('no money-like copy in feed announcements', !/jackpot|multiplier|payout|cash ?out|win more|boosted|bonus cash|reward boost/i.test(all));

  const allErrors = [...A.errors, ...B.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}
console.log(failures === 0 ? '\nROOM-EVENT-FEED VALIDATION: PASS' : `\nROOM-EVENT-FEED VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
