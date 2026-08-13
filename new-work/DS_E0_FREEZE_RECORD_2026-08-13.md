# DS-E0 Freeze Record

Status: PACKET FROZEN / INDEPENDENT EVALUATION PENDING

## Evaluation candidate

- Candidate label: Candidate A
- Candidate source commit: `3c0883a94e5a816df87d31f90f51280f023845d6`
- Exact tested head: `d8727e7d5946f48ada39199e77df9564a62e4203`
- Release state: `NON_PUBLIC`
- Serializer source: `scripts/build-ds-e0-blind-packet.mjs` from the frozen DS-E0 evaluation branch

## Frozen artifacts

- Packet: `dist/ds-e0/DS_E0_BLIND_PACKET_2026-08-12.md`
  - SHA-256: `a5c060096e69535064254c47b56a9131ea21bff0046d000fdd0041917652ef20`
  - Bytes: `202794`
- Manifest: `dist/ds-e0/DS_E0_BLIND_PACKET_MANIFEST_2026-08-12.json`
  - SHA-256: `5547da1f6cfda327ae7df96621c43b782553a44ac0807e2dd5436889f00836c5`
- Evaluator prompt: `dist/ds-e0/DS_E0_EVALUATOR_PROMPT.txt`
  - SHA-256: `afc52dbc7941498e3be206c79dfbbcdb7935ef1cece733afbe4a199822b32d92`
- Blind packet ZIP: `ds-e0-blind-packet.zip`
  - SHA-256: `85a172e6c488045f576fd856a863683401b5f0261e53b372094f780cfc87a75d`

## Integrity checks

- ZIP integrity: PASS
- ZIP contents match the generated distribution: PASS
- Serialized source files verified against candidate commit: 29 / 29
- Production preflight: PASS
- Public surface comparison: baseline 302, candidate 302, added 0, removed 0
- Defined repair-history leakage patterns: 0 found

No evaluator response has been opened or scored in this freeze record. Independent responses must be sealed and hashed before any disagreement inspection.
