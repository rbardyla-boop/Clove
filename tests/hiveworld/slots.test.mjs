/**
 * C. Slot tests — lease, expiry, suspension, non-holder rejection, placement authority.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HiveSimulator } from '../../arcade/hiveworld-sim/core/simulator.mjs';

function build() {
  const sim = new HiveSimulator({ seed: 'slot' });
  const room = sim.addRoom({ id: 'room:main' });
  const mod = sim.addAgent({ id: 'agent:mod', role: 'moderator' });
  const a = sim.addAgent({ id: 'agent:a' });
  const b = sim.addAgent({ id: 'agent:b' });
  sim.publish(room.announce(0));
  sim.publish(mod.announce(0));
  sim.publish(a.announce(0));
  sim.publish(b.announce(0));
  return { sim, mod, a, b };
}

test('an agent can lease a valid temporary slot', () => {
  const { sim, a } = build();
  sim.publish(a.leaseSlot('cell:1,1', { slotId: 'slot:1', slotType: 'kiosk', durationTicks: 20, allowedActions: ['place_object'] }, 1));
  const slot = sim.report().finalWorldState.slots['slot:1'];
  assert.equal(slot.holder, 'agent:a');
  assert.equal(slot.moderation_status, 'active');
});

test('an expired slot cannot place objects', () => {
  const { sim, a } = build();
  sim.publish(a.leaseSlot('cell:1,1', { slotId: 'slot:1', durationTicks: 3, allowedActions: ['place_object'] }, 1)); // ends at tick 4
  sim.publish(a.placeObject('slot:1', 'obj:1', { action: 'place_object' }, 10)); // well past end
  assert.ok(sim.report().rejectedEvents.some((r) => r.reason === 'slot_expired'));
});

test('a suspended slot cannot place objects', () => {
  const { sim, mod, a } = build();
  sim.publish(a.leaseSlot('cell:1,1', { slotId: 'slot:1', durationTicks: 50, allowedActions: ['place_object'] }, 1));
  sim.publish(mod.emit({ eventType: 'suspend_slot', sideband: 'moderation', payload: { slotId: 'slot:1' }, tick: 2 }));
  sim.publish(a.placeObject('slot:1', 'obj:1', { action: 'place_object' }, 3));
  const report = sim.report();
  assert.equal(report.finalWorldState.slots['slot:1'].moderation_status, 'suspended');
  assert.ok(report.rejectedEvents.some((r) => r.reason === 'slot_suspended'));
});

test('a non-holder cannot modify a slot', () => {
  const { sim, a, b } = build();
  sim.publish(a.leaseSlot('cell:1,1', { slotId: 'slot:1', durationTicks: 50, allowedActions: ['place_object'] }, 1));
  sim.publish(b.placeObject('slot:1', 'obj:1', { action: 'place_object' }, 2));
  sim.publish(b.renewSlot('slot:1', 10, 3));
  const reasons = sim.report().rejectedEvents.map((r) => r.reason);
  assert.ok(reasons.includes('not_holder'));
  assert.equal(reasons.filter((r) => r === 'not_holder').length, 2);
});

test('a non-moderator cannot suspend a slot', () => {
  const { sim, a, b } = build();
  sim.publish(a.leaseSlot('cell:1,1', { slotId: 'slot:1', durationTicks: 50 }, 1));
  sim.publish(b.emit({ eventType: 'suspend_slot', sideband: 'moderation', payload: { slotId: 'slot:1' }, tick: 2 }));
  const report = sim.report();
  assert.equal(report.finalWorldState.slots['slot:1'].moderation_status, 'active');
  assert.ok(report.rejectedEvents.some((r) => r.reason === 'not_moderator'));
});

test('placement succeeds inside the active window', () => {
  const { sim, a } = build();
  sim.publish(a.leaseSlot('cell:1,1', { slotId: 'slot:1', durationTicks: 50, allowedActions: ['place_object'] }, 1));
  sim.publish(a.placeObject('slot:1', 'obj:1', { action: 'place_object' }, 2));
  assert.equal(sim.report().finalWorldState.slots['slot:1'].placed_objects.length, 1);
});
