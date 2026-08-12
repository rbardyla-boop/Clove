# CLOVE-V2 F1.1 — Pilot Hardening Verification

Status: `PASS_WITH_DISCLOSED_LIMITS`
Date: 2026-08-12
Issue: #147
Parent gate: F1 Mission 001

## 1. Claim under test

Whether the F1 Mission 001 candidate can be hardened into a technically credible adults-only pilot candidate without expanding product scope, weakening the privacy contract, touching production, or introducing unresolved known dependency vulnerabilities.

The narrow interaction remains:

`ARRIVE → CHOOSE → COMMIT → LEAVE CLOVE → ATTEMPT REAL ACTION → RETURN → OUTCOME → DEBRIEF → NEXT/EXIT`

No claim is made here that Mission 001 improves mental health, creates brotherhood, produces durable behavior change, or works at population scale.

## 2. Frozen implementation candidate

Runtime candidate commit:

`80951b40e269168d8232bc9ca2490cd2ed38d3e2`

Final read-only verification run against that implementation:

`31595138519`

Result: **SUCCESS**

This SHA is the frozen F1.1 runtime candidate. Administrative documentation after this SHA must not be treated as authorization to alter the runtime candidate. Any later runtime change invalidates this freeze and requires a new full verification replay.

## 3. Technical gates replayed

The final F1 verifier requires all of the following to pass:

1. Mission static acceptance contract.
2. HTML references the encrypted persistence scripts.
3. Legacy plaintext Mission controller is absent.
4. Mission JavaScript syntax checks.
5. Exact root dependency install.
6. Real-Chrome Mission browser acceptance replay.
7. Real-Chrome encrypted Mission-store replay.
8. Exact Insights dependency install.
9. `npm audit --audit-level=low` with no known audit finding allowed.
10. Insights TypeScript + privacy-contract tests.
11. Wrangler build dry-run for Insights.

All passed on run `31595138519`.

## 4. Mission interaction evidence

Real-browser tests now cover:

- `DONE` through leave/reload/debrief;
- `PARTLY DONE` as a valid success-side outcome;
- `FAILED / DID NOT WORK` with reintegration;
- `DID NOT START` with a smaller/replacement path;
- hard safety-confirmation gate;
- 375px mobile viewport without horizontal document overflow;
- keyboard-only choose/commit/leave path;
- aggregate network payload inspection.

A private marker inserted into mission/debrief content is asserted absent from aggregate signal payloads.

## 5. Local privacy hardening

Mission and debrief content now use the dedicated `mission-private-store.js` mechanism.

Bounded implementation:

- AES-GCM using the browser Web Crypto API;
- 256-bit non-extractable key;
- key material stored via IndexedDB;
- fresh 96-bit IV for each write;
- encrypted envelope stored under the existing local Mission key;
- legacy plaintext migrates only after successful encryption;
- encrypted data is preserved rather than silently deleted if the key is missing;
- Mission writes fail closed rather than silently reverting to plaintext.

Real-Chrome tests prove:

- encrypted round-trip succeeds;
- raw localStorage does not contain the private test text;
- identical plaintext writes produce different ciphertext;
- legacy plaintext is replaced by ciphertext after successful migration;
- deleting the key makes existing ciphertext unreadable without deleting the ciphertext.

### Allowed privacy claim

> Mission and debrief text is encrypted locally in this browser and is not included in Clove's aggregate Insights events.

### Explicit limits

This does **not** protect against:

- malicious JavaScript running with the same origin;
- a compromised or unlocked device/browser profile;
- screenshots, clipboard capture, extensions, or operating-system compromise;
- an attacker who obtains both the browser key material and ciphertext.

Do not describe the mechanism as zero-access, unhackable, military-grade, end-to-end encrypted, or anonymous.

## 6. Dependency security repair

The pre-hardening Insights development graph contained four npm audit findings: two moderate and two high.

The bounded repair updated the lockfile-selected graph without changing the Insights package manifest:

- Wrangler `4.115.0` → `4.121.0`;
- Undici `7.28.0` → `7.29.0`;
- Nanoid `3.3.16` → `3.3.18`;
- Miniflare moved to the version selected transitively by the repaired Wrangler graph.

The repair gate required:

- only `workers/insights/package-lock.json` to change;
- zero npm audit findings after repair;
- Insights typecheck/tests to pass;
- Wrangler dry-run to pass.

All passed. The normal F1 verifier now makes a clean npm audit a hard gate rather than an informational warning.

## 7. Defect caught during hardening

The first one-shot HTML integration operation malformed the page tail around the footer/script boundary.

The project did **not** waive or hide the defect.

Response:

1. stop the gate;
2. inspect the generated HTML;
3. repair the page tail deterministically;
4. add a static regression assertion for the exact structural boundary;
5. replay real-browser and privacy gates;
6. remove the temporary write-enabled integration/repair workflows;
7. remove the temporary integration/repair scripts from the candidate runtime branch.

This defect is therefore part of the verification history, not a known unresolved candidate defect.

## 8. Write-authority cleanup

Temporary workflows that required `contents: write` existed only to apply the bounded one-shot integration and dependency-lock repair.

After those tasks completed, both write-enabled workflows were removed.

The persistent F1 verification workflow uses read-only repository contents permission.

## 9. Branch boundary replay

Comparison performed from `main` to frozen runtime candidate `80951b40e269168d8232bc9ca2490cd2ed38d3e2`:

- status: ahead;
- ahead by: 49 commits;
- behind by: 0 commits;
- merge base equals the current `main` baseline used for the comparison;
- 22 changed files in the candidate boundary;
- no homepage redesign;
- no production Cloudflare/DNS/D1 mutation;
- no JoyMesh, crew, mentor, rank, social-feed, or minors feature integration.

Material code changes are limited to Mission 001, its tests, the Insights coarse-event/privacy contract, the Insights dependency lock, and the verification workflow. Remaining changes are governing/research/design documents.

## 10. Pilot protocol

`docs/CLOVE_V2_F1_1_PILOT_PROTOCOL.md` defines the next external gate.

The first cohort is capped at five independent first-time adult users age 18–24.

Decisive early falsification thresholds include:

- comprehension: at least 4/5 understand the real-world-action proposition;
- action transition: at least 3/5 voluntarily leave Clove and attempt the action;
- return integrity: at least 2/3 of attemptors return and record an outcome;
- safety: zero credible reports that the product pressures users toward unsafe risk, courage proving, privacy exposure, or public performance;
- voluntary repeat intent: at least 2/5 answer yes to using it again.

The pilot protocol authorizes **no recruitment, deployment, incentives, spending, or data expansion**. Live pilot authorization remains an owner gate.

## 11. Digital Stewardship dependency

The new Digital Stewardship / Digital Agency foundation is tracked separately under issue #148.

Its existence does not reopen Mission 001 and does not authorize unverified Digital Stewardship teaching in the pilot UI.

Mission 001 is already consistent with the stewardship constitution on the dimensions relevant here:

- local/private-by-default content;
- server-side data minimization;
- no public-proof incentive;
- explicit exit from the website to act in reality;
- recovery/reintegration after failure.

## 12. Terminal verdict

**`PASS_WITH_DISCLOSED_LIMITS`**

F1.1 is technically complete and suitable to become a **draft review candidate**.

The disclosed limits are external to the verified interaction implementation:

1. no real-user pilot evidence exists yet;
2. local encryption has the bounded threat model stated above;
3. Digital Stewardship public curriculum remains evidence-gated under issue #148;
4. no production deployment is authorized.

### Next independently judgeable unit

Open a draft pull request against `main`, preserve the frozen candidate boundary, and do not merge.

After review, the next owner decision is binary:

> authorize the five-person adults-only pilot under `docs/CLOVE_V2_F1_1_PILOT_PROTOCOL.md`, or do not authorize it.

F2 community/crew work remains locked until the pilot survives its gates.
