/**
 * Creator Foundation CF-1 — local block editor browser smoke.
 * Loads the offline editor, checks the procedural preview renders + reacts, local validation
 * flips VALID→BLOCKED on a bad edit, no external network, no console errors, no economy copy.
 * Run: tests/creator/run-block-editor.sh
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';

// CF-2 sample artifacts (read from disk by the file inputs; not fetched over the network).
const SAMPLE_PKG = fileURLToPath(new URL('../../arcade/creator/samples/sample-block.package.json', import.meta.url));
const SAMPLE_RECEIPT = fileURLToPath(new URL('../../arcade/creator/approval/samples/sample-block.approved-receipt.json', import.meta.url));
const SAMPLE_MISMATCH = fileURLToPath(new URL('../../arcade/creator/approval/samples/sample-block.mismatch-receipt.json', import.meta.url));

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

  await page.goto(`${BASE}/arcade/creator/block-editor/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => document.getElementById('verdict') && document.getElementById('verdict').textContent !== '—', null, { timeout: 8000 });

  check('editor loads with controls', await page.evaluate(() => !!document.getElementById('palette') && document.querySelectorAll('#palette option').length >= 8));
  check('default compose validates VALID (local)', /VALID/.test(await page.evaluate(() => document.getElementById('verdict').textContent)));
  check('hash rendered (sha256:64hex)', /^sha256:[0-9a-f]{64}$/.test(await page.evaluate(() => document.getElementById('hash').textContent)));
  check('receipt note says not authorized for live world', /live_world_authorized=false/.test(await page.evaluate(() => document.getElementById('receiptNote').textContent)));

  const before = await page.evaluate(() => document.getElementById('preview').toDataURL());
  await page.selectOption('#palette', 'neon-red');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => document.getElementById('preview').toDataURL());
  check('changing palette changes the canvas preview', before !== after && after.length > 200);

  check('export package button enabled on valid', !(await page.evaluate(() => document.getElementById('exportPkg').disabled)));

  // invalid local edit → BLOCKED
  await page.fill('#package_id', 'Bad_ID');
  await page.waitForFunction(() => /BLOCKED/.test(document.getElementById('verdict').textContent), null, { timeout: 4000 }).catch(() => {});
  check('invalid edit shows BLOCKED report', /BLOCKED/.test(await page.evaluate(() => document.getElementById('verdict').textContent)));

  // ── CF-2 approved local preview (operator) ──────────────────────────────────────────────────
  const approvedBefore = await page.evaluate(() => document.getElementById('approvedPreview').toDataURL());
  await page.setInputFiles('#importPkg', SAMPLE_PKG);
  await page.setInputFiles('#importReceipt', SAMPLE_RECEIPT);
  await page.waitForFunction(() => /approved local preview loaded/i.test(document.getElementById('approvedStatus').textContent), null, { timeout: 5000 }).catch(() => {});

  check('approved import shows package hash (sha256:64hex)', /^sha256:[0-9a-f]{64}$/.test(await page.evaluate(() => document.getElementById('approvedHash').textContent)));
  check('approved local preview status ok', /approved local preview loaded/i.test(await page.evaluate(() => document.getElementById('approvedStatus').textContent)));
  check('local preview warning visible', /local preview only/i.test(await page.evaluate(() => document.getElementById('approvedWarning').textContent)));
  const approvedAfter = await page.evaluate(() => document.getElementById('approvedPreview').toDataURL());
  check('approved local preview canvas rendered', approvedBefore !== approvedAfter && approvedAfter.length > 200);

  // a non-matching receipt must NOT load (proves hash-binding is enforced)
  await page.setInputFiles('#importReceipt', SAMPLE_MISMATCH);
  await page.waitForFunction(() => /not loaded/i.test(document.getElementById('approvedStatus').textContent), null, { timeout: 5000 }).catch(() => {});
  check('approved preview loads ONLY with a matching receipt', /receipt_hash_mismatch/i.test(await page.evaluate(() => document.getElementById('approvedStatus').textContent)));
  check('mismatched receipt hides the live-world preview warning', '' === (await page.evaluate(() => document.getElementById('approvedWarning').textContent)));

  const buttonText = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map((b) => b.textContent.toLowerCase()).join(' | '));
  check('no submit/upload/live-world button', !/(submit|upload|go live|publish|live[- ]world)/i.test(buttonText));
  check('no affirmative live-world publish wording', !/(go live|publish to live|push to live|submit to live|upload to live|enter the live world|live-world ready)/i.test(await page.evaluate(() => document.body.innerText)));

  const bodyText = (await page.evaluate(() => document.body.innerText)).toLowerCase();
  check('no economy/ownership/marketplace copy', !/\b(buy|sell|marketplace|ownership|own your|rent|payout|price|for sale|upload to|submit to live)\b/.test(bodyText));
  check('no external (off-host) network requests', offHost.length === 0);
  if (offHost.length) console.log('   off-host:', offHost.join(', '));
  check('no console/page errors', errors.length === 0);
  if (errors.length) console.log('   errors:', errors.join(' | '));

  await ctx.close();
} finally { await browser.close(); }
console.log(fail ? `\nBLOCK EDITOR SMOKE: ${fail} FAIL` : '\nBLOCK EDITOR SMOKE: PASS');
process.exit(fail ? 1 : 0);
