# Clove Source Recipe Engine v1

The source-recipe engine is the next product capability after the bounded
electricity nucleus. It answers a routing question before it answers a factual
question:

```text
What kind of knowledge is this?
  → where should reliable evidence exist?
  → how must it be validated?
  → what could disprove it?
```

The machine-readable registry is [`agent/source-recipes.json`](../agent/source-recipes.json).
The deterministic classifier and inspectable routing trace are implemented in
[`workers/research/src/source-recipes.ts`](../workers/research/src/source-recipes.ts).

## Recipes

### `official_canadian_statistic`

Prefers Statistics Canada, then relevant federal departments or regulators, then
provincial or territorial statistical agencies. It requires geography, period,
unit, annual/monthly, preliminary/final, and revision checks.

### `canadian_law`

Prefers the Justice Laws Website, official provincial or territorial legislation,
and CanLII for interpretation. It requires jurisdiction, in-force date,
amendment status, and statute/regulation distinction checks.

### `scientific_finding`

Prefers systematic reviews, original peer-reviewed studies, trial registrations,
and underlying datasets, with Crossref, OpenAlex, and PubMed as discovery paths.
It requires publication date, sample, effect, uncertainty, correction/retraction,
replication, and funding/conflict checks.

## Behavior

Known recipes return an inspectable `recipe_selected` plan when no proven
retrieval adapter exists yet. The plan contains no answer. Questions with no
deterministic class return `RECIPE_NOT_FOUND`; they do not receive an invented
research strategy.

The future `AI_ROUTER` seam remains behind the existing scarce-compute authority.
This version does not invoke AI or Browser Run for deterministic cases.

## Checks

```bash
npm run check:research
npm run test:research
npm --prefix workers/research run test:live
npm --prefix workers/research run dry-run
```
