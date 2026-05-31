/**
 * World fold engine.
 *
 * applyEvent runs one event through its reducer. fold runs an ordered list of
 * events to produce a world view plus the list of authority/semantic rejections.
 * Because fold is a pure function of (ordered events, ctx), replaying the same
 * accepted set always yields the same state — the convergence guarantee.
 */
import { createInitialState, DEFAULT_CTX, stateFingerprint } from './state-util.mjs';
import { getHandler } from './reducers/index.mjs';
import { summarizeEvent } from './events.mjs';

/**
 * Apply a single event. Advances logical time (state.tick) even on rejection so
 * the clock reflects what has been observed. Returns { state, accepted, reason }.
 */
export function applyEvent(state, event, ctx = DEFAULT_CTX) {
  const base = { ...state, tick: Math.max(state.tick, event.logical_tick) };
  const handler = getHandler(event.event_type);
  if (!handler) return { state: base, accepted: false, reason: 'no_handler' };
  return handler(base, event, ctx);
}

/**
 * Fold an ordered event list into a world view.
 * Returns { state, rejections, appliedCount, fingerprint }.
 */
export function fold(orderedEvents, ctx = DEFAULT_CTX) {
  let state = createInitialState();
  const rejections = [];
  let applied = 0;

  for (const ev of orderedEvents) {
    const res = applyEvent(state, ev, ctx);
    state = res.state;
    if (res.accepted) {
      applied += 1;
    } else {
      rejections.push({ phase: 'apply', reason: res.reason, summary: summarizeEvent(ev), event_id: ev.event_id });
    }
  }

  return { state, rejections, appliedCount: applied, fingerprint: stateFingerprint(state) };
}

/** Convenience: fold straight from a SidebandCRDTLog. */
export function foldLog(log, ctx = DEFAULT_CTX) {
  return fold(log.ordered(), ctx);
}

export { createInitialState, stateFingerprint, DEFAULT_CTX };
