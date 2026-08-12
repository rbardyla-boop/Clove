# CP-CDTT v0.3.1 External Blind Replay Scoring Report

**Terminal ruling:** `REPAIR_REQUIRED`

**Packet SHA-256:** `cf22c23b10b9822e47125842ac00d7ec883018e7cb58939247cae5f417c6041b`

The v0.3.1 repair preserved the original v0.3 artifacts and added explicit axis-precedence, canonical failure-family, κ-universe, and dependency instructions. E03 and E04 responses were hash-frozen before the repaired gold key was opened.

## Numerical result

| Metric | E03 | E04 | Gate |
|---|---:|---:|---:|
| Exact five-axis qualification profile | 80.0% (16/20) | 80.0% (16/20) | ≥85% each |
| Proof-obligation macro-F1 | 0.6407 | 0.6449 | ≥0.80 |
| Mechanistic-overclaim false-positive rate | 0.0% (0/10) | 0.0% (0/10) | ≤5% |
| Canonical failure-family overlap | 10.0% (1/10) | 100.0% (10/10) | ≥85% each |

Active-axis pairwise Cohen κ:

| Axis | κ |
|---|---:|
| S | 0.0000 |
| F | 0.7778 |
| M | 0.7373 |
| P | 0.0000 |
| V | 1.0000 |
| **Macro** | **0.5030** |

Both evaluators passed the mechanism, prediction, validation, and branch firewall checks. Those safeguards are working, but reproducibility is not.

## Diagnosis after numerical scoring

- The direct-failure precedence repair was applied and the earlier gold-key contradiction was removed.
- E04 still treated the explicitly listed negative M claims in the V07/V10 axis-claims table as `NOT_CLAIMED`. The packet's case-level `claimed_axis` field and its axis-claims table do not express claim activity consistently enough.
- E03 and E04 disagree on several formal and mechanistic obligation statuses, producing the low PO macro-F1 and low κ values. This is evaluator instability at the evidence/obligation boundary, not a mechanistic-overclaim leak.
- E03 supplied canonical family values for only a small subset of rejected obligations. The response is structurally complete but semantically incomplete for the family-overlap metric.

## Terminal state

`REPAIR_REQUIRED`

This replay does not authorize F4 or `/lab`. Do not reuse E03/E04 as pass evidence. A further rerun would require a new frozen packet that makes claim activity and rejection-family completion mechanically unambiguous, followed by fresh evaluators.
