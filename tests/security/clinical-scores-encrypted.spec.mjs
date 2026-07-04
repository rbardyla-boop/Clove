/**
 * Gate 3 — od_clinical_scores PRODUCTION ENCRYPTION regression (ADR-052).
 *
 * od-core.js's ENCRYPT_KEYS now includes od_clinical_scores for real (no temporary
 * patching — this runs directly against the shipped code). This suite is the
 * production-facing successor to the Gate 2 proof harness
 * (proof/clinical-scores-encrypted-mode, commit 61f773c, never merged): the same
 * behavioral surface, now asserted against the actual flip rather than a
 * restore-on-exit patch.
 *
 * Covers: lossless legacy-plaintext migration, ciphertext-at-rest stability, all 5
 * consumer pages' render/export paths, the un-awaited-write-then-immediate-reload
 * race (clinical-assessments.html's scoreTest() does not await intelSet()),
 * retention-by-identity under real encryption, scoring-severity purity, missing/
 * corrupt-key safety, and system-check.html's recognition of the now-encrypted key
 * (a required companion change, made in this same commit).
 *
 * Run: tests/security/run-clinical-scores-encrypted.sh
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8955';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };
const isJson = (raw) => { try { JSON.parse(raw); return true; } catch (_e) { return false; } };

// ── Static source scan ───────────────────────────────────────────────────────────
const CORE = readFileSync(here('../../od-core.js'), 'utf8');
check('ENCRYPT_KEYS includes od_clinical_scores', /var ENCRYPT_KEYS = \['od_redprotocol_log', ?'od_clinical_scores'\];/.test(CORE));
check('ENCRYPT_KEYS is exactly the two expected keys (no others added)', (CORE.match(/var ENCRYPT_KEYS = \[([^\]]*)\];/) || [])[1]?.split(',').length === 2);
check('RETENTION_NEWEST_LAST for od_clinical_scores untouched (still true)', /var RETENTION_NEWEST_LAST = \{ od_clinical_scores: true \};/.test(CORE));

const seedScore = (test, score, day) => ({ test, score, answers: {}, date: `2026-06-${String(10 + day).padStart(2, '0')}`, ts: 1750000000000 + day });
const existingScores = [seedScore('phq9', 12, 1), seedScore('gad7', 8, 2), seedScore('pcl5', 20, 3)];

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 1. MIGRATION: seed legacy plaintext, load a page, confirm warm-cache migrates
  //    it to ciphertext (no longer valid JSON) and the migration is lossless.
  await page.goto(`${BASE}/clinical-assessments.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.intelSet === 'function', null, { timeout: 10000 });
  await page.evaluate((scores) => localStorage.setItem('od_clinical_scores', JSON.stringify(scores)), existingScores);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(150);

  const rawAfterWarm = await page.evaluate(() => localStorage.getItem('od_clinical_scores'));
  check('od_clinical_scores is ENCRYPTED at rest after warm (no longer plain JSON)', !!rawAfterWarm && !isJson(rawAfterWarm));
  const decoded = await page.evaluate(() => window.intelGet('od_clinical_scores', []));
  check('migration is LOSSLESS — intelGet returns all 3 original entries', Array.isArray(decoded) && decoded.length === 3 && decoded.some((s) => s.test === 'phq9' && s.score === 12));

  // 2. RELOAD FROM CIPHERTEXT: reload again (no migration this time, already ciphertext).
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  const decodedAgain = await page.evaluate(() => window.intelGet('od_clinical_scores', []));
  check('ciphertext-at-rest reads correctly on a second reload', Array.isArray(decodedAgain) && decodedAgain.length === 3);
  const rawStillCipher = await page.evaluate(() => localStorage.getItem('od_clinical_scores'));
  check('value remains ciphertext (stable, not re-migrated/corrupted)', !isJson(rawStillCipher));

  // 3. clinical-assessments.html history view displays existing (now-encrypted) scores.
  await page.evaluate(() => { window.view = 'history'; window.render(); });
  await page.waitForTimeout(100);
  const historyText = await page.evaluate(() => (document.getElementById('content') || {}).textContent || '');
  check('clinical-assessments history DISPLAYS scores read from ciphertext', /3 TOTAL ASSESSMENTS/.test(historyText));

  // 4. CRITICAL: write-then-immediate-reload race. clinical-assessments.html's
  //    scoreTest() calls window.intelSet(KEY,scores) WITHOUT awaiting it. Under
  //    real encryption intelSet's persist path is genuinely async (crypto.subtle.encrypt
  //    + localStorage.setItem after an await) — reload immediately after a write, with
  //    NO extra wait, to confirm the new entry is not lost to this race.
  await page.evaluate(() => {
    window.activeTest = window.TESTS.gad7;
    window.answers = {};
    for (let i = 0; i < window.TESTS.gad7.items.length; i++) window.answers[i] = 2;
    window.scoreTest(); // un-awaited intelSet() write happens here
  });
  await page.reload({ waitUntil: 'load' }); // no artificial delay — the adversarial case
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(100);
  const postWriteReload = await page.evaluate(() => window.intelGet('od_clinical_scores', []));
  const newEntrySurvived = Array.isArray(postWriteReload) && postWriteReload.length === 4 && postWriteReload.some((s) => s.test === 'gad7' && postWriteReload.filter((x) => x.test === 'gad7').length === 2);
  check('WRITE-THEN-IMMEDIATE-RELOAD: new score survives the un-awaited encrypted write (race check)', newEntrySurvived);
  if (!newEntrySurvived) {
    console.log('    >>> RACE CONFIRMED: un-awaited intelSet() write can be lost on immediate reload under encryption.');
    console.log('    >>> Actual post-reload data: ' + JSON.stringify(postWriteReload));
  }

  // Re-seed a clean, known 3-entry baseline for the remaining page checks.
  await page.evaluate((scores) => window.intelSet('od_clinical_scores', scores), existingScores);
  await page.waitForTimeout(100);

  // 5. clinical-report.html: both render() call sites display data read from ciphertext.
  const crPageErrors = [];
  page.on('pageerror', (e) => crPageErrors.push(String(e)));
  await page.goto(`${BASE}/clinical-report.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.waitForTimeout(200);
  const crText = await page.evaluate(() => (document.getElementById('content') || {}).textContent || '');
  check('clinical-report DISPLAYS scores read from ciphertext (both render sites)', /PHQ-9.*12.*27/.test(crText) && !/No Assessment Data/.test(crText));

  // 6. progress-report.html: render + exportText() include data read from ciphertext.
  await page.goto(`${BASE}/progress-report.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    window.__capturedBlob = null;
    const OrigBlob = window.Blob;
    window.Blob = function (parts, opts) { window.__capturedBlob = parts.join(''); return new OrigBlob(parts, opts); };
  });
  await page.evaluate(() => window.exportText());
  await page.waitForTimeout(100);
  const prExport = await page.evaluate(() => window.__capturedBlob);
  check('progress-report exportText() includes clinical data read from ciphertext', !!prExport && /PHQ-9 \(Depression\): 12\/27/.test(prExport));

  // 7. progress-dashboard.html: feed/filter reflects scores read from ciphertext.
  await page.goto(`${BASE}/progress-dashboard.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(100);
  const pdClinicalCount = await page.evaluate(() => {
    var c = window.sg('od_clinical_scores', []);
    return Array.isArray(c) ? c.length : -1;
  });
  check('progress-dashboard sg() reads clinical scores from ciphertext', pdClinicalCount === 3);

  // 8. toolshed.html: therapist export includes clinical data read from ciphertext.
  await page.goto(`${BASE}/toolshed.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => {
    window.__capturedBlob = null;
    const OrigBlob = window.Blob;
    window.Blob = function (parts, opts) { window.__capturedBlob = parts.join(''); return new OrigBlob(parts, opts); };
  });
  await page.evaluate(() => window.exportAll());
  await page.waitForTimeout(150);
  const tsExport = await page.evaluate(() => window.__capturedBlob);
  check('toolshed exportAll() includes CLINICAL ASSESSMENTS — SCORES (3 entries) read from ciphertext', !!tsExport && /CLINICAL ASSESSMENTS — SCORES \(3 entries\)/.test(tsExport));

  // 9. Retention under real encryption: 600 push-ordered entries -> newest 500 survive by identity.
  const retentionResult = await page.evaluate(async () => {
    const big = [];
    for (let i = 0; i < 600; i++) big.push({ test: 'phq9', score: i, answers: {}, date: 'd' + i, ts: i, marker: i });
    await window.intelSet('od_clinical_scores', big);
    const after = window.intelGet('od_clinical_scores', []);
    return { len: after.length, first: after[0].marker, last: after[after.length - 1].marker };
  });
  check('retention caps od_clinical_scores at 500 under encryption', retentionResult.len === 500);
  check('retention keeps the NEWEST entries by identity under encryption', retentionResult.last === 599 && retentionResult.first === 100);
  const retRaw = await page.evaluate(() => localStorage.getItem('od_clinical_scores'));
  check('retained data is stored as ciphertext, not plaintext', !isJson(retRaw));

  // 10. Scoring severity/thresholds are a pure function of the score value — unaffected by storage.
  //     window.TESTS is only defined on clinical-assessments.html/clinical-report.html, not
  //     toolshed.html (the page still loaded from step 8) — navigate there first.
  await page.goto(`${BASE}/clinical-assessments.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.TESTS === 'object', null, { timeout: 10000 });
  const severityCheck = await page.evaluate(() => {
    var t = window.TESTS.phq9;
    return { minimal: t.severity(2).level, moderate: t.severity(12).level, severe: t.severity(24).level };
  });
  check('scoring severity thresholds are unchanged (pure function, storage-independent)',
    severityCheck.minimal === 'MINIMAL' && severityCheck.moderate === 'MODERATE' && severityCheck.severe === 'SEVERE');

  // 11. Missing key -> unaffected empty-state, no crash.
  await page.evaluate(() => localStorage.removeItem('od_clinical_scores'));
  const missingErrors = [];
  page.on('pageerror', (e) => missingErrors.push(String(e)));
  await page.goto(`${BASE}/clinical-assessments.html?view=history`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.evaluate(() => { window.view = 'history'; window.render(); });
  await page.waitForTimeout(100);
  const missingText = await page.evaluate(() => (document.getElementById('content') || {}).textContent || '');
  check('missing od_clinical_scores -> empty state unaffected by encryption, no crash', /No assessments taken yet/i.test(missingText));

  // 12. Corrupt ciphertext -> intelGet returns fallback, no crash, value PRESERVED (not deleted).
  await page.evaluate(() => localStorage.setItem('od_clinical_scores', 'CORRUPT{not-valid-base64-or-json'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  const corruptGet = await page.evaluate(() => window.intelGet('od_clinical_scores', []));
  check('corrupt ciphertext -> intelGet returns safe fallback, no crash', Array.isArray(corruptGet) && corruptGet.length === 0);
  const corruptStillThere = await page.evaluate(() => localStorage.getItem('od_clinical_scores'));
  check('corrupt value PRESERVED on disk (never silently deleted)', corruptStillThere === 'CORRUPT{not-valid-base64-or-json');

  check('no uncaught page errors across the encrypted-mode sequence', crPageErrors.length === 0 && missingErrors.length === 0);

  // 13. system-check.html now recognizes the real, production-encrypted od_clinical_scores
  //     as protected — this is the Gate 3 companion change (ENCRYPTED_KEYS widened by one
  //     key, mirroring the fix already shipped for od_redprotocol_log in PR #131). SCORED —
  //     this was informational-only under Gate 2's proof; production must get it right.
  await page.evaluate((scores) => window.intelSet('od_clinical_scores', scores), existingScores);
  await page.waitForTimeout(100);
  await page.goto(`${BASE}/system-check.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => document.querySelectorAll('.kt-row').length > 0, null, { timeout: 10000 });
  const scRow = await page.evaluate(() => {
    var nameEl = Array.from(document.querySelectorAll('.kt-name')).find((el) => el.textContent === 'od_clinical_scores');
    if (!nameEl) return null;
    var row = nameEl.closest('.kt-row');
    return { classes: row.className, detail: row.querySelector('.kt-meta').textContent };
  });
  check('system-check.html rendered a row for od_clinical_scores', !!scRow);
  check('system-check.html reports encrypted od_clinical_scores as ok/protected (NOT corrupt)',
    !!scRow && / ok(\s|$)/.test(scRow.classes) && !/ err(\s|$)/.test(scRow.classes) && scRow.detail === 'Encrypted at rest (protected)');

  await ctx.close();
} finally { await browser.close(); }
console.log(fail ? `\nCLINICAL-SCORES ENCRYPTED PRODUCTION REGRESSION: ${fail} FAIL` : '\nCLINICAL-SCORES ENCRYPTED PRODUCTION REGRESSION: PASS');
process.exit(fail ? 1 : 0);
