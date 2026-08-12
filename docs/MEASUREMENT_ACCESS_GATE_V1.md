# Measurement Access Gate v1

Status: **PASS**

The production measurement code and owner read access are complete. The first
remote query succeeded against `clove-insights` on 2026-08-09.

The returned commissioning counts were:

```text
research_opened: 2
research_submitted: 2
research_completed: 3
research_insufficient: 1
source_inspected: 2
challenge_opened: 2
research_exported: 2
returned_visitors: 0
```

These counts are verification/replay-contaminated commissioning data, not user
behavior and not unique-user conversion rates.

## Clean beta epoch

```text
BETA_BASELINE_T0 = 2026-08-09 after Measurement Access Gate PASS
```

`aggregate_daily` stores dates rather than event timestamps. To exclude all
commissioning activity on the T0 date, future baseline queries use
`day > '2026-08-09'`; the first clean full aggregation day is 2026-08-10.

No repository, Worker, D1 schema, retention policy, or event contract change is
needed for this gate.

## Required operator permission

Create a dedicated Cloudflare API token scoped to the relevant account only,
with the single permission:

```text
Account → D1 → Read
```

Do not paste the token into chat or commit it. Set it in a clean shell as
`CLOUDFLARE_API_TOKEN` or provide it through the operator’s secret manager. The
repository `.env` file is not shell-valid and should not be sourced wholesale.

## Replay command

From `workers/insights/`:

```bash
CLOUDFLARE_API_TOKEN='[operator-provided token]' \
npx wrangler d1 execute clove-insights --remote --command \
  "SELECT
     COALESCE(SUM(CASE WHEN event='research_opened' THEN count ELSE 0 END), 0) AS research_opened,
     COALESCE(SUM(CASE WHEN event='research_submitted' THEN count ELSE 0 END), 0) AS research_submitted,
     COALESCE(SUM(CASE WHEN event='research_completed' THEN count ELSE 0 END), 0) AS research_completed,
     COALESCE(SUM(CASE WHEN event='research_insufficient' THEN count ELSE 0 END), 0) AS research_insufficient,
     COALESCE(SUM(CASE WHEN event='source_inspected' THEN count ELSE 0 END), 0) AS source_inspected,
     COALESCE(SUM(CASE WHEN event='challenge_opened' THEN count ELSE 0 END), 0) AS challenge_opened,
     COALESCE(SUM(CASE WHEN event='research_exported' THEN count ELSE 0 END), 0) AS research_exported,
     COALESCE(SUM(CASE WHEN event='returned' AND surface='research' THEN count ELSE 0 END), 0) AS returned_visitors
   FROM aggregate_daily
   WHERE day > '2026-08-09'"
```

Record the returned counts and the UTC time window. Calculate descriptive
aggregate ratios only; do not interpret them as unique-user conversion or
retention rates.
