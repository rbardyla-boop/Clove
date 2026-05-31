/**
 * Canned scenarios — shared by the automated tests and the debug UI.
 *
 * Each scenario builds a HiveSimulator, drives it deterministically from a seed,
 * and returns { sim, report }. Re-running with the same seed reproduces the run
 * byte-for-byte. Nothing here uses Math.random or wall-clock time.
 */
import { HiveSimulator } from '../core/simulator.mjs';
import { makeRng } from '../core/rng.mjs';
import { createEvent } from '../core/events.mjs';
import { simulatePulseTapRound } from '../core/pulse-tap.mjs';

// ── 1. quick start: one room, two agents, a full honest play loop ─────────────
export function quickStart({ seed = 'quick' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main Floor' });
  const alice = sim.addAgent({ id: 'agent:alice', name: 'Alice', cellId: 'cell:0,0' });
  const bob = sim.addAgent({ id: 'agent:bob', name: 'Bob', cellId: 'cell:0,0' });

  sim.publish(room.announce(0));
  sim.publish(alice.announce(0));
  sim.publish(bob.announce(0));
  sim.publish(alice.ping(1, 'room:main', 'cell:0,0'));
  sim.publish(bob.ping(1, 'room:main', 'cell:0,0'));

  // Alice occupies, plays a deterministic round, banks a result, gets test credits,
  // mints + equips a bound cosmetic, then releases.
  sim.publish(alice.occupy('room:main', 'pulse', 2));
  sim.advance(1, () => sim.publish(alice.ping(3, 'room:main')));
  const result = simulatePulseTapRound({ seed: `${seed}:alice`, skill: 0.82 });
  sim.publish(alice.finishRound('room:main', 'pulse', result, 4));
  sim.publish(alice.grantCredits('agent:alice', 50, 5)); // test-mode faucet
  sim.publish(alice.mintBoundGood('good:alice-skin', 'cabinet_skin', 20, 6));
  sim.publish(alice.equipGood('good:alice-skin', 7));
  sim.publish(alice.release('room:main', 'pulse', 8));

  // Bob now takes the freed cabinet.
  sim.publish(bob.occupy('room:main', 'pulse', 9));
  sim.advance(2);

  return { sim, report: sim.report() };
}

// ── 2. occupancy conflict: two agents grab the same cabinet on the same tick ──
export function occupancyConflict({ seed = 'conflict' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const a = sim.addAgent({ id: 'agent:alpha', name: 'Alpha' });
  const b = sim.addAgent({ id: 'agent:bravo', name: 'Bravo' });
  sim.publish(room.announce(0));
  sim.publish(a.announce(0));
  sim.publish(b.announce(0));
  // Out-of-order publish at the same tick — canonical order still picks one winner.
  sim.publish(b.occupy('room:main', 'pulse', 5));
  sim.publish(a.occupy('room:main', 'pulse', 5));
  sim.advance(1);
  return { sim, report: sim.report() };
}

// ── 3. base station failure + recovery ────────────────────────────────────────
export function baseStationFailureRecovery({ seed = 'outage' } = {}) {
  const sim = new HiveSimulator({ seed, staleLockTicks: 4 });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const a = sim.addAgent({ id: 'agent:alice', name: 'Alice' });
  sim.publish(room.announce(0));
  sim.publish(a.announce(0));
  sim.publish(a.occupy('room:main', 'pulse', 2));

  sim.roomOutage('room:main');           // base station dies while Alice holds the cabinet
  sim.advance(3, () => sim.publish(a.ping(sim.tick, 'room:main')));
  sim.observeDesync('room offline');     // log presence/liveness can diverge here
  sim.roomRecover('room:main');          // replay the canonical log to rebuild authority

  const occupied = sim.report().finalWorldState.rooms['room:main'].machines.pulse.occupiedBy;
  return { sim, report: sim.report(), occupiedAfterRecovery: occupied };
}

// ── 4. malicious agent: every attack must be visibly refused ──────────────────
export function maliciousCabinetSteal({ seed = 'attack' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const honest = sim.addAgent({ id: 'agent:honest', name: 'Honest' });
  const mod = sim.addAgent({ id: 'agent:mod', role: 'moderator', name: 'Mod' });
  const attacker = sim.addAgent({ id: 'agent:evil', name: 'Evil' });
  sim.publish(room.announce(0));
  sim.publish(honest.announce(0));
  sim.publish(mod.announce(0));
  sim.publish(attacker.announce(0));

  // Honest player legitimately takes the cabinet and leases a slot.
  sim.publish(honest.occupy('room:main', 'pulse', 2));
  sim.publish(honest.leaseSlot('cell:5,5', { slotId: 'slot:honest', slotType: 'kiosk', durationTicks: 50, allowedActions: ['place_object'] }, 3));

  // (a) semantic attack — occupy a busy cabinet: enters the fabric, fold rejects 'busy'.
  sim.publish(attacker.occupy('room:main', 'pulse', 4));
  attacker.penalizeTrust();

  // (b) authority attack — non-moderator suspend: fold rejects 'not_moderator'.
  sim.publish(attacker.emit({ eventType: 'suspend_slot', sideband: 'moderation', payload: { slotId: 'slot:honest' }, tick: 5 }));
  attacker.penalizeTrust();

  // (c) forbidden economy — transfer attempt: rejected at the fabric boundary.
  sim.publish(createEvent({ actorId: 'agent:evil', eventType: 'transfer_good', sideband: 'market', payload: { goodId: 'x', to: 'agent:evil' }, logicalTick: 6, seq: 99 }));

  // (d) forgery — a tampered envelope (payload changed after signing): rejected at the boundary.
  const genuine = createEvent({ actorId: 'agent:evil', eventType: 'occupy_cabinet', sideband: 'occupancy', roomId: 'room:main', payload: { machineId: 'pulse' }, logicalTick: 7, seq: 100 });
  sim.publish(sim.tamper(genuine, { payload: { machineId: 'pulse', expectedRev: 0 } }));

  // The real moderator CAN suspend — proving authority works for the right role.
  sim.publish(mod.emit({ eventType: 'suspend_slot', sideband: 'moderation', payload: { slotId: 'slot:honest' }, tick: 8 }));

  sim.advance(1);
  return { sim, report: sim.report(), attackerTrust: attacker.trustScore };
}

// ── 5. disconnect, observe desync, reconnect, converge ────────────────────────
export function disconnectReplayConverge({ seed = 'reconnect' } = {}) {
  const sim = new HiveSimulator({ seed });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const a = sim.addAgent({ id: 'agent:a', name: 'A' });
  const b = sim.addAgent({ id: 'agent:b', name: 'B' });
  sim.publish(room.announce(0));
  sim.publish(a.announce(0));
  sim.publish(b.announce(0));

  sim.disconnectAgent('agent:b');           // B goes dark
  sim.publish(a.occupy('room:main', 'pulse', 3));  // B misses this
  sim.publish(a.finishRound('room:main', 'pulse', simulatePulseTapRound({ seed: `${seed}:a`, skill: 0.7 }), 4));
  const beforeObs = sim.observeDesync('B offline');  // B should diverge here

  sim.reconnectAgent('agent:b');            // B replays the canonical log
  sim.flushPending();
  const afterObs = sim.observeDesync('B reconnected');

  return { sim, report: sim.report(), divergedWhileOffline: beforeObs.diverged.length, divergedAfter: afterObs.diverged.length };
}

// ── 6. the big one: 10 agents, 2 rooms, 3 cabinets, 5+ slots, 1000 ticks ──────
export function meshChurn({ seed = 'hive-churn', ticks = 1000 } = {}) {
  const sim = new HiveSimulator({ seed, staleLockTicks: 6 });
  const drv = makeRng(`${seed}:driver`);

  const rooms = ['room:north', 'room:south'].map((id) => sim.addRoom({ id, name: id }));
  const cabinets = ['pulse', 'claw', 'hoops'];
  const agents = [];
  for (let i = 0; i < 10; i++) {
    const id = `agent:${String.fromCharCode(97 + i)}`;
    const a = sim.addAgent({ id, role: i === 0 ? 'moderator' : 'player', name: id });
    agents.push(a);
  }
  const mod = agents[0];
  const attacker = agents[9];

  // tick 0 — announce topology + faucet starter credits (test mode only).
  for (const r of rooms) sim.publish(r.announce(0));
  for (const a of agents) sim.publish(a.announce(0));
  for (const a of agents) sim.publish(mod.grantCredits(a.id, 100, 0));

  const held = {};       // "room/cab" -> agentId   (driver's view, kept consistent with the fabric)
  const holding = {};    // agentId -> "room/cab"
  const liveSlots = [];   // { slotId, endTick, holder, cellId }
  let slotN = 0;
  let goodN = 0;
  let objN = 0;

  const pubMaybeFaulty = (ev) => {
    // delayed / duplicated delivery — both converge by construction.
    const opts = {};
    if (drv.bool(0.1)) opts.delayTicks = drv.int(1, 3);
    if (drv.bool(0.1)) opts.duplicate = true;
    sim.publish(ev, opts);
  };

  const freeCabinet = () => {
    const choices = [];
    for (const r of rooms) for (const c of cabinets) if (!held[`${r.id}/${c}`]) choices.push([r.id, c]);
    return choices.length ? drv.pick(choices) : null;
  };

  sim.advance(ticks, (t) => {
    // scheduled faults --------------------------------------------------------
    if (t === 200) { releaseDriver('agent:e'); sim.disconnectAgent('agent:e'); }
    if (t === 230) sim.observeDesync('agent:e offline');
    if (t === 260) sim.reconnectAgent('agent:e');
    if (t === 400) sim.roomOutage('room:south');
    if (t === 450) sim.roomRecover('room:south');

    if (t === 500 && liveSlots.length) {
      const target = liveSlots.find((s) => s.endTick > t);
      if (target) sim.publish(mod.emit({ eventType: 'suspend_slot', sideband: 'moderation', payload: { slotId: target.slotId }, tick: t }));
    }

    // malicious bursts --------------------------------------------------------
    if ((t === 300 || t === 600 || t === 900) && attacker.online) {
      const busy = Object.keys(held)[0];
      if (busy) { const [rid, cab] = busy.split('/'); sim.publish(attacker.occupy(rid, cab, t)); attacker.penalizeTrust(); }
      sim.publish(createEvent({ actorId: attacker.id, eventType: 'cashout_credits', sideband: 'market', payload: { amount: 100 }, logicalTick: t, seq: 5000 + t }));
      const forged = createEvent({ actorId: attacker.id, eventType: 'occupy_cabinet', sideband: 'occupancy', roomId: 'room:north', payload: { machineId: 'pulse' }, logicalTick: t, seq: 6000 + t });
      sim.publish(sim.tamper(forged, { payload: { machineId: 'claw' } }));
    }

    // honest behaviour --------------------------------------------------------
    for (const a of agents) {
      if (!a.online) continue;
      if (drv.bool(0.5)) sim.publish(a.ping(t, holding[a.id] ? holding[a.id].split('/')[0] : drv.pick(rooms).id, `cell:${a.id}`));

      const spot = holding[a.id];
      if (spot) {
        // sometimes finish + release
        if (drv.bool(0.25)) {
          const [rid, cab] = spot.split('/');
          const result = simulatePulseTapRound({ seed: `${seed}:${a.id}:${t}`, skill: 0.55 + (drv() * 0.4) });
          pubMaybeFaulty(a.finishRound(rid, cab, result, t));
          pubMaybeFaulty(a.release(rid, cab, t));
          releaseDriver(a.id);
        }
      } else if (drv.bool(0.18)) {
        const pick = freeCabinet();
        if (pick) {
          const [rid, cab] = pick;
          held[`${rid}/${cab}`] = a.id;
          holding[a.id] = `${rid}/${cab}`;
          pubMaybeFaulty(a.occupy(rid, cab, t));
        }
      }

      // slot lifecycle
      if (drv.bool(0.06)) {
        const slotId = `slot:${a.id}:${slotN++}`;
        const cellId = `cell:${a.id}:${slotN}`;
        pubMaybeFaulty(a.leaseSlot(cellId, { slotId, slotType: 'kiosk', durationTicks: drv.int(20, 80), allowedActions: ['place_object', 'remove_object'] }, t));
        liveSlots.push({ slotId, endTick: t + 80, holder: a.id, cellId });
      }
      if (drv.bool(0.06)) {
        const mine = liveSlots.find((s) => s.holder === a.id && s.endTick > t);
        if (mine) pubMaybeFaulty(a.placeObject(mine.slotId, `obj:${a.id}:${objN++}`, { kind: 'sticker', action: 'place_object' }, t));
      }

      // economy: mint + equip an account-bound cosmetic
      if (drv.bool(0.04)) { // over-minting beyond balance is rejected (insufficient_credits) — that is the point
        const goodId = `good:${a.id}:${goodN++}`;
        pubMaybeFaulty(a.mintBoundGood(goodId, 'avatar_cosmetic', 10, t));
        pubMaybeFaulty(a.equipGood(goodId, t));
      }

      // ambient weather
      if (drv.bool(0.02)) sim.publish(a.emit({ eventType: 'weather_set', sideband: 'weather', cellId: `cell:${a.id}`, payload: { kind: drv.pick(['neon', 'fog', 'clear', 'storm']) }, tick: t }));
    }
  });

  function releaseDriver(agentId) {
    const spot = holding[agentId];
    if (spot) { delete held[spot]; delete holding[agentId]; }
  }

  // final convergence: deliver everything still in flight, recover any down nodes.
  sim.flushPending();
  for (const a of agents) if (!a.online) sim.reconnectAgent(a.id);
  for (const r of rooms) if (!r.online) sim.roomRecover(r.id);
  // belt-and-braces: ensure every replica has the full accepted set, then re-check.
  for (const node of sim.nodes()) node.syncFrom(sim.canonicalLog.snapshot());
  sim.observeDesync('post-flush');

  return { sim, report: sim.report() };
}

export const SCENARIOS = Object.freeze({
  quickStart,
  occupancyConflict,
  baseStationFailureRecovery,
  maliciousCabinetSteal,
  disconnectReplayConverge,
  meshChurn,
});

export function runScenario(name, opts) {
  const fn = SCENARIOS[name];
  if (!fn) throw new Error(`unknown scenario: ${name}`);
  return fn(opts || {});
}
