# Canadian Trade Recipe v1

Status: `LOCAL_PASS_WITH_DISCLOSED_LIMITS`

This is a local research capability. It is not a production deployment authorization.

## Bounded proving case

Question:

> How many cubic metres of softwood did Canada export to the US in 2025?

The deterministic intent records:

```text
commodity: softwood lumber
direction: export
partner: United States
period: 2025
measure: physical_quantity
requested unit: cubic metres
```

The recipe promotes only this bounded path. Other commodities, trade values, partner countries, years, and units remain `RESEARCH_REQUIRED` until separately specified and tested.

## Source priority

1. Specialized federal department or regulator aligned to the commodity.
2. Statistics Canada trade data for same-scope evidence or broader context.
3. Other official Canadian datasets.

For the proving case, Global Affairs Canada is the preferred authority because its softwood-lumber monitoring path is directly aligned to Canada–United States exports. Its scope is the defined monitored softwood-lumber product category, not every conceivable product made from softwood.

Statistics Canada table `16-10-0018-01` is retained as context only when retrieved: it covers total Canadian lumber exports to all destinations and includes softwood and hardwood. It is not labeled a contradiction of the partner-specific softwood result.

## Unit provenance

The original datapoint and conversion are separate linked claims:

```text
ORIGINAL
10,631,142,309 board feet

CONVERSION
board feet × 0.002359737216 m³/board foot

CONVERTED
25,086,702 cubic metres
```

The exported claim records the original value, original unit, factor, formula, and converted value. The original source unit is never overwritten.

## Annual and monthly source boundary

The extractor uses the canonical 2025 Global Affairs Canada annual report when it is available and supports the twelve monthly GAC reports as an explicitly labeled fallback when that annual endpoint is unavailable.

The local annual fixture contains the proving value above. The public monthly values currently sum to:

```text
10,262,763,669 board feet
24,217,425 cubic metres after conversion
```

That differs from `10,631,142,309` board feet. The implementation does not collapse those values or claim that the monthly sum is the annual reconciliation. The canonical annual endpoint and the live read-only replay both produced the annual result; production promotion still requires the separately authorized deployment replay.

## Local acceptance

```text
recipe selection                         PASS
specialized GAC discovery                PASS (fixture)
annual source extraction                 PASS (fixture)
live GAC annual extraction               PASS (read-only replay)
live Statistics Canada context           PASS (read-only replay)
monthly fallback disclosure              PASS (fixture)
board-foot source value preserved        PASS
deterministic cubic-metre conversion     PASS
commodity scope qualification            PASS (fixture)
broader context not false contradiction  PASS (fixture)
evidence graph                            PASS
Obsidian export                           PASS
unsupported trade path fails closed       PASS
```

Verification command:

```bash
cd workers/research
npm run check
npm test
# optional read-only public-source replay
LIVE_SOURCES=1 npx vitest run test/live-trade.test.ts
```

At this boundary, the production status remains unchanged. No Worker, cost authority, Insights schema, binding, or production route was deployed.
