/**
 * Creator Corner public beta — static/local workshop bundle tests.
 *   node --test tests/creator/creator-workshop-bundle.test.mjs
 *
 * Proves the workshop bundle is (1) SAFE — no CF-7 live loader / moderation / non-workshop surface,
 * CF-2 loader kill-switch false; and (2) SELF-CONTAINED — every relative import/script/link and the
 * sandbox's fetched sample resolve to a file inside the bundle, so it serves standalone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { posix } from 'node:path';
import {
  workshopFileList, isForbiddenInBundle, isDeniedWorkshopFile, WORKSHOP_FILE_DENY,
} from '../../scripts/build-creator-workshop-bundle.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const included = workshopFileList(ROOT);
const inSet = new Set(included);

test('forbidden surfaces are recognized by the guard predicate', () => {
  for (const p of [
    'arcade/creator/approval/live-loader.mjs',
    'arcade/creator/approval/live-registry.mjs',
    'arcade/creator/approval/live-approval-receipt.mjs',
    'arcade/creator/moderation/review-queue.mjs',
    'arcade/creator/district-editor/district-editor.mjs',
    'arcade/creator/map-viewer/map-viewer.mjs',
    'arcade/creator/hive-validation/hive-cli.mjs',
    'arcade/creator/arcade-sdk/size-budget.mjs',
    'arcade/creator/arcade-builder/write-starter-statics.mjs',
    'arcade/creator/validator/validate-package.mjs',
    'arcade/creator/schemas/asset-pack-schema.mjs',
  ]) assert.equal(isForbiddenInBundle(p), true, p);
});

test('node-only / non-workshop files are denied from allowlisted dirs', () => {
  for (const f of WORKSHOP_FILE_DENY) assert.equal(isDeniedWorkshopFile(f), true, f);
  assert.equal(isDeniedWorkshopFile('arcade-builder/arcade-builder.mjs'), false);
});

test('bundle contains the hub + four tools + shared deps + sandbox sample', () => {
  for (const need of [
    'arcade/creator/creator-corner/index.html',
    'arcade/creator/arcade-builder/index.html',
    'arcade/creator/arcade-builder/rule-graph-templates.mjs',
    'arcade/creator/arcade-sandbox/sandbox-runner.mjs',
    'arcade/creator/block-editor/approved-preview.mjs',
    'arcade/creator/layered-editor/layered-editor.mjs',
    'arcade/creator/arcade-importer/import-arcade-package.mjs',
    'arcade/creator/approval/approved-loader.mjs',
    'arcade/creator/samples/arcade-sample/manifest.json',
    'arcade/creator/samples/arcade-sample/game.mjs',
    'arcade/creator/samples/arcade-sample/adapter.mjs',
  ]) assert.ok(inSet.has(need), `missing from bundle: ${need}`);
});

test('NO forbidden surface survives into the bundle file set', () => {
  const leaked = included.filter(isForbiddenInBundle);
  assert.deepEqual(leaked, [], `forbidden in bundle: ${leaked.join(', ')}`);
  // the CF-7 live loader specifically must be absent
  assert.equal(included.some((p) => /live-loader|live-registry|live-approval/.test(p)), false);
});

test('the bundled CF-2 loader keeps LIVE_WORLD_LOADER_ENABLED = false', () => {
  const loader = 'arcade/creator/approval/approved-loader.mjs';
  assert.ok(inSet.has(loader));
  const src = readFileSync(new URL(`../../${loader}`, import.meta.url), 'utf8');
  assert.match(src, /export\s+const\s+LIVE_WORLD_LOADER_ENABLED\s*=\s*false\s*;/);
});

test('bundle is SELF-CONTAINED: every relative import/script/link resolves inside the bundle', () => {
  const refOf = (src, ext) => {
    const refs = [];
    let m;
    if (ext === 'mjs' || ext === 'js') {
      // Match only REAL top-level import statements (line-anchored on the `import` keyword), so
      // `from './x'` appearing inside string literals / comments / regexes is not mistaken for an import.
      const from = /^\s*import\b[^\n]*?\bfrom\s*['"]([^'"]+)['"]/gm;
      while ((m = from.exec(src))) refs.push(m[1]);
      const side = /^\s*import\s*['"]([^'"]+)['"]/gm;
      while ((m = side.exec(src))) refs.push(m[1]);
    } else if (ext === 'html') {
      const tag = /(?:src|href)\s*=\s*"([^"]+)"/g;
      while ((m = tag.exec(src))) refs.push(m[1]);
    } else if (ext === 'css') {
      const url = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
      while ((m = url.exec(src))) refs.push(m[1]);
    }
    return refs;
  };
  const dangling = [];
  let checked = 0;
  for (const rel of included) {
    const ext = rel.split('.').pop();
    if (!['mjs', 'js', 'html', 'css'].includes(ext)) continue;
    const src = readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
    for (const ref of refOf(src, ext)) {
      if (/^(node:|https?:|wss?:|data:|mailto:|#)/.test(ref)) continue; // external / non-file
      // Absolute/bare specifiers are external to the bundle — including the hub's production-path link to the
      // Arcade Studio static editor ("/arcade-studio/"), which is deployed separately and never bundled here.
      if (!ref.startsWith('./') && !ref.startsWith('../')) continue;
      checked++;
      let target = posix.normalize(posix.join(posix.dirname(rel), ref));
      if (target.endsWith('/')) target += 'index.html';                 // directory link → its index
      else if (!posix.basename(target).includes('.')) target += '/index.html';
      if (!inSet.has(target)) dangling.push(`${rel}  ->  ${ref}  (${target})`);
    }
  }
  assert.deepEqual(dangling, [], `dangling references not in bundle:\n  ${dangling.join('\n  ')}`);
  // Guard against a vacuous pass: the workshop has many real cross-file imports + the hub's 4 tool links.
  assert.ok(checked >= 15, `self-containment check resolved only ${checked} refs — extractor likely broke`);
});
