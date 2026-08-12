import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { firefox } from 'playwright';

const missionHtml = await readFile(new URL('../../mission-001.html', import.meta.url));
const appJs = await readFile(new URL('../../mission-001-app.js', import.meta.url));
const privateStoreJs = await readFile(new URL('../../mission-private-store.js', import.meta.url));
const STORAGE_KEY = 'clove_v2_mission_001';

function startServer() {
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__clove/signal') {
      req.resume();
      res.writeHead(202, { 'content-type': 'application/json' });
      res.end('{"ok":true}');
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
      resolve({ server, url: `http://127.0.0.1:${port}/mission-001.html` });
    });
  });
}

test('Firefox supports encrypted commit, leave, reload and return', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await firefox.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await page.locator('[data-class="learn"]').click();
  await page.locator('#commit').waitFor({ state: 'visible' });
  await page.locator('#missionAction').fill('Demonstrate one concrete skill');
  await page.locator('#doneWhen').fill('The skill can be demonstrated successfully');
  await page.locator('#duration').selectOption('under30');
  await page.locator('#firstAction').fill('Set up the demonstration');
  await page.locator('#safetyCheck').check();
  await page.getByRole('button', { name: 'LOCK THE MISSION' }).click();
  await page.locator('#locked').waitFor({ state: 'visible' });

  const committedRaw = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  assert.match(committedRaw, /^cloveenc:v1:/);
  assert.doesNotMatch(committedRaw, /Demonstrate one concrete skill|Set up the demonstration/);

  await page.getByRole('button', { name: "I'M LEAVING TO DO IT" }).click();
  await page.locator('#away').waitFor({ state: 'visible' });
  await page.reload();
  await page.locator('#return').waitFor({ state: 'visible' });
  assert.match(await page.locator('#returnSummary').innerText(), /Demonstrate one concrete skill/);
});
