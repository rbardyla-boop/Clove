import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../../mission-001-app.js', import.meta.url), 'utf8');
const storeSource = await readFile(new URL('../../mission-private-store.js', import.meta.url), 'utf8');

const OUTCOMES = Object.freeze(['done', 'partly', 'failed', 'not_started']);

function keyOf(state) {
  if (state === null) return 'empty';
  if (state.status === 'debrief') return `debrief:${state.outcome}`;
  return state.status;
}

const transitions = Object.freeze({
  empty: Object.freeze({ SELECT_CLASS: 'planning' }),
  planning: Object.freeze({ RESELECT_CLASS: 'planning', CHANGE_CLASS: 'empty', COMMIT: 'committed' }),
  committed: Object.freeze({ EDIT: 'committed', RECOMMIT: 'committed', LEAVE: 'left' }),
  left: Object.freeze({
    MARK_RETURNED: 'left',
    RETURN_DONE: 'debrief:done',
    RETURN_PARTLY: 'debrief:partly',
    RETURN_FAILED: 'debrief:failed',
    RETURN_NOT_STARTED: 'debrief:not_started',
  }),
  'debrief:done': Object.freeze({ SAVE_DEBRIEF: 'complete' }),
  'debrief:partly': Object.freeze({ SAVE_DEBRIEF: 'complete' }),
  'debrief:failed': Object.freeze({ SAVE_DEBRIEF: 'complete' }),
  'debrief:not_started': Object.freeze({ SAVE_DEBRIEF: 'complete' }),
  complete: Object.freeze({ NEW_MISSION: 'empty', LEAVE_CLOVE: 'complete' }),
});

function nextState(stateKey, event) {
  const next = transitions[stateKey]?.[event];
  if (!next) throw new Error(`illegal_transition:${stateKey}:${event}`);
  return next;
}

function run(events) {
  let state = 'empty';
  for (const event of events) state = nextState(state, event);
  return state;
}

for (const outcome of OUTCOMES) {
  const event = {
    done: 'RETURN_DONE',
    partly: 'RETURN_PARTLY',
    failed: 'RETURN_FAILED',
    not_started: 'RETURN_NOT_STARTED',
  }[outcome];
  test(`formal oracle admits the full ${outcome} path and only ends complete after debrief`, () => {
    assert.equal(run(['SELECT_CLASS', 'COMMIT', 'LEAVE', event]), `debrief:${outcome}`);
    assert.equal(run(['SELECT_CLASS', 'COMMIT', 'LEAVE', event, 'SAVE_DEBRIEF']), 'complete');
  });
}

test('formal oracle retains supported same-stage operations', () => {
  assert.equal(run(['SELECT_CLASS', 'RESELECT_CLASS', 'COMMIT', 'RECOMMIT', 'LEAVE', 'MARK_RETURNED', 'RETURN_DONE', 'SAVE_DEBRIEF']), 'complete');
  assert.equal(run(['SELECT_CLASS', 'COMMIT', 'EDIT', 'LEAVE', 'RETURN_DONE', 'SAVE_DEBRIEF']), 'complete');
  assert.equal(run(['SELECT_CLASS', 'COMMIT', 'LEAVE', 'RETURN_DONE', 'SAVE_DEBRIEF', 'NEW_MISSION']), 'empty');
});

for (const [state, event] of [
  ['empty', 'LEAVE'],
  ['empty', 'SAVE_DEBRIEF'],
  ['planning', 'LEAVE'],
  ['planning', 'RETURN_DONE'],
  ['committed', 'RETURN_DONE'],
  ['left', 'COMMIT'],
  ['debrief:done', 'LEAVE'],
  ['debrief:failed', 'NEW_MISSION'],
  ['complete', 'COMMIT'],
]) {
  test(`formal oracle rejects known-bad transition ${state} -> ${event}`, () => {
    assert.throws(() => nextState(state, event), /illegal_transition/);
  });
}

test('persisted state keying rejects an unrecognized debrief outcome at the model boundary', () => {
  const key = keyOf({ status: 'debrief', outcome: 'made_up' });
  assert.equal(key, 'debrief:made_up');
  assert.equal(Object.hasOwn(transitions, key), false);
});

test('runtime controller enforces both persisted-state shape and transition order before writes', () => {
  assert.match(appSource, /validPersistedState\(next\)/);
  assert.match(appSource, /validStateTransition\(state,\s*next\)/);
  assert.match(appSource, /mission_transition_invalid/);
});

function appPrivacyGuard(source) {
  const hasPrivateStoreWrite = /ClovePrivateStore\.set\(KEY,\s*next\)/.test(source);
  const hasDirectMissionWrite = /localStorage\.setItem\(\s*(?:KEY|['"]clove_v2_mission_001['"])/.test(source);
  const serializesWholeStateIntoSignal = /function signal\([\s\S]*?JSON\.stringify\(\s*state\s*\)/.test(source);
  return hasPrivateStoreWrite && !hasDirectMissionWrite && !serializesWholeStateIntoSignal;
}

test('current Mission controller passes the privacy write guard', () => {
  assert.equal(appPrivacyGuard(appSource), true);
  assert.match(storeSource, /AES-GCM/);
});

test('negative-control plaintext Mission mutation is rejected by the privacy guard', () => {
  const mutated = appSource.replace(
    'await window.ClovePrivateStore.set(KEY, next);',
    "localStorage.setItem(KEY, JSON.stringify(next));"
  );
  assert.notEqual(mutated, appSource, 'negative control mutation did not apply');
  assert.equal(appPrivacyGuard(mutated), false);
});

test('negative-control whole-state telemetry mutation is rejected by the privacy guard', () => {
  const marker = "const body = JSON.stringify(payload);";
  const mutated = appSource.replace(marker, "const body = JSON.stringify(state);");
  assert.notEqual(mutated, appSource, 'negative control mutation did not apply');
  assert.equal(appPrivacyGuard(mutated), false);
});
