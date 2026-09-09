// Isolated browser fixtures for presentation only; never public player evidence.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('../../games/echo-bloom/', import.meta.url);
const server = createServer(async (req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.split('/').pop() || 'index.html';
  if (!['index.html', 'game.js', 'style.css'].includes(file)) {
    res.writeHead(204); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html' });
  res.end(await readFile(new URL(file, root)));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
after(async () => { await browser.close(); server.close(); });

for (const mobile of [false, true]) test(`loop guidance, reward math and restart (${mobile ? 'touch' : 'keyboard'})`, async () => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1365, height: 900 }, isMobile: mobile, hasTouch: mobile });
  try {
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    assert.match(await page.locator('#startPanel').innerText(), /Score as much as you can in three minutes/);
    const startBox = await page.locator('#startButton').boundingBox();
    const wrapBox = await page.locator('#gameWrap').boundingBox();
    assert.ok(startBox.y + startBox.height <= wrapBox.y + wrapBox.height, 'start button is not clipped by the menu');
    if (process.env.ECHO_QA_DIR) await page.screenshot({ path: `${process.env.ECHO_QA_DIR}/start-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    assert.equal(await page.locator('#loopGuide').isVisible(), false);
    await page.locator('#startButton').click();
    assert.equal(await page.locator('#loopGuide').getAttribute('data-step'), 'move');
    const before = await page.evaluate(() => window.__echoBloom.state.player.x);
    if (mobile) await page.locator('[data-code="ArrowRight"]').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
    else await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(350);
    if (mobile) await page.locator('[data-code="ArrowRight"]').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
    else await page.keyboard.up('ArrowRight');
    assert.ok(await page.evaluate(() => window.__echoBloom.state.player.x) > before + 10);
    await page.evaluate(() => {
      const game = window.__echoBloom, s = game.state;
      s.player.vx = 0; s.player.vy = 0; s.player.invincible = 99;
      s.notes = []; s.enemies = []; s.score = 0; s.combo = 1;
      s.route = Array.from({ length: 40 }, (_, i) => ({ x: s.player.x + Math.cos(i / 40 * Math.PI * 2) * 24, y: s.player.y + Math.sin(i / 40 * Math.PI * 2) * 24 }));
      game.makeEcho();
    });
    await page.waitForFunction(() => document.querySelector('#loopGuide').dataset.step === 'bloom');
    if (mobile) await page.locator('[data-action="dash"]').dispatchEvent('pointerdown', { pointerId: 2, pointerType: 'touch' });
    else await page.keyboard.press('Space');
    await page.waitForFunction(() => document.querySelector('#loopGuide').dataset.step === 'harmony');
    assert.deepEqual(await page.evaluate(() => ({ score: window.__echoBloom.state.score, blooms: window.__echoBloom.state.blooms })), { score: 330, blooms: 1 });
    assert.match(await page.locator('#toast').innerText(), /BLOOM CUT/);
    if (process.env.ECHO_QA_DIR) await page.screenshot({ path: `${process.env.ECHO_QA_DIR}/bloom-${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
    await page.evaluate(() => window.__echoBloom.forceHarmony());
    await page.waitForFunction(() => document.querySelector('#loopGuide').dataset.step === 'repeat');
    assert.equal(await page.evaluate(() => window.__echoBloom.state.score), 1305);
    await page.waitForTimeout(300); // Existing delayed next-note-pattern transition.
    await page.evaluate(() => window.__echoBloom.setTime(180));
    await page.locator('#gameOverPanel.show').waitFor();
    assert.equal(await page.locator('#loopGuide').isVisible(), false);
    await page.locator('#restartButton').click();
    assert.equal(await page.locator('#loopGuide').getAttribute('data-step'), 'move');
    assert.equal(await page.evaluate(() => window.__echoBloom.state.score), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('reduced motion defaults to Calm FX, persists a choice and leaves reward math unchanged', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  try {
    const page = await context.newPage(); await page.goto(base);
    assert.equal(await page.locator('#gameWrap').getAttribute('data-effects'), 'calm');
    assert.equal(await page.locator('#effectsButton').getAttribute('aria-pressed'), 'true');
    await page.locator('#startButton').click();
    await page.evaluate(() => window.__echoBloom.forceHarmony());
    assert.equal(await page.evaluate(() => window.__echoBloom.state.score), 650);
    assert.match(await page.locator('#toast').innerText(), /HARMONY COMPLETE/);
    await page.locator('#effectsButton').click();
    assert.equal(await page.locator('#gameWrap').getAttribute('data-effects'), 'full');
    await page.locator('#effectsButton').click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.reload();
    assert.equal(await page.locator('#gameWrap').getAttribute('data-effects'), 'calm');
  } finally { await context.close(); }
});
