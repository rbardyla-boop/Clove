import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const missionHtml = await readFile(new URL('../../mission-001.html', import.meta.url));
const appJs = await readFile(new URL('../../mission-001-app.js', import.meta.url));
const privateStoreJs = await readFile(new URL('../../mission-private-store.js', import.meta.url));
const STORAGE_KEY = 'clove_v2_mission_001';
const DB_NAME = 'clove_private_store_v1';
const STORE_NAME = 'keys';
const KEY_ID = 'mission_aes_main';

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

async function createCommittedMission(page) {
  await page.locator('[data-class="fix"]').click();
  await page.locator('#missionAction').fill('Tighten one loose drawer handle');
  await page.locator('#doneWhen').fill('The handle is secure and the drawer opens normally');
  await page.locator('#duration').selectOption('under30');
  await page.locator('#firstAction').fill('Get the correct screwdriver');
  await page.locator('#safetyCheck').check();
  await page.getByRole('button', { name: 'LOCK THE MISSION' }).click();
  await page.locator('#locked').waitFor({ state: 'visible' });
}

async function deletePrivateKey(page) {
  await page.evaluate(async ({ dbName, storeName, keyId }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const request = tx.objectStore(storeName).delete(keyId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } finally {
      db.close();
    }
  }, { dbName: DB_NAME, storeName: STORE_NAME, keyId: KEY_ID });
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

test('loss of the IndexedDB encryption key fails closed without deleting ciphertext', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url);
  await createCommittedMission(page);
  const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  assert.match(before, /^cloveenc:v1:/);
  assert.doesNotMatch(before, /drawer handle|screwdriver/i);

  await deletePrivateKey(page);
  await page.reload();

  assert.equal(await page.locator('#choose').isVisible(), true);
  assert.match(await page.locator('#storageFailure').innerText(), /storage is unavailable|not saved/i);
  const after = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  assert.equal(after, before, 'ciphertext must be preserved when its key is unavailable');
  assert.doesNotMatch(after, /drawer handle|screwdriver/i);
});

test('hidden outcome controls cannot skip committed -> left -> return transition order', async t => {
  const { server, signals, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await createCommittedMission(page);
  const before = await page.evaluate(async key => window.ClovePrivateStore.get(key, null), STORAGE_KEY);
  assert.equal(before.status, 'committed');

  await page.evaluate(() => document.querySelector('[data-outcome="done"]').click());
  await page.waitForTimeout(100);

  const after = await page.evaluate(async key => window.ClovePrivateStore.get(key, null), STORAGE_KEY);
  assert.equal(after.status, 'committed');
  assert.equal(after.outcome, undefined);
  assert.equal(await page.locator('#debriefSuccess').isVisible(), false);
  assert.equal(signals.some(s => s.event === 'mission_done'), false);
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

test('programmatic oversized mission text is rejected before persistence', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();

  await page.goto(url);
  await page.locator('[data-class="fix"]').click();
  await page.locator('#commit').waitFor({ state: 'visible' });
  await page.evaluate(() => {
    document.querySelector('#missionAction').value = 'X'.repeat(501);
    document.querySelector('#doneWhen').value = 'Observable result';
    document.querySelector('#duration').value = 'under30';
    document.querySelector('#firstAction').value = 'Get a hand tool';
    document.querySelector('#safetyCheck').checked = true;
    document.querySelector('#commitForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(100);

  assert.equal(await page.locator('#locked').isVisible(), false);
  const stored = await page.evaluate(async key => window.ClovePrivateStore.get(key, null), STORAGE_KEY);
  assert.equal(stored.status, 'planning');
});
