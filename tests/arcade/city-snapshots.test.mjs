/**
 * Phase 4B — City remote-player snapshot buffer + interpolation (PURE). Proves
 * snapshots insert in server-time order, tolerate out-of-order/duplicate arrival,
 * interpolate between two canonical states, prune stale entries, and fail safe when
 * data is missing (hold last / empty before first).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSnapshotBuffer, pushSnapshot, sampleSnapshotAt, interpolatePlayerState,
  pruneOldSnapshots, latestServerTime,
} from '../../arcade/city/city-snapshots.mjs';

const snap = (t, players) => ({ serverTime: t, players });
const P = (id, x, y, facing = 0) => ({ id, x, y, facing });

test('pushSnapshot keeps snapshots sorted, dedups identical times, tolerates out-of-order', () => {
  let b = createSnapshotBuffer({ maxAgeMs: 10_000 });
  b = pushSnapshot(b, snap(100, [P('a', 0, 0)]));
  b = pushSnapshot(b, snap(300, [P('a', 20, 0)]));
  b = pushSnapshot(b, snap(200, [P('a', 10, 0)])); // out of order
  b = pushSnapshot(b, snap(200, [P('a', 11, 0)])); // duplicate time → replaces
  assert.deepEqual(b.snaps.map((s) => s.serverTime), [100, 200, 300]);
  assert.equal(b.snaps[1].players[0].x, 11);
  assert.equal(latestServerTime(b), 300);
});

test('pushSnapshot ignores malformed input', () => {
  let b = createSnapshotBuffer();
  b = pushSnapshot(b, null);
  b = pushSnapshot(b, { serverTime: NaN, players: [] });
  b = pushSnapshot(b, { serverTime: 1, players: 'nope' });
  assert.equal(b.snaps.length, 0);
});

test('interpolatePlayerState lerps position and takes the shortest facing arc', () => {
  const mid = interpolatePlayerState(P('a', 0, 0, 0), P('a', 10, 20, Math.PI / 2), 0.5);
  assert.ok(Math.abs(mid.x - 5) < 1e-9 && Math.abs(mid.y - 10) < 1e-9);
  // shortest arc from +3.0 rad to -3.0 rad goes the short way (through ±pi), not back through 0
  const wrap = interpolatePlayerState(P('a', 0, 0, 3.0), P('a', 0, 0, -3.0), 0.5);
  assert.ok(Math.abs(wrap.facing) > 3.0, 'interpolated facing wraps the short way');
});

test('sampleSnapshotAt interpolates between the bracketing snapshots', () => {
  let b = createSnapshotBuffer({ maxAgeMs: 10_000 });
  b = pushSnapshot(b, snap(100, [P('a', 0, 0)]));
  b = pushSnapshot(b, snap(200, [P('a', 100, 0)]));
  const at = sampleSnapshotAt(b, 150);
  assert.equal(at.length, 1);
  assert.ok(Math.abs(at[0].x - 50) < 1e-6, 'halfway between 0 and 100');
});

test('sampleSnapshotAt holds endpoints before first / after last (fail safe on gap)', () => {
  let b = createSnapshotBuffer({ maxAgeMs: 10_000 });
  assert.deepEqual(sampleSnapshotAt(b, 123), []); // nothing buffered yet
  b = pushSnapshot(b, snap(100, [P('a', 5, 5)]));
  b = pushSnapshot(b, snap(200, [P('a', 9, 9)]));
  assert.equal(sampleSnapshotAt(b, 50)[0].x, 5);   // before first → hold first
  assert.equal(sampleSnapshotAt(b, 999)[0].x, 9);  // after last → hold last
});

test('sampleSnapshotAt holds a player who left in the later snapshot, includes one who joined', () => {
  let b = createSnapshotBuffer({ maxAgeMs: 10_000 });
  b = pushSnapshot(b, snap(100, [P('a', 0, 0), P('b', 0, 0)]));
  b = pushSnapshot(b, snap(200, [P('a', 100, 0), P('c', 50, 50)])); // b left, c joined
  const at = sampleSnapshotAt(b, 150);
  const ids = at.map((p) => p.id).sort();
  assert.deepEqual(ids, ['a', 'b', 'c']);
});

test('pruneOldSnapshots drops entries older than maxAge', () => {
  let b = createSnapshotBuffer({ maxAgeMs: 100 });
  b = pushSnapshot(b, snap(1000, [P('a', 0, 0)]));
  b = pushSnapshot(b, snap(1200, [P('a', 1, 0)])); // push prunes relative to newest (1200-100=1100) → drops 1000
  assert.deepEqual(b.snaps.map((s) => s.serverTime), [1200]);
  b = pruneOldSnapshots(b, 2000);
  assert.equal(b.snaps.length, 0);
});
