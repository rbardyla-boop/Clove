/**
 * Voxel Lab Bench — headless "Export to second brain" click-through proof (Gate E, Slice 7).
 *
 * src/export-markdown.mjs's exportExperiment() is already covered end-to-end by plain
 * `node --test` (labs/voxel-bench/test/export-markdown.test.mjs) — that path never
 * touches a browser. What is NOT covered there is the real, in-page mechanism this
 * feature actually ships as: a real #exportBtn click driving a real Blob +
 * URL.createObjectURL + <a download> click, with zero network activity. This harness
 * exercises exactly that path, by instrumenting URL.createObjectURL and
 * HTMLAnchorElement.prototype.click BEFORE navigation so the real click-triggered
 * download can be observed deterministically without relying on the browser's
 * OS-level download UI.
 *
 * Self-contained: spins up its own tiny static file server (Node's built-in `http`
 * module) rooted at the REPO ROOT, then drives the cached Playwright chromium against
 * it with the same swiftshader launch args the sibling harnesses already use
 * (bench-headless.mjs, lod-pop-harness.mjs, light-volume-headless.mjs,
 * metrics-room-headless.mjs).
 *
 * Run from the REPO ROOT:
 *   node labs/voxel-bench/scripts/export-markdown-headless.mjs
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../');
const PAGE_PATH = '/labs/voxel-bench/index.html';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

/** Minimal static file server, repo-root-rooted, GET-only, no directory listing. */
function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url, 'http://127.0.0.1');
        const relPath = decodeURIComponent(reqUrl.pathname);
        const filePath = path.join(REPO_ROOT, relPath);
        if (!filePath.startsWith(REPO_ROOT)) {
          res.writeHead(403);
          res.end('forbidden');
          return;
        }
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        res.end(data);
      } catch (err) {
        res.writeHead(404);
        res.end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const server = await startStaticServer();
const { port } = server.address();
const url = `http://127.0.0.1:${port}${PAGE_PATH}`;
console.log(`[export-markdown-headless] serving ${REPO_ROOT} -> ${url}`);

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); else console.log(`  ✓ ${msg}`); };

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });

const consoleErrors = [];
const pageErrors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consoleErrors.push(m.text()); });
page.on('pageerror', (e) => pageErrors.push(e.message));

// Instrument URL.createObjectURL and HTMLAnchorElement.prototype.click BEFORE
// navigation so the real click-triggered download can be observed deterministically,
// without relying on the browser's OS-level download UI.
await page.addInitScript(() => {
  window.__exportProbe = { blobType: null, blobSize: null, downloadAttr: null, clicked: false, blobRef: null, createObjectURLCalls: 0 };
  const origCreateObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (blob) => {
    window.__exportProbe.blobType = blob.type;
    window.__exportProbe.blobSize = blob.size;
    window.__exportProbe.blobRef = blob;
    window.__exportProbe.createObjectURLCalls += 1;
    return origCreateObjectURL(blob);
  };
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function patchedClick() {
    if (this.download) {
      window.__exportProbe.downloadAttr = this.download;
      window.__exportProbe.clicked = true;
    }
    return origClick.call(this);
  };
});

// Track every request fired during/after the click — the export must cause ZERO
// network activity (a Blob-URL download is not a network request at all).
const requestsDuringClick = [];
page.on('request', (req) => { requestsDuringClick.push(req.url()); });

console.log(`[export-markdown-headless] loading ${url}`);
try {
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => window.__bench && window.__bench.ready === true, { timeout: 20000 });
  ok(await page.evaluate(() => window.__bench.ready === true), 'bench booted (window.__bench.ready)');

  await page.evaluate(() => window.__bench.step(1 / 60));

  // Reset the request tracker right before the click so only export-caused requests
  // (there should be none) are counted, not the page's own initial asset loads.
  requestsDuringClick.length = 0;

  await page.click('#exportBtn');

  const probe = await page.evaluate(() => ({
    clicked: window.__exportProbe.clicked,
    downloadAttr: window.__exportProbe.downloadAttr,
    blobType: window.__exportProbe.blobType,
    createObjectURLCalls: window.__exportProbe.createObjectURLCalls,
  }));

  ok(probe.clicked === true, 'real #exportBtn click triggered a real <a download> click');
  ok(typeof probe.downloadAttr === 'string' && probe.downloadAttr.endsWith('.md'), `download filename ends with .md (got "${probe.downloadAttr}")`);
  ok(probe.blobType === 'text/markdown', `Blob type is text/markdown (got "${probe.blobType}")`);
  ok(probe.createObjectURLCalls === 1, `URL.createObjectURL called exactly once (got ${probe.createObjectURLCalls})`);

  const blobText = await page.evaluate(() => window.__exportProbe.blobRef.text());
  for (const heading of ['## Metadata', '## What I changed', '## What I measured', '## The lesson', '## Reproduction']) {
    ok(blobText.includes(heading), `downloaded Blob content includes "${heading}"`);
  }

  ok(requestsDuringClick.length === 0, `zero network requests fired during/after the export click${requestsDuringClick.length ? ' → ' + requestsDuringClick.join(' | ') : ''}`);

  ok(pageErrors.length === 0, `no uncaught page errors${pageErrors.length ? ' → ' + pageErrors.join(' | ') : ''}`);
  ok(consoleErrors.length === 0, `no console errors${consoleErrors.length ? ' → ' + consoleErrors.slice(0, 3).join(' | ') : ''}`);
} catch (err) {
  fails.push(`export-markdown-headless threw: ${err.message}\n${err.stack || ''}`);
} finally {
  await browser.close();
  server.close();
}

if (fails.length) {
  console.error('\n[export-markdown-headless] FAIL:');
  for (const f of fails) console.error(`  ✕ ${f}`);
  process.exit(1);
}
console.log('\n[export-markdown-headless] PASS — real button click, real Blob download, zero network activity');
