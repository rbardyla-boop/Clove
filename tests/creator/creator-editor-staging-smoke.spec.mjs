/**
 * Creator Editor STAGING-ROOT smoke (R3, Option A — LOCAL ONLY, not a deploy).
 *
 * Served from the single assembled staging root (/tmp/creator-editor-staging-root) exactly as a later
 * static deploy would serve it: the hub at /arcade/creator/creator-corner/, the four Creator tools as
 * siblings, and the BUILT Arcade Studio candidate mounted at the absolute /arcade-studio/. Proves, from
 * one document root:
 *   - the hub loads, exposes exactly the 5 tool links, and carries no active/live-floor control;
 *   - /arcade-studio/ RESOLVES (200) from the staging root (vs 404 from the isolated workshop bundle);
 *   - the four core tools boot and their modules execute (populated selects / sandbox harness);
 *   - the built Arcade Studio app boots (window.__studio.ready), renders (draw calls), and its in-page
 *     export→import round-trip is stable;
 *   - no surface exposes an upload/submit/publish/live-world control;
 *   - every network request stays same-origin static (no external host, no remote submission);
 *   - the hub + studio also boot under a mobile viewport.
 *
 * Run: tests/creator/run-creator-editor-staging-smoke.sh  (builds the staging root, serves it, runs this)
 *
 * R4/R5: screen-shake + particle live preview is now asserted here via the already-exposed
 * window.__studio.studio.effects / .reducedMotion / .camera surfaces (no new hook): triggering a shake
 * deflects the camera, reduced-motion suppresses it, and selecting a particle preset yields its declared
 * live count. The rigorous behavioral proofs (axis masking, envelope, motionScale=0 zeroing, count caps)
 * live in arcade-studio/test/effects-{shake,particle}.test.mjs.
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099';
const ORIGIN = new URL(BASE).host;
let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };

const EXPECTED_LINKS = ['/arcade-studio/', '../arcade-builder/', '../arcade-sandbox/',
  '../block-editor/', '../layered-editor/'].sort();
const FORBIDDEN_ACTION_RE = /\b(upload|submit|publish|deploy|live[\s_-]?world|go[\s_-]?live)\b/i;

// All external (non-same-origin) requests seen across the run — must stay empty.
const external = [];

async function openClean(ctx, url) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('request', (r) => { try { if (new URL(r.url()).host !== ORIGIN && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); } catch { /* ignore */ } });
  await page.goto(url, { waitUntil: 'load' });
  return { page, errors };
}

// Returns the text of any control whose label matches a forbidden upload/submit/publish/live action.
async function forbiddenControls(page) {
  return page.$$eval('button, a, [role=button]', (ns, reSrc) => {
    const re = new RegExp(reSrc, 'i');
    return ns.map((n) => (n.textContent || '') + ' ' + (n.getAttribute('aria-label') || '')).filter((tx) => re.test(tx));
  }, FORBIDDEN_ACTION_RE.source).catch(() => []);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'],
});
try {
  const ctx = await browser.newContext();
  const hubUrl = `${BASE}/arcade/creator/creator-corner/`;

  // 1. HUB — 5 links, studio is the absolute production path, no active control, no errors.
  {
    const { page, errors } = await openClean(ctx, hubUrl);
    const links = await page.$$eval('a.tool-link', (as) => as.map((a) => a.getAttribute('href')).sort());
    check('hub exposes exactly the 5 tool links', JSON.stringify(links) === JSON.stringify(EXPECTED_LINKS));
    const studioHref = await page.$$eval('a.tool-link',
      (as) => { const a = as.find((x) => /arcade-studio/.test(x.getAttribute('href'))); return a ? a.getAttribute('href') : null; });
    check('Arcade Studio link is the /arcade-studio/ production path', studioHref === '/arcade-studio/');
    // From the staging root the studio path RESOLVES (200) — the distinguishing contract vs the bundle (404).
    const studioResp = await ctx.request.get(new URL('/arcade-studio/', hubUrl).href).catch(() => null);
    check('/arcade-studio/ resolves from the staging root (200)', !!studioResp && studioResp.status() === 200);
    const activeControls = await page.$$eval('button, form, input, [onclick]', (n) => n.length);
    check('hub remains static (no button/form/input/onclick)', activeControls === 0);
    check('hub loads with no console/page errors', errors.length === 0);
    if (errors.length) console.log('  hub errors:', errors.join(' | '));
    await page.close();
  }

  // 2. The four core tools boot (module executed → populated select / sandbox harness) + no forbidden control.
  const SELECT_TOOLS = [
    { name: 'arcade-builder', path: 'arcade-builder', marker: 'variant' },
    { name: 'block-editor', path: 'block-editor', marker: 'palette' },
    { name: 'layered-editor', path: 'layered-editor', marker: 'palette_variant' },
  ];
  for (const t of SELECT_TOOLS) {
    const { page, errors } = await openClean(ctx, `${BASE}/arcade/creator/${t.path}/`);
    const populated = await page.waitForFunction(
      (id) => { const el = document.getElementById(id); return !!el && el.options && el.options.length > 0; },
      t.marker, { timeout: 8000 }).then(() => true).catch(() => false);
    check(`${t.name} boots and its module populated #${t.marker}`, populated);
    const forbiddenCtl = await forbiddenControls(page);
    check(`${t.name} exposes no upload/submit/publish/live control`, forbiddenCtl.length === 0);
    check(`${t.name} loads with no console/page errors`, errors.length === 0);
    if (errors.length) console.log(`  ${t.name} errors:`, errors.join(' | '));
    await page.close();
  }

  // 3. SANDBOX — boots and runs the bundled sample as an UNTRUSTED local proposal (no host authority).
  {
    const { page, errors } = await openClean(ctx, `${BASE}/arcade/creator/arcade-sandbox/`);
    const ready = await page.waitForFunction(() => !!window.__cf4_sandbox, null, { timeout: 8000 })
      .then(() => true).catch(() => false);
    check('sandbox bootstraps (window.__cf4_sandbox present)', ready);
    let report = null;
    if (ready) report = await page.evaluate(() => window.__cf4_sandbox.loadSampleAndRun()).catch(() => null);
    check('sandbox imports + runs the bundled sample (report.ok)', !!report && report.ok === true);
    check('sandbox result is an UNTRUSTED local proposal (no host authority)',
      !!report && report.result_trust === 'untrusted_local_proposal');
    check('sandbox exposes no upload/submit/publish/live control', (await forbiddenControls(page)).length === 0);
    check('sandbox loads with no console/page errors', errors.length === 0);
    if (errors.length) console.log('  sandbox errors:', errors.join(' | '));
    await page.close();
  }

  // 4. ARCADE STUDIO — built app boots, renders, and round-trips (the production /arcade-studio/ path).
  {
    const { page, errors } = await openClean(ctx, `${BASE}/arcade-studio/`);
    const ready = await page.waitForFunction(() => !!(window.__studio && window.__studio.ready), null, { timeout: 20000 })
      .then(() => true).catch(() => false);
    check('Arcade Studio boots (window.__studio.ready)', ready);
    if (ready) {
      await page.evaluate(() => { for (let i = 0; i < 60; i++) window.__studio.step(1 / 60); });
      const draws = await page.evaluate(() => window.__studio.drawCalls());
      check(`Arcade Studio renders (draw calls ${draws})`, draws > 0);
      const rt = await page.evaluate(() => window.__studio.roundTrip());
      check(`Arcade Studio export→import round-trip stable${rt && rt.hash ? ' (' + rt.hash.slice(0, 14) + '…)' : ''}`, !!rt && rt.ok && rt.stable);

      // R4 — screen-shake live preview: triggering deflects the camera; reduced-motion suppresses it.
      // Hook-free: drives the already-exposed studio.effects / reducedMotion and reads camera.position.
      const shakeFx = await page.evaluate(() => {
        const s = window.__studio, cam = s.camera, rm = s.studio.reducedMotion, eff = s.studio.effects;
        const range = (a) => Math.max(...a) - Math.min(...a);
        const sample = (frames) => {
          const xs = [], ys = [], zs = [];
          for (let i = 0; i < frames; i++) { s.step(1 / 60); xs.push(cam.position.x); ys.push(cam.position.y); zs.push(cam.position.z); }
          return Math.max(range(xs), range(ys), range(zs));
        };
        rm.setOverride('off'); eff.triggerShake('impact');
        const activeAfterTrigger = eff.shake.isActive;
        const shakeRange = sample(6);
        rm.setOverride('on'); eff.triggerShake('impact');
        const rmShakeRange = sample(6);
        rm.setOverride('auto'); eff.triggerShake('none');
        return { activeAfterTrigger, shakeRange, rmShakeRange };
      });
      check('shake: triggering activates the effect', shakeFx.activeAfterTrigger === true);
      check(`shake: camera deflects when triggered (range ${shakeFx.shakeRange.toFixed(3)})`, shakeFx.shakeRange > 0.03);
      check(`shake: reduced-motion substantially damps it (${shakeFx.rmShakeRange.toFixed(3)} < ${shakeFx.shakeRange.toFixed(3)})`,
        shakeFx.rmShakeRange < shakeFx.shakeRange * 0.5);

      // R5 — particle live preview: selecting a preset yields its declared live count; draw calls bounded.
      const partFx = await page.evaluate(() => {
        const eff = window.__studio.studio.effects;
        eff.setParticle('sparks');
        for (let i = 0; i < 5; i++) window.__studio.step(1 / 60);
        const count = eff.activeParticleCount;
        const draws = window.__studio.drawCalls();
        eff.setParticle('none'); // restore default ambient state
        return { count, draws };
      });
      check('particle: selecting "sparks" yields the declared live count (120)', partFx.count === 120);
      check(`particle: draw calls stay bounded (${partFx.draws})`, partFx.draws > 0 && partFx.draws < 5000);
    }
    check('Arcade Studio exposes no upload/submit/publish/live control', (await forbiddenControls(page)).length === 0);
    check('Arcade Studio loads with no console/page errors', errors.length === 0);
    if (errors.length) console.log('  studio errors:', errors.join(' | '));
    await page.close();
  }

  // 5. MOBILE viewport — hub + studio boot on a phone-sized context; the four core tools serve (200).
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const { page: hp, errors: he } = await openClean(phone, hubUrl);
    const hubLinks = await hp.$$eval('a.tool-link', (as) => as.length);
    check('mobile: hub loads with 5 links', hubLinks === 5 && he.length === 0);
    await hp.close();
    // Deterministic 200-check that the four core tools are served under the mobile context.
    for (const tool of ['arcade-builder', 'arcade-sandbox', 'block-editor', 'layered-editor']) {
      const resp = await phone.request.get(`${BASE}/arcade/creator/${tool}/`).catch(() => null);
      check(`mobile: ${tool} serves (200)`, !!resp && resp.status() === 200);
    }
    const { page: sp, errors: se } = await openClean(phone, `${BASE}/arcade-studio/`);
    const mReady = await sp.waitForFunction(() => !!(window.__studio && window.__studio.ready), null, { timeout: 20000 })
      .then(() => true).catch(() => false);
    check('mobile: Arcade Studio boots and renders', mReady && se.length === 0);
    await sp.close();
    await phone.close();
  }

  // 6. NETWORK ISOLATION — no request left the static origin across the whole run.
  check(`no external network requests (same-origin static only)`, external.length === 0);
  if (external.length) console.log('  external requests:', [...new Set(external)].slice(0, 8).join(' | '));
} finally {
  await browser.close();
}

console.log(failures ? `\nCREATOR EDITOR STAGING SMOKE: ${failures} FAIL` : '\nCREATOR EDITOR STAGING SMOKE: PASS');
process.exit(failures ? 1 : 0);
