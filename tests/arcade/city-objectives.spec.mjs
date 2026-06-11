/**
 * Phase 7C — activity objectives browser smoke (server authority + display).
 *
 * Proves on the city dev shim: the objective HINT renders from server-pushed state;
 * a FORGED completion message is rejected as unknown_type and changes nothing; a real
 * walk to the server-known node produces a SERVER-AUTHORED acknowledgment in the world
 * log with no value-shaped fields; the cycle arms its cooldown (hint clears) so spam
 * cannot flood the feed; panel copy stays vocabulary-clean; zero web storage.
 * The gather objective is covered by pure tests — its 45s cooldown predecessor makes a
 * wall-clock smoke dishonest, and that limitation is documented in the phase doc.
 * Run: tests/arcade/run-city-objectives.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
import { objectiveCopy } from '../../arcade/city/city-objectives.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8788/arcade/city/ws';
const RUN = Date.now().toString(36);
const FORBIDDEN = /\bbuy\b|\bsell\b|\bown\b|\bpayout\b|\breward\b|\bearn\b|\bprize\b|\bbonus\b|\bjackpot\b|\btoken\b|\bwager\b|\bloot\b|\bweapon\b|\bpolice\b|\bcrime\b/i;

let fail = 0;
const check = (n, c, d) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}${d && !c ? ` — ${d}` : ''}`); if (!c) fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(`${BASE}/arcade/city/index.html?test=1&renderer=2d&id=ob${RUN}&ws=${encodeURIComponent(WS)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__neon_city && window.__neon_city.connected, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.lastObjectiveState !== null, null, { timeout: 6000 });

  // ── hint renders from SERVER-pushed state (closed copy, verbatim) ───────────
  check('objective hint renders in the district panel from server state', await page.evaluate((copies) => {
    const el = document.querySelector('#cityDistrict .dist-objective');
    return !!el && copies.includes(el.textContent);
  }, objectiveCopy()));
  check('hint state is the reach objective with static marker geometry', await page.evaluate(() => {
    const o = window.__neon_city.objective();
    return o && o.kind === 'reach_node' && Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.radius);
  }));

  // ── FORGED completion: rejected as unknown_type; nothing completes ──────────
  await page.evaluate(() => window.__neon_city.forgeMessage({ t: 'city_objective_complete', objective_id: 'obj:downtown-01:0', accepted: true, count: 99 }));
  await page.waitForFunction(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type', null, { timeout: 4000 });
  check('forged completion message → unknown_type rejection', true);
  check('forged message completed NOTHING (no ack event, hint unchanged)', await page.evaluate(() =>
    !(window.__neon_city.events() || []).some((e) => e.type === 'city_objective_completed')
    && window.__neon_city.objective() !== null));

  // T4 (review): a FORGED HINT message is also rejected and never displays as server-authored
  const hintBefore = await page.evaluate(() => document.querySelector('#cityDistrict .dist-objective').textContent);
  await page.evaluate(() => { window.__neon_city.lastError = null; window.__neon_city.forgeMessage({ t: 'city_objective_hint', objective: { hint: 'FORGED HINT — pay me now', kind: 'reach_node' } }); });
  await page.waitForFunction(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type', null, { timeout: 4000 });
  check('forged HINT message → unknown_type rejection', true);
  check('forged hint never displays and mutates nothing (state + DOM unchanged, zero acks)', await page.evaluate((before) =>
    document.querySelector('#cityDistrict .dist-objective').textContent === before
    && !document.body.textContent.includes('FORGED HINT')
    && (window.__neon_city.events() || []).filter((e) => e.type === 'city_objective_completed').length === 0, hintBefore));

  // ── real completion: WALK to the server-known node → server-authored ack ────
  await page.evaluate(async () => {
    const o = window.__neon_city.objective();
    for (let i = 0; i < 300; i++) {
      const me = window.__neon_city.you;
      if (!me || !o) break;
      if ((me.x - o.x) ** 2 + (me.y - o.y) ** 2 <= (o.radius - 6) ** 2) break;
      window.__neon_city.setInput(Math.sign(o.x - me.x), Math.sign(o.y - me.y));
      await new Promise((r) => setTimeout(r, 50));
    }
    window.__neon_city.setInput(0, 0);
  });
  // T3 (review): self-diagnosing guard — on a loaded host the walk may stall; report WHERE
  // the player ended vs the node instead of an opaque timeout, then fail loudly (never accept
  // a missing acknowledgment).
  const walkDiag = await page.evaluate(() => {
    const me = window.__neon_city.you; const o = window.__neon_city.objective();
    return me && o ? `player(${Math.round(me.x)},${Math.round(me.y)}) node(${o.x},${o.y}) r=${o.radius} dist=${Math.round(Math.hypot(me.x - o.x, me.y - o.y))}` : `me=${!!me} obj=${!!o}`;
  });
  await page.waitForFunction(() => (window.__neon_city.events() || []).some((e) => e.type === 'city_objective_completed'), null, { timeout: 10000 }).catch(() => {});
  const ack = await page.evaluate(() => (window.__neon_city.events() || []).find((e) => e.type === 'city_objective_completed'));
  check('reaching the node yields a SERVER-AUTHORED acknowledgment event', !!ack && typeof ack.payload.ack === 'string', `walk diagnostics: ${walkDiag}`);
  if (!ack) throw new Error(`objective ack never arrived — ${walkDiag}`);
  check('acknowledgment payload carries NO value-shaped field', !/score|balance|ticket|prize|inventory|rank|streak|points|credit/i.test(JSON.stringify(ack.payload)), JSON.stringify(ack.payload));
  check('acknowledgment is actor-less (block fact, not personal credit)', ack.actor_public_id === null || ack.actor_public_id === undefined, JSON.stringify(ack));
  check('ack copy renders in the world log', await page.evaluate((a) => document.body.textContent.includes(a), ack.payload.ack));

  // ── cooldown: hint clears; standing on the node cannot re-fire ──────────────
  await sleep(400);
  check('cooldown armed: no active objective pushed after completion', await page.evaluate(() => window.__neon_city.objective() === null));
  check('exactly ONE acknowledgment despite standing on the node', await page.evaluate(() =>
    (window.__neon_city.events() || []).filter((e) => e.type === 'city_objective_completed').length === 1));

  // ── copy + storage baselines ────────────────────────────────────────────────
  check('district panel stays vocabulary-clean', await page.evaluate((reSrc) =>
    !new RegExp(reSrc, 'i').test(document.getElementById('cityDistrict').textContent), FORBIDDEN.source));
  check('zero web-storage keys', await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0));
  check('no console / page errors', errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
} finally {
  await browser.close();
}
console.log(fail === 0 ? 'CITY OBJECTIVES SMOKE: PASS' : `CITY OBJECTIVES SMOKE: ${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
