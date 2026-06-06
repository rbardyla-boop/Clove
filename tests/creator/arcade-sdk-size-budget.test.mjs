/**
 * Creator Foundation CF-1 — arcade SDK template + size-budget tests.
 *   node --test tests/creator/*.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateArcadePackage } from '../../arcade/creator/validator/validate-arcade-package.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TPL = join(ROOT, 'arcade/creator/arcade-sdk/package-template');

function totalBytes(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    if (name === 'README.md' || name.endsWith('.receipt.json')) continue;
    const p = join(dir, name); const st = statSync(p);
    n += st.isDirectory() ? totalBytes(p) : st.size;
  }
  return n;
}

test('template manifest is a valid arcade package', () => {
  const manifest = JSON.parse(readFileSync(join(TPL, 'manifest.json'), 'utf8'));
  const r = validateArcadePackage(manifest);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.package_kind, 'arcade_game');
});

test('template package stays under its declared size budget', () => {
  const manifest = JSON.parse(readFileSync(join(TPL, 'manifest.json'), 'utf8'));
  const bytes = totalBytes(TPL);
  assert.ok(bytes <= manifest.size_budget_bytes, `template ${bytes}B exceeds budget ${manifest.size_budget_bytes}B`);
});

test('template requests no capabilities and bundles no assets', () => {
  const manifest = JSON.parse(readFileSync(join(TPL, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.capabilities, []);
  assert.deepEqual(manifest.assets, []);
});
