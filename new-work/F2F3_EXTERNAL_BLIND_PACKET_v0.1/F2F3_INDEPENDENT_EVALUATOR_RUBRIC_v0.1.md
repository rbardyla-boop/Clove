# CP-CDTT Independent Evaluator Rubric v0.1

Use this with `F2F3_EVALUATOR_PACKET_v0.1.csv`. Do not open the gold key until all classifications are frozen.

For each case, return:

1. `maximum_legal_level`: L0–L5.
2. `claimed_level_legal`: YES / NO / BLOCKED.
3. `failed_or_unknown_obligations`: list of PO identifiers (short aliases PO00–PO16 are accepted).
4. `primary_illegal_analogy_code`: one IA code if claim is rejected.
5. `secondary_codes`: optional.
6. `one_sentence_reason`.
7. `confidence`: 0.0–1.0.

Rules:

- Judge the **specific proposed claim**, not whether the analogy is interesting.
- Preserve lower-level validity when a stronger claim fails.
- Do not promote `UNKNOWN` evidence to `PASS`.
- A formal equation match does not establish shared physical mechanism.
- Source numerical parameters do not transfer without derivation/calibration.
- Regime restrictions and assumptions travel with a result.
- If the case lacks evidence needed for a mandatory obligation, use `BLOCKED` rather than inventing it.

Foundation pass thresholds after adjudication:

- exact maximum-level agreement >= 85%;
- weighted Cohen kappa between evaluators >= 0.80;
- dangerous-overclaim false-positive rate <= 5%;
- at least one primary failure-code agreement >= 75% on rejected cases.
