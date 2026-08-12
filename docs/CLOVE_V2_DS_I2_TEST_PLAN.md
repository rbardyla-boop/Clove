# CloveLearn v2 — DS-I2 Test Plan

Status: **LOCKED BEFORE IMPLEMENTATION**

## A. Static privacy / network contract
Fail if runtime contains:
- free-text input/textarea/contenteditable;
- fetch/XHR/beacon/WebSocket/EventSource;
- third-party asset URL;
- email/provider/account/address fields;
- message body/subject fields;
- credentials, authentication token or recovery-code fields.

## B. State-machine oracle
Ordered path:
`BOUNDARY → CURRENT_PATTERN → EXISTING_LANE`

Branches:
- existing secondary/alias → `RECEIVE_CHECK → RECOVERY_AWARENESS → FUTURE_RULE → COMPLETE`
- no lane / unsure → `FUTURE_RULE → COMPLETE` with receive/recovery explicitly `not_run`
- any nonterminal stage → `STOPPED_SAFE`

Reject forged later stages without required prior coarse answers.
Reject address-shaped enum values.

## C. Browser matrix — Chromium and Firefox
- secondary → receive success → recovery current → low-stakes future rule;
- alias → receive failed → recovery uncertain → keep current;
- existing lane → receive test declined → recovery unknown → need help;
- no existing lane → plan-only path;
- unsure lane → plan-only path;
- STOP from boundary and every deeper nonterminal stage;
- malformed JSON;
- forged state;
- storage read/write failure;
- storage clear + reload;
- browser back/forward;
- rapid duplicate activation;
- 390px mobile + keyboard + reduced motion;
- ≤6 visible buttons, ≤70-word explanation, ≥44px targets.

## D. Safety-copy gate
Fail if candidate instructs user to:
- create a new email/account as required completion;
- migrate banking/government/health/password-manager/critical-work account;
- change a critical recovery route;
- log out or reset password to test;
- remove/disable multi-factor authentication;
- use/consume a backup code as a test;
- use a fake identity or disposable/burner phone to evade controls;
- claim a secondary address creates anonymity;
- spend money.

## E. Mutation proof
Deliberately inject and reject:
- POST/fetch mail transmission;
- `emailAddress` / `providerName` / `freeText` field;
- BOUNDARY → RECOVERY_AWARENESS transition;
- “move your bank account to the secondary email”;
- “log out now to prove recovery”;
- “this makes you anonymous”;
- removal of production hard exclusion.

## F. Release isolation
Before main merge:
- `digital-stewardship-02.html/js` explicitly hard-excluded;
- both named as release-preflight forbidden sentinels;
- DS-I0 and DS-I1 remain private;
- Mission 001 required runtime remains included;
- existing production preflight remains green.

## G. Regression requirement
At exact PR head:
- DS-I2 Verify PASS;
- DS-I1 Verify PASS;
- DS-I0 Verify PASS.

## Terminal rule
Any real privacy, migration-safety, state-integrity, accessibility/simplicity or release-isolation failure forces `REPAIR_REQUIRED`; no waiver converts it to PASS.
