/**
 * Phase 4E — non-cash Host Rank browser smoke.
 *
 * Proves end-to-end against the local city dev shim (parity twin of the CityRoom DO):
 * the HOST RANK panel renders, a baseline appears after join, portal/scheduler activity
 * raises the displayed support signal / tier, the client CANNOT forge a host-rank fact,
 * no money/ownership copy appears, no private data leaks, and the existing pressure +
 * world log + in-place arcade interior still work. Forces the 2D renderer for headless.
 *
 * Run: see tests/arcade/run-city-host-rank.sh
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
  for (let i = 0; i < 90; i++) {
    const p = await A.page.evaluate(() => window.__neon_city.you);
    if (Math.abs(p.x - tx) <= 14 && Math.abs(p.y - ty) <= 14) break;
    if (Math.abs(p.x - tx) > 14) await A.page.evaluate((x) => window.__neon_city.setInput(Math.sign(x - window.__neon_city.you.x), 0), tx);
    else await A.page.evaluate((y) => window.__neon_city.setInput(0, Math.sign(y - window.__neon_city.you.y)), ty);
    await sleep(90);
  }
  await A.page.evaluate(() => window.__neon_city.setInput(0, 0));
  await sleep(120);
}

const browser = await chromium.launch({ headless: true });
try {
  const A = await newClient(browser, `a${RUN}`);
  check('city connects (status live)', await A.page.evaluate(() => window.__neon_city.status === 'live'));

  // baseline host rank after join
  await A.page.waitForFunction(() => window.__neon_city.hostRank() !== null, null, { timeout: 8000 }).catch(() => {});
  const h0 = await A.page.evaluate(() => window.__neon_city.hostRank());
  check('host rank snapshot available after join', !!h0 && typeof h0.tier === 'string');
  check('baseline tier is observer (lone join)', h0 && h0.tier === 'observer');
  check('HOST RANK panel rendered + populated', await A.page.evaluate(() => { const el = document.getElementById('cityHostRank'); return !!el && /HOST RANK/.test(el.textContent); }));
  check('host rank exposes a bounded non-cash gauge (score_cap=100)', h0 && h0.score_cap === 100 && h0.score <= 100);

  // client CANNOT forge a host-rank fact
  await A.page.evaluate(() => window.__neon_city.client.send({ t: 'city_host_rank_changed', event: { type: 'city_host_rank_changed', tier: 'anchor' } }));
  await A.page.waitForFunction(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type', null, { timeout: 5000 }).catch(() => {});
  check('forged host-rank event is rejected (unknown_type)', await A.page.evaluate(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type'));

  // walk into the arcade portal zone + enter → support activity raises the rank
  await seekTo(A, 240, 580);
  await A.page.evaluate(() => window.__neon_city.enterPortal());
  await sleep(200);
  await A.page.evaluate(() => window.__neon_city.requestHostRank());
  await A.page.waitForFunction(() => { const h = window.__neon_city.hostRank(); return h && h.tier !== 'observer'; }, null, { timeout: 8000 }).catch(() => {});
  const h1 = await A.page.evaluate(() => window.__neon_city.hostRank());
  check('host rank rose above baseline after portal/interior support', h1 && ['helper', 'signaler', 'anchor'].includes(h1.tier));
  check('support reasons are public-safe', h1 && Array.isArray(h1.reasons) && h1.reasons.every((r) => /^[a-z_]+$/.test(r)));
  check('a host-rank event appears in the world log', await A.page.evaluate(() => window.__neon_city.events().some((e) => e.type === 'city_host_rank_evaluated' || e.type === 'city_host_rank_changed')));

  // no money/ownership copy in the host-rank or world-log UI
  check('no money/ownership copy in host-rank UI', await A.page.evaluate(() => {
    const txt = document.getElementById('cityHostRank').textContent + ' ' + document.getElementById('cityEventLog').textContent;
    return !/\$|cash|payout|earn|profit|own|rent|income|stake|token|market|price|buy|sell/i.test(txt);
  }));
  check('no private data in host-rank state', await A.page.evaluate(() => !/balance|ledger|inventory|secret|account/i.test(JSON.stringify(window.__neon_city.hostRank()))));

  // existing layers still present
  check('city pressure panel still present (4D intact)', await A.page.evaluate(() => window.__neon_city.pressure() !== null));
  check('world log still present (4C intact)', await A.page.evaluate(() => { const el = document.getElementById('cityEventLog'); return !!el && el.children.length >= 1; }));
  check('in-place arcade interior still opens (4C intact)', await A.page.evaluate(() => window.__neon_city.interiorOpen === true));
  await A.page.evaluate(() => window.__neon_city.closeInterior());

  check('no console / page errors', A.errors.length === 0);
  if (A.errors.length) console.log('  errors:', JSON.stringify(A.errors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY HOST RANK SMOKE: PASS' : `\nCITY HOST RANK SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
