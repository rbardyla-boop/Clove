/**
 * Phase 3E — mobile / public-playtest hardening checks.
 *
 * Loads the arcade at a small mobile viewport (and with prefers-reduced-motion) and
 * proves a public playtester can navigate the core loop without the page being broken,
 * unreadable, or exposing operator controls. It changes NO game mechanics — it only
 * asserts UX/accessibility hardening invariants.
 *
 * Run: tests/arcade/run-mobile-playtest.sh
 */
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_REQUIRE_BASE || import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8080';
const WS = process.env.WS_URL || 'ws://127.0.0.1:8787/arcade/ws';
const RUN = Date.now().toString(36);
const url = (id) => `${BASE}/arcade/index.html?test=1&id=${id}&ws=${encodeURIComponent(WS)}`;
const VIEWPORT = { width: 360, height: 640 }; // small modern phone

let failures = 0;
const check = (name, cond, detail) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${detail && !cond ? `  — ${detail}` : ''}`); if (!cond) failures++; };

const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce', // exercise prefers-reduced-motion: reduce
  });
  const page = await ctx.newPage();
  const errors = [];
  const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com/.test(t) || /net::ERR_/.test(t);
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(url(`m${RUN}`), { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__neon, null, { timeout: 12000 });
  await page.waitForFunction(() => document.getElementById('statusTxt')?.textContent.includes('live'), null, { timeout: 12000 });
  check('arcade loads + connects at 360px mobile width', true);

  // No horizontal overflow (the classic mobile break). Allow 1px rounding slack.
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return { scrollW: d.scrollWidth, clientW: d.clientWidth };
  });
  check('no horizontal overflow at 360px', overflow.scrollW <= overflow.clientW + 1, JSON.stringify(overflow));

  // Primary interactive controls have an accessible name + a usable tap target.
  const controls = ['#roomBtn', '#prizeBtn', '#challengeBtn', '#interactBtn', '#playerChip'];
  for (const sel of controls) {
    const info = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
      return { w: r.width, h: r.height, name, visible: r.width > 0 && r.height > 0 };
    }, sel);
    if (!info || !info.visible) { check(`${sel} present + visible`, false, 'missing/hidden'); continue; }
    check(`${sel} has an accessible name`, info.name.length > 0, JSON.stringify(info));
    check(`${sel} has a usable tap target (>=40px)`, Math.min(info.w, info.h) >= 40, `${info.w}x${info.h}`);
  }

  // Core loop is reachable on mobile: occupy a cabinet → play → server awards tickets.
  await page.click('.cab[data-id="pulse"]');
  await page.waitForFunction(() => document.querySelector('.cab[data-id="pulse"]').classList.contains('mine'), null, { timeout: 10000 });
  const rid = await page.evaluate(async () => { window.__neon.client.startPulseRound('pulse'); await new Promise((r) => setTimeout(r, 250)); return window.__neon.state().roundId; });
  await page.evaluate((r) => window.__neon.client.submitPulseRound({ roundId: r, machineId: 'pulse', grade: 'A', accuracy: 88, hits: 16, bestStreak: 9, score: 1825, durationMs: 30000 }), rid);
  await page.waitForFunction(() => window.__neon.state().tickets > 0, null, { timeout: 10000 });
  check('core loop reachable on mobile (occupy → play → tickets)', (await page.evaluate(() => window.__neon.state().tickets)) > 0);

  // Release the cabinet so its mounted game frame no longer overlays the header.
  await page.evaluate(() => window.__neon.client.release('pulse'));
  await page.waitForFunction(() => !document.querySelector('.cab[data-id="pulse"]').classList.contains('mine'), null, { timeout: 10000 }).catch(() => {});

  // Prize Counter opens + is readable (no overflow) on mobile, then closes cleanly.
  await page.click('#prizeBtn');
  await page.waitForSelector('.pc-overlay.show', { timeout: 8000 });
  const prizeFits = await page.evaluate(() => {
    const p = document.querySelector('.pc-overlay.show');
    return !!p && p.scrollWidth <= document.documentElement.clientWidth + 1;
  });
  check('Prize Counter opens + fits at 360px', prizeFits);
  await page.evaluate(() => { const b = document.querySelector('.pc-overlay [data-act="close"], .pc-overlay .pc-close'); if (b) b.click(); });
  await page.waitForFunction(() => !document.querySelector('.pc-overlay.show'), null, { timeout: 8000 }).catch(() => {});

  // LAST: operator admin (live-ops) controls are NOT exposed to a public player.
  await page.click('#roomBtn');
  await page.waitForSelector('.lobby-overlay.show', { timeout: 8000 });
  check('admin gear is hidden for public players', await page.evaluate(() => !document.querySelector('.lobby-overlay [data-act="admin"]')));
  const lobbyFits = await page.evaluate(() => {
    const p = document.querySelector('.lobby-overlay.show .lobby-panel');
    return !p || p.scrollWidth <= document.documentElement.clientWidth + 1;
  });
  check('lobby panel does not overflow at 360px', lobbyFits);

  check('no console / page errors (mobile + reduced-motion)', errors.length === 0);
  if (errors.length) console.log('  errors:', JSON.stringify(errors, null, 2));
  await ctx.close();
} finally {
  await browser.close();
}

console.log(`\nMOBILE PLAYTEST: ${failures === 0 ? 'PASS' : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
