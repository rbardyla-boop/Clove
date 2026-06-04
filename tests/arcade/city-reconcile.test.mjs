/**
 * Phase 4B — City client input-replay reconciliation (PURE). Proves the client's
 * prediction buffer records/acks/replays deterministically and that a large
 * divergence snaps while a small one eases — all without ever creating canonical
 * truth (the server position is always the replay origin).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInputBuffer, recordPendingInput, dropAcknowledgedInputs, replayPendingInputs,
  shouldSnapCorrection, reconcilePredictedState, SNAP_DIST,
} from '../../arcade/city/city-reconcile.mjs';
import { MAX_INPUT_BACKLOG, MOVEMENT } from '../../arcade/city/city-block.mjs';

test('recordPendingInput assigns monotonic seq and appends in order', () => {
  let buf = createInputBuffer();
  let r = recordPendingInput(buf, { dx: 1, dy: 0, dt: 50 }); buf = r.buffer;
  assert.equal(r.input.seq, 1);
  r = recordPendingInput(buf, { dx: 0, dy: 1, dt: 50 }); buf = r.buffer;
  assert.equal(r.input.seq, 2);
  assert.deepEqual(buf.pending.map((i) => i.seq), [1, 2]);
});

test('dropAcknowledgedInputs removes inputs the server already processed', () => {
  let buf = createInputBuffer();
  for (const v of [1, 1, 1]) buf = recordPendingInput(buf, { dx: v, dy: 0, dt: 50 }).buffer;
  buf = dropAcknowledgedInputs(buf, 2);
  assert.deepEqual(buf.pending.map((i) => i.seq), [3]);
  assert.deepEqual(dropAcknowledgedInputs(buf, 'x').pending.map((i) => i.seq), [3]); // bad ack = no-op
});

test('replayPendingInputs reproduces the server step deterministically, in seq order', () => {
  const start = { x: 500, y: 500, facing: 0 };
  const pending = [{ seq: 1, dx: 1, dy: 0, dt: 100 }, { seq: 2, dx: 1, dy: 0, dt: 100 }];
  const out = replayPendingInputs(start, pending);
  const step = MOVEMENT.MAX_SPEED * 0.1; // 22 units per 100ms input
  assert.ok(Math.abs(out.x - (500 + 2 * step)) < 1e-6);
  assert.equal(out.y, 500);
  // pure: replaying the same inputs again yields the same result
  assert.deepEqual(replayPendingInputs(start, pending), out);
});

test('replay starts from the SERVER position (no client-authoritative truth)', () => {
  // Even with pending inputs, the origin is the server position passed in.
  const out = replayPendingInputs({ x: 300, y: 500, facing: 0 }, []);
  assert.deepEqual(out, { x: 300, y: 500, facing: 0 });
});

test('shouldSnapCorrection: large error snaps, small error eases', () => {
  assert.equal(shouldSnapCorrection(SNAP_DIST + 1), true);
  assert.equal(shouldSnapCorrection(SNAP_DIST - 1), false);
  assert.equal(shouldSnapCorrection(Infinity), true);
});

test('reconcilePredictedState snaps when displayed diverges past threshold', () => {
  const serverPos = { x: 500, y: 500, facing: 0 };
  const big = reconcilePredictedState({ serverPos, pending: [], displayed: { x: 700, y: 500 } });
  assert.equal(big.snapped, true);
  assert.ok(Math.abs(big.predicted.x - 500) < 1e-6);
  const small = reconcilePredictedState({ serverPos, pending: [], displayed: { x: 505, y: 500 } });
  assert.equal(small.snapped, false);
});

test('reconcilePredictedState with no prior displayed snaps to predicted', () => {
  const r = reconcilePredictedState({ serverPos: { x: 500, y: 500, facing: 0 }, pending: [], displayed: null });
  assert.equal(r.snapped, true);
  assert.deepEqual(r.predicted, { x: 500, y: 500, facing: 0 });
});

test('input backlog overflow resyncs safely (clears pending, flags overflow)', () => {
  let buf = createInputBuffer();
  let last;
  for (let i = 0; i <= MAX_INPUT_BACKLOG; i++) { last = recordPendingInput(buf, { dx: 1, dy: 0, dt: 50 }); buf = last.buffer; }
  assert.equal(last.overflow, true);
  assert.equal(buf.pending.length, 0, 'pending cleared on overflow so replay stays bounded');
});
