/**
 * Phase 2d — smart-lobby presence UX browser validation.
 *
 * Proves the lobby renders recommendations + activity summaries + presence-driven
 * sorting from the public room list, that a recommendation chip routes the player
 * (smart join), and that none of it throws. The recommendation/activity/sort LOGIC
 * is unit-tested in tests/arcade/room-recommend.test.mjs; this checks integration.
 *
 * Server is unchanged from Phase 2c — runs against the dev shim.
 * Run: tests/arcade/run-room-presence-ux.sh
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

const browser = await chromium.launch({ headless: true });
try {
  // B occupies neon-training so it has live population; A observes from main-floor.
  const B = await open(browser, `uxb${RUN}`, 'neon-training');
  const A = await open(browser, `uxa${RUN}`, 'main-floor');

  // Open A's lobby (the room chip / button toggles it) and let the room list arrive.
  await A.page.click('#roomBtn');
  await A.page.waitForFunction(() => document.querySelector('.lobby-overlay.show'), null, { timeout: 8000 });
  await A.page.waitForFunction(() => document.querySelectorAll('.lobby-room').length >= 3, null, { timeout: 8000 });

  // Activity summaries render on every room card.
  const activityCount = await A.page.evaluate(() => document.querySelectorAll('.lobby-room .lr-activity').length);
  check('every room card shows an activity summary', activityCount >= 3);

  // Presence-driven sorting: the first card is an active/healthy room, never closed/offline.
  const firstActivity = await A.page.evaluate(() => document.querySelector('.lobby-room')?.dataset.activity);
  check('presence sorting puts an active/healthy room first', ['busy', 'lively', 'active'].includes(firstActivity));

  // A recommendations banner appears with at least one smart-join chip (neon-training
  // is healthy + populated by B, so it is recommended to A who is in main-floor).
  await A.page.waitForFunction(() => {
    const el = document.querySelector('.lobby-recos');
    return el && !el.hidden && el.querySelectorAll('.lr-reco').length >= 1;
  }, null, { timeout: 8000 });
  const recoTargets = await A.page.evaluate(() => [...document.querySelectorAll('.lr-reco')].map((b) => b.dataset.room));
  check('a recommendation chip is shown and targets a real room', recoTargets.length >= 1 && recoTargets.every((t) => typeof t === 'string' && t.length > 0));
  check('recommendations never target the current room', !recoTargets.includes('main-floor'));

  // Smart join: clicking a recommendation routes A to that room.
  const target = recoTargets[0];
  await A.page.click(`.lr-reco[data-room="${target}"]`);
  await A.page.waitForFunction((t) => window.__neon.roomId() === t, target, { timeout: 8000 });
  check('clicking a recommendation routes the player there (smart join)', (await A.page.evaluate(() => window.__neon.roomId())) === target);

  const allErrors = [...A.errors, ...B.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}
console.log(failures === 0 ? '\nROOM-PRESENCE-UX VALIDATION: PASS' : `\nROOM-PRESENCE-UX VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
