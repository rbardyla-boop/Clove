/**
 * Phase 4G — Instanced, Non-Destructive Block Trial browser smoke.
 *
 * Proves end-to-end against the local city dev shim (parity twin of the CityRoom DO):
 * the BLOCK TRIAL panel renders, an INELIGIBLE start is rejected, becoming Host-Rank-
 * eligible unlocks Start, a member's authoritative movement stabilizes a signal node and
 * the score rises ONLY after a server-confirmed state, closing the trial leaves the public
 * block style intact, the client CANNOT forge a trial fact, no money/ownership/gambling
 * copy appears, no private data leaks, and the existing stewardship / host-rank / pressure /
 * world log / in-place arcade interior still work. Forces the 2D renderer for headless.
 *
 * Run: see tests/arcade/run-city-block-trial.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8788/arcade/city/ws';
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/city/index.html?test=1&renderer=2d&id=${id}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newClient(browser, id) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_)/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url(id), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon_city, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.connected, null, { timeout: 8000 });
  return { page, errors };
}

async function seekTo(A, tx, ty) {
  for (let i = 0; i < 120; i++) {
    const p = await A.page.evaluate(() => window.__neon_city.you);
    if (Math.abs(p.x - tx) <= 12 && Math.abs(p.y - ty) <= 12) break;
    if (Math.abs(p.x - tx) > 12) await A.page.evaluate((x) => window.__neon_city.setInput(Math.sign(x - window.__neon_city.you.x), 0), tx);
    else await A.page.evaluate((y) => window.__neon_city.setInput(0, Math.sign(y - window.__neon_city.you.y)), ty);
    await sleep(80);
  }
  await A.page.evaluate(() => window.__neon_city.setInput(0, 0));
  await sleep(120);
}

const browser = await chromium.launch({ headless: true });
try {
  const A = await newClient(browser, `a${RUN}`);
  check('city connects (status live)', await A.page.evaluate(() => window.__neon_city.status === 'live'));

  check('BLOCK TRIAL panel rendered', await A.page.evaluate(() => { const el = document.getElementById('cityBlockTrial'); return !!el && /BLOCK TRIAL/.test(el.textContent); }));
  check('trial objective is shown', await A.page.evaluate(() => /stabilize 3 signal nodes/i.test(document.getElementById('cityBlockTrial').textContent)));
  check('no trial active on a fresh join', await A.page.evaluate(() => window.__neon_city.trial() === null));

  // lone fresh join → observer/quiet → INELIGIBLE: a trial start is rejected by the server
  await A.page.evaluate(() => window.__neon_city.requestTrial());
  await A.page.waitForFunction(() => window.__neon_city.lastTrialResult && window.__neon_city.lastTrialResult.ok === false, null, { timeout: 5000 }).catch(() => {});
  check('ineligible trial start is rejected (host_rank_too_low)', await A.page.evaluate(() => { const r = window.__neon_city.lastTrialResult; return r && r.ok === false && r.reason === 'host_rank_too_low'; }));
  check('no trial was created by the rejected request', await A.page.evaluate(() => window.__neon_city.trial() === null));

  // client CANNOT forge a trial fact
  await A.page.evaluate(() => window.__neon_city.client.send({ t: 'city_block_trial_completed', event: { type: 'city_block_trial_completed', score: 3 } }));
  await A.page.waitForFunction(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type', null, { timeout: 5000 }).catch(() => {});
  check('forged trial event is rejected (unknown_type)', await A.page.evaluate(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type'));

  // earn eligibility: enter the arcade portal (host-rank support activity), then return to the city
  await seekTo(A, 240, 580);
  await A.page.evaluate(() => window.__neon_city.enterPortal());
  await sleep(250);
  await A.page.evaluate(() => window.__neon_city.requestHostRank());
  await A.page.waitForFunction(() => window.__neon_city.eligible() === true, null, { timeout: 8000 }).catch(() => {});
  check('became stewardship-eligible (trial host)', await A.page.evaluate(() => window.__neon_city.eligible() === true));
  check('in-place arcade interior opened (4C intact)', await A.page.evaluate(() => window.__neon_city.interiorOpen === true));
  await A.page.evaluate(() => window.__neon_city.closeInterior());
  await sleep(150);

  // capture the public block style BEFORE the trial (to prove non-destruction after)
  const styleBefore = await A.page.evaluate(() => window.__neon_city.stewardship().arcade_front.palette);

  // start the trial → server-owned active instance with a copied style snapshot
  await A.page.evaluate(() => window.__neon_city.requestTrial());
  await A.page.waitForFunction(() => { const t = window.__neon_city.trial(); return t && t.status === 'active'; }, null, { timeout: 6000 }).catch(() => {});
  const t0 = await A.page.evaluate(() => window.__neon_city.trial());
  check('trial started (status active)', t0 && t0.status === 'active');
  check('trial copied the block style snapshot', !!(t0 && t0.copied_style && t0.copied_style.arcade_front));
  check('trial starts at score 0 / 3', t0 && t0.score === 0 && t0.score_cap === 3);

  // move (authoritatively) onto the nearest signal node → server stabilizes it, score rises
  const target = await A.page.evaluate(() => {
    const t = window.__neon_city.trial(); const me = window.__neon_city.you;
    return t.signal_nodes.map((n) => ({ x: n.x, y: n.y, d: Math.hypot(n.x - me.x, n.y - me.y) })).sort((a, b) => a.d - b.d)[0];
  });
  await seekTo(A, target.x, target.y);
  await A.page.waitForFunction(() => { const t = window.__neon_city.trial(); return t && t.score >= 1; }, null, { timeout: 8000 }).catch(() => {});
  const t1 = await A.page.evaluate(() => window.__neon_city.trial());
  check('a signal node stabilized → server-confirmed score rose', t1 && t1.score >= 1);
  check('at least one node is marked stabilized in server state', t1 && t1.signal_nodes.some((n) => n.stabilized));
  check('a trial event appears in the world log', await A.page.evaluate(() => window.__neon_city.events().some((e) => e.type.startsWith('city_block_trial_'))));

  // close the trial → public block style is UNCHANGED (non-destructive guarantee)
  await A.page.evaluate(() => window.__neon_city.closeTrial());
  await sleep(300);
  check('public block style intact after the trial (non-destructive)', await A.page.evaluate((b) => window.__neon_city.stewardship().arcade_front.palette === b, styleBefore));

  // no money/ownership/gambling copy in the trial panel or world log
  check('no money/ownership/gambling copy in trial UI', await A.page.evaluate(() => {
    const txt = document.getElementById('cityBlockTrial').textContent + ' ' + document.getElementById('cityEventLog').textContent;
    return !/\$|cash|payout|earn|profit|\bown\b|owner|rent|income|stake|\bbet\b|wager|gambl|market|price|\bbuy\b|\bsell\b|entry.?fee|prize|loot|\braid\b|steal/i.test(txt);
  }));
  check('no private/economy data in trial state', await A.page.evaluate(() => !/balance|ledger|inventory|secret|account|wager|payout/i.test(JSON.stringify(window.__neon_city.trial() || {}))));

  // existing layers still present
  check('stewardship panel still present (4F intact)', await A.page.evaluate(() => window.__neon_city.stewardship() !== null));
  check('host rank panel still present (4E intact)', await A.page.evaluate(() => window.__neon_city.hostRank() !== null));
  check('city pressure panel still present (4D intact)', await A.page.evaluate(() => window.__neon_city.pressure() !== null));
  check('world log still present (4C intact)', await A.page.evaluate(() => { const el = document.getElementById('cityEventLog'); return !!el && el.children.length >= 1; }));

  check('no console / page errors', A.errors.length === 0);
  if (A.errors.length) console.log('  errors:', JSON.stringify(A.errors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY BLOCK TRIAL SMOKE: PASS' : `\nCITY BLOCK TRIAL SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
