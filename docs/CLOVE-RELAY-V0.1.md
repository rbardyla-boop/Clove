# Clove Relay v0.1

Status: PRODUCT SPEC / NOT YET IMPLEMENTED

Tagline:

> **Write now. Go offline. Let the boring machinery publish.**

## Why this exists

Clove Relay comes directly from the three-month digital-detox problem:

Ryan wants to leave the feed without abandoning work already written and scheduled.

The useful automation target is not judgment, research, or authorship. It is the repetitive mechanical layer:

- open publishing platform;
- create draft;
- enter title;
- enter subtitle;
- paste body;
- choose audience;
- choose publish date/time;
- schedule;
- verify scheduled state;
- produce a receipt.

This is exactly the kind of cognitive offloading Clove should support:

> **Offload what consumes cognition without improving understanding. Keep what builds understanding, judgment and skill.**

## Product principle

Clove Relay is not a content-generation service.

It is a **local-first publishing relay** for work the user has already approved.

The tool should never decide what someone believes, what they publish, or when a draft becomes morally ready. It handles the keyboard-and-calendar work after those decisions are made.

## v0.1 target

Platform: Substack
Automation method: Playwright-driven browser automation using the user's own local authenticated browser session.

Important boundary:

Clove Relay must not bypass access controls, defeat anti-bot systems, scrape private data, reverse-engineer authentication, or store passwords. If platform terms or technical controls prohibit an action, Relay fails closed.

If Substack later exposes an official supported publishing/scheduling API, that adapter should replace browser automation.

## Security model

- Passwords never enter Relay configuration.
- Passwords never enter GitHub.
- Session cookies/browser state stay on the user's computer.
- Local auth directory is git-ignored.
- User signs in manually in a real browser window.
- No cloud account is required for Relay.
- No analytics, telemetry, tracking, or ad system.
- No third-party storage of post content.

## Input format

Relay reads a local manifest such as:

```yaml
publication: substack
posts:
  - file: posts/where-did-the-boys-go.txt
    title: "Where Did the Boys Go?"
    subtitle: "Before we pick a villain, can we find out when the gaps actually appeared?"
    publish_at: "2026-08-25T09:00:00-03:00"
    audience: everyone
    email: true
```

The content file remains plain text or Markdown. The manifest contains scheduling metadata.

## Execution modes

### 1. Validate

Checks locally without opening Substack:

- every file exists;
- title/subtitle present;
- dates are future dates;
- no duplicate schedule slots unless explicitly allowed;
- audience value valid;
- no unresolved placeholder tokens;
- no post exceeds configured platform constraints.

Output:

`VALIDATION_PASS` or fail with exact file and field.

### 2. Dry run

Launches the authenticated browser and navigates through draft creation but stops before the final Schedule/Publish action.

Purpose: verify selectors, formatting, audience controls and dates.

### 3. Single-post qualification

Schedules exactly one deliberately selected post.

Then independently reopens the platform's scheduled-post view and verifies:

- title;
- date/time;
- audience;
- scheduled status.

Only after this passes may a batch run be enabled.

### 4. Batch schedule

Schedules approved posts one at a time.

After every post it verifies scheduled state before continuing.

If verification fails, Relay stops immediately.

No blind continuation.

## Fail-closed rules

Relay stops if:

- user is logged out;
- page structure no longer matches known selectors;
- title/body cannot be verified;
- audience control is ambiguous;
- schedule time cannot be read back;
- Substack returns an error;
- platform requests a CAPTCHA or extra human verification;
- a post appears to be publishing immediately instead of scheduling;
- a duplicate scheduled title/date is detected;
- a paid-only audience is selected when manifest says `everyone`.

The tool never attempts to bypass human verification.

## Receipt

Every run produces a local JSON + human-readable report.

Example:

```text
CLOVE RELAY RUN
Planned: 26
Validated: 26
Scheduled: 26
Verified: 26
Failed: 0
Immediate publishes: 0
Paid-only posts: 0

VERDICT: READY FOR DETOX
```

Each post gets:

- local source hash;
- title;
- requested publish time;
- verified platform publish time;
- verification timestamp;
- result;
- optional screenshot path.

No authentication secrets are written to receipts.

## Detox mode

Optional mode specifically for people who want scheduled publishing without analytics checking.

After the batch is verified, Relay can generate a simple shutdown checklist:

- all posts scheduled;
- no future post requires manual data update;
- no post promises live replies;
- analytics links are not opened;
- local run receipt saved.

Relay does **not** monitor performance during the detox.

The machine carries the calendar, not the user's attention.

## Public/free product rules

- Free and open source.
- No paid tier.
- No donation nags inside the tool.
- No tracking.
- No cloud dependency for core use.
- No content ownership claim.
- No AI requirement.
- Users can write with any editor or no AI at all.
- Platform-specific adapters are isolated so the core scheduler survives interface changes.

## Suggested repository structure

```text
relay/
  README.md
  pyproject.toml
  relay/
    cli.py
    manifest.py
    validate.py
    receipts.py
    adapters/
      base.py
      substack_playwright.py
  examples/
    detox-season.yml
  tests/
  .gitignore
```

## CLI sketch

```bash
clove-relay validate detox-season.yml
clove-relay login substack
clove-relay dry-run detox-season.yml --post 1
clove-relay qualify detox-season.yml --post 1
clove-relay schedule detox-season.yml
clove-relay verify detox-season.yml
```

## Public story

Working Substack title:

> **I Wanted to Leave the Internet, So I Built a Robot to Keep Posting for Me**

Subtitle:

> The point of automation is not to keep me online. It is to make going offline easier.

Core argument:

Modern automation is often used to increase output, engagement and availability.

Clove Relay uses automation for the opposite purpose:

> **Let the machine do the repetitive digital labour so the human can leave the machine.**

The product itself becomes the evidence for the essay.

Do not publish the article as a success story until Relay actually schedules and verifies the real detox batch.

## Definition of v0.1 success

Clove Relay v0.1 earns `WORKING` only when all of the following happen on a real user account:

1. local validation passes;
2. manual login succeeds without storing credentials;
3. dry run reaches the final scheduling step without committing;
4. one real test post is scheduled;
5. Relay independently verifies that post in Substack's scheduled list;
6. the remaining approved batch schedules sequentially;
7. every scheduled post is read back and verified;
8. no unintended immediate publication occurs;
9. no paid-only post is created when `everyone` was requested;
10. a complete receipt is produced.

Until then:

`CLOVE RELAY v0.1 — PROPOSED / NOT YET QUALIFIED`
