/**
 * Creator Foundation CF-3 — layered block editor browser smoke.
 * Loads the offline layered editor, checks the procedural preview renders + reacts across layer
 * dimensions, local validation flips VALID→BLOCKED, the CF-2 approved local preview loads only with a
 * matching receipt, and there is no live-world/submit/upload surface, no off-host network, no errors.
 * Run: tests/creator/run-layered-editor.sh
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8098';

const SAMPLE_PKG = fileURLToPath(new URL('../../arcade/creator/samples/sample-layered.package.json', import.meta.url));
const SAMPLE_RECEIPT = fileURLToPath(new URL('../../arcade/creator/approval/samples/sample-layered.approved-receipt.json', import.meta.url));
const SAMPLE_MISMATCH = fileURLToPath(new URL('../../arcade/creator/approval/samples/sample-layered.mismatch-receipt.json', import.meta.url));

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const offHost = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname)) offHost.push(r.url()); });

  await page.goto(`${BASE}/arcade/creator/layered-editor/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => document.getElementById('verdict') && document.getElementById('verdict').textContent !== '—', null, { timeout: 8000 });

  check('editor loads with layer controls', await page.evaluate(() => document.querySelectorAll('#facade_pattern option').length >= 13 && document.querySelectorAll('#symbolRows .layer-row').length >= 3 && document.querySelectorAll('#zoneRows .zone-row').length === 4));
  check('default compose validates VALID (local)', /VALID/.test(await page.evaluate(() => document.getElementById('verdict').textContent)));
  check('hash rendered (sha256:64hex)', /^sha256:[0-9a-f]{64}$/.test(await page.evaluate(() => document.getElementById('hash').textContent)));
  check('receipt note says not authorized for live world', /live_world_authorized=false/.test(await page.evaluate(() => document.getElementById('receiptNote').textContent)));

  const before = await page.evaluate(() => document.getElementById('preview').toDataURL());
  await page.selectOption('#facade_primary_color', 'neon-red');
  await page.waitForTimeout(120);
  const afterFacade = await page.evaluate(() => document.getElementById('preview').toDataURL());
  check('changing facade color changes the preview', before !== afterFacade && afterFacade.length > 200);

  await page.selectOption('#roof_accent_type', 'antenna-spike');
  await page.waitForTimeout(120);
  const afterRoof = await page.evaluate(() => document.getElementById('preview').toDataURL());
  check('changing a different layer (roof) changes the preview', afterRoof !== afterFacade);

  await page.selectOption('#palette_variant', 'retro-mono');
  await page.waitForTimeout(120);
  const afterVariant = await page.evaluate(() => document.getElementById('preview').toDataURL());
  check('palette variant recolors the preview', afterVariant !== afterRoof);

  check('export package button enabled on valid', !(await page.evaluate(() => document.getElementById('exportPkg').disabled)));

  // invalid local edit → BLOCKED (bad package_id)
  await page.fill('#package_id', 'Bad_ID');
  await page.waitForFunction(() => /BLOCKED/.test(document.getElementById('verdict').textContent), null, { timeout: 4000 }).catch(() => {});
  check('invalid edit shows BLOCKED report', /BLOCKED/.test(await page.evaluate(() => document.getElementById('verdict').textContent)));
  await page.fill('#package_id', 'downtown-neon-facade-01');

  // layered-specific invalid: disable all lighting zones → 0 zones → BLOCKED
  for (const z of ['left-face', 'right-face', 'roof', 'tile']) { const cb = await page.$(`#zone_${z}_on`); if (cb && await cb.isChecked()) await cb.uncheck(); }
  await page.waitForTimeout(120);
  check('disabling all lighting zones is BLOCKED (1–4 required)', /BLOCKED/.test(await page.evaluate(() => document.getElementById('verdict').textContent)));

  // ── CF-2 approved local preview (operator) for block_layered ─────────────────────────────────
  const approvedBefore = await page.evaluate(() => document.getElementById('approvedPreview').toDataURL());
  await page.setInputFiles('#importPkg', SAMPLE_PKG);
  await page.setInputFiles('#importReceipt', SAMPLE_RECEIPT);
  await page.waitForFunction(() => /approved local preview loaded/i.test(document.getElementById('approvedStatus').textContent), null, { timeout: 5000 }).catch(() => {});
  check('approved import shows package hash (sha256:64hex)', /^sha256:[0-9a-f]{64}$/.test(await page.evaluate(() => document.getElementById('approvedHash').textContent)));
  check('approved local preview status ok', /approved local preview loaded/i.test(await page.evaluate(() => document.getElementById('approvedStatus').textContent)));
  check('local preview warning visible', /local preview only/i.test(await page.evaluate(() => document.getElementById('approvedWarning').textContent)));
  const approvedAfter = await page.evaluate(() => document.getElementById('approvedPreview').toDataURL());
  check('approved local preview canvas rendered', approvedBefore !== approvedAfter && approvedAfter.length > 200);

  await page.setInputFiles('#importReceipt', SAMPLE_MISMATCH);
  await page.waitForFunction(() => /not loaded/i.test(document.getElementById('approvedStatus').textContent), null, { timeout: 5000 }).catch(() => {});
  check('approved preview loads ONLY with a matching receipt', /receipt_hash_mismatch/i.test(await page.evaluate(() => document.getElementById('approvedStatus').textContent)));

  const buttonText = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.textContent.toLowerCase()).join(' | '));
  check('no submit/upload/live-world button', !/(submit|upload|go live|publish|live[- ]world)/i.test(buttonText));
  check('no affirmative live-world publish wording', !/(go live|publish to live|push to live|submit to live|upload to live|enter the live world)/i.test(await page.evaluate(() => document.body.innerText)));

  const bodyText = (await page.evaluate(() => document.body.innerText)).toLowerCase();
  check('no economy/ownership/marketplace copy', !/\b(buy|sell|marketplace|ownership|own your|rent|payout|price|for sale|upload to|submit to live)\b/.test(bodyText));
  check('no external (off-host) network requests', offHost.length === 0);
  if (offHost.length) console.log('   off-host:', offHost.join(', '));
  check('no console/page errors', errors.length === 0);
  if (errors.length) console.log('   errors:', errors.join(' | '));

  await ctx.close();
} finally { await browser.close(); }
console.log(fail ? `\nLAYERED EDITOR SMOKE: ${fail} FAIL` : '\nLAYERED EDITOR SMOKE: PASS');
process.exit(fail ? 1 : 0);
