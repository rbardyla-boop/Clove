/**
 * Phase 2a — Multi-room browser validation.
 *
 * Three clients across two rooms prove room isolation + safe switching: A+B in
 * main-floor, C in neon-training. Occupancy, tickets, inventory, and the public
 * feed are all room-scoped; switching rooms carries NO state across. Backwards
 * compatible (no ?room → main-floor). Portable Playwright (PW_REQUIRE_BASE).
 *
 * Run: tests/arcade/run-multi-room.sh
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

async function newClient(browser, id, room) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_)/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(id, room), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon, null, { timeout: 8000 });
  await page.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });
  await page.waitForFunction((r) => window.__neon.state().roomId === r, room || 'main-floor', { timeout: 8000 });
  return { page, errors };
}
const tickets = (c) => c.page.evaluate(() => window.__neon.state().tickets);
const roomOf = (c) => c.page.evaluate(() => window.__neon.state().roomId);
const feedJson = (c) => c.page.evaluate(() => JSON.stringify(window.__neon.state().feed));
const busy = (c, m) => c.page.evaluate((mm) => document.querySelector(`.cab[data-id="${mm}"]`).classList.contains('busy'), m);
const mine = (c, m) => c.page.evaluate((mm) => document.querySelector(`.cab[data-id="${mm}"]`).classList.contains('mine'), m);
async function playPulse(c) {
  const rid = await c.page.evaluate(async () => { window.__neon.client.startPulseRound('pulse'); await new Promise((r) => setTimeout(r, 250)); return window.__neon.state().roundId; });
  await c.page.evaluate((r) => window.__neon.client.submitPulseRound({ roundId: r, machineId: 'pulse', grade: 'A', accuracy: 88, hits: 16, bestStreak: 9, score: 1825, durationMs: 30000 }), rid);
}

const browser = await chromium.launch({ headless: true });
try {
  const A = await newClient(browser, `a${RUN}`, 'main-floor');
  const B = await newClient(browser, `b${RUN}`, 'main-floor');
  const C = await newClient(browser, `c${RUN}`, 'neon-training');
  check('A and B are in main-floor; C is in neon-training', (await roomOf(A)) === 'main-floor' && (await roomOf(B)) === 'main-floor' && (await roomOf(C)) === 'neon-training');

  // Room list is public-safe + lists all three rooms.
  await A.page.evaluate(() => window.__neon.client.requestRoomList());
  await A.page.waitForFunction(() => window.__neon.rooms().length >= 3, null, { timeout: 8000 });
  const roomList = await A.page.evaluate(() => JSON.stringify(window.__neon.rooms()));
  check('room list lists the three rooms', /main-floor/.test(roomList) && /neon-training/.test(roomList) && /late-night-circuit/.test(roomList));
  check('room list leaks no private state', !/balance|ledger|inventory|playerId/i.test(roomList));

  // A occupies Pulse Tap in main-floor; B sees it busy.
  await A.page.click('.cab[data-id="pulse"]');
  await A.page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('mine'), null, { timeout: 8000 });
  await B.page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('busy'), null, { timeout: 8000 });
  check('A occupies Pulse Tap in main-floor; B sees it busy', await mine(A, 'pulse') && await busy(B, 'pulse'));

  // C sees Pulse Tap FREE in neon-training (occupancy is room-scoped).
  check('C sees Pulse Tap FREE in neon-training (occupancy isolated)', !(await busy(C, 'pulse')));
  await C.page.click('.cab[data-id="pulse"]');
  await C.page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('mine'), null, { timeout: 8000 });
  check('C occupies Pulse Tap in neon-training while A still holds it in main-floor', await mine(C, 'pulse') && await mine(A, 'pulse'));

  // A earns in main-floor; C earns in neon-training. Balances are room-scoped.
  await playPulse(A);
  await A.page.waitForFunction(() => window.__neon.state().tickets === 20, null, { timeout: 8000 });
  await playPulse(C);
  await C.page.waitForFunction(() => window.__neon.state().tickets === 20, null, { timeout: 8000 });
  check('A earns 20 in main-floor; C earns 20 in neon-training', (await tickets(A)) === 20 && (await tickets(C)) === 20);

  // A redeems a badge in main-floor.
  await A.page.evaluate(() => window.__neon.client.redeemPrize('founder-badge-local'));
  await A.page.waitForFunction(() => window.__neon.state().inventory.some((i) => i.prize_id === 'founder-badge-local'), null, { timeout: 8000 });
  check('A redeems founder-badge-local in main-floor (20 → 10)', (await tickets(A)) === 10);

  // A switches to neon-training → NO state carries across.
  await A.page.evaluate(() => window.__neon.switchRoom('neon-training'));
  await A.page.waitForFunction(() => window.__neon.state().roomId === 'neon-training' && document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });
  await A.page.waitForFunction(() => window.__neon.state().tickets === 0, null, { timeout: 8000 });
  check('A carries NO main-floor ticket balance into neon-training (0)', (await tickets(A)) === 0);
  check('A carries NO main-floor inventory into neon-training', (await A.page.evaluate(() => window.__neon.state().inventory.length)) === 0);

  // A released main-floor on switch → B now sees Pulse Tap free in main-floor.
  await B.page.waitForFunction(() => !document.querySelector('.cab[data-id="pulse"]').classList.contains('busy'), null, { timeout: 8000 });
  check('A leaving main-floor freed its Pulse Tap (B sees it free)', !(await busy(B, 'pulse')));
  check('B stayed in main-floor and earned nothing', (await roomOf(B)) === 'main-floor' && (await tickets(B)) === 0);

  // A plays independently in neon-training (Signal Sprint; C holds Pulse there).
  await A.page.click('.cab[data-id="signal"]');
  await A.page.waitForFunction(() => document.querySelector('.cab[data-id="signal"]').classList.contains('mine'), null, { timeout: 8000 });
  const sr = await A.page.evaluate(async () => { window.__neon.client.startSignalRound('signal'); await new Promise((r) => setTimeout(r, 250)); return window.__neon.state().signalRoundId; });
  await A.page.evaluate((r) => window.__neon.client.submitSignalRound({ roundId: r, machineId: 'signal', grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000 }), sr);
  await A.page.waitForFunction(() => window.__neon.state().tickets === 24, null, { timeout: 8000 });
  check('A plays independently in neon-training (earns 24 fresh)', (await tickets(A)) === 24);

  // Feed isolation: C (test-c) only ever appears in neon-training's feed.
  const bFeed = await feedJson(B);          // main-floor feed
  const aFeed = await feedJson(A);          // neon-training feed (A switched here)
  check("B's main-floor feed never shows C (a neon-training player)", !bFeed.includes(`test-c${RUN}`));
  check("A's neon-training feed shows C's activity (it is neon-training's feed, not main-floor's)", aFeed.includes(`test-c${RUN}`));
  check("B's main-floor feed shows A's main-floor pulse award", /earned 20 tickets at Pulse Tap/.test(bFeed) && bFeed.includes(`test-a${RUN}`));
  check('feeds carry no private balance/ledger', !/balance|ledger|redemption_id/i.test(aFeed) && !/balance|ledger|redemption_id/i.test(bFeed));

  // Invalid room id is rejected (server authority).
  await A.page.evaluate(() => window.__neon.switchRoom('totally-unknown-room'));
  await A.page.waitForFunction(() => window.__neon.state().lastRoomReject === 'invalid_room', null, { timeout: 8000 });
  check('switching to an unknown room is rejected (invalid_room)', (await A.page.evaluate(() => window.__neon.state().lastRoomReject)) === 'invalid_room');

  // Reconnect to the same room restores that room's balance (A → neon-training has 24).
  await A.page.goto(url(`a${RUN}`, 'neon-training'), { waitUntil: 'load' });
  await A.page.waitForFunction(() => !!window.__neon, null, { timeout: 8000 });
  await A.page.waitForFunction(() => window.__neon.state().roomId === 'neon-training' && document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });
  await A.page.waitForFunction(() => window.__neon.state().tickets === 24, null, { timeout: 8000 });
  check('reconnect to neon-training restores its 24-ticket balance', (await tickets(A)) === 24);

  const allErrors = [...A.errors, ...B.errors, ...C.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}
console.log(failures === 0 ? '\nMULTI-ROOM VALIDATION: PASS' : `\nMULTI-ROOM VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
