/**
 * Neon Circuit — City client input-replay reconciliation (Phase 4B), PURE.
 *
 * Client-side prediction is VISUAL ONLY — it never creates canonical truth. The
 * client records each input intent it sends (by seq), advances a locally-predicted
 * position, and on every authoritative snapshot it: drops the inputs the server has
 * acknowledged, resets the predicted position to the server position, and REPLAYS
 * the still-pending inputs through the SAME pure step the server runs
 * (predictStep), so prediction matches the server in the no-loss case. A large
 * divergence snaps to the server (the server always wins).
 *
 * Imported by the browser scene and the unit tests. No DOM, no network.
 */
import { predictStep, MAX_INPUT_BACKLOG } from './city-block.mjs';

/** Default divergence (world units) beyond which the displayed position snaps. */
export const SNAP_DIST = 60;
/** Default per-frame easing of the displayed position toward the predicted target. */
export const DISPLAY_EASE = 0.2;

/** A fresh client input buffer (monotonic seq + ordered pending list). */
export function createInputBuffer() {
  return { pending: [], nextSeq: 0 };
}

/**
 * Record an input the client is about to send. Assigns the next seq and appends.
 * If the backlog exceeds MAX_INPUT_BACKLOG (server not acking — stall/disconnect),
 * flags `overflow` and clears pending so the caller can resync to the next snapshot
 * rather than replaying an unbounded list.
 */
export function recordPendingInput(buffer, { dx, dy, dt }) {
  const seq = buffer.nextSeq + 1;
  const input = { seq, dx, dy, dt };
  const pending = [...buffer.pending, input];
  const overflow = pending.length > MAX_INPUT_BACKLOG;
  return { buffer: { pending: overflow ? [] : pending, nextSeq: seq }, input, overflow };
}

/** Drop inputs the server has already processed (seq <= ackSeq). */
export function dropAcknowledgedInputs(buffer, ackSeq) {
  const ack = Number(ackSeq);
  if (!Number.isFinite(ack)) return buffer;
  return { ...buffer, pending: buffer.pending.filter((i) => i.seq > ack) };
}

/**
 * Replay pending inputs from a start position, deterministically, in seq order.
 * Uses the shared predictStep so the result equals the server's accepted path.
 */
export function replayPendingInputs(startPos, pending) {
  let pos = { x: startPos.x, y: startPos.y, facing: Number.isFinite(startPos.facing) ? startPos.facing : 0 };
  for (const inp of pending) pos = predictStep(pos, inp, inp.dt);
  return pos;
}

/** True when the displayed↔predicted error is too large to ease — snap instead. */
export function shouldSnapCorrection(errDist, threshold = SNAP_DIST) {
  return !Number.isFinite(errDist) || errDist > threshold;
}

/**
 * Reconcile on a snapshot: predicted = replay(serverPos, pending). Returns the
 * authoritative `predicted` target, the displayed↔predicted `error`, and whether
 * the caller should hard-`snap` the displayed position (no prior displayed, or
 * divergence past the threshold). When not snapping, the caller eases the displayed
 * position toward `predicted` over subsequent frames (DISPLAY_EASE).
 */
export function reconcilePredictedState({ serverPos, pending, displayed, snapThreshold = SNAP_DIST }) {
  const predicted = replayPendingInputs(serverPos, pending);
  const error = displayed ? Math.hypot(displayed.x - predicted.x, displayed.y - predicted.y) : Infinity;
  const snapped = shouldSnapCorrection(error, snapThreshold);
  return { predicted, error, snapped };
}
