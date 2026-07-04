/**
 * Security/compatibility regression — Gate 1: od_clinical_scores warm-cache
 * compatibility, PLAINTEXT ONLY (ADR-052).
 *
 * od_clinical_scores stays plaintext in this gate — ENCRYPT_KEYS is NOT touched.
 * The point of this suite is to prove every consumer (clinical-assessments.html
 * writer+reader, clinical-report.html, progress-report.html, progress-dashboard.html,
 * toolshed.html export) now goes through od-core.js's intelGet/intelSet/whenIntelReady
 * machinery, and that doing so changes NOTHING about rendered output, scoring math,
 * retention, or export content while the key remains plaintext — so a future gate
 * can flip od_clinical_scores into ENCRYPT_KEYS without touching these pages again.
 *
 * Also proves the od-core.js _applyRetention ordering fix: od_clinical_scores is
 * appended newest-last by clinical-assessments.html's scoreTest(), so retention must
 * keep the newest (tail), not the oldest (head) — verified by entry identity, not
 * just array length.
 *
 * Run: tests/security/run-clinical-scores-compat.sh
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8953';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };

// ── Static source scan ───────────────────────────────────────────────────────────
const ODCORE = readFileSync(here('../../od-core.js'), 'utf8');
const CA = readFileSync(here('../../clinical-assessments.html'), 'utf8');
const CR = readFileSync(here('../../clinical-report.html'), 'utf8');
const PR = readFileSync(here('../../progress-report.html'), 'utf8');
const PD = readFileSync(here('../../progress-dashboard.html'), 'utf8');
const TS = readFileSync(here('../../toolshed.html'), 'utf8');

// Gate 3 (ADR-052) flipped od_clinical_scores into ENCRYPT_KEYS for real; the
// structural wiring this suite otherwise checks (intelGet/intelSet/whenIntelReady
// routing, script order, retention ordering, rendered/export content) is encryption-
// agnostic and remains valid unchanged. See clinical-scores-encrypted.spec.mjs for
// the dedicated encrypted-mode regression coverage.
check('od_clinical_scores is in ENCRYPT_KEYS (Gate 3 — encryption now enabled)', /var ENCRYPT_KEYS = \['od_redprotocol_log', ?'od_clinical_scores'\];/.test(ODCORE));
check('retention is ordering-aware (RETENTION_NEWEST_LAST for od_clinical_scores)', /var RETENTION_NEWEST_LAST = \{ od_clinical_scores: true \};/.test(ODCORE));
check('_applyRetention keeps the tail for newest-last keys', /RETENTION_NEWEST_LAST\[key\] \? value\.slice\(-cap\) : value\.slice\(0, cap\)/.test(ODCORE));

check('clinical-assessments loads od-core.js exactly once', (CA.match(/od-core\.js/g) || []).length === 1);
check('clinical-assessments loads od-core.js before its inline script', CA.indexOf('<script src="od-core.js">') < CA.indexOf('var KEY=\'od_clinical_scores\''));
check('clinical-assessments loadScores routes through intelGet', /function loadScores\(\)\{ if\(window\.intelGet\)/.test(CA));
check('clinical-assessments write routes through intelSet', /if\(window\.intelSet\)\{window\.intelSet\(KEY,scores\);\}/.test(CA));
check('clinical-assessments gates initial render behind whenIntelReady', /whenIntelReady\(\) : Promise\.resolve\(\)\)\.then\(render\);/.test(CA));

check('clinical-report loads od-core.js', /<script src="od-core\.js"><\/script>/.test(CR));
check('clinical-report loadScores routes through intelGet', /function loadScores\(\)\{ if\(window\.intelGet\)/.test(CR));
check('clinical-report gates BOTH render() call sites behind whenIntelReady', (CR.match(/whenIntelReady\(\) : Promise\.resolve\(\)\)\.then/g) || []).length === 2);

check('progress-report loads od-core.js', /<script src="od-core\.js"><\/script>/.test(PR));
check('progress-report sg() routes through intelGet', /function sg\(k,fb\)\{ if\(typeof window\.intelGet/.test(PR));
check('progress-report gates render() behind whenIntelReady', /whenIntelReady\(\) : Promise\.resolve\(\)\)\.then\(render\);/.test(PR));
check('progress-report exportText() is async and awaits whenIntelReady', /async function exportText\(\)\{\s*if\(window\.whenIntelReady\)/.test(PR));

check('progress-dashboard loads od-core.js', /<script src="od-core\.js"><\/script>/.test(PD));
check('progress-dashboard sg() routes through intelGet', /function sg\(k,fb\)\{ if\(typeof window\.intelGet/.test(PD));
check('progress-dashboard gates render() behind whenIntelReady', /whenIntelReady\(\) : Promise\.resolve\(\)\)\.then\(render\);/.test(PD));

check('toolshed safeGet routes through intelGet', /if \(typeof window\.intelGet === 'function'\) \{ var v = window\.intelGet\(key, \[\]\);/.test(TS));
check('toolshed exportAll is async and awaits whenIntelReady', /async function exportAll\(\) \{\s*if \(window\.whenIntelReady\)/.test(TS));

for (const [name, src] of [['od-core.js', ODCORE], ['clinical-assessments.html', CA], ['clinical-report.html', CR], ['progress-report.html', PR], ['progress-dashboard.html', PD], ['toolshed.html', TS]]) {
  check(`no network/sync/cloud calls added to ${name}`, !/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(src));
}

// ── Behavioral (browser) ─────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const seedScore = (test, score, dayOffset) => ({
    test, score, answers: {}, date: `2026-06-${String(10 + dayOffset).padStart(2, '0')}`, ts: Date.now() + dayOffset,
  });

  // 1. Seed EXISTING plaintext clinical scores (simulating pre-Gate-1 data) directly,
  //    then confirm every consumer page still renders/exports them after warm-cache.
  const existingScores = [
    seedScore('phq9', 12, 1),
    seedScore('gad7', 8, 2),
    seedScore('pcl5', 20, 3),
  ];
  await page.goto(`${BASE}/clinical-assessments.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.intelSet === 'function', null, { timeout: 10000 });
  await page.evaluate((scores) => localStorage.setItem('od_clinical_scores', JSON.stringify(scores)), existingScores);

  // 2. clinical-assessments.html: reload, view history, confirm scores render correctly.
  //    Gate 3 (ADR-052) flipped od_clinical_scores into ENCRYPT_KEYS, so legacy plaintext
  //    seeded above is now migrated to ciphertext on warm — content must still be correct.
  await page.goto(`${BASE}/clinical-assessments.html?view=history`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.evaluate(() => { window.view = 'history'; window.render(); });
  await page.waitForTimeout(100);
  const caHistoryText = await page.evaluate(() => (document.getElementById('content') || {}).textContent || '');
  check('clinical-assessments history DISPLAYS existing scores after warm', /3 TOTAL ASSESSMENTS/.test(caHistoryText));
  const rawAfterWarm = await page.evaluate(() => localStorage.getItem('od_clinical_scores'));
  const nowCiphertext = (() => { try { JSON.parse(rawAfterWarm); return false; } catch (_e) { return true; } })();
  check('od_clinical_scores is now ENCRYPTED at rest after warm (Gate 3)', nowCiphertext);

  // 3. Write path: take-a-test flow via scoreTest(), confirm scoring math + retention.
  //    PHQ-9 has exactly 9 items; answering "1" on each must sum to a score of 9.
  const phq9ItemCount = await page.evaluate(() => window.TESTS.phq9.items.length);
  check('PHQ-9 has 9 items (precondition for the scoring-math assertion below)', phq9ItemCount === 9);
  const writeResult = await page.evaluate(() => {
    window.activeTest = window.TESTS.phq9;
    window.answers = {};
    for (let i = 0; i < window.TESTS.phq9.items.length; i++) window.answers[i] = 1;
    window.scoreTest();
    return { view: window.view, count: window.loadScores().length, lastScore: window.loadScores()[window.loadScores().length - 1] };
  });
  check('scoreTest() preserves scoring math (9 items x 1 = score 9)', writeResult.lastScore.score === 9);
  check('scoreTest() appends a new entry (existing history preserved, not overwritten)', writeResult.count === 4);
  check('scoreTest() advances view to result', writeResult.view === 'result');
  const rawAfterWrite = await page.evaluate(() => localStorage.getItem('od_clinical_scores'));
  const writeIsCiphertext = (() => { try { JSON.parse(rawAfterWrite); return false; } catch (_e) { return true; } })();
  check('write path keeps od_clinical_scores ENCRYPTED (Gate 3)', writeIsCiphertext);

  // 4. Retention ordering: seed 600 push-ordered (newest-last) entries via intelSet,
  //    confirm the NEWEST 500 survive by identity, not just count.
  const retentionResult = await page.evaluate(async () => {
    const big = [];
    for (let i = 0; i < 600; i++) big.push({ test: 'phq9', score: i, answers: {}, date: 'd' + i, ts: i, marker: i });
    await window.intelSet('od_clinical_scores', big);
    const after = window.intelGet('od_clinical_scores', []);
    return { len: after.length, first: after[0].marker, last: after[after.length - 1].marker };
  });
  check('retention caps od_clinical_scores at 500', retentionResult.len === 500);
  check('retention keeps the NEWEST entries (highest marker survives at the tail)', retentionResult.last === 599);
  check('retention drops the OLDEST entries (marker 0..99 dropped, not 500..599)', retentionResult.first === 100);

  // Re-seed clean 3-entry history for the remaining page checks.
  await page.evaluate((scores) => window.intelSet('od_clinical_scores', scores), existingScores);

  // 5. clinical-report.html: both render() call sites eventually show the data.
  const crPageErrors = [];
  page.on('pageerror', (e) => crPageErrors.push(String(e)));
  await page.goto(`${BASE}/clinical-report.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.waitForTimeout(200); // allow both chained render() calls (incl. post-CDN-plugin) to settle
  // Read #content specifically, not document.body — body.textContent also walks the
  // page's own <script> tag source, whose string literals trivially contain "No data"
  // regardless of what actually rendered.
  const crText = await page.evaluate(() => (document.getElementById('content') || {}).textContent || '');
  check('clinical-report DISPLAYS existing scores after warm (both render sites)', /PHQ-9.*12.*27/.test(crText) && !/No Assessment Data/.test(crText));

  // 6. progress-report.html: render shows data, exportText() includes clinical section.
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
  check('progress-report exportText() includes the seeded PHQ-9 clinical entry', !!prExport && /PHQ-9 \(Depression\): 12\/27/.test(prExport));
  check('progress-report exportText() does NOT show the empty-state (data not silently omitted)', !!prExport && !/No assessments taken\./.test(prExport));

  // 7. progress-dashboard.html: feed/filter reflects existing scores.
  await page.goto(`${BASE}/progress-dashboard.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(100);
  const pdClinicalCount = await page.evaluate(() => {
    if (typeof window.sg !== 'function') return -1;
    var c = window.sg('od_clinical_scores', []);
    return Array.isArray(c) ? c.length : -1;
  });
  check('progress-dashboard sg() reads existing clinical scores after warm', pdClinicalCount === 3);

  // 8. toolshed.html: therapist-facing export includes clinical data, not silently omitted.
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
  check('toolshed exportAll() includes CLINICAL ASSESSMENTS — SCORES (3 entries) — exact count, not silently omitted', !!tsExport && /CLINICAL ASSESSMENTS — SCORES \(3 entries\)/.test(tsExport));

  // 9. Missing key -> unaffected empty-state behavior, no crash, across representative pages.
  await page.evaluate(() => localStorage.removeItem('od_clinical_scores'));
  const missingErrors = [];
  page.on('pageerror', (e) => missingErrors.push(String(e)));
  await page.goto(`${BASE}/clinical-assessments.html?view=history`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.evaluate(() => { window.view = 'history'; window.render(); });
  await page.waitForTimeout(100);
  const missingHistoryText = await page.evaluate(() => (document.getElementById('content') || {}).textContent || '');
  check('missing od_clinical_scores -> clinical-assessments shows empty state, no crash', /No assessments taken yet/i.test(missingHistoryText));

  // 10. Corrupt key -> no crash, data preserved on disk (not deleted), across a reader page.
  await page.evaluate(() => localStorage.setItem('od_clinical_scores', 'CORRUPT{not-json'));
  await page.goto(`${BASE}/progress-dashboard.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(100);
  const corruptStillThere = await page.evaluate(() => localStorage.getItem('od_clinical_scores'));
  check('corrupt od_clinical_scores value PRESERVED on disk (never silently deleted)', corruptStillThere === 'CORRUPT{not-json');

  check('no uncaught page errors across the full sequence', crPageErrors.length === 0 && missingErrors.length === 0);

  await ctx.close();
} finally { await browser.close(); }
console.log(fail ? `\nCLINICAL-SCORES COMPATIBILITY (Gate 3 — now encrypted): ${fail} FAIL` : '\nCLINICAL-SCORES COMPATIBILITY (Gate 3 — now encrypted): PASS');
process.exit(fail ? 1 : 0);
