# Clove Research production beta candidate lock

Status: **LOCKED**  
Locked at: `2026-08-09T09:05:21Z`  
Candidate manifest SHA-256: `b2e9b0bc48eeda8b214d034bfb6c13c909cb88e50b1c83a770490750b23b57fd`

This lock is the boundary for Production Beta Gate v1. No source, configuration,
recipe, signal, or cost-constitution edits are permitted after this point unless a
later gate proves a defect.

The candidate hash is the SHA-256 of the sorted `sha256sum` records for these files:

- `agent/cost-constitution.json`
- `agent/cost-firewall.mjs`
- `agent/source-recipes.json`
- `clove-signals.js`
- `index.html`
- every file under `research/`
- every file under `workers/research/src/`
- every file under `workers/research-cost-authority/src/`
- every file under `workers/insights/src/`
- the research, cost-authority, and Insights Wrangler configs and generated worker types
- the existing Insights and cost-authority migrations

The deployable production targets are:

1. `clove-research`, routed at `clovelearn.io/research/*`, with `ASSETS` and the
   external `clove-research-cost-authority` Durable Object binding.
2. `clove-research-cost-authority`, providing the bound SQLite Durable Object.
3. `clove-insights`, preserving its existing D1 binding and accepting only the
   seven additive research events in the existing aggregate-only signal contract.

The existing static host `wild-hat-6257` is not overwritten. Its source/configuration
is not present in this workspace. The research client therefore uses the existing
`clovelearn.io/__clove/signal` endpoint directly, with the same coarse payload and
privacy opt-out checks, only when the older static signal client rejects a research
event. This is a compatibility path, not a second analytics system.

## Pre-lock evidence

- Research TypeScript and unit tests: 18 passed; 3 live-source tests skipped without live mode.
- Research browser UI gate: passed on population, law, and science fixtures.
- Insights contract tests: 4 passed.
- Cost constitution check: passed; `workers_free`, maximum paid USD `0`.
- Cost constitution adversarial test: passed.
- Cost-authority TypeScript check and tests: 7 passed.
- Wrangler dry-runs: research 92.73 KiB / 23.19 KiB gzip; Insights 8.55 KiB / 2.81 KiB gzip;
  cost authority 18.12 KiB / 4.36 KiB gzip. No AI or Browser Run binding is present.
- Authenticated account: account ID `bea9dc96b5924f5224d79146429b3795`; token can read Worker
  inventory and settings. The subscriptions endpoint returned 403, so Workers Free/Paid,
  Workers AI allowance, and active billing subscriptions remain disclosed operator checks.

After this lock, the gate may deploy and test only this candidate. Any failure must be
classified as a production defect, an external account disclosure, or an insufficient
outside-user observation—not solved by feature expansion.
