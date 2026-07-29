import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { chromium } from 'playwright';
import { curatedUploadFileList } from '../../scripts/build-curated-client-upload.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

async function text(path) {
  return readFile(join(root, path), 'utf8');
}

test('privacy contract is present on every curated HTML page', async () => {
  const candidates = curatedUploadFileList(root).included.filter(file =>
    file.endsWith('.html') && !file.startsWith('arcade/creator/'));
  const htmlFiles = [];
  for (const file of candidates) {
    if (!(await text(file)).includes("script-src 'none'")) htmlFiles.push(file);
  }
  assert.ok(htmlFiles.length > 100);
  const missing = [];
  for (const file of htmlFiles) {
    if (!(await text(file)).includes('/clove-signals.js')) missing.push(file);
  }
  assert.deepEqual(missing, []);

  const migration = await text('workers/insights/migrations/0001_privacy_first.sql');
  assert.doesNotMatch(migration, /\b(ip|email|user_agent|cookie|account_id|session_id|full_url)\b/i);
  assert.match(migration, /aggregate_daily/);
  assert.match(migration, /feedback_notes/);

  const worker = await text('workers/insights/src/index.ts');
  assert.match(worker, /'-90 days'/);
  assert.match(worker, /'-400 days'/);
  assert.doesNotMatch(worker, /request\.headers\.get\(['"]user-agent/i);
  assert.doesNotMatch(worker, /request\.headers\.get\(['"]cf-connecting-ip/i);
});

test('new discovery surfaces and Echo Bloom ship in the curated tree', async () => {
  const required = [
    'games/index.html',
    'games/games.js',
    'games/echo-bloom/index.html',
    'games/echo-bloom/game.js',
    'games/echo-bloom/style.css',
    'wellbeing/index.html',
    'privacy-signals.html',
    'feedback.html',
  ];
  for (const file of required) assert.ok((await stat(join(root, file))).isFile(), file);

  const echoFiles = curatedUploadFileList(root).included.filter(file => file.startsWith('games/echo-bloom/'));
  assert.ok(echoFiles.includes('games/echo-bloom/game.js'));
  assert.ok(!echoFiles.some(file => /progress|evidence|recording/i.test(file)));

  const sitemap = await text('sitemap.xml');
  for (const url of ['/games/', '/games/echo-bloom/', '/game/vibecenter/', '/wellbeing/']) {
    assert.ok(sitemap.includes(`https://clovelearn.io${url}`), url);
  }
});

test('front door, feedback, and mobile Echo Bloom work together', async t => {
  const submissions = [];
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.json': 'application/json',
  };
  const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/__clove/')) {
      let body = '';
      for await (const chunk of request) body += chunk;
      submissions.push({ path: url.pathname, body: body ? JSON.parse(body) : null });
      response.writeHead(202, { 'content-type': 'application/json' });
      response.end('{"ok":true}');
      return;
    }
    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (!relative) relative = 'index.html';
    let file = normalize(join(root, relative));
    if (!file.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const data = await readFile(file);
      response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
      response.end(data);
    } catch {
      response.writeHead(url.pathname === '/favicon.ico' ? 204 : 404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());

  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.choice').count(), 3);
  assert.match(await page.locator('h1').innerText(), /What would help/);
  assert.equal(await page.locator('#continueCard').isVisible(), false);

  await page.evaluate(() => localStorage.setItem('clove_last_activity_v1', JSON.stringify({
    kind: 'game', slug: 'echo-bloom', title: 'Echo Bloom', href: '/games/echo-bloom/', at: Date.now(),
  })));
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('#continueCard').isVisible(), true);
  assert.match(await page.locator('#continueTitle').innerText(), /Echo Bloom/);

  await page.goto(`${base}/games/`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.game-card').count(), 8);
  assert.equal(await page.locator('a[href="/games/echo-bloom/"]').count() > 0, true);
  assert.equal(await page.locator('#gameContinue').isVisible(), false);
  assert.ok((await page.locator('#dailyGame').boundingBox()).width > 800);

  await page.goto(`${base}/wellbeing/`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.need-group').count(), 4);

  await page.goto(`${base}/feedback.html`, { waitUntil: 'networkidle' });
  await page.selectOption('[name=category]', 'broken');
  await page.fill('[name=note]', 'The game restart button did not respond.');
  await page.click('button[type=submit]');
  await page.locator('#feedbackStatus').filter({ hasText: 'reached the builder' }).waitFor();
  assert.ok(submissions.some(item => item.path === '/__clove/feedback' && item.body.note.includes('restart')));

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on('pageerror', error => errors.push(error.message));
  mobile.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await mobile.goto(`${base}/games/echo-bloom/`, { waitUntil: 'networkidle' });
  assert.equal(await mobile.locator('#startButton').isVisible(), true);
  assert.equal(await mobile.locator('.quality-grid div').count(), 5);
  assert.equal(await mobile.locator('#shareButton').count(), 1);
  await mobile.click('#startButton');
  const before = await mobile.evaluate(() => window.__echoBloom.state.player.x);
  await mobile.locator('[data-code="ArrowRight"]').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
  await mobile.waitForTimeout(650);
  await mobile.locator('[data-code="ArrowRight"]').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
  const after = await mobile.evaluate(() => window.__echoBloom.state.player.x);
  assert.ok(after > before + 10, `${before} -> ${after}`);

  assert.deepEqual(errors, []);
  assert.ok(submissions.some(item => item.path === '/__clove/signal' && item.body.event === 'site_opened'));
});
