/**
 * INTEL_KEYS retention-only hygiene (ADR-052 follow-up, NOT an encryption change).
 *
 * Inventoried all 20 non-sensitive INTEL_KEYS (od_redprotocol_log/od_clinical_scores
 * stay out of scope — already encrypted). Found two classes of gap:
 *
 *   1. RETENTION-ORDERING BUG (same class as the one fixed for od_clinical_scores in
 *      Gate 1): od_act_v1/od_dm_v1/od_rsd already had a 200-entry cap, but their
 *      writers PUSH (append, newest-last) while the cap took `.slice(0,200)` (keep
 *      the HEAD = oldest 200) — so once a user passed 200 logged sessions, every
 *      newly-added entry was silently dropped on save while ancient entries persisted
 *      forever. Fixed to `.slice(-200)` (keep the TAIL = newest), matching the
 *      already-correct pattern used by od_meditation/od_wgo_logs.
 *   2. NO CAP AT ALL: od_tipp_full/od_improve_full/od_mindfulness_full had zero size
 *      limit — simple unshift-ordered (newest-first) session-timestamp logs that grow
 *      forever. Added `.slice(0, 200)` (keep the HEAD = newest, matching the existing
 *      unshift+slice(0,N) pattern already used by od_chain_analysis/od_intercepts).
 *
 * Every other remaining INTEL_KEYS entry was inventoried and found already correctly
 * capped (od_cbt_records, od_values_records, od_aar_entries, od_protocol_logs via
 * splice(0,len-N); od_chain_analysis, od_opposite_action, od_intercepts via
 * slice(0,N); od_wgo_logs, od_meditation, od_protocol_hist via slice(-N)) or not
 * applicable (od_protocol_pending is a single ephemeral marker with an explicit
 * removeItem lifecycle; od_intel_brief/od_intel_last_run/od_intel_config are
 * single overwritten values, not accumulating logs) — left untouched.
 *
 * Run: tests/security/run-intel-keys-retention-hygiene.sh
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8956';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };

// ── Static source scan ───────────────────────────────────────────────────────────
const ODCORE = readFileSync(here('../../od-core.js'), 'utf8');
const ACT = readFileSync(here('../../act-drill.html'), 'utf8');
const DM = readFileSync(here('../../dear-man-drill.html'), 'utf8');
const RSD = readFileSync(here('../../rsd-shield-drill.html'), 'utf8');
const TIPP = readFileSync(here('../../tipp-drill-full.html'), 'utf8');
const IMPROVE = readFileSync(here('../../improve-drill-full.html'), 'utf8');
const MINDFUL = readFileSync(here('../../mindfulness-drill-full.html'), 'utf8');

check('ENCRYPT_KEYS is unchanged — exactly the two sensitive keys', /var ENCRYPT_KEYS = \['od_redprotocol_log', ?'od_clinical_scores'\];/.test(ODCORE));

check('act-drill.html: retention now keeps newest (slice(-200))', /localStorage\.setItem\('od_act_v1',JSON\.stringify\(arr\.slice\(-200\)\)\)/.test(ACT));
check('dear-man-drill.html: retention now keeps newest (slice(-200))', /localStorage\.setItem\('od_dm_v1',JSON\.stringify\(arr\.slice\(-200\)\)\)/.test(DM));
check('rsd-shield-drill.html: retention now keeps newest (slice(-200))', /localStorage\.setItem\('od_rsd',JSON\.stringify\(arr\.slice\(-200\)\)\)/.test(RSD));
check('tipp-drill-full.html: retention cap added (slice(0, 200))', /localStorage\.setItem\('od_tipp_full', JSON\.stringify\(logs\.slice\(0, 200\)\)\)/.test(TIPP));
check('improve-drill-full.html: retention cap added (slice(0, 200))', /localStorage\.setItem\('od_improve_full', JSON\.stringify\(logs\.slice\(0, 200\)\)\)/.test(IMPROVE));
check('mindfulness-drill-full.html: retention cap added (slice(0, 200))', /localStorage\.setItem\('od_mindfulness_full', JSON\.stringify\(logs\.slice\(0, 200\)\)\)/.test(MINDFUL));

for (const [name, src] of [['act-drill.html', ACT], ['dear-man-drill.html', DM], ['rsd-shield-drill.html', RSD], ['tipp-drill-full.html', TIPP], ['improve-drill-full.html', IMPROVE], ['mindfulness-drill-full.html', MINDFUL]]) {
  check(`no network/sync/cloud calls added to ${name}`, !/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(src));
}

// ── Behavioral (browser) ─────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // 1-3. Ordering-bug fix: push-ordered keys (oldest at low index, newest at high index).
  //      Seed a 201-entry marker array (0=oldest..200=newest), save, confirm the
  //      NEWEST marker (200) survives and only the OLDEST (0) is dropped.
  const orderingFixCases = [
    { page: 'act-drill.html', key: 'od_act_v1' },
    { page: 'dear-man-drill.html', key: 'od_dm_v1' },
    { page: 'rsd-shield-drill.html', key: 'od_rsd' },
  ];
  for (const { page: pg, key } of orderingFixCases) {
    await page.goto(`${BASE}/${pg}`, { waitUntil: 'load', timeout: 25000 });
    await page.waitForFunction(() => typeof window.saveEntries === 'function' && typeof window.loadEntries === 'function', null, { timeout: 10000 });
    const result = await page.evaluate(() => {
      const big = [];
      for (let i = 0; i < 201; i++) big.push({ marker: i });
      window.saveEntries(big);
      const after = window.loadEntries();
      return { len: after.length, first: after[0].marker, last: after[after.length - 1].marker };
    });
    check(`${key}: retention caps at 200`, result.len === 200);
    check(`${key}: retention keeps the NEWEST entry (marker 200 survives, was previously dropped)`, result.last === 200);
    check(`${key}: retention drops the OLDEST entry (marker 0 dropped, not 1..200)`, result.first === 1);
  }

  // 4-6. New-cap: unshift-ordered keys (newest at index 0). Seed 200 pre-existing
  //      marker entries (index 0 = marker 199 (newest of the seed) .. index 199 =
  //      marker 0 (oldest)), call the page's real logSession() once (adds ONE real
  //      entry with no marker field via unshift), confirm still capped at 200, the
  //      real new entry is now at index 0, and the true oldest seed entry (marker 0)
  //      was dropped.
  const newCapCases = [
    { page: 'tipp-drill-full.html', key: 'od_tipp_full' },
    { page: 'improve-drill-full.html', key: 'od_improve_full' },
    { page: 'mindfulness-drill-full.html', key: 'od_mindfulness_full' },
  ];
  for (const { page: pg, key } of newCapCases) {
    await page.goto(`${BASE}/${pg}`, { waitUntil: 'load', timeout: 25000 });
    await page.waitForFunction(() => typeof window.logSession === 'function', null, { timeout: 10000 });
    const result = await page.evaluate((k) => {
      const seed = [];
      for (let i = 199; i >= 0; i--) seed.push({ marker: i }); // index0=marker199(newest seed)..index199=marker0(oldest)
      localStorage.setItem(k, JSON.stringify(seed));
      window.logSession(); // real write path: unshifts one real {ts,time,date} entry, then caps
      const after = JSON.parse(localStorage.getItem(k));
      return { len: after.length, newestHasNoMarker: !('marker' in after[0]), newestHasTs: typeof after[0].ts === 'number', oldestMarker: after[after.length - 1].marker };
    }, key);
    check(`${key}: retention caps at 200 after a new write`, result.len === 200);
    check(`${key}: the just-logged real entry is at the front (unshift-ordered)`, result.newestHasNoMarker && result.newestHasTs);
    check(`${key}: retention drops the true oldest seed entry (marker 0 gone, marker 1 survives at the tail)`, result.oldestMarker === 1);
  }

  // 7. Missing key -> existing empty-state behavior unaffected, no crash (representative sample).
  await page.evaluate(() => localStorage.removeItem('od_act_v1'));
  await page.goto(`${BASE}/act-drill.html`, { waitUntil: 'load', timeout: 25000 });
  const missingResult = await page.evaluate(() => window.loadEntries());
  check('missing od_act_v1 -> loadEntries() returns [] safely, no crash', Array.isArray(missingResult) && missingResult.length === 0);

  await page.evaluate(() => localStorage.removeItem('od_tipp_full'));
  await page.goto(`${BASE}/tipp-drill-full.html`, { waitUntil: 'load', timeout: 25000 });
  const pageErrors1 = [];
  page.on('pageerror', (e) => pageErrors1.push(String(e)));
  await page.waitForFunction(() => typeof window.logSession === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.logSession());
  await page.waitForTimeout(100);
  const afterMissingTipp = await page.evaluate(() => JSON.parse(localStorage.getItem('od_tipp_full')));
  check('missing od_tipp_full -> logSession() still works, creates a fresh 1-entry log, no crash', Array.isArray(afterMissingTipp) && afterMissingTipp.length === 1);

  // 8. Corrupt value -> does not crash, is NOT silently deleted (representative sample
  //    across both an ordering-fixed key and a newly-capped key).
  await page.evaluate(() => localStorage.setItem('od_dm_v1', 'CORRUPT{not-json'));
  await page.goto(`${BASE}/dear-man-drill.html`, { waitUntil: 'load', timeout: 25000 });
  const corruptDmResult = await page.evaluate(() => window.loadEntries());
  check('corrupt od_dm_v1 -> loadEntries() returns [] safely, no crash', Array.isArray(corruptDmResult) && corruptDmResult.length === 0);
  const corruptDmStillThere = await page.evaluate(() => localStorage.getItem('od_dm_v1'));
  check('corrupt od_dm_v1 value PRESERVED on disk (never silently deleted)', corruptDmStillThere === 'CORRUPT{not-json');

  await page.evaluate(() => localStorage.setItem('od_mindfulness_full', 'CORRUPT{not-json-2'));
  const pageErrors2 = [];
  page.on('pageerror', (e) => pageErrors2.push(String(e)));
  await page.goto(`${BASE}/mindfulness-drill-full.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.logSession === 'function', null, { timeout: 10000 });
  const corruptMindfulRaw = await page.evaluate(() => localStorage.getItem('od_mindfulness_full'));
  check('corrupt od_mindfulness_full value PRESERVED on disk before any write (never silently deleted on load)', corruptMindfulRaw === 'CORRUPT{not-json-2');
  check('no uncaught page errors seeding/reading corrupt or missing values', pageErrors1.length === 0 && pageErrors2.length === 0);

  await ctx.close();
} finally { await browser.close(); }
console.log(fail ? `\nINTEL_KEYS RETENTION HYGIENE: ${fail} FAIL` : '\nINTEL_KEYS RETENTION HYGIENE: PASS');
process.exit(fail ? 1 : 0);
