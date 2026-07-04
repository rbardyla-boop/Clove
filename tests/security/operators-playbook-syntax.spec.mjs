/**
 * Regression — operators-playbook.html inline-script syntax (unescaped apostrophes in
 * single-quoted JS string literals inside the knowledgeBase data array broke the entire
 * inline <script>, silently failing renderCards() and every other handler on the page).
 *
 *  - Static: parses the extracted inline script with `new Function()` — must not throw.
 *  - Behavioral: loads the real page, asserts zero page-level JS errors, asserts all 20
 *    knowledgeBase cards actually render into #cardGrid, and spot-checks that an escalation
 *    string containing an apostrophe renders as literal text (proving the fix, not just
 *    that *some* script ran).
 *
 * Run: tests/security/run-operators-playbook-syntax.sh
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8957';
const SRC = readFileSync(fileURLToPath(new URL('../../operators-playbook.html', import.meta.url)), 'utf8');

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };

// ── Static: extracted inline script must parse ────────────────────────────────────────────────
const scripts = [...SRC.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
check('exactly one inline script found', scripts.length === 1);
let parseError = null;
try { new Function(scripts[0]); } catch (e) { parseError = e; }
check('inline script parses without a SyntaxError', parseError === null);

// ── Behavioral: real browser load, zero errors, full render ───────────────────────────────────
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(`${BASE}/operators-playbook.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForTimeout(200);

  check('no page-level JS errors on load', pageErrors.length === 0);

  const cardCount = await page.evaluate(() => document.querySelectorAll('#cardGrid .card, #cardGrid > *').length);
  check('all 20 knowledgeBase cards rendered into #cardGrid', cardCount === 20);

  // Spot-check literal apostrophe text renders correctly (not truncated by the old bug).
  const gridText = await page.evaluate(() => document.getElementById('cardGrid').textContent);
  check('rendered text contains an intact apostrophe-bearing phrase', gridText.includes("Don't wait to feel like it"));

  await ctx.close();
} finally { await browser.close(); }

console.log(fail ? `\nOPERATORS PLAYBOOK SYNTAX: ${fail} FAIL` : '\nOPERATORS PLAYBOOK SYNTAX: PASS');
process.exit(fail ? 1 : 0);
