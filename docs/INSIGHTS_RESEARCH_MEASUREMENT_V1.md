# Insights Research measurement v1

This is the owner-side readout for the existing aggregate-only Insights D1
database. It adds no endpoint, identifier, dashboard service, or new storage.

## Beta baseline epoch

```text
BETA_BASELINE_T0 = 2026-08-09 after Measurement Access Gate PASS
```

The commissioning query on T0 returned verification/replay-contaminated
counts. Because `aggregate_daily` stores only calendar dates, post-baseline
queries use `day > '2026-08-09'` so the first clean full day is 2026-08-10.

Run from `workers/insights/`:

```bash
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

Interpret the result as a bounded funnel:

```text
opened → submitted → completed → inspected → exported → returned
```

The ratios are descriptive aggregate signals, not unique-user conversion
rates. No user identifier or cross-session identity is introduced.

The compatibility hotfix changes only validation of the existing aggregate
signal write. Retention remains 400 days for aggregate rows and 90 days for
feedback notes.
