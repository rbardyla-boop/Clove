/**
 * B. Occupancy tests — single occupant, denial, release, timeout, deterministic conflict.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HiveSimulator } from '../../arcade/hiveworld-sim/core/simulator.mjs';
import { occupancyConflict } from '../../arcade/hiveworld-sim/scenarios/canned.mjs';

function pulse(report) {
  return report.finalWorldState.rooms['room:main'].machines.pulse;
}

test('one agent can occupy a cabinet', () => {
  const sim = new HiveSimulator({ seed: 'occ1' });
  const room = sim.addRoom({ id: 'room:main', name: 'Main' });
  const a = sim.addAgent({ id: 'agent:a' });
  sim.publish(room.announce(0));
  sim.publish(a.announce(0));
  sim.publish(a.occupy('room:main', 'pulse', 1));
  assert.equal(pulse(sim.report()).occupiedBy, 'agent:a');
});

test('a second agent is denied (busy)', () => {
  const sim = new HiveSimulator({ seed: 'occ2' });
  const room = sim.addRoom({ id: 'room:main' });
  const a = sim.addAgent({ id: 'agent:a' });
  const b = sim.addAgent({ id: 'agent:b' });
  sim.publish(room.announce(0));
  sim.publish(a.announce(0));
  sim.publish(b.announce(0));
  sim.publish(a.occupy('room:main', 'pulse', 1));
  sim.publish(b.occupy('room:main', 'pulse', 2));
  const report = sim.report();
  assert.equal(pulse(report).occupiedBy, 'agent:a');
  assert.ok(report.rejectedEvents.some((r) => r.reason === 'busy'));
});

test('release frees the cabinet', () => {
  const sim = new HiveSimulator({ seed: 'occ3' });
  const room = sim.addRoom({ id: 'room:main' });
  const a = sim.addAgent({ id: 'agent:a' });
  sim.publish(room.announce(0));
  sim.publish(a.announce(0));
  sim.publish(a.occupy('room:main', 'pulse', 1));
  sim.publish(a.release('room:main', 'pulse', 2));
  assert.equal(pulse(sim.report()).occupiedBy, null);
});

test('disconnect/stale heartbeat triggers a timeout release', () => {
  const sim = new HiveSimulator({ seed: 'occ4', staleLockTicks: 3 });
  const room = sim.addRoom({ id: 'room:main' });
  const a = sim.addAgent({ id: 'agent:a' });
  sim.publish(room.announce(0));
  sim.publish(a.announce(0));
  sim.publish(a.occupy('room:main', 'pulse', 1)); // heartbeat noted at tick 1
  sim.disconnectAgent('agent:a');
  sim.advance(6); // no more pings -> room times the stale lock out
  const report = sim.report();
  assert.ok(report.authorityReport.timeouts.length >= 1, 'expected a timeout');
  assert.equal(pulse(report).occupiedBy, null);
});

test('conflicting occupancy resolves deterministically', () => {
  const a = occupancyConflict({}).report;
  const b = occupancyConflict({}).report;
  assert.equal(a.canonicalFingerprint, b.canonicalFingerprint);
  // exactly one occupant, exactly one busy rejection
  assert.equal(a.finalWorldState.rooms['room:main'].machines.pulse.occupiedBy, 'agent:alpha');
  assert.equal(a.rejectedEvents.filter((r) => r.reason === 'busy').length, 1);
});
