# Insights Research Signal Compatibility Hotfix v1

Status: **LOCKED FOR SEPARATE DEPLOYMENT AUTHORIZATION**  
Candidate runtime manifest SHA-256: `38e78f7ecb09793c40d5114820640c03ed9593de98775a363514e30ec92ca439`

## Claim under test

The existing aggregate-only Insights Worker can accept the seven already-designed
research events without accepting or storing research content, while existing
events, origin checks, privacy behavior, and retention remain unchanged.

## Runtime candidate

The manifest hash covers only:

- `workers/insights/src/contracts.ts`
- `workers/insights/src/index.ts`
- `workers/insights/wrangler.jsonc`
- `workers/insights/worker-configuration.d.ts`
- `workers/insights/migrations/0001_privacy_first.sql`

The candidate adds no binding, route, D1 migration, table, retention, or response
shape changes. The existing D1 binding remains `INSIGHTS_DB`.

The accepted research events are exactly:

```text
research_opened
research_submitted
research_completed
research_insufficient
source_inspected
challenge_opened
research_exported
```

Validation returns only the existing coarse fields: event, surface, device,
return bucket, referrer group, build, variant, detail, and diagnostic. Unknown
input fields—including question, answer, source URL, claim, topic, Obsidian
contents, identifiers, IP addresses, and full referrers—are discarded before the
D1 bind. Unknown event names remain rejected.

## Checks

```bash
npm --prefix workers/insights run check
node --test tests/insights/research-signal-compatibility.test.mjs
```

The production replay is intentionally skipped unless explicitly enabled:

```bash
LIVE_INSIGHTS_RESEARCH=1 node --test tests/insights/research-signal-compatibility.test.mjs
```

That replay checks all seven events, legacy events, unknown-event rejection,
private-field stripping, origin rejection, accepted browser signals, same-origin
networking, and GPC/DNT suppression.

No production deployment is authorized by this lock. The separate deployment
command, after explicit authorization, is:

```bash
cd workers/insights
npx wrangler deploy
```

The owner readout after deployment is documented in
`docs/INSIGHTS_RESEARCH_MEASUREMENT_V1.md`.
