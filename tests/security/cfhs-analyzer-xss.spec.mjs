/**
 * Security regression — cfhs-analyzer.html file-import XSS (ADR-052 sealed-local threat model).
 *
 * cfhs-analyzer.html ingests untrusted third-party PDFs. Filename, OCR/extracted excerpts, extracted
 * dates, and raw document-type header captures must NEVER reach an innerHTML sink unescaped.
 *
 *  - Behavioral: loads the page and drives the real render functions with a malicious filename and a
 *    malicious excerpt, asserting neither is parsed into a live element and neither handler fires.
 *  - Static: asserts every untrusted sink in the source is esc()-wrapped and no raw sink remains
 *    (guards against reintroduction, and covers doc.rawType / dates that are not driven behaviorally).
 *
 * Run: tests/security/run-cfhs-analyzer-xss.sh
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const SRC = readFileSync(fileURLToPath(new URL('../../cfhs-analyzer.html', import.meta.url)), 'utf8');

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };

// ── Static source scan: every untrusted sink must be esc()-wrapped ───────────────────────────────
check('esc() helper defined', /function esc\(v\)/.test(SRC));
const MUST_HAVE = [
  'title="${esc(f.name)}">${esc(f.name)}',                  // renderQueue filename
  'title="${esc(ff.name)}"',                                // file-nav tabs filename
  'class="result-title">${esc(f.name)}',                    // result headers filename
  'doc-type-label">${esc(doc.rawType || doc.label)}',       // raw PDF header capture
  '<span>${esc(doc.dateFormatted || doc.date)}</span>',     // extracted doc date
  '<div class="quote-box">${esc(e)}</div>',                 // raw PDF excerpts (critical)
  'a.dates.slice(0,3).map(esc).join',                       // extracted dates
  'esc(f.error || ',                                        // PDF-processing error message
];
for (const frag of MUST_HAVE) check('source escapes sink: ' + frag.slice(0, 44), SRC.includes(frag));
const MUST_NOT = [
  'title="${f.name}">${f.name}',                            // raw filename
  '<div class="quote-box">${e}</div>',                      // raw excerpt
  '">${doc.rawType || doc.label}</span>',                   // raw rawType
];
for (const frag of MUST_NOT) check('no raw sink: ' + frag.slice(0, 44), !SRC.includes(frag));

// ── Behavioral: drive the real render functions with payloads ────────────────────────────────────
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/cfhs-analyzer.html`, { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(
    () => typeof window.esc === 'function' && typeof window.renderQueue === 'function' && typeof window.showResult === 'function',
    null, { timeout: 10000 });

  // esc() unit behavior
  check('esc neutralizes <svg onload>', await page.evaluate(() => window.esc('<svg onload=x>') === '&lt;svg onload=x&gt;'));
  check('esc escapes quote/angle for attribute safety', await page.evaluate(() => window.esc('"><b>') === '&quot;&gt;&lt;b&gt;'));

  // Filename sink — renderQueue()
  const FN = '<img src=x onerror="window.__xssFn=true">.pdf';
  await page.evaluate((name) => {
    window.__xssFn = false;
    files.length = 0;
    files.push({ file: { size: 1 }, name, pages: 1, text: null, analysis: null, status: 'pending' });
    activeIdx = 0;
    renderQueue();
  }, FN);
  await page.waitForTimeout(100);
  check('filename: no <img> element injected into queue', await page.evaluate(() => document.querySelector('#fileQueue img') === null));
  check('filename: rendered as literal text', await page.evaluate((p) => {
    const el = document.querySelector('#fileQueue .file-name'); return !!el && el.textContent.includes(p);
  }, FN));
  check('filename: onerror did not fire', await page.evaluate(() => window.__xssFn === false));

  // Excerpt sink — showResult(idx, true) flat view
  const EX = '<svg onload="window.__xssEx=true">EXCERPT-XSS';
  await page.evaluate((ex) => {
    window.__xssEx = false;
    files.length = 0;
    files.push({
      file: { size: 1 }, name: 'clean.pdf', pages: 1, status: 'done', mode: 'embedded', hasRedactions: false, documents: [],
      analysis: {
        scores: [], risks: [], nexus: [], diagnoses: [], excerpts: [ex], dates: [], docTypes: [],
        wordCount: 3, deploymentMentions: 0, suicidalityFound: false, sdaFound: false, medicationFound: false,
      },
    });
    activeIdx = 0;
    showResult(0, true);
  }, EX);
  await page.waitForTimeout(100);
  check('excerpt: no <svg> element injected', await page.evaluate(() => document.querySelector('#mainContent svg') === null));
  check('excerpt: rendered as literal text in quote-box', await page.evaluate((p) => {
    const el = document.querySelector('#mainContent .quote-box'); return !!el && el.textContent.includes(p);
  }, EX));
  check('excerpt: onload did not fire', await page.evaluate(() => window.__xssEx === false));

  // Error-message sink — showResult() empty-state (f.error from PDF-processing failure on the file)
  const ER = '<img src=x onerror="window.__xssErr=true">';
  await page.evaluate((err) => {
    window.__xssErr = false;
    files.length = 0;
    files.push({ file: { size: 1 }, name: 'x.pdf', pages: null, text: null, analysis: null, status: 'error', error: err });
    activeIdx = 0;
    showResult(0, true);
  }, ER);
  await page.waitForTimeout(100);
  check('error msg: no <img> element injected', await page.evaluate(() => document.querySelector('#mainContent img') === null));
  check('error msg: rendered as literal text', await page.evaluate((p) => {
    const el = document.querySelector('#mainContent .empty-text'); return !!el && el.textContent.includes(p);
  }, ER));
  check('error msg: onerror did not fire', await page.evaluate(() => window.__xssErr === false));

  await ctx.close();
} finally { await browser.close(); }
console.log(fail ? `\nCFHS ANALYZER XSS: ${fail} FAIL` : '\nCFHS ANALYZER XSS: PASS');
process.exit(fail ? 1 : 0);
