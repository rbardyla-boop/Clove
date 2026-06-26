// Creator Freedom v1 — the five example games: validate -> gate (existing importer) -> run deterministically.
// Proves the declarative schema expresses materially-different mechanics that pass the SAME boundary as
// every other arcade package, with no changes to the importer or sandbox.
// Run: node --test tests/creator/free-sandbox-examples.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXAMPLE_GRAPHS, EXAMPLE_META, buildFreeSandboxPackage } from '../../arcade/creator/arcade-builder/free-sandbox-templates.mjs';
import { createGameFromGraph } from '../../arcade/creator/arcade-builder/free-sandbox-interpreter.mjs';
import { runtimeGraph, validateFreeSandboxGraph, CAPS } from '../../arcade/creator/schemas/free-sandbox-schema.mjs';
import { importArcadePackage } from '../../arcade/creator/arcade-importer/import-arcade-package.mjs';
import { SIZE_BUDGET_MAX_BYTES as HARD_CAP } from '../../arcade/creator/schemas/arcade-game-package-schema.mjs';

const DT = 1 / 60;
const W = 360, H = 640;
const IDS = EXAMPLE_META.map((m) => m.id);

/** Deterministic autopilot: seek the next route-zone centre for routes, else sweep the playfield. */
function drive(rt, seconds, captureTrace) {
  const game = createGameFromGraph(rt);
  game.init({ width: W, height: H });
  const steps = Math.round(seconds / DT);
  const trace = [];
  let phase = 0;
  for (let i = 0; i < steps; i++) {
    let tx, ty;
    if (rt.objective.type === 'timed_route') {
      const rz = rt.objective.route_zone_ids; const idx = Math.min(game.status().route, rz.length - 1);
      const z = (rt.arena.zones || []).find((zz) => zz.id === rz[idx]);
      tx = (z.x + z.w / 2) * W; ty = (z.y + z.h / 2) * H;
    } else { phase += DT; tx = W / 2 + Math.sin(phase * 1.7) * (W * 0.42); ty = H * 0.5 + Math.cos(phase * 1.3) * (H * 0.35); }
    game.onInput({ type: 'move', x: tx, y: ty });
    game.tick(DT);
    const s = game.status();
    if (captureTrace && i % 40 === 0) trace.push([s.score, s.lives, s.route, s.collected, s.waves_cleared]);
    if (s.over) break;
  }
  return { status: game.status(), trace };
}

test('all five examples validate, gate through the existing importer, and stay within the size cap', () => {
  for (const id of IDS) {
    const g = EXAMPLE_GRAPHS[id];
    const v = validateFreeSandboxGraph(g);
    assert.equal(v.ok, true, `${id} invalid: ${v.errors.join('; ')}`);
    const pkg = buildFreeSandboxPackage(g);
    assert.equal(pkg.ok, true, `${id} build invalid`);
    const imp = importArcadePackage({ manifest: pkg.manifest, files: pkg.files });
    assert.equal(imp.ok, true, `${id} rejected by gate: ${imp.errors.join('; ')}`);
    assert.deepEqual(pkg.manifest.capabilities, [], `${id} requests zero capabilities`);
    assert.deepEqual(pkg.manifest.assets, [], `${id} bundles no assets`);
    assert.ok(imp.limits.total_bytes <= HARD_CAP, `${id} within hard cap (${imp.limits.total_bytes})`);
  }
});

test('the five examples are materially different (5 distinct objectives, broad movement coverage)', () => {
  const objectives = new Set(IDS.map((id) => EXAMPLE_GRAPHS[id].objective.type));
  assert.equal(objectives.size, 5, 'five distinct objective types');
  const movements = new Set();
  for (const id of IDS) for (const e of EXAMPLE_GRAPHS[id].entities) movements.add(e.movement);
  assert.ok(movements.size >= 5, `broad movement coverage, saw ${movements.size}: ${[...movements].join(',')}`);
});

test('timed_route is deterministically winnable by a route-seeking player', () => {
  const rt = runtimeGraph(EXAMPLE_GRAPHS.timed_route);
  const { status } = drive(rt, 35, false);
  assert.equal(status.over, true);
  assert.equal(status.won, true, 'route completed within the timer');
  assert.equal(status.route, EXAMPLE_GRAPHS.timed_route.objective.route_zone_ids.length);
});

test('every example makes real objective progress under an active player (no dead games)', () => {
  for (const id of IDS) {
    const g = EXAMPLE_GRAPHS[id];
    const { status } = drive(runtimeGraph(g), (g.objective.duration_s || 45) + 6, false);
    const ok = {
      survive_timer: status.elapsed > 10 || status.won,
      collect_targets: status.collected > 0,
      clear_waves: status.waves_cleared > 0,
      timed_route: status.route > 0,
      combo_chain: status.combo_best > 0,
    }[g.objective.type];
    assert.ok(ok, `${id} (${g.objective.type}) showed no progress: ${JSON.stringify(status)}`);
    assert.ok(status.live_entities <= CAPS.MAX_LIVE_ENTITIES, `${id} respects live cap`);
  }
});

test('examples are deterministic: identical seed + input -> identical trace', () => {
  const rt = runtimeGraph(EXAMPLE_GRAPHS.collect_and_escape);
  const a = drive(rt, 20, true).trace;
  const b = drive(rt, 20, true).trace;
  assert.deepEqual(a, b);
});
