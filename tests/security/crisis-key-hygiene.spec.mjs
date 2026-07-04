/**
 * Security regression — crisis-key local-storage hygiene (ADR-052).
 *
 * od_redprotocol_log (the crisis/self-harm log) is now encrypted at rest via od-core's
 * AES-GCM vault, read/written through a synchronous warm-cache with a legacy-plaintext
 * fallback and a whenIntelReady() barrier on red-protocol so the crisis history is never
 * silently blank. This spec asserts the failure modes that would harm a user:
 *   - old plaintext migrates to ciphertext at rest, losslessly
 *   - warm-cache timing: crisis history displays after reload (never blank)
 *   - sync reader compatibility (intelGet returns arrays/objects)
 *   - corrupt storage → fallback WITHOUT silent deletion
 *   - retention cap keeps the array bounded
 *   - missing key → empty state
 *   - no network/sync/cloud additions; closed/intentional encrypt-key list
 *
 * Run: tests/security/run-crisis-key-hygiene.sh
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8950';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };

// ── Static source scan ───────────────────────────────────────────────────────────
const ODCORE = readFileSync(here('../../od-core.js'), 'utf8');
const INTEL = readFileSync(here('../../intel-engine.js'), 'utf8');
const RP = readFileSync(here('../../red-protocol.html'), 'utf8');

// Gate 3 (ADR-052) authorized widening this closed list by exactly one key
// (od_clinical_scores) — still closed/intentional, just no longer single-entry.
check('encrypt-key list still contains od_redprotocol_log', /var ENCRYPT_KEYS = \[[^\]]*'od_redprotocol_log'/.test(ODCORE));
check('encrypt-key list is closed to exactly the two authorized keys (no scope creep)', (ODCORE.match(/var ENCRYPT_KEYS = \[([^\]]*)\];/) || [])[1]?.split(',').length === 2);
check('no network/sync/cloud calls in od-core.js', !/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(ODCORE));
check('no network/sync/cloud calls added to intel-engine.js', !/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(INTEL));
check('red-protocol loads od-core before its inline script', RP.indexOf('<script src="od-core.js"></script>') < RP.indexOf('function rpReadLogs'));
check('red-protocol loads od-core exactly once', (RP.match(/od-core\.js/g) || []).length === 1);
check('red-protocol gates first render behind whenIntelReady', /whenIntelReady[^]*?checkTodayLog\(\);\s*renderHistory\(\);/.test(RP));
check('intel-engine reads through intelGet when available', /window\.intelGet === 'function'/.test(INTEL));

// ── Behavioral (browser) ─────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const url = `${BASE}/red-protocol.html`;
  await page.goto(url, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function' && typeof window.intelGet === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());

  // 1. Seed LEGACY PLAINTEXT, reload → migrate + display
  await page.evaluate(() => localStorage.setItem('od_redprotocol_log', JSON.stringify([{ date: '2026-07-01', time: '10:00 AM', floor: 3 }])));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(150);

  const histText = await page.evaluate(() => (document.getElementById('historyList') || {}).textContent || '');
  check('crisis history DISPLAYS after warm (not blank)', histText.length > 0 && !/No activations recorded/i.test(histText));
  const rawAfter = await page.evaluate(() => localStorage.getItem('od_redprotocol_log'));
  const isCiphertext = (() => { try { JSON.parse(rawAfter); return false; } catch (_e) { return true; } })();
  check('od_redprotocol_log ENCRYPTED at rest after warm (no longer plain JSON)', !!rawAfter && isCiphertext);
  const decoded = await page.evaluate(() => window.intelGet('od_redprotocol_log', []));
  check('migration lossless — intelGet returns the original entry', Array.isArray(decoded) && decoded.length === 1 && decoded[0].date === '2026-07-01');

  // 2. Corrupt storage → fallback WITHOUT deletion
  await page.evaluate(() => localStorage.setItem('od_redprotocol_log', 'CORRUPT{not-json'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  const corruptGet = await page.evaluate(() => window.intelGet('od_redprotocol_log', []));
  check('corrupt storage → intelGet returns fallback []', Array.isArray(corruptGet) && corruptGet.length === 0);
  const stillThere = await page.evaluate(() => localStorage.getItem('od_redprotocol_log'));
  check('corrupt value PRESERVED on disk (never silently deleted)', stillThere === 'CORRUPT{not-json');

  // 3. Retention cap
  const cappedLen = await page.evaluate(async () => {
    const big = []; for (let i = 0; i < 250; i++) big.push({ date: 'd' + i, i });
    await window.intelSet('od_redprotocol_log', big);
    return window.intelGet('od_redprotocol_log', []).length;
  });
  check('retention caps od_redprotocol_log at 200', cappedLen === 200);

  // 4. Missing key → empty state
  const miss = await page.evaluate(() => window.intelGet('od_never_seen_intel_key', 'DEFAULT'));
  check('missing key → returns fallback', miss === 'DEFAULT');

  // 5. Sync reader compatibility — object + array shapes
  const shapes = await page.evaluate(async () => {
    await window.intelSet('od_redprotocol_log', [{ date: 'x' }]);
    return { arr: Array.isArray(window.intelGet('od_redprotocol_log', [])), fallbackObj: window.intelGet('od_missing_obj', {}) };
  });
  check('sync reader compatibility (array returned, object fallback works)', shapes.arr === true && typeof shapes.fallbackObj === 'object');

  await ctx.close();
} finally { await browser.close(); }
console.log(fail ? `\nCRISIS-KEY HYGIENE: ${fail} FAIL` : '\nCRISIS-KEY HYGIENE: PASS');
process.exit(fail ? 1 : 0);
