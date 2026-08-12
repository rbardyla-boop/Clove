# CP-CDTT v0.3 External Blind Replay Scoring Report

**Terminal ruling:** `REPAIR_REQUIRED`

**Packet SHA-256:** `65185a575801ff609d7952c1ddd5e4d12391de093d5e6d640ac5b2068c294bc2`

The two evaluator response artifacts were hash-frozen before the internal gold key was opened. Both responses were complete: 886 proof-obligation rows and 75 active axis rows per evaluator.

## Locked metrics

| Metric | E01 | E02 | Gate |
|---|---:|---:|---:|
| Exact five-axis qualification profile | 70.0% (14/20) | 55.0% (11/20) | ≥85% each |
| Proof-obligation macro-F1 | 0.5849 | 0.6259 | ≥0.80 |
| Mechanistic-overclaim false-positive rate | 0.0% (0/10) | 0.0% (0/10) | ≤5% |

Active-axis pairwise Cohen κ:

| Axis | κ |
|---|---:|
| S | 1.0000 |
| F | 0.8925 |
| M | 0.7136 |
| P | 0.0000 |
| V | 1.0000 |
| **Macro** | **0.7212** |

The active-axis interpretation is primary because the evaluator packet serializes only claimed axes. If unclaimed axes are implicitly filled as `NOT_CLAIMED`, macro κ becomes 0.9079; this scoring universe was not explicitly frozen and must be clarified before the rerun.

Failure-family overlap is **not scorable as specified**. The packet supplies IA codes but does not define an allowed vocabulary or mapping for `failure_family_if_blocking`. E01 returned free-text family labels; E02 returned IA codes; the gold key uses a third canonical family vocabulary.

## Post-score diagnosis

1. The gold key violates its own legality semantics. Several axes are labeled `BLOCKED` even though their own mandatory proof obligations contain `FAIL`. The specification says any mandatory `FAIL` sets that axis to `FAILED`; dependency blocking cannot override a direct failure. This affects the I-series M claims and the I07 F claim.

2. E02 conflated validation with mechanism for the internal V03 case: it blocked M because no validation experiment was frozen, although PO-17 is V-only and M depends on F, not V. The resulting P block was a downstream consequence. This is evaluator error, but the packet should make the branch rule harder to miss.

3. The response schema does not define canonical failure-family values, so the failure-family threshold cannot distinguish evaluator error from serialization mismatch.

4. The two evaluators also show material obligation-level instability, producing the failed PO macro-F1 result. This is evidence that the frozen benchmark is not yet reproducible enough for F4.

## Required repair before rerun

- Regenerate the gold key from one explicit precedence rule: direct mandatory `FAIL` yields `FAILED`; dependency failure yields `BLOCKED` only when the dependent axis has no direct failure.
- Add a closed canonical enum for `failure_family_if_blocking` and an explicit IA-code-to-family mapping, or remove that metric until the mapping is defined.
- Freeze the κ scoring universe: active claimed axis rows only, or all five profile axes with implicit `NOT_CLAIMED`.
- Re-run two fresh evaluators against the repaired packet. Do not reuse these response files as pass evidence.

## State

`F4: BLOCKED`  
`/lab: BLOCKED`  
`Clove production: untouched`  
`Trade: closed`  
`Finance/MCP: separate`
