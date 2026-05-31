/**
 * weather (ephemeral), event_log finish_round (durable) and agent_intent
 * (proposal-only) reducers.
 *
 * agent_intent is the load-bearing safety case: it is ALWAYS "accepted" as a
 * recorded proposal, but it writes only to state.intents and can never touch
 * occupancy, slots or the economy. So an agent shouting "I now own the cabinet"
 * on the intent channel changes nothing authoritative.
 */
import { withKey, ok, rej } from '../state-util.mjs';

export function weather_set(state, ev) {
  const cellId = ev.cell_id ?? ev.payload?.cellId;
  if (typeof cellId !== 'string') return rej(state, 'bad_cell');
  const entry = { kind: ev.payload?.kind || 'clear', lastTick: ev.logical_tick };
  return ok({ ...state, weather: withKey(state.weather, cellId, entry) });
}

export function finish_round(state, ev) {
  const p = ev.payload || {};
  const entry = {
    tick: ev.logical_tick,
    actor: ev.actor_id,
    type: 'finish_round',
    machineId: p.machineId || null,
    score: Number.isFinite(p.score) ? p.score : 0,
    accuracy: Number.isFinite(p.accuracy) ? p.accuracy : 0,
    grade: p.grade || '—',
    hits: Number.isFinite(p.hits) ? p.hits : 0,
    bestStreak: Number.isFinite(p.bestStreak) ? p.bestStreak : 0,
  };
  return ok({ ...state, eventLog: [...state.eventLog, entry] });
}

export function agent_intent(state, ev) {
  // Recorded, never authoritative.
  const entry = { type: ev.payload?.intent || 'unspecified', payload: ev.payload || {}, tick: ev.logical_tick };
  return ok({ ...state, intents: withKey(state.intents, ev.actor_id, entry) });
}
