/**
 * Phase 2b — room lifecycle admin (reset + status) browser validation.
 *
 * Proves admin gating (dev flag + token), room reset (wipes a room's state), and
 * room status (closed/maintenance rejects new joins). The dev shim is started with
 * admin enabled + an ephemeral token; the same token arrives via ADMIN_TEST_TOKEN.
 *
 * Run: tests/arcade/run-room-admin.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
const TOKEN = process.env.ADMIN_TEST_TOKEN || '';
const RUN = Date.now().toString(36);
const url = (id, room) => `${BASE}/arcade/index.html?test=1&id=${id}${room ? `&room=${room}` : ''}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };

async function open(browser, id, room, waitLive = true) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(id, room), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon, null, { timeout: 8000 });
  if (waitLive) await page.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });
  return { page, ctx, errors };
}
const tickets = (c) => c.page.evaluate(() => window.__neon.state().tickets);
const adminRes = (c) => c.page.evaluate(() => window.__neon.state().lastRoomAdmin);

const browser = await chromium.launch({ headless: true });
try {
  check('admin test token provided to the spec', TOKEN.length > 0);
  const A = await open(browser, `adm${RUN}`, 'main-floor');

  // A occupies + earns tickets in main-floor.
  await A.page.click('.cab[data-id="pulse"]');
  await A.page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('mine'), null, { timeout: 8000 });
  const rid = await A.page.evaluate(async () => { window.__neon.client.startPulseRound('pulse'); await new Promise((r) => setTimeout(r, 250)); return window.__neon.state().roundId; });
  await A.page.evaluate((r) => window.__neon.client.submitPulseRound({ roundId: r, machineId: 'pulse', grade: 'A', accuracy: 88, hits: 16, bestStreak: 9, score: 1825, durationMs: 30000 }), rid);
  await A.page.waitForFunction(() => window.__neon.state().tickets === 20, null, { timeout: 8000 });
  check('A earned 20 tickets in main-floor', (await tickets(A)) === 20);

  // Admin reset with a WRONG token is rejected; state is untouched.
  await A.page.evaluate(() => window.__neon.adminReset('main-floor', 'wrong-token'));
  await A.page.waitForFunction(() => window.__neon.state().lastRoomAdmin && window.__neon.state().lastRoomAdmin.ok === false, null, { timeout: 8000 });
  check('admin reset with a wrong token is rejected (bad_admin_token)', (await adminRes(A)).reason === 'bad_admin_token');
  check('A balance is untouched by the rejected reset (still 20)', (await tickets(A)) === 20);

  // Admin reset with the RIGHT token wipes the room → A balance returns to 0.
  await A.page.evaluate((t) => window.__neon.adminReset('main-floor', t), TOKEN);
  await A.page.waitForFunction(() => window.__neon.state().lastRoomAdmin && window.__neon.state().lastRoomAdmin.ok === true, null, { timeout: 8000 });
  await A.page.waitForFunction(() => window.__neon.state().tickets === 0, null, { timeout: 8000 });
  check('admin reset with the right token succeeds and wipes the room (A → 0)', (await adminRes(A)).ok === true && (await tickets(A)) === 0);

  // Admin sets neon-training to maintenance → a new client cannot join it.
  await A.page.evaluate((t) => window.__neon.adminSetStatus('neon-training', 'maintenance', t), TOKEN);
  await A.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return a && a.ok && a.status === 'maintenance'; }, null, { timeout: 8000 });
  check('admin set neon-training → maintenance', (await adminRes(A)).status === 'maintenance');

  const C = await open(browser, `c${RUN}`, 'neon-training', false); // join will be rejected, never goes live
  await C.page.waitForFunction(() => window.__neon.state().lastRoomReject === 'room_maintenance', null, { timeout: 8000 });
  check('a new client cannot join a room under maintenance (room_maintenance)', (await C.page.evaluate(() => window.__neon.state().lastRoomReject)) === 'room_maintenance');

  // Admin re-opens neon-training → a fresh client can join.
  await A.page.evaluate((t) => window.__neon.adminSetStatus('neon-training', 'open', t), TOKEN);
  await A.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return a && a.ok && a.status === 'open'; }, null, { timeout: 8000 });
  const C2 = await open(browser, `c2${RUN}`, 'neon-training');
  check('after re-opening, a client joins neon-training normally', (await C2.page.evaluate(() => window.__neon.state().roomId)) === 'neon-training');

  const allErrors = [...A.errors, ...C.errors, ...C2.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}
console.log(failures === 0 ? '\nROOM-ADMIN VALIDATION: PASS' : `\nROOM-ADMIN VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
