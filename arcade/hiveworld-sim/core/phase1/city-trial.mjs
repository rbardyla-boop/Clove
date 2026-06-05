/**
 * HiveWorld v1.1 — NON-DESTRUCTIVE instanced Block Trial (mirror of product Phase 4G
 * `arcade/city/city-battle-instance.mjs`).
 *
 * PURE, deterministic. A trial is an INSTANCED, EPHEMERAL match (open → active → completed → closed)
 * that lives entirely in its own state. It NEVER references or mutates the public block (its identity,
 * style, presence, or population) — the public block is byte-identical before and after a trial. It
 * grants NO economy, tickets, or ownership. Score is a bounded internal counter only.
 */
export const TRIAL_OBJECTIVE = 'signal_grid';
export const TRIAL_SCORE_CAP = 3;
export const TRIAL_STATUSES = Object.freeze(['open', 'active', 'completed', 'closed']);

/** PURE: open a fresh trial instance for a block. */
export function createTrial(cityId, instanceId) {
  return {
    instance_id: String(instanceId),
    city_id: String(cityId),
    status: 'open',
    players: {},
    score: 0,
    score_cap: TRIAL_SCORE_CAP,
    objective: TRIAL_OBJECTIVE,
  };
}

/** PURE: a player joins an open/active trial (idempotent). Returns a NEW trial; never mutates input. */
export function addTrialPlayer(trial, playerId) {
  if (!trial || trial.status === 'completed' || trial.status === 'closed') return trial;
  const players = { ...trial.players, [playerId]: true };
  const status = trial.status === 'open' ? 'active' : trial.status;
  return { ...trial, players, status };
}

/** PURE: advance the trial one step (stabilize a node). Completes at the cap. New trial. */
export function stepTrial(trial) {
  if (!trial || trial.status !== 'active') return trial;
  const score = Math.min(trial.score_cap, trial.score + 1);
  const status = score >= trial.score_cap ? 'completed' : 'active';
  return { ...trial, score, status };
}

/** PURE: close a trial. The public block is untouched (non-destructive). New trial. */
export function closeTrial(trial) {
  if (!trial) return trial;
  return { ...trial, status: 'closed' };
}

export function isTrialActive(trial) {
  return !!trial && (trial.status === 'open' || trial.status === 'active');
}

/** PURE: a public-safe summary of a trial (no private player data — only a count + the public state). */
export function trialPayload(trial) {
  if (!trial) return null;
  return {
    instance_id: trial.instance_id,
    city_id: trial.city_id,
    status: trial.status,
    objective: trial.objective,
    score: trial.score,
    score_cap: trial.score_cap,
    player_count: Object.keys(trial.players || {}).length,
    public_safe: true,
  };
}
