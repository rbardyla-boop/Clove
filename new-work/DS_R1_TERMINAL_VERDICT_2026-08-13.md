# DS-R1 — bounded repair-candidate construction

Terminal ruling: **`DS_R1_REPAIR_SUPPORTED`**  
Date: **2026-08-13**

## Claim under test

Changing only the DS-00 completion wording to Variant C should remove the inspection-versus-recovery overclaim signal without regressing the existing DS-I0 safety, privacy, state, accessibility-proxy, or release-boundary behavior.

This is an engineering/proxy claim only. It is not human evidence and does not authorize deployment.

## Candidate lineage

- Frozen base: exact tested head `d8727e7d5946f48ada39199e77df9564a62e4203`
- DS-R1 candidate commit: `bd85378c9f40b11bfd9ea943e7f86a9bb1c392cc`
- Authorized change: DS-00 `Recovery verified` → `Recovery state inspected`; `VERIFIED` → `INSPECTED`
- Changed paths: one (`digital-stewardship-00.js`)
- Changed lines: two replacements in one `renderComplete()` block
- DS-00 HTML unchanged
- DS-01–DS-06 unchanged
- Candidate runtime repair-history leakage: `0`

## Deterministic checks

| Check | Result |
| --- | --- |
| JavaScript syntax | PASS |
| Exact diff boundary | PASS — one file, one function, four diff lines |
| DS-I0 static/state/mutation/release tests | PASS — 31/31 under Firefox |
| Production preflight | PASS — 302 included, DS-I0 excluded, 0 errors |
| Hardened upload construction | PASS |
| Chromium replay | Not run — required `chrome` channel unavailable in environment |

The Chromium limitation is disclosed; it is not treated as a candidate failure. The same DS-I0 suite passed completely under the installed Firefox engine.

## Sealed proxy result

Five protocol-clean records were sealed before aggregation. Two earlier P01 attempts were retained as invalid for explicit protocol deviations and were not scored.

| Metric | Original v1.1 proxy | DS-R1 proxy | Result |
| --- | ---: | ---: | --- |
| H1 uncoached ≥6/7 modules | 2/5 | 5/5 | improved |
| H2 recovery safety | 5/5 | 5/5 | no regression |
| H3 comprehension | 5/5 | 5/5 | no regression |
| H4 safety/privacy | 5/5 | 5/5 | no regression |
| H5 confusion abandonment | 5/5 | 5/5 | no regression |
| H6 next-day behavior | not scorable | not scorable | disclosed limit |
| DS-00 semantic-strength probe | overclaim signal present | 5/5 correctly bounded | improved |

P03 completed six modules and used `STOPPED_SAFE` for DS-03 under the time-limited condition; it did not abandon. All five records had zero procedural coaching, four safe recovery responses, eight of eight comprehension responses, zero evidence-boundary overclaims, and no safety/privacy flags.

## Credit assignment

Variant C receives direct credit for the bounded semantic repair: the repaired completion state says what the inspection established and does not imply that a real lockout recovery was demonstrated. H1 also improved from 2/5 to 5/5, but DS-R0 identified mixed proxy/task-exposure causes; that H1 improvement is observed, not uniquely attributable to the wording change.

## Verdict

`DS_R1_REPAIR_SUPPORTED` applies only to the isolated engineering candidate. It does not overwrite the historical DS-E0 result, establish human usability, or authorize merge, deployment, recruitment, or production exposure.

If this candidate is to advance, the next required lineage step is:

```text
new DS-R1 candidate
→ fresh external DS-E0 evaluation
→ only then reconsider human-evidence exposure
```

No further DS-R1 scope expansion is authorized.
