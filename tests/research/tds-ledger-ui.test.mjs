import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let server;
const port = 8766;
const baseUrl = `http://127.0.0.1:${port}`;

before(async () => {
  server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  await new Promise((resolve) => setTimeout(resolve, 150));
});

after(() => server?.kill());

test('public TDS ledger routes render the frozen claims and boundaries', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const routes = [
    ['/research/projects/tds/ledger/', 'TDS PUBLIC PROOF LEDGER'],
    ['/research/projects/tds/ledger/claims/', 'The claims.'],
    ['/research/projects/tds/ledger/dossiers/', 'The dossiers.'],
    ['/research/projects/tds/ledger/killed/', 'The claims we killed.'],
    ['/research/projects/tds/ledger/sources/', 'The receipts.'],
  ];
  for (const [route, heading] of routes) {
    await page.goto(`${baseUrl}${route}`);
    await page.locator('main h1').waitFor();
    assert.equal(await page.locator('main h1').count(), 1);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.match(await page.locator('main').textContent(), new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(await page.locator('script[src]').evaluateAll((nodes) => nodes.every((node) => new URL(node.src).pathname.startsWith('/research/'))), true);
  }

  await page.goto(`${baseUrl}/research/projects/tds/ledger/claims/`);
  await page.locator('.claim-card').first().waitFor();
  assert.equal(await page.locator('.claim-card').count(), 93);
  await page.locator('select').selectOption('HOLD');
  assert.equal(await page.locator('.claim-card').count(), 2);
  assert.match(await page.locator('.claim-card').allTextContents().then((items) => items.join('\n')), /EC-046/);
  assert.match(await page.locator('.claim-card').allTextContents().then((items) => items.join('\n')), /REPORTED \/ UNKNOWN CAUSATION/);

  await page.goto(`${baseUrl}/research/projects/tds/ledger/dossiers/`);
  await page.locator('.dossier-card').first().waitFor();
  assert.equal(await page.locator('.dossier-card').count(), 12);

  await page.goto(`${baseUrl}/research/projects/tds/ledger/killed/`);
  await page.locator('.killed-card').first().waitFor();
  assert.equal(await page.locator('.killed-card').count(), 66);

  await page.goto(`${baseUrl}/research/projects/tds/ledger/sources/`);
  await page.locator('.source-card').first().waitFor();
  assert.ok(await page.locator('.source-card').count() >= 90);

  const html = await page.content();
  assert.doesNotMatch(html, /google-analytics|gtag\(|__clove\/signal|sign\s*in\s*required|donate\s+to\s+view/i);
  await browser.close();
});
