# DS-H0 — Repaired-candidate human-evidence protocol rebind

Terminal ruling: **`DS_H0_COMPLETE / RECRUITMENT_NOT_AUTHORIZED`**  
Date: **2026-08-13**

## Claim under test

The frozen Human-Evidence Protocol v1 can be rebound from the original DS-E0 candidate to the externally cleared DS-E1 candidate without changing the human-evidence measurement design, thresholds, safety rules, or authorization boundaries.

## Binding lineage

| Field | Original protocol | DS-H0 rebound |
| --- | --- | --- |
| Candidate label | `DS-E0 Candidate A` | `DS-E1 Candidate A` |
| Candidate source commit | `3c0883a94e5a816df87d31f90f51280f023845d6` | `bd85378c9f40b11bfd9ea943e7f86a9bb1c392cc` |
| Exact tested head | `d8727e7d5946f48ada39199e77df9564a62e4203` | `bd85378c9f40b11bfd9ea943e7f86a9bb1c392cc` |
| Blind packet | DS-E0 | DS-E1 |
| Packet SHA-256 | `a5c060096e69535064254c47b56a9131ea21bff0046d000fdd0041917652ef20` | `2c54e87a123b8afe5d9719c45ad39655af896e0ebf3c51ccfdf89801f4c7c817` |

## Invariance checks

- Original protocol SHA-256: `f83f6ae099c787f599eab1d8098a175a6785cc8c1b052e3a79e64557ab3991c2`
- Rebound protocol SHA-256: `54360b4bd549a4b458288733ccdcfcaf703826a468d647f8d44a1796b44d52c1`
- Reverse-normalization result: exact original bytes recovered
- Non-binding protocol changes: `0`
- H1–H6 definitions and thresholds: unchanged
- Participant eligibility/exclusions: unchanged
- Safety and immediate-stop conditions: unchanged
- Record-sealing and analysis order: unchanged
- Terminal verdict definitions: unchanged
- Recruitment authorization: unchanged — not authorized
- Deployment authorization: unchanged — not authorized

The only changed content is candidate-binding metadata and the DS-E1 packet identifier/hash. The reason for the rebind is the externally validated bounded DS-00 repair, not a change to the human study design.

## Authoritative state

```text
DS-E0 ORIGINAL        EXTERNAL_PASS / FROZEN
DS-R1                 REPAIR_SUPPORTED
DS-E1                 EXTERNAL_PASS / HUMAN_EVIDENCE_PENDING
DS-H0                 COMPLETE / RECRUITMENT_NOT_AUTHORIZED
HUMAN EVIDENCE        PENDING
DEPLOYMENT            BLOCKED
```

No runtime file, candidate commit, production package, deployment configuration, recruitment process, participant record, or human-evidence claim was created or changed by DS-H0.
