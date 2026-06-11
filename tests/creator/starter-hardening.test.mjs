// Starter cabinet HARDENING — every generated package proven against the sandbox threat list.
// The importer is the gate; these tests pin the gate's behavior on the WHOLE library plus
// adversarial inputs, so a regression in any starter or token table fails loudly.
// Run: node --test tests/creator/starter-hardening.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { STARTERS, VARIANTS, buildStarterPackage, buildPackage, gameSource, adapterSource } from '../../arcade/creator/arcade-builder/cabinet-templates.mjs';
import { importArcadePackage, SOURCE_FORBIDDEN } from '../../arcade/creator/arcade-importer/import-arcade-package.mjs';
import { FORBIDDEN_TERMS_RE } from '../../arcade/creator/validator/validation-report.mjs';

const allSources = () => {
  const out = [];
  for (const s of STARTERS) {
    const pkg = buildStarterPackage(s.id);
    out.push([s.id + '/game.mjs', pkg.files['game.mjs']], [s.id + '/adapter.mjs', pkg.files['adapter.mjs']]);
  }
  return out;
};

test('NO generated source matches any forbidden construct (network/storage/eval/dyn-import/workers)', () => {
  for (const [name, src] of allSources()) {
    for (const [label, re] of SOURCE_FORBIDDEN) assert.ok(!re.test(src), `${name}: ${label}`);
    assert.ok(!FORBIDDEN_TERMS_RE.test(src), `${name}: economy vocabulary`);
  }
});

test('every starter declares ZERO capabilities and no assets', () => {
  for (const s of STARTERS) {
    const m = buildStarterPackage(s.id).manifest;
    assert.deepEqual(m.capabilities, [], s.id);
    assert.deepEqual(m.assets, [], s.id);
  }
});

test('no starter touches ticket/prize/award shapes — results stay PROPOSALS', () => {
  for (const [name, src] of allSources()) {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, ''); // header comments may HONESTLY say "server awards"
    assert.ok(!/ticket|award|redeem/i.test(code), `${name}: award-path vocabulary in code`);
    if (name.endsWith('game.mjs')) {
      assert.ok(/proposeResult/.test(src) && /proposed_score/.test(src) && /public_safe: true/.test(src), `${name}: proposal contract`);
      assert.ok(!/server|authorit/i.test(code), `${name}: no authority claims outside the header comment`);
    }
  }
});

test('frame-contract discipline: entry self-contained; adapter imports only ./game.mjs', () => {
  for (const s of STARTERS) {
    const f = buildStarterPackage(s.id).files;
    assert.ok(!/^\s*import\b/m.test(f['game.mjs']), `${s.id} entry has no imports`);
    const imports = f['adapter.mjs'].match(/import[^;]+;/g) || [];
    assert.equal(imports.length, 1, `${s.id} adapter single import`);
    assert.ok(/from '\.\/game\.mjs'/.test(imports[0]), `${s.id} adapter imports only ./game.mjs`);
  }
});

test('size discipline: every variant at every difficulty/motion extreme stays under the hard cap', () => {
  for (const v of VARIANTS) {
    for (const [d, m] of [['chill', 'calm'], ['sharp', 'vivid']]) {
      const total = gameSource(v, '#22e0ff', '3.2', d, m).length + adapterSource().length;
      assert.ok(total < 8192, `${v}/${d}/${m}: ${total}B`);
    }
  }
});

test('adversarial params: injection attempts through every field die at the closed tables', () => {
  const hostile = buildPackage({
    package_id: 'probe-cab',
    display_name: 'Probe Cabinet',
    variant: "x'); fetch('https://evil'); //",
    accent: '"><script>1</script>',
    speed: 'import("x")',
    difficulty: 'eval(1)',
    motion: 'localStorage',
    frame: 'javascript:alert(1)',
    budget: 'Infinity',
  });
  const report = importArcadePackage(hostile);
  for (const [, re] of SOURCE_FORBIDDEN) assert.ok(!re.test(hostile.files['game.mjs']), 'hostile tokens never reach source');
  // frame fell through as a plain (invalid) string → the importer rejects it; nothing executes anywhere
  assert.ok(report.errors.every((e) => typeof e === 'string'), 'gate reports strings only');
  assert.ok(!JSON.stringify(hostile.files).includes('evil'), 'no hostile fragment survives');
});

test('manifest ids/names pass the shared validator vocabulary on the whole library', () => {
  for (const s of STARTERS) {
    const m = buildStarterPackage(s.id).manifest;
    assert.ok(/^[a-z0-9][a-z0-9-]{2,47}$/.test(m.package_id), `${s.id} id shape`);
    assert.ok(!FORBIDDEN_TERMS_RE.test(m.display_name), `${s.id} display name`);
  }
});
