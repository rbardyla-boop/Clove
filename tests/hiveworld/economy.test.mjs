/**
 * D. Economy tests — internal-only credits, account-bound goods, forbidden actions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HiveSimulator } from '../../arcade/hiveworld-sim/core/simulator.mjs';
import { createEvent } from '../../arcade/hiveworld-sim/core/events.mjs';
import { SidebandCRDTLog } from '../../arcade/hiveworld-sim/core/log.mjs';
import { fold } from '../../arcade/hiveworld-sim/core/world.mjs';

function build(ctx) {
  const sim = new HiveSimulator({ seed: 'econ', ctx });
  const a = sim.addAgent({ id: 'agent:a' });
  sim.publish(a.announce(0));
  return { sim, a };
}

test('credits can be granted in test mode', () => {
  const { sim, a } = build();
  sim.publish(a.grantCredits('agent:a', 100, 1));
  assert.equal(sim.report().finalWorldState.economy.credits['agent:a'], 100);
});

test('credits can be spent on a bound good, and the good is account-bound', () => {
  const { sim, a } = build();
  sim.publish(a.grantCredits('agent:a', 100, 1));
  sim.publish(a.mintBoundGood('good:1', 'cabinet_skin', 30, 2));
  const state = sim.report().finalWorldState;
  assert.equal(state.economy.credits['agent:a'], 70);
  assert.equal(state.economy.goods['good:1'].owner, 'agent:a');
  assert.equal(state.economy.goods['good:1'].bound, true);
});

test('spending more than the balance is rejected', () => {
  const { sim, a } = build();
  sim.publish(a.grantCredits('agent:a', 10, 1));
  sim.publish(a.spendCredits(50, 'too much', 2));
  assert.ok(sim.report().rejectedEvents.some((r) => r.reason === 'insufficient_credits'));
});

test('grants are rejected when economyTestMode is off', () => {
  const { sim, a } = build({ economyTestMode: false });
  sim.publish(a.grantCredits('agent:a', 100, 1));
  const report = sim.report();
  assert.equal(report.finalWorldState.economy.credits['agent:a'] || 0, 0);
  assert.ok(report.rejectedEvents.some((r) => r.reason === 'economy_locked'));
});

test('transfer / cashout / staking / yield / resale event types are all rejected', () => {
  const forbidden = ['transfer_good', 'cashout_credits', 'stake_credits', 'yield_credits', 'list_for_resale', 'sell_good', 'token_trade'];
  const log = new SidebandCRDTLog();
  for (const type of forbidden) {
    const ev = createEvent({ actorId: 'agent:a', eventType: type, sideband: 'market', payload: { amount: 1 }, logicalTick: 1, seq: 0 });
    const res = log.ingest(ev);
    assert.equal(res.status, 'rejected', `${type} should be rejected`);
    assert.equal(res.reason, 'forbidden_event_type');
  }
  assert.equal(log.size, 0); // nothing forbidden ever enters the fabric
});

test('there is no transfer path: a minted good stays with its owner across a fold', () => {
  const evs = [
    createEvent({ actorId: 'agent:a', eventType: 'agent_announce', sideband: 'discovery', payload: { role: 'player' }, logicalTick: 0, seq: 0 }),
    createEvent({ actorId: 'agent:a', eventType: 'mint_bound_good', sideband: 'market', payload: { goodId: 'g1', goodType: 'badge' }, logicalTick: 1, seq: 1 }),
  ];
  const state = fold(evs).state;
  assert.equal(state.economy.goods.g1.owner, 'agent:a');
  assert.equal(state.economy.goods.g1.bound, true);
});
