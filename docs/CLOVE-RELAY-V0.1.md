# Clove Relay v0.1

Status: `PREPARATION PATH QUALIFIED / HUMAN-FINAL-SCHEDULE MODE IMPLEMENTED / FULL AUTOMATED SCHEDULER NOT QUALIFIED`

Tagline:

> **Write now. Go offline. Let the boring machinery publish.**

## Product decision

Relay v0.1 is now frozen around a simpler operating model:

> **The machine prepares. The human schedules.**

The purpose is not to maximize autonomous browser control. The purpose is to remove repetitive digital labour without transferring publication judgment to the machine.

The governing rule remains:

> **Offload what consumes cognition without improving understanding. Keep what builds understanding, judgment and skill.**

## Real-account qualification evidence — 2026-08-23

The real Linux/Brave/Substack dry-run reached the final scheduling boundary and produced local receipts.

Observed pass sequence:

```text
EDITOR_READBACK_PASS
PUBLISH_SETTINGS_REACHED
PREPARED FOR SCHEDULING
DRY_RUN_STOP: Relay will not click Schedule.
```

That run proved:

- existing real Brave profile authentication;
- Substack publisher dashboard access;
- article creation;
- title insertion;
- subtitle insertion;
- article-body insertion;
- visible content verification after Substack rerendered the editor;
- publish-settings navigation;
- safe human fallback when current controls could not be proven automatable;
- deliberate stop before final Schedule;
- local receipt generation.

## Stable v0.1 boundary

Relay may:

- validate already-approved source packets;
- open the user's own authenticated publishing dashboard;
- create an article;
- fill title/subtitle/body;
- verify the content it inserted;
- reach publishing settings;
- automate a control only when it can identify the control safely;
- hand ambiguous controls to the human;
- capture receipts/screenshots;
- verify scheduled titles after the human acts.

Relay stable mode does **not** perform the final Schedule click.

The human retains:

- final visual inspection;
- audience/delivery/date correction when needed;
- final Schedule action;
- final visible verification.

## Stable commands

### Dry run

```bash
clove-relay dry-run examples/detox-season.yml \
  --post 1 \
  --default-time 09:00 \
  --browser brave
```

Stops before final Schedule.

### Prepare one

```bash
clove-relay prepare examples/detox-season.yml \
  --post 1 \
  --default-time 09:00 \
  --browser brave
```

Relay prepares one post, then displays a `HUMAN SCHEDULE CHECKPOINT`. The human clicks Substack's final Schedule button. Relay then verifies the scheduled title and asks for visible confirmation before writing the receipt.

### Prepare batch

```bash
clove-relay prepare-batch examples/detox-season.yml \
  --default-time 09:00 \
  --browser brave
```

Relay processes one post at a time. Every final Schedule click belongs to the human. Every post must verify before the next one is touched.

## Experimental commands

The existing commands below remain in the codebase for bounded experiments:

```bash
clove-relay qualify ...
clove-relay schedule ...
```

They let Relay perform the final Schedule click after explicit terminal authorization. They are not part of the stable detox plan and must not be described as qualified production behavior until separately proven.

## Authentication architecture

Real-account testing established an important Linux/Brave constraint.

A copied browser profile did not reliably preserve Substack authentication. Direct use of the existing Brave profile worked after two fixes:

1. Relay now detects actual Linux Brave processes through `/proc` rather than relying on a shell regex that missed `/opt/brave.com/brave/brave`.
2. Direct mode suppresses Playwright's `--password-store=basic` and `--use-mock-keychain` defaults so Brave can use the normal Linux keyring-backed session.

Brave must be fully closed before Relay opens the real profile.

Relay never reads, prints, exports or stores cookie values itself.

## Editor architecture

Substack's editor can rerender its ProseMirror body after text is inserted. A locator that was valid during the write can therefore become stale even though the article is correctly visible.

Brave direct mode handles that observed behavior by verifying:

- exact title;
- exact subtitle;
- first non-empty body line;
- last non-empty body line.

It does not weaken the fail-closed rule merely because a selector changed.

## Current Substack controls

During the successful dry run, Relay reached publishing controls but did not safely identify every current audience/delivery/date widget. Stable mode therefore uses human checkpoints for those controls instead of guessing.

This is a product boundary, not a failure condition.

The fully automated control path may continue on an experimental branch only if it does not destabilize preparation-assistant mode.

## Schedule fixture warning

`relay/examples/detox-season.yml` currently contains the original August 25-November 20, 2026 calendar.

That calendar is now a **test fixture**, because the detox start was deferred while the system is hardened.

Do not use it as final launch authority.

Before the real batch:

1. finish the evidence/editorial audit;
2. choose the actual detox start date;
3. rebase dates in the manifest and source packets together;
4. freeze the clock time;
5. validate 26/26;
6. schedule using preparation-assistant mode;
7. verify all scheduled entries;
8. preserve receipts.

## Security model

- Passwords never enter Relay configuration or GitHub.
- Session state remains inside the user's local browser/profile.
- `.relay-auth/` is git-ignored.
- `.relay-receipts/` is git-ignored.
- No cloud account.
- No telemetry.
- No tracking.
- No subscriber-data access.
- No scraping.
- No reverse-engineered private publishing endpoint.
- No CAPTCHA bypass.
- No immediate-publish fallback.

## Receipt model

Each verified post records:

- post index;
- title;
- requested future time;
- SHA-256 hash of the source body;
- result;
- verification method;
- optional screenshot path.

Stable preparation mode records that the final Schedule click was human-owned.
Stable receipts use `HUMAN_SCHEDULE_VERIFIED` with `final_action=human_schedule_click`; experimental Relay-final-click receipts use `EXPERIMENTAL_RELAY_SCHEDULE_VERIFIED` with `final_action=relay_schedule_click`. Neither result claims that an article was published; they describe the scheduled-area verification that actually occurred.

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

Core line:

> **Keep the thinking. Keep the judgment. Keep the writing. Keep the decision. Automate the fucking dropdown menu.**

The accurate story is now stronger than the autonomous version: Relay successfully prepares the work but deliberately returns the consequential final action to the human.

## Definition of stable WORKING

Preparation-assistant v0.1 earns `WORKING` when all of the following are true:

1. local tests pass;
2. the final 26-post manifest validates;
3. authenticated Brave mode works;
4. dry run reaches the final scheduling boundary;
5. `prepare` successfully hands one real final Schedule click to the human;
6. that scheduled entry is verified;
7. `prepare-batch` completes the final season sequentially;
8. all 26 expected scheduled entries are verified;
9. no unintended immediate publish occurs;
10. complete local receipts are produced.

Current status is therefore:

`PREPARATION PATH QUALIFIED / FINAL HUMAN-SCHEDULE WRAPPER PENDING LOCAL SMOKE TEST / FINAL SEASON NOT YET FROZEN`
