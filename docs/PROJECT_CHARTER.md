# Project Charter — Architectural Decision Record

Significant architectural decisions are recorded here (per `.claude/rules/engineering.md`).
Newest first.

---

## ADR-050 — Turf Wars Phase 1: lab-only signed-CRDT substrate (merged, prod-denylisted) (2026-06-27)

**Context.** The Turf Wars roadmap (`docs/NEON_CIRCUIT_TURF_WARS_ROADMAP.md` — a DESIGN-ONLY document on
the unpushed `docs/turf-wars-roadmap` branch @ `f0fcfa5`) proposes a decentralized, no-central-server
GTA-80 / async turf-control direction. That vision is **charter-illegal by construction** until a Phase 0
counsel ruling and a charter-superseding ADR clear a bounded version; the live gameplay charter still
treats raiding/loot/economy/ownership as hard non-goals. Phases 1–4 of the roadmap are explicitly
LAB-ONLY and buildable in parallel with that legal review; only the Phase 5 live pilot waits on counsel.
This ADR records that **Phase 1 — the cryptographic/CRDT substrate — was built and merged as lab-only
code with zero production exposure**. It authorizes nothing live.

**Decision.** Land the signed-CRDT substrate under `arcade/hiveworld-agents/turf-wars/` (6 pure,
dependency-free `.mjs` modules: canonical, identity, ops, block-log, snapshot, turf-evidence), covered by
the **existing** `arcade/hiveworld-agents/` entry in the curated-upload denylist (no new denylist entry
required), imported by no Worker/DO/client path. Prove the foundations deterministically; record the
boundary; ship via PR with a normal merge commit and **no deploy/upload/Cloudflare mutation**.

**Consequences.** Merged to `main` via **PR #103** (merge commit `c9c11b5`, 2 parents — `9444a4e` build +
`455d38e` post-review hardening, preserved, not squashed). The substrate proves, under 52 lab assertions
(full repo suite 1203/1203 at merge): per-device **Ed25519** identity (player id = hash of public key; no
accounts/PII/server identity); a signed, hash-chained, append-only op log folded by a **pure,
order-independent, convergent** function (tamper → `hash_mismatch`, forged sig → `bad_signature`, wrong
prev → `chain_break`, gap → `seq_gap`, fork → `fork_detected`, replay → idempotent, foreign writer →
`not_owner`, unknown top-level key → `unknown_op_key`); **bounded non-cash** counters (`flux`/`cores`:
no negative balance, capped+clamped mint, per-`(structure,tick)` collect) with **no transfer / trade /
sell / cash-out op in the grammar** — value cannot leave a block by construction; content-addressed,
host-signed snapshots that verify **offline** from the record alone; a closed op + structure vocabulary
(the combat op `record_attack_result` is **reserved and rejected** = `reserved_for_phase2`); and a C1–C10
adversarial matrix with byte-identical replay. Two independent reviews (an 11-lane + 2-synthesizer
workflow, then a focused re-review) plus independent fresh-context verifiers all returned ACCEPT.

Boundary held throughout: `LIVE_WORLD_LOADER_ENABLED` remains `false`; the curated production upload
excludes every Turf Wars file (`--list | grep -c turf-wars` = `0`); no Worker/DO/D1/R2/migration/secret/
config was touched; no deploy or upload occurred. Detail lives in the on-`main` lab note
`docs/TURF_WARS_PHASE1_LAB_NOTE.md`.

This ADR **does not**: supersede the live gameplay charter (a counsel-ruled superseding ADR is still
required); satisfy or substitute for the Phase 0 legal/safety review (which remains **blocking** for any
live or minors-facing use); authorize live Turf Wars, attacks, decentralized production state,
minors-facing UGC, economy, territory combat, ownership, or publishing; or authorize Phase 2 (deterministic
attack simulator + fraud-proof — see `docs/NEON_CIRCUIT_TURF_WARS_PHASE2_PLAN.md`, design-only), Phase 3
(availability fabric), Phase 4 (safety quorum), or Phase 5 (live pilot). It records a proven lab
foundation, nothing more.

## ADR-049 — Creator Freedom v1 / Free Sandbox: live release on clovelearn.io (2026-06-26)

**Context.** ADR-048 landed the Free Sandbox on `main` (merge `c20d486`) but did not deploy it. The
production static site (`clovelearn.io`, Pages project `wild-hat-6257`) is updated by a manual operator
dashboard upload, not by CI/CLI. This ADR records the live release and its verification.

**Decision.** Ship the reviewed `c20d486` curated upload package to production via the operator's manual
dashboard upload, gated behind a read-only pre-upload review and a read-only live verification — no code
change, no flag flip, no Cloudflare-config mutation. The agent does not (and cannot) perform the upload;
it verifies fidelity before and liveness after.

**Consequences.** Creator Freedom v1 / Free Sandbox is **live and verified** at `https://clovelearn.io`.
The curated package (293 files / 16.77 MiB, aggregate
`8c863852a6438af887e55991e66e1e8f54e01e7a251abacae609520002bc8c42`) was built faithfully from a clean
detached worktree at `c20d486`, so no dirty working-tree content shipped. Live identity is proven: all 18
creator `.mjs` files plus `arcade/cabinet-catalog.mjs` are byte-identical (sha256) to the reviewed
package, all 5 Free Sandbox modules serve 200, and the live `sandbox-runner.mjs` carries the
`free-sandbox-retention` import. A 20/20 headless live smoke passed end-to-end (builder → Free Sandbox →
gate → one-click test-in-sandbox handoff → the sandbox ran the generated game and surfaced an
untrusted-local proposal), with zero off-host network, zero 404s, and zero console errors on the creator
path. The trust boundary holds in served bytes (`allow-scripts` only, `allow-same-origin`=0, child CSP
`default-src 'none'`, importer deny-list present); blocked surfaces (approval/moderation/live-loader,
arcade-studio, workers/tests/docs, block/layered/district editors, creator-corner) return 404; secrets are
not exposed. Findings: zero Critical/High/Medium; Low only — Cloudflare's edge-injected
`/cdn-cgi/challenge-platform/` inline script blocked by the site CSP (one cosmetic console message),
`.env` → 403 (dotfile protection, content not served), and the previously-recorded pre-existing items
(legacy fonts/CDN, legacy same-origin arcade WebSocket clients, inert dev scripts served as static text).
**Verdict: shipped; no rollback.** Optional follow-ups remain their own gates: self-hosting legacy
fonts/CDN, and scoping the unrelated graphics-degradation task. Live publishing of *third-party* creator
packages into the live world stays gated by ADR-047 (this release ships only the local authoring +
null-origin sandbox surface). Release record: `docs/CREATOR_FREEDOM_V1_LIVE_RELEASE.md`.

---

## ADR-048 — Creator Freedom v1 / Free Sandbox: graph-as-data + a fixed interpreter (no new trust surface) (2026-06-26)

**Context.** The Local Maker's authoring depth was thin: one fixed rule-graph template (CF-4A Reaction
Lane) plus closed-token preset variants, so creator games risked feeling like reskins. The goal was a
much wider *local* sandbox where creators combine arena, entities, movement, rules, waves and objectives
— without crossing into arbitrary JavaScript, network/storage, live publishing, accounts, or economy.
The shipped runtime already enforces "no arbitrary JS reaches the live surface" via a hardened model
(creators author closed data; the importer source-scans; a null-origin iframe runs it), so the question
was how to broaden the vocabulary without weakening or duplicating that boundary.

**Decision.** Adopt **graph-as-data + one fixed interpreter** (chosen over per-graph specialized codegen
and over a brand-new data interpreter / new package kind). A creator authors a closed-vocabulary
declarative graph (`schemas/free-sandbox-schema.mjs`); the generator emits a **standard `arcade_game`
package** whose `game.mjs` is `const GRAPH = {…}` followed by a single FIXED, reviewed deterministic
interpreter (`free-sandbox-interpreter.mjs`, emitted verbatim via `.toString()`). Because the output is
an ordinary `arcade_game` package, the **importer gate and the null-origin sandbox are unchanged** — the
new trust surface is zero. The validator is fail-closed (closed enums, hard caps on entity types / live
instances / rules / waves / spawn rate, deny-by-default capabilities, no URLs/economy vocabulary, reachable
objective). Five example games ship as graph fixtures (survival dodge, collect-and-escape, wave clear,
timed route, combo score) — five distinct objectives, ≈26 KB each. A data-only editor mode in the
arcade-builder (`free-sandbox-editor.mjs`) composes the graph, validates live, shows the fingerprint, and
hands off to the sandbox; host-only play retention (`arcade-sandbox/free-sandbox-retention.mjs`) records
best/grade/plays by package fingerprint in the trusted page's `localStorage` only (never the iframe).

**Consequences.** Additive only under `arcade/creator/` (+5 reviewed modules) plus the builder/sandbox
HTML wiring; the importer, validator-core, and sandbox iframe are untouched. The reviewed Creator Editor
bundle legitimately grows by these modules, so `EXPECTED_EDITOR_AGGREGATE` is re-pinned (security-reviewed
re-bless, not unreviewed drift; content file count 36 → 41). No Worker/DO/D1/R2/migration/secret change, no
Cloudflare/deploy, no flag flip, no live-world / economy / account / upload surface. Validation: full
`tests/arcade/*` + `tests/creator/*` node suite green (1151), the new `free-sandbox-*` suites + editor
browser smoke green, builder + sandbox smokes green, production-config + city-size + curated-upload gates
green. Local-only; not pushed/deployed. Detail: `docs/CREATOR_FREEDOM_V1_FREE_SANDBOX.md`. Live publishing
stays gated by ADR-047.

---

## ADR-047 — CF-7 live loader stays DISABLED until the Phase 9A.5 economy legal/safety review resolves (2026-06-24)

**Context.** The Phase 9A.5 read-only audit (`docs/PHASE9A5_ECONOMY_LEGAL_SAFETY_AUDIT.md`) recorded
that the live arcade ticket→prize economy is **persistent** (DO-durable `arcadeState`,
`arcade-room.ts:156`), **keyed by a client-supplied `playerId`** (no account/auth), publicly
reachable on `clovelearn.io` with **no age gate**, and **not yet through a documented legal review**.
It is non-cash, non-transferable, and capped, but the §7 counsel questions (minors/child-privacy,
chance/prize mechanics, stored-value, consumer/dark-pattern, data-retention) are open. CF-7
(operator-approved live creator loading) is already SHIPPED DISABLED via
`LIVE_WORLD_LOADER_ENABLED=false` (`arcade/creator/approval/approved-loader.mjs`). Enabling CF-7
could let creator-authored content reach the same rewards/economy surface, compounding an
as-yet-unreviewed risk.

**Decision.** CF-7 stays disabled. `LIVE_WORLD_LOADER_ENABLED` remains `false` — no flag flip, no
live creator loading, no public UGC reaching the live world — **until** the §7 counsel questions are
answered and the economy acceptance criteria (audit §12) are met. This ADR records the operator
decision binding CF-7 enablement to the economy/legal review; it changes no code (the flag is
already false) and is a governance gate, not an implementation change.

**Consequences.** Live creator loading and any economy expansion remain gated behind counsel review;
the audit's §12 acceptance criteria are the explicit gate. No deploy, no flag change, and no economy
or UGC enablement may proceed without first satisfying that review. Revisit this ADR only when the
9A.5 review is recorded as resolved.

## ADR-046 — Consent Anchor bridge boundary (PLAN ONLY; read-only, no live authority) (2026-06-24)

**Context.** The Trust Stack framing pairs Neon Circuit with a user-authorized cognitive/evidence
system (cognitive-os / "Vibe" / the Sovereign Agent OS doctrine layer), which already ships **real**
artifacts in the untracked `prototype/cognitive-os/`: `EpistemicLicense` (`core/cip/epistemic_license.rs`),
`RecordedRun` (`vibe-run`), content-hash binding via `run_hash`, a `revocation` path, and a `signer`
(`scripts/design_signing.py`). Neon will eventually want trusted signals it lacks today — creator trust,
moderation evidence, review history, identity-adjacent consent, platform safety. The naive integration —
letting an external agent write verdicts/approvals/ranks into Neon — would break the one invariant Neon's
authority model depends on: **no external system authors canonical facts.** The cheapest moment to fix
that boundary is before any bridge code exists.

**Decision.** Author `docs/NEON_CIRCUIT_CONSENT_ANCHOR_BRIDGE_PLAN.md` — **PLAN ONLY, no code** — defining
the **Consent Anchor** as a strictly **read-only, consent-gated, revocable** seam: a user-granted,
scoped `EpistemicLicense` lets Neon read a **public-safe, allowlist-projected, hash-bound, signed**
evidence summary into its **human** review/audit surfaces, and nothing more. Evidence flows toward a
human; authority never flows toward the Anchor. The doc fixes the boundary (non-goals, consent +
evidence models, the `CityRoom`/`CityRegistry` no-write line, the CF-8 human-review line), a threat model
(forged/stale/revoked evidence, signer compromise, replay, prompt injection via the quarantine pattern,
overbroad consent, privilege escalation, data leakage, reviewer overtrust), the deny-by-default tests a
future build must pass, and hard acceptance gates before any code. Inferred-vs-real provenance is labelled
honestly: `EpistemicLicense`/`RecordedRun`/`run_hash`/`revocation`/`signer` are real; `EpistemicReceipt`
and the **Consent Anchor itself** are planned/inferred and marked as such.

**Consequences.** New `docs/NEON_CIRCUIT_CONSENT_ANCHOR_BRIDGE_PLAN.md` + this ADR. **No code, no
Worker/DO change, no deploy, no migration, no flag change.** `LIVE_WORLD_LOADER_ENABLED` stays false;
no marketplace, chat, public-UGC, accounts/identity bridge, or economy/ownership authority is created or
enabled. `prototype/` is untracked and out of scope — this plan only *names* its artifacts; nothing under
it is read into, staged, or swept into git. The Anchor grants **zero** live authority by existing. The
post-plan fork stays parked: a future, separately-ADR'd implementation sprint may begin **only** when the
artifact schemas are identified, consent/revocation semantics are testable, no live authority is granted,
the reader path is quarantined from the actor path, and the threat model is reviewed (per the plan's §13).
Local-only; not pushed, not deployed.

## ADR-045 — Creator Editor production release on a dedicated, separate Cloudflare Pages surface (RELEASE ACCEPTED, DONE) (2026-06-15)

**Context.** The Creator Editor (Creator Corner hub + 4 tools + the ADR-044 Arcade Studio, assembled as
a single static surface) was driven to production through a gated R0→R8 sprint (R1 safety floor, R2
arcade-studio static release candidate, R3 single-root staging artifact, R4/R5 effects verification,
R6 staging deploy, R7 staging security/header/isolation verification). The first production attempt
(R8) overlaid the editor onto the existing `clovelearn.io` static host (`wild-hat-6257`, a Workers
static-assets Worker) at `/arcade/creator/**` + `/arcade-studio/`. It went live and functioned, but
the **live smoke failed**: the `clovelearn.io` zone **injects the Cloudflare Web Analytics beacon**
(`static.cloudflareinsights.com/beacon.min.js`, conditional on a browser `Accept: text/html`) into HTML
responses. The editor's strict CSP **correctly blocked** it (no external JS executed) but this produced
console errors + a blocked external-request attempt — violating the no-external-network / clean-CSP
release invariant on a public surface. That deploy was **rolled back** (to version `c907d5e9`); the main
app was unaffected. Two host-specific facts were also confirmed live on `wild-hat-6257`: path-scoped
`_headers` do NOT override the global `/*` for single-value headers (editor got `XFO: SAMEORIGIN`, not
`DENY`), and the global app CSP coexisted with the editor CSP (two CSP headers, intersection).

**Decision.** Ship the Creator Editor production from a **NEW, dedicated, isolated Cloudflare Pages
project — `clove-creator-editor-production`** — NOT `clovelearn.io`, NOT `wild-hat-6257`, and NOT the
under-`clovelearn.io` overlay model (which is **superseded** for editor production hosting). The served
surface is **editor-only** (no curated `clovelearn.io` app), built reproducibly on `main` by
`scripts/build-creator-editor-standalone-production.mjs` → `/tmp/creator-editor-standalone-production-root`
(38 files; manifest `_CREATOR_EDITOR_MANIFEST.json`; aggregate
`a0bf7f97ae0edf7fef7a3607c92eaf3c878e7a2242b2779afb3adbc2dd3c562a`; staging marker absent). Framing is
delivered via **header CSP `frame-ancestors 'none'`** (header-only — browsers ignore + console-error on
`frame-ancestors` in `<meta>`), with `X-Frame-Options: DENY` as the legacy complement; the editor source
HTML is unchanged. The editor source stays denylisted from the curated production upload.

**Production URLs.** Branch deployment: `https://609c6390.clove-creator-editor-production.pages.dev`
(deployment id `609c6390-d7fe-47ef-9d7e-269319378359`, source `main` @ `f664498`). Project alias:
`https://clove-creator-editor-production.pages.dev`. No custom domain.

**Consequences.** RELEASE ACCEPTED, DONE bar met, **0 findings**. Live verification on the dedicated
surface (the failure modes of the `wild-hat-6257` attempt are all fixed here): **beacon-absence = 0 hits
on every editor entry with browser `Accept: text/html`** (control `clovelearn.io/arcade/city/` still = 1,
confirming the injection is zone-specific); live browser smoke **35/35** incl. no console errors + no
external network; **single** editor CSP header per entry (no broad-app coexistence); `X-Frame-Options:
DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, nosniff, `Permissions-Policy: camera=(),
microphone=(), geolocation=()`, HSTS; `frame-ancestors 'none'` present in the header CSP; per-entry
`script-src` = hub `'none'` / sandbox `'self' 'unsafe-inline'` (exact-path) / studio `'self'` (no
inline/eval); no `unsafe-eval`/external host/wildcard; manifest aggregate served and label-clean;
`_STAGING_MANIFEST.json` → 404; all upload/submit/publish/`live_world_authorized`/`/arcade/ws`/
`/arcade/health` → 404 (no write authority, no Worker/API/WS on this Pages project); sandbox stays an
untrusted-local proposal; no upload/submit/publish, no live loader, no creator-output ingestion, no
economy/ownership/reward surface. **Production isolation:** `clovelearn.io` unchanged (editor paths
remain 404, `/` 200), `wild-hat-6257` untouched, no Worker/DO/D1/R2/migration/secret/config change, no
custom domain, no DNS/routes; the staging project (`clove-creator-editor-staging`) is untouched.
**Rollback** (isolated to this Pages project; not required, not executed): `wrangler pages deployment
delete 609c6390-d7fe-47ef-9d7e-269319378359 --project-name=clove-creator-editor-production`.

**Caveat.** The editor is production-live on a **`*.pages.dev`** URL, **not** under `clovelearn.io`. Any
future custom domain or subdomain is a SEPARATE security/DNS release gate, not a cosmetic rename — and a
subdomain *inside* the `clovelearn.io` zone may reintroduce the zone-level Web Analytics beacon unless
proven otherwise (a separate zone or a confirmed analytics exclusion would be required).

---

## ADR-044 — Arcade Studio: standalone Vite + Three.js creator tool for validated, data-only 3D arcade assets (2026-06-13)

**Context.** The operator authorized building a reusable, high-quality arcade *building + asset
creation* system as a browser `npm install && npm run dev` Three.js/Vite tool — treating "arcade
quality" as an exportable-validated-data problem, not a one-off pretty room. The existing creator
pipeline (`arcade/creator/**`) is 2D (iso/layered renderers, `.mjs` + HTML, vendored three global)
and has no 3D editor or bundler. The forbidden-surface doctrine is firm across the whole repo:
local-only, data-only, no live-world load, no economy/ownership/reward/ticket/upload/remote/script.

**Decision.** A NEW, isolated subproject `arcade-studio/` (own `package.json`, Vite + `three`
^0.169) rather than entangling the static prod app. It deliberately MIRRORS the 2D pipeline's
security philosophy so it reads as a real extension: closed frozen token vocabularies
(`src/validation/tokens.js`), canonical `sha256:` content hashing (`src/importExport/hashAsset.js`),
and deny-by-default validators that reuse the same forbidden regexes / economy-terms / private-key /
capability-flag bans (`src/validation/safety.js`, `forbiddenSurfaceChecks.js`). Two closed schemas —
`arcade_cabinet_asset` and `arcade_building_layout` — are the export contract; every authorable option
is a token or bounded-clean text (no free-form runtime surface). Screen-shake and particle systems are
closed preset tables with clamped numerics (no arbitrary scripts/shaders). The render/editor layer
(core renderer/scene/camera/lights/loop/input, cabinet geometry/materials, building/props/zones,
effects, editor panels, orbit+player preview, debug panel) is kept SEPARATE from the pure data spine,
which is fully Node-testable without a browser. Local-only: no network/fetch/upload/live-world loader
anywhere; export/import is in-page + local file download.

**Consequences.** Additive only — no change to the prod app, `arcade/**`, or Workers. New paths:
`arcade-studio/{src,test,scripts}`. `arcade-studio/dist/` and `node_modules/` are build output
(gitignore). Verification: 75 Node tests green (schema, hostile-fail-closed, forbidden-surface,
round-trip, determinism, exhaustive-token, unicode-normalization, fuzz); `vite build` green (77 modules); headless Playwright
smoke green (WebGL renders, 164 draw calls, in-page export→import hash-stable, orbit↔player toggle,
debug panel live, zero console/page errors); a multi-agent adversarial audit
(forbidden-surface / closed-schema / criteria-coverage / three.js-correctness, each finding
independently verified) gated hardening. Local-only; not committed/pushed/deployed.

---

## ADR-043 — Curated starter placement: checked-in manifest gates LOCAL showcase mounting; server catalog keeps gating ticketed play (2026-06-11)

**Context.** PR #65 shipped a 16-starter cabinet library that lived only in the builder. The
operator authorized placing a first public floor set (6, one landmark anchor per block) without
opening CF-7, the creator approval path, or the Worker. The server validates every occupy/round
against the Worker-bundled catalog (`workers/arcade/src/catalog.mjs` → `occupy_denied` /
`invalid_cabinet` for unknown ids), so ticketed starters are structurally impossible without a
Worker change — and the plan's red team flagged that the runtime had no production mount path
for catalog-less cabinets (`loadAndMountImported` was test-only).

**Decision.** Two-gate authority model. (1) The SERVER CATALOG remains the only gate for
TICKETED play — untouched. (2) A new checked-in, operator-authored manifest
(`arcade/cabinets/starters/curated-floor.mjs`) gates LOCAL SHOWCASE mounting only, through one
promoted runtime export `mountStarterCabinet()` that fails closed unless the loaded adapter is
strictly local (`client_local_only`, ticket/challenge `none`, zero ticket/challenge/prize
capabilities). Starters send no messages and can award nothing; the WS-spy smoke pins this.
Per-starter `game.mjs` files are generated at AUTHOR TIME from the closed builder tables
(`write-starter-statics.mjs`, denylisted from upload) and BYTE-PINNED to the generator by unit
test; production code never imports `arcade/creator/**` (grep-tested). The shelf carries the
pre-tap honesty line "session-local · no tickets" (the District Tour convention), and an
invalid manifest renders an EMPTY shelf (fail-quiet, never partial). Rollback: revert the PR,
or empty the manifest array. This is static first-party content — NOT live loading: CF-7's
`loadApprovedPackage`/receipts are never invoked and `LIVE_WORLD_LOADER_ENABLED` stays false.

**Consequences.** The floor's cabinet band lifted (bottom 13%→32%) to free the shelf strip;
geometry is pinned by a no-overlap smoke assertion at 360px, not by eye. The deferred follow-ups
are explicitly gated: the 2 flex starters + `?from=<cityId>` per-block shelf ordering (PR 2,
closed-list-validated), and any ticketed starter would require the catalog + ruleset Worker
path with its own authorization.

---

## ADR-042 — W-5 implemented as City Block Mood (display-only; "recognition" wording narrowed) (2026-06-11)

**Context.** ADR-041 gated W-5 ("production block-collective recognition, display-only") on operator authorization. A plan-only adversarial review (5 reviewers + 3 red-team lenses, all approve-with-changes) found the word "recognition" itself was the risk: HIVE_WORLD_ALIGNMENT.md §6 framed rung-1 as the accrual leg of a creator-compensation ladder ("plays", spotlights, per-cabinet accrual), "recognition" is literally a W-4 agent-ledger value-transfer memo token, and visible windowed counts drift into points/rank (AE-4/AE-10/AE-12; the repo already suppresses its one windowed number in renderHostRank). The operator authorized the narrowed slice only.

**Decision.** W-5 ships as **City Block Mood**: ONE atmospheric prose line about the CURRENT block, client-derived from already-received public city events. Display-only client derivation — zero Worker/DO/wire/migration change (Worker byte-identical); no counts, no numerals, no balances/transfers/payouts, no person attribution (ADR-009 deferral intact), no persistence (SESSION-LOCAL NON-REWARD; in-memory 60s window; reset on reload and every block switch), no W-4 production import, no CF-7 interaction.
1. **Boundary (`city-block-mood-intake.mjs`)** — dedup-then-strip: closed 3-type allowlist (`city_portal_enter_accepted`, `city_arcade_interior_opened`, `city_block_trial_completed`), canonical `city_id` cross-block drop, future-stamp reject, transient 1-per-(actor,type)-per-window dedup, **null-actor trial events dedup by event_id only** under the model's per-type clamp; payload + identity dropped — only `{event_id, type, server_time}` reaches the model. This is the only file in the feature that reads an actor field; it never stores one beyond the window, never serializes, never sends.
2. **Model (`city-block-mood.mjs`)** — 60s window, per-type clamp 3, internal tone enum `ebb|flow|surge` (never rendered; renamed off the host-rank vocabulary), frozen 6×3 copy table, exact 4-key envelope `{schema_version, city_id, atmospheric_text, public_safe}`.
3. **Named AE-8 trade-off** — identity stripping forfeits per-actor dedup in the pure layer; the design substitutes saturation for dedup (boundary dedup + clamp + 3-tone quantization + no numeral + grants nothing). Honest caveats recorded: trial events are *indirectly* host-rank-gated server-side at creation; the client id is URL-overridable so dedup keys are attacker-chosen; raw actor ids already exist in the client event buffer regardless of this feature.
4. **Visible counts REJECTED** (binding): a rendered per-block activity tally is a grind invitation (AE-4), ordinal across blocks (AE-10), reads decay as loss (AE-12), and is dishonest under the 50-event log trim; "community plays" would additionally be fabricated — **no room→block binding exists**, and that absence is named as the structural anti-creator-receivable fence (the moment cabinet-play events feed block mood, rung-1 becomes a payment-chain accrual leg).
5. **Naming** — production files/fields/copy use "mood"; "recognition" survives only in ADR/alignment prose. The feature shares no semantics with the W-4 `recognition` memo token and may never consume agent-ledger output.
6. **Docs** — HIVE_WORLD_ALIGNMENT.md §6/§7 superseded in the same change (rung-1 = block mood, complete; the old plays/spotlight/"built by the crew" examples rejected); W-6 reframed as the **In-game Agent Attention Ledger** (system-shaped node agents only; never human balances/receivables/ownership/cash; W-4 vocabulary rename queued for W-6 planning); W-8 cash stays counsel-gated. Test-local extended screens (inflected economy stems, prose quantities, rank lexicon, tone words) deliberately live in the unit tests — the shipped validator regexes are untouched.

**Consequences.** New: `arcade/city/city-block-mood.mjs`, `arcade/city/city-block-mood-intake.mjs`, `tests/arcade/city-block-mood.{test,spec}.mjs`, `tests/arcade/run-city-block-mood.sh`, `docs/W5_BLOCK_MOOD_PLAN.md`. Modified: `city-scene.js` (intake feed + welcome reset + one textContent render), `city.css` (one constant-treatment rule), alignment doc §6/§7. Validation: 27 new unit tests; 19-check browser smoke green on the dev shim (incl. a REAL two-event tone shift, block-switch reset, zero web storage, 360px wrap); full arcade+creator suites green; curated-upload/production-config/size guards green; `workers/` diff empty. W-6/W-7/W-8 remain gated. Local-only; not pushed/deployed.

## ADR-041 — Hive World realignment: W-1…W-4 (map travel, top-world editor, arcade builder, agent-ledger sim) (2026-06-10)

**Context.** The `arcade/virtual-arcade/` design pack (HANDOFF/WORLD_BIBLE/PHASE_0) targeted the demoted Hallucinate backend; `arcade/virtual-arcade/HIVE_WORLD_ALIGNMENT.md` re-targets it onto the shipped Worker/DO hive and defines a gated W-1…W-8 ladder. This ADR records the implementation of the rungs that need no external gate.

**Decision.**
1. **W-1 — World-map fast travel (client/display-only).** New pure `arcade/city/city-world-map.mjs` (closed per-block zone accents — gold stays ticket-reserved — + deterministic BFS `shortestPath`/`planNextHop` over the public adjacency). The 8C-2 map inset becomes a travel control: adjacent node click = the existing single-hop route request; non-adjacent click = a client-side WAYPOINT that chains hops, **every hop still server-validated by `validateRouteRequest`** (a blocked hop cancels the waypoint). Zero new wire fields, zero authority change; routing truth stays in the DO.
2. **W-2 — District Asset Editor (CF-3.5, `arcade/creator/district-editor/`).** The missing EDITOR for the existing CF-5 `city_asset_pack` kind: grid composition of ALREADY-APPROVED hash-addressed block packages, validated by the shared `validateAssetPack`, previewed via `resolveAssetPack` + the existing renderers. Local-only, no submit/upload/live-load; approved-hashes-only is enforced by the validator, not the UI.
3. **W-3 — Arcade Builder (`arcade/creator/arcade-builder/`).** Assembled-builder UX over CF-1/CF-4: generates a complete `arcade_game` package (manifest + game.mjs + adapter.mjs) from CLOSED parameter tables (3 procedural variants × closed accent/speed/frame tokens), gated by the SAME `importArcadePackage` scan. DATA-ONLY: the page never executes generated code (no eval/dynamic import) — execution stays in the arcade-sandbox.
4. **W-4 — Hive agent-ledger SIMULATOR (`arcade/hiveworld-agents/agent-ledger.mjs`).** Simulator-first rung for "every hive node is an agent": node-shaped agent accounts (`arcade-room:*`, `city-room:*`, `cabinet:sha256:*` — person-shaped ids REJECTED), bounded non-cash ticket mints/transfers on a canonical-fold event log (reorder/dup-convergent), AE invariants fold-enforced (conservation, no-negative, mint/transfer caps, one-transfer-per-round, closed memos, NO cash-out kind), and Rung-1 block-collective recognition rollup (per-player attribution stays deferred per ADR-009). **Imported by nothing in production**; added to `FORBIDDEN_UPLOAD_PREFIXES` (with `arcade/virtual-arcade/`) so it can never ride the curated upload.

**Consequences.** W-5…W-8 remain gated (operator authorization / sim evidence / CF-7 gate / counsel). Validation: 656 arcade + 169 creator unit tests green (29 new); new browser smokes world-map (17), district-editor (14), arcade-builder (15) green; district/activity/events/block-editor/map-viewer regression smokes green; curated-upload guard green at 245 files. Local-only; not committed/pushed/deployed.

## ADR-040 — Phase 9: economy doctrine & anti-extraction preflight (doctrine-only) (2026-06-07)

**Context.** ADR-024 §4 has deferred all economy/ownership "until a future charter ADR states exactly how, behind legal/safety gates"; no such ADR existed. Phase 9 writes that boundary as doctrine (it is not that future ADR). It also corrects an earlier "nothing is built / session-scoped" framing: a non-cash, capped arcade loop already ships across six modules (`tickets.mjs`, `round-authority.mjs`, `ledger.mjs`, `catalog.mjs`, `prize-authority.mjs`, `achievements.mjs`, `challenges.mjs`) on a minors-facing platform, and its `balances`/`inventory`/`ledger`/`achievements` state is **DO-durable and keyed to a localStorage-stable, client-supplied playerId** (persists across sessions, cleared only by `/admin/reset`) — i.e. cross-session and client-id-keyed, NOT "session-bound." It must be reconciled, not ignored or minimized.

**Decision.** Adopt an anti-extraction economy doctrine and **build nothing yet** (`docs/PHASE_9_ECONOMY_DOCTRINE_PLAN.md`). Any future loop is block-collective and non-cash only (per-player attribution stays deferred per ADR-009), built on block-collective Host Rank/stewardship primitives — NOT on the shipped per-player ledger/badge/challenge substrate; per-host capacity, reputation-ranked discovery, and per-person reputation are deleted as drift seams. Anti-extraction rules AE-1…AE-13 are testable (structural-absence vs populated-sim): AE-6 names the persisted spendable balance as the most stored-value-like field and rules it never-convertible/never-transferable/never-aggregated (G-MONEY/G-SEC); AE-8 corrects the un-deduplicated `city-host-rank.mjs:68` scorer; AE-9/AE-10/AE-11/AE-12/AE-13 add no-soft-dependency, reputation-neutral discovery, no-identity-keying, decay-never-loss, and casual-first-class. The hive-hosting invariant ("the city is carried by everyone; no one owns its truth") is named with a read-replica/DO-sole-writer rule. The threat model adds endpoint-flood/rate-limit (global "rate-limiting on all endpoints" rule) and balance/badge persistence-reuse rows. Legal gates are open questions for counsel governing the existing loop and any future one, adding blocking G-CSAM and G-UGC/DMCA gates (CF-8 at `arcade/creator/moderation/review-queue.mjs` provides neither), decoupling G-GAMBLING from the label-only regex, elevating G-MINORS to a present question over persisted child-facing badges/balance, and routing the persisted balance + localStorage identity to G-MONEY/G-SEC/G-PRIVACY/G-KYC. New rung 9A.5 reconciles all six modules, the persisted balance, the per-player badges/challenges, the client-id keying, and the rate-limit posture; 9B (off-repo lab simulator) is separately authorized behind a fidelity gate; all economic surfaces stay gated behind simulator-first + counsel + a future ADR.

**Consequences.** Doctrine recorded; no economy built or designed; existing non-cash loop fully named (six modules), correctly characterized as DO-durable + client-id-keyed (not "session-bound"), and queued for counsel review. `LIVE_WORLD_LOADER_ENABLED` stays false; CF-7 not enabled; no economy/ownership/rent/paid hosting/accounts/marketplace/payout/token/NFT/transfer/cash-out/convertible-balance/per-host-capacity/per-person-reputation; no production; no new DO/migration; HiveWorld untouched. Prose forbidden list stays a superset of `FORBIDDEN_TERMS_RE`; no regex/upload-prefix exception. Adversarial critic: zero exclusion violations. PLAN/DOCTRINE-ONLY; local-only; not deployed. See `docs/PHASE_9_ECONOMY_DOCTRINE_PLAN.md`.

## ADR-039 — Phase 8C-3: per-block event/activity voice flavor (display-only client overlay) (2026-06-07)

**Context.** 8C v1 (ADR-037) gave blocks identity + a traversal goal; 8C-2 (ADR-038) made the topology
legible. The next value is making the city feel alive through the surfaces players already read — the
district event card and the activity board — giving each block, especially Garden/Nexus, its own tone.
Operator's call: voice before objectives (OBJ-2…OBJ-5), so the city's voice settles before any "things to
do" risk drifting toward reward mechanics. Per the plan §2.

**Decision.** Implement per-block **voice** flavor, display-only, as a **client-side overlay**. Key
constraint discovered: `city-district-events.mjs` is **Worker-bundled** (the server authors the event
snapshot), so to keep the Worker byte-identical the server event label/summary is left untouched and the
voice is rendered *alongside* it. New client-only pure `arcade/city/city-district-flavor.mjs`:
`BLOCK_VOICE` (a standing per-block tone for the activity board) + `EVENT_VOICE` (per-block, per-event-type
tone for the event card, type-specific → block default → ''), `blockVoice()`, `eventVoiceLine()`,
`voiceIsClean()`. Wired into `city-scene.js renderDistrict()`: a `dist-event-voice` line under the
server-authored event summary, and a `dist-act-voice` line (the current block's tone) on the activity
board. Garden/Nexus carry corridor-specific tone so the new path has character.

**Consequences.** New `city-district-flavor.mjs` + `tests/arcade/city-district-flavor.test.mjs`; edited
`city-scene.js`, `city.css`, `city-district.spec.mjs` (+3 checks). **Zero Worker/DO/schema change** — the
flavor module is client-only (not imported by any Worker source), `city-district-events.mjs` is
**unchanged**, Worker dry-run **byte-identical (202.01 KiB)**, `SCHEMA_VERSION` stays 8, no wire field; the
overlay never mutates the server `cityEvent.summary/label`. All 36 voice strings pass the canonical
FORBIDDEN_RE + the panel guard + the `VOICE_LINE_MAX=72` bound; rendered via `textContent` (injection-safe);
fallback-safe (unknown block/type → ''). `LIVE_WORLD_LOADER_ENABLED` **stays false**; no economy/ownership/
rewards/tokens/objectives-that-grant-value; no CF-7; no package-backed districts; no production; HiveWorld
untouched. Validation: 627 arcade unit (+5) + 50-check district smoke (board voice + event-card voice +
no-reward-vocab) + 169 creator + production-config + size PASS. Adversarial review APPROVE (0 CRITICAL/HIGH/
MEDIUM; 1 LOW — duplicate "runs hot" opener differentiated for Nexus). Deferred: objectives OBJ-2…OBJ-5.
Local-only; not deployed. Closes the planned 8C content arc (identity → readability → voice); next step is
an 8C RC + staging proof of the whole content/readability arc.

## ADR-038 — Phase 8C-2: district-graph + route readability (display-only) (2026-06-07)

**Context.** ADR-037's 8C content v1 gave blocks identity + a traversal goal (the District Tour), which
asks players to understand the six-block route structure. The next-highest-value slice is making the
topology itself legible — the original ring, the new Garden⇄Nexus corridor, the Nexus pivot, and the
adjacent-only rule — so movement is informed. Operator's call: map readability before event/activity
"voice", because it supports every later content slice. Per the plan §4 (Polish 2/4/5).

**Decision.** Implement **route readability**, strictly **display-only**, over the public manifest the
client already holds:
1. New pure `arcade/city/city-district-graph.mjs`: `corridorOf()` (classifies an edge ring/new/null from
   static RING/NEW edge-sets matching the real ADJACENCY), `groupAdjacentByCorridor()` (panel grouping;
   its ring+new union exactly equals each block's adjacency — falsifier #1), and `districtGraphModel()`
   (a fixed-layout six-node graph model with current/adjacent/incident flags).
2. Client `renderDistrict()`: a **DISTRICT MAP** SVG inset (six nodes + the two corridors visually
   distinguished — ring solid cyan, new corridor magenta dashed — current block highlighted, adjacent
   nodes emphasized so the directly-routable edges read at a glance); adjacency **grouped by corridor**
   (Ring vs New corridor) with a "YOU ARE HERE" affordance; route-status names the corridor being
   traversed (Travel click + onRouteResult). Semantic node coloring (current/adjacent/other) — a clean
   design decision that sidesteps the plan's unresolved theme→hex open item (O-2).

**Consequences.** New `city-district-graph.mjs` + `tests/arcade/city-district-graph.test.mjs`; edited
`city-scene.js`, `city.css`, `city-district.spec.mjs` (+7 checks). **Adjacent-only routing authority is
untouched** — each Travel still calls the identical `net.requestRoute`, server `validateRouteRequest`
stays the only gate; the grouping/graph add no route target. **Zero Worker/DO/schema change** — the new
module is client-only (not imported by any Worker source), Worker dry-run **byte-identical (202.01 KiB)**,
`SCHEMA_VERSION` stays 8, no `blockPublicSummary` field. `LIVE_WORLD_LOADER_ENABLED` **stays false**; no
economy/ownership/rewards/tokens; no CF-7; no package-backed districts; no production; HiveWorld
untouched. SVG built via `createElementNS`/`textContent` (injection-safe), reduced-motion-safe, degrades
to empty on a garbage manifest. Validation: 622 arcade unit (+5: classifier-vs-real-adjacency equality,
6-node/7-edge model, flags, empty-safe) + 47-check district smoke (graph 6 nodes/7 edges, 3 distinguished
new-corridor edges, current highlighted, corridor grouping, YOU ARE HERE) + 169 creator + production-
config + size PASS. Adversarial review APPROVE (0 CRITICAL/HIGH/MEDIUM; 2 LOW — fallback comment folded,
always-visible-vs-collapsible noted as a benign spec deviation that still meets the "separate inset"
intent). Deferred to later 8C slices: event/activity "voice" flavor, OBJ-2…OBJ-5. Local-only; not deployed.

## ADR-037 — Phase 8C content pass v1: per-block identity + District Tour (display-only) (2026-06-07)

**Context.** ADR-036's 8C plan set the content-depth direction (make the six-block district worth
exploring using only existing systems, static/display, zero authority change). This is the first
implementation increment, landing the plan's highest-value, lowest-risk surfaces.

**Decision.** Implement **per-block display identity + the non-reward District Tour** per the plan's §1 /
§3 (OBJ-1) / §4 (Polish 1), strictly **display-only**:
1. New pure `arcade/city/city-block-identity.mjs`: a frozen `BLOCK_IDENTITY` (per-block `tagline` +
   `why_visit`, all six blocks, copy consistent with the existing labels/theme), `blockIdentity()`
   (fallback-safe + immutable), `identityCopyIsClean()`, and `tourProgress()` (District Tour OBJ-1 —
   counts known blocks seen out of `CITY_IDS.length`, auto-scaling).
2. Client `arcade/city/city-scene.js` `renderDistrict()`: current-block tagline subtitle; a
   **session-local, non-reward** "District Tour · N/6 blocks seen" line (a module `Set` filled from the
   blocks the session visits — resets on reload, written to no DO/account/ledger, grants nothing,
   reaching 6/6 structurally requires both corridors); per-adjacent-row `why_visit` affordance + a "why go
   there" Travel-button `aria-label`. Plus 3 display CSS classes.
3. Exported the canonical `FORBIDDEN_RE` from `city-interactions.mjs` (additive) so content copy + tests
   screen against one source of truth (plan O-7).

**Consequences.** New `city-block-identity.mjs` + `tests/arcade/city-block-identity.test.mjs`; edited
`city-scene.js`, `city.css`, `city-interactions.mjs` (export only), `city-district.spec.mjs` (+6 content
checks). **Zero Worker/DO/schema change** — Worker dry-run **byte-identical to 8A (202.01 KiB)**,
`SCHEMA_VERSION` stays 8, no `blockPublicSummary` field, no new wire message; `city-block-identity.mjs` is
client-only. `LIVE_WORLD_LOADER_ENABLED` **stays false**; **no economy/ownership/rent/accounts/marketplace
/rewards/payouts/tokens/NFTs** (all identity copy passes the canonical FORBIDDEN_RE + length bounds; the
Tour grants nothing); no CF-7; no package-backed districts; no production; HiveWorld untouched. Validation:
617 arcade unit (+5) + 169 creator + 40-check district browser smoke (tagline + Tour 1/6→3/6 progression +
why-go-there + aria-label + no-reward-vocab) + 14-check interactions smoke + production-config PASS +
GTA-80 size PASS. Adversarial review APPROVE (0 CRITICAL/HIGH/MEDIUM; 1 LOW CSS cue folded). Deferred to
8C follow-ups (named, not built): §2 per-block event/activity "voice" flavor, OBJ-2…OBJ-5, minimap
district-graph (§4 Polish 4). Local-only; not deployed.

## ADR-036 — Phase 8C District Content Depth Plan (PLAN ONLY; static/display; live loader stays closed) (2026-06-07)

**Context.** Phase 8A (ADR-035) proved the city scales **structurally** (six blocks, richer adjacency, a
new corridor, staging-proven). Structural scale is not reasons to move: Garden, Nexus, and the new
corridor are real on the map but have no character. The operator's call was to make the six-block city
worth exploring **before** any more infrastructure — not 8B (partial-manifest; the measured B=6 manifest
is 6.9× under the socket norm so the trigger isn't real yet) and not CF-7 staging (no package-backed
use case exists).

**Decision.** Author `docs/PHASE_8C_DISTRICT_CONTENT_DEPTH.md` — **PLAN ONLY, no code** — produced by a
grounded multi-agent workflow (4 content-system mappers → 7 design + adversarial-verify pipelines →
completeness critic; 19 agents) so every hook is anchored to a real system. Make the six-block district
feel intentional using **only existing kernel systems**, **static config + display-only client
derivation**, **zero Worker/DO authority change** by default. Covers all nine required items: per-block
identity / "why go there" for all six (esp. Garden + Nexus); static labels / landmark flavor;
**non-reward** objectives (built on Phase 7A interaction zones, Phase 7E receipts, non-cash Block Trial /
Host Rank — display/acknowledge only, grant **nothing** economic); district-event + activity-board flavor
at the existing public-safe choke points (within `ACTIVITY_FEED_MAX`/`ANNOUNCE_MAX`); route/readability
polish for the graph + corridor (district panel, minimap, travel affordances); a static-config-vs-
authority-change line (default zero server change; the one tricky surface — trial context copy — resolved
to client render-time lookup, not a payload change); cross-device smoke matrix updates with a
forbidden-vocabulary guard; plus open items to confirm at build time.

**Consequences.** New `docs/PHASE_8C_DISTRICT_CONTENT_DEPTH.md` + this ADR. **No code, no Worker/DO change,
no deploy, no migration.** `LIVE_WORLD_LOADER_ENABLED` **stays false**; **no economy, ownership, rent,
paid hosting, accounts, marketplace, rewards, payouts, tokens, NFTs, transfer, or cash-out**; no CF-7
enablement; no package-backed districts; no production; HiveWorld untouched. Adversarial critic: all 9
items covered, **zero exclusion violations**, **zero unjustified authority changes**. The post-plan fork:
**A — IMPLEMENT PHASE 8C** (the content pass: static/display, no server change) vs the still-parked **8B**
(only when B approaches 9/12 or manifest pressure is measured) and **CF-7 staging** (only when a real
package-backed candidate exists). Local-only; not deployed.

## ADR-035 — Phase 8A: six-block district (static config; live loader stays closed) (2026-06-07)

**Context.** ADR-034's Phase 8 plan set the 8A baseline: scale the SINGLE district from 4 blocks toward
≤9 as **static config**, geometry byte-identical, touching only `city-block.mjs` + `city-district.mjs`
(+ stewardship identity) + tests — not the Worker, not CF-* files, not the live loader. The plan's §5
falsifier warned the partial-manifest strategy must land before the broadcast payload gets too large, so
the first increment should stay conservatively under that edge.

**Decision.** Implement the first 8A increment: grow the district **4 → 6 blocks** (add `nexus-05` +
`garden-06`) as static config. Adjacency is rewritten to a 6-node graph that **preserves every Phase 6D
edge** (downtown↔harbor, downtown↔foundry, harbor↔skyline, skyline↔foundry — no route regresses) and
adds a connected cross-path `downtown ⇄ garden ⇄ nexus ⇄ skyline`, giving downtown & skyline degree 3
while keeping them mutually non-adjacent. Each new block gets full per-block identity (display_name,
theme, landmark labels, default steward style from the closed allowlist) over **byte-identical** shared
geometry — the Phase 5B model. `B = 6` is chosen (not the §1c ceiling of 9) to stay well under the
unmeasured manifest-byte budget; the actual payload was measured to validate headroom.

**Consequences.** Changed `arcade/city/city-block.mjs` (CITY_ROOMS/BLOCK_LABELS +2),
`arcade/city/city-district.mjs` (6-node ADJACENCY), `arcade/city/city-stewardship.mjs`
(BLOCK_DEFAULT_STYLES +2), + tests. **No Worker/DO/migration change**, **no CF-* change**
(`creator-tokens.mjs` TARGET_CITY_IDS untouched — new blocks aren't creator targets yet),
`LIVE_WORLD_LOADER_ENABLED` **stays false**, no production, no economy/ownership/accounts/marketplace,
HiveWorld untouched. The Worker bundle grows 200.81 → 202.01 KiB (the static config it bundles — **not**
byte-identical, expected). Measured: district manifest worst-case **1590 bytes at B=6** (~265 B/block),
projected ~2385 B at B=9 — **6.9× under** a 16 KiB socket-message norm, so the §5 "payload too large at
B=9" falsifier is **not** triggered and static broadcast-all holds. Validation: 612 arcade unit (+4:
6-block roster, new edges/corridor, label/style identity) + 34-check district browser smoke (six blocks,
Garden corridor renders, Nexus correctly not offered, public-safe) + 169 creator + production-config PASS
+ GTA-80 size PASS. Adversarial review: APPROVE, zero CRITICAL/HIGH/MEDIUM. Cross-district routing (D>1)
and package-backed district data remain deferred (8B / later gated). Local-only; not deployed.

## ADR-034 — Phase 8 District Scale Plan (PLAN ONLY; live loader stays closed) (2026-06-07)

**Context.** Phase 7 shipped the city gameplay kernel (7B/7A/7E, staging-proven) and the creator pipeline
is complete CF-1→CF-8, with CF-7 (the operator-approved live loader) existing as a closed, disabled
machine (ADR-033). The roadmap puts the creator/live-loader trust boundary BEFORE city scale. With that
boundary now a machine rather than a concept, city-scale expansion can be designed around a real gate.
The operator's call: do **not** enable CF-7 staging yet (that is an operational/security gate needing a
real package candidate + staging env + persisted epoch source); plan Phase 8 first.

**Decision.** Author `docs/PHASE_8_DISTRICT_SCALE_PLAN.md` — **PLAN ONLY, no code, no deploy** — produced
by a grounded multi-agent workflow (4 subsystem mappers → 7 design+adversarial-verify pipelines →
completeness critic; 19 agents) so every threshold is anchored to the real code. Framing kept cold:
*scale the city around the proven kernel and closed creator trust boundary* — not a decentralized/hosting
economy, not live UGC. The plan covers all 13 required items: scale topology (D districts × B blocks,
CityRoom `idFromName(cityId)` naming, CityRegistry limits + explicit sharding triggers); presence
interest-management trigger; CF-5 asset packs → district composition + asset-pack bounds for larger maps +
an explicit **static-config vs approved-package-data** table; the **deferred** staging-candidate path via
CF-7 (designed, NOT enabled) + operator workflow; rollback/kill-switch for (future) package-backed
districts (fail-closed to static config, CF-7 kill-switch, monotonic-epoch revocation); performance +
GTA-80 budget impact + cross-device smoke matrix; open measurements (with protocols) + items deferred to
Phase 8B (cross-district routing for D>1, the S12 mobile city spec). Default for every 8A tier is **static
config**; package-backed districts are a later, gated possibility.

**Consequences.** New `docs/PHASE_8_DISTRICT_SCALE_PLAN.md` + this ADR. **No code, no Worker/DO change, no
deploy, no migration.** `LIVE_WORLD_LOADER_ENABLED` **stays false** and CF-7 is **not** enabled anywhere
in the plan; no production, no public upload, no auto-load in 8A; **no economy, ownership, rent, paid
hosting, accounts, marketplace, payout, token, NFT, transfer, or cash-out**; HiveWorld untouched.
Adversarial critic: all 13 items covered, **zero boundary violations**. The post-plan fork is the
operator's next gate: **A — IMPLEMENT PHASE 8A** (static/config city scale, no live package load) or
**B — ENABLE CF-7 STAGING** (one controlled approved package into staging, only once 8A has a real
package-loading use case + a persisted epoch source + a staging env + an explicit operator decision).

## ADR-033 — Creator Foundation CF-7: operator-approved live loader, SHIPPED DISABLED (2026-06-07)

**Context.** CF-8 (ADR-032) built the human-review gate the live loader depends on. CF-7 is the trust
boundary that decides whether an approved creator package could ever enter the live world — the gate that
determines whether Phase 8 (city scale) can admit creator content. The right move is to **build the
dangerous gate as a closed, testable machine and prove it rejects by default**, then design Phase 8
around a real boundary, rather than flip a live loader on faith.

**Decision.**
1. **Shipped disabled, one shared gate.** `loadLivePackage` imports the **same** `LIVE_WORLD_LOADER_ENABLED`
   constant the CF-2 loader defines (one source of truth, still **false**) and checks it **before any
   binding work**. A fully-valid, fully-approved chain still rejects with `live_world_loader_not_enabled`.
   The inner gates are exercised in tests via a TEST-ONLY `enabled` parameter — the shipped constant is
   never flipped. The CF-2 local-preview path stays byte-frozen; CF-7 is a parallel live track.
2. **Closed machine, deny-by-default, fail-closed first.** Order: (0) kill-switch must be the exact
   off-sentinel `false` (F5); (1) loader enabled; (2) package survives a JSON round-trip — rejects
   `undefined`/NaN to kill the canonical-elision collision (F2); (3) live receipt valid, **wrong kind
   fails fast** (F7); (4) re-validate the package body at load time; (5) recomputed hash binds the
   receipt; (6) **binding resolution** — the CF-2 local receipt, CF-6 verdict, and CF-8 record are each
   re-resolved now, recomputed, and required to hash-match + cover this package, with `free_text_digest`
   + `review_id` matching (F1, F3); (7) hash-sealed live registry lists this hash as eligible (not
   revoked, not expired) pointing at this `live_approval_id` (F6); (8) registry `revocation_epoch` >=
   highest seen — no rollback resurrects a revoke (F4); (9) `staging_verified` fast-fail (F9).
3. **Separate live artifacts.** New `creator_live_approval_receipt` (the only receipt-layer artifact that
   carries `live_world_authorized: true`, **derived** from a real CF-8 candidate — never an input) and
   `creator_approved_live_packages` registry (monotonic epoch + per-entry revoke/TTL). CF-2's local
   receipt/registry keep forbidding a true value entirely.

**Consequences.** New `arcade/creator/approval/{live-approval-receipt,live-registry,live-loader,
live-loader-cli}.mjs` + `tests/creator/live-loader.test.mjs` + this doc. **No Worker/DO change** (dry-run
byte-identical 200.81 KiB); `LIVE_WORLD_LOADER_ENABLED` **remains false**; no live load, no production, no
public upload, no auto-approval, no economy/ownership/accounts/marketplace; no Phase 8; HiveWorld
untouched. Validation: 18 adversarial unit (shipped-disabled rejects a perfect chain; tamper/digest/
epoch/binding/kind/kill-switch/expiry/revoke/not-registered/JSON-elision all fail) + operator boundary
CLI (exit 0) + creator + 608 arcade unit + curated-upload exclusion + production-config PASS + size within
budget. Local-only; not deployed. Detail: `docs/CREATOR_FOUNDATION_CF7_LIVE_LOADER.md`.

## ADR-032 — Creator Foundation CF-8: human-review queue + moderation/audit (zero live authority) (2026-06-07)

**Context.** The CF-7/CF-8 plan (ADR-031) makes the live loader depend on a human-review gate: a CF-6
verdict is not approval, and free-text fields (`display_name`/`package_id`/`operator_note`) need human
screening for slurs/harassment/impersonation/PII before any live approval. CF-8 builds that human safety
layer **before** CF-7 — granting zero live authority.

**Decision.**
1. **Review queue + 5-state lifecycle (deny-by-default).** New pure `arcade/creator/moderation/
   review-queue.mjs`: states `pending → needs_changes | rejected | approved_for_live_candidate → revoked`.
   `approved_for_live_candidate` is a human **recommendation**, NOT live authorization — `live_world_
   authorized` is hard-coded **false** on every record (never an input); no loader is touched; nothing is
   auto-promoted; the queue is bounded.
2. **Mandatory free-text review gate.** A package becomes a live candidate only via a human decision with
   `free_text_reviewed:true` + `free_text_cleared:true` + all required criteria (profanity/slurs/
   harassment/impersonation/pii); the exact screened strings are stored (plan F3). Each record is
   hash-bound to `package_hash` + the CF-2 `receipt_hash` + the `validator_report_hash`.
3. **Append-only, hash-chained audit + revocation.** Every submit/decide/revoke appends a tamper-evident,
   chained audit entry (`verifyAudit` detects edits/reorders; plan F6); revocation is recorded and
   irreversible without a fresh review. `isLiveCandidate`/`isLiveCandidateHash` report candidacy, never
   live authority.
4. **Quarantine + isolation.** The module imports ONLY the hash util — no approved-loader, no live
   registry, no Worker/DO; it exposes no live-authority/loader/mint method. Local operator tooling under
   `arcade/creator/**` (excluded from curated upload). Plus a `review-cli.mjs` reference flow.

**Consequences.** New `arcade/creator/moderation/{review-queue,review-cli}.mjs` +
`tests/creator/review-queue.test.mjs` + this doc. **No Worker/DO change** (dry-run byte-identical
200.81 KiB); `LIVE_WORLD_LOADER_ENABLED` **remains false**; no live loader, no production, no public
upload, no auto-approval, no economy/ownership/rent/accounts/marketplace. Validation: 147 creator unit
(136 + 11: unreviewed/revoked never candidates, CF-6 verdict ≠ approval, free-text gate, zero live
authority, append-only/hash-chained audit, deny-by-default) + CLI reference flow + 608 arcade unit +
curated-upload exclusion + production-config PASS + size within budget. Local-only; not deployed.
Detail: `docs/CREATOR_FOUNDATION_CF8_REVIEW_QUEUE.md`.

## ADR-031 — Creator Foundation CF-7/CF-8: live-loader + human-review gate (PLAN ONLY) (2026-06-07)

**Context.** Before any Phase 8 city-scale work, the program needs a written **live-loader threat model**
so map scale is built around a known trust boundary, not a guessed one. CF-7 is the first time a
player-authored package could render in the **live world** — the most dangerous gate — and CF-8 (human
review) must exist before the first live approval. This ADR records the PLAN; it changes no behavior.

**Decision (design, not implementation).**
1. **Parallel, additionally-gated LIVE track; the CF-2 local boundary stays byte-frozen.** New
   `creator_live_approval_receipt` + `creator_approved_live_packages` registry + a single live loader
   path carry `live_world_authorized:true`; the CF-2 local receipt/registry validators are **unchanged**
   and keep rejecting `true`. `live_world_authorized:true` is honored ONLY by the new live validators,
   only when the hash is in the live registry (`operator_approved_live`, not revoked/expired), the live
   receipt binds the package + the CF-2 local receipt + the CF-6 verdict + a **valid CF-8 human-review
   block**, the package **re-validates at load**, `staging_verified` is true, and the runtime
   **kill-switch** is off. `live_world_authorized` is **derived, never an input**.
2. **Hash-bound + tamper-evident throughout** (load-time hash recompute; `receipt_hash` + `registry_hash`).
   **Revocation** (per-package `revoked` + TTL `expires_at`) and a **runtime kill-switch** (deny-all,
   no redeploy) provide rollback; default-deny on any error.
3. **CF-8 before CF-7's first live approval.** A deny-by-default human-review queue; only an `approve_live`
   decision can mint a live approval; reviewers MUST screen the free-text fields (`display_name`/
   `package_id`/`operator_note`) for profanity/slurs/harassment/impersonation/PII (the deny-regex is
   syntactic only). A **CF-6 verdict is NOT live authorization**.
4. **Staging-only proof before production**; production live load is a separate, explicitly-authorized
   gate. Threat model covers: malicious package, stale-approval replay, reviewer compromise, hash-collision
   assumption, moderation bypass, registry poisoning, loader bypass — each with a stated mitigation.
   Acceptance tests are defined up front. **No economy/ownership/rent/accounts/marketplace/payout/token/
   NFT/transfer/cash-out.**

**Consequences.** New `docs/CREATOR_FOUNDATION_CF7_CF8_LIVE_LOADER_PLAN.md` + this ADR. **Plan-only:** no
code, no loader enablement, no deploy, no Phase 8; `LIVE_WORLD_LOADER_ENABLED` **remains false**.
Implementation is gated: `AUTHORIZED: IMPLEMENT CF-8` → `AUTHORIZED: IMPLEMENT CF-7` (shipped disabled,
staging-only) → staging proof → a separate production gate. Detail:
`docs/CREATOR_FOUNDATION_CF7_CF8_LIVE_LOADER_PLAN.md`.

## ADR-030 — Creator Foundation CF-5: tiled-map / asset-pack workflow (2026-06-07)

**Context.** The bridge between "we can validate/approve packages" and "we can later build bigger
districts." CF-5 composes multiple ALREADY-APPROVED, hash-addressed block packages into a LOCAL
tiled-isometric map — with no live-world reach.

**Decision.**
1. **Approved-hash-only composition.** New `city_asset_pack` schema + `validateAssetPack(pack, registry)`:
   a bounded grid (cols/rows ≤ 8, ≤ 32 unique in-grid tiles, ≤ 8 KiB) whose every tile references a
   package **by canonical hash** that MUST be approved-local in the CF-2 registry
   (`resolveApprovedPackage`), kinds matching. No package bodies, no URLs, no external assets; deny-by-
   default (reuses `scanSafety`/`FORBIDDEN_TERMS_RE`). An empty/invalid registry approves nothing.
2. **Hash-verified resolve.** `resolveAssetPack(pack, registry, packageStore)` returns renderable tiles
   only for approved hashes whose body's recomputed canonical hash matches (tamper check) and kind agrees.
3. **Local data-only viewer.** `arcade/creator/map-viewer/` loads a pack + approved registry + local
   package store and renders the composition with the EXISTING `drawBlock`/`drawLayeredBlock` renderers —
   rendering approved package DATA, never executing package code (no sandbox needed), no submit/upload/
   live, strict CSP. An unapproved hash → BLOCKED, empty canvas.

**Consequences.** New `arcade/creator/schemas/asset-pack-schema.mjs` + `validator/validate-asset-pack.mjs`
+ `map-viewer/**` + `samples/sample-asset-pack/{pack,registry}.json` + `tests/creator/
asset-pack-validator.test.mjs` + `map-viewer.spec.mjs` + `run-map-viewer.sh` + this doc. Local creator
tooling under `arcade/creator/**` (excluded from curated upload — verified). **No Worker/DO change**
(dry-run byte-identical 200.81 KiB), no live-world load, no public upload, no economy/ownership/rent/
accounts/marketplace. Validation: 136 creator unit (126 + 10) + 8-check map-viewer browser smoke (render
approved tiles + BLOCK unapproved hash + no off-host network) + 608 arcade unit + curated-upload exclusion
+ production-config PASS + size within budget. Local-only; not deployed.
Detail: `docs/CREATOR_FOUNDATION_CF5_ASSET_PACK.md`.

## ADR-029 — Creator Foundation CF-6: Hive validation service prototype (2026-06-07)

**Context.** CF-2 made a single operator's static approved-registry real. CF-6 turns *validation* into
something **service-shaped** — accept a package, run the canonical validators, emit a hash-bound verdict,
keep a queue, answer read-only lookups — while granting **zero live trust**. The seed of future
distributed validation, not distributed authority (charter §15).

**Decision.**
1. **Pure service core reusing the CLI's validators.** `arcade/creator/hive-validation/hive-service.mjs`
   dispatches `package_kind` → the SAME `validateBlockPackage`/`validateBlockLayeredPackage`/
   `validateArcadePackage` the CLI uses, so the verdict is **equivalent to the CLI by construction**
   (locked by tests). `createHiveService()` exposes only `submit` / `lookup` / `queue`.
2. **Hash-bound Hive receipt.** "This exact package hash got this exact validator verdict" —
   `{ package_hash, validator_version, verdict, ..., receipt_hash }` (hash over the body, tamper-evident).
   **Not** approval, **not** live authorization, **not** content clearance.
3. **Quarantine (security control).** Hard invariants forced regardless of package claims:
   `status='local_validation_only'`, `live_world_authorized=false`, `content_cleared=false`. The module
   imports ONLY the validators + hash util — **no** approved-loader, **no** registry mutator, **no**
   Worker/DO — and exposes **no** approve/enable-live/register/publish method. A package claiming
   `live_world_authorized:true` is recorded false (and rejected as an unknown key).
4. **CLI-first, no network.** `hive-cli.mjs` is a local harness; no HTTP server, no live write. A
   localhost-only HTTP wrapper is documented as a future option, not built (zero exposed surface).

**Consequences.** New `arcade/creator/hive-validation/{hive-service,hive-cli}.mjs` +
`tests/creator/hive-validation.test.mjs` + this doc. Local creator tooling under `arcade/creator/**`
(excluded from curated upload — verified). **No Worker/DO change** (dry-run byte-identical 200.81 KiB),
no production, no loader enablement, no economy/ownership/accounts. Validation: 126 creator unit (115 + 11
incl. equivalence + quarantine + tamper-detection + a 6-case adversarial suite) + CLI harness run on the
3 samples + 608 arcade unit + curated-upload exclusion + production-config PASS + size within budget.
Local-only; not deployed. Detail: `docs/CREATOR_FOUNDATION_CF6_HIVE_VALIDATION_SERVICE.md`.

## ADR-028 — Creator Foundation CF-4: arcade package importer + local sandbox (2026-06-06)

**Context.** CF-1 shipped the arcade-package schema + manifest validator + SDK template + size gate.
CF-4 adds the importer and the first **behavioral** creator surface — a LOCAL sandbox that runs an
imported package safely — without any path to the live world. Local creator tooling only.

**Decision.**
1. **Importer reuses CF-1, adds file-level + source checks.** `arcade/creator/arcade-importer/
   import-arcade-package.mjs` (pure) reuses `validateArcadePackage` and adds: entry/adapter files exist,
   no extra files (assets empty), a **code-aware static safety scan** (`SOURCE_FORBIDDEN`: network /
   storage / eval / dynamic-import / external-URL / markup / worker / serviceWorker / nav vectors +
   economy terms), constrained import specifiers (entry imports nothing; adapter imports only
   `./game.mjs`), real-total vs declared budget + 64 KiB hard cap, frame-contract → dims. The
   data-package `FORBIDDEN_CONTENT_RE` can't scan code, so CF-4 ships its own code-aware deny-list.
2. **Hardened local sandbox runner.** `arcade/creator/arcade-sandbox/` runs a package in a
   `sandbox="allow-scripts"` (null-origin) iframe with a strict CSP (`default-src 'none'` → no network;
   no `'unsafe-eval'` → no eval; `img-src data:` → no external) and a narrow postMessage frame contract
   (input in; an **untrusted** result proposal out, `server_authorized:false`). No live cabinet
   registration, no server ticket/prize/score authority, no network from the frame.
3. **Isolation + non-goals.** All under `arcade/creator/**` (excluded from the curated upload — verified).
   No Worker/DO change (dry-run byte-identical). No public upload, no live-world load, no economy/
   ownership/accounts/marketplace.

**Consequences.** New `arcade/creator/arcade-importer/**` + `arcade/creator/arcade-sandbox/**` +
`arcade/creator/samples/arcade-sample/**` + `tests/creator/arcade-importer.test.mjs` +
`tests/creator/arcade-sandbox.spec.mjs` + `run-arcade-sandbox.sh` + this doc. Validation: 113 creator
unit (101 + 12) + 13-check sandbox browser smoke (sandboxed run + blocked-package + no off-host network)
+ 608 arcade unit + curated-upload exclusion + frame-contract + block-editor regression + production-config
PASS + size within budget + Worker dry-run byte-identical (200.81 KiB). Local-only; not deployed.
Detail: `docs/CREATOR_FOUNDATION_CF4_ARCADE_IMPORTER.md`.

## ADR-027 — Neon Circuit Phase 7E: server-confirmed interaction receipts (2026-06-06)

**Context.** Phase 7A made interaction prompts legible (display only). Phase 7E closes the authority loop
— the first canonical Worker/DO protocol change of Phase 7 — so an interaction action is real only when
the server confirms it. Additive and well-scoped; no economy.

**Decision.**
1. **Additive protocol.** `city_interaction_request{action_kind, zone_id?, target_city_id?}` →
   `city_interaction_receipt{kind, receipt_id, action_kind, city_id, [zone_id|target|target_city_id],
   accepted, reason, issued_at, public_safe:true}`. `SCHEMA_VERSION` 7→8 (additive; old clients ignore it).
2. **Server authority; forged input ignored.** The server validates against the player's CANONICAL
   position + the block's zones + (for travel) adjacency. arcade_entry reuses the `enterPortal`
   position-in-zone test; block_travel reuses `validateRouteRequest` — **single source of validation
   truth**. A forged position/`accepted` in the request is ignored (only `this.state` is authoritative).
3. **Pure, parity-shared builder.** `arcade/city/city-interaction-receipts.mjs` is imported unchanged by
   the CityRoom DO and the dev-shim → byte-identical receipts.
4. **No persistence, no coupling.** Receipts are ephemeral (computed + replied, never stored). **No new
   DO, no migration** (config-check still v1–v4). No ledger; no ticket/prize/Host-Rank/Stewardship/Trial
   read or write; no balance/credit field. The proven `enterPortal`/`city_route_request` flows are
   unchanged and still work.

**Consequences.** New `arcade/city/city-interaction-receipts.mjs` + `tests/arcade/
city-interaction-receipts.{test,spec}.mjs` + `run-city-interaction-receipts.sh` +
`docs/NEON_CIRCUIT_PHASE7E_INTERACTION_RECEIPTS.md`; additive handlers in `city-room.ts` + `city-dev-shim.mjs`
(parity), client send/receive in `city-net.js` + `city-scene.js`, SCHEMA 7→8 in `city-block.mjs`. **No new
DO, no migration, no economy/ownership/accounts.** Validation: 608 arcade unit (598 + 10) + 12-check receipts
browser smoke (request → accepted/rejected; forged-position ignored) + city-authority + two-client +
frame-contract regression green + production-config PASS (v1–v4) + size 0.810 MB / 0.223 gz + Worker
dry-run compiles (200.81 KiB / 44.25 gz — a real Worker change, no migration). Local-only; not deployed.
Detail: `docs/NEON_CIRCUIT_PHASE7E_INTERACTION_RECEIPTS.md`.

## ADR-026 — Neon Circuit Phase 7A: interaction zones / action prompts (2026-06-06)

**Context.** With walkable boundaries in place (ADR-025), the city loop needs to be **legible**: a
player near a destination should see a clear action prompt. Phase 7A adds the interaction-zone kernel
layer — affordance + a server-confirmable action vocabulary — without rewards or economy.

**Decision.**
1. **Pure model `arcade/city/city-interactions.mjs`.** Allowed kinds (`arcade_entry`, `block_travel`,
   `district_event`, `activity_board`, `block_preview`) each mapped to an `action_request_type` that
   Phase 7E will server-confirm. `validateInteractionZone` is deny-by-default (rejects unknown/forbidden
   kinds, bad bounds/id, oversized or economy/ownership/gambling/crime copy, non-public-safe zones);
   `nearestInteractionZone` picks the highest-priority valid containing zone (stable tie-break);
   `actionRequestFor` emits a public-safe request shape with no private fields.
2. **A prompt authorizes nothing.** The client detects nearby zones for display only; the server stays
   the authority. The arcade-entry zone derives from the existing **server-gated portal** (`enterPortal`),
   so wiring the model to the live prompt changes no authority.
3. **No regression, no new floor content.** `deriveInteractionZones` yields an arcade_entry zone that is
   a backward-compatible **superset** of the portal object; `city-scene.js`'s `portalUnder` now resolves
   via `nearestInteractionZone` filtered to `arcade_entry`, so the existing prompt + `enterPortal(id)`
   path behaves exactly as before (city-authority regression green). Other kinds are surfaced by the
   existing district/event/activity/stewardship panels; their action_request shapes are defined for 7E.

**Consequences.** New `arcade/city/city-interactions.mjs` + `tests/arcade/city-interactions.{test,spec}.mjs`
+ `tests/arcade/run-city-interactions.sh` + `docs/NEON_CIRCUIT_PHASE7A_INTERACTIONS.md`; `city-scene.js`
prompt now model-driven + test hooks. **No Worker/DO change, no migration, no economy/ownership/accounts.**
Validation: 598 arcade unit (585 + 13) + 14-check browser smoke (model drives the live prompt) +
city-authority + city-district regression green + size 0.804 MB / 0.221 gz + Worker dry-run byte-identical
(195.09 KiB). Local-only; not deployed. Detail: `docs/NEON_CIRCUIT_PHASE7A_INTERACTIONS.md`.

## ADR-025 — Neon Circuit Phase 7B: walkable-boundary kernel layer (2026-06-06)

**Context.** The Gameplay Charter (ADR-024) made the City Gameplay Kernel the foundation gameplay
extends. Phase 7B builds its first explicit layer — walkable boundaries — without reimplementing the
collision authority that has existed since Phase 4A.

**Decision.**
1. **Compose, don't duplicate.** New pure `arcade/city/city-collision.mjs` composes the existing
   `city-block.mjs` primitives (`WORLD`, `MOVEMENT`, `isWalkable`, `resolveCollision`, `SPAWN_POINTS`)
   and adds the kernel boundary API: `isPointWalkable`, `clampToWalkable`, `segmentIntersectsBlocked`,
   `nearestSafePoint`, `safeSpawnPoint`, `safeArrivalPoint`, plus a `BLOCKED_ZONES` capability (keep-out
   rectangles distinct from solid buildings, per-block, frozen). The public API accepts a city id **or**
   an explicit zones array, so blocked-zone logic is fully fixture-testable.
2. **Authority unchanged; model server-ready.** World-bounds + building collision stay
   **server-authoritative** (the DO's `predictStep` is untouched). The module is server-ready (the
   CityRoom DO may import it), but in 7B the new blocked-zone layer is client-enforced for feel and
   verified by tests; the **live `BLOCKED_ZONES` set is empty** (capability proven, not yet populated),
   so the Worker stays **byte-identical** (no migration, no live-feel change). Populating a block's zones
   later enforces consistently on server + client via the shared step. The client never becomes the
   permanent source of truth.
3. **Display guard only on the client.** `city-scene.js` snaps the *eased* avatar to a walkable point so
   it never visually clips a wall/zone during interpolation — a no-op in normal play with empty live
   zones; it wires the kernel into the render path.
4. **No combat/vehicles/navmesh.** Deterministic AABB + wall-slide only, replay-deterministic, within the
   GTA-80 size budget.

**Consequences.** New `arcade/city/city-collision.mjs` + `tests/arcade/city-collision.{test,spec}.mjs` +
`tests/arcade/run-city-collision.sh` + `docs/NEON_CIRCUIT_PHASE7B_COLLISION.md`; additive `city-scene.js`
display guard. **No Worker/DO change, no migration, no economy/ownership/accounts.** Validation: 584
arcade unit (568 + 16) + 16-check browser smoke (real move-to-wall clamp + in-browser kernel) + existing
city-authority regression green + size 0.795 MB / 0.217 gz (GTA-80 within) + Worker dry-run byte-identical
(195.09 KiB). Local-only; not deployed. Detail: `docs/NEON_CIRCUIT_PHASE7B_COLLISION.md`.

## ADR-024 — Neon Circuit city gameplay must be kernel-first, not bolt-on (2026-06-06)

**Context.** Phase 6 is live in production with real cross-device multiplayer, a four-block district,
and a server-authored event pulse; the creator foundation (CF-1/CF-2/CF-3 on `main`) is in place. The
next risk is no longer missing features — it is **architectural drift**. If "GTA-style" gameplay, block
customization, arcade-game packages, creator assets, and decentralized ("Hive") validation are added
later as bolt-ons, they create latency, security, moderation, and design debt that is expensive to undo.
A gameplay constitution is needed *before* the map grows deeper. (This charter was authored off the
pre-CF-3 `main` and given ADR-024 to avoid colliding with ADR-023; CF-3 then merged to `main` via PR #42
(`d75080d`), so this branch was rebased on top and ADR-024 sits immediately above ADR-023, below.)

**Decision.** Adopt a **gameplay charter** (this ADR's detail lives in four new docs) that fixes:
1. **"GTA-style" = camera / spatial / social city readability, not IP or content cloning.** The genre
   reference is top-down/isometric legibility (the existing "GTA-80" size-and-readability framing,
   ADR-004); GTA/APB/SimCity/RCT assets, names, maps, and signature antagonistic mechanics (crime,
   weapons, police, wanted level, vehicular violence, theft, loot, gambling) are hard non-goals.
2. **Gameplay is kernel-first.** A small **City Gameplay Kernel** (movement, collision, routing, arrival,
   presence, interaction zones, arcade entry, district events, activity feed, block trial, stewardship,
   creator preview, approved loading) is specified with explicit *client-owned-display vs.
   server-owned-truth* splits, so every future feature extends the kernel rather than working around it.
   The binding rule: **display may be predicted on the client; truth is always the server's, projected
   through an allowlist; the client never authors a canonical fact.**
3. **Creator customization requires validation before any live use.** The CF-1…CF-8 pipeline keeps
   deny-by-default, data-only closed-token packages, hash-bound approval, and `LIVE_WORLD_LOADER_ENABLED`
   closed until a deliberate, human-reviewed CF-7 (the doc's "CF-E") opens it. No open UGC, no arbitrary
   scripts/uploads, no live load without an approved-hash receipt.
4. **Gameplay expansion must preserve server authority** (`CityRoom` per-block, `CityRegistry` cross-block,
   input-intent-only protocol) and **economy/ownership remains a non-goal** (no money/crypto/marketplace/
   paid hosting/land ownership/sellable or transferable goods) until a future charter ADR states exactly
   how, behind legal/safety gates.

**Consequences.** Four new docs (`docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md`,
`docs/NEON_CIRCUIT_CITY_GAMEPLAY_KERNEL.md`, `docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md`,
`docs/NEON_CIRCUIT_PHASE7_PLAN.md`) plus this ADR. **Docs-only:** no Worker/DO/creator/test/production
code changed; no deploy; no Phase 7 implementation. Phase 7 ("City Gameplay Kernel": interaction zones,
collision/boundaries, reward-free objectives, arcade entry/return polish, server-confirmed receipts,
cross-device multiplayer proof) is scoped but gated behind `AUTHORIZED: IMPLEMENT PHASE 7A`. Recommended
order: land this charter → CF-2/CF-3 are on `main` (CF-3 via PR #42) →
Phase 7 (7B collision groundwork, then 7A interaction zones) → only then city-scale expansion.
Charter authored on `docs/neon-circuit-gameplay-charter`.

## ADR-023 — Creator Foundation CF-3: layered block customization (data-only depth on the CF-2 boundary) (2026-06-06)

**Context.** With the trust boundary built (CF-2), customization *depth* can be added safely. CF-3
introduces a richer, layered block model — the first step toward APB-level depth — without changing the
rails: closed tokens, deny-by-default, bounded sizes, original procedural visuals, no live-world load.

**Decision.**
1. **New `block_layered` kind, `block_style` frozen.** A NEW package kind composes 6 fixed-key layer
   dimensions (facade/windows/roof/lighting_zones required; sign/symbols optional) — `layers` is an
   object, not a free array, so every sub-schema is statically validatable. The flat `block_style`
   contract (CF-1/CF-2 + samples) is byte-frozen; the only edits to existing files are additive
   (append tokens, export 3 iso primitives without touching `drawBlock`, register the kind in the
   validator CLI / loader `validateByKind` / receipt `PACKAGE_KINDS`).
2. **Closed taxonomy, no free values.** ~65 new closed tokens in `creator-tokens.mjs`; colors reuse the
   CF-1 hex. `scale` is a STRING enum (not a number) — no arbitrary-value surface. Bounds: 12 KiB,
   ≤6 symbols, 1–4 unique lighting zones. 3rd constraint flag `no_live_world_load:true`.
3. **Validator-first, reuse CF-1 primitives.** `validate-block-layered-package.mjs` reuses
   `isPlainData`/`scanSafety`/`FORBIDDEN_*`; 18 ordered deny-by-default rules; covered by a 26-row
   adversarial abuse checklist (smuggling, DoS, prototype pollution, spoofed/missing/extra fields,
   numeric-scale injection, constraint downgrade) + positive control.
4. **Boundary unchanged.** `block_layered` flows through the CF-2 loader: `local_preview` loads an
   approved-local package; `live_world` is still always rejected; `live_world_authorized:true` rejected
   by receipt + registry. New layered renderer (`drawLayeredBlock`) + offline layered editor with the
   CF-2 approved-local-preview path; no submit/upload/live control; CSP. All under `arcade/creator/**`
   (curated-upload-excluded).

**Consequences.** New `block-layered-package-schema.mjs` + `validate-block-layered-package.mjs` +
`render/layered-renderer.mjs` + `layered-editor/**` + samples + `tests/creator/{block-layered-validator,
layered-renderer,layered-editor}.*` + `docs/CREATOR_FOUNDATION_CF3_LAYERED_EDITOR.md`; additive token /
iso-export / kind-registration edits. Worker/DO untouched (dry-run byte-identical). Validation: 101
creator unit (CF-1 26 + CF-2 38 + CF-3 37) + 20-check layered editor smoke + CF-1/CF-2 18-check editor
smoke green; `block_style` hash unchanged. Local-only; not pushed/deployed. No economy/ownership/
marketplace/accounts/live-world load. Detail: `docs/CREATOR_FOUNDATION_CF3_LAYERED_EDITOR.md`.

## ADR-022 — Creator Foundation CF-2: approved hash + receipt before any world loader may trust a package (2026-06-06)

**Context.** CF-1 made authoring local and produced immutable, validated, hash-addressed packages,
but stopped at local validation. Before any package can ever reach the live world, the *trust
boundary* itself must exist and be provably closed — and, now that CF-1 made `arcade/creator/**`
git-tracked, the creator tooling must not leak into the production static upload.

**Decision.**
1. **Approval is hash-bound and explicit.** A package is trusted by a loader only via (a) an
   approved-package **registry** (`approved-package-registry.mjs`) — a static, local allowlist keyed
   by canonical hash — and (b) a hash-sealed **approval receipt** (`approval-receipt.mjs`) whose
   `receipt_hash` covers its body (tamper-evident). Statuses are `local_validation_only` /
   `operator_approved_local` / `rejected`; **none** implies live authorization.
2. **The live world stays closed.** The **approved-hash loader** (`approved-loader.mjs`) loads only
   when the recomputed hash matches the receipt, the package is valid for its kind, the hash is
   registry-approved-local, and both receipt and entry say `operator_approved_local`. It has two
   modes; `live_world` is rejected **unconditionally** (`LIVE_WORLD_LOADER_ENABLED = false`, checked
   first). `live_world_authorized` is forced false everywhere — a true value is a validation error —
   so the boundary is double-locked even if a future phase flips the constant.
3. **Editor local preview only.** The block editor gains an *Approved local preview (operator)* card
   (import package + receipt → run the loader in `local_preview` → offline render + "Local preview
   only — not authorized for live world"). No submit / upload / live-world control exists.
4. **Curated upload exclusion.** `scripts/build-curated-client-upload.mjs` builds the production
   static tree from git-tracked files minus `arcade/creator/**` (and tests/docs/workers/electron/
   tooling/secrets), keeping the live client (root pages, `arcade/`, `arcade/city/`, vendored libs
   like `scripts/three.min.js`). It hard-fails if the creator tools or secrets would ship.

**Consequences.** New isolated `arcade/creator/approval/**` + `block-editor/approved-preview.mjs` +
`scripts/build-curated-client-upload.mjs` + `tests/creator/{approval-receipt,approved-package-registry,
approved-loader,curated-upload}.test.mjs` + `docs/CREATOR_FOUNDATION_CF2_APPROVED_LOADER.md`.
Worker/DO untouched (production unchanged; dry-run byte-identical). Validation: 63 creator unit tests
(26 CF-1 + 37 CF-2) + 18-check editor browser smoke (10 CF-1 + 8 CF-2) green; curated upload excludes
creator / includes city; arcade regression + production-config + city-size green. Local-only; not
pushed/deployed. No marketplace / ownership / economy / accounts / live-world load.
Detail: `docs/CREATOR_FOUNDATION_CF2_APPROVED_LOADER.md`.

## ADR-021 — Creator Foundation CF-1: local, constrained, validated, hash-addressed packages (2026-06-06)

**Context.** Before Phase 7, player-created blocks / arcade games / assets need a safety foundation
so they never become a bolted-on latency / security / moderation / file-bloat problem. (The
directive suggested "ADR-018"; that number is already Phase 6B, so this is ADR-021.)

**Decision.**
1. **Doctrine:** nothing player-authored enters the live world directly — author locally → produce an
   immutable **data-only package** → **validate locally** → only an approved, hash-addressed package
   may *later* reach the live world via a separately-gated loader. CF-1 stops at local validation.
2. **Closed allowlists, deny-by-default.** Block packages are data-only (no JS/URL/external assets);
   tokens come from a rich-but-closed vocab (`arcade/creator/schemas/creator-tokens.mjs`, lineage from
   the Phase 4F stewardship manifest). Validators reject unknown keys (never silent-drop), bound
   numbers, and deep-scan for code/markup/url/template + private keys. Arcade packages declare
   capabilities **deny-by-default** (empty allowlist), empty assets, and a strict `size_budget_bytes`
   (≤ 64 KiB) — the size limit is the creative constraint.
3. **Hash + receipt.** `package-hash.mjs` = canonical JSON + SHA-256; the report's receipt is a stub
   `{ status:"local_validation_only", live_world_authorized:false }` — never live authority.
4. **Stack:** TypeScript/Canvas + package validation. Original procedural isometric renderer
   (`iso-renderer.mjs`), offline no-submit block editor. Java is a reference only — no Java tooling added.
5. **Isolation:** all of `arcade/creator/**` is operator-local and excluded from the curated live-client
   upload until a gated loader phase. No Worker/DO/route/economy/account change.

**Consequences.** New isolated `arcade/creator/**` + `tests/creator/**` + `docs/CREATOR_FOUNDATION_CF1.md`.
Worker/DO untouched (production unchanged). Validation: 26 creator unit tests + 10-check editor browser
smoke green; block + arcade validator CLIs + arcade size gate green; arcade 568 unit + production-config
+ size + city smokes + Worker dry-run byte-identical (regression clean). Local-only; not pushed/deployed.
Detail: `docs/CREATOR_FOUNDATION_CF1.md`.

## ADR-020 — Neon Circuit Phase 6D: fourth block + non-linear district topology (2026-06-05)

**Context.** Phases 6A–6C made the district's event pulse rich and server-authored. Phase 6D proves
the district can **scale**: a fourth block (Foundry) and a **non-linear** topology — without rewriting
routing/presence/activity/event systems, and with no economy/ownership.

**Decision.**
1. **Fourth block as pure catalog config.** `city-block.mjs` adds `foundry-04` (`Foundry Block`,
   `forge-ember`) with shared byte-identical geometry + per-block labels (`FORGE STACK`/…) and a
   per-block default style (`city-stewardship.mjs`: amber arcade + magenta glow). Each block is its
   own `CityRoom` DO via `idFromName(city_id)` → **no DO class, no migration**.
2. **Ring topology, additively.** `city-district.mjs` `ADJACENCY` becomes a 4-ring
   (downtown–harbor–skyline–foundry–downtown): downtown & skyline each **gain** foundry; **harbor is
   unchanged** (`[downtown, skyline]`) and downtown↔skyline stays non-adjacent — so every Phase 5A
   route assertion and live route still holds. Non-linear: opposite corners (downtown↔skyline,
   harbor↔foundry) are non-adjacent, and downtown reaches skyline two ways (via harbor *or* foundry).
   (Rejected: the workflow's harbor↔foundry / skyline↔foundry ring — it would have changed harbor's
   neighbour set; the chosen ring is functionally equivalent and fully backward-compatible.)
3. **Everything downstream is block-agnostic.** Presence, the activity feed, and the event schedule
   iterate the manifest / `CITY_IDS`, so they pick up Foundry with no change; no `SCHEMA_VERSION` bump
   (a 4-block manifest is the same shape).

**Consequences.** Routing stays server-validated + bounded (`harbor→foundry` rejected `not_adjacent`).
No block mutates another; isolation stays structural (one DO per block). Only one prior test needed
updating (the explicit 3-block roster → 4); all adjacency/presence/route assertions passed unchanged.
The Worker bundle grew ~194.5→195.1 KiB (foundry config in the shared modules). Validation: 568 unit
(+4 ring tests) + district/presence/activity/events/stewardship smokes (incl. foundry offered +
harbor→foundry rejected) + two-client + frame + dry-run + size (≈0.783/0.212 MB gz) + config +
guardrails — all green. Detail: `docs/NEON_CIRCUIT_PHASE6D_FOURTH_BLOCK.md`.

---

## ADR-019 — Neon Circuit Phase 6C: rich district event cards + live countdown (2026-06-05)

**Context.** With the schedule server-authored (6B), Phase 6C polishes presentation: a richer,
mobile-safe event card with active/pre-roll states and a live countdown — client + CSS only, no new
server authority.

**Decision.**
1. **Pure `formatCountdown(ms)`** (`m:ss`, clamped, garbage-safe) shared by client + tests.
2. **Card render** gains a state class (`is-active`/`is-preroll`), an "ends in m:ss" meta row, and a
   next-event countdown. A separate **1 s** `updateEventCountdown()` ticker updates only the countdown
   text nodes in place (no panel rebuild — avoids per-second DOM churn); when the window's time hits 0
   it calls `pollDistrictEvents()` to flip the card + fire announcements.
3. **CSS** adds green/amber left-border accents, amber pre-roll chip, and `tabular-nums` so the timer
   doesn't jitter. The chip pulse stays gated behind `prefers-reduced-motion: no-preference`.

**Consequences.** No server message/DO/migration/route change (dry-run unchanged at 194.47/42.71 gz —
the events module the Worker imports gained only `formatCountdown`). `textContent` only; no assets,
third-party UI, telemetry, or `innerHTML`. The fast countdown carries no `aria-live` (avoids
screen-reader spam); the activity feed keeps its polite live region. Verified at a 390×844 phone
viewport; no overlap with arcade controls / route buttons / Block Trial / Stewardship. Validation: 564
unit (+2) + 28-check events smoke (card state + live ticker) + district/activity/presence regression +
size (≈0.782/0.212 MB gz) + config + guardrails — all green. Detail:
`docs/NEON_CIRCUIT_PHASE6C_EVENT_PRESENTATION.md`.

---

## ADR-018 — Neon Circuit Phase 6B: server-authored / operator-tunable district events (2026-06-05)

**Context.** Phase 6A's district event schedule was client-derived display. Phase 6B makes it
**server-authored** (a public-safe snapshot in the existing `city_blocks` payload) and
**operator-tunable** (env), so the live city's event pulse is canonical and configurable — while
staying strictly non-economic.

**Decision.**
1. **Config layer on the existing pure schedule, not a new push path.** `city-district-events.mjs`
   gains `resolveDistrictEventConfig(env)` (clamps `DISTRICT_EVENT_WINDOW_MS` to 1 min…1 hour; parses
   `DISTRICT_EVENT_{ENABLED,SHOW_NEXT}`; defaults = 6A) and `districtEventSnapshot(now, config)` (a
   public-safe `{enabled, window_ms, show_next, server_time, current, next}`). The window size is now
   a parameter threaded through `windowIndexAt/windowBounds/buildDistrictEvent/...` via an optional
   trailing arg defaulting to `WINDOW_MS`, so all 553 prior callers/tests are unchanged.
2. **Server attaches the snapshot.** CityRoom (`this.env`) and the dev-shim (`process.env`) both add
   `event: districtEventSnapshot(...)` to their two `city_blocks` sends — exact DO parity. **No new
   DO, migration, route, or message type.** (Rejected: a per-transition DO-alarm push — heavier, a
   migration risk, and unnecessary because the deterministic schedule + published config lets every
   client compute live current/next from the shared pure module.)
3. **Client adopts the config.** `adoptServerEventSnapshot` stores the server config and recomputes
   via the same pure schedule, so it stays in sync without a push; falls back to 6A defaults if the
   snapshot is absent (old server), hides the banner if `enabled:false`, suppresses "Up next" if
   `show_next:false`.

**Consequences.** Server is authoritative for the schedule config; clients only display (cannot author
canonical district facts); CityRoom/CityRegistry still own presence/route/identity. The Worker bundle
grows ~187→194 KiB (gz 40.7→42.7) because the events module is now imported server-side — expected for
server authorship (6B is a real Worker change, not byte-identical). Still display/atmosphere: no
rewards/economy/Host-Rank/Stewardship/Block-Trial change. Validation: 562 unit (+9) + 23-check events
smoke (incl. server-snapshot path) + all city/arcade regression + dry-run + size (≈0.779/0.212 MB gz)
+ config gate + guardrails — all green. `wrangler.toml` untouched (defaults safe; vars optional).
Detail: `docs/NEON_CIRCUIT_PHASE6B_DISTRICT_EVENT_AUTHORITY.md`.

---

## ADR-017 — Neon Circuit Phase 6A: scheduled district events + live announcements (2026-06-05)

**Context.** The city is LIVE in production (`clovelearn.io`, signed off 2026-06-05 by real
cross-device multiplayer; see `docs/PRODUCTION_ROLLOUT_PLAN.md`). Phase 5 made the district
*functional* (routing, identity, presence, push deltas, activity feed); Phase 6A is the first
post-launch feature: a district *pulse* so the world feels alive — a current event, a next event,
and live public announcements ("Downtown Signal Surge is active.", "Harbor Quiet Window starts
soon.") — without opening any risky system.

**Decision.**
1. **Client-derived deterministic schedule, not a server feature (Option A).** District events are a
   pure function of the wall clock + the static block manifest — every client computes the SAME
   current/next event and the SAME stable `event_id` per window. So Phase 6A adds **NO** Worker code,
   DO, migration, route, server message, or protocol field; the Worker bundle is byte-identical
   (`187.10 KiB / 40.74 KiB gz`). Old clients are unaffected; the feature needs no deploy to exist in
   code (and deploy stays separately gated). (Rejected: Option B server-derived schedule — Worker
   change + deploy + regression surface for no authority gain, since nothing canonical depends on the
   schedule.)
2. **New pure module** `arcade/city/city-district-events.mjs` — fixed `WINDOW_MS` (5 min) buckets;
   `(type, focus block)` chosen by deterministic rotation on the window index; events built through a
   field ALLOWLIST (only a static block name is interpolated; `public_safe: true`); bounded, witnessed
   ("ended" only fires for a window whose active was seen) + deduped announcements via a caller-owned
   key set (reload/reconnect recompute and cannot spam).
3. **Single allowlist choke point reused.** `city-district-activity.mjs` is extended *additively* with
   three display types (`district_event_{upcoming,active,ended}`) + labels/severity + a
   `activityForDistrictEvent` projector, so announcements flow into the existing DISTRICT ACTIVITY feed
   through the same public-safety projection as every other item.
4. **Client** renders a small, non-dominant district-event banner (current + next + a "now" chip,
   `textContent` only, CSS-only, reduced-motion safe, phone-safe) above the activity feed, polls the
   schedule on connect + a 20 s tick, and seeds announcements into the bounded feed. The 5E arrival
   seed was decoupled from feed-emptiness onto an explicit `seededArrival` flag (the feed can now carry
   an event item before the arrival).

**Consequences.** Zero server/protocol change → nothing to migrate or roll back beyond additive client
code; rollback = revert the branch. Strictly display/atmosphere: it never touches rewards, tickets,
Host Rank, Stewardship, Block Trial, prize values, or any economy (there is none). Public-safe by
construction (allowlist + fixed observational labels), proven by unit + browser tests asserting no
private data and no forbidden economy/ownership/gambling copy. Validation: 553 unit (+17 pure) + new
20-check events browser smoke + all Phase 4/5 city + arcade regression (incl. the regressed-then-fixed
5E arrival smoke) + Worker dry-run byte-identical + size (≈0.773/0.209 MB gz) + config gate +
guardrails — all green. Local-only commit on `feat/neon-circuit-phase6a-district-events`; not
pushed/merged/tagged/deployed. Detail: `docs/NEON_CIRCUIT_PHASE6A_DISTRICT_EVENTS.md`.

---

## ADR-016 — Neon Circuit Phase 5E: district activity feed + transition polish (2026-06-05)

**Context.** Phase 5D pushes public-safe district presence deltas, but the player still had to infer
*what* changed from raw counts. Phase 5E makes the multi-block district understandable: a readable
district activity feed ("Downtown became active.", "Routing to Skyline confirmed.", "Arrived in
Skyline.") + clearer cross-block transition feedback — without economy/ownership/account mechanics.

**Decision.**
1. **Client-side derivation, not a new server message.** The client already receives every underlying
   fact: `city_district_presence` deltas (5D, server-authored + public-safe), `city_route_result` (5A,
   server-validated), and `city_welcome` (arrival). A server `city_district_activity` message would be
   redundant wire traffic + new attack surface for no authority gain — activity is a display projection,
   and route/presence truth is unaffected either way. So Phase 5E adds **NO** server message, DO,
   migration, route, protocol field, or client→server activity path. (Rejected: server-authored activity
   — heavier, and unnecessary since nothing canonical reads the feed back.)
2. **New pure module** `arcade/city/city-district-activity.mjs` — `classifyBlockChange` (most-salient
   public change), `deriveActivitiesFromDelta` (vs the pre-merge manifest), route/arrival builders,
   `activityItem` (field-ALLOWLIST projection = the public-safety choke point; fails safe on unknown
   types), and `appendActivity` (newest-first, coalesces against the head by `(type, city_id)`, bounded
   to 16, no mutation). Reused by the scene + tests.
3. **Client** derives activity from the messages/Travel it already has and renders a bounded DISTRICT
   ACTIVITY sub-section inside the district panel (`textContent` only, ≤8 shown, scrollable so it never
   overflows); transition copy is clarified; a blocked route stays transient (not a feed type) and leaves
   the player in their current block. The feed is **local display history** (resets on reload, seeds one
   arrival on connect); `city_blocks` stays the authoritative snapshot; no new polling.

**Consequences.** Zero server/protocol change → old clients are unaffected and there is nothing to
migrate or roll back beyond the additive client code. Public-safe by construction (allowlist + fixed
labels; only a static display name is interpolated), proven by unit + browser tests asserting no private
data and no forbidden economy/ownership copy. Validation: 536 unit (+14 pure) + new 20-check activity
browser smoke + all Phase 4/5 city + arcade regression + Worker dry-run + size (≈0.745/0.200 MB gz) +
config + guardrails — all green. Note a pre-existing right-column panel overlap (District vs Block Trial)
can cover the Travel button; the handler is wired (the smoke fires it directly); repositioning is out of
scope. Local-only commit on `feat/neon-circuit-phase5e-district-activity-feed`; not pushed/merged/deployed.
Detail: `docs/NEON_CIRCUIT_PHASE5E_DISTRICT_ACTIVITY_FEED.md`.

---

## ADR-015 — Neon Circuit Phase 5D: push-on-change district presence (2026-06-05)

**Context.** Phase 5C made per-block population + health live, but PULL-based — the client polled
`city_blocks_request` on a ~12s timer. The product goal was to make the district feel live without
polling, and without adding any economy/account/ownership/gameplay/DO/migration.

**Decision.**
1. **Deliver over the existing CityRoom socket, not a new registry socket.** The `city_blocks`
   district manifest already flows to clients over the per-block CityRoom WebSocket, so pushing
   presence DELTAS over that same channel is the existing architecture — no new route, no new
   client-facing surface, no new DO, no new migration. The `CityRegistry` stays the DO-to-DO
   coordinator; the CityRoom stays block authority. (Rejected: a client-facing registry WebSocket —
   larger attack surface + a single DO fronting all district clients, for no extra capability here.)
2. **New pure module** `arcade/city/city-district-presence.mjs` — `districtPresenceSnapshot` (reuses
   the 5C `cityPresenceEntry` freshness policy), `diffDistrictPresence` (bounded ≤ block count,
   sorted, coalesced), `buildPresenceDelta` (re-projects through a `{city_id,population,health,
   population_is_estimated}` ALLOWLIST = the public-safety choke point), `deriveDistrictPresenceDelta`
   (returns `delta:null` when nothing changed), and client-side `mergePresenceDelta` (new manifest,
   no mutation). Shared unchanged by DO + dev-shim + tests + browser.
3. **CityRoom** calls `broadcastDistrictPresence()` after each existing `reportPresence()` refresh
   (join / leave / 30s alarm keepalive), emitting `t:"city_district_presence"` ONLY on change. The
   message is OUTBOUND-only — a client that sends it hits `default → unknown_type` (cannot inject
   presence). Dev-shim mirrors with one global delta fan-out (join/leave/sweep).
4. **Client** drops the 12s poll for a degraded-only 15s safety re-request (fires only when stale
   >45s), applies deltas via `mergePresenceDelta`, and shows a connection-based live/refresh/offline
   indicator. Additive message; no `SCHEMA_VERSION` bump (old clients ignore the unknown `t`).

**Consequences.** No new DO/migration/route/persisted state — `reportPresence` (the only DO-to-DO
hop) is unchanged; the delta is computed locally from the same `presenceCache` the manifest is, so it
can expose nothing the manifest does not. Same-block join/leave deltas are immediate; cross-block
changes surface within one 30s alarm tick (the existing keepalive cadence, deliberately not lowered —
instant cross-DO fan-out would need registry→CityRoom reverse calls, out of scope). Validation: 522
unit (+12 pure) + new push-without-polling two-client browser smoke + all Phase 4/5 city + arcade
regression + Worker dry-run (187.10/40.74 KiB gz) + size (0.744/0.200 MB gz) + config (still v1–v4) +
guardrails — all green. Local-only commit on `feat/neon-circuit-phase5d-district-presence-push`; not
pushed/merged/deployed. Detail: `docs/NEON_CIRCUIT_PHASE5D_DISTRICT_PRESENCE_PUSH.md`.

---

## ADR-014 — Neon Circuit Phase 5C: live district presence (cross-block) (2026-06-05)

**Context.** Phase 5A/5B made a district of distinct blocks, but discovery was static. Phase 5C
shows each block's LIVE population + health in discovery — the first cross-block coordination in
the city. Deferred from 5B precisely because a cross-DO path can only be proven end-to-end on real
`workerd`, and staging deploy is now in the loop (5A+5B verified on staging, Worker 7c0253ad).

**Decision.**
1. **Dedicated coordinator DO** — new `CityRegistry` (`workers/arcade/src/city-registry.ts`),
   separate from the arcade-coupled `RoomRegistry`. Stores a per-block occupancy heartbeat (a COUNT
   + a registry-stamped freshness timestamp); `POST /city-registry/heartbeat` + `GET .../presence`,
   DO-to-DO only, never client-reachable, no private data. Additive migration **v4**
   (`new_sqlite_classes:["CityRegistry"]`) + `CITY_REGISTRY` binding re-declared in all three env
   blocks; config-check asserts both. Touches no existing DO.
2. **Pure presence layer** (`city-district.mjs`) — `deriveCityHealth` + `cityPresenceEntry` reuse the
   Phase 2c freshness policy (≤30s healthy / ≤90s stale / >90s offline, population evicted = no
   ghosts); `districtManifest(currentCityId, presence)` enriches each block summary with
   `population`/`health`/`population_is_estimated`. Omitting `presence` = the 5A/5B static default
   (back-compat). Population is a PUBLIC aggregate (like RoomRegistry exposes) — not private.
3. **CityRoom** reports occupancy on join/leave/alarm + on `city_blocks_request`, caching the echoed
   map (FAIL-OPEN → static if the registry is unbound/unreachable); the dev-shim computes cross-block
   population in-process for headless parity. Client shows live "N here"; refreshes on a ~12s timer.

**Consequences.** First cross-DO path in the city, done with the proven registry/heartbeat pattern;
per-block authority + safety unchanged; arcade/`game/*`/economy untouched. Validation: 510 unit
(+ presence + updated config fixture) + new two-client cross-block presence browser smoke (downtown
sees harbor's count, drops to 0 on leave, public-safe) + all Phase 4/5 regression + Worker dry-run
(CityRegistry compiles) + size (0.735/0.197 MB gz) + config + guardrails — all green. The CityRoom↔
CityRegistry DO-to-DO wiring is unit-tested + MUST be verified on staging (deploy in the loop) — the
shim alone cannot prove it. Local-only commit on `feat/neon-circuit-phase5c-live-presence`; not
pushed/merged/deployed. Detail: `docs/NEON_CIRCUIT_PHASE5C_LIVE_DISTRICT_PRESENCE.md`.

---

## ADR-013 — Neon Circuit Phase 5B: per-block identity (display-only) (2026-06-05)

**Context.** Phase 5A made the city a district of three blocks (discovery + bounded routing), but
all blocks looked identical. Phase 5B gives each block its own visual identity so travelling the
district visibly changes the world — without touching geometry, collision, authority, or economy.

**Decision.**
1. **Per-block default style** — `defaultBlockStyle(cityId)` returns a per-block default drawn from
   the SAME closed stewardship allowlist (downtown magenta / harbor cyan / skyline amber); no/unknown
   cityId → the downtown default (every no-arg caller unchanged). A steward reset restores the
   *block's* default (the reset path threads `cityId`). Reuses the Phase 4F `applyBlockStyle` render
   path, so the accent updates on every (re)connect/travel with no renderer change.
2. **Per-block landmark labels** — `publicLayout(cityId)` overlays per-block building labels onto the
   SHARED, byte-identical geometry (so collision/spawn/portal authority is unchanged); the arcade
   building keeps its label everywhere. `welcomePayload` sends `publicLayout(cityId)`. A small
   `setLayout` on both renderers refreshes labels on travel; `city-scene.js` calls it on welcome.
3. **Cold-DO ordering** — `CityRoom.fetch` binds `boundCityId` from the route BEFORE
   `ensureInitialized()`, so a cold harbor/skyline DO seeds its OWN identity, not downtown's. The
   dev-shim already partitions by cityId. No new DO, no migration, no cross-DO coordination.

**Consequences.** Display-only: no geometry/collision/authority/economy change (a pure test asserts
per-block geometry/portals/spawns are byte-identical while labels differ). Per-block styles are
allowlist-constrained, so an identity can never carry anything off-manifest. Validation: 504 unit
(+4 identity) + district browser smoke now asserts the style+labels change across downtown→harbor→
skyline travel + all Phase 4 city/arcade regression + Worker dry-run + size (0.732 / 0.196 MB gz) +
config + guardrails — all green. Local-only commit on `feat/neon-circuit-phase5b-per-block-identity`;
not pushed/merged/deployed. Live cross-block presence deferred (needs a staging-validated cross-DO
coordinator). Detail: `docs/NEON_CIRCUIT_PHASE5B_PER_BLOCK_IDENTITY.md`.

---

## ADR-012 — Neon Circuit Phase 5A: Multi-Block District foundation (2026-06-04)

**Context.** Phases 4A–4G proved a single server-authoritative city block (merged to `main` via PR #24;
the city WebSocket handshake was corrected for the deployed Worker in PR #25, tagged `phase4-city-arc-rc2`
→ `6fb453c`, after a staging deploy + smoke). Phase 5A grows the city into the smallest useful **district**
of multiple blocks — discovery + bounded routing + per-block isolation — preserving every Phase 4 authority
and safety boundary. Not an economy/MMO/marketplace/HiveWorld phase.

**Decision.**
1. **Catalog + pure district layer** — `CITY_ROOMS` expands 1 → 3 (`downtown-01`, `harbor-02`, `skyline-03`);
   each block is already its **own** `CityRoom` DO (`idFromName(city_id)`), so adding blocks adds **no DO class
   and no migration**. New pure `arcade/city/city-district.mjs` owns the manifest, a fixed **line** adjacency
   (`downtown — harbor — skyline`, so downtown↔skyline are non-adjacent), public-safe block summaries, and
   `validateRouteRequest` (sanitize + known + adjacent + not-self; never mutates state). `SCHEMA_VERSION` → 7 (additive).
2. **Additive protocol, server owns truth** — `city_blocks` (pushed on join) + `city_blocks_request` +
   `city_route_request` → `city_route_result` in both the CityRoom DO and the dev-shim, rate-limited per socket.
   The route's **source** is the server-owned `boundCityId`; the **target** is untrusted. A route is a
   CONFIRMATION only — the client reconnects (`switchCity`) and the target block's authority admits it, so
   cross-block membership can never be forged. Per-block state (log/scheduler/Host Rank/stewardship/trial) stays
   isolated by DO construction; discovery carries no population/private/economy/ownership data (5B = live population).
3. **Client** — `city-net.js` gains `requestBlocks/requestRoute/switchCity` (close-handler guarded so a replaced
   socket can't reconnect to the old block); a city-OS **District panel** (current + adjacent blocks + Travel +
   route status; `textContent`/buttons only, no money/ownership/claim copy).

**Consequences.** Worker unchanged in shape (no new DO/migration; bundle 178.16 KiB / 38.33 KiB gz). Arcade
economy / ArcadeRoom / RoomRegistry / `game/*` / `hiveworld-sim` untouched. Validation: 500 unit (+9 district)
+ new district browser smoke (25/25) + all Phase 4 city + arcade two-client/frame-contract regression + Worker
dry-run + size (0.729 / 0.195 MB gz) + config gates — all green. Guardrails clean. Local-only commit on
`feat/neon-circuit-phase5a-multi-block-district`; not pushed/merged/deployed.

Detail: `docs/NEON_CIRCUIT_PHASE5_MULTI_BLOCK_DISTRICT.md`.

---

## ADR-011 — Neon Circuit Phase 4G: instanced, non-destructive Block Trial (2026-06-04)

**Context.** Phases 4A–4F built the full city vertical slice (block → authority → event log/interior →
scheduler → Host Rank → stewardship). Phase 4G adds the first *instanced gameplay loop* without ever
damaging the live public city or introducing any economy/ownership mechanic.

**Decision.**
1. **Pure Block Trial core** — new `arcade/city/city-battle-instance.mjs` (product "Block Trial" / objective
   "Signal Grid Trial"; roadmap term "Block Battle" stays in docs). `createTrial` **copies** a fresh
   `normalizeBlockStyle(stewardship)` snapshot (never an alias); `stepTrial` latches 3 fixed walkable signal
   nodes from **server-validated** member positions, recomputes a bounded `score ≤ 3`, and completes
   (`stabilized`/`timeout`); an active trial's `outcome` is always `null`, so a forged outcome can't survive.
2. **One in-memory, ephemeral trial per city, inside CityRoom** (`this.trial`; not persisted, no new DO, no
   migration). Players move via the existing `city_input` authority; the trial reads positions + owns score/
   outcome. Seven server-authored events (`city_block_trial_requested/started/joined/updated/completed/
   rejected/closed`); creation gated on `isStewardshipEligible` (Host Rank as one signal); rate-limited.
3. **Client** — BLOCK TRIAL panel (textContent, fixed buttons) + a 2D signal-node overlay tinted with the
   copied style accent. `SCHEMA_VERSION` → 6 (additive). The client can never author trial facts (forged →
   `unknown_type`).

**Consequences.** The live public city + canonical stewardship style are **never edited** by a trial (proven
by a pure test — style byte-identical after create+step+close — and the browser smoke). Arcade economy /
ArcadeRoom / RoomRegistry untouched. Validation: 491 unit + new Block-Trial browser smoke (23/23) + 4A–4F city
+ arcade two-client/frame-contract regression + Worker bundle Node 22 (CityRoom) + size (0.716/0.190 MB gz) +
config gates — all green. Guardrails clean. Local-only commit `ec331c0`; not pushed/deployed. Completes the
Phase 4A–4G city arc.

Detail: `docs/NEON_CIRCUIT_PHASE4G_INSTANCED_BLOCK_BATTLES.md`.

---

## ADR-010 — Neon Circuit Phase 4F: constrained Block Stewardship + editor (2026-06-04)

**Context.** Phase 4E's non-cash Host Rank needed a constructive use: let a recognized host shape a block
within strict rules, with no ownership, market, money, or free-form UGC.

**Decision.**
1. **Pure stewardship core** — new `arcade/city/city-stewardship.mjs` with a **closed enum manifest**
   (targets `arcade_front`/`street_lights`/`sidewalk_trim` × palettes `cyan/magenta/amber/white` × sign
   variants × intensities). The sanitizer reads **only** those enum keys, so no css/html/js/url/text field
   can survive into canonical state, an event, the wire, or the renderer. `preview`/`apply`/`reset` with
   immutable merges.
2. **Eligibility = Host Rank as one signal** (`tier ≥ helper` OR `support_signal ∈ {steady,active}`);
   stewardship is not ownership/permanent/account-bound.
3. **CityRoom** owns the canonical block style (persisted `cityStewardship`, hibernation-safe; no new DO/
   migration); preview never persists; apply/reset persist + broadcast. Four server-authored events;
   `SCHEMA_VERSION` → 5 (additive). Renderers gain `applyBlockStyle`; a BLOCK STEWARDSHIP editor panel
   (fixed options, no free text/upload/URL).

**Consequences.** Reversible, server-validated, non-cash visual edits only; the public block can't be griefed.
Validation: 476 unit + new stewardship browser smoke (22/22) + 4A–4E + arcade regression + bundle + size +
config gates — all green. Guardrails clean. Local-only commit `3fd125e`; not pushed/deployed.

Detail: `docs/NEON_CIRCUIT_PHASE4F_BLOCK_STEWARDSHIP.md`.

---

## ADR-009 — Neon Circuit Phase 4E: non-cash Host Rank (2026-06-04)

**Context.** The 4D scheduler could review city activity; Phase 4E recognizes positive hosting/support with a
reputation signal — and explicitly **not** any financial, ownership, or account mechanic.

**Decision.**
1. **Pure Host Rank core** — new `arcade/city/city-host-rank.mjs`: a deterministic, **bounded, non-cash
   display gauge** (`score ≤ 100`, decays — not cumulative XP) derived from recent *support* events +
   scheduler-reviewed pressure → `tier` (observer/helper/signaler/anchor), `support_signal`, ≤3 public-safe
   reasons. Scheduler/host-rank events are not counted (no feedback loop).
2. **Block/city-scoped, system-authored** (no per-player account/profile; per-player attribution deferred).
   Two server-authored events; `SCHEMA_VERSION` → 4 (additive); runs after the scheduler eval at every hook;
   emits on change; HOST RANK panel (non-monetary, textContent).

**Consequences.** Grants nothing, moves no one, touches no economy/ownership; payload allowlist + finiteness
guard keep it public-safe. Validation: 461 unit + new host-rank browser smoke (15/15) + 4A–4D + arcade
regression + bundle + size + config gates — all green. Guardrails clean. Local-only commit `01e7ee0`; not
pushed/deployed.

Detail: `docs/NEON_CIRCUIT_PHASE4E_HOST_RANK.md`.

---

## ADR-008 — Neon Circuit Phase 4D: subordinate Hive Scheduler (2026-06-04)

**Context.** Phase 4C's append-only world event log is the seam a living-world pressure layer can read. Phase
4D adds that layer — deterministic, server-side, and display-only (an atmosphere/pressure layer, not a god
process).

**Decision.**
1. **Pure scheduler core** — new `arcade/city/city-scheduler.mjs`: `evaluatePressure` reads the recent
   server-authored events (60 s window; scheduler events excluded so a tick can't feed back) + the server's
   own occupancy → a bounded pressure snapshot (`portal_activity`/`presence`/`interior_activity`/
   `scheduler_mood`) + ≤2 public-safe suggestions.
2. **CityRoom + shim** emit a tick / new suggestions **only when the snapshot changes** (dedup → bounded) and
   broadcast `city_scheduler_state`; invoked on join/portal/interior-close/leave/~30 s alarm/rate-limited
   request; cold-start idle logs nothing. Two server-authored events; `SCHEMA_VERSION` → 3 (additive); a
   CITY PRESSURE panel (display-only, textContent).

**Consequences.** Subordinate to CityRoom: owns no physics/position/portal/rewards/economy/rank — grants
nothing and moves no one; pressure is display-only. Validation: 450 unit + new scheduler browser smoke
(12/12) + 4A–4C + arcade regression + bundle + size + config gates — all green. Guardrails clean. Local-only
commit `4598969`; not pushed/deployed.

Detail: `docs/NEON_CIRCUIT_PHASE4D_HIVE_SCHEDULER.md`.

---

## ADR-006 — Neon Circuit Phase 4C: append-only world event log + in-place interior (2026-06-04)

**Context.** Phases 4A/4B proved a server-authoritative, well-feeling city block. Phase 4C adds the first
durable-feeling living-world primitive and removes the jarring full-page portal jump.

**Decision.**
1. **Server-authored append-only event log** — new pure `arcade/city/city-events.mjs` (createEventLog /
   appendCityEvent / recentEvents / cityEventsPayload / sanitizeEventPayload). Monotonic `seq`, derived
   `event_id`, FIFO-bounded to 50, public-safe payload allowlist. The client can request + display but
   **never author** (no inbound event handler; forged `city_event` → `unknown_type`). Lives in DO state
   under storage key `cityEvents`, separate from player `cityState` (no change to the pure movement core).
2. **CityRoom + dev shim** append events at join/leave/eviction/portal-request-accept-reject/interior-
   open-close, broadcast live `city_event`, send recent `city_events` on (re)join, answer
   `city_events_request` (rate-limited). New `city_portal_close_request` + `city_portal_enter_request`
   alias; `SCHEMA_VERSION` → 2 (additive; no-dt 4A/4B inputs still valid).
3. **In-place arcade interior** — `city_portal_ok` opens a same-origin **iframe overlay** to `/arcade/`
   (arcade runs unchanged, isolated; no postMessage/authority mixing); close → back to city; same-origin
   nav guard + fallback link; reduced-motion/mobile-safe. Replaces the 4B full-page navigation.
4. **City-OS world-log panel** (public-safe, bounded, `textContent`-only).

**Consequences.** ArcadeRoom/RoomRegistry economy untouched and isolated; arcade page still loads.
Validation: 437 unit (incl. new pure event-log) + 4C event-log browser smoke (19/19) + 4A/4B city +
arcade two-client/frame-contract regression + Worker bundle Node 22 (CityRoom) + size (0.66/0.17 MB gz) +
config gates — all green. Guardrails clean. Local-only; not pushed/deployed. The log is the seam 4D–4G
read from (documented only).

Detail: `docs/NEON_CIRCUIT_PHASE4C_WORLD_EVENT_LOG.md`.

---

## ADR-005 — Neon Circuit Phase 4B: city authority, reconciliation & minimap (2026-06-04)

**Context.** Phase 4A proved a server-authoritative city block. Phase 4B hardens the
player/network *feel* (no map growth, no new gameplay) so future systems can sit on it.

**Decision.**
1. **Input-replay reconciliation** (new pure `arcade/city/city-reconcile.mjs`): the client records
   each sent input by `seq`, the server snapshot's self `seq` is the ack, and the client replays
   unacknowledged inputs from the authoritative position each frame (eased; snaps past a threshold).
   Replay is visual only — never canonical.
2. **Remote snapshot interpolation** (new pure `arcade/city/city-snapshots.mjs`): remotes render
   from canonical snapshots buffered by `serverTime`, sampled at a render delay, shortest-arc facing.
3. **Authority dt = `clamp(min(clientDt, serverElapsed), 0, MAX_DT_MS)`** in `applyInput` — the
   client dt makes replay deterministic, but can never exceed real elapsed time (no speed-hack);
   absent dt falls back to the server clock (4A-compatible). New shared `predictStep` is the single
   movement step used by server + client. `SCHEMA_VERSION` added to `city_snapshot`/`welcome`.
4. **Minimap/radar v1** (`arcade/city/city-minimap.js`, procedural, no assets) + a debug overlay.
5. **Portal polish**: deliberate, server-confirmed "entering arcade interior" overlay + rejected
   feedback; the server remains the sole portal-eligibility authority.

**Consequences.** DO + dev shim transports **unchanged** (dt + schema flow through the pure core).
Additive client/core/test/doc changes only. Validation: 429 unit + new 4B reconcile/snapshot/authority
tests, city-authority browser smoke (15/15), 4A city smoke + arcade two-client/frame-contract regression,
Worker bundle under Node 22, size + config gates — all green. Local-only; not pushed/deployed.

Detail: `docs/NEON_CIRCUIT_PHASE4B_CITY_AUTHORITY_POLISH.md`.

---

## ADR-004 — Neon Circuit Phase 4A: City Block via an isolated `CityRoom` DO (2026-06-04)

**Context.** Phase 4 evolves the Neon Circuit arcade from a shell into the first vertical
slice of a living, top-down, edge-authoritative city world ("GTA-80 Challenge" — fit a
networked living-city prototype inside the original 1997 GTA 80 MB footprint). The arcade
becomes one interior inside a city block, with server-authoritative avatar movement and a
portal back into the existing arcade.

**Decision.**
1. **Dedicated `CityRoom` Durable Object** (not a reuse of `ArcadeRoom`). Per-block sharded
   via `idFromName(cityId)`; it owns only ephemeral player position/membership, **never**
   talks to `RoomRegistry`, and **never** touches arcade occupancy/ticket/economy state.
   The proven `ArcadeRoom`/`RoomRegistry` code is unchanged — the strongest guarantee the
   arcade cannot regress. Cost: an additive `[[migrations]] v3 new_sqlite_classes=["CityRoom"]`
   + `CITY_ROOM` binding in dev/production/staging (declared only; never run — no deploy).
2. **Pure authority core** `arcade/city/city-block.mjs` (layout, collision, movement clamp,
   portal gate, and join/input/leave reducers), with the DO and a Node dev shim as thin
   transports — mirroring the existing `round-authority.mjs` + `arcade-room.ts` pattern.
3. **Authority:** clients send input intent only (`dx,dy,seq,ts`); the server computes every
   accepted position from its own canonical state + server-clock `dt` + speed clamp +
   collision. No message carries an absolute position, velocity, reward, or inventory.
4. **Renderer:** Three.js orthographic top-down (vendored global, no bundler) with a 2D
   `<canvas>` fallback on the same layout. Rapier physics deferred to Phase 4B in favor of a
   minimal deterministic AABB layer.
5. **Size doctrine (GTA-80/GTA-34):** procedural-only client; advisory size meter
   (`scripts/check-city-build-size.mjs`). Measured 0.631 MB uncompressed / 0.161 MB gzipped.
6. **Deferred, non-cash doctrine** (documentation only): Host Rank, Block Stewardship (not
   hard ownership; non-griefable public city), constrained editor, instanced (non-destructive)
   block battles. No paid hosting, crypto, cash-out, gambling, or real-money mechanics.

**Consequences.** Additive-only edits to shared files (`index.ts` route/binding/export,
`wrangler.toml` v3 migration, production-config gate assertions). Full arcade unit + browser
regression unaffected. Validation: 406 unit tests green, city browser smoke green, arcade
two-client + frame-contract regression green, Worker bundles under Node 22 with the CityRoom
binding, size + production-config gates green. Local-only; not pushed/deployed.

Detail: `docs/NEON_CIRCUIT_PHASE4_GTA80_CITY_BLOCK.md`.
