import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const required = [
  ['Home', '/'],
  ['Learn', '/learn/'],
  ['Research', '/research/'],
  ['Stewardship', '/digital-stewardship.html'],
  ['Temperance', '/temperance.html'],
];
const targetPages = [
  ['/', 'index.html', 'Home'],
  ['/learn/', 'learn/index.html', 'Learn'],
  ['/learn/crypto/', 'learn/crypto/index.html', 'Learn'],
  ['/research/', 'research/index.html', 'Research'],
  ['/research/projects/', 'research/projects/index.html', 'Research'],
  ['/research/projects/tds/', 'research/projects/tds/index.html', 'Research'],
  ['/digital-stewardship.html', 'digital-stewardship.html', 'Stewardship'],
  ['/temperance.html', 'temperance.html', 'Temperance'],
];
let server;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function navBlock(html) {
  const match = html.match(/<nav aria-label="Primary navigation">([\s\S]*?)<\/nav>/);
  assert.ok(match, 'primary navigation is missing');
  return match[1];
}

function hrefFor(block, label) {
  const match = block.match(new RegExp(`<a href="([^"]+)"[^>]*>${label}<\\/a>`));
  assert.ok(match, `${label} link is missing from primary navigation`);
  return match[1];
}

test('major public pages carry the same required primary navigation and active state', () => {
  for (const [, file, active] of targetPages) {
    const html = read(file);
    const nav = navBlock(html);
    for (const [label, href] of required) assert.equal(hrefFor(nav, label), href, `${file}: ${label} href`);
    const activeLink = new RegExp(`<a href="[^"]+" aria-current="page">${active}<\\/a>`);
    assert.match(nav, activeLink, `${file}: ${active} active state`);
  }
});

test('primary navigation destinations exist and the public landing routes are real files', () => {
  for (const [, href] of required) {
    const rel = href === '/' ? 'index.html' : `${href.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
    const fallback = href.endsWith('.html') ? href.slice(1) : rel;
    assert.equal(fs.existsSync(path.join(root, rel)) || fs.existsSync(path.join(root, fallback)), true, `${href} has no local destination`);
  }
});

test('primary navigation remains visible and non-overflowing at required mobile widths', async () => {
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '').replace(/\/$/, '') + (pathname.endsWith('/') ? '/index.html' : '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file)) { response.writeHead(404); response.end('not found'); return; }
    response.writeHead(200, { 'content-type': file.endsWith('.css') ? 'text/css' : 'text/html' });
    response.end(fs.readFileSync(file));
  }).listen(8771, '127.0.0.1');

  const browser = await chromium.launch({ headless: true });
  try {
    for (const [route] of targetPages) {
      for (const width of [320, 375, 390, 430]) {
        const context = await browser.newContext({ viewport: { width, height: 844 } });
        const page = await context.newPage();
        const response = await page.goto(`http://127.0.0.1:8771${route}`, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200, `${route} returned ${response.status()}`);
        const primary = page.locator('nav[aria-label="Primary navigation"]');
        assert.equal(await primary.count(), 1, `${route} primary nav count`);
        for (const [label] of required) assert.equal(await primary.getByRole('link', { name: label, exact: true }).isVisible(), true, `${route} ${label} hidden at ${width}px`);
        assert.equal(await page.locator('html').evaluate((element) => element.scrollWidth <= window.innerWidth + 1), true, `${route} overflows at ${width}px`);
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    server = undefined;
  }
});

after(() => server?.close());
