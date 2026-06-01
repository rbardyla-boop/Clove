/**
 * Phase 1 arcade-parity scenarios — shared by the automated tests and the debug UI.
 *
 * Each scenario builds a HiveSimulator, drives the Phase 1 arcade flow (catalog,
 * three cabinets, rounds, tickets, ledger, prizes, challenges, feed) deterministi-
 * cally from a seed, and returns { sim, report, ... }. Re-running with the same
 * seed reproduces the run byte-for-byte. Nothing here uses Math.random or wall time.
 */
import { HiveSimulator } from '../core/simulator.mjs';
import { CABINETS, cabinetCatalogPayload } from '../core/phase1/catalog.mjs';
import { cabinetRenderState, adapterStateFor } from '../core/phase1/adapters.mjs';

// Deterministic round results that award known amounts (mirrors the product tests).
export const RESULTS = Object.freeze({
  pulse:  { roundId: null, cabinetType: 'pulse_tap',     rulesetVersion: 'pulse-tap/1',     grade: 'A', score: 1825, accuracy: 88, hits: 16, bestStreak: 9, durationMs: 30000 },           // → 20
  signal: { roundId: null, cabinetType: 'signal_sprint', rulesetVersion: 'signal-sprint/1', grade: 'A', score: 4200, distance: 1800, pulsesCollected: 42, noiseHits: 6, maxStreak: 14, durationMs: 25000 }, // → 24
  grid:   { roundId: null, cabinetType: 'neon_grid',     rulesetVersion: 'neon-grid-v1',    grade: 'A', score: 5000, correctSteps: 40, completedPatterns: 6, mistakes: 2, bestStreak: 18, durationMs: 22000 }, // → 26
});
export const MACHINE = Object.freeze({ pulse: 'pulse', signal: 'signal', grid: 'grid' });

/** Play one full server-authoritative round for `agent` on `machine`. Returns the next tick. */
export function playRound(sim, agent, roomId, machine, kind, roundId, tick) {
  const result = { ...RESULTS[kind], roundId };
  sim.publish(agent.occupy(roomId, machine, tick));
  sim.publish(agent.startArcadeRound(roomId, machine, roundId, tick + 1));
  sim.publish(agent.submitArcadeRound(roomId, machine, result, tick + 2));
  sim.publish(agent.release(roomId, machine, tick + 3));
  return tick + 4;
}

// ── 1. phase1QuickStart ───────────────────────────────────────────────────────
export function phase1QuickStart({ seed = 'p1-quick' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main Floor' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const b = sim.addAgent({ id: 'agent:b', name: 'B' });
  sim.publish(room.announce(0)); sim.publish(a.announce(0)); sim.publish(b.announce(0));
  sim.publish(a.announceCabinetCatalog(0, CABINETS.map((c) => c.cabinet_id)));

  let t = playRound(sim, a, 'room:main', MACHINE.pulse, 'pulse', 'r-a-p', 2); // A earns 20
  sim.publish(a.redeemArcadePrize('founder-badge-local', 'rd-a-1', t)); t += 1; // 20 → 10
  sim.publish(a.equipCosmetic('founder-badge-local', t)); t += 1;
  sim.advance(1);
  return { sim, report: sim.report() };
}

// ── 2. threeCabinetTour ─────────────────────────────────────────────────────────
export function threeCabinetTour({ seed = 'p1-tour' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  sim.publish(room.announce(0)); sim.publish(a.announce(0));

  let t = playRound(sim, a, 'room:main', MACHINE.pulse, 'pulse', 'r-a-p', 2);   // 20
  t = playRound(sim, a, 'room:main', MACHINE.signal, 'signal', 'r-a-s', t);     // +24 = 44
  t = playRound(sim, a, 'room:main', MACHINE.grid, 'grid', 'r-a-g', t);         // +26 = 70
  sim.publish(a.claimChallenge('three-cabinet-tour', t)); t += 1;
  sim.publish(a.claimChallenge('grid-rookie', t)); t += 1;
  sim.advance(1);
  return { sim, report: sim.report() };
}

// ── 3. prizeCounterLoop ──────────────────────────────────────────────────────────
export function prizeCounterLoop({ seed = 'p1-prize' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  sim.publish(room.announce(0)); sim.publish(a.announce(0));

  // Earn across all three so the combined balance can afford pulse-jacket (35).
  let t = playRound(sim, a, 'room:main', MACHINE.pulse, 'pulse', 'r-a-p', 2);   // 20
  t = playRound(sim, a, 'room:main', MACHINE.signal, 'signal', 'r-a-s', t);     // 44
  t = playRound(sim, a, 'room:main', MACHINE.grid, 'grid', 'r-a-g', t);         // 70
  sim.publish(a.redeemArcadePrize('pulse-jacket', 'rd-a-1', t)); t += 1;        // 70 → 35
  sim.publish(a.redeemArcadePrize('pulse-jacket', 'rd-a-2', t)); t += 1;        // already_owned (rejected)
  sim.publish(a.redeemArcadePrize('mystery-unit-soon', 'rd-a-3', t)); t += 1;   // prize_disabled (rejected)
  sim.publish(a.equipCosmetic('pulse-jacket', t)); t += 1;
  sim.advance(1);
  return { sim, report: sim.report() };
}

// ── 4. challengeBoardLoop ────────────────────────────────────────────────────────
export function challengeBoardLoop({ seed = 'p1-chal' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const b = sim.addAgent({ id: 'agent:b', name: 'B' });
  sim.publish(room.announce(0)); sim.publish(a.announce(0)); sim.publish(b.announce(0));

  let t = playRound(sim, a, 'room:main', MACHINE.grid, 'grid', 'r-a-g', 2);     // grid-rookie + clean-grid
  sim.publish(a.claimChallenge('grid-rookie', t)); t += 1;
  sim.publish(a.claimChallenge('grid-rookie', t)); t += 1;                       // already_claimed (rejected)
  sim.publish(b.claimChallenge('grid-rookie', t)); t += 1;                       // not_completed (rejected, B never played)
  sim.advance(1);
  return { sim, report: sim.report() };
}

// ── 5. adapterFailureLoop ────────────────────────────────────────────────────────
export function adapterFailureLoop({ seed = 'p1-adapter' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  sim.publish(room.announce(0)); sim.publish(a.announce(0));

  // mystery-x is active in the catalog but has no resolvable ruleset/adapter.
  sim.publish(a.occupy('room:main', 'myx', 2));                                  // occupancy succeeds (cabinet exists)
  sim.publish(a.startArcadeRound('room:main', 'myx', 'r-a-x', 3));               // round rejected: invalid_cabinet
  // glitch-cab is active but ships an invalid adapter.
  sim.publish(a.startArcadeRound('room:main', 'glx', 'r-a-y', 4));              // round rejected: invalid_cabinet
  sim.advance(1);

  const renderStates = {};
  const adapterStates = {};
  for (const c of CABINETS) { renderStates[c.cabinet_id] = cabinetRenderState(c); adapterStates[c.cabinet_id] = adapterStateFor(c); }
  return { sim, report: sim.report(), renderStates, adapterStates, catalog: cabinetCatalogPayload() };
}

// ── 6. reconnectReplayLoop ───────────────────────────────────────────────────────
export function reconnectReplayLoop({ seed = 'p1-reconnect' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const b = sim.addAgent({ id: 'agent:b', name: 'B' });
  sim.publish(room.announce(0)); sim.publish(a.announce(0)); sim.publish(b.announce(0));

  // B goes dark; A earns, redeems, claims while B is offline.
  sim.disconnectAgent('agent:b');
  let t = playRound(sim, a, 'room:main', MACHINE.pulse, 'pulse', 'r-a-p', 2);   // 20
  t = playRound(sim, a, 'room:main', MACHINE.signal, 'signal', 'r-a-s', t);     // 44
  sim.publish(a.claimChallenge('two-cabinet-tour', t)); t += 1;
  const before = sim.observeDesync('B offline');

  sim.reconnectAgent('agent:b'); sim.flushPending();
  const after = sim.observeDesync('B reconnected');
  return { sim, report: sim.report(), divergedWhileOffline: before.diverged.length, divergedAfter: after.diverged.length };
}

// ── 7. privacyBoundaryLoop ──────────────────────────────────────────────────────
export function privacyBoundaryLoop({ seed = 'p1-privacy' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const b = sim.addAgent({ id: 'agent:b', name: 'B' });
  sim.publish(room.announce(0)); sim.publish(a.announce(0)); sim.publish(b.announce(0));

  let t = playRound(sim, a, 'room:main', MACHINE.pulse, 'pulse', 'r-a-p', 2);
  sim.publish(a.redeemArcadePrize('founder-badge-local', 'rd-a-1', t)); t += 1;
  sim.publish(a.equipCosmetic('founder-badge-local', t)); t += 1;
  // B cannot equip an item it does not own (rejected).
  sim.publish(b.equipCosmetic('pulse-jacket', t)); t += 1;
  sim.advance(1);
  return { sim, report: sim.report() };
}

// ── 8. meshChurnPhase1 ──────────────────────────────────────────────────────────
export function meshChurnPhase1({ seed = 'p1-churn', agents = 10 } = {}) {
  const sim = new HiveSimulator({ seed, staleLockTicks: 6 });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const players = [];
  sim.publish(room.announce(0));
  for (let i = 0; i < agents; i++) {
    const a = sim.addAgent({ id: `agent:${String.fromCharCode(97 + i)}`, name: `P${i}` });
    players.push(a); sim.publish(a.announce(0));
  }
  sim.publish(room.announce(0));
  const kinds = [['pulse', MACHINE.pulse], ['signal', MACHINE.signal], ['grid', MACHINE.grid]];

  let t = 1;
  // Each player tours all three cabinets in their own round id namespace, with some
  // delayed/duplicated deliveries — convergence holds by construction.
  for (let i = 0; i < players.length; i++) {
    const a = players[i];
    for (let k = 0; k < kinds.length; k++) {
      const [kind, machine] = kinds[k];
      const rid = `r-${a.id}-${k}`;
      sim.publish(a.occupy('room:main', machine, t), { delayTicks: (i + k) % 3 });
      sim.publish(a.startArcadeRound('room:main', machine, rid, t + 1));
      sim.publish(a.submitArcadeRound('room:main', machine, { ...RESULTS[kind], roundId: rid }, t + 2), { duplicate: (i % 2) === 0 });
      sim.publish(a.release('room:main', machine, t + 3));
      t += 4;
    }
    // a malicious cross-game submit (pulse result to a grid round id) and a forbidden cashout
    if (i === players.length - 1) {
      sim.publish(a.submitArcadeRound('room:main', MACHINE.pulse, { ...RESULTS.signal, roundId: `r-${a.id}-0`, machineId: 'pulse' }, t)); t += 1;
    }
  }
  sim.flushPending();
  for (const node of sim.nodes()) node.syncFrom(sim.canonicalLog.snapshot());
  sim.observeDesync('post-flush');
  return { sim, report: sim.report() };
}

// ── 9. multiRoomIsolation (Phase 2 parity) ───────────────────────────────────────
// Two rooms, fully isolated arcade partitions. A earns + redeems in main-floor and
// earns separately in neon-training; B occupies a cabinet in main-floor while the
// same cabinet stays free in neon-training. Nothing carries across rooms.
export function multiRoomIsolation({ seed = 'p2-rooms' } = {}) {
  const sim = new HiveSimulator({ seed });
  const main = sim.addRoom({ id: 'main-floor', name: 'Main Floor' });
  const train = sim.addRoom({ id: 'neon-training', name: 'Neon Training' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const b = sim.addAgent({ id: 'agent:b', name: 'B' });
  sim.publish(main.announce(0)); sim.publish(train.announce(0));
  sim.publish(a.announce(0)); sim.publish(b.announce(0));

  // A earns + redeems + equips in main-floor.
  let t = playRound(sim, a, 'main-floor', MACHINE.pulse, 'pulse', 'r-a-m-p', 2); // +20 in main-floor
  sim.publish(a.redeemArcadePrize('founder-badge-local', 'rd-a-m', t)); t += 1;   // main-floor 20 → 10
  sim.publish(a.equipCosmetic('founder-badge-local', t)); t += 1;
  // A earns in neon-training — a SEPARATE partition.
  t = playRound(sim, a, 'neon-training', MACHINE.signal, 'signal', 'r-a-t-s', t); // +24 in neon-training
  // B occupies Pulse Tap in main-floor; the same machine is free in neon-training.
  sim.publish(b.occupy('main-floor', MACHINE.pulse, t)); t += 1;
  sim.advance(1);
  return { sim, report: sim.report() };
}

// ── 10. roomHealthLifecycle (v0.3 room presence health) ──────────────────────────
// Mirrors product Phase 2c. main-floor reports a heartbeat while occupied (so health
// is observable as healthy→stale→offline purely by advancing the OBSERVER clock —
// the same way the product derives health from `last_seen_at` vs now). neon-training
// is put under maintenance by its room authority (both-gated admin). late-night-circuit
// is heartbeat'd then admin-reset (generation bumps, population evicted). All admin
// ops run with ctx.adminEnabled = true; a non-authority attempt is rejected (tested).
export function roomHealthLifecycle({ seed = 'p2c-health' } = {}) {
  // High staleLockTicks so the room-health flow isn't perturbed by incidental
  // occupancy stale-lock timeouts at advance().
  const sim = new HiveSimulator({ seed, ctx: { adminEnabled: true }, staleLockTicks: 1000 });
  const main = sim.addRoom({ id: 'main-floor', name: 'Main Floor' });
  const train = sim.addRoom({ id: 'neon-training', name: 'Neon Training' });
  const late = sim.addRoom({ id: 'late-night-circuit', name: 'Late Night Circuit' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const b = sim.addAgent({ id: 'agent:b', name: 'B' });
  sim.publish(main.announce(0)); sim.publish(train.announce(0)); sim.publish(late.announce(0));
  sim.publish(a.announce(0)); sim.publish(b.announce(0));

  // main-floor: A occupies a cabinet, the room reports a heartbeat (population 1).
  sim.publish(a.occupy('main-floor', MACHINE.pulse, 2));
  sim.publish(main.heartbeat(3, { population: 1 }));

  // neon-training: room authority sets maintenance (both-gated admin op).
  sim.publish(train.setStatus('maintenance', 4));

  // late-night-circuit: B occupies + room heartbeats, then admin reset wipes it.
  sim.publish(b.occupy('late-night-circuit', MACHINE.signal, 5));
  sim.publish(late.heartbeat(6, { population: 1 }));
  sim.publish(late.resetRoom(7)); // arcade partition + occupancy wiped, generation → 1
  sim.advance(1);
  return { sim, report: sim.report() };
}

// ── 11. roomRecommendationShowcase (v0.4 presence UX) ────────────────────────────
// Three healthy rooms with different populations so the pure recommendation helpers
// (core/phase1/room-recommend.mjs) have a clear, deterministic picture: main-floor
// busy (pop 5), neon-training (training profile) lightly populated (pop 1),
// late-night-circuit empty (pop 0). Rooms report heartbeats only; recommendations are
// derived purely from the resulting public presence list (see the test).
export function roomRecommendationShowcase({ seed = 'p2d-reco' } = {}) {
  const sim = new HiveSimulator({ seed, staleLockTicks: 1000 });
  const main = sim.addRoom({ id: 'main-floor', name: 'Main Floor' });
  const train = sim.addRoom({ id: 'neon-training', name: 'Neon Training' });
  const late = sim.addRoom({ id: 'late-night-circuit', name: 'Late Night Circuit' });
  sim.publish(main.announce(0)); sim.publish(train.announce(0)); sim.publish(late.announce(0));
  sim.publish(main.heartbeat(2, { population: 5 }));
  sim.publish(train.heartbeat(2, { population: 1 }));
  sim.publish(late.heartbeat(2, { population: 0 }));
  sim.advance(1);
  return { sim, report: sim.report() };
}

export const PHASE1_SCENARIOS = Object.freeze({
  phase1QuickStart, threeCabinetTour, prizeCounterLoop, challengeBoardLoop,
  adapterFailureLoop, reconnectReplayLoop, privacyBoundaryLoop, meshChurnPhase1,
  multiRoomIsolation, roomHealthLifecycle, roomRecommendationShowcase,
});

export function runPhase1Scenario(name, opts) {
  const fn = PHASE1_SCENARIOS[name];
  if (!fn) throw new Error(`unknown phase1 scenario: ${name}`);
  return fn(opts || {});
}
