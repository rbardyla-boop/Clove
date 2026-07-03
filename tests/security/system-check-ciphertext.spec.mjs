/**
 * Security regression — system-check.html ciphertext-aware diagnostics.
 *
 * system-check.html's runDiagnostics()/purgeCorrupt() used to blind JSON.parse every
 * registered key and treat any parse failure as "corrupt" — including a known
 * ENCRYPT_KEYS ciphertext (od_redprotocol_log, encrypted at rest since the crisis-key
 * hygiene patch). purgeCorrupt() is a confirm-gated "delete all corrupt keys" button
 * that would have silently and irreversibly deleted a user's crisis/self-harm log.
 *
 * Fix: a page-local isKnownEncryptedPayload(key, raw) shape check (closed key list +
 * base64-envelope heuristic, no decryption/vault access) lets runDiagnostics() report
 * a known-encrypted key as OK/protected and lets purgeCorrupt() skip deleting it, while
 * leaving genuine corrupt-JSON detection/purge for every other key unchanged.
 *
 * Run: tests/security/run-system-check-ciphertext.sh
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8952';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };

// ── Static source scan ───────────────────────────────────────────────────────────
const SC = readFileSync(here('../../system-check.html'), 'utf8');

check('closed encrypted-key list (od_redprotocol_log only)', /var ENCRYPTED_KEYS = \['od_redprotocol_log'\];/.test(SC));
check('isKnownEncryptedPayload defined', /function isKnownEncryptedPayload\(key, raw\)/.test(SC));
check('runDiagnostics recognizes known-encrypted payloads before marking corrupt', /catch\(e\) \{\s*if \(isKnownEncryptedPayload\(entry\.key, raw\)\) \{/.test(SC));
check('purgeCorrupt skips known-encrypted payloads', /if \(isKnownEncryptedPayload\(entry\.key, raw\)\) return;.*protected/.test(SC));
check('purgeCorrupt is still confirm-gated', /function purgeCorrupt\(\) \{\s*if \(!confirm\(/.test(SC));
check('no network/sync/cloud calls added to system-check.html', !/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(SC));
check('od_clinical_scores NOT added to ENCRYPTED_KEYS', !/ENCRYPTED_KEYS\s*=\s*\[[^\]]*od_clinical_scores/.test(SC));

// ── Behavioral (browser) ─────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 1. Seed REAL ciphertext for od_redprotocol_log via od-core.js on red-protocol.html
  //    (same origin -> same localStorage + IndexedDB vault as system-check.html below).
  await page.goto(`${BASE}/red-protocol.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.intelSet === 'function', null, { timeout: 10000 });
  await page.evaluate(async () => {
    await window.intelSet('od_redprotocol_log', [{ date: '2026-07-03', time: '9:00 PM', floor: 2 }]);
  });
  const seededRaw = await page.evaluate(() => localStorage.getItem('od_redprotocol_log'));
  const seededIsCiphertext = (() => { try { JSON.parse(seededRaw); return false; } catch (_e) { return true; } })();
  check('seed produced real ciphertext (precondition)', !!seededRaw && seededIsCiphertext);

  // Also seed a genuinely corrupt, NON-encrypted registry key for contrast.
  await page.evaluate(() => localStorage.setItem('od_journal', 'CORRUPT{not-json'));

  // 2. Load system-check.html (same origin; never loads od-core.js) and let its
  //    auto-run (setTimeout(runDiagnostics,50)) render the Key Inventory into #content.
  await page.goto(`${BASE}/system-check.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.runDiagnostics === 'function', null, { timeout: 10000 });
  await page.waitForFunction(
    () => document.querySelectorAll('.kt-row').length > 0,
    null, { timeout: 10000 }
  );

  const rowFor = (key) => page.evaluate((k) => {
    var names = Array.from(document.querySelectorAll('.kt-name'));
    var nameEl = names.find(function (el) { return el.textContent === k; });
    if (!nameEl) return null;
    var row = nameEl.closest('.kt-row');
    return {
      classes: row.className,
      detail: row.querySelector('.kt-meta').textContent,
    };
  }, key);

  const redRow = await rowFor('od_redprotocol_log');
  check('rendered Key Inventory row found for od_redprotocol_log', !!redRow);
  check('od_redprotocol_log rendered as ok (not err/corrupt)', !!redRow && / ok(\s|$)/.test(redRow.classes) && !/ err(\s|$)/.test(redRow.classes));
  check('od_redprotocol_log detail reads "Encrypted at rest (protected)"', !!redRow && redRow.detail === 'Encrypted at rest (protected)');

  const journalRow = await rowFor('od_journal');
  check('rendered Key Inventory row found for od_journal', !!journalRow);
  check('genuinely corrupt od_journal STILL rendered as err/corrupt', !!journalRow && / err(\s|$)/.test(journalRow.classes) && journalRow.detail === 'CORRUPT — JSON parse failed');

  // Cross-check the underlying pure function directly too (defense in depth).
  const redProtocolClassifiedOk = await page.evaluate(() => {
    var raw = localStorage.getItem('od_redprotocol_log');
    return window.isKnownEncryptedPayload('od_redprotocol_log', raw) === true;
  });
  check('encrypted od_redprotocol_log recognized as known-encrypted payload', redProtocolClassifiedOk);

  const journalStillCorrupt = await page.evaluate(() => {
    var raw = localStorage.getItem('od_journal');
    return window.isKnownEncryptedPayload('od_journal', raw) === false;
  });
  check('non-encrypted corrupt key (od_journal) NOT classified as known-encrypted', journalStillCorrupt);

  // 3. purgeCorrupt(): accept the confirm dialog, verify encrypted key survives,
  //    genuinely-corrupt non-encrypted key is still purged.
  page.once('dialog', (d) => d.accept());
  await page.evaluate(() => window.purgeCorrupt());
  await page.waitForTimeout(150);

  const redAfterPurge = await page.evaluate(() => localStorage.getItem('od_redprotocol_log'));
  check('purgeCorrupt does NOT delete encrypted od_redprotocol_log', redAfterPurge === seededRaw);

  const journalAfterPurge = await page.evaluate(() => localStorage.getItem('od_journal'));
  check('purgeCorrupt STILL deletes genuinely corrupt od_journal', journalAfterPurge === null);

  // 4. purgeCorrupt remains confirm-gated: dismiss -> nothing is purged.
  await page.evaluate(() => localStorage.setItem('od_journal', 'CORRUPT{not-json-again'));
  page.once('dialog', (d) => d.dismiss());
  await page.evaluate(() => window.purgeCorrupt());
  await page.waitForTimeout(150);
  const journalAfterDismiss = await page.evaluate(() => localStorage.getItem('od_journal'));
  check('purgeCorrupt remains confirm-gated (dismiss -> nothing deleted)', journalAfterDismiss === 'CORRUPT{not-json-again');

  // 5. Missing key -> not treated as corrupt (unchanged 'empty' path).
  await page.evaluate(() => localStorage.removeItem('od_redprotocol_log'));
  const missingClassifiedOk = await page.evaluate(() => {
    var raw = localStorage.getItem('od_redprotocol_log');
    return raw === null && window.isKnownEncryptedPayload('od_redprotocol_log', raw) === false;
  });
  check('missing encrypted key -> not treated as corrupt/encrypted (empty path unaffected)', missingClassifiedOk);

  await ctx.close();
} finally { await browser.close(); }
console.log(fail ? `\nSYSTEM-CHECK CIPHERTEXT DIAGNOSTICS: ${fail} FAIL` : '\nSYSTEM-CHECK CIPHERTEXT DIAGNOSTICS: PASS');
process.exit(fail ? 1 : 0);
