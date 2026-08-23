# Clove Relay v0.1

**Write now. Go offline. Let the boring machinery publish.**

Clove Relay is a local-first publishing assistant for work that a human has already written and approved.

It does not generate posts. It does not decide what should be published. It automates the mechanical layer between a finished local file and a platform's built-in scheduler.

## Current status

`IMPLEMENTED CORE / SUBSTACK ADAPTER REQUIRES REAL-ACCOUNT QUALIFICATION`

The core manifest parser, bundle extractor, validator, receipts, CLI, detox manifest, and Playwright adapter are implemented.

The Substack adapter is deliberately fail-closed because the publisher UI can change. It must earn `WORKING` on a real account by completing the qualification sequence in `docs/CLOVE-RELAY-V0.1.md`.

## Important platform boundary

Substack's current help documentation says scheduled articles are created on the web by clicking **Continue**, checking **Schedule time to email and publish**, and choosing a future date/time. It also says posts cannot be scheduled more than three months ahead.

Substack's Terms prohibit scraping/crawling and processes that run while a user is not logged in. Relay does neither: it works only in a visible, locally authenticated browser session, operates on the user's own drafts, never scrapes Substack content, and stops on CAPTCHA or unexpected access controls.

Because browser automation can still be platform-sensitive, v0.1 defaults to **human-confirmed scheduling**. Relay fills and configures each post, displays the requested action, and waits for the user before the final Schedule click. The user can schedule the whole future batch in one sitting and then go offline.

If Substack provides a supported write/scheduling API in the future, that adapter should replace browser automation.

## Security

- Passwords are never requested or stored.
- Browser session data stays in `.relay-auth/` on the local machine.
- `.relay-auth/` and receipts are git-ignored.
- Login is manual in a visible browser window.
- No telemetry or analytics.
- No cloud account.
- No subscriber data access.
- No scraping.
- No CAPTCHA bypass.
- No automatic fallback to an immediate publish.

## Install

Requires Python 3.11+.

### Debian / Ubuntu

Recent Debian/Ubuntu releases use PEP 668 and intentionally block `pip` from modifying the system Python environment. Do **not** use `--break-system-packages`. Create a project virtual environment instead.

From the Clove repository root:

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

Once `.venv` is active, the `python`, `pytest`, `playwright`, and `clove-relay` commands resolve inside the project environment.

Do not activate an unrelated virtual environment from another project.

### Other systems with Python 3.11+

```bash
cd relay
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
python -m playwright install chromium
```

## First local check

```bash
python -m pytest -q
clove-relay validate examples/detox-season.yml
```

Do not proceed to Substack login until both commands pass.

## Ryan's detox batch

The real 26-post season manifest is:

```text
relay/examples/detox-season.yml
```

It references the five paste-ready source bundles already stored under `docs/`.

The release dates are frozen. The publish **clock time is intentionally not invented**. Supply one when running the scheduler, for example:

```bash
clove-relay validate examples/detox-season.yml
clove-relay login examples/detox-season.yml
clove-relay dry-run examples/detox-season.yml --post 1 --default-time 09:00
clove-relay qualify examples/detox-season.yml --post 1 --default-time 09:00
clove-relay schedule examples/detox-season.yml --default-time 09:00
```

Use the time you actually want. Substack schedules using the time zone of the local device.

## Commands

### Validate

```bash
clove-relay validate examples/detox-season.yml
```

Checks locally:

- bundle exists;
- requested title exists exactly once in that bundle;
- title/subtitle/date match the source packet;
- post body is non-empty;
- schedule dates are future dates;
- no duplicate schedule dates/times;
- audience is supported;
- no obvious unresolved placeholders remain.

### Login

```bash
clove-relay login examples/detox-season.yml
```

Opens a persistent Chromium profile at `.relay-auth/substack`. Sign in normally. Relay never sees or stores the password itself; Chromium stores the authenticated profile locally.

### Dry run

```bash
clove-relay dry-run examples/detox-season.yml --post 1 --default-time 09:00
```

Creates/fills one draft and reaches the publishing settings screen but never clicks Schedule.

### Qualify

```bash
clove-relay qualify examples/detox-season.yml --post 1 --default-time 09:00
```

Configures one post for the requested future time. Relay requires an explicit terminal confirmation before the final Schedule click. It then checks the Scheduled posts area and emits a receipt.

Only after qualification succeeds should the batch command be used.

### Batch schedule

```bash
clove-relay schedule examples/detox-season.yml --default-time 09:00
```

Processes posts sequentially. Every post requires a final human confirmation in v0.1. After every schedule action Relay verifies before continuing. Any ambiguity stops the run.

### Verify

```bash
clove-relay verify examples/detox-season.yml --default-time 09:00
```

Checks that the expected titles appear in the Scheduled area. It does not open analytics.

## Selector failures

Substack can change its UI. Relay uses semantic text/label selectors first, based on the current documented flow, and deliberately refuses to guess when a control is ambiguous.

On failure Relay saves a screenshot under `.relay-receipts/` and prints the exact step that failed. The adapter can then be repaired against the changed UI rather than silently clicking the wrong control.

## Philosophy

> Offload what consumes cognition without improving understanding. Keep what builds understanding, judgment and skill.

The human writes, checks, approves and decides.

The machine handles the repetitive calendar work.
