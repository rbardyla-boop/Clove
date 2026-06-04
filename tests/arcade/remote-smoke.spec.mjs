/**
 * Phase 3B — remote smoke harness for a deployed (or local) Neon Circuit arcade.
 *
 * Drives the SAME public client + protocol a real player uses, against URLs given
 * purely by environment — so it runs identically against `wrangler dev`, a staging
 * deploy, or production. No hardcoded URLs, no secrets in the file.
 *
 *   BASE_URL                 static client origin (serves arcade/index.html)
 *   WS_URL                   Worker WebSocket URL (…/arcade/ws)
 *   API_URL                  Worker HTTP origin (default: derived from WS_URL)
 *   ADMIN_TOKEN              operational admin secret (optional; never logged)
 *   EXPECT_ENVIRONMENT       'production' | 'development' (gates the test-clock assertion)
 *   EXPECT_ADMIN_ENABLED     'true' | 'false' (gates the admin-success assertion)
 *   ALLOW_REMOTE_ADMIN_MUTATION  'true' to permit state-changing admin ops (default: off)
 *   PW_REQUIRE_BASE          node_modules parent that resolves `playwright`
 *
 * Run: see tests/arcade/run-remote-smoke.sh
 *
 * Safety: non-destructive by default. It occupies a cabinet with a throwaway player
 * id and releases it; it NEVER calls a state-wiping admin op (reset/set_*) unless
 * ALLOW_REMOTE_ADMIN_MUTATION=true. The display-only event-clock override it sends to
 * prove the test hook is rejected is restored afterward (and is a no-op in production).
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
function deriveApi(ws) {
  try { const u = new URL(ws); return `${u.protocol === 'wss:' ? 'https:' : 'http:'}//${u.host}`; }
  catch { return null; }
}
const API = process.env.API_URL || deriveApi(WS);
const EXPECT_ENV = process.env.EXPECT_ENVIRONMENT || null;      // 'production' | 'development' | null
const EXPECT_ADMIN = process.env.EXPECT_ADMIN_ENABLED || null;  // 'true' | 'false' | null
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;
const ALLOW_MUTATION = process.env.ALLOW_REMOTE_ADMIN_MUTATION === 'true';
const RUN = Date.now().toString(36);
const ROOM = 'main-floor';

let failures = 0;
let skips = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail && !cond ? `  — ${detail}` : ''}`);
  if (!cond) failures++;
};
const skip = (name, why) => { console.log(`skip ${name}  — ${why}`); skips++; };

const clientUrl = (id) => `${BASE}/arcade/index.html?test=1&id=${id}&ws=${encodeURIComponent(WS)}`;
const isExternalNoise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t)
  || /net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_)/.test(t);

async function newClient(browser, id) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isExternalNoise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(clientUrl(id), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon, null, { timeout: 12000 });
  await page.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 12000 });
  return { ctx, page, errors };
}

/**
 * Open a raw WebSocket INSIDE the browser page (no node WS dependency), optionally
 * join the room, send a staggered list of messages, and return every parsed message
 * received until the socket goes quiet. Used for the protocol-level safety checks.
 */
function wsRoundtrip(page, { join = true, playerId = `smoke_${RUN}`, sends = [], settleMs = 700 }) {
  return page.evaluate((args) => new Promise((resolve) => {
    const { wsUrl, room, join, playerId, sends, settleMs } = args;
    const url = wsUrl + (wsUrl.includes('?') ? '&' : '?') + 'room=' + encodeURIComponent(room);
    const ws = new WebSocket(url);
    const msgs = [];
    let done = false, settleTimer = null;
    const finish = () => { if (done) return; done = true; clearTimeout(settleTimer); try { ws.close(); } catch (e) {} resolve(msgs); };
    const settle = () => { clearTimeout(settleTimer); settleTimer = setTimeout(finish, settleMs); };
    const hardStop = setTimeout(finish, 14000);
    ws.onopen = () => {
      if (join) ws.send(JSON.stringify({ t: 'room_join_request', roomId: room, playerId }));
      let i = 0;
      const next = () => { if (i < sends.length) { ws.send(JSON.stringify(sends[i++])); setTimeout(next, 180); } };
      setTimeout(next, join ? 350 : 0);
      settle();
    };
    ws.onmessage = (e) => { try { msgs.push(JSON.parse(e.data)); } catch (err) {} settle(); };
    ws.onerror = () => finish();
    ws.onclose = () => { clearTimeout(hardStop); finish(); };
  }), { wsUrl: WS, room: ROOM, join, playerId, sends, settleMs });
}

// ── 1. HTTP endpoints (public-safe) ──────────────────────────────────────────
async function httpGet(path) {
  if (!API) return { ok: false, skipped: true };
  try {
    const res = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { ok: res.ok, status: res.status, json, text };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

async function httpChecks() {
  if (!API) { skip('GET /arcade/health', 'no API_URL/WS_URL host'); skip('GET /arcade/rooms', 'no API host'); skip('GET /arcade/rooms/health', 'no API host'); return; }

  const health = await httpGet('/arcade/health');
  check('GET /arcade/health returns ok', !!health.json && health.json.ok === true, `status=${health.status} err=${health.error || ''}`);
  check('health names the arcade service', !!health.json && health.json.service === 'neon-arcade-mesh', JSON.stringify(health.json));
  check('health advertises 3 rooms', !!health.json && Array.isArray(health.json.rooms) && health.json.rooms.length === 3
    && health.json.rooms.includes('main-floor'), JSON.stringify(health.json && health.json.rooms));

  const rooms = await httpGet('/arcade/rooms');
  const roomList = rooms.json && Array.isArray(rooms.json.rooms) ? rooms.json.rooms : null;
  check('GET /arcade/rooms returns a room list', !!roomList && roomList.length >= 1, JSON.stringify(rooms.json));
  check('room list is public-safe (no private/economy fields)',
    !!rooms.text && !/balance|ledger|inventory|admin_token|"token"|redemption/i.test(rooms.text),
    'leaked a private field');

  const rhealth = await httpGet('/arcade/rooms/health');
  check('GET /arcade/rooms/health returns a public-safe envelope',
    !!rhealth.json && ('rooms' in rhealth.json) && !/balance|ledger|admin_token|"token"/i.test(rhealth.text || ''),
    JSON.stringify(rhealth.json));
}

// ── 2. Gameplay loop (real client, server authority) ─────────────────────────
async function gameplayChecks(browser) {
  const A = await newClient(browser, `ra${RUN}`);
  const B = await newClient(browser, `rb${RUN}`);
  check('two clients connect to main-floor', true);

  await A.page.click('.cab[data-id="pulse"]');
  await A.page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('mine'), null, { timeout: 10000 });
  check('client A can occupy a cabinet', await A.page.evaluate(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('mine')));

  await B.page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('busy'), null, { timeout: 10000 });
  check('second client sees occupancy', await B.page.evaluate(() => {
    const n = document.querySelector('.cab[data-id="pulse"]');
    return n.classList.contains('busy') && !n.classList.contains('mine');
  }));

  const roundId = await A.page.evaluate(async () => {
    window.__neon.client.startPulseRound('pulse');
    await new Promise((r) => setTimeout(r, 250));
    return window.__neon.state().roundId;
  });
  check('server issues a round id (start/submit works)', typeof roundId === 'string' && roundId.length > 0);
  await A.page.evaluate((rid) => window.__neon.client.submitPulseRound(
    { roundId: rid, machineId: 'pulse', grade: 'A', accuracy: 88, hits: 16, bestStreak: 9, score: 1825, durationMs: 30000 }
  ), roundId);
  await A.page.waitForFunction(() => window.__neon.state().tickets > 0, null, { timeout: 10000 });
  check('server awards internal tickets', (await A.page.evaluate(() => window.__neon.state().tickets)) > 0);

  await A.page.evaluate(() => window.__neon.client.requestTicketLedger());
  await A.page.waitForFunction(() => (window.__neon.state().ledger || []).length > 0, null, { timeout: 10000 });
  check('ledger updates privately for the earner', (await A.page.evaluate(() => (window.__neon.state().ledger || []).length)) > 0);

  // Second client sees occupancy but NOT A's private balance/ledger.
  const bView = await B.page.evaluate(() => JSON.stringify(window.__neon.state().publicCosmetics || {}));
  check('second client cannot see private balance/ledger', !/balance|ledger|redemption/i.test(bView));

  // Be polite to a shared/production room: release the cabinet.
  await A.page.evaluate(() => window.__neon.client.release('pulse'));
  await B.page.waitForFunction(() => !document.querySelector('.cab[data-id="pulse"]').classList.contains('busy'), null, { timeout: 10000 }).catch(() => {});

  return [...A.errors, ...B.errors];
}

// ── 3. Protocol safety: presentation, test-clock, admin gate ─────────────────
async function safetyChecks(browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isExternalNoise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(`${BASE}/arcade/index.html?test=1&id=smoke${RUN}&ws=${encodeURIComponent(WS)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon, null, { timeout: 12000 });

  const firstEvents = (msgs) => msgs.filter((m) => m && m.t === 'room_events');
  const lastEvents = (msgs) => { const e = firstEvents(msgs); return e[e.length - 1]; };

  // Presentation block is present, public-safe, and within clamp bounds.
  const presMsgs = await wsRoundtrip(page, { sends: [{ t: 'room_events_request' }] });
  const pres = (lastEvents(presMsgs) || {}).presentation;
  check('event presentation block is present', !!pres && typeof pres === 'object', JSON.stringify(pres));
  check('presentation preroll_lead_ms is a sane number', !!pres && Number.isFinite(pres.preroll_lead_ms)
    && pres.preroll_lead_ms >= 10000 && pres.preroll_lead_ms <= 20 * 60 * 1000 - 1000, JSON.stringify(pres));
  check('presentation show flags are booleans', !!pres && typeof pres.show_next_event === 'boolean'
    && typeof pres.show_featured_chip === 'boolean', JSON.stringify(pres));
  if (EXPECT_ENV === 'production') {
    check('presentation reflects production EVENT_PREROLL_LEAD_MS default (120000)', !!pres && pres.preroll_lead_ms === 120000,
      `got ${pres && pres.preroll_lead_ms}`);
  }

  // Test-clock hook: prove it is rejected in production (and detectable in dev).
  const JUMP = 7 * 60 * 1000;
  const clockMsgs = await wsRoundtrip(page, {
    settleMs: 900,
    sends: [
      { t: 'room_events_request' },
      { t: '__test_set_event_now', nowMs: Date.now() + JUMP },
      { t: 'room_events_request' },
    ],
  });
  const evs = firstEvents(clockMsgs);
  const before = evs[0] || null;
  const after = evs[evs.length - 1] || null;
  const sig = (e) => e ? `${e.current_event && e.current_event.event_id || 'none'}|${e.event_ends_in_ms}` : null;
  const changed = !!before && !!after && (
    (before.current_event && before.current_event.event_id) !== (after.current_event && after.current_event.event_id)
    || (Number(before.event_ends_in_ms) - Number(after.event_ends_in_ms) > 2 * 60 * 1000)
  );
  if (EXPECT_ENV === 'development') {
    check('__test_set_event_now is honored in development (harness can detect it)', changed, `${sig(before)} -> ${sig(after)}`);
  } else if (EXPECT_ENV) {
    // Any non-development env (production, staging, …) must REJECT the test clock.
    check(`__test_set_event_now is REJECTED in ${EXPECT_ENV}`, !!before && !!after && !changed, `${sig(before)} -> ${sig(after)}`);
  } else {
    skip('test-clock rejection assertion', 'set EXPECT_ENVIRONMENT (development asserts honored; anything else asserts rejected)');
  }
  // Always restore the display-only override (no-op where the hook is gated/rejected).
  await wsRoundtrip(page, { sends: [{ t: '__test_set_event_now', nowMs: null }] });

  // Admin gate: both-gate (flag + token). diagnostics is read-only / non-destructive.
  const adminResult = (msgs) => msgs.filter((m) => m && m.t === 'room_admin_result').pop() || null;
  const noToken = adminResult(await wsRoundtrip(page, { sends: [{ t: 'room_admin', op: 'diagnostics' }] }));
  check('admin op with NO token is rejected', !!noToken && noToken.ok === false,
    JSON.stringify(noToken));
  const wrongTok = adminResult(await wsRoundtrip(page, { sends: [{ t: 'room_admin', op: 'diagnostics', token: `wrong-${RUN}` }] }));
  check('admin op with WRONG token is rejected', !!wrongTok && wrongTok.ok === false,
    JSON.stringify(wrongTok));

  let adminMsgsForLeak = [...(noToken ? [noToken] : []), ...(wrongTok ? [wrongTok] : [])];
  if (ADMIN_TOKEN) {
    const goodMsgs = await wsRoundtrip(page, { sends: [{ t: 'room_admin', op: 'diagnostics', token: ADMIN_TOKEN }] });
    const good = adminResult(goodMsgs);
    adminMsgsForLeak = adminMsgsForLeak.concat(goodMsgs.filter((m) => m && m.t === 'room_admin_result'));
    if (EXPECT_ADMIN === 'true') {
      check('admin op with CORRECT token succeeds (admin enabled)', !!good && good.ok === true, JSON.stringify(good));
    } else if (EXPECT_ADMIN === 'false') {
      check('admin op with CORRECT token is still rejected (admin disabled)', !!good && good.ok === false
        && good.reason === 'admin_disabled', JSON.stringify(good));
    } else {
      skip('correct-token admin assertion', 'set EXPECT_ADMIN_ENABLED=true|false to assert');
    }
    // The admin token must NEVER echo back in any server payload.
    const allText = JSON.stringify(adminMsgsForLeak);
    check('admin token never appears in server payloads', !allText.includes(ADMIN_TOKEN));
  } else {
    skip('correct-token admin op', 'no ADMIN_TOKEN provided');
  }

  if (!ALLOW_MUTATION) {
    check('no destructive admin mutation performed (reset gated)', true);
  }

  await ctx.close();
  return errors;
}

// ── run ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
let pageErrors = [];
try {
  console.log(`# remote-smoke target: BASE=${BASE} WS=${WS} API=${API || '(none)'} env=${EXPECT_ENV || '?'} admin=${EXPECT_ADMIN || '?'}`);
  await httpChecks();
  pageErrors = pageErrors.concat(await gameplayChecks(browser));
  pageErrors = pageErrors.concat(await safetyChecks(browser));
  check('no console / page errors', pageErrors.length === 0);
  if (pageErrors.length) console.log('  errors:', JSON.stringify(pageErrors, null, 2));
} catch (e) {
  console.log('FAIL harness threw: ' + (e && e.stack || e));
  failures++;
} finally {
  await browser.close();
}

console.log(`\nREMOTE SMOKE: ${failures === 0 ? 'PASS' : `${failures} FAILURE(S)`}${skips ? ` (${skips} skipped)` : ''}`);
process.exit(failures === 0 ? 0 : 1);
