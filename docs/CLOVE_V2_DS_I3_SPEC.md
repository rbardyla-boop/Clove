# CloveLearn v2 — DS-I3 Implementation Contract

Status: **AUTHORIZED FOR NON-PUBLIC BUILD ONLY**

Target: **DS-03 — ATTENTION DEFENSE**

## Claim under test

Whether Clove can guide one adult to identify one nonessential notification stream, decide whether it deserves immediate interruption, make at most one reversible change, test it through normal life, and restore it if something important was missed or remains uncertain—without clinical/addiction claims or disabling safety/security/medical/on-call controls.

## First-run eligible interruption classes

- marketing / promotional alerts;
- social activity alerts;
- news / entertainment alerts;
- game / re-engagement alerts;
- nonurgent shopping alerts;
- OTHER / NOT SURE — inspection-only.

## Explicit exclusions

Do not change:
- emergency/public-safety alerts;
- medical/caregiver alerts;
- two-factor authentication, security, fraud or payment-verification alerts;
- employer on-call / required operational alerts;
- a user-created calendar/reminder alert the user considers time-critical.

## User flow

`BOUNDARY → INTERRUPTION_CLASS → INTENT`

Branches:
- `REQUIRED_NOW → COMPLETE / NO CHANGE`
- `UNCLEAR → COMPLETE / NO CHANGE`
- `OTHER / NOT SURE → COMPLETE / INSPECTION ONLY`
- `CAN_WAIT → CHANGE_DECISION`
- `NO_CHANGE → COMPLETE`
- `CHANGED → REAL_LIFE_CHECK`
- `MISSED_NOTHING_IMPORTANT → COMPLETE`
- `MISSED_IMPORTANT / UNSURE → RECOVER`
- `RECOVERED → COMPLETE`
- every nonterminal stage → `STOPPED_SAFE`

## Stage contract

### BOUNDARY
Choose one low-risk notification stream privately. Do not type the app/provider/account name into Clove.

Choices:
- `I HAVE ONE`
- `I DON'T KNOW WHAT TO PICK`
- `STOP`

### INTERRUPTION_CLASS
Question: “Which kind of interruption are you inspecting?”
Choices:
- `MARKETING / PROMOTIONAL`
- `SOCIAL ACTIVITY`
- `NEWS / ENTERTAINMENT`
- `GAME / RE-ENGAGEMENT`
- `NONURGENT SHOPPING`
- `OTHER / NOT SURE`

With STOP this is 7 buttons, so DS-I3 simplicity budget is **≤7 visible buttons including STOP**.

### INTENT
Question: “Does this need to interrupt you when it arrives?”
Choices:
- `YES — I NEED IT NOW`
- `NO — IT CAN WAIT`
- `I'M NOT SURE`

For OTHER / NOT SURE, the module is inspection-only and must not enter the change branch.

### CHANGE_DECISION
Reached only after `CAN_WAIT` on an eligible class.

Before changing anything, remember the previous setting privately. Clove does not record it.

Instruction: use the app/device's normal settings to silence, disable, or schedule only this one nonessential stream. Do not change any excluded critical alert.

Choices:
- `I CHANGED THIS ONE STREAM`
- `I DECIDED NOT TO CHANGE IT`

### REAL_LIFE_CHECK
If changed, use the device normally through one real use period—a few hours or a day is enough. No timer or streak.

Choices:
- `I MISSED NOTHING IMPORTANT`
- `I MISSED SOMETHING IMPORTANT`
- `I'M NOT SURE`

### RECOVER
Reached after `MISSED IMPORTANT` or `UNSURE`.

Instruction: restore the previous setting for this one stream using the same normal settings control. Make no additional changes.

Choices:
- `RESTORED PREVIOUS SETTING`
- `I NEED HELP / STOP`

### COMPLETE
Coarse result only:
- required_now / no change;
- unclear / no change;
- unknown class / inspection only;
- can_wait / no change;
- changed / kept quiet;
- changed / restored.

No score, streak, shame, rank, dopamine claim, addiction label, or mental-health treatment claim.

## Local state allowlist

- schemaVersion
- stage
- interruptionClass
- intent
- changeDecision
- checkResult
- recoveryResult

Forbidden:
- app/provider/account name;
- notification text/content;
- contact/sender name;
- email/phone/account identifier;
- exact schedule/time;
- location;
- password/token/recovery code;
- free text/notes.

## Network contract

DS-I3 v0.1: **zero network/telemetry**.

No fetch, XHR, beacon, WebSocket, EventSource, analytics event, remote form, third-party script/font/model.

## Evidence/copy boundary

Do not teach as fact:
- “notifications hijack dopamine”;
- “social media is literally addictive” as a universal diagnosis;
- “dopamine detox”;
- “your phone is rewiring your brain”;
- “turn off all notifications.”

Allowed framing: recommendation/notification systems can optimize against engagement-related signals; this drill tests whether one interruption deserves immediate access to the user's attention.

## Accessibility / simplicity

- one primary question per screen;
- explanation ≤70 words;
- ≤7 visible buttons including STOP;
- target height ≥44px;
- keyboard-only path;
- 390px no overflow;
- reduced-motion respected;
- no countdown/timer;
- STOP from boundary and every nonterminal stage;
- `I'M NOT SURE` is valid and non-punitive.

## Failure injection

Test malformed/stale/forged local state, prerequisite bypass, localStorage read/write failure, reload, clear, back/forward, rapid duplicate activation, hidden-stage bypass and STOP at every depth.

## Mutation controls

Harness must reject:
1. network call;
2. provider/app/free-text field;
3. illegal BOUNDARY → REAL_LIFE_CHECK transition;
4. “turn off all notifications”;
5. “disable your security / two-factor alerts”;
6. “dopamine detox / addiction reset” treatment-style copy;
7. release package containing DS-I3 runtime.

## Release boundary

DS-I3 HTML/JS must be explicitly hard-excluded and independently named as release-preflight forbidden sentinels before main merge.

DS-I0/I1/I2 exact-head regressions must remain green.

## Terminal states

- `SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`
- `REPAIR_REQUIRED`
- `RETIRE`

No public deployment is authorized by this unit.
