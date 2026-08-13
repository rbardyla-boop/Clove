# DS-E0 Reproduction Record

Status: `EXTERNAL_PASS / HUMAN_EVIDENCE_PENDING`

This record confirms the DS-E0 state from the shared workspace without changing the evaluation candidate.

## Candidate

- Candidate A source commit: `3c0883a94e5a816df87d31f90f51280f023845d6`
- Exact tested head: `d8727e7d5946f48ada39199e77df9564a62e4203`
- Candidate release state: `NON_PUBLIC`
- Serialized source files: 29
- Production preflight: `PASS`
- Public surface: baseline 302, candidate 302, added 0, removed 0
- Repair-history leakage hits: 0

## Frozen packet

- Packet SHA-256: `a5c060096e69535064254c47b56a9131ea21bff0046d000fdd0041917652ef20`
- Packet bytes: `202794`
- Manifest SHA-256: `5547da1f6cfda327ae7df96621c43b782553a44ac0807e2dd5436889f00836c5`
- Evaluator prompt SHA-256: `afc52dbc7941498e3be206c79dfbbcdb7935ef1cece733afbe4a199822b32d92`
- Whole-packet ZIP SHA-256: `85a172e6c488045f576fd856a863683401b5f0261e53b372094f780cfc87a75d`

## Sealed independent verdicts

| Evaluator | Response SHA-256 | Gate result | Overall |
| --- | --- | --- | --- |
| A | `ee5c8b41eda952aaf7a272c54cd5bdfe4be9a026de34b6c44707131f3983256d` | 8/8 PASS | `EXTERNAL_PASS / HUMAN_EVIDENCE_PENDING` |
| B | `1c64366f873b50e2d8811de057df5d5cf76846a34481ba551b4c79a1d8fd4211` | 8/8 PASS | `EXTERNAL_PASS / HUMAN_EVIDENCE_PENDING` |

## Ordering control

Both response files were hash-verified before opening either response. The initial eight-gate aggregate was computed before comparing response wording. The later comparison found only formatting and equivalent supporting rationale differences; there was no substantive gate or overall-verdict disagreement.

## Boundary

This clears the DS-E0 independent external evaluation gate only. It does not claim human usability evidence, authorize production deployment, or remove the DS-I0–DS-I6 production exclusion barriers.
