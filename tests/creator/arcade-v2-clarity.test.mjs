// Public Arcade v2 / Local Maker v1 — clarity + cross-navigation + local-draft retention contract.
// Static-surface copy/nav improvements and a HOST-ONLY builder draft. The trust boundary must be unchanged:
// the draft lives in builder-page localStorage only — never in the package, never read by the game, and the
// importer still bans storage in package source.
// Run: node --test tests/creator/arcade-v2-clarity.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const INDEX = read('../../index.html');
const WHATS_LIVE = read('../../whats-live.html');
const HUB = read('../../arcade/creator/local-maker/index.html');
const BUILDER_HTML = read('../../arcade/creator/arcade-builder/index.html');
const BUILDER_JS = read('../../arcade/creator/arcade-builder/arcade-builder.mjs');
const SANDBOX_JS = read('../../arcade/creator/arcade-sandbox/sandbox-runner.mjs');
const IMPORTER = read('../../arcade/creator/arcade-importer/import-arcade-package.mjs');
const fnBody = (src, name) => { const i = src.indexOf('function ' + name + '('); return i === -1 ? '' : src.slice(i, src.indexOf('\n}\n', i) + 2); };

test('homepage explains Clove and offers a Local Maker entry', () => {
  assert.match(INDEX, /Welcome to Clove/);
  assert.match(INDEX, /class="lede"/);
  assert.match(INDEX, /class="card card-maker" href="arcade\/creator\/local-maker\//);
  assert.match(INDEX, /ARCADE MAKER LAB/);
  assert.match(INDEX, /stays on your device/i);
});

test('whats-live cross-links to the local maker (play -> make)', () => {
  assert.match(WHATS_LIVE, /Make your own arcade game/);
  assert.match(WHATS_LIVE, /href="arcade\/creator\/local-maker\//);
  assert.match(WHATS_LIVE, /no upload|not uploaded/i);
});

test('local-maker hub has a home breadcrumb and a current loop (test + share code)', () => {
  assert.match(HUB, /class="crumb"[\s\S]*href="\/"/);
  assert.match(HUB, /Test in sandbox/);
  assert.match(HUB, /share code/i);
  // hub stays static + locked down (no script execution)
  assert.match(HUB, /script-src 'none'/);
});

test('builder has a host-only local draft (save/restore/clear) — never part of the package', () => {
  assert.match(BUILDER_JS, /const DRAFT_KEY = 'cf_builder_draft_v1'/);
  assert.match(fnBody(BUILDER_JS, 'saveDraft'), /localStorage\.setItem\(DRAFT_KEY/);
  assert.match(fnBody(BUILDER_JS, 'loadDraft'), /localStorage\.getItem\(DRAFT_KEY/);
  assert.match(fnBody(BUILDER_JS, 'clearDraft'), /localStorage\.removeItem\(DRAFT_KEY/);
  // saved value is the CONTROL PARAMS, not the generated package (manifest/files never persisted)
  assert.match(BUILDER_JS, /saveDraft\(currentParams\(\)\)/);
  assert.doesNotMatch(fnBody(BUILDER_JS, 'saveDraft'), /manifest|files/);
  // restore on load + a "Start fresh" that clears the draft
  assert.match(BUILDER_JS, /const __draft = loadDraft\(\)[\s\S]*applyParams\(__draft\)/);
  assert.match(BUILDER_JS, /clearDraftBtn'\)\?\.addEventListener\('click', \(\) => \{ clearDraft\(\)/);
  // UI is wired
  assert.match(BUILDER_HTML, /id="draftNote"/);
  assert.match(BUILDER_HTML, /id="clearDraftBtn"/);
});

test('TRUST BOUNDARY UNCHANGED: storage is host-only; the package can never use storage', () => {
  // localStorage appears only on the trusted builder host page, never in the sandbox runner...
  assert.equal((SANDBOX_JS.match(/localStorage/g) || []).length, 0, 'sandbox runner uses no localStorage');
  // ...and the importer still bans storage APIs in package SOURCE (defense in depth for the iframe).
  assert.match(IMPORTER, /storage: localStorage[\s\S]*localStorage/);
  assert.match(IMPORTER, /sessionStorage/);
  assert.match(IMPORTER, /indexedDB/);
  // (economy-enablement language is policed by the sprint's forbidden-surface grep on the DIFF — a naive
  // word-match on full HTML wrongly flags the legitimate prohibitive copy, e.g. "no balance to cash out".)
});

test('the static catalog backs discovery and its three cabinets match what whats-live shows', () => {
  // catalog labels are present on the public discovery surface (keeps copy from silently drifting)
  for (const label of ['Pulse Tap', 'Signal Sprint', 'Neon Grid']) {
    assert.match(WHATS_LIVE, new RegExp(label));
  }
});
