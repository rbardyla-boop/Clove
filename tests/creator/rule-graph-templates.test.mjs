// CF-4A rule-graph foundation tests — Reaction Lane only.
// Run: node --test tests/creator/rule-graph-templates.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { importArcadePackage } from '../../arcade/creator/arcade-importer/import-arcade-package.mjs';
import {
  COMBO_CAPS,
  CONTRAST,
  defaultReactionLaneGraph,
  HIT_WINDOW_MS,
  LANE_COUNTS,
  MISS_LIMITS,
  MOBILE_CONTROLS,
  PARTICLE_EFFECTS,
  REACTION_LANE_TEMPLATE,
  RULE_GRAPH_KIND,
  SCREEN_SHAKE,
  SPAWN_CADENCE_MS,
  TARGET_COUNTS,
  validateReactionLaneGraph,
  buildReactionLanePackage,
} from '../../arcade/creator/arcade-builder/rule-graph-templates.mjs';

test('Reaction Lane graph validates from closed controls and builds an importer-valid package', () => {
  const graph = defaultReactionLaneGraph();
  const graphReport = validateReactionLaneGraph(graph);
  assert.deepEqual(graphReport, { ok: true, errors: [] });
  assert.equal(graph.game_kind, RULE_GRAPH_KIND);
  assert.equal(graph.template, REACTION_LANE_TEMPLATE);
  assert.equal(graph.capabilities.live_world_authorized, false);
  assert.equal(graph.capabilities.ticket_hooks, false);
  assert.equal(graph.capabilities.prize_hooks, false);
  assert.equal(graph.capabilities.ledger_hooks, false);

  const pkg = buildReactionLanePackage(graph);
  assert.equal(pkg.graphValidation.ok, true);
  const report = importArcadePackage({ manifest: pkg.manifest, files: pkg.files });
  assert.equal(report.ok, true, report.errors.join(' | '));
  assert.equal(report.result_trust, 'untrusted_local_proposal');
  assert.equal(pkg.manifest.package_kind, 'arcade_game');
  assert.equal(pkg.manifest.capabilities.length, 0);
});

test('Reaction Lane package generation is deterministic from package JSON', () => {
  const graph = defaultReactionLaneGraph({
    package_id: 'reaction-lane-five',
    display_name: 'Reaction Lane Five',
    layout: { lane_count: 5, spawn_pattern: 'left_right' },
    visuals: { particle_effects: 'arcade', screen_shake: 'arcade', contrast: 'high' },
  });
  const a = buildReactionLanePackage(graph);
  const b = buildReactionLanePackage(JSON.parse(JSON.stringify(graph)));
  assert.deepEqual(a.manifest, b.manifest);
  assert.equal(a.files['game.mjs'], b.files['game.mjs']);
  assert.equal(a.files['adapter.mjs'], b.files['adapter.mjs']);
});

test('closed token/control sets are present for the builder UI', () => {
  assert.deepEqual(LANE_COUNTS, [2, 3, 4, 5]);
  assert.ok(SPAWN_CADENCE_MS.includes(650));
  assert.ok(HIT_WINDOW_MS.includes(180));
  assert.ok(TARGET_COUNTS.includes(16));
  assert.ok(COMBO_CAPS.includes(5));
  assert.ok(MISS_LIMITS.includes(5));
  assert.deepEqual(PARTICLE_EFFECTS, ['off', 'soft', 'arcade']);
  assert.deepEqual(SCREEN_SHAKE, ['off', 'soft', 'arcade']);
  assert.ok(CONTRAST.includes('high'));
  assert.ok(MOBILE_CONTROLS.includes('tap_or_swipe_lanes'));
});

test('generated source is local-only, high contrast, reduced-motion aware, and bounded shake/particles', () => {
  const pkg = buildReactionLanePackage(defaultReactionLaneGraph({
    layout: { lane_count: 5 },
    visuals: { particle_effects: 'arcade', screen_shake: 'arcade', contrast: 'high' },
  }));
  const src = pkg.files['game.mjs'];
  assert.match(src, /const LANES = 5/);
  assert.match(src, /const HIGH = true/);
  assert.match(src, /prefers-reduced-motion: reduce/);
  assert.match(src, /const FX = RM \? 0 : 2, SHAKE = RM \? 0 : 2/);
  assert.match(src, /const MAXP = FX === 2 \? 48/);
  assert.doesNotMatch(src, /fetch|WebSocket|localStorage|sessionStorage|indexedDB|ticket|prize|ledger/i);
});

test('invalid and hostile rule graphs are rejected before generation can be trusted', () => {
  const cases = [
    ['wrong template', { template: 'signal_ring' }, /template must be reaction_lane/],
    ['unknown top key', { extra: true }, /unknown key extra/],
    ['bad lane count', { layout: { lane_count: 9 } }, /layout\.lane_count/],
    ['bad target count', { rules: { objective: { target_count: 999 } } }, /objective\.target_count/],
    ['live world opened', { capabilities: { live_world_authorized: true } }, /capabilities\.live_world_authorized must be false/],
    ['network opened', { capabilities: { network: true } }, /capabilities\.network must be false/],
    ['external url in name', { display_name: 'https://example.test/cabinet' }, /display_name/],
    ['economy term in id', { package_id: 'reward-lane' }, /package_id/],
    ['reduced motion missing', { accessibility: { reduced_motion: 'none' } }, /reduced_motion/],
    ['high contrast not closed', { visuals: { contrast: 'ultra' } }, /visuals\.contrast/],
  ];
  for (const [name, override, pattern] of cases) {
    const report = validateReactionLaneGraph(defaultReactionLaneGraph(override));
    assert.equal(report.ok, false, name);
    assert.match(report.errors.join(' | '), pattern, name);
  }
});

test('hostile capabilities never survive the build→import composition (deny-by-default)', () => {
  // A graph that tries to open EVERY dangerous capability at once.
  const hostile = defaultReactionLaneGraph({
    capabilities: {
      network: true, storage: true, external_assets: true, dom_escape: true, arbitrary_code: true,
      live_world_authorized: true, ticket_hooks: true, prize_hooks: true, ledger_hooks: true,
    },
  });

  // (1) Graph validation fails, and every opened capability is rejected by name.
  const gv = validateReactionLaneGraph(hostile);
  assert.equal(gv.ok, false);
  for (const cap of ['live_world_authorized', 'ticket_hooks', 'prize_hooks', 'ledger_hooks',
    'network', 'storage', 'external_assets', 'dom_escape', 'arbitrary_code']) {
    assert.match(gv.errors.join(' | '), new RegExp(`capabilities\\.${cap} must be false`), cap);
  }

  // (2) The BUILT manifest carries NO capability — the package layer is a closed/empty allowlist,
  //     regardless of what the source graph asked for.
  const pkg = buildReactionLanePackage(hostile);
  assert.equal(pkg.graphValidation.ok, false);
  assert.deepEqual(pkg.manifest.capabilities, []);

  // (3) The importer composition confirms: zero capabilities survive, only an untrusted local proposal.
  const report = importArcadePackage({ manifest: pkg.manifest, files: pkg.files });
  assert.deepEqual(report.capabilities, []);
  assert.equal(report.result_trust, 'untrusted_local_proposal');
  assert.equal(/live_world|ticket|prize|ledger/i.test(JSON.stringify(report.capabilities)), false);
});

test('eval-like data smuggled into a rule-graph field is caught by the importer source scan', () => {
  // spawn_pattern flows into generated game.mjs as a JSON-quoted string literal. A payload carrying
  // eval( survives as DATA (it never executes), but the importer's code-aware scan must still reject it.
  const hostile = defaultReactionLaneGraph({ layout: { spawn_pattern: '");eval("alert(1)");//' } });

  // The graph validator already rejects the out-of-set, payload-bearing field...
  assert.equal(validateReactionLaneGraph(hostile).ok, false);

  // ...and even though buildReactionLanePackage does not gate generation on validation, the payload
  // reaches game.mjs as data and the importer's source deny-list rejects the composed package.
  const pkg = buildReactionLanePackage(hostile);
  assert.match(pkg.files['game.mjs'], /eval\(/);            // present, but only inside a string literal
  const report = importArcadePackage({ manifest: pkg.manifest, files: pkg.files });
  assert.equal(report.ok, false);
  assert.match(report.errors.join(' | '), /forbidden \(eval\)/);
  assert.deepEqual(report.capabilities, []);                // no capability granted by the composition
});
