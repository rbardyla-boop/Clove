# CloveLearn v2 — F1 Verification Record

Status: **PASS_WITH_DISCLOSED_LIMITS**  
Adjudication date: **2026-08-12**  
Implementation candidate: `205f7019aee829aff9892fff3be05b27d2acfe97`  
Branch: `f0/brotherhood-salvage-audit-2026-08-12`  
GitHub Actions run: `31592338096`

## Claim tested

> A first-time user can choose one bounded real-world mission, leave the site, complete or honestly fail an observable action, return, record what happened, and leave with a legitimate next state without requiring a social feed, mentor marketplace, AI companion, rank system, payment, account, or external community integration.

Required path:

`ARRIVE → CHOOSE → COMMIT → DO OFFLINE → RETURN → EVIDENCE → DEBRIEF → NEXT`

## Verdict

**PASS_WITH_DISCLOSED_LIMITS**

The bounded F1 implementation claim survives the automated acceptance gate. This is **not** evidence that Mission 001 improves loneliness, wellbeing, purpose, masculinity, social connection, or retention. It is also not evidence that real users will voluntarily complete the loop.

No production deployment is authorized by this verdict.

## Evidence

### Static contract replay

`tests/static/mission-001-contract.test.mjs`

Result: **9 / 9 PASS**

Verified:

- action-first ten-second proposition;
- FIX / SERVE / LEARN / BUILD all present;
- explicit leave-the-site action gate;
- success / partial / failed / not-started states;
- reintegration rather than shame/exile;
- local-only private evidence model;
- explicit high-risk mission boundary;
- bounded aggregate event vocabulary;
- no mission/debrief content in the client signal function;
- basic mobile/accessibility affordances.

### JavaScript syntax replay

Inline Mission 001 browser code extracted and checked with Node syntax validation.

Result: **PASS**

### Real-browser acceptance replay

`tests/static/mission-001-browser.test.mjs`  
`tests/static/mission-001-partial-browser.test.mjs`

Result: **7 / 7 PASS**

Verified in headless Chrome:

1. **DONE** — commit → leave → reload/return → evidence/debrief → complete;
2. sensitive fixture strings in mission/debrief content never appear in aggregate signal payloads;
3. **FAILED** — failure remains in the loop and permits a smaller retry;
4. **DID NOT START** — non-start remains in the loop and permits shrinking the mission;
5. **PARTLY DONE** — partial completion remains a valid evidence/debrief path rather than being converted to failure;
6. safety confirmation is a hard commit gate; a hazardous live-electrical fixture cannot be committed without affirming the explicit safety/competence condition;
7. 375 px mobile width has no horizontal document overflow at entry and return;
8. the core choose/commit/leave path is operable using keyboard input alone.

### Insights contract

`workers/insights/src/contracts.ts`  
`workers/insights/test/contracts.test.ts`

Result: TypeScript check **PASS**; privacy-contract tests **8 / 8 PASS**.

The server-recognized Mission 001 event set is enumerated. Unknown mission content fields are not returned by validation and therefore are not part of the aggregate insert contract. Invalid free-text detail is normalized to `none` rather than stored.

## Defects found during the gate

### D1 — test expected enum rejection while the existing contract deliberately normalizes to fallback

Initial CI failed because the new test expected a non-enumerated `detail` value to throw. The existing Insights contract intentionally normalizes unknown optional enum dimensions to a safe fallback.

Ruling: **test defect, not product/privacy defect**.

Repair: test now verifies normalization to `none` and verifies that mission text/evidence/photo/location/identifier fields are stripped from the validated object.

Replayed after repair: **PASS**.

### D2 — CI Node version below current Cloudflare tooling floor

Initial verification used Node 20. Current installed Wrangler/Miniflare packages declare Node >=22.

Repair: F1 CI now runs Node 22.

Replayed after repair: **PASS**.

## Disclosed limits

### L1 — no real-user behavioural validation yet

The gate proves that the product loop functions. It does not prove that a stranger understands it in ten seconds, voluntarily leaves the site to act, returns, or finds the mission meaningful.

**Consequence:** F2 crew/social work remains locked. A bounded adult pilot is required first.

### L2 — local mission/debrief records are not yet using Clove's encrypted vault

Mission 001 stores its private state in browser local storage and sends none of that text to Insights. The repository already contains an AES-GCM local vault mechanism in `od-core.js`, but Mission 001 does not yet use it.

**Consequence:** before a broad public pilot, either integrate a minimal reviewed encrypted local store or explicitly accept and document the local-device threat model. Do not claim “encrypted private mission records” in the current build.

### L3 — npm audit warning in Insights development tooling

`npm ci --prefix workers/insights` reported **4 vulnerabilities (2 moderate, 2 high)** in the installed development dependency tree during the successful F1 run.

The package currently declares tooling as `devDependencies`; this record does **not** adjudicate exploitability or deployment exposure.

**Consequence:** dependency audit/repair is a production hardening gate. No production authorization while this remains unreviewed.

### L4 — safety is an explicit user-attestation boundary, not semantic mission moderation

The page names high-risk categories and will not commit without the user affirming that the task is legal, low-risk, within competence, and privacy-respecting. It does not inspect free text and independently detect a lie or unsafe description.

**Consequence:** Mission 001 must not be described as automatically safety-screening user tasks. Autonomous mission generation remains out of scope.

### L5 — no production Cloudflare integration replay

Signals were tested against a local capture endpoint and against the server-side validation contract. The branch has not been deployed to the live Cloudflare routing/Insights stack.

**Consequence:** production integration remains an explicit external gate.

## F1 terminal ruling

The implementation itself is complete enough to leave F1. It passed its bounded functional, privacy-contract, failure-reintegration, mobile, and keyboard gates.

The project does **not** advance to crews, mentoring, JoyMesh, ranks, or social architecture.

## Next independently judgeable unit

### F1.1 — PILOT HARDENING

Before asking real users to try Mission 001:

1. resolve the local-storage encryption/threat-model decision;
2. audit and repair/adjudicate the Insights development dependency warnings;
3. run the exact F1 gate again;
4. create a reviewable draft PR / pilot candidate without merging to production;
5. define a tiny adults-only pilot protocol and falsification criteria;
6. request explicit production/pilot authorization only after the hardened candidate passes.

No F2 work is authorized.
