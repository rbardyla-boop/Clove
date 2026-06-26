// Creator Freedom v1 — local-only retention core: best/grade/plays/recent by fingerprint, immutable + defensive.
// Run: node --test tests/creator/free-sandbox-retention.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, parseState, recordResult, getStats, recentList, gradeFor, serializeState, readStore, writeStore, RETENTION_KEY,
} from '../../arcade/creator/arcade-sandbox/free-sandbox-retention.mjs';

test('first play records best/plays and grades relative to nothing', () => {
  const { state, grade, is_best } = recordResult(emptyState(), { fp: 'sha256:aaa', name: 'My Game', score: 120, seed: 7, won: true });
  assert.equal(is_best, true);
  assert.equal(grade, 'A'); // first win
  const st = getStats(state, 'sha256:aaa');
  assert.equal(st.best, 120);
  assert.equal(st.plays, 1);
  assert.equal(st.last_seed, 7);
  assert.equal(st.won, true);
});

test('beating your own best grades S; falling short grades lower (relative scale, no fixed economy)', () => {
  let s = recordResult(emptyState(), { fp: 'f', name: 'g', score: 100, seed: 1, won: false }).state;
  const better = recordResult(s, { fp: 'f', name: 'g', score: 150, seed: 1, won: false });
  assert.equal(better.grade, 'S');
  assert.equal(better.is_best, true);
  const worse = recordResult(better.state, { fp: 'f', name: 'g', score: 60, seed: 1, won: false });
  assert.equal(worse.is_best, false);
  assert.ok(['C', 'D'].includes(worse.grade));
  assert.equal(getStats(worse.state, 'f').best, 150); // best is sticky
  assert.equal(getStats(worse.state, 'f').plays, 3);
});

test('recordResult never mutates the input state (immutability)', () => {
  const s0 = emptyState();
  const frozen = JSON.stringify(s0);
  recordResult(s0, { fp: 'x', name: 'x', score: 10, seed: 1, won: false });
  assert.equal(JSON.stringify(s0), frozen, 'input state unchanged');
});

test('recent list is most-recent-first, unique by fingerprint, capped', () => {
  let s = emptyState();
  for (let i = 0; i < 16; i++) s = recordResult(s, { fp: 'fp' + i, name: 'n' + i, score: i, seed: i, won: false }).state;
  const recent = recentList(s);
  assert.ok(recent.length <= 12, 'capped at 12');
  assert.equal(recent[0].fp, 'fp15', 'newest first');
  // replaying an old fingerprint moves it to the front without duplicating
  s = recordResult(s, { fp: 'fp15', name: 'n15', score: 99, seed: 1, won: true }).state;
  const r2 = recentList(s);
  assert.equal(r2[0].fp, 'fp15');
  assert.equal(r2.filter((r) => r.fp === 'fp15').length, 1, 'no duplicate');
});

test('parseState tolerates garbage and returns a clean empty state', () => {
  assert.deepEqual(parseState('not json'), emptyState());
  assert.deepEqual(parseState('null'), emptyState());
  assert.deepEqual(parseState('{"v":99}'), emptyState());
  // a valid round-trip survives
  const s = recordResult(emptyState(), { fp: 'a', name: 'A', score: 5, seed: 2, won: false }).state;
  assert.deepEqual(parseState(serializeState(s)), s);
});

test('gradeFor edge cases', () => {
  assert.equal(gradeFor(0, 0, false, true), 'C'); // first play, no score
  assert.equal(gradeFor(10, 0, true, true), 'A'); // first win
  assert.equal(gradeFor(200, 100, false, false), 'S'); // new best
  assert.equal(gradeFor(95, 100, true, false), 'A'); // close + won
  assert.equal(gradeFor(20, 100, false, false), 'D'); // far short
});

test('readStore/writeStore degrade safely on a throwing storage', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readStore(broken), emptyState());
  assert.equal(writeStore(broken, emptyState()), false);
  // a working fake storage round-trips
  const mem = {}; const storage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; } };
  const s = recordResult(emptyState(), { fp: 'z', name: 'Z', score: 7, seed: 3, won: true }).state;
  assert.equal(writeStore(storage, s), true);
  assert.equal(mem[RETENTION_KEY] !== undefined, true);
  assert.deepEqual(readStore(storage), s);
});
