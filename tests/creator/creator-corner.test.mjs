// Creator Corner static wrapper safety tests.
// Run: node --test tests/creator/creator-corner.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { isExcludedFromUpload, curatedUploadFileList } from '../../scripts/build-curated-client-upload.mjs';

const HTML = readFileSync(new URL('../../arcade/creator/creator-corner/index.html', import.meta.url), 'utf8');

test('Creator Corner exposes only approved local-workshop tool links', () => {
  const links = [...HTML.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(links, [
    '../arcade-builder/',
    '../arcade-sandbox/',
    '../block-editor/',
    '../layered-editor/',
  ].sort());
  assert.equal(/district-editor|map-viewer|approval|moderation|live-loader|review-cli/.test(HTML), false);
});

test('Creator Corner is static-only and blocks form/script/network surfaces', () => {
  assert.match(HTML, /script-src 'none'/);
  assert.match(HTML, /connect-src 'none'/);
  assert.match(HTML, /form-action 'none'/);
  assert.equal(/<script\b|<form\b|<input\b|<button\b|fetch\s*\(|WebSocket|EventSource/.test(HTML), false);
});

test('Creator Corner copy is local-only and has no affirmative publish/upload/live action', () => {
  assert.match(HTML, /Local workshop only/i);
  assert.match(HTML, /does not send anything to the live city/i);
  assert.match(HTML, /no Worker authority/i);
  assert.match(HTML, /no live floor loading/i);
  assert.match(HTML, /no value systems/i);
  assert.equal(/\b(go live|publish to live|submit to live|upload to live|enter the live world|live-world ready)\b/i.test(HTML), false);
  assert.equal(/\b(buy|sell|marketplace|own your|rent|payout|price|for sale|earn|cashout|wallet|crypto|nft)\b/i.test(HTML), false);
});

test('Creator Corner remains outside curated production upload', () => {
  assert.equal(isExcludedFromUpload('arcade/creator/creator-corner/index.html'), true);
  const { included } = curatedUploadFileList();
  assert.equal(included.includes('arcade/creator/creator-corner/index.html'), false);
  assert.equal(included.some((f) => f.startsWith('arcade/creator/')), false);
});
