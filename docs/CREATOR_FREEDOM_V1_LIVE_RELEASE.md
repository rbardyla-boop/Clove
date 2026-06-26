# Creator Freedom V1 / Free Sandbox — Live Release Record

**Status: LIVE VERIFIED / SHIPPED** — 2026-06-26.

Creator Freedom V1 / Free Sandbox is live on production and end-to-end verified. This file is the
release record; the architecture is ADR-048 in [PROJECT_CHARTER.md](PROJECT_CHARTER.md) and the feature
detail is in [CREATOR_FREEDOM_V1_FREE_SANDBOX.md](CREATOR_FREEDOM_V1_FREE_SANDBOX.md).

## Release facts

| Field | Value |
|-------|-------|
| Live URL | `https://clovelearn.io` |
| Source commit | `c20d486` (merge of PR #101) |
| Package aggregate (sha256) | `8c863852a6438af887e55991e66e1e8f54e01e7a251abacae609520002bc8c42` |
| Upload | manual Cloudflare dashboard upload (operator); static-assets Pages project `wild-hat-6257` |
| Live smoke | 20/20 headless browser checks PASS |
| Rollback | not needed |
| Trust boundary | intact |

The upload package was built faithfully from a clean detached worktree at `c20d486` (293 files /
16.77 MiB), so no dirty working-tree content was shipped.

## Live identity (the deployment is exactly the reviewed package)

- All 18 creator `.mjs` files plus `arcade/cabinet-catalog.mjs` are byte-identical (sha256) to the
  reviewed package — the live security-critical code is exactly `c20d486`.
- All 5 Free Sandbox modules serve 200:
  `arcade/creator/arcade-builder/free-sandbox-editor.mjs`,
  `…/free-sandbox-templates.mjs`, `…/free-sandbox-interpreter.mjs`,
  `arcade/creator/schemas/free-sandbox-schema.mjs`,
  `arcade/creator/arcade-sandbox/free-sandbox-retention.mjs`.
- The live `arcade-sandbox/sandbox-runner.mjs` includes the `free-sandbox-retention` import (21,786
  bytes), distinguishing it from the prior build (19,249 bytes, no retention import).
- The 5 shipped HTML pages differ from the package **only** by Cloudflare's edge-injected
  `/cdn-cgi/challenge-platform/` inline challenge script (same-origin platform behavior; not in the
  package, not introduced by this release).

## Product shipped

A bounded creator sandbox — materially expressive, not a reskin, and still entirely local:

- Closed declarative schema (arena, player, objective, scoring, entities, movement/AI, WHEN→THEN rules,
  waves, modifiers, theme) with a fail-closed validator.
- One fixed, reviewed deterministic interpreter (graph-as-data; emitted verbatim into a standard
  `arcade_game` package).
- Free Sandbox editor (blank / mechanic / remix; add-edit-remove every block; live validation; package
  fingerprint).
- Package generation.
- Test-in-sandbox (one-click handoff to the null-origin sandbox).
- Local share / import.
- Deterministic seeded replay and host-only retention (best / grade / plays by fingerprint).

## Trust boundary (verified live in served bytes)

- Schema validation is mandatory before any Free Sandbox package emission (no bypass).
- Output is a standard `arcade_game` package (`package_kind: "arcade_game"`, `capabilities: []`,
  `assets: []`).
- `importArcadePackage` revalidates on import (deny-list + caps re-run at import time).
- The sandbox iframe is null-origin: `sandbox="allow-scripts"`, never `allow-same-origin`; child CSP
  `default-src 'none'`.
- Results are untrusted-local / not server-authorized.
- No creator package enters the live city; no creator tickets; no economy; no accounts / cloud / server
  share; no upload / submit / publish.

## Blocked surfaces (live 404 / not exposed)

- approval / moderation / live-loader → 404
- arcade-studio → 404
- workers / tests / docs → 404
- block / layered / district editors and creator-corner → 404
- Worker / DO / D1 / R2 / migrations / secrets → not exposed (`wrangler.toml`, `package.json` → 404;
  `.env` → 403, content not served)

## Findings

- **Critical:** none
- **High:** none
- **Medium:** none
- **Low:**
  - Cloudflare's platform injects a `/cdn-cgi/challenge-platform/` inline challenge script into HTML
    responses; the site's strict CSP `script-src 'self'` blocks it, producing one cosmetic console
    message. Same-origin, pre-existing, not this release; no functional impact.
  - `.env` returns 403 (Cloudflare dotfile protection); the file is not in the package and its content is
    not served.
  - Legacy Google Fonts / CDN references remain on older pages (pre-existing; not added by this release).
  - Legacy same-origin arcade WebSocket clients remain (pre-existing; unchanged by this release).
  - Inert dev scripts are served as static text under `scripts/` (pre-existing builder design; never
    fetched by any page).
  - Optional importer bare-token scan broadening remains an open, non-blocking follow-up.
  - Graphics degradation remains unscoped (separate, pre-existing task).

## Verdict

- **Shipped:** yes.
- **Rollback needed:** no.
- **Follow-ups:** optional only (legacy fonts/CDN cleanliness; graphics degradation) — each its own gate.
