/**
 * HiveWorld v1.2 — presence push cadence scenarios (Phase 5C/5D/5E timing), shared by tests + UI.
 *
 * Each builds a HiveSimulator with per-block authority nodes + agents, drives a deterministic delta +
 * alarm flow, and returns { sim, report, events, ... } with intermediate captures where a test needs to
 * compare BEFORE vs AFTER an alarm. `events` is the raw signed list, for reorder/dup convergence proofs.
 */
import { HiveSimulator } from '../core/simulator.mjs';
import { CITY_IDS } from '../core/phase1/city-blocks.mjs';
import { ALARM_INTERVAL_TICKS } from '../core/phase1/district-presence-push.mjs';
import { joinBlock, leaveBlock, presenceDelta, presenceAlarm } from '../core/phase1/city-events.mjs';
import { refold } from './city-district.mjs';

export { refold, ALARM_INTERVAL_TICKS };

function cityWorld(seed) {
  const sim = new HiveSimulator({ seed });
  const blocks = {};
  for (const id of CITY_IDS) blocks[id] = sim.addRoom({ id, name: id });
  return { sim, blocks };
}
/** Every block fires its baseline alarm at `tick` (initial pushed snapshot — no activity). */
function baselineAlarms(pub, blocks, tick) {
  for (const id of CITY_IDS) pub(presenceAlarm(blocks[id], id, tick));
}

// ── 1. sameBlockImmediate (5D) ──────────────────────────────────────────────────
export function sameBlockImmediate({ seed = 'cad-same' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  baselineAlarms(pub, blocks, 1);
  pub(presenceDelta(blocks['downtown-01'], 'downtown-01', { population: 3, health: 'healthy' }, 5));
  sim.advance(1);
  return { sim, report: sim.report(), events };
}

// ── 2. crossBlockAlarmBound (5D) ────────────────────────────────────────────────
// Harbor's change reaches Downtown's pushed view ONLY after Downtown's next alarm — not before.
export function crossBlockAlarmBound({ seed = 'cad-cross' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  baselineAlarms(pub, blocks, 1);                                            // initial baseline snapshots
  pub(presenceDelta(blocks['harbor-02'], 'harbor-02', { population: 2, health: 'healthy' }, 5));
  const reportBeforeAlarm = sim.report();                                    // downtown has NOT alarmed since
  pub(presenceAlarm(blocks['downtown-01'], 'downtown-01', 1 + ALARM_INTERVAL_TICKS)); // downtown's next alarm
  sim.advance(1);
  return { sim, report: sim.report(), reportBeforeAlarm, events };
}

// ── 3. noGhostLeaveDropsToZero (5D) ─────────────────────────────────────────────
export function noGhostLeaveDropsToZero({ seed = 'cad-ghost' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  baselineAlarms(pub, blocks, 1);
  pub(joinBlock(a, 'harbor-02', 2));
  pub(presenceDelta(blocks['harbor-02'], 'harbor-02', { population: 1, health: 'healthy' }, 3));
  pub(presenceAlarm(blocks['downtown-01'], 'downtown-01', 1 + ALARM_INTERVAL_TICKS));        // downtown learns 1
  const reportPopulated = sim.report();
  pub(leaveBlock(a, 'harbor-02', 40));
  pub(presenceDelta(blocks['harbor-02'], 'harbor-02', { population: 0, health: 'healthy' }, 41)); // leave → 0
  pub(presenceAlarm(blocks['downtown-01'], 'downtown-01', 1 + 2 * ALARM_INTERVAL_TICKS));    // downtown learns 0
  sim.advance(1);
  return { sim, report: sim.report(), reportPopulated, events };
}

// ── 4. activityFollowsCadence (5E) ──────────────────────────────────────────────
// A cross-block "became active" is derived when the OBSERVING block's alarm fires.
export function activityFollowsCadence({ seed = 'cad-activity' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  baselineAlarms(pub, blocks, 1);
  pub(presenceDelta(blocks['skyline-03'], 'skyline-03', { population: 4, health: 'healthy' }, 5));
  const reportBeforeAlarm = sim.report();
  pub(presenceAlarm(blocks['harbor-02'], 'harbor-02', 1 + ALARM_INTERVAL_TICKS)); // harbor (adjacent) observes skyline
  sim.advance(1);
  return { sim, report: sim.report(), reportBeforeAlarm, events };
}

// ── 5. cadenceReplayStable ──────────────────────────────────────────────────────
export function cadenceReplayStable({ seed = 'cad-replay' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  baselineAlarms(pub, blocks, 1);
  pub(joinBlock(a, 'downtown-01', 2));
  pub(presenceDelta(blocks['downtown-01'], 'downtown-01', { population: 1, health: 'healthy' }, 3));
  pub(presenceDelta(blocks['harbor-02'], 'harbor-02', { population: 2, health: 'healthy' }, 4));
  pub(presenceAlarm(blocks['downtown-01'], 'downtown-01', 1 + ALARM_INTERVAL_TICKS));
  pub(presenceAlarm(blocks['harbor-02'], 'harbor-02', 1 + ALARM_INTERVAL_TICKS));
  pub(presenceDelta(blocks['harbor-02'], 'harbor-02', { population: 0, health: 'healthy' }, 40));
  pub(presenceAlarm(blocks['downtown-01'], 'downtown-01', 1 + 2 * ALARM_INTERVAL_TICKS));
  sim.advance(1);
  return { sim, report: sim.report(), events };
}

export const PRESENCE_CADENCE_SCENARIOS = Object.freeze({
  sameBlockImmediate,
  crossBlockAlarmBound,
  noGhostLeaveDropsToZero,
  activityFollowsCadence,
  cadenceReplayStable,
});
