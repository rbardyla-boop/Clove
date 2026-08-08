# Clove Research

The first independently judgeable research path begins with a deterministic
source-recipe engine. It can classify clear questions into official Canadian
statistics, Canadian legislation or regulation, and scientific findings.

The proven electricity adapter accepts one factual question:

> What percentage of Canada's electricity generation came from nuclear power in the latest complete year?

The path is evidence-first:

```text
question → evidence class → source recipe → ranked public sources → exact datapoints
         → independent check → contradiction search → supported answer
         → evidence graph → portable Obsidian Markdown
```

The persistent recipe registry is [`../../agent/source-recipes.json`](../../agent/source-recipes.json).
It contains source priorities, access methods, mandatory checks, freshness rules,
challenge strategy, prohibited source roles, and deterministic routing signals.
It contains no stored answer.

The initial answer uses public government sources only. It therefore does not
invoke Workers AI or Browser Run and does not spend a reservation. Any future
scarce operation must use the existing cost authority through the reserved-spend
helper before its provider callback runs.

Discovery Adapter Layer v1 adds a separate `POST /research/discover` route. It
executes the three registered source recipes against bounded authoritative
systems and returns normalized candidates, not factual answers:

```text
recipe → DiscoveryRegistry → live adapter → candidates → independence verdict
```

The adapters are Statistics Canada Web Data Service, Justice Laws official
HTML/XML, and Crossref REST. Scientific discovery returns `RESEARCH_REQUIRED`
until retrieval and extraction establish what a work proves. The adapter layer
does not use AI, Browser Run, generic search scraping, Vectorize, R2, or a new
cost path.

Evidence Extraction + Research Experience v1 adds the typed `EvidenceClaim[]`
boundary after discovery. `POST /research` with `mode: "investigate"` retrieves
bounded source material, extracts exact claims, validates scope, preserves
qualifications and unknowns, and returns a visible graph plus a portable
Obsidian Markdown export. The static `/research/` workspace is served through
the Worker Assets binding because the Worker already owns `/research/*`.

The three bounded experience paths are Statistics Canada population datapoints,
current Justice Laws Cannabis Act XML with official-text/interpretation
separation, and Crossref metadata-only scientific handling. See
[`../../docs/CLOVE_RESEARCH_EXPERIENCE_V1.md`](../../docs/CLOVE_RESEARCH_EXPERIENCE_V1.md).

The Worker binds the already-deployed `clove-research-cost-authority` Durable
Object externally and owns only the `/research/*` route. It does not route
ordinary site traffic, static assets, or cached evidence through that object.

Clearly classifiable but not-yet-adapted questions return a recipe plan with
`answerStatus: not_run`. Unclassifiable questions return `RECIPE_NOT_FOUND`.

## Commands

```bash
npm install
npm run types
npm run check
npm test
npm run test:live-discovery
npm run dry-run
```
