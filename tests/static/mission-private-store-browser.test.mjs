import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const storeJs = await readFile(new URL('../../mission-private-store.js', import.meta.url));
const harnessHtml = Buffer.from(`<!doctype html><meta charset="utf-8"><title>Mission store harness</title><script src="/mission-private-store.js"></script>`);
const STORAGE_KEY = 'clove_v2_mission_001';
const DB_NAME = 'clove_private_store_v1';

function startServer() {
  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/mission-private-store.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(storeJs);
      return;
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/harness.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(harnessHtml);
      return;
    }
    res.writeHead(404).end('not found');
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/harness.html` });
    });
  });
}

async function launchBrowser() {
  return chromium.launch({ headless: true, channel: 'chrome' });
}

async function deleteVaultDb(page) {
  await page.evaluate(async dbName => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.deleteDatabase(dbName);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('delete_failed'));
      req.onblocked = () => reject(new Error('delete_blocked'));
    });
  }, DB_NAME);
}

test('encrypted store round-trips data and keeps private text out of localStorage', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(url);

  const marker = 'PRIVATE-MISSION-MARKER-001';
  const value = { phase: 'committed', mission: `Repair bicycle ${marker}`, doneWhen: 'Shifts reliably' };
  await page.evaluate(async ({ key, value }) => window.ClovePrivateStore.set(key, value), { key: STORAGE_KEY, value });

  const result = await page.evaluate(async key => {
    const raw = localStorage.getItem(key);
    const roundTrip = await window.ClovePrivateStore.get(key);
    return { raw, roundTrip, encrypted: window.ClovePrivateStore.isEncryptedRaw(key) };
  }, STORAGE_KEY);

  assert.equal(result.encrypted, true);
  assert.match(result.raw, /^cloveenc:v1:/);
  assert.doesNotMatch(result.raw, /PRIVATE-MISSION-MARKER-001|Repair bicycle|Shifts reliably/);
  assert.deepEqual(result.roundTrip, value);
});

test('identical writes use fresh IVs and produce different ciphertext', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(url);

  const raws = await page.evaluate(async key => {
    const value = { mission: 'same plaintext', phase: 'committed' };
    await window.ClovePrivateStore.set(key, value);
    const first = localStorage.getItem(key);
    await window.ClovePrivateStore.set(key, value);
    const second = localStorage.getItem(key);
    return { first, second };
  }, STORAGE_KEY);

  assert.ok(raws.first?.startsWith('cloveenc:v1:'));
  assert.ok(raws.second?.startsWith('cloveenc:v1:'));
  assert.notEqual(raws.first, raws.second);
});

test('legacy plaintext migrates only after successful encryption', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(url);

  const marker = 'LEGACY-PRIVATE-MARKER';
  const value = { phase: 'away', mission: marker, nested: { prototype: 'discard-me' } };
  const result = await page.evaluate(async ({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    const before = localStorage.getItem(key);
    const read = await window.ClovePrivateStore.get(key);
    const after = localStorage.getItem(key);
    return { before, read, after };
  }, { key: STORAGE_KEY, value });

  assert.match(result.before, /LEGACY-PRIVATE-MARKER/);
  assert.match(result.after, /^cloveenc:v1:/);
  assert.doesNotMatch(result.after, /LEGACY-PRIVATE-MARKER/);
  assert.equal(result.read.mission, marker);
  assert.equal(Object.prototype.hasOwnProperty.call(result.read.nested, 'prototype'), false);
});

test('missing key makes old ciphertext unreadable without deleting it', async t => {
  const { server, url } = await startServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const browser = await launchBrowser();
  t.after(() => browser.close());
  const context = await browser.newContext();
  const first = await context.newPage();
  await first.goto(url);

  await first.evaluate(async key => {
    await window.ClovePrivateStore.set(key, { mission: 'must remain encrypted', phase: 'committed' });
  }, STORAGE_KEY);
  const ciphertext = await first.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
  assert.ok(ciphertext?.startsWith('cloveenc:v1:'));
  await first.close();

  const second = await context.newPage();
  await second.goto(url);
  await deleteVaultDb(second);
  const outcome = await second.evaluate(async key => {
    const before = localStorage.getItem(key);
    let error = null;
    try { await window.ClovePrivateStore.get(key); }
    catch (err) { error = String(err?.name || err?.message || err); }
    const after = localStorage.getItem(key);
    return { before, after, error };
  }, STORAGE_KEY);

  assert.equal(outcome.before, ciphertext);
  assert.equal(outcome.after, ciphertext);
  assert.ok(outcome.error, 'expected decrypt failure after key removal');
});
