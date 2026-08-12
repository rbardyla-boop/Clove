import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const missionHtml = await readFile(new URL('../../mission-001.html', import.meta.url));
const appJs = await readFile(new URL('../../mission-001-app.js', import.meta.url));
const privateStoreJs = await readFile(new URL('../../mission-private-store.js', import.meta.url));
const STORAGE_KEY = 'clove_v2_mission_001';

function startServer() {
  const signals = [];
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__clove/signal') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try { signals.push(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch {}
        res.writeHead(202, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/mission-private-store.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(privateStoreJs);
      return;
    }
    if (req.method === 'GET' && req.url === '/mission-001-app.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(appJs);
      return;
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/mission-001.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(missionHtml);
      return;
    }
    res.writeHead(404).end('not found');
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, signals, url: `http://127.0.0.1:${port}/mission-001.html` });
    });
  });
}

async function launch() {
  return chromium.launch({ headless: true, channel: 'chrome' });
}

async function fillCommit(page, cls = 'fix', action = 'Repair one loose drawer handle') {
  await page.locator(`[data-class="${cls}"]`).click();
  await page.locator('#missionAction').fill(action);
  await page.locator('#doneWhen').fill('The observable result exists and can be checked');
  await page.locator('#duration').selectOption('under30');
  await page.locator('#firstAction').fill('Get the required ordinary hand tool');
  await page.locator('#safetyCheck').check();
}

async function commitAndReturn(page) {
  await fillCommit(page);
  await page.getByRole('button', { name: 'LOCK THE MISSION' }).click();
  await page.getByRole('button', { name: "I'M LEAVING TO DO IT" }).click();
  await page.reload();
  assert.equal(await page.locator('#return').isVisible(), true);
}

test('hostile-looking and Unicode mission text is rendered as text, never executable markup', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  const hostile = `<img src=x onerror="window.__clovePwned=1"> & \"quoted\" 'text' — café 🙂 العربية`;
  await page.goto(url);
  await fillCommit(page, 'build', hostile);
  await page.getByRole('button', { name: 'LOCK THE MISSION' }).click();

  const summaryText = await page.locator('#lockedSummary').innerText();
  assert.match(summaryText, /<img src=x onerror=/);
  assert.match(summaryText, /café/);
  assert.match(summaryText, /العربية/);
  assert.equal(await page.locator('#lockedSummary img').count(), 0);
  assert.equal(await page.evaluate(() => window.__clovePwned), undefined);

  const raw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  assert.match(raw, /^cloveenc:v1:/);
  assert.doesNotMatch(raw, /clovePwned|café|العربية/);
});

test('double submit cannot create duplicate mission_committed telemetry or parallel writes', async t => {
  const { server, signals, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await fillCommit(page);
  await page.getByRole('button', { name: 'LOCK THE MISSION' }).dblclick({ delay: 1 });
  await page.locator('#locked').waitFor({ state: 'visible' });
  await page.waitForTimeout(150);

  assert.equal(signals.filter(s => s.event === 'mission_committed').length, 1);
});

test('double leave cannot create duplicate mission_exit_prompt_seen telemetry', async t => {
  const { server, signals, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await fillCommit(page);
  await page.getByRole('button', { name: 'LOCK THE MISSION' }).click();
  await page.getByRole('button', { name: "I'M LEAVING TO DO IT" }).dblclick({ delay: 1 });
  await page.locator('#away').waitFor({ state: 'visible' });
  await page.waitForTimeout(150);

  assert.equal(signals.filter(s => s.event === 'mission_exit_prompt_seen').length, 1);
});

test('double outcome selection cannot create duplicate terminal-outcome telemetry', async t => {
  const { server, signals, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await commitAndReturn(page);
  await page.locator('[data-outcome="done"]').dblclick({ delay: 1 });
  await page.locator('#debriefSuccess').waitFor({ state: 'visible' });
  await page.waitForTimeout(150);

  assert.equal(signals.filter(s => s.event === 'mission_done').length, 1);
});

test('reduced-motion preference prevents smooth programmatic scrolling', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.__cloveScrollBehaviors = [];
    window.scrollTo = options => {
      if (options && typeof options === 'object') window.__cloveScrollBehaviors.push(options.behavior || 'auto');
    };
    Element.prototype.scrollIntoView = function (options) {
      if (options && typeof options === 'object') window.__cloveScrollBehaviors.push(options.behavior || 'auto');
    };
  });
  const page = await context.newPage();

  await page.goto(url);
  await page.locator('[data-class="fix"]').click();
  const behaviors = await page.evaluate(() => window.__cloveScrollBehaviors);
  assert.ok(behaviors.length > 0, 'expected a programmatic scroll to be observed');
  assert.equal(behaviors.includes('smooth'), false, `smooth scroll observed under reduced motion: ${behaviors.join(',')}`);
});
