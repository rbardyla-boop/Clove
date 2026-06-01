/**
 * Phase 1i — C/D/E. Cabinet frame contract browser validation.
 *
 * Opens each active cabinet game at several viewport sizes and asserts the frame
 * preserves the game's native size + aspect ratio (no stretch, no crop), keeps
 * the HUD/chrome outside the gameplay safe area, maps input back to native
 * coordinates, and that the debug overlay data matches the pure frame math.
 * Also confirms the server round/ticket flow still works inside the frame.
 *
 * Run: tests/arcade/run-frame-contract.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');
import { getContract, computeFrame } from '../../arcade/cabinet-frame-contract.mjs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/index.html?test=1&frameDebug=1&id=${id}&ws=${encodeURIComponent(WS)}`;

const VIEWPORTS = [
  { name: 'mobile-portrait', w: 390, h: 844 },
  { name: 'mobile-landscape', w: 844, h: 390 },
  { name: 'tablet-portrait', w: 768, h: 1024 },
  { name: 'desktop', w: 1280, h: 720 },
];
const GAMES = [
  { machineId: 'pulse', gameId: 'pulse_tap' },
  { machineId: 'signal', gameId: 'signal_sprint' },
];
const ASPECT_TOL = 0.01;

let failures = 0;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) failures++; };

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errors = [];
  const isExternalNoise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_(NETWORK_CHANGED|INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_)/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isExternalNoise(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(url(`solo${RUN}`), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon, null, { timeout: 8000 });
  await page.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });
  check('client connects to the room', true);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(120); // let resize/recalc settle

    for (const g of GAMES) {
      // Occupy the cabinet (authoritative) → the frame + game open.
      await page.evaluate((m) => window.__neon.client.occupy(m), g.machineId);
      await page.waitForFunction((gid) => {
        const o = document.querySelector(`.cf-overlay[data-game-id="${gid}"]`);
        return o && o.classList.contains('show') && window.__cabinetFrames && window.__cabinetFrames[gid] && window.__cabinetFrames[gid].debug().scale > 0;
      }, g.gameId, { timeout: 8000 });
      // nudge a recalc for the active viewport
      await page.evaluate((gid) => window.__cabinetFrames[gid].recalc(), g.gameId);

      const tag = `[${vp.name} ${g.gameId}]`;
      const contract = getContract(g.gameId);

      // C/D: frame root has the contract data attributes + native size.
      const attrs = await page.evaluate((gid) => {
        const o = document.querySelector(`.cf-overlay[data-game-id="${gid}"]`);
        return { nw: +o.dataset.nativeWidth, nh: +o.dataset.nativeHeight, ar: o.dataset.aspectRatio, mode: o.dataset.scaleMode };
      }, g.gameId);
      check(`${tag} frame has native size data attributes`, attrs.nw === contract.native_width && attrs.nh === contract.native_height && attrs.mode === 'fit-contain');

      const d = await page.evaluate((gid) => window.__cabinetFrames[gid].debug(), g.gameId);

      // E: aspect ratio preserved (no stretch).
      const displayAspect = d.displayWidth / d.displayHeight;
      check(`${tag} aspect ratio preserved (no stretch)`, Math.abs(displayAspect - contract.native_width / contract.native_height) < ASPECT_TOL);

      // E: no crop — display fits inside the frame.
      check(`${tag} no crop (display fits in frame)`, d.displayWidth <= d.frameWidth + 1 && d.displayHeight <= d.frameHeight + 1 && d.fits);

      // E: debug data matches the pure frame math.
      const expect = computeFrame({
        nativeWidth: contract.native_width, nativeHeight: contract.native_height,
        frameWidth: d.frameWidth, frameHeight: d.frameHeight, scaleMode: contract.scale_mode,
        allowUpscale: contract.allow_upscale, maxUpscale: contract.max_upscale, minScale: contract.min_scale,
      });
      check(`${tag} debug scale matches pure frame math`, Math.abs(expect.scale - d.scale) < 1e-6);
      check(`${tag} scale within bounds (>0, <= max_upscale)`, d.scale > 0 && d.scale <= contract.max_upscale + 1e-9);

      // E: HUD/chrome is outside the gameplay safe area (chrome above the stage).
      const rects = await page.evaluate((sel) => {
        const chrome = document.querySelector(sel.chrome)?.getBoundingClientRect();
        const stage = document.querySelector(sel.stage)?.getBoundingClientRect();
        return chrome && stage ? { chromeBottom: chrome.bottom, stageTop: stage.top } : null;
      }, contract.test_selectors);
      check(`${tag} HUD/chrome outside gameplay safe area`, !!rects && rects.chromeBottom <= rects.stageTop + 2);

      // C/D: input maps into native coordinates (round-trip via the live runtime).
      const map = await page.evaluate((gid) => {
        const f = window.__cabinetFrames[gid];
        const s = f.nativeToScreenPoint(180, 320);          // native centre → screen
        const back = f.screenToNativePoint(s.clientX, s.clientY); // → back to native
        return back;
      }, g.gameId);
      check(`${tag} native coordinate mapping round-trips`, Math.abs(map.x - 180) < 0.5 && Math.abs(map.y - 320) < 0.5);

      // Release for the next game (close the frame overlay).
      await page.evaluate((m) => window.__neon.client.release(m), g.machineId);
      await page.waitForFunction((gid) => {
        const o = document.querySelector(`.cf-overlay[data-game-id="${gid}"]`);
        return !o || !o.classList.contains('show');
      }, g.gameId, { timeout: 8000 });
    }
  }

  // C/D: server round + ticket flow still works INSIDE the frame (desktop).
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => window.__neon.client.occupy('pulse'));
  await page.waitForFunction(() => document.querySelector('.cf-overlay[data-game-id="pulse_tap"]')?.classList.contains('show'), null, { timeout: 8000 });
  const pr = await page.evaluate(async () => { window.__neon.client.startPulseRound('pulse'); await new Promise((r) => setTimeout(r, 250)); return window.__neon.state().roundId; });
  await page.evaluate((rid) => window.__neon.client.submitPulseRound({ roundId: rid, machineId: 'pulse', grade: 'A', accuracy: 88, hits: 16, bestStreak: 9, score: 1825, durationMs: 30000 }), pr);
  await page.waitForFunction(() => window.__neon.state().tickets > 0, null, { timeout: 8000 });
  check('Pulse Tap round start/submit + ticket award works inside the frame', (await page.evaluate(() => window.__neon.state().tickets)) === 20);
  await page.evaluate(() => window.__neon.client.release('pulse'));

  await page.evaluate(() => window.__neon.client.occupy('signal'));
  await page.waitForFunction(() => document.querySelector('.cf-overlay[data-game-id="signal_sprint"]')?.classList.contains('show'), null, { timeout: 8000 });
  const sr = await page.evaluate(async () => { window.__neon.client.startSignalRound('signal'); await new Promise((r) => setTimeout(r, 250)); return window.__neon.state().signalRoundId; });
  await page.evaluate((rid) => window.__neon.client.submitSignalRound({ roundId: rid, machineId: 'signal', grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000 }), sr);
  await page.waitForFunction(() => window.__neon.state().tickets >= 44, null, { timeout: 8000 });
  check('Signal Sprint round start/submit + ticket award works inside the frame', (await page.evaluate(() => window.__neon.state().tickets)) === 44);
  await page.evaluate(() => window.__neon.client.release('signal'));

  // ── Phase 1j: Cabinet Adapter SDK ──────────────────────────────────────────
  // Both games entered the arcade THROUGH adapters (mounted at boot).
  check('Pulse Tap is mounted through its adapter', await page.evaluate(() => {
    const a = window.__neon.adapters.pulse_tap;
    return !!a && a.ok && a.state === 'playable' && a.adapter.gameId === 'pulse_tap' && !!a.game;
  }));
  check('Signal Sprint is mounted through its adapter', await page.evaluate(() => {
    const a = window.__neon.adapters.signal_sprint;
    return !!a && a.ok && a.state === 'playable' && !!a.game;
  }));

  // The adapter exposes the native 360x640 frame + working coordinate mapping.
  await page.evaluate(() => window.__neon.client.occupy('pulse'));
  await page.waitForFunction(() => document.querySelector('.cf-overlay[data-game-id="pulse_tap"]')?.classList.contains('show'), null, { timeout: 8000 });
  const adFrame = await page.evaluate(() => { const d = window.__neon.adapters.pulse_tap.getFrame().debug(); return { nw: d.nativeWidth, nh: d.nativeHeight }; });
  check('adapter exposes the 360x640 native frame', adFrame.nw === 360 && adFrame.nh === 640);
  const adRt = await page.evaluate(() => { const a = window.__neon.adapters.pulse_tap; const s = a.nativeToScreenPoint(180, 320); return a.screenToNativePoint(s.clientX, s.clientY); });
  check('adapter coordinate mapping round-trips', Math.abs(adRt.x - 180) < 0.5 && Math.abs(adRt.y - 320) < 0.5);
  await page.evaluate(() => window.__neon.client.release('pulse'));

  // An unknown/invalid adapter fails closed: no game, no frame overlay, no crash.
  const failClosed = await page.evaluate(() => {
    const r = window.__mountAdapter('totally_unknown_cabinet');
    return { ok: r.ok, state: r.state, game: r.game, overlay: !!document.querySelector('.cf-overlay[data-game-id="totally_unknown_cabinet"]') };
  });
  check('unknown/invalid adapter fails closed (no game, no frame, no crash)', failClosed.ok === false && failClosed.state === 'unavailable' && failClosed.game === null && failClosed.overlay === false);

  // Render-state resolver: active+adapter → playable; coming_soon → not; active+no-adapter → unavailable.
  const rs = await page.evaluate(() => ({
    playable: window.__neon.renderState({ cabinet_type: 'pulse_tap', status: 'live', ticket_enabled: true }),
    soon: window.__neon.renderState({ cabinet_type: 'match', status: 'coming_soon', ticket_enabled: false }),
    unavailable: window.__neon.renderState({ cabinet_type: 'mysteryX', status: 'live', ticket_enabled: true }),
  }));
  check('render-state resolver classifies cabinets correctly', rs.playable === 'playable' && rs.soon === 'coming_soon' && rs.unavailable === 'unavailable');

  check('no console / page errors (main flow)', errors.length === 0);
  if (errors.length) console.log('  errors:', JSON.stringify(errors, null, 2));

  // ── Phase 1k: dynamic import loader + lifecycle routing + diagnostics ────────
  // Run on a dedicated page so the test-only fixture is isolated from the main flow.
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const fpage = await ctx2.newPage();
  const fErrors = [];
  fpage.on('pageerror', (e) => fErrors.push('pageerror: ' + e.message));
  fpage.on('console', (m) => { if (m.type() === 'error' && !isExternalNoise(m.text())) fErrors.push('console: ' + m.text()); });
  await fpage.goto(`${BASE}/arcade/index.html?test=1&frameDebug=1&adapterFixture=sample-import-game&id=fix${RUN}&ws=${encodeURIComponent(WS)}`, { waitUntil: 'load' });
  await fpage.waitForFunction(() => !!window.__neon, null, { timeout: 8000 });
  await fpage.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 8000 });

  // E: dynamic loader mounts the sample fixture inside a frame, native size preserved.
  await fpage.waitForFunction(() => window.__neon.fixtureMount && window.__neon.fixtureMount.ok, null, { timeout: 8000 });
  check('dynamic import loader loads + mounts the sample fixture', true);
  const fd = await fpage.evaluate(() => window.__cabinetFrames['sample_import_game'].debug());
  check('imported fixture frame preserves native 320x480', fd.nativeWidth === 320 && fd.nativeHeight === 480);
  check('imported fixture fits with no crop + aspect preserved', fd.fits && Math.abs(fd.displayWidth / fd.displayHeight - 320 / 480) < ASPECT_TOL);

  // C: lifecycle routing (onMount + onFocus on open).
  await fpage.waitForFunction(() => { const l = window.__neon.fixtureLifecycle; return l.includes('onMount') && l.includes('onFocus'); }, null, { timeout: 8000 });
  check('fixture lifecycle: onMount + onFocus routed on open', true);

  // C: onResize routed on a viewport change.
  await fpage.setViewportSize({ width: 900, height: 700 });
  await fpage.waitForFunction(() => window.__neon.fixtureLifecycle.includes('onResize'), null, { timeout: 8000 });
  check('fixture lifecycle: onResize routed on viewport change', true);

  // C: a lifecycle exception is caught + recorded as an adapter error (no crash).
  const caught = await fpage.evaluate(() => {
    const c = window.__cabinetAdapterRuntime.mountImportedGame('sample_import_game', { lifecycle: { onServerState: () => { throw new Error('boom'); } } });
    c.fireServerState({ public: true });
    return window.__cabinetAdapterRuntime.adapterErrors().some((e) => /onServerState/.test(e.where));
  });
  check('lifecycle exception is caught + recorded (no app crash)', caught);

  // C: clean unmount.
  await fpage.evaluate(() => window.__neon.fixtureMount.mount.unmount());
  await fpage.waitForFunction(() => window.__neon.fixtureLifecycle.includes('onUnmount'), null, { timeout: 8000 });
  check('fixture lifecycle: onUnmount routed on unmount', true);

  // D: diagnostics exposed under test flag, with no private state leak.
  const d = await fpage.evaluate(() => {
    const r = window.__cabinetAdapterRuntime;
    const json = JSON.stringify({ regs: r.registeredAdapters(), mounts: r.mounts(), log: r.lifecycleLog(), unsupported: r.unsupportedCabinets(), errors: r.adapterErrors() });
    return { has: typeof r === 'object' && typeof r.lifecycleLog === 'function', clean: !/balance|ledger|inventory|redemption/i.test(json) };
  });
  check('runtime diagnostics exposed under test flag', d.has);
  check('diagnostics leak no balance / ledger / inventory', d.clean);

  // D: a failed import fails closed and is reported in diagnostics.
  const failImp = await fpage.evaluate(async () => {
    const bad = { manifest_version: 1, game_id: 'evil', source_name: 'e', source_kind: 'x', original_width: 1, original_height: 1, current_width: 1, current_height: 1, aspect_ratio: 1, entry_file: 'game/evil.js', adapter_module: 'game/evil.mjs', authority_mode: 'client_local_only', ticket_mode: 'none', challenge_mode: 'none', forbidden_capabilities: [], requested_capabilities: [], clone_policy: 'preserve_original_size', migration_flag: false };
    const res = await window.__cabinetAdapterRuntime.loadAndMountImported(bad);
    return { ok: res.ok, last: window.__cabinetAdapterRuntime.lastImportResult && window.__cabinetAdapterRuntime.lastImportResult.ok };
  });
  check('a forbidden/invalid import fails closed + appears in diagnostics', failImp.ok === false && failImp.last === false);

  check('no console / page errors (fixture flow)', fErrors.length === 0);
  if (fErrors.length) console.log('  fixture errors:', JSON.stringify(fErrors, null, 2));
  await ctx2.close();

  // D: normal mode (no ?test / ?frameDebug) exposes NO diagnostics globals.
  const ctx3 = await browser.newContext();
  const npage = await ctx3.newPage();
  await npage.goto(`${BASE}/arcade/index.html?id=plain${RUN}&ws=${encodeURIComponent(WS)}`, { waitUntil: 'load' });
  await npage.waitForTimeout(600);
  const leak = await npage.evaluate(() => ({ rt: typeof window.__cabinetAdapterRuntime, neon: typeof window.__neon, mount: typeof window.__mountAdapter }));
  check('normal mode exposes no adapter diagnostics globals', leak.rt === 'undefined' && leak.neon === 'undefined' && leak.mount === 'undefined');
  await ctx3.close();
} finally {
  await browser.close();
}

console.log(failures === 0 ? '\nFRAME CONTRACT VALIDATION: PASS' : `\nFRAME CONTRACT VALIDATION: ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
