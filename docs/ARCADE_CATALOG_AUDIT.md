# CloveLearn Arcade Catalog — Read-Only Audit

- **Date:** 2026-06-30
- **Repo state:** `main` at `981aa42`
- **Scope:** every playable arcade/game surface visible in the current repo
- **Type:** read-only audit (no source was changed to produce this record)

This document is the canonical inventory of the games in the CloveLearn / Neon Circuit
repository: what exists, where it lives, whether it is live or local, its safety class,
its test and polish status, whether it ships in the production upload, and the single
most useful next action for each. It deliberately separates **games** from **tools** and
**clinical drills**.

This file lives under `docs/`, which is on the production upload **denylist**
(`FORBIDDEN_UPLOAD_PREFIXES` in `scripts/build-curated-client-upload.mjs`). It is an
internal record and does not ship to clovelearn.io.

---

## Method

Four independent evidence sources, cross-checked:

1. **Deterministic upload eligibility** — `scripts/build-curated-client-upload.mjs`
   (`curatedUploadFileList()`): 292 files ship, 526 are excluded. A path ships only if it
   is not under a `FORBIDDEN_UPLOAD_PREFIXES` entry, or is on the 21-entry exact-match
   `PUBLIC_CREATOR_ALLOW` carve-out.
2. **Declared-live surfaces** — `whats-live.html` (the site's own "what's live" page) and
   the build script's hard requirement that `arcade/city/` be present.
3. **Test coverage** — count of files under `tests/` referencing each game.
4. **Source classification** — read-only reading of each game's HTML/JS to assess premise,
   playable loop, controls, offline behaviour, safety surface, and polish.

High-signal findings (leaked email, CDN dependencies) were spot-verified directly against
source with line references.

### Legend

- **Upload:** ✓ ships in curated upload · ✗ denylisted (never ships)
- **Safety:** 🟢 public-safe-free · 🟡 needs-review · 🔴 blocked / lab-only
- **Tests:** count of `tests/` files referencing the surface

---

## A. Live multiplayer surfaces (highest stakes)

| Game | Path | Live / Local | Safety | Tests | Polish | Upload | Next action |
|---|---|---|---|---|---|---|---|
| **Neon Circuit City** (GTA-80 3D city) | `arcade/city/index.html` | **LIVE** — `whats-live.html` links it; build script *requires* `arcade/city/` | 🟡 live multiplayer + stranger presence + economy via arcade portal. Mitigations are real: ephemeral random id, **no chat / no free-text**, fixed-enum stewardship (`city-stewardship.mjs`) | **93** | polished | ✓ | #1 in the Phase 0 counsel / minors review; document no-chat + no-PII as explicit safety claims |
| **Neon Circuit Lobby** (arcade hub) | `arcade/index.html` | **LIVE** — public Arcade v1 | 🟡 server-authoritative non-cash ticket economy; minors-facing; never legally reviewed | (shared city/cabinet suites) | polished | ✓ | Treat as the canonical economy-review surface; gate behind Phase 0 |

Both surfaces run on a Cloudflare Durable Object over WebSocket (the server owns all
canonical state). They are well built; the open question is governance
(economy + minors + live multiplayer), not craft.

## B. Official arcade cabinets — real, complete games

All three have a full ready → countdown → timed round → grade → restart loop, and all
three submit results to the **server ticket economy** (so none is free-standing-safe as
shipped).

| Game | Path | Live / Local | Safety | Tests | Polish | Upload | Next action |
|---|---|---|---|---|---|---|---|
| **Pulse Tap** (rhythm/reflex) | `arcade/pulse-tap-game.js` | LIVE — wired into lobby | 🟡 `onRoundSubmit` → server tickets | **8** | polished | ✓ | Stub the ticket path for a free standalone build |
| **Signal Sprint** (3-lane runner) | `arcade/signal-sprint-game.js` | LIVE — wired into lobby | 🟡 same ticket coupling | **12** | polished | ✓ | Decouple ticket submit for a free release |
| **Neon Grid** (Simon/pattern memory) | `arcade/cabinets/neon-grid/neon-grid-game.mjs` | Upload-eligible; **renders only when the server catalog enables `neon-grid-01`** | 🟡 `server_round_authoritative` | **8** | polished | ✓ | Confirm the server catalog activates it in the target deploy, else it is listed-but-dark |

## C. Standalone games (linked from root `index.html`)

| Game | Path | Live / Local | Safety | Tests | Polish | Upload | Next action |
|---|---|---|---|---|---|---|---|
| **Singularity Inc.** — turn-based 3D AI-takeover world-strategy sim (the "political simulator") | `game/index.html` | ships; linked from `index.html` | 🟡 **leaks personal email** `rbardyla@gmail.com` (`game/main.js:3152`, `:3737`); Google Fonts CDN + runtime world-atlas fetch (graceful try/catch); mature dystopian themes | **0** | polished, deep content | ✓ | **Remove the hardcoded personal email**; self-host fonts + world-atlas; reframe themes before any minors-facing context |
| **Mini Arcade — Operator's Deck** — single-file hub of ~14 mini-games | `game/Arcade/index.html` ⚠️ *locally modified (operator's dirty file)* | ships; linked from `index.html` | 🟡 jsdelivr three.js + cannon.js (3D game offline-fragile); misleading "account state" wording on a local-only base64 backup; mental-health-themed | 0 | playable → polished | ✓ | Self-host three/cannon; rename "account state" → "local backup key"; **confirm what the local dirty edit changed before any catalog freeze** |
| **Node Hopper** — 3D cyberpunk arcade platformer | `game/nodehopper/Node Hopper.html` | ships; linked from `index.html` | 🟢 no account / UGC / economy / free-text; **only caveat = CDN three.js + fonts** | **1** | polished — cleanest, most self-consistent loop of the set | ✓ | Vendor three.js (a local `game/three.min.js` already exists to reuse); self-host fonts → **best clean promote candidate** |
| **The Incredible Mind Machine (v0.5)** — physics puzzle, 20 levels + daily | `game/theincrediblemindmachine/index.html` | ships; linked from `index.html` | 🟡 pasted-JSON import (local, validated/clamped — free-text ingest); importmap CDN breaks cold-offline first load | 0 | polished (themes, daily, PWA/SW, a11y) | ✓ | Vendor three.module + cannon-es; self-host fonts; remove the visible "Host on Cloudflare Pages" instructions panel |

## D. Starter cabinets — 8 template skeletons

`arcade/cabinets/starters/{arbor-bloom, beacon-climb, crane-gate, crosswalk-window,
ember-sync, flash-three, phase-lock, spire-pulse}`

- **Safety:** 🟢 all `client_local_only` — **no tickets, no network, fully offline**. Safest tier in the tree.
- **Upload:** ✓ all ship.
- **Wired?** Yes — `buildStarterShelf()` runs unconditionally at module load and reveals the "Starter Corner" on the classic arcade floor when the curated manifest validates; all eight are reachable.
- **Tests:** 1–4 each (arbor-bloom 3, beacon-climb 2, crane-gate 2, crosswalk-window 3, ember-sync 1, flash-three 1, phase-lock 4, spire-pulse 2).
- **Polish:** playable but minimal. They are byte-pinned generator output from one ~100-line closed template, differing only in five constants (ACCENT / SPEED / WIN / MOT / MODE) and a small `scene()` draw. They share an identical particle/input/scoring core and have **no round timer, no win/lose, and no in-game restart** — the shared host runs them as endless "tap/hold/swipe/drag-when-hot" score-pokes.
- **Next action:** add an optional round/end-state in the shared host so they have a real loop, or label them clearly as endless "feel" toys. **Phase Lock** (dual-orbit "lock when aligned") is the only mechanically distinct one worth growing into a full game.

## E. Creator tools — correctly fenced

| Surface | Path | Live / Local | Safety | Upload | Note |
|---|---|---|---|---|---|
| **Local Maker Lab** (doorway) | `arcade/creator/local-maker/index.html` | **LIVE** — linked from `whats-live.html` | 🟢 static, `script-src 'none'`, no network | ✓ (allowlisted) | the single curated public entry to the maker loop |
| **Arcade Builder** | `arcade/creator/arcade-builder/index.html` | local tool, ships | 🟢 fixed-interpreter, **no arbitrary JS**, CSP-locked, no publish path | ✓ (allowlisted) | closed-vocab authoring; `LIVE_WORLD_LOADER_ENABLED=false` enforced at build time |
| **Arcade Sandbox** | `arcade/creator/arcade-sandbox/index.html` | local tool, ships | 🟢 null-origin `allow-scripts` iframe + child CSP `default-src 'none'`; importer code-aware deny-scan (`eval`/`new Function`/indirect-eval) | ✓ (allowlisted) | periodically re-audit the importer deny-list vs new sandbox-escape vectors |

The whole `arcade/creator/` tree is blanket-denied; only the 21 exact-match allowlisted
files ship. No creator path allows uploads, arbitrary JS, or publishing to the live world.

## F. Lab-only / denylisted (intentionally NOT shipped)

| Surface | Path | Why local | Safety | Upload |
|---|---|---|---|---|
| **Turf Wars** (P2P territory lab + offline tech dossier) | `arcade/hiveworld-agents/turf-wars/` | Phase 0 counsel gate; live/minors-facing use is blocked | 🔴 blocked for live; the offline dossier is the public-safe artifact | ✗ |
| **Virtual Arcade** (v0 visual mock + world bible) | `arcade/virtual-arcade/` | superseded design reference — mocked client, **no backend** | 🔴 not a product (denylist reason is "not real", not a safety defect) | ✗ |
| **Arcade Studio** (Vite + Three.js 3D creator, ~80 files) | `arcade-studio/` | denylisted standalone creator app | 🔴 local-only | ✗ |

## G. Not arcade games (recorded for completeness)

- **Test fixture:** `arcade/cabinets/sample-import-game/` — an explicitly disabled import test fixture, not a game; not in the production catalog (only reachable via `?test=1&adapterFixture=sample-import-game`).
- **Operator's-Deck tools (not games):** `quest-forge.html`, `dopamine-depot.html`, `deck.html` (a 115-card tactical deck). Productivity/card tools with no arcade loop.
- **DBT/CBT skill drills (22 files):** `*-drill*.html`, `*-full.html` — interactive clinical/therapeutic tools, a separate category from arcade games. Most ship in the curated upload.

---

## Cross-cutting must-fix findings

1. 🔴 **Privacy — personal email leak.** `rbardyla@gmail.com` is hardcoded in **Singularity Inc.** at `game/main.js:3152` and `game/main.js:3737` (the feedback buttons), and that game ships in the curated upload. Highest-priority fix before any public promotion.
2. 🟡 **Offline fragility — external CDNs.** Mini Arcade, Node Hopper, and Mind Machine hard-load three.js / cannon from **jsdelivr**; all four standalone games load **Google Fonts** from a CDN. This conflicts with a "self-contained / no external network" deploy posture (see the existing external-fonts note). A local `game/three.min.js` (603 KB) already exists and can be reused.
3. 🟡 **Economy coupling.** The only games with real win/grade structure (Pulse Tap, Signal Sprint, Neon Grid) all submit to the **server ticket economy** — the unreviewed, minors-facing concern. None is free-standing-safe as shipped.

## Bottom line

- **Genuinely free + public-safe today:** the 8 starter cabinets and **Node Hopper** (once three.js is vendored locally). Node Hopper is the cleanest single promote candidate.
- **Live now (and the real governance frontier):** the City + Lobby — polished, but `needs-review` on economy / minors / live-multiplayer (Phase 0 counsel gate).
- **Best-built standalones:** Singularity and Mind Machine — strong games that each need the email / CDN / clutter fixes before any public framing.
- **Creator + lab surfaces** are correctly fenced; nothing leaks to live.

---

## Scope caveat

"Found all games" means **all games visible through the current repo / upload-script /
link-graph / test-suite / source audit at `981aa42`**. This audit did **not** trawl the
operator's untracked or pre-existing dirty files, the untracked `output/` directory,
external archives, or downloads. Abandoned prototypes could exist outside the tracked
repo. For the current tracked CloveLearn repo state, this is the canonical game catalog.

## Next lanes (each its own future `AUTHORIZED:` gate — nothing here is authorized by this record)

This document records the audit only. It changes no game code and authorizes no work.
The natural follow-on lanes, in priority order:

1. Remove the hardcoded personal email from Singularity (`game/main.js`).
2. Vendor / self-host three.js, cannon, and fonts for Node Hopper, Mini Arcade, and Mind Machine.
3. Make Node Hopper the first clean public promote candidate.
4. Create a free standalone version of Pulse Tap / Signal Sprint without the ticket economy.
5. Build a "CloveLearn Labs" page separating games, tools, drills, and technical dossiers.

Each lane is a separate gate; the live City/Lobby economy and any minors-facing framing
remain behind the Phase 0 counsel ruling and the charter-superseding ADR.
