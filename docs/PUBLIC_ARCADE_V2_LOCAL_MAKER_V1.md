# Public Arcade v2 / Local Maker v1 — Safe Retention Platform

**Branch:** `feat/public-arcade-v2-local-maker-v1` · **Base:** main `6fee784` · **Date:** 2026-06-25

The next non-economy, non-account, non-cloud, non-live-publishing layer after Public Arcade v1 + Local Maker v0 shipped ([`PUBLIC_ARCADE_V1_RELEASE_COMPLETION.md`](PUBLIC_ARCADE_V1_RELEASE_COMPLETION.md)). It makes the shipped arcade + local-maker loop **clearer to understand, easier to discover, and easier to return to** — entirely inside the existing trust boundary. No runtime authority, economy, accounts, cloud, or live publishing is added.

## Scope (what shipped in this layer)

1. **Public Arcade clarity (static).** The homepage (`index.html`) now opens with a "what is Clove" lede and a dedicated **Arcade Maker Lab** entry card; `whats-live.html` cross-links from "what's playable" to "make your own (local only)". A visitor can see, in seconds, what to *play* vs. what to *make locally*.
2. **Static game-discovery catalog.** `arcade/cabinet-catalog.mjs` is a new **pure, read-only** source of truth for the three official live cabinets (Pulse Tap, Signal Sprint, Neon Grid) — label, tagline, genre tags, input hint, round length. It lists **only** official cabinets; creator/local-maker packages are never catalog entries. It carries no economy/account vocabulary (a built-in validator + a unit test enforce this).
3. **Local Maker v1.** The maker hub (`arcade/creator/local-maker/`) gains a home / what's-live breadcrumb and a current "loop" description (one-click test + share code, not just file export). The builder gains **local draft retention**: your last control state is kept in **host-page `localStorage`** so you can leave and pick up where you left off, with a clear "Start fresh" to clear it.
4. **Tests + docs.** New catalog + clarity + retention contract tests; this document.

## Trust boundary (unchanged — verified)

```
Builder makes data only — it never runs the generated game.
Sandbox distrusts imported data and re-validates via importArcadePackage.
Runtime execution stays in a null-origin iframe (sandbox="allow-scripts"; child CSP default-src 'none').
Results stay untrusted local proposals (server_authorized = false).
No creator package enters the live city.
No creator package earns tickets or touches ledger / balance / prizes / receipts / redemption.
```

**The draft retention does not cross the boundary.** `localStorage` is used **only** on the trusted builder host page and stores **control params only** (never the generated `manifest`/`files`). The generated game still **cannot** use storage — the importer's source scan bans `localStorage`/`sessionStorage`/`indexedDB` in package code, and the null-origin iframe has no storage regardless. Verified: `localStorage` appears only in the builder host (0 references in the sandbox runner); the importer's `SOURCE_FORBIDDEN` still rejects storage APIs; the saved draft contains no `manifest`/`files`.

## Non-goals (explicitly NOT built)

CF-7 · live publishing · creator tickets/economy/rewards · marketplace · ownership · transfer · cash-out · coin/token · NFT/crypto · gambling/prizes · server share links · accounts · login · cloud storage · user profiles · approval/moderation/live-loader surfaces · creator package ingestion into the live city · `arcade-studio` production integration · arbitrary user JS authority · upload/submit/publish buttons · Worker/DO/D1/R2/migration changes · Cloudflare deploy · DNS/routes · `LIVE_WORLD_LOADER_ENABLED=true`.

## Deliberately deferred (risk — separate authorization)

The **live arcade floor and city** (`arcade/index.html`, `arcade/city/index.html`, `neon-circuit-floor.js`) were **not** edited. They are Durable-Object-coupled live runtime that cannot be safely headless-smoked here, so adding in-world breadcrumbs/help or refactoring the floor to consume the new catalog carries production-regression risk disproportionate to the clarity gain. The discovery + clarity outcomes are delivered via the static landing + whats-live + catalog without touching live runtime. A follow-up may add in-world navigation under its own gate.

## Validation (provenance-tagged)

- `[machine]` unit suite `1098/1098` (`node --test tests/arcade/*.test.mjs tests/creator/*.test.mjs`).
- `[machine]` `tests/arcade/cabinet-catalog.test.mjs` 6/6 · `tests/creator/arcade-v2-clarity.test.mjs` 6/6.
- `[machine]` production-config check PASS · city build-size PASS.
- `[machine]` editor production + standalone release builds PASS (25/25) — `EXPECTED_EDITOR_AGGREGATE` re-pinned `d48a6a58 → 3912178753` in all 4 places (the builder edit is the only change to the reviewed editor set; sandbox runner untouched).
- `[machine]` curated upload: exactly **16** public creator files (unchanged); no blocked creator surface; no `arcade-studio`. The new `arcade/cabinet-catalog.mjs` ships under `arcade/` (not a denylisted prefix).
- `[machine]` `run-arcade-builder.sh` + `run-arcade-sandbox.sh` PASS (no off-host network).
- `[machine]` browser smoke 11/11: home + whats-live link to the maker; hub has a home breadcrumb; builder draft saves (params-only, no manifest/files), restores on reload with a note, and "Start fresh" clears it; no console errors.
- `[machine]` forbidden-surface grep on the diff: every hit is **prohibitive copy**, the catalog's **defensive guard regex** (which rejects economy terms), or a **test asserting absence** — zero enablement.

## Files changed

| File | Change |
|---|---|
| `index.html` | "What is Clove" lede + Arcade Maker Lab card + local-only footer (static) |
| `whats-live.html` | "Make your own (local)" cross-link section + footer maker link (static) |
| `arcade/cabinet-catalog.mjs` | **new** — pure static official-cabinet discovery catalog + validator |
| `arcade/creator/local-maker/index.html` | home/whats-live breadcrumb + current loop copy + tool-card refresh |
| `arcade/creator/arcade-builder/index.html` | draft note + "Start fresh" control + style |
| `arcade/creator/arcade-builder/arcade-builder.mjs` | host-only `localStorage` draft: save on refresh, restore on load, clear |
| `scripts/build-creator-editor-{production-release,standalone-production}.mjs` | aggregate re-pin (+ comment) |
| `tests/creator/creator-editor-{production-release,standalone-production}.test.mjs` | aggregate re-pin |
| `tests/creator/local-maker-hub.test.mjs` | allowlist now permits safe home/whats-live up-nav (gated-surface ban unchanged) |
| `tests/arcade/cabinet-catalog.test.mjs` | **new** — catalog contract |
| `tests/creator/arcade-v2-clarity.test.mjs` | **new** — clarity + cross-nav + draft-boundary contract |
| `docs/PUBLIC_ARCADE_V2_LOCAL_MAKER_V1.md` | **new** — this record |

## Status

Public Arcade v2 / Local Maker v1 is **BUILT** and validated on `feat/public-arcade-v2-local-maker-v1` — opened as a PR for review. **Not deployed, not uploaded, not merged.** Full Platform v1 remains parked behind the counsel/economy-legal gate; Attention Routing remains internal report-only telemetry (no coin/token/payout/balance).
