# CloveLearn v2 — DS-I1 Implementation Contract

Status: **AUTHORIZED FOR NON-PUBLIC BUILD ONLY**

Target: **DS-01 — SURVIVE THE FORCED GRID**

## Claim under test

Whether Clove can guide one adult to inspect one low-risk digital permission/setting around a real task, classify it as REQUIRED / OPTIONAL / UNCLEAR, reduce at most one clearly optional exposure, verify whether the task still works, and restore the setting if needed—without collecting account/provider details or teaching control evasion.

## First-run boundary

Choose a service genuinely used for a real task, but do **not** use banking, government identity, critical health, emergency/safety, employer-admin, password-manager recovery, or another high-consequence account for the first run.

Sign-in/account-linking changes are **outside DS-I1 v0.1 entirely**. They can affect account access and recovery, so they are deferred to a later evidence/test gate rather than offered as a first-run option.

## User flow

`BOUNDARY → SETTING_CLASS → CLASSIFY → CHANGE_DECISION → TASK_CHECK → RECOVER_IF_NEEDED → COMPLETE`

Safe exits:
- any nonterminal stage → `STOPPED_SAFE`
- REQUIRED → no change → COMPLETE
- UNCLEAR → no change → COMPLETE
- OTHER / NOT SURE → inspection only → COMPLETE

## Allowed setting classes

- `location`
- `contacts`
- `photos_files`
- `ordinary_notifications`
- `marketing_messages`
- `unknown`

No provider/app/account name is entered.

## Stage contract

### BOUNDARY
- pick one genuine low/medium-stakes service privately;
- do not type its name;
- `I HAVE ONE / I DON'T KNOW WHAT TO PICK / STOP`.

### SETTING_CLASS
Question: “Which one setting are you inspecting?”

Choices:
- LOCATION
- CONTACTS
- PHOTOS / FILES
- ORDINARY APP NOTIFICATIONS
- MARKETING EMAIL / SMS
- OTHER / NOT SURE

With STOP this yields a maximum of **7 visible buttons**, matching the low-literacy contract.

### CLASSIFY
Question: “For the real task you want to do, is this setting required?”
Choices:
- `REQUIRED`
- `OPTIONAL`
- `UNCLEAR`

Classification is about this task, not whether the provider is good or bad.

If `settingClass === unknown`, the drill is inspection-only and routes to COMPLETE without a change.

### CHANGE_DECISION
Reached only after OPTIONAL on a change-eligible setting class.

Change-eligible classes:
- location;
- contacts;
- photos/files;
- ordinary app notifications;
- marketing email/SMS.

Instruction: use normal operating-system/service settings to reduce **one** clearly optional permission/setting to the least exposure that still appears compatible with the task.
Choices:
- `I CHANGED ONE OPTIONAL SETTING`
- `I DECIDED NOT TO CHANGE IT`

Never tell the user which provider-specific value to select unless the provider's own documentation is being shown outside Clove. No free text.

### TASK_CHECK
If changed, ask the user to perform the real legitimate task.
Choices:
- `THE TASK STILL WORKS`
- `THE TASK DOES NOT WORK`
- `I'M NOT SURE`

If no change was made, route to COMPLETE.

### RECOVER_IF_NEEDED
Reached only after task failure/uncertainty following a change.
Instruction: restore the setting to its previous state using the same normal settings control.
Choices:
- `RESTORED — TASK WORKS AGAIN`
- `RESTORED — STILL NOT WORKING`
- `I NEED HELP / STOP`

No further configuration advice is given in v0.1.

### COMPLETE
Coarse result only:
- `REQUIRED — NO CHANGE`
- `OPTIONAL — CHANGED / TASK WORKED`
- `OPTIONAL — RESTORED`
- `OPTIONAL — NO CHANGE`
- `UNCLEAR — NO CHANGE`
- `OTHER / NOT SURE — INSPECTED ONLY`
- `STOPPED SAFELY`

No score, streak, shame, or rank.

## Safety exclusions

Never instruct the user to disable or weaken:
- emergency alerts;
- medical/caregiver alerts;
- account/security alerts;
- two-factor or multi-factor authentication;
- fraud/payment verification;
- password-manager/account recovery;
- employer on-call or required operational alerts;
- legal identity, age, safety, employment, financial, or anti-fraud controls.

Never teach:
- fake identity;
- age-gate bypass;
- geolocation spoofing/manipulation;
- fraud-control bypass;
- access-control circumvention;
- unlinking/removing/changing a sign-in identity in this first-run module;
- deleting an account/device as a test;
- spending money to complete the drill.

## Local state allowlist

- schemaVersion
- stage
- settingClass
- classification
- changeDecision
- taskResult
- recoveryResult

No free text.

Forbidden:
- provider/app name;
- username/email/phone;
- account ID;
- exact location;
- contact names;
- filenames/photo metadata;
- password/token/recovery code;
- marketing content;
- URL;
- notes.

## Network contract

DS-I1 v0.1: **zero network/telemetry**.

No fetch, beacon, analytics event, remote form, third-party script/font/model, WebSocket, or EventSource.

## Accessibility / simplicity

- one primary question per screen;
- explanation ≤70 words;
- ≤7 visible buttons including STOP;
- 44 CSS px minimum target;
- keyboard path;
- 390px no overflow;
- reduced-motion respected;
- no timer;
- STOP after entry and at boundary;
- `UNCLEAR` / `I'M NOT SURE` are valid, non-punitive.

## Failure injection

Test:
- malformed/stale/forged local state;
- stage prerequisite bypass;
- local storage read/write failure;
- reload each stage;
- back/forward;
- storage clear;
- rapid duplicate activation;
- hidden-stage bypass.

## Mutation controls

Harness must deliberately reject:
1. network call;
2. provider/account free-text field;
3. illegal stage transition;
4. instruction to disable MFA/security alerts;
5. instruction to spoof location or use false identity;
6. instruction to unlink/remove sign-in identity in this module;
7. release package containing DS-I1 runtime.

## Release boundary

DS-I1 runtime must be explicitly hard-excluded and independently forbidden by production preflight before it may merge to main.

## Terminal states

- `SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`
- `REPAIR_REQUIRED`
- `RETIRE`

No public deployment is authorized by this unit.
