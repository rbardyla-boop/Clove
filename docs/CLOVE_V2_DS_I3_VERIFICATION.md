# CLOVE v2 — DS-I3 Verification

## Unit
DS-I3 — ATTENTION DEFENSE

## Terminal verdict
`SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`

## Frozen candidate
PR #162 head before merge:
`7879b5b7334fda25bab0f3a3cfd53a1dd76258b6`

Merged to `main` as:
`dd18d13a27a2ebe65be5e57dd999a3aad676d632`

## Claim under test
Whether Clove can guide an adult to inspect one nonessential notification stream, decide whether it deserves immediate interruption, make at most one reversible change, test that change through normal life, and restore the prior state if something important was missed or remains uncertain.

## Locked safety boundaries
- no dopamine/addiction/detox/reset or treatment claims;
- no blanket instruction to turn all notifications off;
- no changes to emergency/public-safety, medical/caregiver, security/2FA/fraud/payment, required on-call, or user-designated time-critical alerts;
- no app/provider/account/content free text;
- zero telemetry/network for drill answers;
- no timers, streaks, scores or public deployment;
- STOP from every nonterminal stage.

## Verification evidence
Before freeze, one clean tree passed:
- DS-I3 static privacy/safety contract;
- branch-aware state-machine oracle;
- deliberate bad-variant rejection;
- non-public release-boundary checks;
- shared production preflight;
- Chromium interaction/adversarial replay;
- Firefox interaction/adversarial replay;
- keyboard, narrow viewport, reduced-motion and rapid-activation checks;
- storage read/write failure, malformed/forged state, reload, clear and back/forward recovery;
- DS-I0, DS-I1 and DS-I2 cross-module regression on the same tree.

The release policy independently excludes `digital-stewardship-03.html` and `digital-stewardship-03.js`, so merging DS-I3 does not authorize or cause public release.

## Repair history
1. Tests and CI existed before runtime to establish a deliberate red baseline.
2. The mutation detector was repaired so the prohibition “This is not a dopamine detox” was not misclassified as affirmative detox language.
3. DS-I3 received both hard production exclusions and independent release-preflight sentinels before merge consideration.
4. No product safety boundary was weakened to make tests pass.

## Production boundary
The public CloveLearn package remains Mission 001 plus the previously approved public surface. DS-I0 through DS-I3 remain non-public.

Owner-reported production deployment after the latest curated 302-file upload:
`a3c5ec49-7ba3-4b66-b4a6-ff6349296bec`

## Disclosed limit
This terminal verdict proves implementation, release-boundary, safety and adversarial behavior to the extent covered by the automated/solo harness. It does not establish human comprehension, adherence, usefulness or behavioral effectiveness in independent users.

Human evidence remains unclaimed and non-blocking for continued non-public engineering.