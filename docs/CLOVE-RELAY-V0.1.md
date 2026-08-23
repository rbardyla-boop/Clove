# Clove Relay v0.1

Status: `CORE IMPLEMENTED / SUBSTACK ADAPTER NOT YET QUALIFIED`

Tagline:

> **Write now. Go offline. Let the boring machinery publish.**

## Why this exists

Clove Relay came from a practical digital-temperance problem: a writer can finish months of work in advance and still be forced to remain inside a publishing dashboard to perform repetitive copying, calendar selection, audience selection, and schedule verification.

The automation target is deliberately narrow:

- open the writer's own publishing dashboard;
- create a draft;
- enter already-approved title/subtitle/body;
- select already-approved audience and delivery settings;
- select an already-approved future date/time;
- require final human confirmation;
- schedule;
- verify the scheduled entry;
- write a receipt.

The governing rule is:

> **Offload what consumes cognition without improving understanding. Keep what builds understanding, judgment and skill.**

Relay does not decide what to write, what to believe, or what deserves publication.

## v0.1 implementation

Implemented under `relay/`:

- Python package and CLI;
- YAML manifest parser;
- parser for the existing paste-ready detox-season source packets;
- local validation;
- source hashing;
- JSON + human-readable receipts;
- persistent local Playwright profile;
- manual-login flow;
- Substack editor fill path;
- fail-closed publishing-settings path;
- audience=`everyone` lock for the first qualification batch;
- email/app delivery verification;
- future-scheduling path based on Substack's documented UI;
- manual fallback if date/time widgets cannot be proven safe to automate;
- explicit `SCHEDULE` confirmation before every final Schedule click;
- scheduled-title verification;
- visible human confirmation of date/time/audience during qualification;
- real 26-post detox manifest.

The real manifest is:

`relay/examples/detox-season.yml`

It references the five source packets under `docs/` and freezes the release dates from August 25 through November 20, 2026.

The clock time is intentionally not invented. The operator supplies `--default-time HH:MM` at run time.

## Current Substack boundary

Substack's current support documentation says web article scheduling follows this sequence:

1. create article;
2. click `Continue`;
3. check `Schedule time to email and publish`;
4. choose future date/time;
5. schedule.

Substack also says posts cannot be scheduled more than three months ahead and that the schedule uses the local device time zone.

Current Substack Terms prohibit scraping/crawling, security bypasses, and processes running while a user is not logged in. Relay therefore:

- works only in a visible locally authenticated browser session;
- never asks for or stores a Substack password;
- never scrapes public or subscriber content;
- never accesses subscriber lists;
- never reverse-engineers private endpoints;
- never bypasses CAPTCHA or other human verification;
- never runs as an unattended background process while the user is logged out;
- stops if the UI becomes ambiguous.

Browser automation remains platform-sensitive. v0.1 therefore keeps the human on the final decision boundary: every actual Schedule click requires explicit confirmation.

If Substack later exposes a supported create/schedule write API, that adapter should replace Playwright.

## Security model

- Passwords never enter Relay configuration or GitHub.
- Session state stays inside `.relay-auth/` on the user's machine.
- `.relay-auth/` is git-ignored.
- Run receipts and screenshots stay inside `.relay-receipts/` and are git-ignored.
- No cloud account.
- No telemetry.
- No tracking.
- No content ownership claim.
- No AI requirement.

## CLI

```bash
cd relay
python -m venv .venv
source .venv/bin/activate
pip install -e .
playwright install chromium

clove-relay validate examples/detox-season.yml
clove-relay login examples/detox-season.yml
clove-relay dry-run examples/detox-season.yml --post 1 --default-time 09:00
clove-relay qualify examples/detox-season.yml --post 1 --default-time 09:00
clove-relay schedule examples/detox-season.yml --default-time 09:00
clove-relay verify examples/detox-season.yml
```

`09:00` is an example only. The operator chooses the real publishing time.

## Execution gates

### Gate 1 — local validation

No browser required. Relay confirms:

- source bundle exists;
- source title exists exactly once;
- title/subtitle/date match the source packet;
- body is non-empty;
- dates are future dates;
- schedule slots do not collide;
- audience is supported;
- unresolved placeholder markers are absent.

Pass string:

`VALIDATION_PASS`

### Gate 2 — login

A persistent visible Chromium window opens. The user signs in normally. Relay stores no password.

Pass string:

`LOGIN_SESSION_READY`

### Gate 3 — dry run

Exactly one selected post is filled and configured through the publishing settings. Relay stops before the final Schedule action.

Pass verdict:

`DRY_RUN_COMPLETE`

### Gate 4 — single-post qualification

Relay prepares one real post, displays the requested title/date/time/audience/email settings, saves a screenshot, and requires the user to type `SCHEDULE` before the final action.

It then opens the Scheduled posts area, verifies that the expected title is visible, and requires a visible human check of the date/time/audience.

Pass verdict:

`QUALIFICATION_PASS`

### Gate 5 — batch

Only after Gate 4 passes should the 26-post batch run.

Relay processes one post at a time. Every final click is human-confirmed in v0.1. Every post is verified before moving to the next. Any ambiguity aborts the run.

Target verdict:

`READY_FOR_DETOX`

## Fail-closed conditions

Relay stops when:

- session is logged out;
- Create/Article/Continue/Schedule controls are ambiguous;
- editor fields cannot be uniquely identified;
- title/subtitle read-back fails;
- audience cannot be proven to be `everyone`;
- email/app state cannot be proven;
- scheduling control cannot be identified;
- date/time cannot be safely automated and the human declines the manual fallback;
- a CAPTCHA or other human verification appears;
- final Schedule action is not explicitly authorized;
- expected title is absent from Scheduled;
- visible human verification is withheld.

No blind continuation.

## Receipt

Each scheduled post records:

- post index;
- title;
- requested future time;
- SHA-256 hash of the local body;
- result;
- verification method;
- optional screenshot path.

No authentication secret is written to the receipt.

## Public/free product rules

- free and open source;
- no paid tier;
- no donation nag inside the tool;
- no cloud dependency for core use;
- no telemetry;
- no AI requirement;
- content remains the user's;
- platform adapters remain isolated;
- human publication judgment remains outside the machine.

## Public story

Working title:

> **I Wanted to Leave the Internet, So I Built a Robot to Keep Posting for Me**

Subtitle:

> The point of automation is not to keep me online. It is to make going offline easier.

Core argument:

> **Let the machine do the repetitive digital labour so the human can leave the machine.**

Do not publish this as a success story until the real qualification and batch have passed.

## Definition of WORKING

Clove Relay v0.1 earns `WORKING` only when the real account proves all of the following:

1. validation passes for the 26-post manifest;
2. manual login works;
3. dry run reaches the final scheduling boundary without publishing;
4. one real future post is scheduled;
5. its scheduled title/date/time/audience are verified;
6. the remaining batch schedules sequentially;
7. all 26 expected posts are present in Scheduled;
8. no unintended immediate publish occurs;
9. no paid-only audience is selected;
10. complete local receipts are produced.

Until then:

`CLOVE RELAY v0.1 — IMPLEMENTED / NOT YET QUALIFIED`
