import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COST_CONSTITUTION,
  CostConstitutionError,
  createCostFirewall,
  operationCost,
  requestCost,
  validateCostConstitution,
} from '../../agent/cost-firewall.mjs';

test('constitution is valid and every release budget stays below the Free-plan ceiling', () => {
  assert.deepEqual(validateCostConstitution(COST_CONSTITUTION), []);
  assert.equal(COST_CONSTITUTION.release.required_plan, 'workers_free');
  assert.equal(COST_CONSTITUTION.release.maximum_paid_usd, 0);

  for (const [resource, definition] of Object.entries(COST_CONSTITUTION.resources)) {
    assert.ok(
      definition.clove_hard_limit < definition.cloudflare_limit,
      `${resource} needs release headroom`,
    );
    assert.ok(definition.default_reservation >= 0);
  }
});

test('paid-plan or unknown-plan execution is refused before any work can run', () => {
  assert.throws(
    () => createCostFirewall({ plan: 'workers_paid' }),
    (error) => error instanceof CostConstitutionError && error.code === 'workers_free_plan_required',
  );
  assert.throws(
    () => createCostFirewall(),
    (error) => error instanceof CostConstitutionError && error.code === 'workers_free_plan_required',
  );
});

test('reservation is atomic when one resource is exhausted', () => {
  const firewall = createCostFirewall({ plan: 'workers_free', dayKey: '2026-08-08' });
  const before = firewall.snapshot().usage;
  const denied = firewall.reserve({
    ai_neurons: COST_CONSTITUTION.resources.ai_neurons.clove_hard_limit + 1,
    d1_rows_written: 1,
  });

  assert.equal(denied.allowed, false);
  assert.equal(denied.resource, 'ai_neurons');
  assert.deepEqual(firewall.snapshot().usage, before);
});

test('one million-request traffic spike cannot create a paid bill', async () => {
  const firewall = createCostFirewall({ plan: 'workers_free', dayKey: '2026-08-08' });
  const deepResearchCosts = operationCost(firewall, 'deep_research');
  let expensiveCalls = 0;
  let refusals = 0;

  for (let request = 0; request < 1_000_000; request += 1) {
    const admitted = firewall.reserve(requestCost());
    if (!admitted.allowed) {
      refusals += 1;
      continue;
    }

    const result = await firewall.runIfAllowed(deepResearchCosts, async () => {
      expensiveCalls += 1;
      return { answer: 'bounded-test-answer' };
    });
    if (!result.allowed) refusals += 1;
  }

  const snapshot = firewall.snapshot();
  assert.equal(expensiveCalls, 10, 'only ten 900-neuron investigations fit');
  assert.ok(refusals > 999_000, 'the spike must be refused after exhaustion');
  assert.ok(snapshot.usage.worker_requests <= COST_CONSTITUTION.resources.worker_requests.clove_hard_limit);
  assert.ok(snapshot.usage.ai_neurons <= COST_CONSTITUTION.resources.ai_neurons.clove_hard_limit);
  assert.ok(snapshot.usage.d1_rows_read <= COST_CONSTITUTION.resources.d1_rows_read.clove_hard_limit);
  assert.ok(snapshot.usage.d1_rows_written <= COST_CONSTITUTION.resources.d1_rows_written.clove_hard_limit);
  assert.equal(snapshot.usage.browser_ms, 0, 'the default path does not launch Browser Run');
  for (const [resource, definition] of Object.entries(COST_CONSTITUTION.resources)) {
    assert.ok(
      snapshot.usage[resource] <= definition.cloudflare_limit,
      `${resource} must remain inside the published Free-plan limit`,
    );
  }
  assert.equal(snapshot.plan, 'workers_free');
  assert.equal(COST_CONSTITUTION.release.maximum_paid_usd, 0);
});

test('refusal does not invoke the expensive callback', async () => {
  const firewall = createCostFirewall({ plan: 'workers_free', dayKey: '2026-08-08' });
  let calls = 0;
  const costs = operationCost(firewall, 'deep_research');

  for (let i = 0; i < 11; i += 1) {
    const result = await firewall.runIfAllowed(costs, async () => {
      calls += 1;
    });
    if (i === 10) {
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'daily_budget_exhausted');
    }
  }

  assert.equal(calls, 10);
});
