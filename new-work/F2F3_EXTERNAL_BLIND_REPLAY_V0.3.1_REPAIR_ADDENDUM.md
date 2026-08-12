# CP-CDTT v0.3.1 Blind Replay Repair Addendum

This addendum is normative for the v0.3.1 replay and must be supplied with the original frozen evaluator packet. It does not change the original v0.3 packet or its response artifacts.

## Axis disposition precedence

For each active axis, evaluate its own proof obligations before dependencies:

1. Any mandatory or activated obligation with `FAIL` makes that axis `FAILED`.
2. If no obligation fails, an `UNKNOWN` obligation makes that axis `BLOCKED`.
3. Only after the axis-local result is determined do dependencies apply. A dependency can convert an otherwise passing axis to `BLOCKED`, but it cannot convert an axis-local `FAILED` result to `BLOCKED`.
4. Unclaimed axes are `NOT_CLAIMED`.

This makes the gold derivation agree with the legality rule: direct failure has precedence over dependency blocking.

## Failure-family serialization

The supplied `F2F3_FAILURE_FAMILY_ENUM_v0.3.1.csv` is the closed vocabulary for `failure_family_if_blocking`. Use one or more exact `failure_family` values separated by semicolons, in the order of first appearance. Do not put IA codes or free-text labels in that field. Put exact `IA_codes` values in `ia_codes_if_fail`, also semicolon-separated.

## Cohen κ universe

Compute each per-axis evaluator κ over the active claimed rows for that axis only. Do not add implicit `NOT_CLAIMED` rows to the κ calculation. Exact qualification-profile agreement still compares the complete five-axis profile, with unclaimed axes represented as `NOT_CLAIMED`.

## Dependency reminder

M does not depend on V. PO-17 is V-only. Lack of qualifying validation evidence blocks V; it does not by itself block M. A MECHANISTIC or HYBRID P claim additionally depends on M, while a FORMAL P claim does not.
