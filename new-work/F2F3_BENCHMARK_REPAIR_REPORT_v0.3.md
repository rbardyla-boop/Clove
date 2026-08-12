# CP-CDTT Benchmark Repair Report v0.3

**Date:** 2026-08-10  
**Status:** `REPAIR_COMPLETE / INTERNAL_MECHANICAL_REPLAY_PASS / BLINDNESS_AUDIT_PASS / EXTERNAL_GATE_PENDING`

## 1. Repairs made

1. Replaced the ambiguous historical ceiling with a closed-book frozen evidence bundle for every case.
2. Added explicit S/F/M/P/V claim statements so stronger claims cannot silently rewrite weaker ones.
3. Retired the scalar ladder as primary scoring because predictive transfer does not logically require mechanistic transfer.
4. Added PO-17, a mandatory validation obligation, so P and V are mechanically distinguishable.
5. Made proof-obligation status axis-scoped, allowing (for example) a parameter mapping to pass F but fail M if stronger semantic identity is smuggled in.
6. Made `NOT_APPLICABLE` legal only for conditional obligations.
7. Split primary scoring into qualification profile, PO statuses, failure families, and IA diagnostic codes.
8. Replaced answer-bearing V/I identifiers with randomized opaque C01-C20 evaluator IDs.
9. Removed productive/overclaim class labels and adjudication vocabulary from evaluator evidence files.
10. Replaced the full canonical F2 in the external packet with a sanitized evaluator specification that omits worked examples, internal replay results, and source-register entries overlapping benchmark cases.

## 2. Mechanical gold replay

| Case | S | F | M | P | V |
|---|---|---|---|---|---|
| V01 | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED |
| V02 | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED |
| V03 | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | BLOCKED |
| V04 | SUPPORTED | SUPPORTED | NOT_CLAIMED | SUPPORTED | BLOCKED |
| V05 | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | BLOCKED |
| V06 | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | BLOCKED |
| V07 | SUPPORTED | SUPPORTED | FAILED | NOT_CLAIMED | NOT_CLAIMED |
| V08 | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED |
| V09 | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED | SUPPORTED |
| V10 | SUPPORTED | SUPPORTED | FAILED | NOT_CLAIMED | NOT_CLAIMED |
| I01 | SUPPORTED | FAILED | BLOCKED | NOT_CLAIMED | NOT_CLAIMED |
| I02 | SUPPORTED | SUPPORTED | FAILED | NOT_CLAIMED | NOT_CLAIMED |
| I03 | SUPPORTED | SUPPORTED | FAILED | NOT_CLAIMED | NOT_CLAIMED |
| I04 | SUPPORTED | BLOCKED | BLOCKED | NOT_CLAIMED | NOT_CLAIMED |
| I05 | SUPPORTED | FAILED | BLOCKED | NOT_CLAIMED | NOT_CLAIMED |
| I06 | FAILED | BLOCKED | BLOCKED | NOT_CLAIMED | NOT_CLAIMED |
| I07 | SUPPORTED | FAILED | BLOCKED | NOT_CLAIMED | NOT_CLAIMED |
| I08 | SUPPORTED | SUPPORTED | FAILED | NOT_CLAIMED | NOT_CLAIMED |
| I09 | SUPPORTED | SUPPORTED | FAILED | NOT_CLAIMED | NOT_CLAIMED |
| I10 | SUPPORTED | FAILED | BLOCKED | NOT_CLAIMED | NOT_CLAIMED |

The replay is generated directly from `F2F3_GOLD_PO_LONG_v0.3.csv` plus the dependency graph. No case-level qualification is hard-coded after obligation adjudication.

## 3. Critical branch test

V04 (Black–Scholes) is intentionally `S=SUPPORTED, F=SUPPORTED, M=NOT_CLAIMED, P=SUPPORTED, V=BLOCKED`. This is the regression case proving that a valid formal/predictive transfer is not forced to claim molecular Brownian mechanism.

I08 is the regression case for axis-scoped obligations: target-specific SIR-like parameters are legal at F, but biological parameter/mechanism identity fails at M without retroactively erasing F.

## 4. Evidence-boundary test

V03, V05, and V06 have useful P-qualified transfers but V is BLOCKED because the packet intentionally does not freeze a qualifying validation dataset. Evaluator memory may not promote them.

V01, V02, V08, and V09 contain explicit frozen validation evidence and reach V.

## 5. Remaining gate

This repair does **not** count as external validation. The gold-hidden packet must be scored by genuinely independent evaluators. F4/agent architecture remains blocked until that replay meets the frozen thresholds.
