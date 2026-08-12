# CloveLearn v2 — DS-I3 Test Plan

Status: **LOCKED BEFORE IMPLEMENTATION**

## A. Static privacy / network contract
Fail if runtime contains free text, network APIs, third-party assets, provider/app/account fields, notification content fields, exact schedule/time fields, credentials, tokens or recovery codes.

## B. State-machine oracle
Ordered start:
`BOUNDARY → INTERRUPTION_CLASS → INTENT`

Branches:
- REQUIRED_NOW → COMPLETE
- UNCLEAR → COMPLETE
- OTHER / NOT SURE → COMPLETE
- CAN_WAIT → CHANGE_DECISION
- no change → COMPLETE
- changed → REAL_LIFE_CHECK
- nothing important missed → COMPLETE
- important missed / unsure → RECOVER
- restored → COMPLETE
- STOP from every nonterminal stage.

Reject forged later-stage states and unknown enum values.

## C. Browser matrix — Chromium + Firefox
- marketing → can wait → changed → nothing important missed;
- social → can wait → changed → important missed → restored;
- news → can wait → changed → unsure → restored;
- required-now → no change;
- unclear → no change;
- OTHER / NOT SURE → inspection-only;
- optional no-change;
- STOP from all nonterminal stages;
- malformed/forged local state;
- storage read/write failure;
- clear/reload/back-forward;
- rapid activation;
- mobile 390px + keyboard + reduced motion + simplicity budget.

## D. Safety/evidence-copy gate
Fail copy that instructs or asserts:
- turn off all notifications;
- disable emergency, medical, caregiver, security, 2FA, fraud/payment or on-call alerts;
- dopamine detox/reset;
- universal addiction diagnosis;
- brain-rewiring claim;
- treatment benefit.

## E. Mutation proof
Deliberately inject and reject:
- POST/fetch event;
- appName/providerName/freeText field;
- BOUNDARY → REAL_LIFE_CHECK transition;
- “turn off all notifications”;
- “disable security / two-factor alerts”;
- “start a dopamine detox to reset your brain”;
- removal of production exclusion.

## F. Release isolation
Before merge:
- `digital-stewardship-03.html/js` hard-excluded;
- both independent release-preflight forbidden sentinels;
- DS-I0/I1/I2 remain private;
- Mission 001 remains public;
- shared production preflight green.

## G. Regression gate
Exact PR head must preserve DS-I0, DS-I1, DS-I2 and shared production release gates.

## Terminal rule
Any real privacy, critical-alert, evidence-copy, state-integrity, accessibility/simplicity or release-isolation failure forces repair; no waiver converts it to PASS.
