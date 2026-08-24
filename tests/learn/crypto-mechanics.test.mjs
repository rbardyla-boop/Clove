import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pagePath = path.join(root, 'learn/crypto/index.html');
const scriptPath = path.join(root, 'learn/crypto/crypto.js');
const stylePath = path.join(root, 'learn/crypto/crypto.css');
const baseUrl = 'http://127.0.0.1:8766';
let server;

const requiredSources = [
  'https://www.iso20022.org/about-iso-20022',
  'https://www.iso20022.org/frequently-asked-questions',
  'https://www.swift.com/news-events/news/iso-20022-new-era-global-payments',
  'https://www.frbservices.org/news/press-releases/071525-iso20022-migration-announcement',
  'https://www.payments.ca/payment-resources/iso-20022',
  'https://www.payments.ca/payment-resources/iso-20022/high-value-payment-system-lynx',
  'https://www.bis.org/about/bisih/topics/fmis/agora.htm',
  'https://www.bis.org/publ/othp110.htm',
  'https://www.bankofcanada.ca/2026/05/bank-canada-joins-bis-project-agora-test-improvements-wholesale-cross-border-payments/',
  'https://www.bankofcanada.ca/2026/06/sparks-at-bank-article-2026-14/',
  'https://www.canada.ca/en/financial-consumer-agency/services/payment/digital-currency.html',
];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

before(async () => {
  server = spawn('python3', ['-m', 'http.server', '8766', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  await new Promise((resolve) => setTimeout(resolve, 120));
});

after(() => server?.kill());

test('crypto page has no prohibited wallet, trading, or network integration surface', () => {
  const html = read(pagePath);
  const script = read(scriptPath);
  const css = read(stylePath);
  const runtimeForbidden = /\b(fetch|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|indexedDB)\b|walletconnect|ethers|web3|coinbase|binance|kraken|coingecko|signTransaction|sendTransaction|privateKey|seedPhrase|referral|affiliate/gi;
  const scriptTags = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);

  assert.deepEqual(scriptTags, ['/learn/crypto/crypto.js']);
  assert.equal(runtimeForbidden.test(script), false, 'interactive runtime contains a prohibited integration token');
  assert.equal(/<iframe\b/i.test(html), false);
  assert.equal(/https?:\/\/[^"']+\.js/i.test(html), false);
  assert.equal(/@media\s*\(prefers-reduced-motion:\s*reduce\)/i.test(css), true);
  assert.equal(/\.button:focus|:focus-visible/i.test(css), true);
  assert.equal(/local only|fictional/i.test(html), true);
});

test('crypto page contains the complete reference contract and official source anchors', () => {
  const html = read(pagePath);
  for (const id of ['start', 'machinery', 'hash-lab', 'break-chain', 'press-send', 'networks', 'security', 'trust-map', 'iso-20022', 'message-explorer', 'tokenisation-demo', 'glossary']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing section ${id}`);
  }
  for (const source of requiredSources) assert.match(html, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /There is no magic “ISO 20022 coin list/);
  assert.match(html, /The Town With No Town Hall/);
  assert.match(html, /wallet is a keyring/);
  assert.match(html, /Not my department/);
  assert.match(html, /Dad’s Crypto Test/);
  assert.match(html, /MESSAGE ≠ MONEY/);
  for (const sourceGroup of ['BITCOIN', 'ETHEREUM', 'ISO 20022 \/ PAYMENTS', 'TOKENISATION \/ CENTRAL BANKS', 'REGULATORY \/ SAFETY', 'CURRENT STATE \/ EXAMPLES']) {
    assert.match(html, new RegExp(sourceGroup));
  }
  assert.match(html, /EMERGING \/ PILOT/);
  assert.match(html, /CONCEPTUAL EDUCATIONAL MODEL — NOT A LIVE PAYMENT SYSTEM/);
  assert.match(html, /No price charts/);
  assert.match(html, /Every transaction, wallet, address, balance, and token used in a demo is fictional/);
});

test('required official source links resolve', async () => {
  for (const source of requiredSources) {
    const response = await fetch(source, { redirect: 'follow' });
    assert.ok(response.status >= 200 && response.status < 400, `${source} returned ${response.status}`);
  }
});

test('browser smoke test covers local demos, keyboard labels, privacy, and mobile layout', async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.setOffline(false);
  const page = await context.newPage();
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${baseUrl}/learn/crypto/`);
  assert.match(await page.title(), /Crypto Mechanics: Without the Casino/);
  assert.equal(await page.locator('h1').count(), 1);
  assert.equal(await page.locator('h2').count() > 0, true);
  assert.equal(await page.locator('input, textarea').count(), 5);
  assert.equal(await page.locator('button').evaluateAll((buttons) => buttons.every((button) => (button.textContent || '').trim() || button.getAttribute('aria-label'))), true);
  assert.equal(await page.locator('html').evaluate((element) => element.scrollWidth <= window.innerWidth + 1), true, 'mobile page overflows horizontally');
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  assert.equal(requests.some((url) => !url.startsWith(baseUrl)), false, 'page requested a third-party resource');
  await page.locator('#hash-input').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'hash-run');

  await page.locator('#hash-input').fill('DOGBALLT');
  await page.locator('#hash-run').click();
  assert.match(await page.locator('#hash-original').textContent(), /^[0-9a-f]{64}$/);
  assert.match(await page.locator('#hash-altered').textContent(), /^[0-9a-f]{64}$/);

  await page.locator('#block-data-0').fill('Fictional deed: Ada changes the first page.');
  await page.locator('#block-data-0').press('Tab');
  assert.match(await page.locator('#chain-note').textContent(), /invalidated/);
  assert.equal(await page.locator('.block-card.is-invalid').count(), 3);

  await page.locator('[data-network="ethereum"]').click();
  assert.match(await page.locator('#send-note').textContent(), /Ethereum-shaped/);
  await page.locator('[data-trust="bridge"]').click();
  assert.match(await page.locator('#trust-detail').textContent(), /Bridge/);
  await page.locator('#payment-sentence').fill('Send Cora 12 town tokens for the fictional receipt');
  await page.locator('#message-run').click();
  assert.match(await page.locator('#message-json').textContent(), /simplified-payment-instruction/);
  await page.locator('[data-settlement="atomic"]').click();
  assert.equal(await page.locator('.settlement-step.is-atomic').count(), 5);

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktop = await desktopContext.newPage();
  await desktop.goto(`${baseUrl}/learn/crypto/`);
  assert.equal(await desktop.locator('html').evaluate((element) => element.scrollWidth <= window.innerWidth + 1), true, 'desktop page overflows horizontally');
  assert.equal(await desktop.locator('.story-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.includes(' ')), true);
  await desktop.close();
  await desktopContext.close();

  const noJsContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const noJs = await noJsContext.newPage();
  await noJs.goto(`${baseUrl}/learn/crypto/`);
  assert.equal(await noJs.locator('h1').count(), 1);
  assert.match(await noJs.locator('#start').textContent(), /The Town With No Town Hall/);
  assert.match(await noJs.locator('#iso-20022').textContent(), /MESSAGE ≠ MONEY/);
  assert.match(await noJs.locator('#glossary').textContent(), /Primary sources and bounded evidence/);
  await noJsContext.close();

  await browser.close();
});
