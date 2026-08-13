# DS H1 / DS-00 Repair Experiment

Status: `REPAIR_PROPOSAL_READY / ORIGINAL CANDIDATE FROZEN`

Date: 2026-08-13

## Frozen basis

- Original candidate: `3c0883a94e5a816df87d31f90f51280f023845d6`
- Exact tested head: `d8727e7d5946f48ada39199e77df9564a62e4203`
- DS-E0 packet SHA-256: `a5c060096e69535064254c47b56a9131ea21bff0046d000fdd0041917652ef20`
- Non-authoritative experiment branch: `experiment/ds-h1-repair-2026-08-13`
- Experiment base: exact tested head `d8727e7d5946f48ada39199e77df9564a62e4203`
- Candidate source diff in experiment worktree: none

## H1 localization

The three H1 non-qualifying proxy sessions did not share one interface cause:

- P01 stopped safely because the isolated proxy did not represent a bounded service/action to perform; it did not demonstrate that the candidate confused the reader.
- P03 completed 5/7 and stopped DS-03/DS-04 under the time-limited condition; DS-03 also has a genuine later operational check that cannot complete in one sitting.
- P05 marked all modules partial and required seven coaching points under the fast-reading condition.

P02 and P04 completed 7/7 without coaching. The current evidence therefore localizes H1 to a mixed proxy/task-exposure limitation plus a possible fast-reader friction signal, not to one demonstrated DS-00 mechanism. No H1 candidate repair is authorized from this result.

## DS-00 wording slice

The experiment held the state transition and all other runtime copy constant. Five fresh isolated wording evaluators compared:

| Variant | Wording | Consensus result |
| --- | --- | --- |
| A baseline | `Recovery verified` / `VERIFIED` | 5/5 misleading |
| B | `Recovery check passed` / `CHECK PASSED` | no evaluator marked safe; ambiguous-to-misleading |
| C | `Recovery state inspected` / `INSPECTED` | selected strongest by 5/5; 4/5 safe, 1/5 ambiguous |
| D | `Recovery materials present` / `MATERIALS PRESENT` | misleading-to-ambiguous; describes an unestablished fact |
| E | `Recovery readiness inspected` / `READINESS INSPECTED` | ambiguous; “readiness” broadens the claim |

The bounded recommendation is **Variant C** among the tested alternatives. It removes the implication that operational recovery was demonstrated. Its remaining weakness is that “state” is abstract and it does not explicitly preserve the observed “looks current” result.

The evaluators suggested a possible future wording direction such as `Recovery method checked — it looked current` / `LOOKED CURRENT`, but that wording was not part of this experiment and is not authorized.

## Sealed wording reports

| Report | SHA-256 |
| --- | --- |
| W01 | `ade51dd1e99071f03db4a7b5173e31c6ff38a3dddd593957cc1256b718213dd7` |
| W02 | `4cb903e1cf23e9c320d2186e8755b8a4c69de56e0bfc23de9ac26da907160c7f` |
| W03 | `5d85bdaf805e25ae3d4d2c6c0cba2bb2ccfc86852deb64af3cab318dd9689411` |
| W04 | `740a0fbb5cb3956c88061c28cfa9a35368945ea3d8d36be97ea7e0f37bd47025` |
| W05 | `4cd23291b80b7b8d666a89ec48a378e664954641acfdbb04073d206e7ec80e74` |

## Terminal boundary

No DS-00 file was edited. No candidate hash changed. No merge, deployment, or human-usability claim is authorized. A wording repair, if later accepted, must create a new candidate hash, pass the existing DS-I0–DS-I6 regression and production-exclusion gates, and undergo a new DS-E0 external evaluation before any human-evidence plan is reconsidered.
