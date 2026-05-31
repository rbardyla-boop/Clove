/**
 * F. Sideband tests — class behaviour: ephemeral presence, persistent log,
 * validated market, authoritative moderation, proposal-only intent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIDEBANDS } from '../../arcade/hiveworld-sim/core/sidebands.mjs';
import { HiveSimulator } from '../../arcade/hiveworld-sim/core/simulator.mjs';
import { createEvent } from '../../arcade/hiveworld-sim/core/events.mjs';
import { fold } from '../../arcade/hiveworld-sim/core/world.mjs';

test('presence is high-frequency and ephemeral (bounded state)', () => {
  assert.equal(SIDEBANDS.presence.klass, 'ephemeral');
  assert.equal(SIDEBANDS.presence.highFrequency, true);

  // 50 pings from one actor collapse to a single latest presence entry.
  const sim = new HiveSimulator({ seed: 'sb-presence' });
  const a = sim.addAgent({ id: 'agent:a' });
  sim.publish(a.announce(0));
  for (let t = 1; t <= 50; t++) sim.publish(a.ping(t, 'room:main', 'cell:0'));
  const presence = sim.report().finalWorldState.presence;
  assert.equal(Object.keys(presence).length, 1);
  assert.equal(presence['agent:a'].lastTick, 50);
});

test('event_log is persistent (durable round results accumulate)', () => {
  assert.equal(SIDEBANDS.event_log.persistent, true);
  const sim = new HiveSimulator({ seed: 'sb-log' });
  const room = sim.addRoom({ id: 'room:main' });
  const a = sim.addAgent({ id: 'agent:a' });
  sim.publish(room.announce(0));
  sim.publish(a.announce(0));
  sim.publish(a.finishRound('room:main', 'pulse', { score: 100, accuracy: 80, grade: 'A', hits: 10, bestStreak: 6 }, 1));
  sim.publish(a.finishRound('room:main', 'pulse', { score: 200, accuracy: 90, grade: 'A', hits: 20, bestStreak: 9 }, 2));
  const log = sim.report().finalWorldState.eventLog.filter((e) => e.type === 'finish_round');
  assert.equal(log.length, 2);
});

test('market is validated (a grant is semantically checked before it applies)', () => {
  assert.equal(SIDEBANDS.market.klass, 'validated');
  const ev = createEvent({ actorId: 'agent:a', eventType: 'grant_credits', sideband: 'market', payload: { to: 'agent:a', amount: 5 }, logicalTick: 1, seq: 0 });
  // Same event, two different policies -> different outcomes (validation, not blind apply).
  assert.equal(fold([ev], { economyTestMode: true, presenceTtlTicks: 5 }).appliedCount, 1);
  assert.equal(fold([ev], { economyTestMode: false, presenceTtlTicks: 5 }).rejections[0].reason, 'economy_locked');
});

test('moderation is authoritative — it can suspend a slot', () => {
  assert.equal(SIDEBANDS.moderation.klass, 'authoritative');
  const sim = new HiveSimulator({ seed: 'sb-mod' });
  const mod = sim.addAgent({ id: 'agent:mod', role: 'moderator' });
  const a = sim.addAgent({ id: 'agent:a' });
  sim.publish(mod.announce(0));
  sim.publish(a.announce(0));
  sim.publish(a.leaseSlot('cell:9', { slotId: 'slot:9', durationTicks: 99 }, 1));
  sim.publish(mod.emit({ eventType: 'suspend_slot', sideband: 'moderation', payload: { slotId: 'slot:9' }, tick: 2 }));
  assert.equal(sim.report().finalWorldState.slots['slot:9'].moderation_status, 'suspended');
});

test('agent_intent is proposal-only and cannot override authority', () => {
  assert.equal(SIDEBANDS.agent_intent.klass, 'proposal');
  const sim = new HiveSimulator({ seed: 'sb-intent' });
  const room = sim.addRoom({ id: 'room:main' });
  const a = sim.addAgent({ id: 'agent:a' });
  const b = sim.addAgent({ id: 'agent:b' });
  sim.publish(room.announce(0));
  sim.publish(a.announce(0));
  sim.publish(b.announce(0));
  sim.publish(a.occupy('room:main', 'pulse', 1)); // A legitimately holds the cabinet
  // B *declares* it owns the cabinet on the intent channel.
  sim.publish(b.intent('occupy_cabinet', { roomId: 'room:main', machineId: 'pulse' }, 2));
  const state = sim.report().finalWorldState;
  assert.equal(state.rooms['room:main'].machines.pulse.occupiedBy, 'agent:a'); // unchanged
  assert.equal(state.intents['agent:b'].type, 'occupy_cabinet'); // recorded, but inert
});
