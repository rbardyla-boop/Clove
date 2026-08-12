# CloveLearn v2 — DS-I2 Implementation Contract

Status: **AUTHORIZED FOR NON-PUBLIC BUILD ONLY**

Target: **DS-02 — IDENTITY COMPARTMENTALIZATION**

## Claim under test

Whether Clove can help one adult distinguish CRITICAL vs LOW-STAKES account contexts, inspect whether an existing secondary/alias lane is usable, and adopt a bounded future-use rule without collecting account identifiers, changing critical-account recovery, requiring new account creation, or implying anonymity.

## Governing safety rule

**No critical-account migration in DS-I2 v0.1.**

Do not change the email/phone/recovery method for banking, government, health, password-manager recovery, primary work, or another high-consequence account during this drill.

A second account is not automatically safer. More accounts can add recovery complexity. The goal is to reduce unnecessary linkage between low-stakes and critical contexts when a supported secondary/alias already exists or may be adopted later.

## User flow

`BOUNDARY → CURRENT_PATTERN → EXISTING_LANE → RECEIVE_CHECK? → RECOVERY_AWARENESS? → FUTURE_RULE → COMPLETE`

Safe exits:
- every nonterminal stage → `STOPPED_SAFE`
- no existing lane → `FUTURE_RULE`
- unsure whether lane exists → `FUTURE_RULE`
- receive test declined/failed → `RECOVERY_AWARENESS` or `FUTURE_RULE`, with no migration
- recovery uncertain/outdated → `FUTURE_RULE`, with explicit no-migration warning

## Stage contract

### BOUNDARY
Choose the situation privately. Never type an address, provider name, username, phone number, password, recovery code, or account identifier into Clove.

Choices:
- `I'M READY`
- `I DON'T KNOW WHAT THIS MEANS`
- `STOP`

The helper explains only:
- CRITICAL = banking, government, primary work, health, password-manager/account recovery;
- LOW-STAKES = newsletters, shopping, trials, forums, promotions, non-critical downloads.

### CURRENT_PATTERN
Question: “Right now, how mixed are your critical and low-stakes accounts?”
Choices:
- `MOSTLY THE SAME EMAIL / LANE`
- `ALREADY MOSTLY SEPARATE`
- `I'M NOT SURE`

No address is entered.

### EXISTING_LANE
Question: “Do you already have a secondary email or provider-supported alias you can access?”
Choices:
- `YES — SECONDARY EMAIL`
- `YES — PROVIDER-SUPPORTED ALIAS`
- `NO`
- `I'M NOT SURE`

If NO / NOT SURE, no account creation is requested. Route to FUTURE_RULE.

### RECEIVE_CHECK
Reached only when an existing lane is reported.

Instruction: use the user's own mail app/provider outside Clove to send a harmless test message to the existing secondary/alias. Clove never sees either address or the message.

Use a neutral subject/body such as “test”. Do not include private information.

Choices:
- `TEST MESSAGE RECEIVED`
- `TEST DID NOT ARRIVE`
- `I DON'T WANT TO TEST THIS`

A failed/declined receive check does not trigger account changes.

### RECOVERY_AWARENESS
Reached when an existing lane is reported, regardless of receive result.

Question: “Without logging out or changing anything, can you identify how this secondary/alias would be recovered?”
Choices:
- `YES — RECOVERY LOOKS CURRENT / RECOGNIZABLE`
- `I FOUND RECOVERY, BUT I'M NOT SURE IT IS CURRENT`
- `NO / I DON'T KNOW`

Instruction: inspect only. Do **not** log out, reset a password, change recovery email/phone, remove multi-factor authentication, or consume a backup code as a test.

If recovery is uncertain, the lane is not cleared for critical use by Clove. DS-I2 never migrates critical accounts anyway.

### FUTURE_RULE
Question: “What rule will you use after this drill?”
Choices:
- `LOW-STAKES SIGN-UPS CAN USE A SECONDARY / ALIAS WHEN AVAILABLE`
- `KEEP MY CURRENT SETUP FOR NOW`
- `I NEED MORE HELP BEFORE CHANGING ANYTHING`

This is a future low-stakes rule only. It does not authorize moving existing critical accounts.

### COMPLETE
Structured result only:
- current pattern: mixed / separate / unknown;
- existing lane: secondary / alias / none / unknown;
- receive check: received / failed / declined / not-run;
- recovery awareness: current / uncertain / unknown / not-run;
- future rule: low_stakes_lane / keep_current / need_help.

No score, streak, rank, shame, or claim of anonymity/security guarantee.

## Local state allowlist

- schemaVersion
- stage
- currentPattern
- laneType
- receiveResult
- recoveryAwareness
- futureRule

Forbidden local/user fields:
- email address;
- provider name;
- username;
- phone number;
- account ID;
- password/passphrase;
- authentication token;
- recovery/backup code;
- message subject/body;
- contact name;
- exact URL;
- free text/notes.

## Network contract

DS-I2 v0.1: **zero network/telemetry**.

Clove does not send the test email. The user performs the test in their existing mail service outside Clove.

No fetch, XHR, sendBeacon, WebSocket, EventSource, remote form, third-party script/font/model, or analytics event.

## Safety exclusions

Never instruct the user to:
- create a new account as a requirement;
- migrate a critical account;
- change a critical account's sign-in or recovery route;
- log out to test recovery;
- reset a password merely to test recovery;
- remove/disable multi-factor authentication;
- consume a backup code merely to test it;
- use a fake identity to evade a lawful/legitimate control;
- use a burner/disposable phone as a routine privacy tactic;
- defeat age, fraud, identity, employment, financial, or safety controls;
- assume a secondary email makes them anonymous;
- spend money.

## Accessibility / simplicity

- one primary question per screen;
- explanation ≤70 words;
- ≤6 visible action buttons including STOP;
- minimum target height 44 CSS px;
- keyboard-only path;
- 390px no horizontal overflow;
- reduced-motion respected;
- no timer;
- `I'M NOT SURE`, `I DON'T WANT TO TEST`, `KEEP CURRENT`, and `STOP` are valid non-punitive outcomes.

## Failure injection

Test:
- malformed/stale/forged local state;
- stage prerequisite bypass;
- invalid enum/address-shaped mutation;
- localStorage read/write failure;
- reload each branch;
- back/forward;
- local-state clear;
- rapid duplicate activation;
- STOP from all nonterminal stages.

## Mutation controls

Harness must deliberately reject:
1. network call or remote mail-send attempt;
2. email/provider/free-text field;
3. illegal BOUNDARY → RECOVERY_AWARENESS transition;
4. instruction to migrate a bank/government/critical account;
5. instruction to log out/reset password/use backup code as test;
6. instruction claiming a secondary address makes the user anonymous;
7. release package containing DS-I2 runtime.

## Release boundary

DS-I2 HTML/JS must be explicitly hard-excluded and independently named as release-preflight forbidden sentinels before it may merge to `main`.

Prior DS-I0 and DS-I1 regression gates must remain green at the exact PR head.

## Terminal states

- `SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`
- `REPAIR_REQUIRED`
- `RETIRE`

No public deployment is authorized by this unit.
