/**
 * Phase 4F — Block Stewardship + Constrained Editor browser smoke.
 *
 * Proves end-to-end against the local city dev shim (parity twin of the CityRoom DO):
 * the BLOCK STEWARDSHIP panel renders, eligibility is shown, an INELIGIBLE apply is
 * rejected, becoming Host-Rank-eligible unlocks preview, an apply changes the visible
 * arcade-front accent, reset restores the city default, the client CANNOT forge a
 * stewardship fact, no ownership/money copy appears, no private data leaks, and the
 * existing pressure / host-rank / world-log / in-place arcade interior still work.
 * Forces the 2D renderer for headless.
 *
 * Run: see tests/arcade/run-city-stewardship.sh
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

  // panel + canonical block style after join
  await A.page.waitForFunction(() => window.__neon_city.stewardship() && window.__neon_city.stewardship().arcade_front, null, { timeout: 8000 }).catch(() => {});
  check('BLOCK STEWARDSHIP panel rendered', await A.page.evaluate(() => { const el = document.getElementById('cityStewardship'); return !!el && /BLOCK STEWARDSHIP/.test(el.textContent); }));
  check('eligibility line is shown', await A.page.evaluate(() => /Eligibility:/.test(document.getElementById('cityStewardship').textContent)));
  check('default canonical block style is the city default (arcade magenta)', await A.page.evaluate(() => window.__neon_city.stewardship().arcade_front.palette === 'magenta'));

  // lone fresh join → observer/quiet → INELIGIBLE: an apply is rejected by the server
  check('lone joiner is NOT stewardship-eligible', await A.page.evaluate(() => window.__neon_city.eligible() === false));
  await A.page.evaluate(() => window.__neon_city.applyStewardship('arcade_front', { palette: 'amber' }));
  await A.page.waitForFunction(() => window.__neon_city.lastStewardshipResult && window.__neon_city.lastStewardshipResult.ok === false, null, { timeout: 5000 }).catch(() => {});
  check('ineligible apply is rejected (host_rank_too_low)', await A.page.evaluate(() => { const r = window.__neon_city.lastStewardshipResult; return r && r.ok === false && r.reason === 'host_rank_too_low'; }));
  check('rejected apply did NOT change canonical style', await A.page.evaluate(() => window.__neon_city.stewardship().arcade_front.palette === 'magenta'));

  // client CANNOT forge a stewardship fact
  await A.page.evaluate(() => window.__neon_city.client.send({ t: 'city_stewardship_applied', event: { type: 'city_stewardship_applied', target: 'arcade_front', palette: 'white' } }));
  await A.page.waitForFunction(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type', null, { timeout: 5000 }).catch(() => {});
  check('forged stewardship event is rejected (unknown_type)', await A.page.evaluate(() => window.__neon_city.lastError && window.__neon_city.lastError.code === 'unknown_type'));

  // earn stewardship eligibility: enter the arcade portal (support activity raises host rank)
  await seekTo(A, 240, 580);
  await A.page.evaluate(() => window.__neon_city.enterPortal());
  await sleep(250);
  await A.page.evaluate(() => window.__neon_city.requestHostRank());
  await A.page.waitForFunction(() => window.__neon_city.eligible() === true, null, { timeout: 8000 }).catch(() => {});
  check('became stewardship-eligible after host-rank support activity', await A.page.evaluate(() => window.__neon_city.eligible() === true));
  check('in-place arcade interior opened (4C intact)', await A.page.evaluate(() => window.__neon_city.interiorOpen === true));
  await A.page.evaluate(() => window.__neon_city.closeInterior());
  await sleep(150);

  // eligible PREVIEW works (local + server-confirmed) without changing canonical
  await A.page.evaluate(() => window.__neon_city.previewStewardship('arcade_front', { palette: 'amber', sign_variant: 'circuit', intensity: 'high' }));
  await A.page.waitForFunction(() => window.__neon_city.blockStyle().arcade_front.palette === 'amber', null, { timeout: 5000 }).catch(() => {});
  check('preview shows the amber arcade front (effective style)', await A.page.evaluate(() => window.__neon_city.blockStyle().arcade_front.palette === 'amber'));
  check('preview did NOT persist to canonical', await A.page.evaluate(() => window.__neon_city.stewardship().arcade_front.palette === 'magenta'));

  // eligible APPLY changes the visible (renderer-consumed) arcade-front accent → canonical
  await sleep(300);
  await A.page.evaluate(() => window.__neon_city.applyStewardship('arcade_front', { palette: 'amber', sign_variant: 'circuit', intensity: 'high' }));
  await A.page.waitForFunction(() => window.__neon_city.stewardship().arcade_front.palette === 'amber', null, { timeout: 6000 }).catch(() => {});
  check('apply changed the canonical arcade-front accent to amber', await A.page.evaluate(() => window.__neon_city.stewardship().arcade_front.palette === 'amber'));
  check('apply is reflected in the effective render style', await A.page.evaluate(() => window.__neon_city.blockStyle().arcade_front.palette === 'amber'));
  check('a stewardship event appears in the world log', await A.page.evaluate(() => window.__neon_city.events().some((e) => e.type === 'city_stewardship_applied')));

  // RESET restores the city default for the whole block
  await sleep(300);
  await A.page.evaluate(() => window.__neon_city.resetStewardship());
  await A.page.waitForFunction(() => window.__neon_city.stewardship().arcade_front.palette === 'magenta', null, { timeout: 6000 }).catch(() => {});
  check('reset restored the city default (arcade magenta)', await A.page.evaluate(() => window.__neon_city.stewardship().arcade_front.palette === 'magenta'));

  // no ownership/money copy in the stewardship panel or world log
  check('no ownership/money copy in stewardship UI', await A.page.evaluate(() => {
    const txt = document.getElementById('cityStewardship').textContent + ' ' + document.getElementById('cityEventLog').textContent;
    return !/\$|cash|payout|earn|profit|\bown\b|owner|landlord|tenant|rent|income|stake|token|market|price|\bbuy\b|\bsell\b|\btrade\b/i.test(txt);
  }));
  check('no private/economy data in stewardship state', await A.page.evaluate(() => !/balance|ledger|inventory|secret|account|token|price/i.test(JSON.stringify(window.__neon_city.stewardship()))));

  // existing layers still present
  check('city pressure panel still present (4D intact)', await A.page.evaluate(() => window.__neon_city.pressure() !== null));
  check('host rank panel still present (4E intact)', await A.page.evaluate(() => window.__neon_city.hostRank() !== null));
  check('world log still present (4C intact)', await A.page.evaluate(() => { const el = document.getElementById('cityEventLog'); return !!el && el.children.length >= 1; }));

  check('no console / page errors', A.errors.length === 0);
  if (A.errors.length) console.log('  errors:', JSON.stringify(A.errors, null, 2));
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nCITY STEWARDSHIP SMOKE: PASS' : `\nCITY STEWARDSHIP SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
