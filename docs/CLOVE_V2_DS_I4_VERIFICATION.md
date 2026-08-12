# CloveLearn v2 — DS-I4 terminal verification

Terminal verdict: **SOLO_HARDENED / HUMAN_EVIDENCE_PENDING**

Issue: #163
PR: #164
Merged canonical commit: `5e7bd1a7d5ac47ab523bb6be307673b2c59dae36`
Exact final PR head: `839e4e12dc1b5663b9cf956f634e5dd20aa170f6`
Frozen DS-I4 product/runtime candidate: `3c1368ca24caad22675c6d2cedeb71effd902fa6`

## Claim tested

Whether Clove can guide one adult to inspect one ordinary digital offer, distinguish the advertised headline from the actual commitment, and reach a conservative decision without purchasing, cancelling, entering payment data, identifying a merchant, or inferring personalized pricing.

## Locked scope

DS-I4 is a non-public local-first implementation of **OFFER REALITY CHECK**.

It does not:
- purchase, subscribe, cancel, contact a merchant, or enter payment data;
- collect merchant/app names, exact prices, currencies, account identifiers, receipts, URLs, screenshots or offer copy;
- label an offer deceptive, illegal or unfair;
- infer individualized or surveillance pricing from a promotion or technical capability;
- provide financial, legal or consumer-rights advice;
- transmit drill answers;
- implement timers, streaks or scores;
- authorize public deployment.

## Red → repair → green record

1. Tests and CI contract existed before the runtime. The first DS-I4 run failed at the static gate because `digital-stewardship-04.html/js` were absent. This was the required red baseline.
2. The minimum runtime then passed static, state-machine and deliberate-mutation gates but failed the non-public production-isolation gate. That was the required second red gate.
3. Two independent release barriers were added: hard exclusion in `scripts/build-production-upload.mjs` and forbidden sentinels in `scripts/release-preflight.mjs`.
4. Controller inspection found a real same-turn sequencing defect: the final commitment answer could render while the transition lock was still held and reject the automatic move to `DECISION`. The controller was repaired so validation/persistence occurs under the lock, the lock is released, and rendering occurs afterward.
5. Exact runtime candidate `3c1368ca24caad22675c6d2cedeb71effd902fa6` passed the DS-I4 static, state-machine, mutation, release-boundary, production-preflight, syntax, Chromium and Firefox gates.
6. CI hardening then addressed excessive GitHub notification noise and hosted-runner instability without changing DS-I4 product behavior:
   - Digital Stewardship permanent workflows are PR-only plus manual dispatch rather than every feature-branch push;
   - `actions/checkout` and `actions/setup-node` are v6;
   - project tests still target Node 22;
   - browser steps have a 180-second hard bound;
   - heavy I0/I1 browser suites run serially;
   - I0 and I2 reuse one browser process with isolated contexts after repeated browser launches were proven unstable;
   - the I0 browser-history replay uses native history navigation plus bounded URL assertions rather than a flaky Playwright `goBack()` waiter.
7. Exact final PR head `839e4e12dc1b5663b9cf956f634e5dd20aa170f6` passed DS-I0, DS-I1, DS-I2, DS-I3 and DS-I4 verification.

## Production boundary replay

On the final regression path, production preflight reported:
- status: `PASS`;
- public included files: **302**;
- excluded files: **861**;
- hardening exclusions: **108**;
- required Mission 001 runtime present;
- `digital-stewardship-00` through `digital-stewardship-04` HTML/JS all forbidden from production;
- errors: none.

Therefore merging DS-I4 does **not** authorize or cause a Digital Stewardship public release. Mission 001 remains the public product surface.

## Human-evidence boundary

The implementation has not established that an independent low-literacy adult will understand the drill, choose to use it voluntarily, or change purchasing behavior. No effectiveness, comprehension or behavioral-impact claim is authorized.

That limit is disclosed rather than used to block engineering indefinitely.

## Terminal ruling

**SOLO_HARDENED / HUMAN_EVIDENCE_PENDING**

DS-I4 is complete as a non-public implementation slice. Reopening it requires a concrete defect, new evidence that invalidates the claim boundary, or a later separately authorized public-integration gate.
