/**
 * HiveWorld v1.0 — city/district scenarios (shared by the automated tests + the debug UI).
 *
 * Each scenario builds a HiveSimulator with player agents + one RoomBaseStation per block (its id ===
 * the cityId, so it can sign that block's authority events), drives a deterministic city/district flow
 * via the city-events builders, and returns { sim, report, events }. `events` is the raw signed event
 * list, so a test can re-fold it in any order (delayed/duplicated/reversed) and prove the fingerprint
 * converges. Nothing uses Math.random or wall time.
 */
import { HiveSimulator } from '../core/simulator.mjs';
import { SidebandCRDTLog } from '../core/log.mjs';
import { fold } from '../core/world.mjs';
import { CITY_IDS } from '../core/phase1/city-blocks.mjs';
import {
  joinBlock, leaveBlock, requestRoute, confirmRoute, rejectRoute, arriveBlock, presenceDelta, deriveActivity,
} from '../core/phase1/city-events.mjs';

/** A district world: one authority node per block (id === cityId) + the given agents. */
function cityWorld(seed) {
  const sim = new HiveSimulator({ seed });
  const blocks = {};
  for (const id of CITY_IDS) blocks[id] = sim.addRoom({ id, name: id });
  return { sim, blocks };
}

/** Fold a raw event list through a FRESH canonical log (dedupes + canonical-orders, then folds). */
export function refold(events) {
  const log = new SidebandCRDTLog();
  for (const ev of events) log.ingest(ev);
  return fold(log.ordered());
}

// ── 1. districtRouteConverges ───────────────────────────────────────────────────
// A starts downtown, requests harbor, the source block confirms, A arrives harbor.
export function districtRouteConverges({ seed = 'city-route' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  pub(joinBlock(a, 'downtown-01', 0));
  pub(presenceDelta(blocks['downtown-01'], 'downtown-01', { population: 1, health: 'healthy' }, 1));
  pub(requestRoute(a, 'harbor-02', 2));
  pub(confirmRoute(blocks['downtown-01'], 'agent:a', 'downtown-01', 'harbor-02', 3));
  pub(arriveBlock(a, 'harbor-02', 4));
  pub(presenceDelta(blocks['harbor-02'], 'harbor-02', { population: 1, health: 'healthy' }, 5));
  sim.advance(1);
  return { sim, report: sim.report(), events };
}

// ── 2. districtRejectsUnknownBlock ──────────────────────────────────────────────
// A requests a NON-ADJACENT block; the authority rejects; A's attempted arrival is refused.
export function districtRejectsUnknownBlock({ seed = 'city-reject' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  pub(joinBlock(a, 'downtown-01', 0));
  pub(requestRoute(a, 'skyline-03', 1));                                              // downtown↛skyline (not adjacent)
  pub(rejectRoute(blocks['downtown-01'], 'agent:a', 'downtown-01', 'skyline-03', 'not_adjacent', 2));
  pub(arriveBlock(a, 'skyline-03', 3));                                               // no confirmed route → refused by fold
  sim.advance(1);
  return { sim, report: sim.report(), events };
}

// ── 3. districtPresenceDeltaPublicSafe ──────────────────────────────────────────
// A block reports presence WITH injected private payload fields; the fold strips them.
export function districtPresenceDeltaPublicSafe({ seed = 'city-presence' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  pub(presenceDelta(blocks['harbor-02'], 'harbor-02', { population: 3, health: 'healthy' }, 1,
    { playerIds: ['agent:x', 'agent:y'], balance: 999, socketId: 's-1', adminToken: 'tok' })); // hostile extras
  pub(presenceDelta(blocks['harbor-02'], 'harbor-02', { population: 0, health: 'healthy' }, 4)); // became empty
  pub(presenceDelta(blocks['downtown-01'], 'downtown-01', { population: 2, health: 'stale' }, 6));
  sim.advance(1);
  return { sim, report: sim.report(), events };
}

// ── 4. districtActivityReplayStable ─────────────────────────────────────────────
// A mixed route + presence + arrival flow whose fingerprint must be replay-stable under reordering.
export function districtActivityReplayStable({ seed = 'city-activity' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const b = sim.addAgent({ id: 'agent:b', name: 'B' });
  const events = [];
  const pub = (ev) => { events.push(ev); sim.publish(ev); return ev; };
  pub(joinBlock(a, 'downtown-01', 0));
  pub(joinBlock(b, 'harbor-02', 0));
  pub(presenceDelta(blocks['downtown-01'], 'downtown-01', { population: 1, health: 'healthy' }, 1));
  pub(presenceDelta(blocks['harbor-02'], 'harbor-02', { population: 1, health: 'healthy' }, 1));
  pub(requestRoute(a, 'harbor-02', 2));
  pub(confirmRoute(blocks['downtown-01'], 'agent:a', 'downtown-01', 'harbor-02', 3));
  pub(arriveBlock(a, 'harbor-02', 4));
  pub(presenceDelta(blocks['harbor-02'], 'harbor-02', { population: 2, health: 'healthy' }, 5));
  pub(deriveActivity(blocks['skyline-03'], { city_id: 'skyline-03', type: 'block_presence_restored' }, 6));
  sim.advance(1);
  return { sim, report: sim.report(), events };
}

// ── 5. multiActorCrossBlockChurn (optional) ─────────────────────────────────────
// Multiple actors route across the three blocks; delivery includes duplicates + delays.
export function multiActorCrossBlockChurn({ seed = 'city-churn' } = {}) {
  const { sim, blocks } = cityWorld(seed);
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const b = sim.addAgent({ id: 'agent:b', name: 'B' });
  const events = [];
  const pub = (ev, opts) => { events.push(ev); sim.publish(ev, opts); return ev; };
  pub(joinBlock(a, 'downtown-01', 0));
  pub(joinBlock(b, 'skyline-03', 0));
  // A: downtown -> harbor -> skyline (two adjacent hops)
  pub(requestRoute(a, 'harbor-02', 1));
  pub(confirmRoute(blocks['downtown-01'], 'agent:a', 'downtown-01', 'harbor-02', 2), { duplicate: true });
  pub(arriveBlock(a, 'harbor-02', 3));
  pub(requestRoute(a, 'skyline-03', 4));
  pub(confirmRoute(blocks['harbor-02'], 'agent:a', 'harbor-02', 'skyline-03', 5), { delayTicks: 2 });
  pub(arriveBlock(a, 'skyline-03', 6));
  // B: skyline -> harbor (adjacent)
  pub(requestRoute(b, 'harbor-02', 1));
  pub(confirmRoute(blocks['skyline-03'], 'agent:b', 'skyline-03', 'harbor-02', 2));
  pub(arriveBlock(b, 'harbor-02', 3));
  pub(leaveBlock(b, 'harbor-02', 7));
  sim.advance(3);
  return { sim, report: sim.report(), events };
}

export const CITY_DISTRICT_SCENARIOS = Object.freeze({
  districtRouteConverges,
  districtRejectsUnknownBlock,
  districtPresenceDeltaPublicSafe,
  districtActivityReplayStable,
  multiActorCrossBlockChurn,
});
