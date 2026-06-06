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

test('real repo: arcade/creator EXCLUDED, arcade/city INCLUDED, root index INCLUDED', () => {
  const { included, excluded } = curatedUploadFileList();
  assert.ok(included.length > 0, 'expected a non-empty upload set');
  assert.equal(included.some((f) => f.startsWith('arcade/creator/')), false, 'creator tooling must not be uploaded');
  assert.ok(excluded.some((f) => f.startsWith('arcade/creator/')), 'creator tooling should be in the excluded set');
  assert.ok(included.some((f) => f.startsWith('arcade/city/')), 'the live city must be uploaded');
  assert.ok(included.includes('index.html'), 'the root index.html must be uploaded');
});

test('real repo: NO forbidden path survives into the curated upload list', () => {
  const { included } = curatedUploadFileList();
  for (const f of included) assert.equal(isExcludedFromUpload(f), false, `leaked into upload: ${f}`);
});
