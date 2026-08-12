# CloveLearn v2 — DS-I0 Implementation Contract

Status: **AUTHORIZED FOR NON-PUBLIC BUILD ONLY**

Target: **DS-00 — KNOW THE MACHINE**

## Claim under test

Whether Clove can guide one adult through a five-part digital-service map and one safe recovery-path check without collecting sensitive account content, causing lockout, requiring technical jargon, or turning the lesson into passive reading.

## User flow

`ARRIVE → PICK A LOW-STAKES SERVICE PRIVATELY → DEVICE → APP/BROWSER → ACCOUNT → SERVICE/CLOUD → RECOVERY → SAFE CHECK → COMPLETE`

The user does **not** type the service/provider/account name into Clove.

## Interaction model

One card/decision per screen.

### Step 0 — boundary
- adult/general education notice;
- choose a low- or medium-stakes service already used;
- explicit warning not to use banking, government identity, or critical health account for the first run;
- `I HAVE ONE` / `I DON'T KNOW WHAT TO PICK` / `STOP`.

### Step 1 — DEVICE
Question: “What physical thing are you using right now?”
Choices: `PHONE / TABLET / COMPUTER / OTHER / I DON'T KNOW`.
No make/model/device identifier collected.

### Step 2 — APP OR BROWSER
Teach one distinction only:
- app = installed program;
- browser = program used to open websites.
Choices: `APP / BROWSER / BOTH / I DON'T KNOW`.
No browser/app name required.

### Step 3 — ACCOUNT
Question: “Does this service have a sign-in/account?”
Choices: `YES / NO / NOT SURE`.
Never ask for username, email, phone number, password, or account identifier.

### Step 4 — SERVICE / CLOUD
Teach: deleting something from this device is not automatically the same as deleting the account/provider copy.
Question: “If this device disappeared, do you think the service/account would still exist?”
Choices: `YES / NO / NOT SURE`.
Then show: “Do not guess. We will check the service's own account/help controls later.”

### Step 5 — RECOVERY
Question: “Can you identify at least one recovery path without showing it to Clove?”
Choices:
- `YES — RECOVERY EMAIL/PHONE`
- `YES — AUTHENTICATOR/BACKUP METHOD`
- `YES — PROVIDER SUPPORT/RECOVERY PAGE`
- `NO / NOT SURE`.
Never ask for the actual address, number, code, secret, URL token, or backup code.

### Step 6 — SAFE CHECK
If a recovery path is known:
- instruct user to open the service's own settings/help in another tab/window if practical;
- verify only that the recovery method shown is current/recognizable or that an official recovery page exists;
- explicitly: **DO NOT LOG OUT, RESET A PASSWORD, DELETE THE ACCOUNT, REMOVE MFA, OR USE A BACKUP CODE JUST TO TEST THIS DRILL.**

If recovery is unknown:
- completion can be `FOUND THE OFFICIAL RECOVERY/HELP LOCATION` without changing any account setting;
- if still unknown, user can choose `STOP — I NEED HELP` and receive a no-pressure closeout.

### Step 7 — COMPLETE
Show only structured summary labels, never provider/account details:
- DEVICE understood? yes/no
- APP/BROWSER understood? yes/no
- ACCOUNT relationship understood? yes/no
- PROVIDER/CLOUD relationship understood? yes/no
- RECOVERY path located? yes/no

Completion state:
- `MAPPED + RECOVERY VERIFIED`
- `MAPPED + RECOVERY LOCATION FOUND`
- `MAPPED + RECOVERY STILL UNKNOWN`
- `STOPPED SAFELY`

No shame/streak/rank.

## Local state

Store only coarse structured answers required to resume the drill. No free text.

Allowed local fields:
- schemaVersion
- stage
- deviceClass
- accessMode
- hasAccount
- providerPersistenceBelief
- recoveryClass
- recoveryCheckResult
- completedAtDayBucket (optional coarse day, if needed locally)

Forbidden local fields:
- provider/service name
- username/email/phone
- passwords/passphrases
- recovery codes
- identity documents
- exact URLs containing account identifiers or tokens
- free-text notes

## Network/telemetry

DS-I0 v0.1 must function with **zero telemetry**. No `fetch`, `sendBeacon`, analytics event, remote form, third-party script, CDN, or external model is required for the slice.

If telemetry is proposed later, it is a separate gate.

## Accessibility / low-literacy contract

- one primary question per screen;
- max one short explanation paragraph before choices;
- buttons at least 44 CSS px high;
- visible focus state;
- keyboard-only path;
- semantic headings and buttons;
- 390px viewport without horizontal overflow;
- `prefers-reduced-motion` respected;
- no timed decision;
- `I DON'T KNOW` is a valid answer, not an error;
- `STOP` is always available after entry.

## Failure/recovery contract

Test:
- missing local state;
- malformed JSON/state;
- unknown schema version;
- invalid/out-of-order stage;
- unavailable localStorage/IndexedDB if used;
- reload at every stage;
- back/forward navigation;
- same-turn/double activation;
- hidden-stage bypass attempt;
- disabled JavaScript message if practical;
- storage clear between sessions.

Failure must never expose sensitive data or trap the user in an unsavable state.

## Evidence-copy contract

Forbidden factual copy:
- “everything online is permanent”;
- “the cloud never deletes anything”;
- “apps spy on you”;
- “you are the product”;
- claims that the selected provider stores or tracks something unless the user checked the provider's own information;
- claims that one recovery method is universally safest.

Required distinction:
- device vs software vs account vs provider/service vs recovery.

## Mutation controls

Before PASS, the harness must deliberately reject at least:
1. a variant that asks for an email address or provider name;
2. a variant that transmits a structured answer over the network;
3. an illegal stage transition;
4. a variant that instructs the user to log out or consume a backup code as a test.

## Terminal states

- `SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`
- `REPAIR_REQUIRED`
- `RETIRE`

No public deployment is authorized by DS-I0 build completion alone.
