import rawConstitution from './cost-constitution.json' with { type: 'json' };

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const constitution = deepFreeze(rawConstitution);

const USAGE_RESOURCES = Object.freeze([
  'worker_requests',
  'ai_neurons',
  'browser_ms',
  'd1_rows_read',
  'd1_rows_written',
  'd1_storage_bytes',
]);
const OPERATION_RESOURCES = Object.freeze([
  'd1_rows_read',
  'd1_rows_written',
  'ai_neurons',
  'browser_ms',
]);
const REQUIRED_OPERATIONS = Object.freeze(['cached_evidence', 'deep_research', 'browser_source']);
const REQUIRED_SERVICES = Object.freeze(['workers', 'd1', 'workers_ai', 'browser_run', 'durable_objects']);

export const COST_CONSTITUTION = constitution;

export class CostConstitutionError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'CostConstitutionError';
    this.code = code;
  }
}

function isFiniteNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function emptyUsage() {
  return Object.fromEntries(USAGE_RESOURCES.map((resource) => [resource, 0]));
}

function copyUsage(usage) {
  return Object.freeze({ ...usage });
}

export function validateCostConstitution(config = constitution) {
  const errors = [];
  const release = config?.release;
  const resources = config?.resources;
  const operationCosts = config?.operation_costs;

  if (release?.required_plan !== 'workers_free') errors.push('required_plan_must_be_workers_free');
  if (release?.maximum_paid_usd !== 0) errors.push('maximum_paid_usd_must_be_zero');
  if (release?.budget_period !== 'utc_day') errors.push('budget_period_must_be_utc_day');
  if (release?.over_limit_behavior !== 'fail_closed') errors.push('over_limit_behavior_must_be_fail_closed');
  if (release?.reserve_fraction !== 0.9) errors.push('reserve_fraction_must_be_0.9');
  if (JSON.stringify(release?.allowed_services) !== JSON.stringify(REQUIRED_SERVICES)) {
    errors.push('allowed_services_changed');
  }

  for (const resource of USAGE_RESOURCES) {
    if (!(resource in (resources || {}))) errors.push(`missing_resource:${resource}`);
  }
  for (const resource of Object.keys(resources || {})) {
    if (!USAGE_RESOURCES.includes(resource)) errors.push(`unknown_resource:${resource}`);
  }

  for (const resource of USAGE_RESOURCES) {
    const definition = resources?.[resource];
    if (typeof definition?.unit !== 'string' || definition.unit.length === 0) {
      errors.push(`invalid_resource_unit:${resource}`);
    }
    if (!isFiniteNonNegativeInteger(definition?.cloudflare_limit) || definition.cloudflare_limit <= 0) {
      errors.push(`invalid_cloudflare_limit:${resource}`);
    }
    if (!isFiniteNonNegativeInteger(definition?.clove_hard_limit) || definition.clove_hard_limit <= 0) {
      errors.push(`invalid_clove_hard_limit:${resource}`);
    } else if (definition.clove_hard_limit >= definition?.cloudflare_limit) {
      errors.push(`clove_hard_limit_must_be_below_cloudflare_limit:${resource}`);
    }
    if (!isFiniteNonNegativeInteger(definition?.default_reservation)) {
      errors.push(`invalid_default_reservation:${resource}`);
    }
  }

  for (const [operation, costs] of Object.entries(operationCosts || {})) {
    for (const resource of OPERATION_RESOURCES) {
      if (!isFiniteNonNegativeInteger(costs?.[resource])) {
        errors.push(`invalid_operation_cost:${operation}:${resource}`);
      }
    }
  }
  for (const operation of REQUIRED_OPERATIONS) {
    if (!operationCosts?.[operation]) errors.push(`missing_operation_cost:${operation}`);
  }

  if (config?.hard_stop?.new_research_response_status !== 429) {
    errors.push('new_research_must_refuse_with_429');
  }
  if (config?.hard_stop?.new_research_response_code !== 'research_capacity_exhausted') {
    errors.push('new_research_exhaustion_code_changed');
  }
  if (config?.hard_stop?.existing_evidence_remains_available !== true) {
    errors.push('existing_evidence_must_remain_available');
  }

  return errors;
}

function normalizeCosts(costs) {
  if (!costs || typeof costs !== 'object' || Array.isArray(costs)) {
    throw new CostConstitutionError('invalid_costs');
  }
  const normalized = {};
  for (const resource of USAGE_RESOURCES) {
    const value = costs[resource] ?? 0;
    if (!isFiniteNonNegativeInteger(value)) {
      throw new CostConstitutionError('invalid_cost', `${resource} must be a non-negative safe integer`);
    }
    normalized[resource] = value;
  }
  for (const resource of Object.keys(costs)) {
    if (!USAGE_RESOURCES.includes(resource)) {
      throw new CostConstitutionError('unknown_cost_resource', resource);
    }
  }
  return normalized;
}

/**
 * Create a single-UTC-day admission ledger. A production deployment must put
 * this admission decision behind a globally atomic store (for example, a
 * Durable Object); this pure ledger is the deterministic policy kernel and
 * test harness used by that adapter.
 */
export function createCostFirewall({ plan, dayKey = 'test-day', config = constitution } = {}) {
  const errors = validateCostConstitution(config);
  if (errors.length > 0) {
    throw new CostConstitutionError('invalid_constitution', errors.join(','));
  }
  if (plan !== config.release.required_plan) {
    throw new CostConstitutionError('workers_free_plan_required');
  }

  const usage = emptyUsage();

  function snapshot() {
    return Object.freeze({
      dayKey,
      plan,
      usage: copyUsage(usage),
      budgets: Object.freeze(Object.fromEntries(
        USAGE_RESOURCES.map((resource) => [resource, config.resources[resource].clove_hard_limit]),
      )),
      freeLimits: Object.freeze(Object.fromEntries(
        USAGE_RESOURCES.map((resource) => [resource, config.resources[resource].cloudflare_limit]),
      )),
    });
  }

  function reserve(costs) {
    const normalized = normalizeCosts(costs);
    const exhausted = USAGE_RESOURCES.find(
      (resource) => usage[resource] + normalized[resource] > config.resources[resource].clove_hard_limit,
    );
    if (exhausted) {
      return {
        allowed: false,
        reason: 'daily_budget_exhausted',
        resource: exhausted,
        snapshot: snapshot(),
      };
    }

    for (const resource of USAGE_RESOURCES) usage[resource] += normalized[resource];
    return { allowed: true };
  }

  async function runIfAllowed(costs, operation) {
    if (typeof operation !== 'function') {
      throw new CostConstitutionError('operation_must_be_function');
    }
    const reservation = reserve(costs);
    if (!reservation.allowed) return reservation;
    return { allowed: true, value: await operation() };
  }

  return Object.freeze({
    reserve,
    runIfAllowed,
    snapshot,
    operationCost(name) {
      const costs = config.operation_costs[name];
      if (!costs) throw new CostConstitutionError('unknown_operation', name);
      return Object.freeze({ ...costs });
    },
  });
}

export function requestCost() {
  return { worker_requests: 1 };
}

export function operationCost(firewall, name) {
  return firewall.operationCost(name);
}
