# CloveLearn v2 — DS-I2 Verification Record

Terminal verdict: **SOLO_HARDENED / HUMAN_EVIDENCE_PENDING**

Date: 2026-08-12

## Canonical boundary

- Unit: DS-I2 — `IDENTITY COMPARTMENTALIZATION`
- Reconciliation PR: `#160`
- Exact pre-freeze boundary: `docs/CLOVE_V2_DS_I2_PRE_FREEZE.md` on the merged PR head
- Runtime: `digital-stewardship-02.html` + `digital-stewardship-02.js`
- Public deployment: **NOT AUTHORIZED / NOT INCLUDED IN PRODUCTION PACKAGE**

The verification document itself is post-merge documentation and does not alter the tested runtime, tests, or release guards.

## Claim under test

Whether Clove can help one adult distinguish CRITICAL vs LOW-STAKES account contexts, inspect whether an already-existing secondary/alias lane is usable, and adopt a bounded future-use rule without collecting account identifiers, changing critical-account recovery, requiring new account creation, or implying anonymity.

## Frozen user flow

`BOUNDARY → CURRENT_PATTERN → EXISTING_LANE`

Existing lane branch:

`RECEIVE_CHECK → RECOVERY_AWARENESS → FUTURE_RULE → COMPLETE`

No-lane / unsure branch:

`FUTURE_RULE → COMPLETE`

Safe exit:

`ANY NONTERMINAL STAGE → STOPPED_SAFE`

## Safety ruling

DS-I2 v0.1 does **not** require a user to create a new email address or alias.

It does **not** migrate or change the sign-in/recovery route for banking, government, health, password-manager recovery, primary work, or another high-consequence account.

An existing secondary/alias may be tested only by the user in their own mail service outside Clove. Clove does not send or receive the test message and never sees either address.

Recovery is inspection-only: no logout, password reset, recovery-address change, multi-factor-authentication removal, or backup-code consumption is used as a test.

The product explicitly states that a secondary email/alias does not make a user anonymous and that more accounts can create additional recovery complexity.

## Green gates

### Static privacy/safety contract
PASS.

Proved:
- first-party HTML + JavaScript only;
- no free-text fields;
- zero network/telemetry runtime;
- no email/provider/account/message-content storage fields;
- explicit no-critical-migration boundary;
- explicit no-anonymity guarantee;
- explicit non-destructive recovery boundary;
- 44px targets, reduced-motion handling, status region, noscript closeout and STOP contract.

### Branch-aware state oracle
PASS.

Proved:
- existing-lane and no-lane branches are distinct;
- skipped receive/recovery checks are recorded only as coarse `not_run` states;
- forged later stages are rejected;
- address/provider-shaped enum values are rejected;
- STOP is legal from every nonterminal stage.

### Deliberate bad-variant rejection
PASS.

The harness deliberately rejected:
- a network/mail-send mutation;
- a sensitive email/provider field;
- an instruction to move a banking account to the secondary lane;
- a destructive logout/recovery test instruction;
- an anonymity guarantee;
- an illegal `BOUNDARY → RECOVERY_AWARENESS` transition.

### Browser matrix — Chromium
PASS.

Covered:
- secondary lane → receive success → recovery recognizable → future low-stakes rule;
- alias → receive failure → recovery uncertain → keep current;
- existing lane → decline receive test → recovery unknown → need help;
- no lane → plan-only path;
- unsure lane → plan-only path;
- malformed JSON reset;
- forged state reset;
- storage read/write failure → explicit in-memory mode;
- local-state clear + reload;
- browser back/forward;
- STOP from every nonterminal depth;
- 390px mobile, keyboard, reduced motion, rapid activation, ≤6 visible buttons, ≤70-word explanation and ≥44px targets.

### Browser matrix — Firefox
PASS over the same DS-I2 browser matrix.

### Non-public release isolation
PASS.

`digital-stewardship-02.html` and `digital-stewardship-02.js` are blocked by both:
1. production hard exclusions; and
2. release-preflight forbidden sentinels.

DS-I0 and DS-I1 remain similarly private while Mission 001 remains included in the production package.

### Cross-module regression
PASS in the clean pre-merge checkout.

The exact pre-freeze DS-I2 tree replayed:
- DS-I0 static/state/mutation/release + Chromium + Firefox;
- DS-I1 static/state/mutation/release + Chromium + Firefox;
- DS-I2 static/state/mutation/release + Chromium + Firefox;
- shared production preflight.

Temporary write-enabled one-shot repair workflows were absent from the frozen tree.

## Red → repair history

1. Tests and CI were committed before product runtime; the initial run failed because `digital-stewardship-02.html/js` did not exist — intended red baseline.
2. The production-isolation gate required an explicit two-layer release lock. A bounded one-shot branch workflow added the DS-I2 hard exclusions/sentinels and deleted itself.
3. Clean browser replay exposed one test-only wording defect: completion copy said “nothing critical was moved,” while the assertion accepted only “no critical account was moved.” The assertion was widened to recognize the equivalent safe wording; product behavior was not weakened.
4. A normal documentation-only push followed each one-shot repair so the read-only verifier judged the repaired tree rather than relying on workflow-generated commits.

## Local state allowlist

DS-I2 stores only:
- schemaVersion;
- stage;
- currentPattern;
- laneType;
- receiveResult;
- recoveryAwareness;
- futureRule.

It does not request/store/transmit:
- email address;
- provider name;
- username;
- phone number;
- account ID;
- password/passphrase;
- authentication token;
- recovery/backup code;
- message subject/body;
- contact names;
- exact URLs;
- free text.

## What this verdict establishes

The implementation survived the defined solo static, state-machine, mutation, privacy, migration-safety, storage/recovery, cross-browser, accessibility-proxy, simplicity, release-isolation and prior-module regression gates.

## What it does not establish

This verdict does **not** establish:
- unaided comprehension by inexperienced/low-literacy adults;
- that compartmentalization measurably improves user security/privacy outcomes;
- long-term adherence to the future-use rule;
- assistive-technology usability beyond the automated/keyboard/browser checks performed;
- user demand/adoption;
- independent external evaluator agreement.

Those remain **HUMAN EVIDENCE PENDING**.

## Next gate

DS-I2 is terminal. The next unit may open **DS-I3 — ATTENTION DEFENSE**, but it must begin with its own frozen safety/spec/test contract. No public deployment or telemetry is authorized.
