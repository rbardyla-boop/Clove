# Clove Research Experience v1

Status: bounded product unit implemented locally; production deployment remains a separate gate.

This unit freezes the Discovery Adapter Layer and adds the next boundary:

```text
discovered candidate → bounded retrieval → typed EvidenceClaim[]
  → scope validation → qualification/challenge → synthesis
  → visible result → portable Obsidian Markdown
```

The synthesizer receives `EvidenceClaim[]`. It does not receive arbitrary pages
or an untyped text blob. A claim carries its proposition, value and unit when
present, geography, population, measurement period, source identity and type,
source location, source fragment, evidence role, extraction method, validation
flags, status, retrieval time, and calculation operands where applicable.

## Implemented bounded paths

### Canada population

The existing Statistics Canada recipe is left unchanged. The experience
retrieves the population cube's actual vector datapoints through
`getDataFromCubePidCoordAndLatestNPeriods`, uses the Canada / total gender / all
ages coordinate, selects the latest annual reference period that is complete at
the request time, and preserves the vector, period, value, table, row, and
column as provenance.

### Federal cannabis law

The existing Justice Laws discovery result is left unchanged. The experience
retrieves the current consolidated Cannabis Act XML and extracts the young
person possession paragraph and definition. The UI places official text in a
separate panel from Clove's bounded textual reading. An ambiguous XML match
stops with `INTERPRETATION_REQUIRES_FURTHER_RESEARCH` instead of selecting a
provision silently.

### Scientific finding

The existing Crossref discovery result is left unchanged. Direct work metadata
is retrieved for candidate DOIs. A Crossref record without an abstract is
`METADATA_ONLY`; even an abstract remains qualified until study-level
validation. Bibliographic metadata never becomes a yes/no scientific result.

The previously proven electricity investigation is adapted into the same claim
boundary. Its generation operands, calculation formula, CER challenger, period
mismatch, and unresolved-disagreement behavior remain visible.

## Product surface

`/research/` is a static workspace served through the research Worker’s Assets
binding because the Worker already owns `/research/*`. The page provides:

- one factual question input and bounded examples;
- an operational status timeline;
- best-supported answer, reason, strongest datapoint, claims, sources,
  contradictions or qualifications, and unknowns;
- a clickable evidence graph that inspects claim and source nodes;
- `CHALLENGE THIS`, `SHOW ME THE SOURCE`, and `EXPORT RESEARCH` actions;
- distinct official-text / interpretation and metadata-only presentations.

The export is a portable bundle of readable Markdown files:

```text
Research/Investigation.md
Research/Claims/*.md
Research/Sources/*.md
Research/Contradictions/*.md
Research/Data/*.md
```

Each file has frontmatter. `Investigation.md` contains the answer, rationale,
claim/source links, qualifications, unknowns, and graph edges; it does not
require Clove to remain available.

## Routes

- `POST /research` without a mode preserves the existing recipe-selection or
  proven electricity behavior.
- `POST /research` with `{ "mode": "investigate", "question": "..." }`
  returns `{ ok: true, status: "research_complete", research }`.
- `POST /research/discover` remains the discovery-only contract.
- `POST /research/challenge` reruns the bounded experience and returns the
  configured challenge result.
- `GET /research/` and its static assets are served through the Worker Assets
  binding; no new persistent service is introduced.

## Verification gates

The local unit suite proves all three extraction recipes, typed claim fields,
exact source material, law separation, metadata-only science behavior, export
tree, and electricity adaptation. The browser regression exercises population,
law, and science through the actual static page, then clicks graph inspection,
source inspection, and export.

Discovery, electricity, cost-authority, and existing Insights gates remain
separate regressions. Cost infrastructure is closed and is not expanded by
this unit; no Workers AI, Browser Run, Vectorize, R2, search service, account
binding, or autonomous monitor is introduced.
