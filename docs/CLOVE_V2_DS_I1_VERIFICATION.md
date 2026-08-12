# CloveLearn v2 — DS-I1 Verification Record

Terminal verdict: **SOLO_HARDENED / HUMAN_EVIDENCE_PENDING**

Date: 2026-08-12

## Exact candidate

- Runtime/test/release-policy freeze SHA: `a8644ebee90e17cf530c9aa4d33d84cf91383266`
- Documentation-aligned PR head: `a6d03b6053b2783e518684008f0cb99d208f5265`
- Branch verification run: `31618274999` — PASS
- Exact PR-head DS-I1 regression run: `31618503585` — PASS
- Exact PR-head DS-I0 regression run: `31618503587` — PASS
- Reconciliation PR: `#158`
- Merge commit: `0230298abf6936d352a2f759f17550ba36ed5214`

The verification document itself was added after merge and does not alter the tested DS-I1 HTML/JS, tests, or release guards.

## Claim under test

Whether Clove can guide one adult through one low-risk digital-setting inspection/change experiment around a real task, with at most one optional change and an explicit restore path if the task stops working, without collecting provider/account details, making network calls, or teaching control evasion.

## Final bounded flow

`BOUNDARY → SETTING_CLASS → CLASSIFY`

Branches:
- `REQUIRED → COMPLETE / NO CHANGE`
- `UNCLEAR → COMPLETE / NO CHANGE`
- `OTHER / NOT SURE → COMPLETE / INSPECTION ONLY`
- `OPTIONAL → CHANGE_DECISION`
- `OPTIONAL + NO CHANGE → COMPLETE`
- `OPTIONAL + CHANGED → TASK_CHECK`
- `TASK WORKS → COMPLETE`
- `TASK FAILS / UNSURE → RECOVER`
- `RECOVERED → COMPLETE`
- any nonterminal stage → `STOPPED_SAFE`

## Final first-run setting scope

Change-eligible:
- location;
- contacts;
- photos/files;
- ordinary app notifications;
- marketing email/SMS.

`OTHER / NOT SURE` is inspection-only.

Sign-in/account linking was deliberately removed from DS-I1 v0.1 before freeze because changing it can affect account access/recovery and because keeping it would have violated the locked simplicity budget of at most seven visible buttons including STOP.

## Exact green gates

### Static privacy/safety contract
PASS.

Proved:
- first-party HTML + JS only;
- no free-text inputs;
- zero `fetch`, XHR, beacon, WebSocket or EventSource;
- no provider/app/account identity fields;
- safety copy prohibits high-consequence and evasion experiments;
- sign-in/account-linking absent from first-run runtime;
- only coarse local-state fields are used;
- 44px targets, reduced-motion support, status region, noscript closeout and STOP contract present.

### Branch-aware state oracle
PASS.

Proved:
- legal branches are accepted;
- forged later-stage states are rejected;
- `OTHER / NOT SURE` cannot enter the change branch;
- deferred `account_linking` is not a valid runtime enum;
- unknown schema/stage/identity-shaped enum values are rejected;
- STOP is legal from each nonterminal stage.

### Deliberate bad-variant rejection
PASS.

The harness deliberately rejected:
- a POST network call;
- a sensitive `providerName` field;
- an instruction to disable multi-factor authentication;
- an instruction to spoof location;
- an instruction to unlink a sign-in account;
- an illegal `BOUNDARY → TASK_CHECK` transition.

### Non-public release isolation
PASS.

Proved:
- `digital-stewardship-01.html` is hard-excluded from production;
- `digital-stewardship-01.js` is hard-excluded from production;
- DS-I0 remains excluded;
- Mission 001 HTML/controller/private store remain included;
- independent release-preflight sentinels also block DS-I0 and DS-I1.

### Existing production preflight
PASS.

The shared production release policy remained valid. Mission 001 remained the required public runtime while the Digital Stewardship implementation slices stayed private.

### Chromium browser/adversarial replay
PASS — **12/12** at the frozen narrowed candidate.

Covered:
- OPTIONAL → changed → task works;
- OPTIONAL → changed → task fails → restore works;
- REQUIRED → no change;
- UNCLEAR → no change;
- sign-in/account linking absent;
- STOP at boundary/after entry;
- malformed/forged state reset;
- storage read/write failure with explicit in-memory continuation;
- local-state clear + reload and browser back/forward;
- 390px mobile, keyboard, reduced motion, rapid activation and seven-button/70-word simplicity budget;
- OTHER / NOT SURE inspection-only;
- restored-but-still-broken closeout;
- STOP from deeper change/check/recovery stages.

### Firefox browser/adversarial replay
PASS — **12/12** over the same matrix.

### Exact PR-head regression
PASS.

Before merge, GitHub reran both:
- DS-I1 Verify `31618503585` — all steps green;
- DS-I0 Verify `31618503587` — all steps green.

This proves the shared release-policy changes did not silently break the prior DS-I0 unit.

## Red → repair history

1. Tests/workflow existed before runtime; initial gate failed because DS-I1 did not exist — intended red-first proof.
2. Mutation harness initially treated the safety sentence `Do not disable...` as a bad instruction. The detector was repaired to distinguish prohibition from instruction; product safety copy was not weakened.
3. Non-public release gate then failed because the new root runtime was not yet explicitly excluded. Production hard exclusions and independent preflight sentinels were added.
4. Pre-freeze review found 7 setting choices + STOP = 8 visible controls, violating the locked `≤7` simplicity budget. The budget was not weakened. Sign-in/account linking was removed entirely from v0.1, leaving six setting choices + STOP.
5. The formal oracle was updated to model `OTHER / NOT SURE` as inspection-only and to reject the deferred sign-in class.

## Privacy and safety boundary

DS-I1 stores only:
- schemaVersion;
- stage;
- settingClass;
- classification;
- changeDecision;
- taskResult;
- recoveryResult.

It does not request or transmit:
- provider/app/service name;
- username, email, phone or account ID;
- exact location;
- contact names;
- filenames/photo metadata;
- passwords, tokens or recovery codes;
- free-text notes.

DS-I1 has zero telemetry and zero third-party runtime dependencies.

It explicitly excludes first-run changes to security/MFA, fraud/payment verification, emergency/medical/caregiver/on-call, account recovery, legal identity or other high-consequence controls. It does not teach fake identity, location spoofing, age-gate/access-control bypass, spending, or destructive account/device testing.

## Deployment boundary

DS-I1 is canonical in the repository but **not public**. Its runtime is blocked by both production hard exclusions and release-preflight forbidden sentinels. Removing those protections requires a separate explicit publication gate and full package replay.

No Cloudflare deployment was performed by DS-I1.

## What this verdict establishes

The implementation survived the defined solo static, state, mutation, privacy, storage/recovery, cross-browser, accessibility-proxy, simplicity and release-isolation gates.

## What it does not establish

This verdict does **not** establish:
- unaided comprehension by low-literacy adults;
- assistive-technology usability beyond the automated/keyboard/browser checks performed;
- long-term behaviour change;
- measurable privacy/security outcomes;
- user demand or adoption;
- independent external evaluator agreement.

Those remain **HUMAN EVIDENCE PENDING**.

## Next gate

DS-I1 is terminal. The next unit may open **DS-I2 — IDENTITY COMPARTMENTALIZATION**, but it must begin with its own frozen safety/spec/test contract. No critical-account migration, provider/email free text, public deployment, or telemetry is authorized.
