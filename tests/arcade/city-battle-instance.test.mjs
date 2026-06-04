/**
 * Phase 4G — Instanced, Non-Destructive Block Trial (PURE). Proves the Signal Grid Trial
 * is deterministic, copies (never aliases/mutates) the stewardship style, latches nodes
 * only from server-validated positions, bounds the score, completes by stabilization or
 * timeout, is display-only, ignores any client-supplied score/outcome, and carries no
 * money/economy/ownership fields — and never mutates its inputs or public state.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTrial, addTrialPlayer, removeTrialPlayer, stepTrial, closeTrial, isTrialActive,
  trialChanged, trialStatePayload, nodesAreWalkable, trialNodes,
  TRIAL_DURATION_MS, NODE_RADIUS, SCORE_CAP, OBJECTIVE,
} from '../../arcade/city/city-battle-instance.mjs';
import { defaultBlockStyle, mergeBlockStyle } from '../../arcade/city/city-stewardship.mjs';
import { SCHEMA_VERSION } from '../../arcade/city/city-block.mjs';

const NOW = 9_000_000;
const STYLE = mergeBlockStyle(defaultBlockStyle(), 'arcade_front', { palette: 'amber' });
// place a member exactly on a node so it latches
const atNode = (state, idx) => { const n = state.signal_nodes[idx]; return { x: n.x, y: n.y }; };

test('all configured signal nodes are walkable, and there are SCORE_CAP of them', () => {
  assert.equal(nodesAreWalkable(), true);
  assert.equal(trialNodes().length, SCORE_CAP);
  assert.ok(SCORE_CAP >= 1);
});

test('createTrial starts ACTIVE with a COPIED stewardship style + objective', () => {
  const t = createTrial({ cityId: 'downtown-01', instanceId: 'tr1', now: NOW, copiedStyle: STYLE });
  assert.equal(t.status, 'active');
  assert.equal(t.objective, OBJECTIVE);
  assert.equal(t.schema_version, SCHEMA_VERSION);
  assert.equal(t.ends_at, NOW + TRIAL_DURATION_MS);
  assert.equal(t.score, 0);
  assert.equal(t.score_cap, SCORE_CAP);
  assert.equal(t.copied_style.arcade_front.palette, 'amber'); // the snapshot carries the style
  assert.equal(t.public_safe, true);
});

test('the trial does NOT mutate or alias the public stewardship style', () => {
  const live = defaultBlockStyle();
  const liveCopy = JSON.parse(JSON.stringify(live));
  const t = createTrial({ cityId: 'c', now: NOW, copiedStyle: live });
  // a step (which latches a node + completes) must never reach back into the public style
  let s = addTrialPlayer(t, 'player:a', NOW);
  s = stepTrial(s, { now: NOW + 10, positions: { 'player:a': atNode(s, 0) } }).state;
  s = closeTrial(s, NOW + 20);
  assert.deepEqual(live, liveCopy, 'public stewardship style is untouched');
  assert.notEqual(t.copied_style, live, 'copied style is a fresh object, not an alias');
});

test('a node latches only when a MEMBER is within NODE_RADIUS (server-validated position)', () => {
  let t = createTrial({ cityId: 'c', now: NOW, copiedStyle: STYLE });
  t = addTrialPlayer(t, 'player:a', NOW);
  // far away → no latch
  const far = stepTrial(t, { now: NOW + 100, positions: { 'player:a': { x: 10, y: 10 } } });
  assert.equal(far.state.score, 0);
  assert.equal(far.changed, false);
  // just outside the radius → no latch
  const n0 = t.signal_nodes[0];
  const justOut = stepTrial(t, { now: NOW + 100, positions: { 'player:a': { x: n0.x + NODE_RADIUS + 1, y: n0.y } } });
  assert.equal(justOut.state.score, 0);
  // inside the radius → latch
  const inside = stepTrial(t, { now: NOW + 100, positions: { 'player:a': { x: n0.x, y: n0.y } } });
  assert.equal(inside.state.score, 1);
  assert.equal(inside.changed, true);
  assert.equal(inside.state.signal_nodes[0].stabilized, true);
});

test('a NON-member standing on a node does not score', () => {
  let t = createTrial({ cityId: 'c', now: NOW, copiedStyle: STYLE });
  t = addTrialPlayer(t, 'player:a', NOW);
  const r = stepTrial(t, { now: NOW + 50, positions: { 'player:b': atNode(t, 0) } }); // b is not a member
  assert.equal(r.state.score, 0);
});

test('latches are monotonic and the score is bounded at SCORE_CAP → stabilized completion', () => {
  let t = createTrial({ cityId: 'c', now: NOW, copiedStyle: STYLE });
  t = addTrialPlayer(t, 'player:a', NOW);
  // visit every node in turn
  for (let i = 0; i < t.signal_nodes.length; i++) {
    t = stepTrial(t, { now: NOW + 100 + i, positions: { 'player:a': atNode(t, i) } }).state;
  }
  assert.equal(t.score, SCORE_CAP);
  assert.equal(t.status, 'complete');
  assert.equal(t.outcome.result, 'stabilized');
  assert.equal(t.outcome.stabilized, SCORE_CAP);
  // a finished trial does not score further
  const after = stepTrial(t, { now: NOW + 200, positions: { 'player:a': atNode(t, 0) } });
  assert.equal(after.changed, false);
  assert.equal(after.state.score, SCORE_CAP);
});

test('timer expiry completes the trial as a timeout', () => {
  let t = createTrial({ cityId: 'c', now: NOW, copiedStyle: STYLE });
  t = addTrialPlayer(t, 'player:a', NOW);
  const r = stepTrial(t, { now: NOW + TRIAL_DURATION_MS + 1, positions: {} });
  assert.equal(r.completed, true);
  assert.equal(r.state.status, 'complete');
  assert.equal(r.state.outcome.result, 'timeout');
});

test('a client-supplied score/outcome on the state is ignored (recomputed server-side)', () => {
  let t = createTrial({ cityId: 'c', now: NOW, copiedStyle: STYLE });
  t = addTrialPlayer(t, 'player:a', NOW);
  const forged = { ...t, score: 999, outcome: { result: 'win', cash: 1e9 } };
  const r = stepTrial(forged, { now: NOW + 10, positions: {} }); // nobody on a node
  assert.equal(r.state.score, 0);          // recomputed from nodes, not the forged 999
  assert.equal(r.state.outcome, null);     // still active, no forged outcome survives
});

test('addTrialPlayer/removeTrialPlayer are immutable and only mutate active trials', () => {
  const t = createTrial({ cityId: 'c', now: NOW, copiedStyle: STYLE });
  const a = addTrialPlayer(t, 'player:a', NOW);
  assert.notEqual(a, t);
  assert.deepEqual(Object.keys(t.players), []);     // original untouched
  assert.deepEqual(Object.keys(a.players), ['player:a']);
  const closed = closeTrial(a, NOW + 1);
  const b = addTrialPlayer(closed, 'player:b', NOW + 2); // cannot join a closed trial
  assert.deepEqual(Object.keys(b.players), ['player:a']);
});

test('closeTrial is idempotent and yields a display-only outcome', () => {
  let t = createTrial({ cityId: 'c', now: NOW, copiedStyle: STYLE });
  t = addTrialPlayer(t, 'player:a', NOW);
  const c1 = closeTrial(t, NOW + 5);
  assert.equal(c1.status, 'closed');
  assert.ok(c1.outcome && typeof c1.outcome.duration_ms === 'number');
  const c2 = closeTrial(c1, NOW + 6);
  assert.equal(c2.status, 'closed');
  assert.equal(isTrialActive(c1), false);
});

test('stepTrial does not mutate its inputs', () => {
  let t = createTrial({ cityId: 'c', now: NOW, copiedStyle: STYLE });
  t = addTrialPlayer(t, 'player:a', NOW);
  const tCopy = JSON.parse(JSON.stringify(t));
  const positions = { 'player:a': atNode(t, 0) };
  const posCopy = JSON.parse(JSON.stringify(positions));
  stepTrial(t, { now: NOW + 10, positions });
  assert.deepEqual(t, tCopy);
  assert.deepEqual(positions, posCopy);
});

test('output payload carries no money/economy/ownership fields', () => {
  let t = createTrial({ cityId: 'c', now: NOW, copiedStyle: STYLE });
  t = addTrialPlayer(t, 'player:a', NOW);
  t = stepTrial(t, { now: NOW + 10, positions: { 'player:a': atNode(t, 0) } }).state;
  const json = JSON.stringify(trialStatePayload(t));
  assert.ok(!/balance|ledger|inventory|ticket|cash|payout|reward|price|own(er|ership)|stake|wager|\bbet\b|rent|income|market|prize|loot|entry.?fee/i.test(json));
});

test('trialChanged detects status/score/member/node changes', () => {
  const a = createTrial({ cityId: 'c', now: NOW, copiedStyle: STYLE });
  const b = addTrialPlayer(a, 'player:a', NOW);
  assert.equal(trialChanged(a, a), false);
  assert.equal(trialChanged(a, b), true);
  const c = stepTrial(b, { now: NOW + 10, positions: { 'player:a': atNode(b, 0) } }).state;
  assert.equal(trialChanged(b, c), true);
});

test('deterministic: same inputs yield deep-equal results', () => {
  const t = addTrialPlayer(createTrial({ cityId: 'c', instanceId: 'x', now: NOW, copiedStyle: STYLE }), 'player:a', NOW);
  const args = { now: NOW + 10, positions: { 'player:a': atNode(t, 1) } };
  assert.deepEqual(stepTrial(t, args), stepTrial(t, args));
});
