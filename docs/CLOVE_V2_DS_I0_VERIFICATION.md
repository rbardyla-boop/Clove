# CloveLearn v2 — DS-I0 Verification Record

Terminal verdict: **SOLO_HARDENED / HUMAN_EVIDENCE_PENDING**

Date: 2026-08-12

## Exact candidate

- Product/test/release-policy freeze SHA: `f98d9ea7c29a6b40f09b4b8b126af8c1d4845853`
- Verification workflow run: `31616303764`
- Reconciliation PR: `#156`
- Merge commit: `a99f07b3998d1b677911c1779c627a4a124769b0`

The verification document itself was added after the runtime freeze and does not alter the tested DS-I0 HTML/JS or release guards.

## Claim under test

Whether Clove can guide one adult through a five-part digital-service map and one safe recovery-path check using only coarse local structured choices, without collecting provider/account details, making network calls, requiring destructive recovery tests, or becoming trapped by malformed/stale local state or browser-storage failure.

## Frozen user path

`BOUNDARY → DEVICE → APP/BROWSER → ACCOUNT → SERVICE/CLOUD → RECOVERY → SAFE CHECK → COMPLETE`

Safe exit:

`ANY NONTERMINAL STAGE → STOPPED_SAFE`

## Exact green gates

### Static privacy/copy contract
PASS.

Proved:
- first-party HTML + JS only;
- no `fetch`, `XMLHttpRequest`, `sendBeacon`, WebSocket or EventSource;
- no text input / textarea / contenteditable;
- no account/provider identity fields;
- destructive recovery instructions absent;
- coarse structured local-state field allowlist only;
- 44px minimum target rule and reduced-motion CSS present;
- noscript safe closeout present.

### Formal state-machine oracle
PASS — 6/6.

Proved:
- intended ordered path accepted;
- STOP reachable from every nonterminal stage;
- stage skips rejected;
- unknown schema/stage/enum values rejected;
- forged later stages require all prior coarse answers;
- identity-shaped enum mutations rejected.

### Deliberate bad-variant rejection
PASS — 5/5.

The harness deliberately rejected:
- a network POST mutation;
- a sensitive local field (`providerName`) mutation;
- a destructive “log out now to prove recovery” copy mutation;
- an illegal BOUNDARY → SAFE_CHECK stage mutation.

The clean candidate triggered none of those mutation detectors.

### Non-public release boundary
PASS — 2/2.

Proved:
- `digital-stewardship-00.html` is hard-excluded from production;
- `digital-stewardship-00.js` is hard-excluded from production;
- both appear in the excluded ledger;
- Mission 001 HTML/controller/private store remain included.

### Existing production preflight
PASS.

At the exact frozen head:
- public included count: **302**;
- excluded count: **806**;
- hardening exclusions: **100**;
- DS-I0 HTML/JS are explicit forbidden sentinels;
- Mission 001 required runtime remains complete;
- errors: **0**.

### Chromium browser/adversarial replay
PASS — **13/13**.

Covered:
- start STOP + simplicity budget;
- malformed JSON purge without disabling healthy storage;
- storage-read failure → explicit in-memory mode;
- cleared local state + reload → safe start;
- browser back/forward → coarse progress only;
- per-screen one-question/≤70-word/≤6-choice/44px target budget;
- full known-recovery path;
- reload resume + unknown-answer path;
- STOP terminal path with no failure/score pressure;
- malformed schema reset;
- forged later-stage reset;
- storage-write failure → in-memory continuation;
- 390px mobile, keyboard, reduced-motion and same-turn rapid activation.

### Firefox browser/adversarial replay
PASS — **13/13** over the same matrix.

### Dependency check
The exact root browser-test graph installed with `npm ci` and reported **0 known audit vulnerabilities** during the final verification run.

## Red → repair history

The solo harness found four material product/release defects before terminal freeze:

1. **Forged-state prerequisite bypass** — a syntactically valid later-stage saved state could omit earlier coarse answers. Repaired with stage-specific prerequisite validation.
2. **Missing start STOP** — the boundary screen hid the specified no-pressure exit. Repaired through the existing state machine, not a special escape path.
3. **Corrupted-JSON misclassification** — malformed saved JSON was treated like browser storage failure and could survive. Repaired by separating storage access failure from parse/state corruption and purging invalid records.
4. **Accidental production exposure** — because the production packager begins with tracked files and subtracts exclusions, the new root DS-I0 files would have entered a future Direct Upload package. Repaired with explicit `HARD_EXCLUDE_FILES` plus independent release-preflight forbidden sentinels.

Three overbroad test assertions were also repaired without weakening the product contract:
- safety prose was allowed to contain the word `password` while password-value fields remain forbidden;
- the approved coarse field `providerPersistenceBelief` stopped tripping a substring-only privacy check;
- reassuring copy `Nothing is scored` stopped tripping a naive ban on the word `score`.

## Privacy boundary

DS-I0 v0.1 stores only coarse local choices:
- schemaVersion;
- stage;
- deviceClass;
- accessMode;
- hasAccount;
- providerPersistenceBelief;
- recoveryClass;
- recoveryCheckResult.

It does not request or transmit:
- service/provider name;
- email address;
- phone number;
- username;
- password;
- authentication token;
- backup/recovery code;
- identity document;
- free-text account notes.

DS-I0 has **zero telemetry** and **zero third-party runtime dependency**.

## Deployment boundary

DS-I0 is deliberately present in the canonical repository but **not deployable by the normal production package**. Its two runtime files are blocked by both:
1. production hard exclusions; and
2. release-preflight forbidden sentinels.

Removing either protection does not authorize publication; a later public-release unit must deliberately remove both and replay the entire production-package gate.

No Cloudflare deployment was performed by DS-I0.

## What this verdict establishes

The implementation survived the defined static, state-machine, mutation, privacy, storage/recovery, browser-compatibility, accessibility-proxy and release-isolation gates available to the solo project.

## What it does not establish

This verdict does **not** establish:
- that an inexperienced or low-literacy adult understands the interface without help;
- assistive-technology usability beyond the automated/keyboard/browser checks performed;
- long-term knowledge retention;
- behaviour change;
- reduced fraud/privacy/security harm;
- user demand or adoption;
- independent external evaluator agreement.

Those remain **HUMAN EVIDENCE PENDING**.

## Next gate

DS-I0 is terminal. The next implementation unit may open DS-I1 — `SURVIVE THE FORCED GRID` — but only under its own frozen spec/test contract, still non-public, with DS-I0 production locks preserved.
