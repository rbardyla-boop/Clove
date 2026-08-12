# CloveLearn v2 — DS-I6 RECOVERY READINESS

Status: `BUILD CONTRACT / NON-PUBLIC`
Issue: #167

## Objective

Guide one adult to inspect the recovery readiness of one account or service they are authorized to use, without collecting credentials/codes/contact details or making an account change.

## Design boundary

This drill implements the locked stewardship principle that recovery is part of system ownership. It does not certify account security or diagnose compromise.

## Privacy architecture

**Ephemeral by design.**

Answers exist only in JavaScript memory for the current page session. Reload, close or navigation away resets the drill.

Forbidden persistence/transmission:
- localStorage;
- sessionStorage;
- IndexedDB;
- cookies;
- URL/query/hash answer state;
- telemetry/network requests for drill answers.

Clove accepts no free text or uploads and never asks for service/provider/account name, username, email, phone, address, password, passkey, PIN, two-factor code, recovery code, backup code, recovery contact value, security-question answer, device identifier, screenshot, receipt or support transcript.

## First-run safety rule

**Inspect only. Change nothing.**

Do not log out, start a password reset, remove or replace recovery methods, disable two-factor authentication, rotate backup/recovery codes, revoke sessions, delete the account, or start an account-recovery flow for this drill.

If normal access is unavailable, the drill stops the inspection path and points only to the service's official help/recovery route outside Clove. It never supplies bypass instructions.

## State machine

`BOUNDARY → NORMAL_ACCESS → RECOVERY_SETTINGS → RECOGNIZABLE_METHOD → SECOND_ROUTE → DECISION → COMPLETE`

Short conservative branches may enter `DECISION` early when normal access or settings access is unavailable/uncertain.

Safe exit from every nonterminal stage: `STOPPED_SAFE`.

Coarse in-memory values only:
- `normalAccess`: `yes | no | unsure`
- `settingsFound`: `yes | no | unsure`
- `recognizableMethod`: `yes | no | unsure`
- `secondRoute`: `yes | no | unsure`
- `decision`: `ready_enough | update_later | official_help | need_help`

## Questions

1. Can you access this account normally right now?
2. Can you locate its recovery/security settings without changing anything?
3. Does at least one listed recovery method look like something you still control? Do not enter it into Clove.
4. Is a second independent recovery route or backup option visible? Inspection only.

No answer proves that an account is secure or compromised.

## Decision outputs

- READY ENOUGH FOR NOW
- NEEDS A RECOVERY UPDATE LATER
- USE OFFICIAL HELP / RECOVERY OUTSIDE CLOVE
- NEED HELP BEFORE CHANGING ANYTHING

Clove performs no update.

## Simplicity budget

- one question at a time;
- ≤6 visible buttons including STOP;
- ≥44px targets;
- ≤70 words per explanatory block;
- keyboard, 390px and reduced-motion safe.

## Release/validation rule

The module's static/state/mutation/syntax/Chromium/Firefox gates run before the intentional release-isolation gate. Production exclusion is added only after the module itself is green, and that release-lock commit is the last planned branch change before DS-I0 through DS-I6 regression.

## Terminal states

- `SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`
- `REPAIR_REQUIRED`
- `RETIRE`
