/**
 * Phase 2c — room presence health browser validation.
 *
 * Proves the lobby surfaces per-room HEALTH + freshness + profile labels, that
 * admin diagnostics are gated by the same dev-flag + token rule and leak nothing
 * private, and that closed/maintenance rooms reject new joins. The dev shim is
 * started with admin enabled + an ephemeral token (also passed via ADMIN_TEST_TOKEN).
 *
 * Modes (env):
 *   HEALTH_TEST_HOOKS=1  -> run the stale/offline checks via the shim's test hook
 *                           (the real DO has no such hook, so it stays off there).
 *   REAL_DO=1            -> also verify the HTTP /arcade/rooms/health endpoint.
 *
 * Run: tests/arcade/run-room-health.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
const TOKEN = process.env.ADMIN_TEST_TOKEN || '';
const TEST_HOOKS = process.env.HEALTH_TEST_HOOKS === '1';
const REAL_DO = process.env.REAL_DO === '1';
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
const rooms = (c) => c.page.evaluate(() => { window.__neon.requestRoomList(); return new Promise((r) => setTimeout(() => r(window.__neon.rooms()), 250)); });
const findRoom = (list, id) => list.find((r) => r.room_id === id);
const adminRes = (c) => c.page.evaluate(() => window.__neon.state().lastRoomAdmin);

const browser = await chromium.launch({ headless: true });
try {
  check('admin test token provided to the spec', TOKEN.length > 0);
  const A = await open(browser, `h${RUN}`, 'main-floor');

  // ── room list shows HEALTH + freshness + profile labels ──────────────────────
  let list = await rooms(A);
  const main = findRoom(list, 'main-floor');
  check('room list shows health for the joined room (main-floor healthy)', main && main.health === 'healthy');
  check('room list shows population freshness (main-floor not estimated)', main && main.population_is_estimated === false);
  const training = findRoom(list, 'neon-training');
  check('room list carries per-room profile labels (neon-training → Training)', training && training.profile_label === 'Training');
  const VALID_HEALTH = ['healthy', 'stale', 'offline', 'closed', 'maintenance', 'unknown'];
  check('every room reports a valid health state', list.every((r) => VALID_HEALTH.includes(r.health)));
  // A truly-fresh registry (the dev shim restarts per run) reports an unjoined room
  // as `unknown`. The real DO/registry persists across specs in one wrangler session,
  // so neon-training may already be known there — assert `unknown` only when fresh.
  if (!REAL_DO) check('an unjoined room reports unknown health on a fresh registry', training && training.health === 'unknown');

  // ── admin diagnostics: gated + private-safe ──────────────────────────────────
  await A.page.evaluate(() => window.__neon.adminDiagnostics('wrong-token'));
  await A.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return !!a && a.ok === false; }, null, { timeout: 8000 });
  check('admin diagnostics with a wrong token is denied (bad_admin_token)', (await adminRes(A)).reason === 'bad_admin_token');

  await A.page.evaluate((t) => window.__neon.adminDiagnostics(t), TOKEN);
  await A.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return a && a.ok === true && a.op === 'diagnostics' && Array.isArray(a.diagnostics); }, null, { timeout: 8000 });
  const diag = (await adminRes(A)).diagnostics;
  check('admin diagnostics with the right token returns per-room operational detail', Array.isArray(diag) && diag.length >= 3);
  const dMain = diag.find((d) => d.room_id === 'main-floor');
  check('diagnostics include health + generation + population counts', !!dMain && typeof dMain.health === 'string' && typeof dMain.reset_generation === 'number' && typeof dMain.active_connection_count === 'number');
  check('diagnostics leak no token / balance / ledger / inventory / player id', !/balance|ledger|inventory|player|token|socket/i.test(JSON.stringify(diag)) && !JSON.stringify(diag).includes(TOKEN));

  // ── stale / offline (shim test hook only) ────────────────────────────────────
  if (TEST_HOOKS) {
    await A.page.evaluate(() => window.__neon.setHeartbeatAge('main-floor', 40_000)); // 40s → stale
    list = await rooms(A);
    const staleMain = findRoom(list, 'main-floor');
    check('a stale heartbeat marks the room stale + population estimated', staleMain && staleMain.health === 'stale' && staleMain.population_is_estimated === true);

    await A.page.evaluate(() => window.__neon.setHeartbeatAge('main-floor', 100_000)); // 100s → offline
    list = await rooms(A);
    const offMain = findRoom(list, 'main-floor');
    check('an offline heartbeat evicts population to 0 (no ghost population)', offMain && offMain.health === 'offline' && offMain.population === 0);
  } else {
    console.log('ok   (stale/offline hook checks skipped — real DO has no test hook)');
  }

  // ── closed / maintenance rejects new joins ───────────────────────────────────
  await A.page.evaluate((t) => window.__neon.adminSetStatus('neon-training', 'maintenance', t), TOKEN);
  await A.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return a && a.ok && a.status === 'maintenance'; }, null, { timeout: 8000 });
  list = await rooms(A);
  const maint = findRoom(list, 'neon-training');
  check('room list reflects maintenance health', maint && maint.health === 'maintenance');
  const C = await open(browser, `hc${RUN}`, 'neon-training', false);
  await C.page.waitForFunction(() => window.__neon.state().lastRoomReject === 'room_maintenance', null, { timeout: 8000 });
  check('a new client cannot join a room under maintenance', (await C.page.evaluate(() => window.__neon.state().lastRoomReject)) === 'room_maintenance');

  // re-open so the suite leaves rooms joinable
  await A.page.evaluate((t) => window.__neon.adminSetStatus('neon-training', 'open', t), TOKEN);
  await A.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return a && a.ok && a.status === 'open'; }, null, { timeout: 8000 });

  // ── real DO only: HTTP registry-health endpoint ──────────────────────────────
  if (REAL_DO) {
    const origin = WS.replace(/^ws/, 'http').replace(/\/arcade\/ws.*$/, '');
    const res = await fetch(`${origin}/arcade/rooms/health`);
    const body = await res.json();
    check('GET /arcade/rooms/health returns the 2c registry envelope', body.ok === true && body.phase === '2c' && Array.isArray(body.rooms) && body.rooms.length >= 3);
    check('registry-health endpoint leaks no private data', !/balance|ledger|inventory|player|token|socket/i.test(JSON.stringify(body)));
  }

  const allErrors = [...A.errors, ...C.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}
console.log(failures === 0 ? '\nROOM-HEALTH VALIDATION: PASS' : `\nROOM-HEALTH VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
