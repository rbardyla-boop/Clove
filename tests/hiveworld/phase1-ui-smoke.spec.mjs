/**
 * Phase 1 parity — minimal HiveWorld testbed UI smoke (Playwright).
 *
 * Loads the testbed, confirms the Phase 1 arcade panel renders, drives a Phase 1
 * arcade round + a Phase 1 scenario through the real buttons, and asserts zero
 * console/page errors. Portable: resolve Playwright from PW_REQUIRE_BASE.
 *
 * Run: tests/hiveworld/run-ui-smoke.sh   (or set BASE_URL + PW_REQUIRE_BASE)
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const URL = `${BASE}/arcade/hiveworld-sim/hiveworld-testbed.html`;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('#p1-arcade', { timeout: 8000 });
  await page.waitForFunction(() => document.querySelectorAll('#p1-arcade .cab').length >= 3, null, { timeout: 8000 });
  check('Phase 1 arcade panel renders the cabinet catalog (>=3 cabinets)', true);

  // render-state classes present (playable Pulse/Signal/Neon Grid + unavailable broken cabinets)
  const text = await page.evaluate(() => document.querySelector('#p1-arcade').textContent);
  check('panel shows playable + unavailable render-states', /playable/.test(text) && /unavailable/.test(text));

  // Drive a server-authoritative arcade round through the real button.
  await page.selectOption('#sel-p1-cab', 'grid');
  await page.click('[data-action="p1-play"]');
  await page.waitForFunction(() => /tickets/.test(document.querySelector('#p1-arcade .seldet')?.textContent || ''), null, { timeout: 8000 });
  const after = await page.evaluate(() => document.querySelector('#p1-arcade .seldet').textContent);
  check('playing a Neon Grid round awards tickets (26) in the panel', /26/.test(after));
  check('a public feed event appears after the round', await page.evaluate(() => /ticket_award/.test(document.querySelector('#p1-arcade .ticker')?.textContent || '')));

  // Run a Phase 1 scenario through the real button.
  await page.selectOption('#sel-p1-scenario', 'threeCabinetTour');
  await page.click('[data-action="run-phase1"]');
  await page.waitForFunction(() => /70/.test(document.querySelector('#p1-arcade .seldet')?.textContent || ''), null, { timeout: 8000 });
  check('Three Cabinet Tour scenario shows the 70-ticket combined balance', true);

  check('no console / page errors', errors.length === 0);
  if (errors.length) console.log('  errors:', JSON.stringify(errors, null, 2));
} finally {
  await browser.close();
}
console.log(failures === 0 ? '\nUI SMOKE: PASS' : `\nUI SMOKE: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
