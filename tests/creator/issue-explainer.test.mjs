// Creator throughput — validator issue explainer (explanatory only; the validators stay the gate).
// Run: node --test tests/creator/issue-explainer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { explainIssue, explainIssues, hintCopy } from '../../arcade/creator/validator/issue-explainer.mjs';
import { validateAssetPack } from '../../arcade/creator/validator/validate-asset-pack.mjs';
import { importArcadePackage } from '../../arcade/creator/arcade-importer/import-arcade-package.mjs';

test('known validator phrasings map to a non-empty hint', () => {
  for (const line of [
    'display_name contains a forbidden economy term',
    'pack_id must be a clean kebab slug (3..48, no economy terms)',
    'tiles[2].package_hash is not approved-local in the registry (approved hashes only)',
    'tiles[1] duplicate tile position (1,1)',
    'files (40000B) exceed declared size_budget_bytes (32768B)',
    "game.mjs: entry module must not import (found 'x')",
    "adapter.mjs: adapter may import only './game.mjs' (found 'y')",
    'game.mjs: forbidden (network)',
    'unexpected bundled file (assets must be empty): extra.mjs',
  ]) {
    assert.ok(explainIssue(line).length > 0, `hint for: ${line}`);
  }
});

test('unknown / empty / non-string error lines explain to "" (never throw, never invent)', () => {
  assert.equal(explainIssue('some totally novel validator message'), '');
  assert.equal(explainIssue(''), '');
  assert.equal(explainIssue(null), '');
  assert.equal(explainIssue(42), '');
});

test('explainIssues annotates a real BLOCKED asset-pack report end to end', () => {
  const report = validateAssetPack({ schema_version: 99, pack_kind: 'wrong' }, null);
  assert.ok(!report.ok && report.errors.length > 0);
  const annotated = explainIssues(report.errors);
  assert.equal(annotated.length, report.errors.length);
  for (const a of annotated) {
    assert.equal(typeof a.error, 'string');
    assert.equal(typeof a.hint, 'string'); // hint may be '' — explanatory only
  }
});

test('explainIssues annotates a real BLOCKED arcade-game report end to end', () => {
  const report = importArcadePackage({ manifest: { package_kind: 'arcade_game' }, files: {} });
  assert.ok(!report.ok && report.errors.length > 0);
  const annotated = explainIssues(report.errors);
  assert.ok(annotated.some((a) => a.hint.length > 0), 'at least one hint fires on a real report');
});

test('hints are short, plain copy — no markup, no interpolated creator input', () => {
  for (const h of hintCopy()) {
    assert.ok(h.length > 0 && h.length <= 140, `bound: ${h}`);
    assert.ok(!/[<>{}$`]/.test(h), `no markup/template chars: ${h}`);
  }
});

test('explainIssues tolerates a non-array', () => {
  assert.deepEqual(explainIssues(null), []);
  assert.deepEqual(explainIssues('x'), []);
});
