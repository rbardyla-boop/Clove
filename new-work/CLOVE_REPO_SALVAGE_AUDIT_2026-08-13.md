# Clove Repository Salvage Audit + Brotherhood Research Ledger Replay

Date: 2026-08-13

## Terminal result

`SALVAGE_AND_RESEARCH_ARTIFACTS: PASS_WITH_DISCLOSED_LIMITS`

`CURRENT_REPOSITORY_REPLAY: REPAIR_REQUIRED`

The salvage and Brotherhood evidence work is present on current `main` and the production boundary remains intact. The current repository is not a clean terminal PASS because the replay found one stale public route and two pieces of project/test drift.

## Candidate and provenance

- Repository: `rbardyla-boop/Clove`
- Current head: `48a9917e96ace8f928938b6673a722d8f85699c9`
- Salvage branch: `origin/f0/brotherhood-salvage-audit-2026-08-12`
- Salvage branch is an ancestor of current `main`: verified
- Salvage PR: `#149`, merged 2026-08-12
- Salvage artifact commit: `202d52e3b4a62791c3fdde910ae7a6c25f70f5f4`
- Brotherhood ledger commit: `8bf194af3ba78008e8c2114a9006cf84a814a357`

## Canonical artifacts

| Artifact | Result | SHA-256 |
| --- | --- | --- |
| `docs/CLOVE_V2_SALVAGE_LEDGER.md` | present; F0 non-production; `PASS_WITH_DISCLOSED_LIMITS` | `5391a72fc9397954c23327141b51bf03506f9ba97902b791ad267dbc29bcda8f` |
| `docs/CLOVE_V2_RESEARCH_LEDGER.md` | present; F0 provisional evidence ledger | `a8b162bffee9149e1e47ea1b3cf2c5078489fe774e30cbfb3d16822780e1c99d` |
| `docs/CLOVE_V2_PROJECT_CONTROL.md` | present, but stale relative to current main | `8ad91e3fcc61fbded94094475886f329c824d548c461c85f4934d40a9fd64904` |

## Brotherhood ledger structural audit

- Core Clove hypothesis is explicitly classified `HYPOTHESIS`.
- 18 numbered claim sections were found.
- Each numbered claim has a classification; 19 classification lines include the core hypothesis.
- 15 source headers are present.
- The ledger uses calibrated classes including established descriptive findings, probable/limited evidence, contested claims, hypotheses, unsupported claims, and research-required items.
- It explicitly refuses the unsupported claim that young Canadian men are uniquely less connected than young women.
- It distinguishes association from causation and mechanism transfer from direct evidence.
- It records intervention harm, relationship failure, peer-support limits, and safeguarding implications.
- No human-effectiveness or durable behavior-change claim is promoted to established fact.

## Replayed checks

| Check | Result |
| --- | --- |
| `node scripts/release-preflight.mjs` | PASS; 302 included, 882 excluded; Mission runtime present; DS-I0–DS-I6 excluded |
| `npm run check:cost-constitution` | PASS; Workers Free; maximum paid spend `$0` |
| `npm run check:cost-authority` | PASS |
| `npm run check:research` | PASS |
| `npm run check:insights` | PASS; 8 tests |
| `npm run test:mission` | PASS; 10 tests |
| `npm run test:release` | 2/3 PASS; one stale-boundary failure, browser interaction subtest PASS |
| `npm run audit:product` | 124 pages, 248 runs, 1,367 controls; one retained 404 record |
| `git diff --check` | PASS |

## Repair-required findings

### 1. Stale VibeCenter public route

The repository contains no `game/vibecenter/` runtime, but the route remains referenced by:

- `home.js` daily-game rotation;
- `games/index.html` game card;
- `sitemap.xml`;
- `clove-signals.js` surface classification;
- `tests/static/retention-release.test.mjs`.

The product audit recorded `404 /game/vibecenter/` from the homepage desktop replay. This is a stale catalog reference, not evidence that VibeCenter is a working public game.

### 2. Release test uses the wrong curation boundary

`tests/static/retention-release.test.mjs` scans `curatedUploadFileList()` directly and therefore treats the deliberately non-public DS-I0–DS-I6 files as production pages. `scripts/release-preflight.mjs` and `scripts/build-production-upload.mjs` correctly exclude them. The test should consume the production-hardened list or explicitly apply the same hard exclusions.

### 3. Project-control document is stale

`docs/CLOVE_V2_PROJECT_CONTROL.md` still names the 2026-08-12 salvage branch as active and records F1 as the active milestone. Current main has since completed DS-I6 and DS-E0. This is documentation drift and should be reconciled before the next milestone is authorized.

## Scope limits

- This is a local repository/static-package replay; it does not reconcile live Cloudflare account resources.
- The browser crawl is local and cannot establish real-user effectiveness.
- The Brotherhood ledger cutoff remains 2026-08-12 as recorded in the ledger.
- No new sensitive data, human cohort, mentor system, minors program, or production deployment was introduced.
- Existing untracked DS-E0 freeze/evaluator artifacts remain outside the tracked production source and were not included in the production preflight.

## Bounded next repair

Repair only the stale VibeCenter references, align `retention-release.test.mjs` with the production curation boundary, and reconcile `CLOVE_V2_PROJECT_CONTROL.md` with current main. Then rerun the release preflight, release test, product audit, and static regression suite. Do not expand the Brotherhood hypothesis, add social infrastructure, or promote Digital Stewardship to production as part of this repair.
