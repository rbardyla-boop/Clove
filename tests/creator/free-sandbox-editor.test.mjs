// Creator Freedom v1 — editor pure graph-ops (DOM-free): blank/add/remove/objective shaping stay valid + immutable.
// Run: node --test tests/creator/free-sandbox-editor.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blankGraph, defaultEntity, defaultWave, defaultRule, defaultZone, addItem, removeItem, defaultObjectiveFor,
} from '../../arcade/creator/arcade-builder/free-sandbox-editor.mjs';
import { validateFreeSandboxGraph, OBJECTIVE_TYPES } from '../../arcade/creator/schemas/free-sandbox-schema.mjs';
import { buildFreeSandboxPackage, exampleGraph, EXAMPLE_META } from '../../arcade/creator/arcade-builder/free-sandbox-templates.mjs';
import { importArcadePackage } from '../../arcade/creator/arcade-importer/import-arcade-package.mjs';

test('a blank graph is valid and gates', () => {
  const g = blankGraph();
  const v = validateFreeSandboxGraph(g);
  assert.equal(v.ok, true, v.errors.join('; '));
  const pkg = buildFreeSandboxPackage(g);
  assert.equal(importArcadePackage({ manifest: pkg.manifest, files: pkg.files }).ok, true);
});

test('addItem / removeItem are immutable and adjust the right list', () => {
  const g0 = blankGraph();
  const before = JSON.stringify(g0);
  const g1 = addItem(g0, 'entities', defaultEntity(g0));
  assert.equal(JSON.stringify(g0), before, 'addItem does not mutate input');
  assert.equal(g1.entities.length, g0.entities.length + 1);
  const g2 = removeItem(g1, 'entities', g1.entities.length - 1);
  assert.equal(g2.entities.length, g0.entities.length);

  const z1 = addItem(g0, 'zones', defaultZone(g0));
  assert.equal(z1.arena.zones.length, (g0.arena.zones || []).length + 1);
  const z2 = removeItem(z1, 'zones', 0);
  assert.equal(z2.arena.zones.length, (g0.arena.zones || []).length);
});

test('default item factories produce unique, schema-shaped ids', () => {
  let g = blankGraph();
  g = addItem(g, 'entities', defaultEntity(g));
  g = addItem(g, 'entities', defaultEntity(g));
  const ids = g.entities.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, 'unique entity ids');
  g = addItem(g, 'waves', defaultWave(g));
  g = addItem(g, 'rules', defaultRule(g));
  // the whole assembled graph still validates (defaults are coherent)
  assert.equal(validateFreeSandboxGraph(g).ok, true, validateFreeSandboxGraph(g).errors.join('; '));
});

test('defaultObjectiveFor returns the right shape for every objective type', () => {
  const g = exampleGraph('timed_route'); // has zones for the route default
  for (const ty of OBJECTIVE_TYPES) {
    const o = defaultObjectiveFor(ty, g);
    assert.equal(o.type, ty);
  }
  assert.ok('duration_s' in defaultObjectiveFor('survive_timer', g));
  assert.ok('target_count' in defaultObjectiveFor('collect_targets', g));
  assert.ok(Array.isArray(defaultObjectiveFor('timed_route', g).route_zone_ids));
  assert.ok('score_threshold' in defaultObjectiveFor('score_threshold', g));
  assert.ok('combo_target' in defaultObjectiveFor('combo_chain', g));
});

test('every example loads through exampleGraph and still validates (remix round-trip)', () => {
  for (const m of EXAMPLE_META) {
    const g = exampleGraph(m.id);
    assert.equal(validateFreeSandboxGraph(g).ok, true, `${m.id}: ${validateFreeSandboxGraph(g).errors.join('; ')}`);
  }
});
