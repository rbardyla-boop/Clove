// Creator Freedom v1 — boundary hardening: a generated free-sandbox package is a STANDARD arcade_game
// package, so the EXISTING importer gate (unchanged) must reject any tampering of its generated source
// or manifest. This proves the new package type adds NO new trust surface.
// Run: node --test tests/creator/free-sandbox-hardening.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFreeSandboxPackage, EXAMPLE_GRAPHS } from '../../arcade/creator/arcade-builder/free-sandbox-templates.mjs';
import { importArcadePackage } from '../../arcade/creator/arcade-importer/import-arcade-package.mjs';

function pkg() { return buildFreeSandboxPackage(EXAMPLE_GRAPHS.survival_dodge); }

test('a clean generated free-sandbox package is a standard arcade_game package that gates OK', () => {
  const p = pkg();
  assert.equal(p.manifest.package_kind, 'arcade_game', 'output is a normal arcade_game package');
  assert.equal(p.manifest.entry, 'game.mjs');
  assert.equal(p.manifest.adapter, 'adapter.mjs');
  assert.deepEqual(p.manifest.capabilities, []);
  const imp = importArcadePackage({ manifest: p.manifest, files: p.files });
  assert.equal(imp.ok, true, imp.errors.join('; '));
  assert.equal(imp.result_trust, 'untrusted_local_proposal');
});

// Each tamper is injected into the generated game.mjs; the EXISTING source scan must reject it.
for (const [label, snippet] of [
  ['network: fetch', "\nfetch('x');"],
  ['storage: localStorage', '\nlocalStorage.setItem(1,2);'],
  ['eval', "\neval('1');"],
  ['new Function', "\nnew Function('return 1');"],
  ['dynamic import', "\nimport('x');"],
  ['bracket access on a global', "\nwindow['fe'+'tch'];"],
  ['markup/script injection', '\n// <script>alert(1)</script>'],
  ['external url', "\nvar u = 'https://evil.example';"],
  ['economy term', '\nvar label = "reward";'],
]) {
  test(`tampered generated source is rejected by the gate: ${label}`, () => {
    const p = pkg();
    p.files['game.mjs'] = p.files['game.mjs'] + snippet;
    const imp = importArcadePackage({ manifest: p.manifest, files: p.files });
    assert.equal(imp.ok, false, `tamper '${label}' must be rejected`);
  });
}

test('a manifest that requests any capability is rejected (deny-by-default)', () => {
  const p = pkg();
  p.manifest.capabilities = ['network'];
  assert.equal(importArcadePackage({ manifest: p.manifest, files: p.files }).ok, false);
});

test('an extra bundled file (assets) is rejected', () => {
  const p = pkg();
  p.files['secret.bin'] = 'data';
  assert.equal(importArcadePackage({ manifest: p.manifest, files: p.files }).ok, false);
});

test('a package larger than the 64 KiB hard cap is rejected', () => {
  const p = pkg();
  p.files['game.mjs'] = p.files['game.mjs'] + '\n// ' + 'x'.repeat(70000);
  assert.equal(importArcadePackage({ manifest: p.manifest, files: p.files }).ok, false);
});
