// Phase 7C — activity objectives WITHOUT rewards: pure core authority + projection tests.
// Run: node --test tests/arcade/city-objectives.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createObjectiveState, activeObjective, evaluateObjective, stepObjectives,
  objectiveHintPayload, objectiveCompletedPayload, objectiveCopy, objectiveCopyIsClean,
  objectiveId, HINT_FIELDS, COMPLETION_FIELDS, OBJECTIVE_COOLDOWN_MS, OBJECTIVE_KINDS,
} from '../../arcade/city/city-objectives.mjs';
import { CITY_IDS, isWalkable } from '../../arcade/city/city-block.mjs';

const T0 = 1_000_000;
const CITY = CITY_IDS[0];

test('closed cycle: deterministic ids, known kinds, copy bounded + vocabulary-clean', () => {
  assert.equal(objectiveId(CITY, 0), `obj:${CITY}:0`);
  assert.equal(objectiveId(CITY, 2), `obj:${CITY}:0`, 'ids cycle deterministically');
  for (const text of objectiveCopy()) assert.ok(objectiveCopyIsClean(text), `copy clean: "${text}"`);
  const s = createObjectiveState(T0);
  for (let i = 0; i < 2; i++) {
    const o = activeObjective(CITY, { ...s, index: i }, T0);
    assert.ok(OBJECTIVE_KINDS.includes(o.kind), o.kind);
  }
});

test('objective geometry sits on WALKABLE ground (server collision is the oracle)', () => {
  const reach = activeObjective(CITY, createObjectiveState(T0), T0);
  assert.ok(isWalkable(reach.x, reach.y, 12), 'reach node is in open space');
  const gather = activeObjective(CITY, { index: 1, activated_at: T0, cooldown_until: 0 }, T0);
  assert.ok(isWalkable(gather.x + gather.w / 2, gather.y + gather.h / 2, 12), 'gather zone center is open');
});

test('reach_node completes ONLY from a canonical position inside the radius', () => {
  const obj = activeObjective(CITY, createObjectiveState(T0), T0);
  assert.equal(evaluateObjective(obj, { a: { x: obj.x + obj.radius + 5, y: obj.y } }).completed, false, 'outside misses');
  assert.equal(evaluateObjective(obj, { a: { x: obj.x + 4, y: obj.y - 4 } }).completed, true, 'inside completes');
  assert.equal(evaluateObjective(obj, {}).completed, false, 'no players, no completion');
  assert.equal(evaluateObjective(obj, { a: { x: 'evil', y: null } }).completed, false, 'garbage positions ignored');
});

test('gather_at_zone needs N canonical players INSIDE the zone', () => {
  const obj = activeObjective(CITY, { index: 1, activated_at: T0, cooldown_until: 0 }, T0);
  const inZone = (dx, dy) => ({ x: obj.x + 10 + dx, y: obj.y + 10 + dy });
  assert.equal(evaluateObjective(obj, { a: inZone(0, 0) }).completed, false, 'one is not a gathering');
  const two = evaluateObjective(obj, { a: inZone(0, 0), b: inZone(20, 12) });
  assert.equal(two.completed, true);
  assert.equal(two.count, 2);
  assert.equal(evaluateObjective(obj, { a: inZone(0, 0), b: { x: obj.x - 50, y: obj.y } }).completed, false, 'outside player does not count');
});

test('completion advances the cycle, arms the cooldown, and acknowledges EXACTLY once', () => {
  const obj = activeObjective(CITY, createObjectiveState(T0), T0);
  const at = { a: { x: obj.x, y: obj.y } };
  const r1 = stepObjectives(CITY, createObjectiveState(T0), at, T0);
  assert.ok(r1.completed, 'first step completes');
  const r2 = stepObjectives(CITY, r1.state, at, T0 + 1000);
  assert.equal(r2.completed, null, 'cooldown: standing on the node cannot re-fire');
  assert.equal(activeObjective(CITY, r1.state, T0 + 1000), null, 'no active objective during cooldown');
  const after = stepObjectives(CITY, r1.state, at, T0 + OBJECTIVE_COOLDOWN_MS + 1);
  assert.equal(after.completed, null, 'next objective is the GATHER — node position no longer completes');
  assert.equal(activeObjective(CITY, r1.state, T0 + OBJECTIVE_COOLDOWN_MS + 1).kind, 'gather_at_zone', 'cycle advanced');
});

test('projections are EXACT allowlists — and carry no value-shaped field, ever', () => {
  const VALUE_RE = /score|balance|ticket|prize|inventory|rank|streak|level|points|credit|currency|wealth|payout/i;
  const reach = activeObjective(CITY, createObjectiveState(T0), T0);
  const hp = objectiveHintPayload(reach);
  assert.deepEqual(Object.keys(hp.objective).sort(), ['hint', 'kind', 'objective_id', 'radius', 'x', 'y'].sort());
  // T1 (review): the GATHER kind gets its own exact key-set pin — a leaked field on this
  // projection branch (w/h/needed path) would otherwise escape the reach-only deepEqual.
  const gather = activeObjective(CITY, { index: 1, activated_at: T0, cooldown_until: 0 }, T0);
  const gp = objectiveHintPayload(gather);
  assert.deepEqual(Object.keys(gp.objective).sort(), ['h', 'hint', 'kind', 'needed', 'objective_id', 'w', 'x', 'y'].sort());
  assert.ok([...Object.keys(hp.objective), ...Object.keys(gp.objective)].every((k) => HINT_FIELDS.includes(k)));
  const done = stepObjectives(CITY, createObjectiveState(T0), { a: { x: reach.x, y: reach.y } }, T0).completed;
  const cp = objectiveCompletedPayload(done);
  assert.deepEqual(Object.keys(cp).sort(), [...COMPLETION_FIELDS].sort());
  for (const k of [...Object.keys(hp.objective), ...Object.keys(cp)]) assert.ok(!VALUE_RE.test(k), k);
  assert.ok(!VALUE_RE.test(JSON.stringify(cp)), 'no value vocabulary in the payload at all');
});

test('fails safe: unknown city, null state, cooldown, unknown kind', () => {
  assert.equal(activeObjective('mystery-99', createObjectiveState(T0), T0), null);
  assert.equal(activeObjective(null, createObjectiveState(T0), T0), null);
  assert.equal(activeObjective(CITY, null, T0), null);
  assert.equal(evaluateObjective({ kind: 'mind_control', x: 0, y: 0 }, { a: { x: 0, y: 0 } }).completed, false);
  const r = stepObjectives('mystery-99', createObjectiveState(T0), { a: { x: 240, y: 520 } }, T0);
  assert.equal(r.completed, null, 'unknown city never completes anything');
});

test('NO persistence shape: state is three ephemeral numbers — nothing per-player, nothing accumulable', () => {
  const s = createObjectiveState(T0);
  assert.deepEqual(Object.keys(s).sort(), ['activated_at', 'cooldown_until', 'index']);
  for (const v of Object.values(s)) assert.ok(Number.isFinite(v));
});

test('T2 (review): FRESH state after eviction/restart starts clean — ephemerality is the anti-accumulation property', () => {
  // drive a state deep into the cycle: complete reach, sit in cooldown
  const obj = activeObjective(CITY, createObjectiveState(T0), T0);
  const mid = stepObjectives(CITY, createObjectiveState(T0), { a: { x: obj.x, y: obj.y } }, T0).state;
  assert.ok(mid.cooldown_until > T0, 'precondition: old instance is mid-cooldown');
  assert.equal(mid.index, 1, 'precondition: old instance advanced the cycle');
  // a DO eviction/restart constructs a FRESH state — nothing carries over
  const later = T0 + 5_000; // restart happens INSIDE the old cooldown window
  const fresh = createObjectiveState(later);
  assert.equal(fresh.index, 0, 'no stale cycle position');
  assert.equal(fresh.cooldown_until, 0, 'no stale cooldown carry');
  const active = activeObjective(CITY, fresh, later);
  assert.ok(active && active.kind === 'reach_node', 'fresh instance hints normally at once');
  assert.equal(objectiveHintPayload(active).objective.objective_id, `obj:${CITY}:0`, 'cycle restarted from the top');
  // and nothing completed carried across the restart
  assert.equal(stepObjectives(CITY, fresh, {}, later).completed, null);
});
