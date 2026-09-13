import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../', import.meta.url));
let browser, server, origin = process.env.ARCADE_MIND_ORIGIN;

before(async () => {
  if (!origin) {
    server = createServer(async (req, res) => {
      try {
        const path = decodeURIComponent(new URL(req.url, 'http://test').pathname);
        if (path === '/favicon.ico') { res.writeHead(204); res.end(); return; }
        const file = resolve(root, `.${path}`);
        if (!file.startsWith(root)) throw Error('outside root');
        let served = file;
        if ((await stat(served)).isDirectory()) served = resolve(served, 'index.html');
        const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' }[extname(served)] || 'application/octet-stream';
        res.setHeader('content-type', type);
        res.end(await readFile(served));
      } catch { res.writeHead(404); res.end(); }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(r => server.close(r));
});

async function openMind(t, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  t.after(() => context.close());
  await context.addInitScript(() => localStorage.setItem('clove_signals_optout_v1', '1'));
  await context.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 204, body: '' }));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', response => {
    if (response.status() >= 400 && new URL(response.url()).origin === origin) errors.push(`${response.status()} ${response.url()}`);
  });
  t.after(() => assert.deepEqual(errors, [], 'standalone mind machine has no runtime or asset errors'));
  await page.goto(`${origin}/game/theincrediblemindmachine/`, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__mm));
  return page;
}

test('standalone mind machine exposes the current objective and clears portrait HUD collisions', async t => {
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const page = await openMind(t, viewport);
    assert.match(await page.locator('#objective-title').innerText(), /Ball of Clarity/);
    assert.ok((await page.locator('#objective-hint').innerText()).length > 8);
    assert.match(await page.locator('#run-status').innerText(), /EDIT MODE/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const boxes = await page.evaluate(() => Object.fromEntries(
      ['.top', '.objective-card', '.run-status', '.selected-info', '.right-rail', '.helper', '#palette']
        .map(selector => [selector, document.querySelector(selector)?.getBoundingClientRect().toJSON()])
    ));
    const overlaps = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    assert.equal(overlaps(boxes['.helper'], boxes['#palette']), false, `${viewport.width}px helper/palette overlap`);
    assert.equal(overlaps(boxes['.right-rail'], boxes['.helper']), false, `${viewport.width}px legend/helper overlap`);
    assert.equal(overlaps(boxes['.top'], boxes['.objective-card']), false, `${viewport.width}px top/objective overlap`);
    assert.equal(overlaps(boxes['.objective-card'], boxes['.run-status']), false, `${viewport.width}px objective/status overlap`);
    await page.locator('.pill[data-part="rope"]').click();
    const selectedBox = await page.locator('.selected-info').boundingBox();
    const selected = selectedBox && { left: selectedBox.x, right: selectedBox.x + selectedBox.width, top: selectedBox.y, bottom: selectedBox.y + selectedBox.height };
    assert.equal(overlaps(selected, boxes['.objective-card']), false, `${viewport.width}px selected/objective overlap`);
    assert.equal(overlaps(selected, boxes['.run-status']), false, `${viewport.width}px selected/status overlap`);
    if(viewport.width<720) {
      assert.ok(boxes['#palette'].bottom <= viewport.height-48, 'inventory clears the live Feedback launcher');
    }
  }
});

test('a fallen run gives an actionable retry and preserves construction', async t => {
  const page = await openMind(t, { width: 390, height: 844 });
  // No construction and no input must fail; it must never be treated as a win.
  await page.locator('#run-btn').click();
  await page.locator('#fail-modal.active').waitFor({ state: 'attached', timeout: 30000 });
  assert.equal(await page.locator('#win-modal').evaluate(el => el.classList.contains('active')), false, 'no-input run cannot win');
  assert.match(await page.locator('#fail-sub').innerText(), /placed parts are still here|adjust them|retry/i);
  await page.locator('#fail-edit-btn').click();
  assert.equal(await page.locator('#fail-modal').evaluate(el => el.classList.contains('active')), false);
  // Construction is made through the visible inventory, not the debug handle.
  await page.locator('.pill[data-part="rope"]').click();
  assert.equal(await page.evaluate(() => window.__mm.state.parts.length), 1);
  await page.locator('#run-btn').click();
  await page.locator('#fail-modal.active').waitFor({ state: 'attached', timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__mm.state.parts.length), 1, 'failure does not erase construction');
  await page.locator('#fail-retry-btn').click();
  assert.equal(await page.locator('#fail-modal').evaluate(el => el.classList.contains('active')), false);
  assert.match(await page.locator('#run-status').innerText(), /RUNNING/);
  assert.equal(await page.evaluate(() => window.__mm.state.running), true, 'retry actually runs the preserved layout');
  assert.equal(await page.evaluate(() => window.__mm.state.parts.length), 1);
});

test('level 20 is an explicit terminal outcome, not a wrapped next level', async () => {
  const source = await readFile(resolve(root, 'game/theincrediblemindmachine/index.html'), 'utf8');
  assert.match(source, /STATE\.levelIndex === LEVELS\.length - 1/);
  assert.match(source, /CAMPAIGN COMPLETE · Level 20 of 20/);
  assert.match(source, /next\.disabled = terminal/);
  assert.match(source, /if \(STATE\.levelIndex === LEVELS\.length - 1\) return;/);
  assert.doesNotMatch(source, /Host on Cloudflare Pages/);
});
