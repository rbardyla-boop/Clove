/**
 * Phase 7A — city interaction zones / action prompts browser smoke.
 *
 * Proves end-to-end against the city dev shim that the interaction-zone kernel
 * (city-interactions.mjs) drives the LIVE arcade prompt: approaching the arcade surfaces an
 * arcade_entry zone + the prompt; the action_request shape is public-safe; moving away clears
 * it; the model rejects forbidden kinds in-browser; phone viewport stays usable with no errors.
 *
 * Run: tests/arcade/run-city-interactions.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8084';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8792/arcade/city/ws';
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/city/index.html?test=1&debug=1&renderer=2d&id=${id}&ws=${encodeURIComponent(WS)}`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // phone viewport
  const page = await ctx.newPage();
  const errors = [];
  const noise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !noise(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(url(`i${RUN}`), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon_city, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__neon_city.connected, null, { timeout: 8000 });

  // model is derived for the block: an arcade_entry zone exists with a safe action type
  const zones = await page.evaluate(() => window.__neon_city.interactionZones());
  const arcadeZone = zones.find((z) => z.kind === 'arcade_entry');
  check('interaction zones derived (arcade_entry present)', !!arcadeZone);
  check('arcade_entry action_request_type is arcade_entry_request', arcadeZone && arcadeZone.action_request_type === 'arcade_entry_request');
  check('zone is public-safe with a non-empty label', arcadeZone && arcadeZone.public_safe === true && typeof arcadeZone.label === 'string' && arcadeZone.label.length > 0);

  // far from the zone → no active interaction
  check('no active zone away from arcade', await page.evaluate(() => window.__neon_city.activeZone() === null));

  // navigate INTO the arcade portal zone (x200-280, y560-600) — mirrors city-authority.spec
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

  const active = await page.evaluate(() => window.__neon_city.activeZone());
  check('active zone is arcade_entry inside the arcade zone', !!active && active.kind === 'arcade_entry');
  const req = await page.evaluate(() => window.__neon_city.actionRequest());
  check('action_request has the 7E-confirmable shape', !!req && req.action_request_type === 'arcade_entry_request' && typeof req.zone_id === 'string' && typeof req.city_id === 'string');
  check('action_request carries no private identifiers', !!req && !Object.keys(req).some((k) => /player|secret|token|session|user|ip/i.test(k)));
  check('live arcade prompt is shown (model drives the prompt)', await page.evaluate(() => !document.getElementById('portalPrompt').hidden));

  // move away → prompt + active zone clear
  await page.evaluate(() => window.__neon_city.setInput(1, 0));
  await sleep(900);
  await page.evaluate(() => window.__neon_city.setInput(0, 0));
  await sleep(200);
  check('active zone clears when leaving the arcade zone', await page.evaluate(() => window.__neon_city.activeZone() === null));

  // model rejects forbidden kinds / picks priority — verified in-browser with the real module
  await page.addScriptTag({
    type: 'module',
    content: `import * as I from '/arcade/city/city-interactions.mjs';
      const base={zone_id:'z',city_id:'downtown-01',x:0,y:0,w:10,h:10,priority:1,public_safe:true};
      window.__ix = {
        forbidden: I.validateInteractionZone({...base,kind:'shop',label:'Shop',prompt:'Buy'}).ok === false,
        economyCopy: I.validateInteractionZone({...base,kind:'arcade_entry',label:'Buy tickets',prompt:'x'}).ok === false,
        priority: (() => { const a={...base,kind:'arcade_entry',label:'A',prompt:'A',priority:1};
                           const b={...base,kind:'arcade_entry',label:'B',prompt:'B',priority:9,zone_id:'b'};
                           return I.nearestInteractionZone({x:5,y:5},[a,b]).zone_id==='b'; })(),
      };`,
  });
  await page.waitForFunction(() => !!window.__ix, null, { timeout: 5000 });
  const ix = await page.evaluate(() => window.__ix);
  check('model rejects forbidden zone kind (in-browser)', ix.forbidden);
  check('model rejects economy copy in label (in-browser)', ix.economyCopy);
  check('model selects highest-priority zone (in-browser)', ix.priority);

  check('canvas present + sized on phone viewport', await page.evaluate(() => { const c = document.querySelector('canvas'); return !!c && c.width > 0 && c.height > 0; }));
  check('no console/page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
} finally {
  await browser.close();
}

console.log(failures ? `\nCITY INTERACTIONS SMOKE: ${failures} FAIL` : '\nCITY INTERACTIONS SMOKE: PASS');
process.exit(failures ? 1 : 0);
