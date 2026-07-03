/**
 * Security/regression — intelligence-ops.html warm-cache load-order (ADR-052 follow-up).
 *
 * intelligence-ops.html was loading od-core.js (which defines window.intelGet /
 * window.intelSet / window.whenIntelReady / window.warmIntelCache) at the very end of
 * the document — AFTER an inline <script> that runs renderAll() -> renderProtocols()
 * -> IntelEngine.rankProtocols() synchronously at parse time. Since od_redprotocol_log
 * is encrypted at rest (AES-GCM, ADR-052), intel-engine.js's _load() fallback
 * (JSON.parse on raw localStorage) throws on ciphertext, is swallowed, and RED
 * PROTOCOL silently ranks with count 0 forever — the "crisis protocol" row on this
 * dashboard reads as never-used even when it has history.
 *
 * Fix: od-core.js now loads BEFORE intel-engine.js / the inline script, and the
 * init block (Night Shift catch-up + renderAll()) is gated behind
 * window.whenIntelReady(), mirroring the pattern already used on red-protocol.html.
 *
 * This spec asserts:
 *   - static load order + no duplicate od-core.js tag + whenIntelReady gating
 *   - RED PROTOCOL count reflects real history after warm-cache (not 0)
 *   - count stays correct across a SECOND reload (ciphertext-at-rest read, not just
 *     the migration moment)
 *   - missing key / corrupt key degrade safely (count 0, no uncaught page error)
 *   - no network/sync/cloud additions in the diff
 *
 * Run: tests/security/run-intelligence-ops-warm-cache.sh
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8951';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };

// ── Static source scan ───────────────────────────────────────────────────────────
const IOPS = readFileSync(here('../../intelligence-ops.html'), 'utf8');

const odCoreIdx = IOPS.indexOf('<script src="od-core.js"></script>');
const intelEngineIdx = IOPS.indexOf('<script src="intel-engine.js"></script>');
const whenIntelReadyIdx = IOPS.indexOf('whenIntelReady');

check('intelligence-ops loads od-core.js before intel-engine.js', odCoreIdx > -1 && intelEngineIdx > -1 && odCoreIdx < intelEngineIdx);
check('intelligence-ops loads od-core.js before its first whenIntelReady use', odCoreIdx > -1 && whenIntelReadyIdx > -1 && odCoreIdx < whenIntelReadyIdx);
check('intelligence-ops loads od-core.js exactly once', (IOPS.match(/od-core\.js/g) || []).length === 1);
check('intelligence-ops gates init behind whenIntelReady', /whenIntelReady[^]*?\.then\(initIntel\)/.test(IOPS));
// initIntel() itself must call renderAll() exactly once (other pre-existing call sites —
// purgeIntelData, the SW message bridge, checkStaleFlag — are untouched and out of scope).
const initIntelBody = (IOPS.match(/function initIntel\(\)\{([^]*?)\n\}/) || [])[1] || '';
check('initIntel() calls renderAll exactly once', (initIntelBody.match(/renderAll\(\);/g) || []).length === 1);

// Diff-only network/sync/cloud check — the file may already contain unrelated
// pre-existing matches (e.g. serviceWorker messaging), so only scan CHANGED lines.
let diffAdds = '';
try {
  diffAdds = execSync('git diff origin/main -- intelligence-ops.html', { cwd: here('../..') }).toString()
    .split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
} catch (_e) { diffAdds = ''; }
check('diff adds no fetch/XHR/WebSocket/EventSource/sendBeacon to intelligence-ops.html', !/\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b/.test(diffAdds));

// ── Behavioral (browser) ─────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(String(err && err.message || err)));

  const url = `${BASE}/intelligence-ops.html`;
  await page.goto(url, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => typeof window.intelSet === 'function' && typeof window.whenIntelReady === 'function', null, { timeout: 10000 });

  // Seed RED PROTOCOL history through the warm-cache (not hand-crafted ciphertext) so
  // it's a realistic encrypted-at-rest state, then reload.
  await page.evaluate(async () => {
    await window.intelSet('od_redprotocol_log', [
      { date: '2026-06-28', time: '9:00 AM', floor: 2, ts: Date.parse('2026-06-28') },
      { date: '2026-06-30', time: '11:15 PM', floor: 4, ts: Date.parse('2026-06-30') },
      { date: '2026-07-01', time: '2:40 AM', floor: 3, ts: Date.parse('2026-07-01') },
    ]);
  });

  const readRedProtocolCount = async () => page.evaluate(() => {
    var rows = Array.from(document.querySelectorAll('#protoContainer .proto-row'));
    var row = rows.find((r) => {
      var lbl = r.querySelector('.proto-label');
      return lbl && lbl.textContent.trim() === 'RED PROTOCOL';
    });
    if (!row) return null;
    var countEl = row.querySelector('.proto-count');
    return countEl ? Number(countEl.textContent.trim()) : null;
  });
  // renderProtocols() only shows the top-12 ranked drills (pre-existing, unrelated design —
  // out of scope to change here). With everything else tied at count 0, RED PROTOCOL's fixed
  // registry position can fall outside that top-12 slice even though it safely ranked at 0.
  // So the "safe fallback, no crash" assertion reads the ranking data directly — the actual
  // layer the bug lived in — rather than assuming DOM visibility past the slice.
  const readRedProtocolRanked = async () => page.evaluate(() => {
    var found = window.IntelEngine.rankProtocols().find((p) => p.label === 'RED PROTOCOL');
    return found ? found.count : null;
  });
  const protoRowCount = async () => page.evaluate(() => document.querySelectorAll('#protoContainer .proto-row').length);

  // 1. First reload — migration/warm-cache moment.
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(150);

  const count1 = await readRedProtocolCount();
  check('RED PROTOCOL renders count 3 after first reload (not 0)', count1 === 3);

  // 2. Second reload — reads from already-encrypted ciphertext-at-rest, no migration.
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(150);

  const count2 = await readRedProtocolCount();
  check('RED PROTOCOL count STILL 3 after second reload (ciphertext-at-rest read)', count2 === 3);

  // 3. Missing key — safe empty state, no crash.
  await page.evaluate(() => localStorage.removeItem('od_redprotocol_log'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(150);

  const rankedMissing = await readRedProtocolRanked();
  check('missing key → RED PROTOCOL ranks count 0 safely (no crash)', rankedMissing === 0);
  check('missing key → protocol list still renders (ranking render did not crash)', (await protoRowCount()) > 0);

  // 4. Corrupt key — safe fallback, no crash.
  await page.evaluate(() => localStorage.setItem('od_redprotocol_log', 'CORRUPT{not-json'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.whenIntelReady === 'function', null, { timeout: 10000 });
  await page.evaluate(() => window.whenIntelReady());
  await page.waitForTimeout(150);

  const rankedCorrupt = await readRedProtocolRanked();
  check('corrupt key → RED PROTOCOL ranks count 0 safely (no crash)', rankedCorrupt === 0);
  check('corrupt key → protocol list still renders (ranking render did not crash)', (await protoRowCount()) > 0);
  const stillThereCorrupt = await page.evaluate(() => localStorage.getItem('od_redprotocol_log'));
  check('corrupt value PRESERVED on disk (never silently deleted)', stillThereCorrupt === 'CORRUPT{not-json');

  check('no uncaught page errors across seed/reload/missing/corrupt sequence', pageErrors.length === 0);
  if (pageErrors.length) console.log('  page errors: ' + JSON.stringify(pageErrors));

  await ctx.close();
} finally { await browser.close(); }
console.log(fail ? `\nINTELLIGENCE-OPS WARM-CACHE: ${fail} FAIL` : '\nINTELLIGENCE-OPS WARM-CACHE: PASS');
process.exit(fail ? 1 : 0);
