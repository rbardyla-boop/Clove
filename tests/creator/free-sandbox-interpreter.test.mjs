// Creator Freedom v1 — fixed interpreter: determinism, bounded entities, rule/objective paths, emission fidelity.
// Run: node --test tests/creator/free-sandbox-interpreter.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGameFromGraph, freeSandboxInterpreterSource } from '../../arcade/creator/arcade-builder/free-sandbox-interpreter.mjs';
import { defaultFreeSandboxGraph, validateFreeSandboxGraph, runtimeGraph } from '../../arcade/creator/schemas/free-sandbox-schema.mjs';

const DT = 1 / 60;

/** Build a game from the EMITTED package source (graph const + interpreter), proving emission fidelity.
 *  Trusted test tooling only — new Function never ships in the editor module. */
function instantiateFromSource(runtime) {
  const body = freeSandboxInterpreterSource().replace(/^export\s+/m, '');
  const src = 'var GRAPH = ' + JSON.stringify(runtime) + ';\n' + body + '\nreturn createGame;';
  // eslint-disable-next-line no-new-func
  return new Function(src)()();
}

/** Minimal recording 2D context stub — render() must never throw against it. */
function stubCtx() {
  const calls = { fillText: 0, fillRect: 0, arc: 0 };
  const noop = (k) => () => { if (k in calls) calls[k]++; };
  return {
    calls, save: noop(), restore: noop(), translate: noop(), beginPath: noop(), closePath: noop(),
    moveTo: noop(), lineTo: noop(), arc: noop('arc'), fill: noop(), stroke: noop(),
    fillRect: noop('fillRect'), strokeRect: noop(), fillText: noop('fillText'),
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1, font: '', textAlign: '',
  };
}

function run(game, seconds, ctx) {
  game.init({ width: 360, height: 640 });
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) { game.tick(DT); if (ctx && i % 30 === 0) game.render(ctx); }
  return game.status();
}

/** A valid graph that ends via an explicit timer rule, with no entities/waves (deterministic, fast). */
function timerGraph(action, atS) {
  return defaultFreeSandboxGraph({
    package_id: 'timer-game', display_name: 'Timer Game',
    objective: { type: 'survive_timer', duration_s: 10 },
    entities: [], waves: [],
    rules: [{ id: 'r1', when: { event: 'timer_elapsed', at_s: atS }, then: { action } }],
  });
}

test('emitted interpreter source carries no forbidden API token', () => {
  const src = freeSandboxInterpreterSource();
  for (const re of [/\bfetch\s*\(/, /\beval\s*\(/, /new\s+Function/, /\blocalStorage\b/, /\bindexedDB\b/, /\bimport\s*\(/, /\bWebSocket\b/, /import\s*\.\s*meta/, /\bpostMessage\s*\(/]) {
    assert.doesNotMatch(src, re, 'forbidden token in interpreter: ' + re);
  }
  assert.match(src, /export function createGame\(\)/);
});

test('rule timer_elapsed -> end_win ends the game as a win', () => {
  const g = timerGraph('end_win', 1);
  assert.equal(validateFreeSandboxGraph(g).ok, true, validateFreeSandboxGraph(g).errors.join('; '));
  const s = run(createGameFromGraph(runtimeGraph(g)), 1.4);
  assert.equal(s.over, true);
  assert.equal(s.won, true);
});

test('rule timer_elapsed -> end_lose ends the game as a loss', () => {
  const s = run(createGameFromGraph(runtimeGraph(timerGraph('end_lose', 1))), 1.4);
  assert.equal(s.over, true);
  assert.equal(s.won, false);
});

test('score_threshold objective is satisfied by an add_score rule', () => {
  const g = defaultFreeSandboxGraph({
    package_id: 'score-game', display_name: 'Score Game',
    objective: { type: 'score_threshold', score_threshold: 50 },
    entities: [], waves: [],
    rules: [{ id: 'r1', when: { event: 'timer_elapsed', at_s: 1 }, then: { action: 'add_score', amount: 50 } }],
  });
  assert.equal(validateFreeSandboxGraph(g).ok, true, validateFreeSandboxGraph(g).errors.join('; '));
  const s = run(createGameFromGraph(runtimeGraph(g)), 1.4);
  assert.ok(s.score >= 50, 'score reached threshold');
  assert.equal(s.over, true);
  assert.equal(s.won, true);
});

test('live entity count never exceeds the per-type cap under a fast repeating wave', () => {
  const g = defaultFreeSandboxGraph({
    package_id: 'swarm-game', display_name: 'Swarm Game',
    objective: { type: 'survive_timer', duration_s: 10 },
    entities: [{ id: 'bug', kind: 'enemy', shape: 'circle', color: 'magenta', size: 'small', movement: 'wander', speed: 'slow', max_count: 5, collision: 'none', lifetime_s: 0, score_value: 0 }],
    waves: [{ id: 'w1', at_s: 0, entity: 'bug', count: 40, interval_s: 0.2, from: 'random', repeat: true }],
    rules: [{ id: 'r1', when: { event: 'timer_elapsed', at_s: 10 }, then: { action: 'end_win' } }],
  });
  assert.equal(validateFreeSandboxGraph(g).ok, true, validateFreeSandboxGraph(g).errors.join('; '));
  const game = createGameFromGraph(runtimeGraph(g));
  game.init({ width: 360, height: 640 });
  let maxLive = 0;
  for (let i = 0; i < 360; i++) { game.tick(DT); maxLive = Math.max(maxLive, game.status().live_entities); }
  assert.ok(maxLive <= 5, 'per-type cap respected, saw ' + maxLive);
});

test('deterministic: same seed -> identical status trajectory', () => {
  const g = defaultFreeSandboxGraph({
    package_id: 'det-game', display_name: 'Det Game', seed: 4242,
    objective: { type: 'survive_timer', duration_s: 12 },
    entities: [{ id: 'c', kind: 'pickup', shape: 'diamond', color: 'green', size: 'medium', movement: 'fall', speed: 'medium', max_count: 8, collision: 'collect', lifetime_s: 0, score_value: 5 }],
    waves: [{ id: 'w1', at_s: 0, entity: 'c', count: 30, interval_s: 0.5, from: 'top', repeat: true }],
    rules: [{ id: 'r1', when: { event: 'timer_elapsed', at_s: 12 }, then: { action: 'end_win' } }],
  });
  const rt = runtimeGraph(g);
  const trace = () => {
    const game = createGameFromGraph(rt); game.init({ width: 360, height: 640 });
    const out = [];
    for (let i = 0; i < 300; i++) { game.tick(DT); if (i % 50 === 0) { const s = game.status(); out.push([s.score, s.lives, s.live_entities, s.collected]); } }
    return JSON.stringify(out);
  };
  assert.equal(trace(), trace(), 'two runs with identical seed must match');
});

test('emission fidelity: source-built game matches the direct game', () => {
  const g = defaultFreeSandboxGraph({
    package_id: 'fidelity', display_name: 'Fidelity', seed: 99,
    objective: { type: 'survive_timer', duration_s: 12 },
    entities: [{ id: 'e', kind: 'enemy', shape: 'square', color: 'amber', size: 'medium', movement: 'chase', speed: 'slow', max_count: 4, collision: 'damage', lifetime_s: 0, score_value: 0 }],
    waves: [{ id: 'w1', at_s: 0, entity: 'e', count: 4, interval_s: 1, from: 'top', repeat: true }],
    rules: [{ id: 'r1', when: { event: 'timer_elapsed', at_s: 12 }, then: { action: 'end_win' } }],
  });
  const rt = runtimeGraph(g);
  const direct = run(createGameFromGraph(rt), 6);
  const emitted = run(instantiateFromSource(rt), 6);
  assert.deepEqual(emitted, direct, 'emitted-source game must behave identically to the direct call');
});

test('render() does not throw and draws against a stub ctx; default graph reaches a terminal state', () => {
  const ctx = stubCtx();
  const s = run(createGameFromGraph(runtimeGraph(defaultFreeSandboxGraph())), 60, ctx);
  assert.equal(s.over, true, 'default game terminates within 60s (win or loss)');
  assert.ok(ctx.calls.fillText > 0, 'HUD text was drawn');
});
