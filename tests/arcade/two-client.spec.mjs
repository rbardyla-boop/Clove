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
  // Ignore noise that is NOT an app error: the external Google Fonts CDN and
  // transient browser network blips (e.g. ERR_NETWORK_CHANGED during reloads).
  // App + same-origin resource errors are still captured.
  const isExternalNoise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t)
    || /net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_)/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isExternalNoise(m.text())) errors.push('console: ' + m.text()); });
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

  // ── Phase 1l: Neon Grid — the first adapter-loaded production cabinet ───────
  // State here: B holds Pulse Tap; A is free; A balance 34, B 3.
  const gridBusy = (c) => c.page.evaluate(() => document.querySelector('.cab[data-id="grid"]').classList.contains('busy'));
  const gridMine = (c) => c.page.evaluate(() => document.querySelector('.cab[data-id="grid"]').classList.contains('mine'));

  // Neon Grid entered the floor through the adapter/import path (server catalog → registry → mount).
  await A.page.waitForFunction(() => window.__neon.adapters.neon_grid && window.__neon.adapters.neon_grid.ok, null, { timeout: 8000 });
  check('Neon Grid is activated through the adapter/import path (not hand-wired)', await A.page.evaluate(() => {
    const a = window.__neon.adapters.neon_grid;
    return !!a && a.ok && a.state === 'playable' && a.adapter.gameId === 'neon_grid';
  }));
  check('Neon Grid renders as an active/powered cabinet', await A.page.evaluate(() => {
    const node = document.querySelector('.cab[data-id="grid"]');
    return !!node && node.classList.contains('powered') && !node.classList.contains('unavailable');
  }));

  // A occupies Neon Grid while B still holds Pulse Tap → independent occupancy across all three.
  await A.page.click('.cab[data-id="grid"]');
  await A.page.waitForFunction(() => document.querySelector('.cab[data-id="grid"]').classList.contains('mine'), null, { timeout: 8000 });
  check('A occupies Neon Grid', await gridMine(A));
  check('B still holds Pulse Tap (occupancy independent across all three cabinets)', await cabMine(B));

  // B sees Neon Grid busy and cannot start/submit A's round.
  await B.page.waitForFunction(() => document.querySelector('.cab[data-id="grid"]').classList.contains('busy'), null, { timeout: 8000 });
  check('B sees Neon Grid busy', await gridBusy(B) && !(await gridMine(B)));
  await B.page.evaluate(() => window.__neon.client.startNeonGridRound('grid'));
  await B.page.waitForFunction(() => window.__neon.state().lastReject === 'not_occupant', null, { timeout: 8000 });
  await B.page.evaluate(() => window.__neon.client.submitNeonGridRound(
    { roundId: 'forged-' + Math.random(), machineId: 'grid', grade: 'S', score: 40000, correctSteps: 200, completedPatterns: 60, mistakes: 0, bestStreak: 200, durationMs: 20000 }
  ));
  await B.page.waitForTimeout(250);
  check('B cannot start/submit A’s Neon Grid round', ['not_occupant', 'unknown_round', 'wrong_session'].includes(await lastReject(B)));
  check('B earns nothing from Neon Grid (still 3)', (await tickets(B)) === 3);

  // A plays a valid Neon Grid round → server-computed award into the SHARED balance.
  const gRound = await A.page.evaluate(async () => {
    window.__neon.client.startNeonGridRound('grid');
    await new Promise((r) => setTimeout(r, 250));
    return window.__neon.state().gridRoundId;
  });
  check('server issued a Neon Grid round id to A', typeof gRound === 'string' && gRound.length > 0);
  await A.page.evaluate((rid) => window.__neon.client.submitNeonGridRound(
    { roundId: rid, machineId: 'grid', grade: 'A', score: 5000, correctSteps: 40, completedPatterns: 6, mistakes: 2, bestStreak: 18, durationMs: 22000 }
  ), gRound);
  // neon_grid: base A=17 + pattern min(8,6)=6 + streak(18>=16 → +3) − floor(2/4)=0 = 26 → 34 + 26 = 60
  await A.page.waitForFunction(() => window.__neon.state().tickets === 60, null, { timeout: 8000 });
  check('A earns server-computed Neon Grid tickets (34 + 26 = 60)', (await tickets(A)) === 60);

  // Ledger records the Neon Grid award alongside Pulse Tap + Signal Sprint.
  await A.page.evaluate(() => window.__neon.client.requestTicketLedger());
  await A.page.waitForFunction(() => window.__neon.state().ledger.some((e) => e.cabinet_type === 'neon_grid'), null, { timeout: 8000 });
  const gridLed = await A.page.evaluate(() => window.__neon.state().ledger.find((e) => e.cabinet_type === 'neon_grid'));
  check('ledger records the Neon Grid award (source grid, cabinet_type neon_grid)', gridLed && gridLed.source === 'grid' && gridLed.delta === 26);
  check('ledger has all three cabinet sources', await A.page.evaluate(() => {
    const t = window.__neon.state().ledger.map((e) => e.cabinet_type);
    return t.includes('pulse_tap') && t.includes('signal_sprint') && t.includes('neon_grid');
  }));

  // A redeems a Prize Counter item using the COMBINED balance: pulse-jacket costs
  // 35 — more than ANY single cabinet's award (pulse 20 / signal 24 / grid 26).
  await A.page.evaluate(() => window.__neon.client.redeemPrize('pulse-jacket'));
  await A.page.waitForFunction(() => window.__neon.state().inventory.some((i) => i.prize_id === 'pulse-jacket'), null, { timeout: 8000 });
  check('A redeems pulse-jacket (35) from the combined balance (60 → 25)', (await balA(A)) === 25);

  // A releases Neon Grid; B sees it free again.
  await A.page.evaluate(() => window.__neon.client.release('grid'));
  await B.page.waitForFunction(() => !document.querySelector('.cab[data-id="grid"]').classList.contains('busy'), null, { timeout: 8000 });
  check('A release of Neon Grid propagates to B', !(await gridBusy(B)));

  // ── Phase 1h: Challenge Board, achievements, public event feed ─────────────
  // A has played BOTH cabinets above → Two Cabinet Tour should be complete.
  await A.page.evaluate(() => window.__neon.client.requestChallengeProgress());
  await A.page.waitForFunction(() => {
    const c = (window.__neon.state().challenges || []).find((x) => x.challenge_id === 'two-cabinet-tour');
    return c && c.completed && !c.reward_claimed;
  }, null, { timeout: 8000 });
  check('A completed Two Cabinet Tour by playing both cabinets', true);

  // A opens the Challenge Board (exercises the panel UI build) and claims via the UI.
  await A.page.click('#challengeBtn');
  await A.page.waitForSelector('.cb-overlay.show', { timeout: 8000 });
  check('A opens the Challenge Board', true);
  await A.page.waitForSelector('[data-act="claim"][data-cid="two-cabinet-tour"]', { timeout: 8000 });
  await A.page.click('[data-act="claim"][data-cid="two-cabinet-tour"]');

  await A.page.waitForFunction(() => window.__neon.state().inventory.some((i) => i.prize_id === 'badge-circuit-tourist'), null, { timeout: 8000 });
  check('A claims the reward → Circuit Tourist badge in inventory', true);
  await A.page.waitForFunction(() => {
    const c = window.__neon.state().challenges.find((x) => x.challenge_id === 'two-cabinet-tour');
    return c && c.reward_claimed;
  }, null, { timeout: 8000 });
  check('challenge shows reward_claimed after claim', true);

  // A equips the achievement badge through the Challenge Board UI (existing equip path).
  await A.page.waitForSelector('[data-act="equip"][data-prize="badge-circuit-tourist"]', { timeout: 8000 });
  await A.page.click('[data-act="equip"][data-prize="badge-circuit-tourist"]');
  await A.page.waitForFunction(() => window.__neon.state().equips.badge === 'badge-circuit-tourist', null, { timeout: 8000 });
  check('A equips the Circuit Tourist achievement badge', (await A.page.evaluate(() => window.__neon.state().equips.badge)) === 'badge-circuit-tourist');

  // B sees A's PUBLIC badge + the achievement unlock in the public feed.
  const aId2 = await A.page.evaluate(() => window.__neon.state().playerId);
  await B.page.waitForFunction((aid) => window.__neon.state().publicCosmetics[aid]?.badge?.display_name === 'Circuit Tourist', aId2, { timeout: 8000 });
  check("B sees A's public Circuit Tourist badge", true);
  await B.page.waitForFunction(() => window.__neon.state().feed.some((e) => e.event_type === 'achievement_unlocked' && /Circuit Tourist/.test(e.summary)), null, { timeout: 8000 });
  check("B sees A's achievement unlock in the public feed", true);

  // The public feed/state leaks nothing private. (Match the real private fields:
  // a challenge id like "first-redemption" is public-safe, so check redemption_id.)
  const bFeed = await B.page.evaluate(() => JSON.stringify(window.__neon.state().feed));
  check("B's event feed leaks no balance/ledger", !/balance|ledger|redemption_id/i.test(bFeed));

  // B's own challenge progress is independent (B never played Signal Sprint).
  const bTour = await B.page.evaluate(() => window.__neon.state().challenges.find((x) => x.challenge_id === 'two-cabinet-tour'));
  check("B's own Two Cabinet Tour is not complete (independent progress)", !!bTour && !bTour.completed && !bTour.reward_claimed);

  // B cannot claim A's reward (B has not completed it).
  await B.page.evaluate(() => window.__neon.client.claimChallengeReward('two-cabinet-tour'));
  await B.page.waitForFunction(() => window.__neon.state().lastChallengeReject === 'not_completed', null, { timeout: 8000 });
  check('B cannot claim the reward (server rejects: not_completed)', (await B.page.evaluate(() => window.__neon.state().lastChallengeReject)) === 'not_completed');

  // ── Phase 1l challenges: Grid Rookie + Clean Grid + Three Cabinet Tour ──────
  // A has now played all three cabinets, so the Neon Grid challenges are complete.
  await A.page.evaluate(() => window.__neon.client.requestChallengeProgress());
  await A.page.waitForFunction(() => {
    const cs = window.__neon.state().challenges || [];
    const done = (id) => { const c = cs.find((x) => x.challenge_id === id); return c && c.completed; };
    return done('grid-rookie') && done('clean-grid') && done('three-cabinet-tour');
  }, null, { timeout: 8000 });
  check('A completed Grid Rookie, Clean Grid and Three Cabinet Tour (all three cabinets)', true);
  // Two Cabinet Tour stayed independent of the new Three Cabinet Tour challenge.
  check('Three Cabinet Tour is a distinct challenge from Two Cabinet Tour', await A.page.evaluate(() => {
    const cs = window.__neon.state().challenges || [];
    return cs.some((x) => x.challenge_id === 'two-cabinet-tour') && cs.some((x) => x.challenge_id === 'three-cabinet-tour');
  }));

  // Claim the Neon Grid challenge rewards (server-authoritative; internal-only badges).
  await A.page.evaluate(() => window.__neon.client.claimChallengeReward('grid-rookie'));
  await A.page.waitForFunction(() => window.__neon.state().inventory.some((i) => i.prize_id === 'badge-grid-rookie'), null, { timeout: 8000 });
  check('A claims Grid Rookie → badge-grid-rookie in inventory', true);
  await A.page.evaluate(() => window.__neon.client.claimChallengeReward('three-cabinet-tour'));
  await A.page.waitForFunction(() => window.__neon.state().inventory.some((i) => i.prize_id === 'badge-circuit-voyager'), null, { timeout: 8000 });
  check('A claims Three Cabinet Tour → badge-circuit-voyager in inventory', true);
  // A duplicate claim is rejected by the server (no second badge).
  await A.page.evaluate(() => window.__neon.client.claimChallengeReward('three-cabinet-tour'));
  await A.page.waitForFunction(() => window.__neon.state().lastChallengeReject === 'already_claimed', null, { timeout: 8000 });
  check('A duplicate Three Cabinet Tour claim is rejected (already_claimed)', (await A.page.evaluate(() => window.__neon.state().lastChallengeReject)) === 'already_claimed');

  // B sees the Circuit Voyager unlock in the PUBLIC feed (safe summary only); no private leak.
  await B.page.waitForFunction(() => window.__neon.state().feed.some((e) => e.event_type === 'achievement_unlocked' && /Circuit Voyager/.test(e.summary)), null, { timeout: 8000 });
  check("B sees A's Circuit Voyager unlock in the public feed", true);
  const bFeed2 = await B.page.evaluate(() => JSON.stringify(window.__neon.state().feed));
  check("B's event feed still leaks no balance/ledger", !/balance|ledger|redemption_id/i.test(bFeed2));

  // B cannot claim A's Three Cabinet Tour (B never played Neon Grid).
  await B.page.evaluate(() => window.__neon.client.claimChallengeReward('three-cabinet-tour'));
  await B.page.waitForFunction(() => window.__neon.state().lastChallengeReject === 'not_completed', null, { timeout: 8000 });
  check("B cannot claim A's Three Cabinet Tour (server rejects: not_completed)", (await B.page.evaluate(() => window.__neon.state().lastChallengeReject)) === 'not_completed');

  // A reconnects → Challenge Board state (completed + claimed + equipped badge) restored.
  await A.page.reload({ waitUntil: 'load' });
  await A.page.waitForFunction(() => !!window.__neon, null, { timeout: 8000 });
  await A.page.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });
  await A.page.waitForFunction(() => {
    const c = (window.__neon.state().challenges || []).find((x) => x.challenge_id === 'two-cabinet-tour');
    return c && c.completed && c.reward_claimed;
  }, null, { timeout: 8000 });
  check('A reconnect restores Challenge Board state (completed + claimed)', true);
  // Phase 1l: the Neon Grid challenge/badge state survives the reconnect too.
  await A.page.waitForFunction(() => {
    const c = (window.__neon.state().challenges || []).find((x) => x.challenge_id === 'three-cabinet-tour');
    return c && c.completed && c.reward_claimed;
  }, null, { timeout: 8000 });
  check('A reconnect restores Three Cabinet Tour (completed + claimed)', true);
  await A.page.waitForFunction(() => window.__neon.state().inventory.some((i) => i.prize_id === 'badge-circuit-voyager'), null, { timeout: 8000 });
  check('A reconnect restores the Circuit Voyager badge in inventory', true);
  await A.page.waitForFunction(() => window.__neon.state().equips.badge === 'badge-circuit-tourist', null, { timeout: 8000 });
  check('A reconnect restores the equipped achievement badge', true);

  const allErrors = [...A.errors, ...B.errors];
  check('no console / page errors', allErrors.length === 0);
  if (allErrors.length) console.log('  errors:', JSON.stringify(allErrors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nTWO-CLIENT VALIDATION: PASS' : `\nTWO-CLIENT VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
