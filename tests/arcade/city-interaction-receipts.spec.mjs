/**
 * Phase 7E — server-confirmed interaction receipt browser smoke (against the city dev shim).
 *
 * Proves end-to-end: the client requests an interaction; the SERVER validates it against the
 * canonical position + zones + adjacency and returns an EPHEMERAL public-safe receipt; the UI
 * reflects accepted/rejected; arcade-entry is accepted only in-zone; travel is accepted only for
 * an adjacent block; unknown actions are rejected; a forged position in the request is ignored.
 *
 * Run: tests/arcade/run-city-interaction-receipts.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8086';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8794/arcade/city/ws';
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/city/index.html?test=1&debug=1&renderer=2d&id=${id}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(url(`r${RUN}`), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon_city, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.connected, null, { timeout: 8000 });

  // request an interaction and wait for the server receipt (clears the slot first).
  // Space requests > the server's 250ms anti-spam gate so none are dropped.
  async function interact(payload) {
    await sleep(300);
    await page.evaluate(() => { window.__neon_city.lastInteractionReceipt = null; });
    await page.evaluate((p) => window.__neon_city.requestInteraction(p.kind, p.zoneId, p.target), payload);
    await page.waitForFunction(() => window.__neon_city.lastInteractionReceipt !== null, null, { timeout: 5000 }).catch(() => {});
    return page.evaluate(() => window.__neon_city.lastInteractionReceipt);
  }

  // ── travel receipts (no navigation needed) ──
  const adj = await interact({ kind: 'block_travel', zoneId: null, target: 'harbor-02' });
  check('travel to adjacent block accepted', !!adj && adj.accepted === true && adj.action_kind === 'block_travel' && adj.target_city_id === 'harbor-02');
  check('travel receipt is a city_interaction_receipt with receipt_id + issued_at', !!adj && adj.kind === 'city_interaction_receipt' && typeof adj.receipt_id === 'string' && adj.receipt_id.length > 0 && typeof adj.issued_at === 'number');
  check('receipt is public-safe with no private identifiers', !!adj && adj.public_safe === true && !Object.keys(adj).some((k) => /player|secret|token|session|user|password/i.test(k)));

  const far = await interact({ kind: 'block_travel', zoneId: null, target: 'skyline-03' });
  check('travel to NON-adjacent block rejected (server adjacency gate)', !!far && far.accepted === false);

  const unknown = await interact({ kind: 'definitely_not_a_real_action', zoneId: null, target: null });
  check('unknown action rejected (unknown_action)', !!unknown && unknown.accepted === false && unknown.reason === 'unknown_action');

  const evAck = await interact({ kind: 'district_event', zoneId: null, target: null });
  check('display ack (district_event) accepted', !!evAck && evAck.accepted === true && evAck.reason === 'ok');

  // ── arcade_entry: rejected outside the zone, accepted inside (server uses canonical position) ──
  const outside = await interact({ kind: 'arcade_entry', zoneId: 'arcade', target: null });
  check('arcade_entry rejected outside the zone (not_in_zone)', !!outside && outside.accepted === false && outside.reason === 'not_in_zone');

  // navigate INTO the arcade portal zone (x200-280, y560-600)
  const TX = 240, TY = 580;
  for (let i = 0; i < 90; i++) {
    const p = await page.evaluate(() => window.__neon_city.serverYou());
    if (!p) { await sleep(60); continue; }
    if (Math.abs(p.x - TX) > 10) await page.evaluate(({ tx, x }) => window.__neon_city.setInput(Math.sign(tx - x), 0), { tx: TX, x: p.x });
    else if (Math.abs(p.y - TY) > 10) await page.evaluate(({ ty, y }) => window.__neon_city.setInput(0, Math.sign(ty - y)), { ty: TY, y: p.y });
    else break;
    await sleep(80);
  }
  await page.evaluate(() => window.__neon_city.setInput(0, 0));
  await sleep(200);

  const inside = await interact({ kind: 'arcade_entry', zoneId: 'arcade', target: null });
  check('arcade_entry accepted inside the zone (server-confirmed)', !!inside && inside.accepted === true && inside.reason === 'ok' && inside.target === '/arcade/');

  // forged position in the request must be ignored — only the server canonical position counts.
  // (We are now INSIDE the zone, so even a request claiming to be elsewhere is accepted on server pos.)
  await sleep(300); // respect the server anti-spam gate before the forged send
  const forged = await page.evaluate(async () => {
    window.__neon_city.lastInteractionReceipt = null;
    window.__neon_city.client.send({ t: 'city_interaction_request', action_kind: 'arcade_entry', zone_id: 'arcade', x: 9999, y: 9999, accepted: false });
    return new Promise((res) => { const t = setInterval(() => { if (window.__neon_city.lastInteractionReceipt) { clearInterval(t); res(window.__neon_city.lastInteractionReceipt); } }, 50); setTimeout(() => { clearInterval(t); res(window.__neon_city.lastInteractionReceipt); }, 4000); });
  });
  check('forged position/accepted in request is ignored (server uses canonical pos)', !!forged && forged.accepted === true);

  // existing arcade entry path (server-gated portal) still works alongside receipts
  await page.evaluate(() => window.__neon_city.client.enterPortal('arcade'));
  await sleep(250);
  check('existing portal entry still server-confirmed (→ /arcade/)', await page.evaluate(() => window.__neon_city.lastPortalOk && window.__neon_city.lastPortalOk.target === '/arcade/'));

  check('canvas present + sized on phone viewport', await page.evaluate(() => { const c = document.querySelector('canvas'); return !!c && c.width > 0 && c.height > 0; }));
  check('no console/page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
} finally {
  await browser.close();
}

console.log(failures ? `\nCITY INTERACTION RECEIPTS SMOKE: ${failures} FAIL` : '\nCITY INTERACTION RECEIPTS SMOKE: PASS');
process.exit(failures ? 1 : 0);
