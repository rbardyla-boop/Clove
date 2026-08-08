# Clove Research — Discovery Adapter Layer v1

Discovery Adapter Layer v1 turns the source-recipe plan into bounded live
source discovery. It returns normalized candidate records, never answers.

```text
question
  -> source recipe
  -> DiscoveryRegistry
  -> authoritative adapter
  -> normalized candidates
  -> independence evaluator
  -> retriever/extractor later
```

## Implemented adapters

### Statistics Canada

`official_canadian_statistic` uses the Statistics Canada Web Data Service:

- `getAllCubesListLite` discovers relevant product candidates;
- `getCubeMetadata` validates the product and confirms the Canada geography;
- normalized candidates preserve frequency, table end date, July 1 versus
  source-defined reference-period rules, product identifiers, and the future
  reference-period/vector retrieval endpoints.

The cube index is bounded at 8 MiB and metadata responses at 512 KiB. Each
request is time-limited. The adapter can return `DISCOVERY_PARTIAL` when the
catalog responds but one or more metadata validations fail.

### Justice Laws Website

`canadian_law` uses the official first-party `lookup_e.xml` title catalog, then
retrieves each bounded HTML table of contents and canonical XML document. It
preserves:

- Act versus regulation;
- current consolidated version;
- `currentTo` and last-amended metadata;
- unique/consolidated identifiers;
- direct XML URL;
- previous-version and related-provision links;
- visible not-in-force markers.

The adapter does not provide legal advice or interpret a provision.

### Crossref

`scientific_finding` queries the public Crossref `/works` endpoint and
normalizes DOI, title, authors, publication date, journal, work type, review
versus primary-study hints, funders, and correction/retraction update metadata.
Duplicate DOI records are removed. Every successful result remains
`RESEARCH_REQUIRED`: bibliographic discovery is not evidence extraction.

## Explicit statuses

Adapters use `DISCOVERY_COMPLETE`, `DISCOVERY_EMPTY`, `DISCOVERY_PARTIAL`,
`SOURCE_UNAVAILABLE`, `RATE_LIMITED`, `RECIPE_NOT_FOUND`, and
`RESEARCH_REQUIRED`. A network failure is never converted into “no evidence.”

The dedicated `POST /research/discover` route executes discovery. The existing
`POST /research` route remains the recipe-plan and proven-electricity path.

## Independence primitive

`evaluateSourceIndependence` groups candidates by DOI, StatCan data product or
vector, and finally canonical source URL. Three records for one DOI therefore
produce `independentSupportCount: 1`.

## Deliberate exclusions

This unit adds no AI, Browser Run, generic search scraping, Vectorize, R2,
accounts, or new cost infrastructure. No adapter reserves scarce compute.

## Verification

```bash
npm run check
npm test
npm run test:live-discovery
npm run dry-run
```

The fixture suite is deterministic and runs without network access. The live
suite is opt-in through `LIVE_SOURCES=1` and is not required for the offline
package to pass.
