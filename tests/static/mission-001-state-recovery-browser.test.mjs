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

async function launch() {
  return chromium.launch({ headless: true, channel: 'chrome' });
}

function validCommitted(overrides = {}) {
  return {
    class: 'fix',
    status: 'committed',
    action: 'Tighten one loose drawer handle',
    doneWhen: 'The handle is secure and the drawer opens normally',
    duration: 'under30',
    firstAction: 'Get the correct screwdriver',
    startNote: '',
    committedAt: Date.now() - 1000,
    returnedTracked: false,
    ...overrides,
  };
}

async function injectLegacyAndReload(page, value) {
  await page.evaluate(([key, payload]) => localStorage.setItem(key, JSON.stringify(payload)), [STORAGE_KEY, value]);
  await page.reload();
}

for (const [name, malformed] of [
  ['unknown status', validCommitted({ status: 'teleported' })],
  ['planning with unknown class', { class: 'hacker', status: 'planning' }],
  ['committed state missing required mission action', validCommitted({ action: '' })],
  ['debrief with unknown outcome', validCommitted({ status: 'debrief', outcome: 'victory_royale', leftAt: Date.now() - 500 })],
  ['complete state with malformed debrief', validCommitted({ status: 'complete', outcome: 'done', leftAt: Date.now() - 500, debrief: { actual: '' }, completedAt: Date.now() })],
]) {
  test(`malformed persisted state is rejected and reset: ${name}`, async t => {
    const { server, url } = await startServer();
    t.after(() => new Promise(resolve => server.close(resolve)));
    const browser = await launch();
    t.after(() => browser.close());
    const page = await browser.newPage();

    await page.goto(url);
    await injectLegacyAndReload(page, malformed);

    assert.equal(await page.locator('#choose').isVisible(), true);
    assert.equal(await page.locator('#locked').isVisible(), false);
    assert.equal(await page.locator('#return').isVisible(), false);
    assert.equal(await page.locator('#debriefSuccess').isVisible(), false);
    assert.equal(await page.locator('#debriefFailed').isVisible(), false);
    assert.equal(await page.locator('#debriefNotStarted').isVisible(), false);
    assert.equal(await page.locator('#complete').isVisible(), false);
    assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
    assert.match(await page.locator('#stateFailure').innerText(), /could not be trusted|reset/i);
  });
}

test('a structurally valid left state still restores to the return gate', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await injectLegacyAndReload(page, validCommitted({
    status: 'left',
    leftAt: Date.now() - 500,
  }));

  assert.equal(await page.locator('#return').isVisible(), true);
  assert.match(await page.locator('#returnSummary').innerText(), /Tighten one loose drawer handle/);
  assert.match(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), /^cloveenc:v1:/);
});

test('corrupted encrypted ciphertext fails closed and is preserved for diagnosis', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  const corrupt = 'cloveenc:v1:AAAAAAAAAAAAAAAAAAAAAA==';
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, corrupt]);
  await page.reload();

  assert.equal(await page.locator('#choose').isVisible(), true);
  assert.match(await page.locator('#storageFailure').innerText(), /storage is unavailable|not saved/i);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), corrupt);
});

test('a storage write failure does not reveal a commit form that cannot be persisted', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.addInitScript(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(name, value) {
      if (name === key) throw new DOMException('Simulated quota failure', 'QuotaExceededError');
      return original.call(this, name, value);
    };
  }, STORAGE_KEY);
  const page = await context.newPage();

  await page.goto(url);
  await page.locator('[data-class="fix"]').click();

  assert.match(await page.locator('#storageFailure').innerText(), /not saved/i);
  assert.equal(await page.locator('#commit').isVisible(), false);
  assert.equal(await page.locator('#choose').isVisible(), true);
  assert.equal(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY), null);
});
