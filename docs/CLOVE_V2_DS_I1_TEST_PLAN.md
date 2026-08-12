# CloveLearn v2 — DS-I1 Test Plan

Status: **LOCKED BEFORE IMPLEMENTATION**

## A. Static privacy / network contract
Fail if runtime contains:
- free-text input/textarea/contenteditable;
- fetch/XHR/beacon/WebSocket/EventSource;
- third-party asset URL;
- provider/app/account identity fields;
- location value, contact identity, filename/photo metadata, password/token/recovery code fields.

## B. State-machine oracle
Ordered path:
`BOUNDARY → SETTING_CLASS → CLASSIFY`

Branches:
- REQUIRED → COMPLETE
- UNCLEAR → COMPLETE
- OPTIONAL → CHANGE_DECISION
- OPTIONAL + NO_CHANGE → COMPLETE
- OPTIONAL + CHANGED → TASK_CHECK
- task works → COMPLETE
- task fails/unsure → RECOVER
- recovery outcome → COMPLETE or STOPPED_SAFE

STOPPED_SAFE is legal from every nonterminal stage.

Reject forged later stages without prior coarse answers.

## C. Browser matrix — Chromium and Firefox
- REQUIRED → no change;
- UNCLEAR → no change;
- OPTIONAL → changed → task works;
- OPTIONAL → changed → task fails → restored / works;
- OPTIONAL → changed → task fails → restored / still not working;
- OPTIONAL → no change;
- STOP from boundary and every nonterminal stage;
- reload/resume;
- malformed JSON;
- forged state;
- storage read/write failure;
- storage clear;
- back/forward;
- rapid duplicate activation;
- 390px + keyboard + reduced motion.

## D. Safety-copy gate
Fail if candidate instructs user to:
- disable MFA/two-factor authentication;
- disable security/fraud/payment-verification alerts;
- disable emergency/medical/caregiver/on-call controls;
- fake identity or age;
- spoof/manipulate geolocation;
- bypass fraud/access/identity controls;
- delete/wipe an account/device to test;
- spend money to test.

## E. Simplicity budget
Per visible stage:
- one primary question;
- explanation ≤70 words;
- ≤7 visible buttons including STOP;
- target height ≥44px;
- accessible name on every control;
- no timer;
- no horizontal overflow at 390px.

## F. Mutation proof
Deliberately inject and reject:
- POST network call;
- providerName/email/freeText field;
- BOUNDARY → TASK_CHECK transition;
- “disable MFA to see whether the app still works”;
- “spoof your location”;
- removal of production hard exclusion.

## G. Release isolation
Before main merge:
- `digital-stewardship-01.html/js` hard-excluded from production builder;
- both independently named as release-preflight forbidden sentinels;
- existing Mission 001 required runtime remains included;
- public included count remains at the established boundary unless an independently explained public-file change occurred.

## Terminal rule
Any real privacy, safety, state-integrity, accessibility or release-isolation failure is `REPAIR_REQUIRED`; no waiver converts it to PASS.
