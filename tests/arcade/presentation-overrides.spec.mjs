/**
 * Phase 2i — live-ops per-room presentation overrides browser validation.
 *
 * Proves the full admin override flow end-to-end and that it is DISPLAY-ONLY + per-room:
 *   • admin gating (wrong token rejected) on the new presentation ops;
 *   • set_presentation applies a per-room override → that room's FLOOR reflects it
 *     (wider pre-roll lead fires `upcoming` earlier; show_featured_chip flag flows through);
 *   • a DIFFERENT room is unaffected (isolation): same clock, base lead → no upcoming;
 *   • preview_presentation does NOT persist (diagnostics still show the applied override);
 *   • presentation_diagnostics reports per-room override + effective config;
 *   • clear_presentation reverts the room to the base config;
 *   • the lobby live-ops panel renders per-room controls + an override marker;
 *   • no money-like copy, zero console/page errors.
 *
 * Works on the dev shim AND a real Worker/DO under `wrangler dev` (ENVIRONMENT=development,
 * ADMIN_ENABLED=true, ADMIN_TOKEN set). Run: tests/arcade/run-presentation-overrides.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
import { EVENT_WINDOW_MS, eventPresentationFromEnv } from '../../workers/arcade/src/room-events.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
const TOKEN = process.env.ADMIN_TEST_TOKEN || '';
const RUN = Date.now().toString(36);
// Phase 3E: the lobby admin (live-ops) UI is hidden unless explicitly enabled; the
// operator driver opens with admin=1 so the ⚙ panel renders. The server still gates.
const url = (id, room, admin = false) => `${BASE}/arcade/index.html?test=1&id=${id}${room ? `&room=${room}` : ''}${admin ? '&admin=1' : ''}&ws=${encodeURIComponent(WS)}`;
const W = EVENT_WINDOW_MS;
const BASE_CFG = eventPresentationFromEnv({}); // hard default base (shim started without EVENT_* vars)
const WIDE = 300000;             // 5-min override lead
const fourMinOut = 4 * W - 4 * 60 * 1000; // 4 min before window 4: inside a 5-min lead, outside the 2-min base lead

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };

async function open(browser, id, room, waitLive = true, admin = false) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(id, room, admin), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon, null, { timeout: 8000 });
  if (waitLive) await page.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });
  return { page, ctx, errors };
}
const adminRes = (c) => c.page.evaluate(() => window.__neon.state().lastRoomAdmin);
const pres = (c) => c.page.evaluate(() => window.__neon.eventPresentation());
const waitAdminOk = (c) => c.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return a && a.ok === true; }, null, { timeout: 8000 });

const browser = await chromium.launch({ headless: true });
try {
  check('admin test token provided to the spec', TOKEN.length > 0);
  const A = await open(browser, `a${RUN}`, 'main-floor', true, true); // operator/admin driver (admin UI on)
  const C = await open(browser, `c${RUN}`, 'neon-training');  // the room we will override

  // ── Phase 3E: the admin (live-ops) gear is HIDDEN for a public client (no ?admin=1) ──
  await C.page.click('#roomBtn');
  await C.page.waitForSelector('.lobby-overlay.show', { timeout: 8000 });
  check('admin gear is hidden for public players (no ?admin=1)',
    await C.page.evaluate(() => !document.querySelector('.lobby-overlay [data-act="admin"]')));
  await C.page.click('.lobby-overlay [data-act="close"]');
  await C.page.waitForSelector('.lobby-overlay.show', { state: 'hidden', timeout: 8000 }).catch(() => {});

  // ── gating: a wrong token is rejected, nothing persists ──────────────────────────
  await A.page.evaluate(() => window.__neon.adminSetPresentation('neon-training', { preroll_lead_ms: 300000 }, 'wrong-token'));
  await A.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return a && a.ok === false; }, null, { timeout: 8000 });
  check('set_presentation with a wrong token is rejected (bad_admin_token)', (await adminRes(A)).reason === 'bad_admin_token');

  // ── apply: a per-room override → that room's floor reflects it ───────────────────
  await A.page.evaluate((t) => window.__neon.adminSetPresentation('neon-training', { preroll_lead_ms: 300000, show_featured_chip: false }, t), TOKEN);
  await waitAdminOk(A);
  const applied = await adminRes(A);
  check('set_presentation succeeds and returns the effective config', applied.ok === true && applied.effective.preroll_lead_ms === WIDE && applied.effective.show_featured_chip === false);

  // C re-requests room events → its presentation now reflects the override.
  await C.page.evaluate(() => window.__neon.requestRoomEvents());
  await C.page.waitForFunction(() => window.__neon.eventPresentation()?.preroll_lead_ms === 300000, null, { timeout: 8000 });
  const cPres = await pres(C);
  check('overridden room floor reflects the wider pre-roll lead', cPres.preroll_lead_ms === WIDE);
  check('overridden room floor reflects the show_featured_chip flag', cPres.show_featured_chip === false);

  // The wider lead fires `upcoming` 4 min out, where the base 2-min lead would not.
  await C.page.evaluate((n) => window.__neon.setEventNow(n), fourMinOut);
  await C.page.waitForFunction(() => window.__neon.eventUpcoming() === true, null, { timeout: 8000 });
  check('wider override lead fires `upcoming` earlier on the overridden room', (await C.page.evaluate(() => window.__neon.eventUpcoming())) === true);

  // ── isolation: main-floor (no override) is unaffected at the same clock ──────────
  const aPres = await pres(A);
  check('non-overridden room keeps the base presentation', aPres.preroll_lead_ms === BASE_CFG.preroll_lead_ms && aPres.show_featured_chip === true);
  await A.page.evaluate((n) => window.__neon.setEventNow(n), fourMinOut);
  // give the floor a beat to process the room_events response, then assert NO upcoming
  await A.page.waitForTimeout(400);
  check('base-lead room does NOT pre-roll at the same clock (override is per-room)', (await A.page.evaluate(() => window.__neon.eventUpcoming())) === false);

  // ── preview does not persist ─────────────────────────────────────────────────────
  await A.page.evaluate((t) => window.__neon.adminPreviewPresentation('neon-training', { preroll_lead_ms: 600000 }, t), TOKEN);
  await A.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return a && a.op === 'preview_presentation'; }, null, { timeout: 8000 });
  const preview = await adminRes(A);
  check('preview_presentation returns the proposed effective config', preview.ok === true && preview.effective.preroll_lead_ms === 600000);

  // ── diagnostics: per-room override + effective; preview did NOT change the store ──
  await A.page.evaluate((t) => window.__neon.adminPresentationDiagnostics(t), TOKEN);
  await A.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return a && a.op === 'presentation_diagnostics' && Array.isArray(a.presentation); }, null, { timeout: 8000 });
  const diag = await adminRes(A);
  const ntDiag = diag.presentation.find((e) => e.room_id === 'neon-training');
  const mfDiag = diag.presentation.find((e) => e.room_id === 'main-floor');
  check('diagnostics show the APPLIED override for the overridden room (preview did not persist)', ntDiag.override.preroll_lead_ms === WIDE && ntDiag.effective.preroll_lead_ms === WIDE);
  check('diagnostics show NO override for the untouched room', mfDiag.override === null && mfDiag.effective.preroll_lead_ms === BASE_CFG.preroll_lead_ms);

  // ── lobby live-ops panel renders per-room controls + an override marker ──────────
  await A.page.click('#roomBtn');
  await A.page.waitForSelector('.lobby-overlay.show', { timeout: 8000 });
  // The admin panel may already be open (prior admin ops set adminOpen); only toggle it
  // open if it's currently hidden, so we never accidentally toggle it shut.
  if (await A.page.evaluate(() => document.querySelector('[data-f="admin"]')?.hidden !== false)) {
    await A.page.click('.lobby-overlay [data-act="admin"]');
  }
  await A.page.waitForSelector('[data-ops-room="neon-training"]', { state: 'attached', timeout: 8000 });
  const opsRooms = await A.page.evaluate(() => document.querySelectorAll('[data-ops-room]').length);
  check('lobby renders live-ops presentation controls per room', opsRooms >= 2);
  const ntOverrideMarker = await A.page.evaluate(() => !!document.querySelector('[data-ops-room="neon-training"] .lr-ops-on'));
  const mfBaseMarker = await A.page.evaluate(() => !!document.querySelector('[data-ops-room="main-floor"] .lr-ops-off'));
  check('the overridden room shows an override marker; the base room shows base', ntOverrideMarker && mfBaseMarker);

  // ── clear: revert the room to base ───────────────────────────────────────────────
  await A.page.evaluate((t) => window.__neon.adminClearPresentation('neon-training', t), TOKEN);
  await A.page.waitForFunction(() => { const a = window.__neon.state().lastRoomAdmin; return a && a.op === 'clear_presentation' && a.ok; }, null, { timeout: 8000 });
  const cleared = await adminRes(A);
  check('clear_presentation reverts the room to the base config', cleared.effective.preroll_lead_ms === BASE_CFG.preroll_lead_ms && cleared.effective.show_featured_chip === true);
  await C.page.evaluate(() => window.__neon.requestRoomEvents());
  await C.page.waitForFunction((base) => window.__neon.eventPresentation()?.preroll_lead_ms === base, BASE_CFG.preroll_lead_ms, { timeout: 8000 });
  check('the cleared room floor returns to the base presentation', (await pres(C)).preroll_lead_ms === BASE_CFG.preroll_lead_ms);

  // ── no money-like copy in any admin result we surfaced ───────────────────────────
  const blob = JSON.stringify([applied, preview, diag, cleared]);
  check('no money-like copy in presentation override payloads', !/jackpot|multiplier|payout|cash ?out|win more|boosted|bonus cash|reward boost|wager|stake/i.test(blob));

  const allErrors = [...A.errors, ...C.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}
console.log(failures === 0 ? '\nPRESENTATION-OVERRIDES VALIDATION: PASS' : `\nPRESENTATION-OVERRIDES VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
