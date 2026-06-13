# Creator Corner — Public Beta Plan (Local / Static Workshop)

**Status:** PLAN ONLY. Local-only / static-workshop candidate. No production deploy, no
staging deploy, no push, no route/Worker/DO/migration/secrets change, no live-world loader.

**Authorization for this doc:** `AUTHORIZED: BUILD CREATOR CORNER PUBLIC BETA ARTIFACTS — DOCS + .claude LOCAL ONLY`

**Goal:** define what "Creator Corner public beta" means as a **local/offline workshop** that
players or operators can open to compose and test creator packages — and pin the boundary that
keeps it strictly separated from live-floor loading, production upload, and any value system.

**Non-goal:** open UGC, live-world package loading, production authority, marketplace/ownership,
ticket/prize/ledger integration, accounts, uploads, paid hosting, rewards, crypto, or NFT.

This plan does not change any runtime code. It records the boundary and the verification ladder
so future Creator-track work can be gated against a written contract.

## 1. What the public beta IS / IS NOT

- **IS:** a local, offline, static workshop shell ([arcade/creator/creator-corner/index.html](../arcade/creator/creator-corner/index.html))
  that links to the closed-control authoring tools and the hardened local sandbox. Creators build
  package **data**, preview/run it **only** in a local null-origin iframe, and export files for
  off-band human review.
- **IS NOT:** a path by which player-authored packages reach the live world. There is no submit,
  no upload, no account write, no Worker authority, and no live-floor registration from this surface.

The live world has no creator-authored server truth here: the canonical city/arcade Worker neither
loads nor trusts creator packages. Creator previews are local-only and offline.

## 2. Surface classification

| Surface | File(s) | Class | Live-floor? |
|---------|---------|-------|-------------|
| Creator Corner hub | `arcade/creator/creator-corner/index.html` | static link hub, CSP-locked | No |
| Arcade Builder | `arcade/creator/arcade-builder/` | closed-control / rule-graph authoring (data only) | No |
| Reaction Lane | `arcade/creator/arcade-builder/rule-graph-templates.mjs` | CLOSED rule graph (approved mechanics + bounded knobs) | No |
| Arcade Sandbox | `arcade/creator/arcade-sandbox/` | hardened local iframe; untrusted local proposals | No |
| Block / Layered editors | `arcade/creator/block-editor/`, `arcade/creator/layered-editor/` | data-only authoring + local preview | No |
| Approval / live-loader / moderation | `arcade/creator/approval/`, `arcade/creator/moderation/` | gated infrastructure, SHIPPED DISABLED | No (CF-7/CF-8 gate) |

Public-beta scope is the **first five rows only**. The approval/live-loader/moderation row stays
out of the public-beta surface and behind the separate CF-7/CF-8 human gate.

## 3. Current safety posture (verified facts, not aspirations)

- **Static-only hub:** the wrapper sets `script-src 'none'; connect-src 'none'; form-action 'none';
  frame-src 'none'`, links only to the four local tools, and carries an explicit "no live floor
  loading / no value systems / no remote submission" banner. Enforced by
  [tests/creator/creator-corner.test.mjs](../tests/creator/creator-corner.test.mjs).
- **Live loader off:** `LIVE_WORLD_LOADER_ENABLED = false` in
  [arcade/creator/approval/approved-loader.mjs](../arcade/creator/approval/approved-loader.mjs),
  checked before any binding. CF-7 is shipped disabled (see `docs/CREATOR_FOUNDATION_CF7_LIVE_LOADER.md`).
- **Closed rule graph:** Reaction Lane validates with `live_world_authorized/ticket_hooks/prize_hooks/
  ledger_hooks` all `false` and rejects hostile graphs — enforced by
  [tests/creator/rule-graph-templates.test.mjs](../tests/creator/rule-graph-templates.test.mjs).
- **No production leak:** `arcade/creator/**` is in `FORBIDDEN_UPLOAD_PREFIXES` with a double guard
  in [scripts/build-curated-client-upload.mjs](../scripts/build-curated-client-upload.mjs); enforced by
  [tests/creator/curated-upload.test.mjs](../tests/creator/curated-upload.test.mjs).

## 4. Acceptance criteria (enumerated, checkable)

1. Creator Corner wrapper stays static-only (CSP blocks script/connect/form) — `creator-corner.test.mjs` passes.
2. Wrapper exposes only the approved local-tool links and no publish/upload/economy copy — `creator-corner.test.mjs` passes.
3. Reaction Lane remains a closed rule graph with all value/live capabilities `false` — `rule-graph-templates.test.mjs` passes.
4. `arcade/creator/**` (incl. the wrapper) is excluded from the curated production upload — `curated-upload.test.mjs` passes and `build-curated-client-upload.mjs --list` shows no `arcade/creator/**`.
5. `LIVE_WORLD_LOADER_ENABLED` is `false` and unchanged.
6. Production config guard passes — `tests/arcade/check-production-config.mjs`.
7. No forbidden-surface term appears in an enabling context in any changed file.

## 5. Validation ladder

1. `git diff --check`
2. `node --test tests/creator/creator-corner.test.mjs tests/creator/curated-upload.test.mjs tests/creator/rule-graph-templates.test.mjs`
3. `node scripts/build-curated-client-upload.mjs --list` → confirm no `.claude/**`, `docs/**`, `tests/**`, `arcade/creator/**` in the included set.
4. `node tests/arcade/check-production-config.mjs`
5. Grep changed files for forbidden-surface terms; confirm every hit is prohibitive/contextual.
6. `git status --short`, `git diff --stat`, `git diff --name-only` — confirm only intended files changed.

## 6. Staging / production consideration gates (no auto-deploy)

Staging or production exposure of the Creator Corner workshop is **not** part of this plan and must
not happen automatically. Before any such consideration:

- **Precondition (truthfulness):** the Phase 7C close-out doc must first be corrected. The graded
  Phase 7 evidence is: **reach** was production-observed; **gather / dwell / ordered-visit** were
  staging-equivalent on the byte-identical Worker bundle (`86d9c117`, live as `d9a6dbf5`), **not**
  manually observed in production. The uncommitted edit overstating "all four objective kinds proven
  against production" must be brought back to the graded wording under its own doc-only gate
  (`AUTHORIZED: CORRECT PHASE 7C CLOSEOUT TRUTH — DOC ONLY`) before Creator staging is discussed.
- Even when staged, the workshop ships as **static files only**, with the live loader OFF and creator
  tooling still excluded from the canonical client upload. Static staging would be its own explicit
  gate: `AUTHORIZED: STAGE CREATOR CORNER PUBLIC BETA — STATIC/LOCAL WORKSHOP ONLY`.
- Opening any live-world load path is the separate, human-cleared CF-7/CF-8 gate and is out of scope here.

## 7. Rollback

All artifacts from this pass are additive. Roll back by removing the new files:

- `docs/CREATOR_CORNER_PUBLIC_BETA_PLAN.md` (this doc) — `git checkout -- docs/CREATOR_CORNER_PUBLIC_BETA_PLAN.md` (if committed) or delete the untracked file.
- `.claude/agents/self-correcting-agent.md`, `.claude/skills/creator-public-beta/SKILL.md` — gitignored/local; delete to remove.

No runtime, route, Worker, DO, migration, or upload behavior changes, so there is nothing to revert there.

## 8. Forbidden surfaces (must never be added under this plan)

upload · submit · arbitrary JS · arbitrary package execution · live-world loading ·
`LIVE_WORLD_LOADER_ENABLED = true` · economy · ownership · paid hosting · rewards · prizes ·
tickets · marketplace · crypto · NFT · accounts · remote network calls from the workshop surface.

## 9. Next gate

Expected next gate after this pass: `AUTHORIZED: CORRECT PHASE 7C CLOSEOUT TRUTH — DOC ONLY`
(doc-only truthfulness cleanup; precondition for any later Creator staging consideration).
