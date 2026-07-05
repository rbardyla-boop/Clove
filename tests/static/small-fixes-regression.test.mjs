/**
 * Static regression checks for the small page fixes salvaged in this commit. No
 * browser/Playwright needed — these are plain textual/filesystem assertions, matching
 * the plain node:test style already used by labs/voxel-bench/test/*.test.mjs.
 *
 * Run: node --test tests/static/*.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function resolvesFromDir(fromRelDir, href) {
  return fs.existsSync(path.resolve(ROOT, fromRelDir, href));
}

test('articles/drift-detection-system.html Relapse Prevention link resolves from articles/', () => {
  const html = read('articles/drift-detection-system.html');
  const match = html.match(/href="([^"]*relapse-prevention\.html)"/);
  assert.ok(match, 'expected a relapse-prevention.html link in the page');
  assert.ok(
    resolvesFromDir('articles', match[1]),
    `href="${match[1]}" must resolve to a real file relative to articles/`,
  );
});

test('articles/the-failure-corridor.html Relapse Prevention link resolves from articles/', () => {
  const html = read('articles/the-failure-corridor.html');
  const match = html.match(/href="([^"]*relapse-prevention\.html)"/);
  assert.ok(match, 'expected a relapse-prevention.html link in the page');
  assert.ok(
    resolvesFromDir('articles', match[1]),
    `href="${match[1]}" must resolve to a real file relative to articles/`,
  );
});

/**
 * Extracts the raw content of every <script>...</script> block (non-module, inline)
 * from an HTML document, the same way a browser's HTML tokenizer would scan for the
 * block's end — i.e. it stops at the FIRST literal "</script>" substring, regardless of
 * JS string-literal nesting. This mirrors the exact real-world failure mode: a raw,
 * unescaped "</script>" inside a JS string prematurely ends the enclosing script block.
 */
function extractInlineScriptBlocks(html) {
  const blocks = [];
  const openTagRe = /<script(?![^>]*\bsrc=)[^>]*>/gi;
  let match;
  while ((match = openTagRe.exec(html))) {
    const contentStart = match.index + match[0].length;
    const closeIdx = html.indexOf('</script>', contentStart);
    if (closeIdx === -1) continue;
    blocks.push(html.slice(contentStart, closeIdx));
  }
  return blocks;
}

test('clovelearn-test-harness.html: no raw </script> inside an inline script block\'s own content', () => {
  const html = read('clovelearn-test-harness.html');
  const blocks = extractInlineScriptBlocks(html);
  assert.ok(blocks.length > 0, 'expected at least one inline <script> block');
  for (const block of blocks) {
    assert.ok(
      !block.includes('</script>'),
      'a JS string containing a raw "</script>" would have prematurely closed this script block in a real browser',
    );
  }
});

test('mission-brief.html: no raw </script> inside an inline script block\'s own content', () => {
  const html = read('mission-brief.html');
  const blocks = extractInlineScriptBlocks(html);
  assert.ok(blocks.length > 0, 'expected at least one inline <script> block');
  for (const block of blocks) {
    assert.ok(
      !block.includes('</script>'),
      'a JS string containing a raw "</script>" would have prematurely closed this script block in a real browser',
    );
  }
});

test('mission-brief.html: the real closing <script src="od-core.js"> tag remains a literal, unescaped tag', () => {
  const html = read('mission-brief.html');
  // The page's real, final script tags (immediately before </body></html>, not inside
  // the print-window template string) must stay literal — escaping THESE would break
  // actual script loading on the page itself.
  assert.ok(
    /<script src="od-core\.js"><\/script>\n<script>injectHelpButton\(\);<\/script>\n<\/body>\n<\/html>/.test(html),
    'the page\'s real closing script tags must remain literal (unescaped), unlike the print-window copy earlier in the file',
  );
});

test('parts-mapping-drill.html: generated print window no longer injects Google Fonts', () => {
  // Scoped deliberately narrow: the page's OWN <head> still references Google Fonts
  // (a separate, pre-existing, already-tracked issue — see memory
  // project_external_google_fonts_dependency — out of scope for this fix). This test
  // only asserts the PRINT-WINDOW template string (the `pw.document.write(...)` call)
  // no longer injects a second, independent Google Fonts fetch into a popup window.
  const html = read('parts-mapping-drill.html');
  const printWindowMatch = html.match(/pw\.document\.write\('[\s\S]*?<\/body><\/html>'\)/);
  assert.ok(printWindowMatch, 'expected to find the pw.document.write(...) print-window template string');
  const printWindowHtml = printWindowMatch[0];
  assert.ok(!printWindowHtml.includes('fonts.googleapis.com'), 'print window must not fetch fonts.googleapis.com');
  assert.ok(!printWindowHtml.includes('fonts.gstatic.com'), 'print window must not fetch fonts.gstatic.com');
});

test('tipp-drill-full.html: od_tipp_full retention cap (PR #135 fix) is present', () => {
  const html = read('tipp-drill-full.html');
  assert.ok(
    html.includes("localStorage.setItem('od_tipp_full', JSON.stringify(logs.slice(0, 200)));"),
    'the already-merged PR #135 retention cap must be preserved, not the pre-fix unbounded JSON.stringify(logs)',
  );
  assert.ok(
    !html.includes("localStorage.setItem('od_tipp_full', JSON.stringify(logs));"),
    'the stale, pre-PR#135 unbounded write must not be present',
  );
});

test('tipp-drill-full.html: mobile responsive block is present and additive-only', () => {
  const html = read('tipp-drill-full.html');
  assert.ok(
    html.includes('@media (max-width: 520px) {'),
    'the salvaged mobile CSS block must be present',
  );
  assert.ok(
    html.includes('.step-grid { padding: 0 14px; margin: 36px auto; }'),
    'the mobile CSS block content must match the salvaged fix',
  );
});

test('game/Arcade/index.html: .nav-tabs-wrapper mobile margin fix is present', () => {
  const html = read('game/Arcade/index.html');
  assert.ok(
    html.includes('.nav-tabs-wrapper { margin: 0 -14px; }'),
    'the salvaged mobile nav-tabs-wrapper margin rule must be present',
  );
});
