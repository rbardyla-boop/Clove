# CloveLearn v2 — F1.2-S Solo Validation & Hardening Verification

Status: **`SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`**  
Date: 2026-08-12  
Issue: #152  
Reconciliation PR: #153

## 1. Claim under test

Whether Mission 001 can survive the strongest technically credible solo/automated validation available to the project across state transitions, private persistence, privacy, recovery, adversarial interaction, accessibility, browser compatibility, dependency hygiene, packaging, caching and the exact Cloudflare Direct Upload boundary.

This unit does **not** test whether people understand, want, enjoy, repeat, benefit from, or are behaviorally changed by Mission 001.

## 2. Frozen candidate and reconciliation

Exact hardened source candidate:

`7fdea07751979396699e6ca96a0effd9d5d8451d`

Canonical `main` reconciliation merge:

`f5035039c9b997617958af49b8cf8fa624cba73f`

The merge does not itself deploy to Cloudflare because CloveLearn remains a Cloudflare Pages Direct Upload project.

Production before this hardened candidate is uploaded remains deployment:

`beb4bb84-c452-47db-a1d6-941c9a570fae`

## 3. Exact green verification evidence

F1 Mission Verify:

- workflow run: `31610209094`
- result: **PASS**

Production Upload build:

- workflow run: `31610209161`
- result: **PASS**

GitHub Actions artifact:

- artifact ID: `9146980402`
- artifact name: `clovelearn-production-7fdea07751979396699e6ca96a0effd9d5d8451d`
- outer artifact digest: `sha256:dcd29ba835bd93c3898c4d4f426f7402a243ecbf84c39684fa32fabd86a9f6b2`

Cloudflare-ready inner ZIP SHA-256:

`3002364af18aa0637d90a7138f822a9608b13a770d05e71476044a05d6f69bec`

## 4. Exact production package evidence

Hardened preflight:

- status: PASS
- public files included: 302
- repository files excluded: 787
- hardening-specific exclusions: 98
- required Mission files present: `mission-001.html`, `mission-001-app.js`, `mission-private-store.js`
- preflight errors: 0

The build requires byte-for-byte equality between the three tested Mission runtime files and the copies placed in the Cloudflare upload tree.

Whole-production browser audit of the exact upload tree:

- pages: 107
- desktop/mobile runs: 214
- controls inventoried/exercised: 1,155
- failed runs: 0
- final failures: 0

The public release tree is rechecked after temporary audit scaffolding is removed, SHA-256 inventory is generated and verified, release metadata is stripped from the public tree, and the final deployment ZIP is built with site files at archive root.

## 5. Formal Mission state model

The hardening suite now contains a formal state oracle for the Mission lifecycle:

`empty → planning → committed → left → debrief:<outcome> → complete`

Supported outcome branches:

- `done`
- `partly`
- `failed`
- `not_started`

Supported same-stage operations are explicitly modeled where required, including re-selection/editing, returned-tracking, and starting a new mission after completion.

Known-invalid transitions are negative controls and must be rejected rather than silently coerced into a nearby state.

The runtime controller now validates both:

1. the structure of every persisted state; and
2. transition order from the current valid state to the requested next state.

## 6. Defects deliberately found and repaired

F1.2-S did not begin green. The hardening harness was required to expose real defects before the candidate could pass.

### 6.1 Invalid persisted-state acceptance

Adversarial persistence replay found that unknown or malformed saved states could reach legitimate UI stages. Examples included an unknown status, invalid class, committed state missing required Mission text, unknown debrief outcome, and malformed complete debrief.

Repair:

- persisted-state schema validation;
- explicit class/status/outcome/value bounds;
- invalid decrypted state is rejected and reset rather than interpreted;
- a visible reset notice explains that saved state could not be trusted.

### 6.2 Private-store write failure exposed unusable UI

A simulated quota/localStorage write failure could leave the commit form visible even though the selected class had not been safely persisted.

Repair:

- fail closed on private-store write failure;
- do not expose a commit path that cannot persist;
- retain a dedicated storage-failure notice.

### 6.3 Transition order was not enforced by runtime

The formal oracle was intentionally made stricter than the controller and exposed that structurally valid states could still be requested out of order.

Repair:

- runtime `validStateTransition(previous, next)` guard;
- invalid stage changes are rejected before private persistence.

### 6.4 Reduced-motion mismatch

Programmatic Mission scrolling still used smooth animation even when the browser declared `prefers-reduced-motion: reduce`.

Repair:

- reduced-motion-aware scroll behavior;
- automated browser regression test.

### 6.5 Keyboard gate had a test timing race

The stronger asynchronous persistence behavior invalidated an older keyboard test's one-keystroke timing assumption. Inspection showed the runtime remained keyboard-operable; the test was repaired to wait for the asynchronously revealed stage rather than weakening fail-closed persistence.

This was a test defect, not a runtime defect.

### 6.6 Guarded state rejection masqueraded as storage failure

The whole-production crawler intentionally exercised hidden/out-of-order controls. The runtime correctly rejected invalid transitions, but catch handlers incorrectly reported those rejections as `Mission private storage failed` and displayed storage-failure language.

Repair:

- separate state-guard rejection from storage/encryption failure;
- invalid stage attempts preserve the last valid Mission state;
- they no longer emit a misleading private-storage error;
- real IndexedDB/encryption/storage failures still fail loudly.

### 6.7 Same-turn encrypted-write race

A stronger negative control synchronously activated `LOCK THE MISSION` twice in the same JavaScript turn. It exposed a real race: two async saves could both validate before the first encrypted write completed and emit two `mission_committed` events.

Repair:

- single-flight private-state write guard;
- a second in-flight write is rejected;
- the first accepted write remains authoritative;
- the lock always clears in `finally`;
- the write-in-progress condition is classified as a guarded state rejection, not a storage failure.

This defect was not exposed by an ordinary serialized Playwright double-click, which is why the stronger same-turn mutation was retained.

### 6.8 Product-auditor source attribution

An earlier whole-product crawl observed generic external 404 console messages on legacy pages but did not preserve the console source URL, preventing sound classification.

Repair:

- product auditor now records console error source locations;
- no generic waiver was added;
- the exact final 302-file package was rerun;
- the transient 404s did not reproduce;
- final exact package result: 0 failed runs.

## 7. Privacy and recovery gates

The Mission private store uses browser Web Crypto AES-GCM with a 256-bit non-extractable key stored through IndexedDB and encrypted Mission/debrief envelopes stored locally.

Automated browser gates verify:

- encrypted round-trip;
- Mission/debrief plaintext absent from raw localStorage;
- repeated identical plaintext writes produce different ciphertext;
- legacy plaintext migrates only after successful encryption;
- corrupted ciphertext fails closed;
- deleting the IndexedDB key makes existing ciphertext unreadable without deleting that ciphertext;
- simulated local storage/quota failure does not silently fall back to plaintext;
- private Mission/debrief marker does not appear in aggregate Insights payloads;
- hidden controls cannot bypass the stage sequence;
- oversized programmatic input is rejected before persistence;
- hostile-looking markup and Unicode content are displayed as text rather than executed.

### Allowed privacy claim

> Mission and debrief text is encrypted locally in this browser and is not included in Clove's aggregate Insights events.

### Explicit limits

This does not protect against:

- malicious JavaScript with the same origin;
- a compromised or unlocked device/browser profile;
- screenshots, clipboard capture, browser extensions or operating-system compromise;
- an attacker who obtains both browser key material and ciphertext.

Do not describe the mechanism as anonymous, zero-access, unhackable, military-grade or end-to-end encrypted.

## 8. Accessibility and compatibility

Automated gates include:

- keyboard-only choose/commit/leave flow;
- 375px mobile viewport without horizontal document overflow;
- reduced-motion behavior;
- current Chromium flow coverage;
- Firefox encrypted commit/leave/reload/return replay.

The runtime budget also requires Mission 001 to remain a small first-party page:

- combined initial HTML/controller/private-store budget <=100 KiB uncompressed;
- exactly two first-party runtime scripts;
- no CDN JavaScript dependency;
- no dynamic external code import;
- Mission network writes restricted to the first-party coarse signal endpoint.

## 9. Dependency and release gates

The exact Insights dependency graph must install cleanly and pass:

`npm audit --audit-level=low`

The Insights type/privacy contract and Wrangler dry-run must also pass.

Cloudflare release gates include:

- service-worker cache boundary contract;
- cache-header contract;
- release preflight;
- strict public-surface exclusions;
- tested-runtime byte identity;
- whole-production browser crawl;
- post-audit package re-verification;
- SHA inventory verification;
- removal of release metadata from the public tree;
- exact 302-file deployment package.

## 10. Disclosed external dependency limit

The final whole-product crawl contains one disclosed environment/dependency note outside Mission 001:

`intelligence-ops.html` could not download its optional Hugging Face embedding model during CI. Its existing OpBrain fallback engaged without blocking Layer 1.

No Mission 001 gate depends on this external model.

## 11. Terminal verdict

**`SOLO_HARDENED / HUMAN_EVIDENCE_PENDING`**

Within the current automated/adversarial scope, no known blocking Mission 001 technical defect remains.

This verdict means the implementation, private persistence, state integrity, recovery behavior, cross-browser core flow and exact Direct Upload release path have survived the defined solo technical gauntlet.

It does **not** mean that independent people will understand Mission 001, choose to use it, complete a real-world action, return, reuse it, find it meaningful, or benefit psychologically.

The project must not convert automated evidence into human-effectiveness claims.

## 12. Remaining external gate

The solo-hardened artifact is not yet the live Cloudflare deployment.

Owner action required:

1. upload the exact verified Cloudflare-ready ZIP without modification;
2. record the resulting production deployment ID;
3. perform one bounded live smoke of Mission 001 after deployment.

Independent human evidence may be collected later if participants become naturally available. It is no longer a blocker for technical project progress and may not be fabricated or inferred from automated tests.

F2 crews, JoyMesh social substrate, mentor matching, ranks and minors remain locked by this verdict alone.