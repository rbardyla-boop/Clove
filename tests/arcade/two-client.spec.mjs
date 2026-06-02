/**
 * F. Two-client browser validation for server-authoritative Pulse Tap tickets.
 *
 * Portable: resolve Playwright from PW_REQUIRE_BASE (defaults to project-local),
 * and read URLs from env (BASE_URL, WS_URL). Requires a running static server for
 * the repo and a Neon arcade WebSocket endpoint.
 *
 * Locally (Node 18, wrangler needs >=22) we point WS_URL at workers/arcade/dev-shim.mjs,
 * which reuses the SAME ticket authority module as the production Durable Object.
 * Against a real deploy, point WS_URL at the Worker and the same assertions hold.
 *
 * Run: see tests/arcade/run-two-client.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
// Unique per-run ids so the test is deterministic even against a PERSISTENT
// Durable Object (balances/inventory survive across runs by design).
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/index.html?test=1&id=${id}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };

async function newClient(browser, id) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url(id), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon, null, { timeout: 8000 });
  await page.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });
  return { page, errors };
}
const tickets = (c) => c.page.evaluate(() => window.__neon.state().tickets);
const lastReject = (c) => c.page.evaluate(() => window.__neon.state().lastReject);
const cabBusy = (c) => c.page.evaluate(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('busy'));
const cabMine = (c) => c.page.evaluate(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('mine'));

const browser = await chromium.launch({ headless: true });
try {
  const A = await newClient(browser, `a${RUN}`);
  const B = await newClient(browser, `b${RUN}`);
  check('A and B both connect to the room', true);

  // A occupies the cabinet
  await A.page.click('.cab[data-id="pulse"]');
  await A.page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('mine'), null, { timeout: 8000 });
  check('A occupies Pulse Tap', await cabMine(A));

  // B sees busy
  await B.page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('busy'), null, { timeout: 8000 });
  check('B sees the cabinet busy', await cabBusy(B) && !(await cabMine(B)));

  // B cannot occupy A's cabinet (occupancy authority preserved)
  await B.page.click('.cab[data-id="pulse"]');
  await B.page.waitForTimeout(300);
  check('B still cannot occupy (busy)', !(await cabMine(B)));

  // A plays + submits a valid round via the gated client hook
  const roundId = await A.page.evaluate(async () => {
    window.__neon.client.startPulseRound('pulse');
    await new Promise((r) => setTimeout(r, 250));
    return window.__neon.state().roundId;
  });
  check('server issued a round id to A', typeof roundId === 'string' && roundId.length > 0);
  await A.page.evaluate((rid) => window.__neon.client.submitPulseRound(
    { roundId: rid, machineId: 'pulse', grade: 'A', accuracy: 88, hits: 16, bestStreak: 9, score: 1825, durationMs: 30000 }
  ), roundId);
  await A.page.waitForFunction(() => window.__neon.state().tickets > 0, null, { timeout: 8000 });
  const aTickets = await tickets(A);
  // base A=18 + scoreBonus floor(1825/750)=2 + accuracy<90 -> 0  => 20
  check('A receives server-computed tickets (20)', aTickets === 20);
  check('A ticket HUD reflects balance', (await A.page.locator('#ticketCount').innerText()).trim() === String(aTickets));

  // B forced/malicious submit attempts are rejected, B earns nothing
  await B.page.evaluate(() => window.__neon.client.startPulseRound('pulse')); // not occupant
  await B.page.waitForTimeout(200);
  await B.page.evaluate(() => window.__neon.client.submitPulseRound(
    { roundId: 'forged-' + Math.random(), machineId: 'pulse', grade: 'S', accuracy: 100, hits: 60, bestStreak: 60, score: 9000, durationMs: 30000 }
  ));
  await B.page.waitForTimeout(300);
  const bReject = await lastReject(B);
  check('B malicious submit/start is rejected', ['not_occupant', 'unknown_round', 'wrong_session', 'wrong_cabinet'].includes(bReject));
  check('B earns no tickets', (await tickets(B)) === 0);

  // A releases; propagates to B
  await A.page.evaluate(() => window.__neon.client.release('pulse'));
  await B.page.waitForFunction(() => !document.querySelector('.cab[data-id="pulse"]').classList.contains('busy'), null, { timeout: 8000 });
  check('A release propagates to B (cabinet free)', !(await cabBusy(B)));

  // B now occupies and earns its own tickets independently
  await B.page.click('.cab[data-id="pulse"]');
  await B.page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('mine'), null, { timeout: 8000 });
  check('B can occupy after release', await cabMine(B));
  const bRound = await B.page.evaluate(async () => {
    window.__neon.client.startPulseRound('pulse');
    await new Promise((r) => setTimeout(r, 250));
    return window.__neon.state().roundId;
  });
  await B.page.evaluate((rid) => window.__neon.client.submitPulseRound(
    { roundId: rid, machineId: 'pulse', grade: 'B', accuracy: 70, hits: 11, bestStreak: 5, score: 1225, durationMs: 28000 }
  ), bRound);
  await B.page.waitForFunction(() => window.__neon.state().tickets > 0, null, { timeout: 8000 });
  // base B=12 + floor(1225/750)=1 + acc<90 -> 0 => 13
  check('B earns its own tickets independently (13)', (await tickets(B)) === 13);
  check('A balance unchanged by B activity (still 20)', (await tickets(A)) === 20);

  // ── Phase 1f: prize counter / cosmetics loop ──────────────────────────────
  const balA = (c) => c.page.evaluate(() => window.__neon.state().balance);

  // A redeems a low-cost prize (founder-badge-local, cost 10) and equips it.
  await A.page.evaluate(() => window.__neon.client.redeemPrize('founder-badge-local'));
  await A.page.waitForFunction(() => window.__neon.state().inventory.some((i) => i.prize_id === 'founder-badge-local'), null, { timeout: 8000 });
  check('A redeems founder-badge-local (server subtracts 10 → balance 10)', (await balA(A)) === 10);

  await A.page.evaluate(() => window.__neon.client.equipCosmetic('founder-badge-local'));
  await A.page.waitForFunction(() => window.__neon.state().equips.badge === 'founder-badge-local', null, { timeout: 8000 });
  check('A equips the badge', (await A.page.evaluate(() => window.__neon.state().equips.badge)) === 'founder-badge-local');

  // B sees A's PUBLIC equipped cosmetic, but not A's private balance/ledger.
  const aId = await A.page.evaluate(() => window.__neon.state().playerId);
  await B.page.waitForFunction((aid) => window.__neon.state().publicCosmetics[aid]?.badge, aId, { timeout: 8000 });
  const bSeesA = await B.page.evaluate((aid) => window.__neon.state().publicCosmetics[aid].badge.display_name, aId);
  check("B sees A's public badge (Founder Badge)", bSeesA === 'Founder Badge');
  const bView = await B.page.evaluate(() => JSON.stringify(window.__neon.state().publicCosmetics));
  check("B's view of A leaks no balance/ledger", !/balance|ledger|redemption/i.test(bView));

  // B cannot equip an item it does not own.
  await B.page.evaluate(() => window.__neon.client.equipCosmetic('pulse-jacket'));
  await B.page.waitForFunction(() => window.__neon.state().lastPrizeReject === 'not_owned', null, { timeout: 8000 });
  check('B cannot equip an unowned item', (await B.page.evaluate(() => window.__neon.state().lastPrizeReject)) === 'not_owned');

  // B spends its OWN tickets (13 → 3); A's balance is untouched (per-session isolation).
  await B.page.evaluate(() => window.__neon.client.redeemPrize('founder-badge-local'));
  await B.page.waitForFunction(() => window.__neon.state().balance === 3, null, { timeout: 8000 });
  check('B redeems with its own tickets (B 13 → 3)', (await balA(B)) === 3);
  check("A's balance untouched by B's redemption (still 10)", (await balA(A)) === 10);

  // A reconnects → server restores balance, inventory and equipped cosmetic.
  await A.page.reload({ waitUntil: 'load' });
  await A.page.waitForFunction(() => !!window.__neon, null, { timeout: 8000 });
  await A.page.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });
  await A.page.waitForFunction(() => window.__neon.state().inventory.some((i) => i.prize_id === 'founder-badge-local'), null, { timeout: 8000 });
  check('A reconnect restores balance (10)', (await balA(A)) === 10);
  check('A reconnect restores equipped badge', (await A.page.evaluate(() => window.__neon.state().equips.badge)) === 'founder-badge-local');

  // ── Phase 1g: second ticketed cabinet (Signal Sprint) + multi-cabinet ─────
  // State here: B occupies Pulse Tap; A is free (reconnected); A balance 10, B 3.
  const sigBusy = (c) => c.page.evaluate(() => document.querySelector('.cab[data-id="signal"]').classList.contains('busy'));
  const sigMine = (c) => c.page.evaluate(() => document.querySelector('.cab[data-id="signal"]').classList.contains('mine'));

  // Signal Sprint cabinet is rendered as an active/powered cabinet.
  check('Signal Sprint cabinet is present + powered', await A.page.evaluate(() => {
    const node = document.querySelector('.cab[data-id="signal"]');
    return !!node && node.classList.contains('powered');
  }));

  // A occupies Signal Sprint while B still holds Pulse Tap → independent occupancy.
  await A.page.click('.cab[data-id="signal"]');
  await A.page.waitForFunction(() => document.querySelector('.cab[data-id="signal"]').classList.contains('mine'), null, { timeout: 8000 });
  check('A occupies Signal Sprint', await sigMine(A));
  check('B still holds Pulse Tap (occupancy independent per cabinet)', await cabMine(B));

  // B sees Signal Sprint busy (and cannot occupy/play it).
  await B.page.waitForFunction(() => document.querySelector('.cab[data-id="signal"]').classList.contains('busy'), null, { timeout: 8000 });
  check('B sees Signal Sprint busy', await sigBusy(B) && !(await sigMine(B)));

  // B cannot start A's Signal Sprint round (not the occupant).
  await B.page.evaluate(() => window.__neon.client.startSignalRound('signal'));
  await B.page.waitForFunction(() => window.__neon.state().lastReject === 'not_occupant', null, { timeout: 8000 });
  await B.page.evaluate(() => window.__neon.client.submitSignalRound(
    { roundId: 'forged-' + Math.random(), machineId: 'signal', grade: 'S', score: 19000, distance: 9000, pulsesCollected: 200, noiseHits: 0, maxStreak: 99, durationMs: 25000 }
  ));
  await B.page.waitForTimeout(250);
  check('B cannot start/submit A’s Signal Sprint round', ['not_occupant', 'unknown_round', 'wrong_session'].includes(await lastReject(B)));
  check('B earns nothing from Signal Sprint (still 3)', (await tickets(B)) === 3);

  // A plays a valid Signal Sprint round → server-computed award into the SHARED balance.
  const sRound = await A.page.evaluate(async () => {
    window.__neon.client.startSignalRound('signal');
    await new Promise((r) => setTimeout(r, 250));
    return window.__neon.state().signalRoundId;
  });
  check('server issued a Signal Sprint round id to A', typeof sRound === 'string' && sRound.length > 0);
  await A.page.evaluate((rid) => window.__neon.client.submitSignalRound(
    { roundId: rid, machineId: 'signal', grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000 }
  ), sRound);
  // signal: base A=16 + distance floor(1800/250)=7 (cap 8) + streak>=12 → +3 − floor(6/3)=2 = 24
  await A.page.waitForFunction(() => window.__neon.state().tickets === 34, null, { timeout: 8000 });
  check('A earns server-computed Signal Sprint tickets (10 + 24 = 34)', (await tickets(A)) === 34);
  check('A ticket HUD reflects the combined balance', (await A.page.locator('#ticketCount').innerText()).trim() === '34');

  // Ledger records the award from the Signal Sprint cabinet (source + cabinet_type).
  await A.page.evaluate(() => window.__neon.client.requestTicketLedger());
  await A.page.waitForFunction(() => window.__neon.state().ledger.some((e) => e.cabinet_type === 'signal_sprint'), null, { timeout: 8000 });
  const sigLed = await A.page.evaluate(() => window.__neon.state().ledger.find((e) => e.cabinet_type === 'signal_sprint'));
  check('ledger records the Signal Sprint award (source signal, cabinet_type signal_sprint)', sigLed && sigLed.source === 'signal' && sigLed.delta === 24);
  check('ledger also still has the Pulse Tap award (both cabinets)', await A.page.evaluate(() => window.__neon.state().ledger.some((e) => e.cabinet_type === 'pulse_tap')));

  // A releases Signal Sprint; B sees it free again.
  await A.page.evaluate(() => window.__neon.client.release('signal'));
  await B.page.waitForFunction(() => !document.querySelector('.cab[data-id="signal"]').classList.contains('busy'), null, { timeout: 8000 });
  check('A release of Signal Sprint propagates to B', !(await sigBusy(B)));

  // B’s view still leaks no private balance/ledger of A.
  const bViewFinal = await B.page.evaluate(() => JSON.stringify(window.__neon.state().publicCosmetics));
  check('B’s public view of A still leaks no balance/ledger', !/balance|ledger|redemption/i.test(bViewFinal));

  const allErrors = [...A.errors, ...B.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nTWO-CLIENT VALIDATION: PASS' : `\nTWO-CLIENT VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
