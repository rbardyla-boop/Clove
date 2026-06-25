// Public local-maker hub safety tests (CR1B).
// The separate PUBLIC hub (distinct from the internal creator-corner) must link ONLY to the two safe
// local surfaces (Builder + Sandbox), stay static-only, carry the local-only boundary copy, and ship
// in the curated upload. Run: node --test tests/creator/local-maker-hub.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { isExcludedFromUpload, curatedUploadFileList } from '../../scripts/build-curated-client-upload.mjs';

const HTML = readFileSync(new URL('../../arcade/creator/local-maker/index.html', import.meta.url), 'utf8');

test('public maker hub links ONLY to the two local tools + safe public up-navigation', () => {
  // The hub may link to the two safe local tools (Builder + Sandbox) and UP to the public landing pages it
  // is reached from (home + whats-live) — nothing else. This stays a strict allowlist; the gated-surface
  // ban below is the real security guard and is unchanged. (v2: added home / whats-live breadcrumb.)
  const links = [...HTML.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const ALLOWED = new Set(['../arcade-builder/', '../arcade-sandbox/', '/', '/whats-live.html']);
  for (const l of links) assert.ok(ALLOWED.has(l), `unexpected hub link: ${l}`);
  assert.ok(links.includes('../arcade-builder/'), 'links to the builder');
  assert.ok(links.includes('../arcade-sandbox/'), 'links to the sandbox');
});

test('public maker hub never links to a gated / non-public creator tool', () => {
  assert.equal(
    /arcade-studio|block-editor|layered-editor|district-editor|map-viewer|approval|moderation|live-loader|hive-validation|creator-corner|review/i.test(HTML),
    false,
    'public hub must not reference any gated creator surface',
  );
});

test('public maker hub is static-only (no script/form/network execution surface)', () => {
  assert.match(HTML, /script-src 'none'/);
  assert.match(HTML, /connect-src 'none'/);
  assert.match(HTML, /form-action 'none'/);
  assert.match(HTML, /object-src 'none'/);
  assert.match(HTML, /base-uri 'none'/);
  assert.match(HTML, /frame-src 'none'/);
  assert.equal(/<script\b|<form\b|<input\b|<button\b|fetch\s*\(|WebSocket|EventSource/.test(HTML), false);
});

test('public maker hub copy states the local-only boundary and no value system', () => {
  assert.match(HTML, /local/i);
  assert.match(HTML, /no server upload/i);
  assert.match(HTML, /no live publishing/i);
  assert.match(HTML, /no tickets or rewards/i);
  assert.match(HTML, /no marketplace/i);
  assert.match(HTML, /export\s*\/\s*import files only/i);
  assert.match(HTML, /local playtests, not production arcade cabinets/i);
  // no affirmative live-publish / economy verbs
  assert.equal(/\b(go live|publish to live|submit to live|upload to live|enter the live world)\b/i.test(HTML), false);
  assert.equal(/\b(buy|sell|marketplace your|own your|payout|for sale|cashout|wallet|crypto|nft)\b/i.test(HTML), false);
});

test('public maker hub SHIPS in the curated upload (it is the public entry point)', () => {
  assert.equal(isExcludedFromUpload('arcade/creator/local-maker/index.html'), false);
  const { included } = curatedUploadFileList();
  assert.ok(included.includes('arcade/creator/local-maker/index.html'), 'the public maker hub must ship');
});
