# Clove Relay v0.1

**Write now. Go offline. Let the boring machinery publish.**

Clove Relay is a local-first publishing assistant for work a human has already written and approved.

It does not generate posts. It does not decide what deserves publication. It handles the mechanical layer between a finished local file and a platform scheduler while preserving a human-owned final publication decision.

## Current status

`PREPARATION PATH QUALIFIED ON REAL SUBSTACK ACCOUNT / HUMAN-FINAL-SCHEDULE MODE IMPLEMENTED / FULL AUTOMATED SCHEDULER NOT QUALIFIED`

Real-account testing on 2026-08-23 proved the following path in Brave on Linux:

- existing authenticated Brave profile can be opened safely after Brave is closed;
- Substack publisher dashboard is reachable;
- a new article can be created;
- title, subtitle and body can be inserted;
- Relay can verify the inserted content after Substack rerenders the editor;
- Relay can reach current publishing settings;
- ambiguous audience/delivery/date controls can fall back to visible human checkpoints;
- a dry run can reach the final scheduling boundary without publishing.

The final Schedule click remains human-owned in the stable v0.1 operating mode.

The older `qualify` and `schedule` commands, where Relay itself performs the final Schedule click after terminal authorization, remain experimental and are not required for the detox workflow.

## Stable operating model

Relay v0.1 is a **preparation assistant**.

Relay handles:

- source validation;
- opening the authenticated publishing dashboard;
- article creation;
- title/subtitle/body insertion;
- content read-back checks;
- navigation to publishing settings;
- safe automation of controls it can identify;
- human checkpoints for controls it cannot prove safe;
- receipts and verification.

The human handles:

- final visual inspection;
- any ambiguous audience/delivery/date control;
- the final Substack **Schedule** click;
- final visible confirmation that the scheduled entry is correct.

That is intentional. The machine handles the bullshit. The human keeps the decision.

## Important schedule warning

`examples/detox-season.yml` contains the **original** August 25-November 20, 2026 schedule used to qualify the system.

The detox start has since been deferred while the publishing/research system is hardened. Therefore those dates are now a **frozen test fixture, not current launch authority**.

Do not schedule the full season from that manifest until the final detox start date is chosen and the manifest plus source packets are rebased and re-frozen together.

## Security and platform boundary

- Passwords are never requested or stored by Relay.
- Real-account Brave mode uses the user's existing local profile; Brave must be fully closed before Relay opens it.
- Browser session data and receipts stay local and are git-ignored.
- No telemetry or analytics.
- No cloud account.
- No subscriber-data access.
- No scraping.
- No reverse-engineered private publishing API.
- No CAPTCHA bypass.
- No automatic fallback to immediate publication.
- Unexpected UI state stops or hands the decision to the human.

## Install — Debian / Ubuntu

Requires Python 3.11+.

```bash
sudo apt update
sudo apt install -y python3-full python3-venv

cd relay
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
python -m playwright install --with-deps chromium
```

Do not use `--break-system-packages`.

## Core check

```bash
python -m pytest -q
clove-relay validate examples/detox-season.yml
```

The current manifest intentionally omits a clock time. Supply `--default-time HH:MM` only when running a browser preparation command.

## Commands

### Validate

```bash
clove-relay validate examples/detox-season.yml
```

Checks bundle existence, unique article extraction, title/subtitle/date agreement, non-empty body, future scheduling constraints, duplicate slots, supported audience and unresolved placeholders.

### Brave session check

Close Brave completely first, then:

```bash
clove-relay brave-check examples/detox-season.yml
```

This proves the real local Brave profile can reach the publisher dashboard without editing a post.

### Dry run — qualified preparation path

```bash
clove-relay dry-run examples/detox-season.yml \
  --post 1 \
  --default-time 09:00 \
  --browser brave
```

Fills one article, reaches publishing settings and stops before any final Schedule action.

### Prepare one — stable human-final mode

```bash
clove-relay prepare examples/detox-season.yml \
  --post 1 \
  --default-time 09:00 \
  --browser brave
```

Relay prepares the post and pauses at a `HUMAN SCHEDULE CHECKPOINT`. Inspect the visible page and click Substack's final **Schedule** button yourself. Relay then verifies the scheduled title and asks for a final visible confirmation before writing the receipt.

### Prepare batch — planned detox operating mode

```bash
clove-relay prepare-batch examples/detox-season.yml \
  --default-time 09:00 \
  --browser brave
```

Relay works one post at a time. The human performs every final Schedule click. Each post must verify before Relay touches the next one. Any failure stops the batch.

Do not use the frozen August-November fixture for the final batch until the season dates have been re-frozen.

### Experimental automated final-click modes

```bash
clove-relay qualify examples/detox-season.yml --post 1 --default-time 09:00 --browser brave
clove-relay schedule examples/detox-season.yml --default-time 09:00 --browser brave
```

These modes preserve terminal confirmation but let Relay perform the final UI click. They are experimental and are not part of the stable detox plan.

### Verify

```bash
clove-relay verify examples/detox-season.yml --browser brave
```

Checks that expected titles appear in the Scheduled area. Title verification does not replace visible date/time/audience confirmation.

### Calendar rebase — explicit tooling only

The current manifest dates are a frozen test fixture. Do not use a new date until the evidence, editorial and human-readiness gates are green.

Check that the manifest and all five source packets agree without writing:

```bash
clove-relay calendar-rebase examples/detox-season.yml --check
```

Preview a proposed Tuesday/Friday calendar without writing:

```bash
clove-relay calendar-rebase examples/detox-season.yml \
  --dry-run \
  --first-tuesday YYYY-MM-DD \
  --default-time HH:MM
```

An explicit `--apply` is required to stage the manifest and source-packet updates. Per-post clock overrides use repeated `--post-time INDEX=HH:MM`. The helper refuses a non-Tuesday start, title/date mismatch, duplicate slot or partial source-packet set.

### Mechanical season audit

Generate a source/URL/hash inventory without pretending that a URL is evidence review:

```bash
clove-relay audit-season examples/detox-season.yml \
  --report /path/to/detox-season-mechanical-audit.md \
  --check
```

The report remains `P0_MECHANICAL_INVENTORY_ONLY`. It flags structural mismatches, duplicate URLs, homepage-only citations, missing URLs and broken local references. Claim classification, source quality, counterevidence and copy repair remain human/research work.

## Real-account evidence already obtained

The successful dry run produced these terminal gates:

```text
EDITOR_READBACK_PASS
PUBLISH_SETTINGS_REACHED
PREPARED FOR SCHEDULING
DRY_RUN_STOP: Relay will not click Schedule.
```

The run also wrote local text/JSON receipts under `.relay-receipts/`.

## Selector failures

Substack can change its UI. Relay deliberately refuses to guess. On failure it saves a screenshot under `.relay-receipts/` and identifies the exact failed gate. Repair the adapter against the visible interface rather than weakening the fail-closed rule.

## Philosophy

> Offload what consumes cognition without improving understanding. Keep what builds understanding, judgment and skill.

The human writes, checks, approves and decides.

The machine handles the repetitive digital labour.
