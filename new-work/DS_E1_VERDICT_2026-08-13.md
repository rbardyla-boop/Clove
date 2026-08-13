# DS-E1 Fresh External Replay

Terminal ruling: **`EXTERNAL_PASS / HUMAN_EVIDENCE_PENDING`**  
Date: **2026-08-13**

## Claim under test

The exact DS-R1 repaired candidate earns the frozen eight-gate external clearance independently, without repair-history leakage or evaluator guidance, while remaining non-public.

## Check

1. Verified candidate commit `bd85378c9f40b11bfd9ea943e7f86a9bb1c392cc`.
2. Reconstructed the complete 29-entry sanitized source set.
3. Confirmed the expected one-location delta from parent `d8727e7d5946f48ada39199e77df9564a62e4203`.
4. Confirmed public surface `302` with no path additions/removals.
5. Ran production preflight: `PASS`, zero errors.
6. Serialized and froze a neutral blind packet and deterministic ZIP.
7. Obtained two independent complete evaluator responses.
8. Sealed and hashed both responses before aggregation.
9. Computed the eight-gate aggregate before comparing response wording.

## Gate results

| Gate | Evaluator A | Evaluator B | Agreement |
| --- | --- | --- | --- |
| 1. Evidence fidelity | PASS | PASS | yes |
| 2. Actionability | PASS | PASS | yes |
| 3. Fear/paranoia control | PASS | PASS | yes |
| 4. Privacy/data minimization | PASS | PASS | yes |
| 5. Recovery safety | PASS | PASS | yes |
| 6. Reputation/sexual-content safety | PASS | PASS | yes |
| 7. Low-literacy usability on paper | PASS | PASS | yes |
| 8. Release integrity | PASS | PASS | yes |

Exact gate agreement: **8/8**. Both overall verdicts: **`EXTERNAL_PASS / HUMAN_EVIDENCE_PENDING`**.

## Post-aggregate disagreement inspection

Only after the 8/8 aggregate was frozen, the responses were compared. There was no substantive gate, overall-verdict, or repair-list disagreement. Differences were limited to equivalent rationale wording and formatting.

## Assumption register

- **Verified:** exact candidate identity; one-location source delta; 29 source entries; packet/ZIP hashes; no intended repair-history leakage; preflight PASS; complete evaluator responses; 8/8 agreement.
- **Checkable but not part of DS-E1:** human comprehension, real-world task completion, long-term usefulness, next-day behavior, and production operation.
- **Disclosed environment limit:** DS-R1’s Chromium replay was unavailable; DS-R1’s Firefox suite passed 31/31. DS-E1’s external rubric did not require Chromium execution.

## Credit assignment

This ruling credits the DS-R1 candidate as a whole for passing the independent external packet review. It does not convert the earlier proxy improvement into human evidence, and it does not claim that the wording alone caused evaluator agreement.

## Verification gap

Human evidence remains pending. The frozen human protocol still requires five independent first-time adults. No evaluator, model session, or internal agent counts as a human participant.

## Stop/continue

Stop DS-E1. Do not merge, deploy, expand the candidate, or reinterpret this external pass as human validation. Any future human-evidence or deployment unit requires separate authorization.

## Maturity status

The DS-R1 candidate is defined, compressed into a packet, tested, falsifiable, replayed, and compared against its frozen parent. It is mature for the **external-evaluation claim only**. It is not mature for human-usability, effectiveness, or deployment claims.
