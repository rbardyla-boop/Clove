/**
 * City-systems reducers (HiveWorld v1.1 — Phase 4C–4G deep mirror).
 *
 * Folds, onto the v1.0 `state.district` substrate, five product city systems — each public-safe and
 * with its product safety posture ENFORCED IN THE FOLD:
 *   4C city world log   — append-only, bounded (FIFO 50), monotonic seq, sanitized allowlist.
 *   4D pressure         — NON-AUTHORITATIVE derived mood (nothing reads it back as authority).
 *   4E host rank        — NON-CASH reputation tier (no economic field anywhere).
 *   4F stewardship      — CONSTRAINED (closed allowlist) + host-rank-gated + REVERSIBLE (reset → default).
 *   4G block trial      — INSTANCED + NON-DESTRUCTIVE (never touches the public block/style/presence).
 *
 * Deterministic + convergent under reorder/dup (pure functions of the canonically-ordered fold). No
 * economy/accounts/ownership/money is folded here.
 */
import { ok, rej } from '../state-util.mjs';
import { isKnownBlock } from '../phase1/city-blocks.mjs';
import { appendCityWorldEvent, recentCityEvents, CITY_LOG_MAX } from '../phase1/city-world-log.mjs';
import { derivePressure } from '../phase1/city-pressure.mjs';
import { deriveHostRank } from '../phase1/city-host-rank.mjs';
import { defaultStyle, sanitizeStyleOverride, mergeStyle, isStewardEligible } from '../phase1/city-stewardship.mjs';
import { createTrial, addTrialPlayer, stepTrial, closeTrial, isTrialActive } from '../phase1/city-trial.mjs';

// ── helpers ──────────────────────────────────────────────────────────────────
function population(d, cityId) {
  let n = 0;
  for (const c of Object.values(d.actorBlock)) if (c === cityId) n += 1;
  return n;
}
function recentForBlock(d, cityId, n = 20) {
  return recentCityEvents(d.cityLog, CITY_LOG_MAX).filter((e) => e.city_id === cityId).slice(-n);
}
function effectiveStyle(d, cityId) {
  return d.stewardship[cityId] || defaultStyle(cityId);
}
function withLog(d, entry) {
  return { ...d, cityLog: appendCityWorldEvent(d.cityLog, entry) };
}
function commit(state, d) {
  return ok({ ...state, district: d });
}

// ── 4C: explicit public-safe world-log append (block authority) ────────────────
export function city_world_event(state, ev) {
  const cityId = ev.cell_id;
  if (!isKnownBlock(cityId)) return rej(state, 'unknown_block');
  if (ev.actor_id !== cityId) return rej(state, 'not_authority');
  const p = ev.payload || {};
  const type = typeof p.note_type === 'string' && p.note_type ? p.note_type : 'city_note';
  return commit(state, withLog(state.district, { type, cityId, actorPublicId: cityId, payload: p, tick: ev.logical_tick }));
}

// ── 4D: NON-AUTHORITATIVE pressure observation (block authority) ────────────────
export function city_pressure_observed(state, ev) {
  const cityId = ev.cell_id;
  if (!isKnownBlock(cityId)) return rej(state, 'unknown_block');
  if (ev.actor_id !== cityId) return rej(state, 'not_authority');
  const d = state.district;
  const snap = derivePressure({ recentEvents: recentForBlock(d, cityId), population: population(d, cityId) });
  return commit(state, { ...d, pressure: { ...d.pressure, [cityId]: snap } });
}

// ── 4E: NON-CASH host-rank evaluation (block authority) ────────────────────────
export function city_host_rank_evaluated(state, ev) {
  const cityId = ev.cell_id;
  if (!isKnownBlock(cityId)) return rej(state, 'unknown_block');
  if (ev.actor_id !== cityId) return rej(state, 'not_authority');
  const d = state.district;
  const next = deriveHostRank({ recentEvents: recentForBlock(d, cityId), pressure: d.pressure[cityId] || null });
  const prev = d.hostRank[cityId];
  let nd = { ...d, hostRank: { ...d.hostRank, [cityId]: next } };
  if (!prev || prev.tier !== next.tier) {
    nd = withLog(nd, { type: 'city_host_rank_changed', cityId, actorPublicId: cityId, payload: { tier: next.tier, support_signal: next.support_signal }, tick: ev.logical_tick });
  }
  return commit(state, nd);
}

// ── 4F: CONSTRAINED + host-rank-gated + REVERSIBLE stewardship ──────────────────
export function city_stewardship_applied(state, ev) {
  const cityId = ev.cell_id;
  if (!isKnownBlock(cityId)) return rej(state, 'unknown_block');
  if (ev.actor_id !== cityId) return rej(state, 'not_authority');
  const d = state.district;
  if (!isStewardEligible(d.hostRank[cityId])) return rej(state, 'not_eligible'); // gated by host rank
  const sanitized = sanitizeStyleOverride((ev.payload || {}).style);
  if (Object.keys(sanitized).length === 0) return rej(state, 'no_valid_fields'); // closed allowlist
  const next = mergeStyle(effectiveStyle(d, cityId), sanitized);
  let nd = { ...d, stewardship: { ...d.stewardship, [cityId]: next } };
  nd = withLog(nd, { type: 'city_stewardship_applied', cityId, actorPublicId: cityId, payload: { palette: next.palette, sign_variant: next.sign_variant, intensity: next.intensity }, tick: ev.logical_tick });
  return commit(state, nd);
}

export function city_stewardship_reset(state, ev) {
  const cityId = ev.cell_id;
  if (!isKnownBlock(cityId)) return rej(state, 'unknown_block');
  if (ev.actor_id !== cityId) return rej(state, 'not_authority');
  const d = state.district;
  const stewardship = { ...d.stewardship };
  delete stewardship[cityId]; // reversible: drop the override → effective falls back to the default
  const def = defaultStyle(cityId);
  const nd = withLog({ ...d, stewardship }, { type: 'city_stewardship_reset', cityId, actorPublicId: cityId, payload: { palette: def.palette }, tick: ev.logical_tick });
  return commit(state, nd);
}

// ── 4G: INSTANCED, NON-DESTRUCTIVE block trial (never touches the public block) ──
export function city_block_trial_opened(state, ev) {
  const cityId = ev.cell_id;
  const actor = ev.actor_id;
  if (!isKnownBlock(cityId)) return rej(state, 'unknown_block');
  const d = state.district;
  if (d.actorBlock[actor] !== cityId) return rej(state, 'not_in_block'); // run a trial only where you are
  if (isTrialActive(d.trials[cityId])) return rej(state, 'trial_active');
  const instanceId = (ev.payload && ev.payload.instance_id) || `trial:${cityId}:${ev.logical_tick}`;
  const trial = addTrialPlayer(createTrial(cityId, instanceId), actor);
  let nd = { ...d, trials: { ...d.trials, [cityId]: trial } };
  nd = withLog(nd, { type: 'city_block_trial_opened', cityId, actorPublicId: cityId, payload: { objective: trial.objective }, tick: ev.logical_tick });
  return commit(state, nd);
}

export function city_block_trial_joined(state, ev) {
  const cityId = ev.cell_id;
  const actor = ev.actor_id;
  const d = state.district;
  if (d.actorBlock[actor] !== cityId) return rej(state, 'not_in_block');
  if (!isTrialActive(d.trials[cityId])) return rej(state, 'no_active_trial');
  const trial = addTrialPlayer(d.trials[cityId], actor);
  return commit(state, { ...d, trials: { ...d.trials, [cityId]: trial } });
}

export function city_block_trial_stepped(state, ev) {
  const cityId = ev.cell_id;
  const actor = ev.actor_id;
  const d = state.district;
  const trial = d.trials[cityId];
  if (!trial || trial.status !== 'active') return rej(state, 'no_active_trial');
  if (!trial.players[actor]) return rej(state, 'not_a_player');
  const next = stepTrial(trial);
  let nd = { ...d, trials: { ...d.trials, [cityId]: next } };
  if (next.status === 'completed') {
    nd = withLog(nd, { type: 'city_block_trial_completed', cityId, actorPublicId: cityId, payload: { score: next.score, score_cap: next.score_cap }, tick: ev.logical_tick });
  }
  return commit(state, nd);
}

export function city_block_trial_closed(state, ev) {
  const cityId = ev.cell_id;
  const d = state.district;
  const trial = d.trials[cityId];
  if (!trial) return rej(state, 'no_trial');
  const trials = { ...d.trials, [cityId]: closeTrial(trial) };
  const nd = withLog({ ...d, trials }, { type: 'city_block_trial_closed', cityId, actorPublicId: cityId, payload: {}, tick: ev.logical_tick });
  return commit(state, nd);
}
