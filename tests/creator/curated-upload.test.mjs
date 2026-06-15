/**
 * Creator Foundation CF-2 — curated client-upload exclusion tests.
 *   node --test tests/creator/*.test.mjs
 *
 * Proves the production static-upload tree EXCLUDES creator tooling / tests / docs / workers /
 * secrets and INCLUDES the live client (arcade/city, root pages, vendored libs). Predicate tests are
 * deterministic; the real-repo tests run `git ls-files` (no copy).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isExcludedFromUpload, curatedUploadFileList,
} from '../../scripts/build-curated-client-upload.mjs';

test('excludes arcade/creator tooling', () => {
  assert.equal(isExcludedFromUpload('arcade/creator/block-editor/index.html'), true);
  assert.equal(isExcludedFromUpload('arcade/creator/approval/approved-loader.mjs'), true);
  assert.equal(isExcludedFromUpload('arcade/creator'), true);
});

test('excludes tests / docs / workers / electron / .claude / .powerplant / .github', () => {
  for (const p of [
    'tests/creator/x.test.mjs',
    'docs/CREATOR_FOUNDATION_CF2_APPROVED_LOADER.md',
    'workers/arcade/src/index.ts',
    'electron-app/main.js',
    '.claude/rules/engineering.md',
    '.powerplant/config.json',
    '.github/workflows/ci.yml',
  ]) assert.equal(isExcludedFromUpload(p), true, p);
});

test('excludes secrets and VCS (.env / .git / node_modules / dist / dev manifests)', () => {
  for (const p of [
    '.env', '.env.production', '.env.local',
    '.git/config', 'node_modules/x/index.js', 'dist/bundle.js',
    '.gitignore', 'package.json', 'package-lock.json',
  ]) assert.equal(isExcludedFromUpload(p), true, p);
});

test('includes the live client (arcade/city, root pages, fonts, vendored libs)', () => {
  for (const p of [
    'arcade/city/index.html',
    'arcade/city/city-render-three.js',
    'index.html',
    'arcade/index.html',
    'fonts/chakra.woff2',
    'scripts/three.min.js',
  ]) assert.equal(isExcludedFromUpload(p), false, p);
});

test('excludes the local dev workshop + staging bundlers but keeps runtime vendored libs in scripts/', () => {
  // Dev tooling must not ride along in the public payload (scripts/ is NOT a denied prefix, so each
  // local-only assembler must be individually denylisted or it silently leaks into the upload)...
  assert.equal(isExcludedFromUpload('scripts/build-creator-workshop-bundle.mjs'), true);
  assert.equal(isExcludedFromUpload('scripts/build-creator-editor-staging.mjs'), true);
  assert.equal(isExcludedFromUpload('scripts/build-creator-editor-production-release.mjs'), true);
  // ...while the runtime vendored libs the shipped pages load from /scripts/ MUST still ship.
  for (const p of ['scripts/three.min.js', 'scripts/pdf.min.js', 'scripts/pdf.worker.min.js',
    'scripts/tesseract.min.js', 'scripts/tesseract-worker.min.js']) {
    assert.equal(isExcludedFromUpload(p), false, p);
  }
});

test('excludes the standalone arcade-studio creator app (predicate + real repo)', () => {
  // arcade-studio is a local/data-only Vite creator tool — its source must NEVER reach clovelearn.io.
  for (const p of [
    'arcade-studio/src/main.js',
    'arcade-studio/index.html',
    'arcade-studio/package.json',
    'arcade-studio/package-lock.json',
    'arcade-studio/vite.config.js',
    'arcade-studio/test/grid.test.mjs',
    'arcade-studio/scripts/smoke-headless.mjs',
  ]) assert.equal(isExcludedFromUpload(p), true, p);
  // and once it is git-tracked, none of it survives into the real curated upload set.
  const { included, excluded } = curatedUploadFileList();
  assert.equal(included.some((f) => f.startsWith('arcade-studio/')), false, 'arcade-studio must not be uploaded');
  assert.ok(excluded.some((f) => f.startsWith('arcade-studio/')), 'arcade-studio should be in the excluded set');
});

test('real repo: arcade/creator EXCLUDED, arcade/city INCLUDED, root index INCLUDED', () => {
  const { included, excluded } = curatedUploadFileList();
  assert.ok(included.length > 0, 'expected a non-empty upload set');
  assert.equal(included.some((f) => f.startsWith('arcade/creator/')), false, 'creator tooling must not be uploaded');
  assert.ok(excluded.some((f) => f.startsWith('arcade/creator/')), 'creator tooling should be in the excluded set');
  assert.ok(included.some((f) => f.startsWith('arcade/city/')), 'the live city must be uploaded');
  assert.ok(included.includes('index.html'), 'the root index.html must be uploaded');
});

test('real repo: ADR-043 curated starter statics SHIP (and the writer tool does not)', () => {
  const { included, excluded } = curatedUploadFileList();
  assert.ok(included.includes('arcade/cabinets/starters/curated-floor.mjs'), 'the curated manifest must ship');
  assert.ok(included.includes('arcade/cabinets/starters/starter-host.mjs'), 'the shared host must ship');
  assert.ok(included.some((f) => /^arcade\/cabinets\/starters\/[a-z-]+\/game\.mjs$/.test(f)), 'per-starter statics must ship');
  assert.ok(excluded.includes('arcade/creator/arcade-builder/write-starter-statics.mjs'), 'the author-time writer stays excluded');
  assert.ok(included.length < 990, `upload count ${included.length} keeps headroom under the 1000-file host cap`);
});

test('real repo: NO forbidden path survives into the curated upload list', () => {
  const { included } = curatedUploadFileList();
  for (const f of included) assert.equal(isExcludedFromUpload(f), false, `leaked into upload: ${f}`);
});
