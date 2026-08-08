# Clove Research Cost Constitution

This is a release constraint, not a pricing aspiration. The first Clove Research
release may run only on the Cloudflare Workers Free plan and has a hard paid-cost
ceiling of **$0.00**.

The machine-readable source is [`agent/cost-constitution.json`](../agent/cost-constitution.json).
The admission kernel is [`agent/cost-firewall.mjs`](../agent/cost-firewall.mjs).

## Non-negotiable rules

1. The release must be deployed under `workers_free`. A paid Workers plan is an
   installation failure, not an automatic upgrade path.
2. App-controlled budgets stop at 90% of each published Free-plan allowance:
   Worker requests, Workers AI neurons, Browser Run milliseconds, D1 rows read,
   D1 rows written, and D1 storage.
3. All resource reservations for an operation are atomic. If one resource would
   cross its release budget, none are reserved and the expensive callback is not
   invoked.
4. When new research is refused, the API returns HTTP `429` with
   `research_capacity_exhausted`. Existing evidence remains readable.
5. After refusal, the request must not call Workers AI, Browser Run, or write new
   D1 evidence.
6. The daily budget key is UTC. A production adapter must make admission globally
   atomic; a per-isolate JavaScript counter is not sufficient for that job.
7. No release change may silently alter the paid ceiling, Free-plan requirement,
   resource list, or hard-stop behavior. Change the constitution and its tests
   together.

## Why the spike test is meaningful

`tests/agent/cost-constitution.test.mjs` sends one million hostile deep-research
requests through the admission kernel. It asserts that:

- no more than the declared release request budget is admitted;
- no more than the declared AI/D1 budgets are consumed;
- the research callback runs only while every budget fits;
- requests after exhaustion cannot increment the expensive-call count; and
- the modeled paid bill stays at `$0.00`.

That is a deterministic proof of the application-level cost firewall. It is not
a substitute for checking the Cloudflare account's actual plan and dashboard
usage before deployment. The release checklist must still record a current
Workers Free-plan attestation.

## Release commands

```bash
npm run check:cost-constitution
npm run test:cost-constitution
```

The deployment owner must additionally verify the account plan in Cloudflare
before any production deploy. Cloudflare's Free plan currently fails further
operations at its published daily limits; the application budgets intentionally
stop earlier to leave headroom.
