import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const headers = await readFile(new URL('../../_headers', import.meta.url), 'utf8');

test('unversioned production assets are not marked immutable', () => {
  assert.doesNotMatch(headers, /\bimmutable\b/i);
  assert.match(headers, /\/\*\s+[\s\S]*?Cache-Control: public, max-age=0, must-revalidate/);
});

test('service worker is always refreshed', () => {
  assert.match(headers, /\/sw\.js\s+[\s\S]*?! Cache-Control\s+[\s\S]*?Cache-Control: no-cache, no-store, must-revalidate/);
});

test('Mission 001 HTML and mutable runtime scripts cannot be served stale', () => {
  for (const path of ['mission-001.html', 'mission-001-app.js', 'mission-private-store.js']) {
    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = new RegExp(`/${escaped}\\s+[\\s\\S]*?! Cache-Control\\s+[\\s\\S]*?Cache-Control: no-cache, no-store, must-revalidate`);
    assert.match(headers, block, `${path} must detach the global cache policy and use no-store`);
  }
});
