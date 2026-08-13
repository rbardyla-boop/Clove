# DS-R0 — Proxy Failure Localization

Status: **COMPLETE / REPAIR SPECIFICATION BOUNDED / CANDIDATE FROZEN**  
Date: **2026-08-13**

## Scope

DS-R0 is engineering-only. It does not claim human usability, authorize recruitment, authorize deployment, or replace the frozen human-evidence gate.

The exact DS-E0 candidate remains frozen:

- source candidate: `3c0883a94e5a816df87d31f90f51280f023845d6`;
- exact tested head: `d8727e7d5946f48ada39199e77df9564a62e4203`;
- DS-E0 packet SHA-256: `a5c060096e69535064254c47b56a9131ea21bff0046d000fdd0041917652ef20`.

## Inputs

- AI proxy v1.1 verdict: `AI_PROXY_REPAIR_SIGNAL / HUMAN_EVIDENCE_PENDING`;
- H1 task completion: `2/5`;
- H2 recovery safety: `5/5`;
- H3 evidence comprehension: `5/5`;
- H4 safety/privacy: `5/5`;
- H5 confusion abandonment: `5/5`;
- H6: not scorable;
- DS-00 wording experiment: five fresh sealed reports, hashes recorded in [DS H1/DS-00 repair experiment](DS_H1_DS00_REPAIR_EXPERIMENT_2026-08-13.md).

## H1 localization

The three non-qualifying sessions did not share one demonstrated candidate mechanism:

- P01 safely stopped because the isolated proxy did not represent a bounded service/action to perform;
- P03 completed 5/7 under the time limit and stopped DS-03/DS-04;
- P05 produced partial results under fast-reading conditions and required coaching.

P02 and P04 completed 7/7 without coaching. The available evidence therefore identifies mixed proxy/task-exposure friction and a possible fast-reader friction signal, not one proven DS module defect. No H1 runtime repair is justified by this replay alone.

## DS-00 semantic localization

The baseline `Recovery verified` / `VERIFIED` wording was judged misleading by all five wording evaluators for an inspection-only state transition. The tested alternatives produced:

| Variant | Result |
| --- | --- |
| `Recovery verified` | misleading, 5/5 |
| `Recovery check passed` | ambiguous-to-misleading; 0/5 safe |
| `Recovery state inspected` | strongest tested; 4/5 safe, 1/5 ambiguous |
| `Recovery materials present` | misleading-to-ambiguous |
| `Recovery readiness inspected` | ambiguous; readiness broadens the claim |

The smallest bounded repair proposal is to test `Recovery state inspected` / `INSPECTED` in a new non-authoritative candidate. This is a proposal only; it has not been merged or applied to DS-E0. A future wording such as `Recovery method checked — it looked current` was suggested during analysis but was not part of the sealed comparison and is not approved.

## Terminal boundary

DS-R0 is complete as a diagnosis, not as a candidate repair. The next authorized engineering unit, if explicitly started, is:

```text
DS-R1 — DS-00 wording repair candidate
→ implement one bounded wording change only
→ assign a new candidate hash
→ run DS-I0–DS-I6 regression and exclusion checks
→ run fresh adversarial proxy slice
→ if accepted, freeze and repeat DS-E0 external evaluation
```

Until DS-R1 is separately authorized:

- no DS-00 runtime file changes;
- no merge;
- no deployment;
- no human-usability claim;
- no change to the frozen human protocol;
- no `HUMAN_PASS` inference from AI proxy results.
