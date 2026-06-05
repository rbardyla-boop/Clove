/**
 * HiveWorld v1.1 — city-systems scenarios (Phase 4C–4G deep mirror), shared by tests + the debug UI.
 *
 * Each builds a HiveSimulator with a per-block authority node + agents, drives a deterministic flow,
 * and returns { sim, report, events } (events = raw signed list, for reorder/dup convergence proofs).
 */
import { HiveSimulator } from '../core/simulator.mjs';
import { CITY_IDS } from '../core/phase1/city-blocks.mjs';
import {
  joinBlock, worldEvent, observePressure, evaluateHostRank, stewardshipApply, stewardshipReset,
  trialOpen, trialJoin, trialStep, trialClose,
} from '../core/phase1/city-events.mjs';
import { refold } from './city-district.mjs';

function cityWorld(seed) {
  const sim = new HiveSimulator({ seed });
  const blocks = {};
  for (const id of CITY_IDS) blocks[id] = sim.addRoom({ id, name: id });
  return { sim, blocks };
}

/** Run N full trial cycles for `actor` in `cityId`, building host-rank activity; returns next tick. */
function runTrialCycles(emitPub, actor, cityId, n, t) {
  for (let i = 0; i < n; i++) {
    emitPub(trialOpen(actor, cityId, `${cityId}-tr-${i}`, t++));
    emitPub(trialStep(actor, cityId, t++));
    emitPub(trialStep(actor, cityId, t++));
    emitPub(trialStep(actor, cityId, t++)); // 3 steps → cap → completed
    emitPub(trialClose(actor, cityId, t++));
  }
  return t;
}

export { refold };

// ── 1. cityLogAppendBounded (4C) ────────────────────────────────────────────────
export function cityLogAppendBounded({ seed = 'cs-log' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  // append more than the FIFO bound with a hostile payload (private fields must be stripped)
  for (let i = 0; i < 60; i++) {
    pub(worldEvent(blocks['downtown-01'], 'downtown-01', 'beacon', { reason: `b${i}`, balance: 999, playerId: 'p', url: 'http://x' }, i + 1));
  }
  sim.advance(1);
  return { sim, report: sim.report(), events };
}

// ── 2. pressureDerivesNonAuthoritative (4D) ─────────────────────────────────────
export function pressureDerivesNonAuthoritative({ seed = 'cs-pressure' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  pub(joinBlock(a, 'downtown-01', 0));
  let t = runTrialCycles(pub, a, 'downtown-01', 2, 1);
  pub(observePressure(blocks['downtown-01'], 'downtown-01', t++));
  sim.advance(1);
  return { sim, report: sim.report(), events };
}

// ── 3. hostRankNonCash (4E) ─────────────────────────────────────────────────────
export function hostRankNonCash({ seed = 'cs-rank' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  pub(joinBlock(a, 'downtown-01', 0));
  let t = runTrialCycles(pub, a, 'downtown-01', 3, 1);
  pub(observePressure(blocks['downtown-01'], 'downtown-01', t++));
  pub(evaluateHostRank(blocks['downtown-01'], 'downtown-01', t++));
  sim.advance(1);
  return { sim, report: sim.report(), events };
}

// ── 4. stewardshipConstrainedReversible (4F) ────────────────────────────────────
export function stewardshipConstrainedReversible({ seed = 'cs-steward' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  pub(joinBlock(a, 'downtown-01', 0));
  let t = runTrialCycles(pub, a, 'downtown-01', 3, 1);                 // build host-rank eligibility
  pub(observePressure(blocks['downtown-01'], 'downtown-01', t++));
  pub(evaluateHostRank(blocks['downtown-01'], 'downtown-01', t++));    // → host tier (eligible)
  // an INELIGIBLE block (harbor never earned host rank) is rejected
  pub(stewardshipApply(blocks['harbor-02'], 'harbor-02', { palette: 'violet' }, t++));
  // an eligible apply with hostile/off-allowlist fields keeps only the allowlisted ones
  pub(stewardshipApply(blocks['downtown-01'], 'downtown-01', { palette: 'violet', intensity: 'high', evil: 'X', url: 'http://x', sign_variant: 'NOPE' }, t++));
  sim.advance(1);
  const afterApply = sim.report();
  // reset restores the default (reversible)
  pub(stewardshipReset(blocks['downtown-01'], 'downtown-01', t++));
  sim.advance(1);
  return { sim, report: sim.report(), reportAfterApply: afterApply, events };
}

// ── 5. blockTrialNonDestructive (4G) ────────────────────────────────────────────
export function blockTrialNonDestructive({ seed = 'cs-trial' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const b = sim.addAgent({ id: 'agent:b', name: 'B' });
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  pub(joinBlock(a, 'downtown-01', 0));
  pub(joinBlock(b, 'downtown-01', 0));
  // make the block eligible + apply a style FIRST, so we can prove the trial doesn't disturb it
  let t = runTrialCycles(pub, a, 'downtown-01', 3, 1);
  pub(evaluateHostRank(blocks['downtown-01'], 'downtown-01', t++));
  pub(stewardshipApply(blocks['downtown-01'], 'downtown-01', { palette: 'emerald' }, t++));
  const beforeTrial = sim.report().finalWorldState.district.stewardship['downtown-01'];
  // now run a fresh trial with two players
  pub(trialOpen(a, 'downtown-01', 'final-trial', t++));
  pub(trialJoin(b, 'downtown-01', t++));
  pub(trialStep(a, 'downtown-01', t++));
  pub(trialStep(b, 'downtown-01', t++));
  pub(trialStep(a, 'downtown-01', t++)); // completes
  pub(trialClose(a, 'downtown-01', t++));
  sim.advance(1);
  return { sim, report: sim.report(), beforeTrial, events };
}

// ── 6. citySystemsReplayStable ──────────────────────────────────────────────────
export function citySystemsReplayStable({ seed = 'cs-replay' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  pub(joinBlock(a, 'downtown-01', 0));
  let t = runTrialCycles(pub, a, 'downtown-01', 2, 1);
  pub(worldEvent(blocks['downtown-01'], 'downtown-01', 'beacon', { reason: 'r' }, t++));
  pub(observePressure(blocks['downtown-01'], 'downtown-01', t++));
  pub(evaluateHostRank(blocks['downtown-01'], 'downtown-01', t++));
  pub(stewardshipApply(blocks['downtown-01'], 'downtown-01', { palette: 'cyan' }, t++));
  sim.advance(1);
  return { sim, report: sim.report(), events };
}

export const CITY_SYSTEMS_SCENARIOS = Object.freeze({
  cityLogAppendBounded,
  pressureDerivesNonAuthoritative,
  hostRankNonCash,
  stewardshipConstrainedReversible,
  blockTrialNonDestructive,
  citySystemsReplayStable,
});
