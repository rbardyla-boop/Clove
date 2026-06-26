// Creator Freedom v1 — Free Sandbox declarative schema validator contract + adversarial fail-closed.
// Run: node --test tests/creator/free-sandbox-schema.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultFreeSandboxGraph, validateFreeSandboxGraph, runtimeGraph, CAPS,
} from '../../arcade/creator/schemas/free-sandbox-schema.mjs';

/** Deep clone so a mutation in one case never leaks into another. */
const clone = (g) => JSON.parse(JSON.stringify(g));

test('the default graph is valid', () => {
  const { ok, errors } = validateFreeSandboxGraph(defaultFreeSandboxGraph());
  assert.equal(ok, true, 'default invalid: ' + errors.join('; '));
});

test('rejects a non-object / missing required keys', () => {
  assert.equal(validateFreeSandboxGraph(null).ok, false);
  assert.equal(validateFreeSandboxGraph([]).ok, false);
  const g = clone(defaultFreeSandboxGraph()); delete g.objective;
  assert.equal(validateFreeSandboxGraph(g).ok, false);
});

test('rejects unknown top-level keys', () => {
  const g = clone(defaultFreeSandboxGraph()); g.surprise = 1;
  const r = validateFreeSandboxGraph(g);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /unknown key 'surprise'/);
});

test('capability flags are deny-by-default: any true flag fails', () => {
  for (const k of ['network', 'storage', 'arbitrary_code', 'live_world_authorized', 'ticket_hooks', 'prize_hooks', 'ledger_hooks']) {
    const g = clone(defaultFreeSandboxGraph()); g.capabilities[k] = true;
    const r = validateFreeSandboxGraph(g);
    assert.equal(r.ok, false, `capabilities.${k}=true must fail`);
    assert.match(r.errors.join('\n'), new RegExp(`capabilities\\.${k} must be false`));
  }
});

test('rejects economy / ownership vocabulary in user text', () => {
  for (const bad of ['Buy More Coins', 'Token Market', 'Cash Out Prize', 'Reward Boost']) {
    const g = clone(defaultFreeSandboxGraph()); g.display_name = bad;
    assert.equal(validateFreeSandboxGraph(g).ok, false, `display_name '${bad}' must fail`);
  }
  // forbidden term smuggled through a rule message
  const g = clone(defaultFreeSandboxGraph());
  g.rules.push({ id: 'rx', when: { event: 'score_reached', score: 10 }, then: { action: 'show_message', text: 'claim your prize' } });
  assert.equal(validateFreeSandboxGraph(g).ok, false);
});

test('rejects urls / code in any string value', () => {
  for (const bad of ['https://evil.example', 'data:text/html,x', 'javascript:alert(1)']) {
    const g = clone(defaultFreeSandboxGraph()); g.display_name = bad;
    assert.equal(validateFreeSandboxGraph(g).ok, false, `'${bad}' must fail`);
  }
});

test('enforces entity-type cap and live-instance cap', () => {
  const overTypes = clone(defaultFreeSandboxGraph());
  overTypes.entities = Array.from({ length: CAPS.MAX_ENTITY_TYPES + 1 }, (_, i) => ({
    id: 'e' + i, kind: 'enemy', shape: 'circle', color: 'cyan', size: 'small', movement: 'stationary', speed: 'slow', max_count: 1, collision: 'none', lifetime_s: 0, score_value: 0,
  }));
  assert.equal(validateFreeSandboxGraph(overTypes).ok, false);

  const overLive = clone(defaultFreeSandboxGraph());
  overLive.entities = [{ id: 'swarm', kind: 'enemy', shape: 'circle', color: 'cyan', size: 'small', movement: 'wander', speed: 'slow', max_count: CAPS.MAX_PER_TYPE_COUNT, collision: 'damage', lifetime_s: 0, score_value: 0 },
    { id: 'swarm2', kind: 'enemy', shape: 'square', color: 'magenta', size: 'small', movement: 'wander', speed: 'slow', max_count: CAPS.MAX_PER_TYPE_COUNT, collision: 'damage', lifetime_s: 0, score_value: 0 },
    { id: 'swarm3', kind: 'enemy', shape: 'triangle', color: 'green', size: 'small', movement: 'wander', speed: 'slow', max_count: CAPS.MAX_PER_TYPE_COUNT, collision: 'damage', lifetime_s: 0, score_value: 0 }];
  overLive.waves = [{ id: 'w1', at_s: 1, entity: 'swarm', count: 1, interval_s: 1, from: 'random', repeat: true }];
  const r = validateFreeSandboxGraph(overLive);
  assert.equal(r.ok, false);
  assert.match(r.errors.join('\n'), /exceeds live cap/);
});

test('enforces rule and wave caps', () => {
  const overRules = clone(defaultFreeSandboxGraph());
  overRules.rules = Array.from({ length: CAPS.MAX_RULES + 1 }, (_, i) => ({ id: 'r' + i, when: { event: 'score_reached', score: i + 1 }, then: { action: 'add_score', amount: 1 } }));
  assert.equal(validateFreeSandboxGraph(overRules).ok, false);

  const overWaves = clone(defaultFreeSandboxGraph());
  overWaves.waves = Array.from({ length: CAPS.MAX_WAVES + 1 }, (_, i) => ({ id: 'w' + i, at_s: i, entity: 'drifter', count: 1, interval_s: 1, from: 'random', repeat: false }));
  assert.equal(validateFreeSandboxGraph(overWaves).ok, false);
});

test('rejects unknown movement pattern, collision behavior, objective type, rule event, and rule action', () => {
  const mv = clone(defaultFreeSandboxGraph()); mv.entities[0].movement = 'teleport_anywhere';
  assert.equal(validateFreeSandboxGraph(mv).ok, false);

  const col = clone(defaultFreeSandboxGraph()); col.entities[0].collision = 'mind_control';
  assert.equal(validateFreeSandboxGraph(col).ok, false);

  const ot = clone(defaultFreeSandboxGraph()); ot.objective = { type: 'mine_crypto' };
  assert.equal(validateFreeSandboxGraph(ot).ok, false);

  const ev = clone(defaultFreeSandboxGraph()); ev.rules[0].when = { event: 'on_network_packet' };
  assert.equal(validateFreeSandboxGraph(ev).ok, false);

  const ac = clone(defaultFreeSandboxGraph()); ac.rules[0].then = { action: 'open_socket' };
  assert.equal(validateFreeSandboxGraph(ac).ok, false);
});

test('rejects out-of-range numbers (seed, lives, durations, spawn interval)', () => {
  const seed = clone(defaultFreeSandboxGraph()); seed.seed = 0;
  assert.equal(validateFreeSandboxGraph(seed).ok, false);
  const lives = clone(defaultFreeSandboxGraph()); lives.player.lives = 99;
  assert.equal(validateFreeSandboxGraph(lives).ok, false);
  const fast = clone(defaultFreeSandboxGraph()); fast.waves[0].interval_s = 0.01; // below MIN_SPAWN_INTERVAL_S
  assert.equal(validateFreeSandboxGraph(fast).ok, false);
});

test('cross-references must resolve: wave->entity, rule->entity/zone/wave', () => {
  const w = clone(defaultFreeSandboxGraph()); w.waves[0].entity = 'ghost';
  assert.equal(validateFreeSandboxGraph(w).ok, false);
  const r = clone(defaultFreeSandboxGraph()); r.rules.push({ id: 'r2', when: { event: 'collision_with', entity: 'ghost' }, then: { action: 'add_score', amount: 1 } });
  assert.equal(validateFreeSandboxGraph(r).ok, false);
});

test('objective reachability is enforced', () => {
  // reach_goal with no goal zone / goal_marker / goal collision
  const g = clone(defaultFreeSandboxGraph());
  g.objective = { type: 'reach_goal' };
  assert.equal(validateFreeSandboxGraph(g).ok, false);
  // collect_targets with no collectible entity
  const c = clone(defaultFreeSandboxGraph());
  c.objective = { type: 'collect_targets', target_count: 5 };
  assert.equal(validateFreeSandboxGraph(c).ok, false);
  // timed_route needs >=2 known zones
  const t = clone(defaultFreeSandboxGraph());
  t.objective = { type: 'timed_route', duration_s: 30, route_zone_ids: ['z1'] };
  assert.equal(validateFreeSandboxGraph(t).ok, false);
});

test('runtimeGraph strips capabilities + metadata, keeps gameplay', () => {
  const rt = runtimeGraph(defaultFreeSandboxGraph());
  assert.equal('capabilities' in rt, false);
  assert.equal('package_id' in rt, false);
  assert.equal('display_name' in rt, false);
  for (const k of ['seed', 'arena', 'player', 'objective', 'scoring', 'entities', 'waves', 'rules', 'modifiers', 'theme']) {
    assert.ok(k in rt, `runtimeGraph keeps ${k}`);
  }
  // the embedded slice must carry no capability key names (defense for the source-level scan)
  assert.doesNotMatch(JSON.stringify(rt), /network|live_world|ticket_hooks|prize_hooks|ledger_hooks|arbitrary_code/);
});
