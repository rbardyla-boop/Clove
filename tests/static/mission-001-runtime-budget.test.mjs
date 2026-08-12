import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const files = ['mission-001.html', 'mission-001-app.js', 'mission-private-store.js'];
const root = new URL('../../', import.meta.url);

async function bytes(name) {
  return (await stat(new URL(name, root))).size;
}

const html = await readFile(new URL('mission-001.html', root), 'utf8');
const app = await readFile(new URL('mission-001-app.js', root), 'utf8');
const store = await readFile(new URL('mission-private-store.js', root), 'utf8');

test('Mission 001 first-load runtime remains under 100 KiB uncompressed', async () => {
  const sizes = Object.fromEntries(await Promise.all(files.map(async name => [name, await bytes(name)])));
  const total = Object.values(sizes).reduce((sum, size) => sum + size, 0);
  assert.ok(total <= 100 * 1024, `Mission runtime grew to ${total} bytes: ${JSON.stringify(sizes)}`);
});

test('Mission 001 loads exactly two first-party runtime scripts', () => {
  const srcs = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(match => match[1]);
  assert.deepEqual(srcs, ['mission-private-store.js', 'mission-001-app.js']);
  for (const src of srcs) {
    assert.equal(/^https?:\/\//i.test(src), false, `third-party script dependency: ${src}`);
    assert.equal(src.startsWith('//'), false, `protocol-relative script dependency: ${src}`);
  }
});

test('Mission runtime has no CDN/import/network code-loading dependency', () => {
  const combined = `${app}\n${store}`;
  assert.doesNotMatch(combined, /\bimport\s*\(/, 'dynamic JavaScript import introduced');
  assert.doesNotMatch(combined, /https?:\/\//i, 'absolute network dependency introduced');
  assert.doesNotMatch(combined, /cdn\.|unpkg|jsdelivr|cdnjs/i, 'CDN dependency introduced');
});

test('Mission network writes remain restricted to the first-party coarse signal endpoint', () => {
  assert.match(app, /['"]\/__clove\/signal['"]/);
  const fetchTargets = [...app.matchAll(/fetch\(\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert.deepEqual([...new Set(fetchTargets)], ['/__clove/signal']);
  assert.doesNotMatch(store, /\bfetch\s*\(/);
  assert.doesNotMatch(store, /sendBeacon\s*\(/);
});
