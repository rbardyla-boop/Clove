/**
 * Creator Corner public beta — STATIC/LOCAL workshop bundle smoke.
 *
 * Served against the BUILT bundle (not the repo): proves the hub + four tools load and run from the
 * bundle alone — i.e. every bundled module dependency resolves when served — and that the sandbox runs
 * a package as an UNTRUSTED LOCAL PROPOSAL. Also re-confirms the hub exposes no active/live-floor control.
 * Also machine-checks the sibling-app contract: the 4 core tools resolve from the bundle (200) while the
 * Arcade Studio link (a repo-local sibling, deliberately not bundled) is unresolved (404) from the bundle.
 *
 * Run: tests/creator/run-workshop-bundle-smoke.sh   (builds + serves the bundle, then runs this)
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8097';
let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };

// A page is "clean" if it loads with no thrown error and no console error (a missing bundled module
// would 404 → module-load console error → caught here).
async function openClean(ctx, url) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  return { page, errors };
}
const optionCount = (page, id) => page.$$eval(`#${id} option`, (os) => os.length).catch(() => 0);

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();

  // 1. HUB — loads, exposes exactly the five tool links, and carries no active/live-floor control.
  //    The 5th link is Arcade Studio: an EXTERNAL static editor published separately at /arcade-studio/
  //    (Option A), deliberately NOT copied into this isolated bundle. We machine-check that contract below
  //    — the four core tools resolve from the bundle (200) while the /arcade-studio/ production path is
  //    UNRESOLVED (404) from the bundle context, proving it is not falsely bundled as an internal file.
  //    (Its positive boot proof lives in the integration smoke, which maps /arcade-studio/ → the built dist.)
  {
    const hubUrl = `${BASE}/arcade/creator/creator-corner/`;
    const { page, errors } = await openClean(ctx, hubUrl);
    const links = await page.$$eval('a.tool-link', (as) => as.map((a) => a.getAttribute('href')).sort());
    check('hub serves from bundle and exposes exactly the 5 tool links', JSON.stringify(links) ===
      JSON.stringify(['/arcade-studio/', '../arcade-builder/', '../arcade-sandbox/', '../block-editor/', '../layered-editor/'].sort()));

    // The Arcade Studio link must be the external production path (/arcade-studio/), not a bundle-relative tool.
    const studioHref = await page.$$eval('a.tool-link',
      (as) => { const a = as.find((x) => /arcade-studio/.test(x.getAttribute('href'))); return a ? a.getAttribute('href') : null; });
    check('Arcade Studio is the 5th link and is the /arcade-studio/ production path', studioHref === '/arcade-studio/');

    // Machine-check the not-bundled contract against the live bundle server:
    //  - a core bundled tool DOES resolve (200), so the server genuinely serves the bundle, AND
    //  - the /arcade-studio/ production path does NOT resolve (404) — it is not an internal bundle file.
    const builderResp = await ctx.request.get(new URL('../arcade-builder/', hubUrl).href).catch(() => null);
    check('a core tool (arcade-builder) resolves from the isolated bundle (200)',
      !!builderResp && builderResp.status() === 200);
    const studioResp = studioHref ? await ctx.request.get(new URL(studioHref, hubUrl).href).catch(() => null) : null;
    check('Arcade Studio is NOT bundled — its /arcade-studio/ production path is unresolved (404) from the bundle',
      !!studioResp && studioResp.status() === 404);

    const activeControls = await page.$$eval('button, form, input, [onclick]', (n) => n.length);
    check('hub has NO active control (button/form/input) — static workshop index', activeControls === 0);
    check('hub loads with no console/page errors', errors.length === 0);
    if (errors.length) console.log('  hub errors:', errors.join(' | '));
    await page.close();
  }

  // 2. The four tools each load from the bundle and their modules execute (populated select = deps resolved).
  const TOOLS = [
    { name: 'arcade-builder', path: 'arcade-builder', marker: 'variant' },
    { name: 'block-editor', path: 'block-editor', marker: 'palette' },
    { name: 'layered-editor', path: 'layered-editor', marker: 'palette_variant' },
  ];
  for (const t of TOOLS) {
    const { page, errors } = await openClean(ctx, `${BASE}/arcade/creator/${t.path}/`);
    const populated = await page.waitForFunction(
      (id) => { const el = document.getElementById(id); return !!el && el.options && el.options.length > 0; },
      t.marker, { timeout: 6000 }).then(() => true).catch(() => false);
    check(`${t.name} loads from bundle and its module populated #${t.marker} (deps resolved)`, populated);
    check(`${t.name} loads with no console/page errors`, errors.length === 0);
    if (errors.length) console.log(`  ${t.name} errors:`, errors.join(' | '));
    await page.close();
  }

  // 3. SANDBOX — bootstraps and runs the sample package as an untrusted local proposal, all from the bundle.
  {
    const { page, errors } = await openClean(ctx, `${BASE}/arcade/creator/arcade-sandbox/`);
    const ready = await page.waitForFunction(() => !!window.__cf4_sandbox, null, { timeout: 8000 })
      .then(() => true).catch(() => false);
    check('sandbox bootstraps from bundle (window.__cf4_sandbox present)', ready);
    let report = null;
    if (ready) report = await page.evaluate(() => window.__cf4_sandbox.loadSampleAndRun()).catch(() => null);
    check('sandbox imports + runs the bundled sample package (report.ok)', !!report && report.ok === true);
    check('sandbox result is an UNTRUSTED local proposal (no host authority)',
      !!report && report.result_trust === 'untrusted_local_proposal');
    check('sandbox loads with no console/page errors', errors.length === 0);
    if (errors.length) console.log('  sandbox errors:', errors.join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? `\nWORKSHOP BUNDLE SMOKE: ${failures} FAIL` : '\nWORKSHOP BUNDLE SMOKE: PASS');
process.exit(failures ? 1 : 0);
