import { COST_CONSTITUTION, validateCostConstitution } from './cost-firewall.mjs';

const errors = validateCostConstitution(COST_CONSTITUTION);
if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    constitution: COST_CONSTITUTION.name,
    version: COST_CONSTITUTION.version,
    plan: COST_CONSTITUTION.release.required_plan,
    maximum_paid_usd: COST_CONSTITUTION.release.maximum_paid_usd,
    budget_period: COST_CONSTITUTION.release.budget_period,
  }, null, 2));
}
