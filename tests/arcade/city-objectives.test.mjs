// Phase 7C — activity objectives WITHOUT rewards: pure core authority + projection tests.
// Run: node --test tests/arcade/city-objectives.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createObjectiveState, activeObjective, evaluateObjective, stepObjectives,
  objectiveHintPayload, objectiveCompletedPayload, objectiveCopy, objectiveCopyIsClean,
  objectiveId, HINT_FIELDS, COMPLETION_FIELDS, OBJECTIVE_COOLDOWN_MS, OBJECTIVE_KINDS,
  cycleDefinitions, blockHintOverrides,
} from '../../arcade/city/city-objectives.mjs';
import { CITY_IDS, isWalkable } from '../../arcade/city/city-block.mjs';

const T0 = 1_000_000;
const CITY = CITY_IDS[0];

test('closed cycle: deterministic ids, known kinds, copy bounded + vocabulary-clean', () => {
  assert.equal(objectiveId(CITY, 0), `obj:${CITY}:0`);
  assert.equal(objectiveId(CITY, 4), `obj:${CITY}:0`, 'ids cycle deterministically (7C-V: mod 4)');
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

test('NO persistence shape: state is FOUR ephemeral numbers — nothing per-player, nothing accumulable', () => {
  const s = createObjectiveState(T0);
  assert.deepEqual(Object.keys(s).sort(), ['activated_at', 'cooldown_until', 'index', 'phase']); // 7C-V: +phase (per-kind scratch)
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

// ──────────────────────────── 7C-V: objective variety ────────────────────────────

const atIndex = (i) => ({ index: i, activated_at: T0, cooldown_until: 0, phase: 0 });

test('7C-V cycle: four kinds in order; ids stay deterministic; all four in OBJECTIVE_KINDS', () => {
  assert.deepEqual(cycleDefinitions().map((o) => o.kind), ['reach_node', 'gather_at_zone', 'dwell_at_node', 'visit_in_order']);
  for (const o of cycleDefinitions()) assert.ok(OBJECTIVE_KINDS.includes(o.kind), o.kind);
  assert.equal(objectiveId(CITY, 4), `obj:${CITY}:0`, 'ids cycle mod 4');
});

test('7C-V evaluability bounds: every node/zone walkable; dwell patient but bounded; visit legs reachable', () => {
  for (const o of cycleDefinitions()) {
    if ('x' in o) assert.ok(isWalkable(o.x, o.y, 12), `${o.kind} primary point walkable`);
    if (o.kind === 'gather_at_zone') assert.ok(isWalkable(o.x + o.w / 2, o.y + o.h / 2, 12), 'zone center walkable');
    if (o.kind === 'dwell_at_node') {
      assert.ok(o.dwell_s >= 2 && o.dwell_s <= 10, 'dwell humane: 2..10s');
      assert.ok(o.radius >= 24, 'dwell radius generous enough to stand still in');
    }
    if (o.kind === 'visit_in_order') {
      assert.ok(isWalkable(o.bx, o.by, 12), 'leg B walkable');
      const d = Math.hypot(o.bx - o.x, o.by - o.y);
      assert.ok(d >= 80 && d <= 700, `legs distinct but reachable (${Math.round(d)})`);
    }
    if ('radius' in o) assert.ok(o.radius >= 24, `${o.kind} radius >= 2x player radius`);
  }
});

test('dwell_at_node: continuous presence completes; leaving RESETS (no banked fractions)', () => {
  const obj = activeObjective(CITY, atIndex(2), T0);
  const at = { a: { x: obj.x, y: obj.y } };
  let st = atIndex(2);
  // arrive: phase latches the arrival timestamp, no completion yet
  let r = stepObjectives(CITY, st, at, T0);
  assert.equal(r.completed, null);
  st = r.state;
  assert.equal(st.phase, T0, 'presence start latched');
  // still there just before the threshold → not yet
  r = stepObjectives(CITY, st, at, T0 + obj.dwell_s * 1000 - 50);
  assert.equal(r.completed, null);
  // leave → phase resets
  r = stepObjectives(CITY, r.state, { a: { x: obj.x + 200, y: obj.y } }, T0 + obj.dwell_s * 1000);
  assert.equal(r.state.phase, 0, 'leaving resets the clock');
  // return and stay the FULL duration → completes exactly once
  r = stepObjectives(CITY, r.state, at, T0 + 10_000);
  r = stepObjectives(CITY, r.state, at, T0 + 10_000 + obj.dwell_s * 1000 + 1);
  assert.ok(r.completed, 'full continuous dwell completes');
  assert.equal(r.completed.kind, 'dwell_at_node');
  assert.equal(r.state.phase, 0, 'completion resets scratch');
});

test('visit_in_order: A then B completes; B first does NOT; legs may be different players (collective)', () => {
  const obj = activeObjective(CITY, atIndex(3), T0);
  const atA = { a: { x: obj.x, y: obj.y } };
  const atB = { b: { x: obj.bx, y: obj.by } };
  // B first: nothing
  let r = stepObjectives(CITY, atIndex(3), atB, T0);
  assert.equal(r.completed, null);
  assert.equal(r.state.phase, 0, 'touching B before A arms nothing');
  // A (player a) → leg one
  r = stepObjectives(CITY, r.state, atA, T0 + 100);
  assert.equal(r.completed, null);
  assert.equal(r.state.phase, 1, 'leg A latched');
  // B (DIFFERENT player b) → completes — a block fact, not a personal quest
  r = stepObjectives(CITY, r.state, atB, T0 + 200);
  assert.ok(r.completed, 'A then B completes');
  assert.equal(r.completed.kind, 'visit_in_order');
});

test('7C-V projections: exact key sets per kind; no value-shaped field anywhere', () => {
  const VALUE_RE = /score|balance|ticket|prize|inventory|rank|streak|level|points|credit|currency|wealth|payout/i;
  const dwell = objectiveHintPayload(activeObjective(CITY, atIndex(2), T0)).objective;
  assert.deepEqual(Object.keys(dwell).sort(), ['dwell_s', 'hint', 'kind', 'objective_id', 'radius', 'x', 'y'].sort());
  const visit = objectiveHintPayload(activeObjective(CITY, atIndex(3), T0)).objective;
  assert.deepEqual(Object.keys(visit).sort(), ['bx', 'by', 'hint', 'kind', 'objective_id', 'radius', 'x', 'y'].sort());
  for (const k of [...Object.keys(dwell), ...Object.keys(visit)]) {
    assert.ok(HINT_FIELDS.includes(k), k);
    assert.ok(!VALUE_RE.test(k), k);
  }
});

test('7C-V per-block hint flavor: closed, sparse, clean; every block flavored at least once; acks universal', () => {
  const overrides = blockHintOverrides();
  assert.deepEqual(Object.keys(overrides).sort(), [...CITY_IDS].sort(), 'every block carries at least one flavored hint');
  for (const [city, m] of Object.entries(overrides)) {
    for (const [idx, hint] of Object.entries(m)) {
      assert.ok(Number(idx) >= 0 && Number(idx) < cycleDefinitions().length, `${city} index in cycle`);
      assert.ok(objectiveCopyIsClean(hint), `${city}[${idx}]: "${hint}"`);
      const o = activeObjective(city, atIndex(Number(idx)), T0);
      assert.equal(o.hint, hint, 'flavor ships in the hint push');
      assert.equal(o.ack, cycleDefinitions()[Number(idx)].ack, 'acks stay universal per kind');
    }
  }
  // unflavored (city, index) pairs fall back to the base hint
  const base = activeObjective('skyline-03', atIndex(1), T0);
  assert.equal(base.hint, cycleDefinitions()[1].hint);
});
