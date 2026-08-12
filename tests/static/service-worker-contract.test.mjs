import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sw = await readFile(new URL('../../sw.js', import.meta.url), 'utf8');

test('service worker cache version is bumped for the narrowed policy', () => {
  assert.match(sw, /const CACHE_NAME = 'operators-deck-v55';/);
});

test('cache interception is bounded to an explicit path allowlist', () => {
  assert.match(sw, /const STATIC_ASSET_PATHS = new Set\(STATIC_ASSETS\);/);
  assert.match(sw, /if \(!STATIC_ASSET_PATHS\.has\(pathname\)\) return;/);
});

test('mutable Mission 001 runtime is not pinned in the service-worker allowlist', () => {
  assert.doesNotMatch(sw, /['"]\/mission-001\.html['"]/);
  assert.doesNotMatch(sw, /['"]\/mission-001-app\.js['"]/);
  assert.doesNotMatch(sw, /['"]\/mission-private-store\.js['"]/);
});

test('navigation and cross-origin requests are not intercepted', () => {
  assert.match(sw, /if \(request\.mode === 'navigate'\) return;/);
  assert.match(sw, /if \(!url\.startsWith\(self\.location\.origin\)\) return;/);
});

test('allowlisted assets are network-first with cache only as failure fallback', () => {
  const fetchAt = sw.indexOf("fetch(request, { redirect: 'follow' })");
  const fallbackAt = sw.indexOf('const cached = await caches.match(request);');
  assert.ok(fetchAt >= 0, 'network fetch must exist in the fetch handler');
  assert.ok(fallbackAt > fetchAt, 'cache lookup must occur only after network failure');
  assert.doesNotMatch(sw, /caches\.match\(request\)\.then\(\(cached\) => \{\s*if \(cached\) return cached;/s);
});
