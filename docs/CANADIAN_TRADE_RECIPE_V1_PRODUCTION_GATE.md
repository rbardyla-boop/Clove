# Canadian Trade Recipe v1 — Production Gate

Status: **PASS_WITH_DISCLOSED_LIMITS**

The Canadian Trade Recipe v1 is deployed and production-proven. The disclosed limit is operational: provider-outage injection was verified in the local fixture suite, not by intentionally disrupting the live GAC or Statistics Canada endpoints.

## Candidate identity

- Git commit: `4ce22f302c4cdf4d1a174b242752aa346fc747bc`
- Candidate manifest SHA-256: `fe09044cb2ac11e2484d5cfb086dbf235e201681029e8c591a12cf752af99acd`
- Worker: `clove-research`
- Version ID: `886cc049-8c12-47d0-813f-72a2ca27daea`
- Route: `clovelearn.io/research/*`
- Deployment/replay record: `2026-08-11T09:58:44Z`
- Bindings: existing `COST_AUTHORITY` Durable Object and `ASSETS`; no binding changes

The manifest covers `agent/source-recipes.json`, all `research/` assets, all `workers/research/src/` files, and the Research Worker package/config inputs.

## Production replay

All requests used `POST /research/` with `mode: investigate`.

| Case | Result | Evidence |
|---|---|---|
| Exact proving query | PASS | `QUALIFIED`; `10,631,142,309 board feet → 25,086,702 m³` |
| Equivalent “how much softwood lumber” wording | PASS | Same `canadian_trade_statistic` intent and result |
| Value request | PASS | `RESEARCH_REQUIRED`; no volume substitution; zero claims |
| Missing measure | PASS | `RESEARCH_REQUIRED`; no answer synthesized |
| Wheat / wrong commodity | PASS | `RESEARCH_REQUIRED`; softwood recipe did not activate |
| Explicit 2024 period | PASS | `RESEARCH_REQUIRED`; 2025 was not substituted |
| Election alignment firewall | PASS | `RESEARCH_REQUIRED`; no population evidence |
| Conversion provenance | PASS | Original board-feet claim and separate derived conversion claim present |
| Statistics Canada challenger semantics | PASS | `28,275.8 thousand m³` retained as all-destination context, not contradiction |

Live exact-result claims:

```text
gac-softwood-2025-board-feet       10,631,142,309 board feet
gac-softwood-2025-cubic-metres     25,086,702 cubic metres
statcan-lumber-context-2025        28,275.8 thousand cubic metres · context
challenge                          executed
```

## Existing production regressions

- `GET /research/`: `200`
- Research HTML/CSS/JS assets: `200`
- Homepage `/`: `200`
- Privacy page: `200`
- Insights health endpoint: `200`, `privacy: aggregate-only`
- Population: `QUALIFIED`
- Electricity: `QUALIFIED`
- Canadian law: `QUALIFIED`
- Existing cost authority version: unchanged at `45848b40-57cd-4033-99d9-c039fb49890f`
- Existing Insights version: unchanged at `ad46713b-28fa-4112-b21d-c4430ca0d2fa`
- Response privacy headers: `no-store`, `nosniff`, and referrer policy present

## Verification commands

```bash
cd workers/research
npm run check
npm test
LIVE_SOURCES=1 npx vitest run test/live-trade.test.ts
```

Recorded local result: `36 passed, 4 skipped` in the default Research suite; the live trade replay passed separately.

Source-failure fallback and monthly-reconciliation disclosure remain covered by the local fixture tests. No production provider was intentionally taken offline.

## Boundary

Canadian Trade Recipe v1 is closed at this gate. No Elections Canada adapter, additional trade commodity, finance MCP adapter, Telegram expert path, cost change, Insights change, or Research Worker expansion is included in this production unit.
