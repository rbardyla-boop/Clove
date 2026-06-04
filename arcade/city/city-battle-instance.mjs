/**
 * Neon Circuit — Instanced, Non-Destructive Block Trial (Phase 4G), PURE.
 *
 * The roadmap name is "Block Battle"; the product surface is a **Block Trial** running the
 * **Signal Grid Trial** objective: a temporary, isolated gameplay instance that COPIES a
 * safe snapshot of the block's stewardship style, lets players COOPERATIVELY stabilize a
 * small set of signal nodes against a server timer, emits a public-safe ephemeral outcome,
 * and is then discarded. It is NOT:
 *   war / weapons / combat / damage / gambling / wagering / paid entry / ownership /
 *   a way to steal, damage, capture, buy, sell, rent, or transfer a public block.
 * The live public city and its canonical stewardship style are NEVER edited by a trial.
 *
 * Authority: the SERVER owns instance creation, membership, the copied style snapshot,
 * the timer, node state, score, and outcome. Players move with the EXISTING authoritative
 * city movement (city-block.mjs); this module only reads server-validated positions and
 * latches nodes — so the client can never assert score or outcome. This module performs
 * no I/O, no mutation of its inputs, and no mutation of public city / stewardship state.
 *
 * Imported by the CityRoom DO, the city dev shim, the unit tests, and the browser.
 */
import { SCHEMA_VERSION, isWalkable } from './city-block.mjs';
import { normalizeBlockStyle } from './city-stewardship.mjs';

/** Trial round length (ms). The server owns the clock; expiry → a timeout completion. */
export const TRIAL_DURATION_MS = 60_000;
/** A signal node latches `stabilized` when a trial member's center is within this radius (units). */
export const NODE_RADIUS = 48;
/** The single Phase 4G objective. */
export const OBJECTIVE = 'signal_grid_trial';

/** Fixed, deterministic signal-node anchors on the open plaza/road (verified walkable). */
const NODE_ANCHORS = Object.freeze([
  { id: 'sig-n', x: 500, y: 250 }, // vertical road, north of centre
  { id: 'sig-w', x: 250, y: 500 }, // horizontal road, west
  { id: 'sig-e', x: 750, y: 500 }, // horizontal road, east
]);
/** The bounded score ceiling = the node count. */
export const SCORE_CAP = NODE_ANCHORS.length;

/** PURE: fresh, un-stabilized signal nodes. */
export function trialNodes() {
  return NODE_ANCHORS.map((n) => ({ id: n.id, x: n.x, y: n.y, stabilized: false }));
}

/** PURE: are all the configured node anchors legal (walkable) positions? (used by tests) */
export function nodesAreWalkable() {
  return NODE_ANCHORS.every((n) => isWalkable(n.x, n.y));
}

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/**
 * PURE: create a fresh ACTIVE trial. The stewardship style is COPIED (normalized) into a
 * fresh snapshot — never aliased — so nothing the trial does can reach public state.
 */
export function createTrial({ cityId, instanceId, now = Date.now(), copiedStyle = null, durationMs = TRIAL_DURATION_MS } = {}) {
  const dur = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : TRIAL_DURATION_MS;
  return {
    schema_version: SCHEMA_VERSION,
    instance_id: (typeof instanceId === 'string' && instanceId) ? instanceId : `trial-${now}`,
    city_id: (typeof cityId === 'string' && cityId) ? cityId : 'city',
    status: 'active',
    objective: OBJECTIVE,
    started_at: now,
    ends_at: now + dur,
    players: {},                                   // playerId -> { joined_at }
    copied_style: normalizeBlockStyle(copiedStyle), // a COPY — public stewardship is untouched
    signal_nodes: trialNodes(),
    score: 0,
    score_cap: SCORE_CAP,
    outcome: null,
    public_safe: true,
  };
}

/** PURE: add a member to a trial (only while active; idempotent). Returns a new state. */
export function addTrialPlayer(state, playerId, now = Date.now()) {
  if (!isTrialActive(state) || typeof playerId !== 'string' || !playerId) return state;
  if (state.players[playerId]) return state;
  return { ...state, players: { ...state.players, [playerId]: { joined_at: now } } };
}

/** PURE: remove a member from a trial (leave / disconnect). Returns a new state. */
export function removeTrialPlayer(state, playerId) {
  if (!state || !state.players || !state.players[playerId]) return state;
  const players = { ...state.players };
  delete players[playerId];
  return { ...state, players };
}

/**
 * PURE: advance the trial from SERVER-VALIDATED member positions. Latches any node a member
 * is standing within (monotonic), recomputes the bounded score, and completes the trial when
 * all nodes are stabilized (`stabilized`) or the timer elapses (`timeout`). Never mutates the
 * input state, the positions map, or anything else. Score/outcome are recomputed here, so a
 * client-supplied score/outcome on `state` is always overwritten.
 *
 * @param positions { [playerId]: {x,y} } authoritative city positions of trial members
 * @returns { state, changed, completed }
 */
export function stepTrial(state, { now = Date.now(), positions = {} } = {}) {
  if (!isTrialActive(state)) return { state, changed: false, completed: false };
  let latched = false;
  const memberIds = Object.keys(state.players);
  const nodes = state.signal_nodes.map((n) => {
    if (n.stabilized) return n;
    for (const pid of memberIds) {
      const p = positions[pid];
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y) && dist(p.x, p.y, n.x, n.y) <= NODE_RADIUS) {
        latched = true;
        return { ...n, stabilized: true };
      }
    }
    return n;
  });
  const stabilized = nodes.reduce((c, n) => c + (n.stabilized ? 1 : 0), 0);

  // An ACTIVE trial has no outcome; the outcome is authored ONLY when this step completes
  // it, so a client-supplied `outcome` on the incoming state can never survive.
  let status = state.status;
  let outcome = null;
  let completed = false;
  if (stabilized >= nodes.length) {
    status = 'complete';
    outcome = { result: 'stabilized', stabilized, node_count: nodes.length, duration_ms: now - state.started_at };
    completed = true;
  } else if (now >= state.ends_at) {
    status = 'complete';
    outcome = { result: 'timeout', stabilized, node_count: nodes.length, duration_ms: state.ends_at - state.started_at };
    completed = true;
  }
  const next = { ...state, signal_nodes: nodes, score: stabilized, status, outcome };
  return { state: next, changed: latched || completed, completed };
}

/** PURE: close/discard a trial (host or member ends it early). Idempotent. Returns a new state. */
export function closeTrial(state, now = Date.now()) {
  if (!state) return state;
  if (state.status === 'closed') return state;
  const stabilized = (state.signal_nodes || []).reduce((c, n) => c + (n.stabilized ? 1 : 0), 0);
  const outcome = state.outcome || { result: 'closed', stabilized, node_count: (state.signal_nodes || []).length, duration_ms: now - state.started_at };
  return { ...state, status: 'closed', outcome };
}

/** PURE: is this an active (joinable, scoring) trial? */
export function isTrialActive(state) {
  return !!state && state.status === 'active';
}

/** PURE: a reduced signature for change-detection (status | score | members | node latches). */
function trialSignature(state) {
  if (!state) return 'none';
  return [state.status, state.score, Object.keys(state.players).sort().join(','), state.signal_nodes.map((n) => (n.stabilized ? 1 : 0)).join('')].join('|');
}
/** PURE: has the displayed trial state meaningfully changed? */
export function trialChanged(prev, next) {
  return trialSignature(prev) !== trialSignature(next);
}

/** PURE: public-safe wire payload of the current trial (display only; tokens/coords only). */
export function trialStatePayload(state) {
  if (!state) return { schema_version: SCHEMA_VERSION, trial: null };
  const stabilized = state.signal_nodes.reduce((c, n) => c + (n.stabilized ? 1 : 0), 0);
  return {
    schema_version: SCHEMA_VERSION,
    trial: {
      instance_id: state.instance_id,
      city_id: state.city_id,
      status: state.status,
      objective: state.objective,
      started_at: state.started_at,
      ends_at: state.ends_at,
      score: state.score,
      score_cap: state.score_cap,
      node_count: state.signal_nodes.length,
      stabilized_count: stabilized,
      players: Object.keys(state.players),
      copied_style: normalizeBlockStyle(state.copied_style),
      signal_nodes: state.signal_nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, stabilized: n.stabilized })),
      outcome: state.outcome,
      public_safe: true,
    },
  };
}
