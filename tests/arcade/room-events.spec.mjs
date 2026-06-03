/**
 * Phase 2e — room-events browser validation.
 *
 * Proves that the floor shows the current scheduled event, the lobby room cards carry
 * event badges, the event-featured cabinet tile is highlighted, the featured cabinet
 * still plays + awards tickets exactly as before (events are display-only), and that
 * event state survives a room switch — all with no console/page errors. The schedule
 * LOGIC is unit-tested in tests/arcade/room-events.test.mjs; this checks integration.
 *
 * main-floor's rotation is all `featured_cabinet`, so a cabinet is always featured
 * there regardless of the wall-clock window — the test reads which one at runtime.
 *
 * Runs against the dev shim (same pure room-events module as the Worker/DO).
 * Run: tests/arcade/run-room-events.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
const RUN = Date.now().toString(36);
const url = (id, room) => `${BASE}/arcade/index.html?test=1&id=${id}${room ? `&room=${room}` : ''}&ws=${encodeURIComponent(WS)}`;

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

// Drive a full server-authoritative round on whichever cabinet the event features,
// using the same client methods + valid payloads the frame-contract spec uses.
async function playFeatured(page, machine) {
  await page.evaluate((m) => window.__neon.client.occupy(m), machine);
  await page.waitForTimeout(200);
  if (machine === 'pulse') {
    const rid = await page.evaluate(async () => { window.__neon.client.startPulseRound('pulse'); await new Promise((r) => setTimeout(r, 250)); return window.__neon.state().roundId; });
    await page.evaluate((r) => window.__neon.client.submitPulseRound({ roundId: r, machineId: 'pulse', grade: 'A', accuracy: 88, hits: 16, bestStreak: 9, score: 1825, durationMs: 30000 }), rid);
  } else if (machine === 'signal') {
    const rid = await page.evaluate(async () => { window.__neon.client.startSignalRound('signal'); await new Promise((r) => setTimeout(r, 250)); return window.__neon.state().signalRoundId; });
    await page.evaluate((r) => window.__neon.client.submitSignalRound({ roundId: r, machineId: 'signal', grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000 }), rid);
  } else {
    const rid = await page.evaluate(async () => { window.__neon.client.startNeonGridRound('grid'); await new Promise((r) => setTimeout(r, 250)); return window.__neon.state().gridRoundId; });
    await page.evaluate((r) => window.__neon.client.submitNeonGridRound({ roundId: r, machineId: 'grid', grade: 'A', score: 5000, correctSteps: 40, completedPatterns: 6, mistakes: 2, bestStreak: 18, durationMs: 22000 }), rid);
  }
  await page.waitForFunction(() => window.__neon.state().tickets > 0, null, { timeout: 8000 });
}

const browser = await chromium.launch({ headless: true });
try {
  const A = await open(browser, `ev${RUN}`, 'main-floor');

  // Floor shows the current scheduled room event (banner + name).
  await A.page.waitForFunction(() => !!window.__neon.roomEvent(), null, { timeout: 8000 });
  const ev = await A.page.evaluate(() => window.__neon.roomEvent());
  check('floor exposes a current room event', !!ev && typeof ev.display_name === 'string' && ev.display_name.length > 0);
  await A.page.waitForFunction(() => { const b = document.getElementById('roomEventBanner'); return b && !b.hidden; }, null, { timeout: 8000 });
  const bannerName = await A.page.evaluate(() => document.getElementById('roomEventName')?.textContent || '');
  check('floor event banner renders the event name', bannerName.length > 0 && bannerName === ev.display_name);

  // main-floor events are all featured_cabinet -> a cabinet is always featured.
  const featured = await A.page.evaluate(() => window.__neon.featuredMachine());
  check('an event-featured cabinet is identified', ['pulse', 'signal', 'grid'].includes(featured));
  const tileFeatured = await A.page.evaluate((m) => document.querySelector(`.cab[data-id="${m}"]`)?.dataset.featured === '1', featured);
  check('the featured cabinet tile is highlighted', tileFeatured === true);
  const featuredCount = await A.page.evaluate(() => [...document.querySelectorAll('.cab.powered')].filter((c) => c.dataset.featured === '1').length);
  check('exactly one cabinet is featured at a time', featuredCount === 1);

  // The featured cabinet plays + awards tickets exactly as before (display-only event).
  await playFeatured(A.page, featured);
  const awarded = await A.page.evaluate(() => window.__neon.state().tickets);
  check('playing the featured cabinet awards tickets normally', awarded > 0);
  // Release so the cabinet mini-game overlay closes before we open the lobby.
  await A.page.evaluate((m) => window.__neon.client.release(m), featured);
  await A.page.waitForFunction(() => !document.querySelector('.cf-overlay.show'), null, { timeout: 8000 });

  // Lobby room cards carry event badges + a next-event preview.
  await A.page.click('#roomBtn');
  await A.page.waitForFunction(() => document.querySelector('.lobby-overlay.show'), null, { timeout: 8000 });
  await A.page.waitForFunction(() => document.querySelectorAll('.lobby-room').length >= 3, null, { timeout: 8000 });
  const eventCards = await A.page.evaluate(() => document.querySelectorAll('.lobby-room .lr-event').length);
  check('lobby room cards show scheduled-event badges', eventCards >= 1);
  const mainCardEvent = await A.page.evaluate(() => document.querySelector('.lobby-room[data-room="main-floor"]')?.dataset.event);
  check('main-floor card advertises a featured_cabinet event', mainCardEvent === 'featured_cabinet');
  const nextPreview = await A.page.evaluate(() => document.querySelectorAll('.lobby-room .lr-event-next').length);
  check('a next-event preview is shown', nextPreview >= 1);

  // Event state survives a room switch (clears, then this room's events repopulate).
  // switchRoom is driven through the client directly, so the open lobby is irrelevant.
  await A.page.evaluate(() => window.__neon.switchRoom('neon-training'));
  await A.page.waitForFunction(() => window.__neon.roomId() === 'neon-training', null, { timeout: 8000 });
  await A.page.waitForFunction(() => !!window.__neon.roomEvent(), null, { timeout: 8000 });
  const trainingEv = await A.page.evaluate(() => window.__neon.roomEvent());
  check('switched room shows its own event', !!trainingEv && trainingEv.room_id === 'neon-training');
  await A.page.evaluate(() => window.__neon.switchRoom('main-floor'));
  await A.page.waitForFunction(() => window.__neon.roomId() === 'main-floor', null, { timeout: 8000 });
  await A.page.waitForFunction(() => !!window.__neon.roomEvent(), null, { timeout: 8000 });
  check('event state survives reconnect (event present after switching back)', await A.page.evaluate(() => !!window.__neon.roomEvent()));

  // No money-like copy anywhere in the rendered floor + lobby.
  const visibleText = await A.page.evaluate(() => document.body.innerText);
  check('no money-like copy in event UI', !/jackpot|multiplier|payout|cash ?out|win more|boosted/i.test(visibleText));

  check('no console / page errors', A.errors.length === 0);
  if (A.errors.length) console.log('  errors:', JSON.stringify(A.errors, null, 2));
} finally {
  await browser.close();
}
console.log(failures === 0 ? '\nROOM-EVENTS VALIDATION: PASS' : `\nROOM-EVENTS VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
