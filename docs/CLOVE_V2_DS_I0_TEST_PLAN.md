# CloveLearn v2 — DS-I0 Test Plan

Status: **LOCKED BEFORE IMPLEMENTATION**

Target: `DS-00 KNOW THE MACHINE`

## A. Static privacy contract

Fail the candidate if any DS-I0 runtime file contains:
- free-text input/textarea/contenteditable;
- network calls (`fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`);
- third-party script/style/font URL;
- field names for email, phone, username, provider name, password, token, recovery code, identity document, exact URL;
- analytics attributes or imports.

Mutation control: insert one forbidden network call and prove the test fails.

## B. State-machine oracle

Allowed ordered stages:
`BOUNDARY → DEVICE → ACCESS_MODE → ACCOUNT → SERVICE_CLOUD → RECOVERY → SAFE_CHECK → COMPLETE`

Alternative safe exits:
- any post-entry stage → `STOPPED_SAFE`
- `RECOVERY` unknown → `SAFE_CHECK` limited to finding official recovery/help location
- `SAFE_CHECK` unresolved → `COMPLETE` with `MAPPED_RECOVERY_UNKNOWN`

Reject:
- skipping from BOUNDARY to SAFE_CHECK;
- COMPLETE without required prior coarse answers unless STOPPED_SAFE;
- unknown stage/schema;
- impossible enum values.

Mutation control: force one illegal transition and prove the oracle rejects it.

## C. Browser path matrix

Replay in Chromium and Firefox:
1. known account + known recovery → verified completion;
2. known account + recovery location only;
3. recovery still unknown;
4. no account;
5. `I DON'T KNOW` at each knowledge question;
6. STOP from each post-entry stage;
7. reload at every stage;
8. back/forward interaction;
9. rapid double activation;
10. storage cleared mid-flow.

## D. Storage failure injection

If localStorage is used:
- SecurityError on read;
- SecurityError on write;
- malformed JSON;
- stale schema;
- oversized/invalid enum values.

If IndexedDB is used, equivalent open/read/write failure injection is required.

Expected behavior: safe reset or explicit local-storage-unavailable closeout. Never silently pretend progress persisted.

## E. Destructive-instruction mutation controls

Fail copy if it instructs the user to:
- log out to test recovery;
- reset password as a routine test;
- remove multi-factor authentication (MFA);
- consume a backup/recovery code merely to prove it works;
- delete account/device data;
- use banking/government/critical-health account for first run.

Mutation control: inject “Log out now to prove your recovery works” and prove the copy gate fails.

## F. Accessibility

Automated/browser assertions:
- one `h1`;
- exactly one primary question visible at a time;
- every interactive choice has accessible name;
- all choices keyboard reachable;
- visible focus indicator;
- no horizontal overflow at 390×844;
- no forced animation when `prefers-reduced-motion: reduce`;
- no countdown/timer;
- STOP button/link reachable after entry;
- minimum interactive target height 44 CSS px where measurable.

## G. Content simplicity budget

For each visible stage:
- one primary question;
- explanation before choices ≤ 70 words;
- no more than 6 choices;
- no acronym without expansion on first visible use;
- no sentence that makes a provider-specific claim without user/provider evidence.

This budget is a proxy, not proof of low-literacy usability.

## H. Release boundary

Before any later release candidate:
- exact DS-I0 HTML/JS byte identity from tested source to curated Cloudflare package;
- DS-I0 included deliberately in package allowlist;
- no docs/tests/state fixtures shipped publicly;
- whole-package crawl remains green;
- service worker/cache rules cannot pin stale unversioned DS-I0 runtime.

## Terminal rule

Any red gate forces repair and replay. No waiver may convert a real DS-I0 privacy, destructive-action, state-integrity, or accessibility failure into PASS.
