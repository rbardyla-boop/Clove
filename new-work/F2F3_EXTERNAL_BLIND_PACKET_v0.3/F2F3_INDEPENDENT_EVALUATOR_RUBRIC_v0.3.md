# CP-CDTT Independent Evaluator Rubric v0.3

Use only the frozen files in the external packet. Do **not** add scientific facts from memory or outside lookup. Missing evidence remains `UNKNOWN`.

## What changed

The old scalar L0→L5 ladder is retired for scoring. Prediction and mechanism are separate branches. Score the five axes: S Structural, F Formal, M Mechanistic, P Predictive, V Validated.

Dependencies: `S→F`; `F→M`; `F→P`; `P→V`. If a P claim declares `MECHANISTIC` or `HYBRID` derivation basis, M is also a dependency. A `FORMAL` P claim may be supported while M is `NOT_CLAIMED` or fails, provided the P claim does not use the failed mechanism.

For every case/axis listed in `F2F3_EVALUATOR_RESPONSE_TEMPLATE_v0.3.csv`, score each active obligation:

- `PASS`
- `FAIL`
- `UNKNOWN`
- `NOT_APPLICABLE` only for a conditional (`C`) obligation with an explicit reason.

Then return each axis disposition in the axis-summary template:

- `SUPPORTED`
- `FAILED`
- `BLOCKED` (no fail, but required evidence is unknown or a dependency is blocked)
- `NOT_CLAIMED`

Rules: lower/sibling claims survive stronger-claim failure; a formal mapping does not prove a mechanism; source parameters do not transfer without target calibration; assumptions/regimes travel with the inference; V requires explicit frozen validation evidence.

Primary external-pass thresholds: exact qualification-profile agreement ≥85% each evaluator; macro per-axis Cohen κ between evaluators ≥0.80; mechanistic-overclaim false-positive rate ≤5%; failure-family overlap ≥85%; proof-obligation macro-F1 ≥0.80.
