# Neon Circuit — Hive World Alignment (GTA-Clone World on the Real Stack)

**Status:** Canonical realignment of the virtual-arcade plan. Supersedes the architecture
targets in `HANDOFF.md §7`, `WORLD_BIBLE.md §8`, and the whole of
`PHASE_0_ARCHITECTURE_MAPPING_REPORT.md`.
**Why:** Those docs were written against the Hallucinate repo (Bun.serve + custom binary
protocol + LMDB). That path was **demoted** — it is not Phase 1b authority and must not be
merged. The shipped, production-deployed authority is this repo's **Cloudflare Worker +
Durable Object hive** (`workers/arcade/`), speaking the JSON-over-WebSocket protocol that
already runs the city and arcade at `clovelearn.io`.
**Rule inherited from the world bible (unchanged):** no real money, no login wall, no PII,
server-authoritative economy, mobile first-class, original brand only.

---

## 1. Old plan → real stack truth table

Every place the old docs say the left column, a coding agent must read the right column.

| Old plan (Hallucinate) | Reality (this repo — the hive) |
|---|---|
| `Bun.serve` HTTP+WS on :3001 | Cloudflare Worker `workers/arcade/src/index.ts`, routes `/arcade/{ws*,city/ws*,rooms*,health}` |
| Custom binary protocol, version 20→21 | JSON messages with a string type field (`t:` / `type:`) — already versioned by deploy |
| New message types 16–27 (`C_CABINET_START`…) | **Already shipped** as named messages (see §2 mapping table) |
| LMDB (`tickets.lmdb`, `redemptions.lmdb`) | Durable Object storage: `tickets.mjs`, `ledger.mjs`, `prize-authority.mjs` |
| 3 fixed rooms (inside/outside/tent) | `RoomRegistry` + per-room `ArcadeRoom` DOs; `CityRoom` per district block; `CityRegistry` directory |
| WebGL2 club scene (`club-app.ts`) | `arcade/city/` scene (`city-scene.js`, `city-render-three.js` / `city-render-canvas2d.js`) |
| Player identity: IP + localStorage token | localStorage `playerId` keyed against DO state (shipped; cross-session) |
| "Build cabinets like beach balls" | Cabinet contract already exists: `cabinet-frame-contract.mjs`, `cabinet-adapter-sdk.mjs`, occupancy via `occupy_machine`/`release_machine` |

**Nothing in `index.html` (the v0 visual prototype) changes** — it remains the look/feel/state
reference. Only the *backend translation target* moves.

## 2. The hive protocol — event mapping

The "suggested network events" of `HANDOFF.md §4` already exist. Do not reinvent them:

| HANDOFF.md §4 concept | Shipped message(s) |
|---|---|
| `player_move` | `city_input` → `city_state` broadcast (CityRoom) |
| `player_emote` | city interaction path: `city_interaction_request` → `city_interaction_receipt` |
| `machine_start` / `machine_occupied` | `occupy_machine` / `release_machine` (ArcadeRoom) |
| `game_score_update` / `game_end` | round authority: `pulse_round_start/submit`, `neon_grid_round_*`, `signal_sprint_round_*` (server-scored via `round-authority.mjs`) |
| `tickets_awarded` | `ticket_award` (server-pushed), `ticket_balance_request`, `ticket_ledger_request` |
| `prize_redeemed` | `prize_redeem` (validated by `prize-authority.mjs`), catalogs via `prize_catalog_request` / `cabinet_catalog_request` |
| zone travel (bible §7) | `city_portal_enter` → `city_portal_enter_accepted/rejected`, `city_blocks_request`, district presence via `city_district_presence` |
| daily/featured machines (bible §4.5) | `events.mjs` / `room-events.mjs` scheduled events, `city_events`, district event snapshots (Phase 6B/6C) |

**Hive node model.** Each Durable Object is a hive node with single-writer authority over its
own state:

- `ArcadeRoom` node — one per arcade room: rounds, occupancy, tickets, prizes, achievements, challenges.
- `CityRoom` node — one per district block: presence, movement, portals, trials, interiors.
- `CityRegistry` node — district directory: cross-block presence/health.
- `RoomRegistry` node — room catalog and lifecycle.

Node-to-node communication is DO-to-DO fetch (shipped since Phase 2b/5C). That fabric — JSON
messages, single-writer nodes, registry coordination, fail-open reads — **is** the
hive-server-communication protocol. The HiveWorld simulator (lab branches, `hiveworld-*`)
mirrors the same semantics as a CRDT event log and is where new node behaviors are proven
before they touch production.

## 3. GTA-clone world: zones → shipped district

The world bible designed 8 zones. The district already ships **6 blocks** with adjacency,
portals, per-block identity, presence, events, and trials. Map, don't rebuild:

| World-bible zone | District block | Status |
|---|---|---|
| Main Floor (hub) | `downtown-01` | shipped |
| Retro Alley | `harbor-02` (re-theme pass) | shipped geometry, needs zone-accent token pass |
| Hyper Court | `skyline-03` (re-theme pass) | shipped geometry, needs zone-accent token pass |
| Circuit Raceway | `foundry-04` | shipped (Phase 6D, non-linear ring) |
| Rhythm Reactor | `nexus-05` | shipped (Phase 8A) |
| Cosmic Lounge | `garden-06` | shipped (Phase 8A) |
| Prize Bazaar | interior on `downtown-01` (prize counter grown via catalog) | partial |
| The Backroom | future 7th block or hidden interior — manifest has 6.9× headroom at B9 | not started |

GTA-clone qualities the world already has: free-roam blocks, adjacency travel with
accept/reject (`city_portal_enter_rejected` = blocked route), per-block identity/landmarks,
live district presence, scheduled district events, instanced block trials, arcade interiors
(`city_arcade_interior_opened/closed`). The remaining gap to "GTA-clone feel" is **content
density and zone theming**, not architecture.

**Improvement work items for `arcade/` files (display-only, no new authority):**

1. Zone-accent token sets per block (the bible §3 palettes) applied through
   `city-block-identity.mjs` — same pattern as the shipped per-block default styles.
2. Landmark marquees per block (bible §7.3) — extend `city-district-flavor.mjs`.
3. Map overlay fast-travel (bible §7.2) — extend the District panel using shipped
   `city_blocks` + `city_district_presence` data; instant fade, no new server messages.
4. Portal transition polish (bible §7.5) — client-only, honor `prefers-reduced-motion`.

## 4. Top-world asset editor

Requirement: creators can edit assets of the **top world** (district/block level), not just
cabinets. Build it as **CF-3.5: District Asset Editor** — a sibling of the shipped editors,
inheriting the whole creator pipeline:

- Base: `arcade/creator/block-editor/` (block packages) + `arcade/creator/layered-editor/`
  (CF-3 layered customization, closed token vocab) + `arcade/creator/map-viewer/`.
- New surface: edit a **block-asset package** — landmark sign text (closed token set),
  zone accent selection (from the approved palette enum), prop placement on a fixed grid
  of approved prop symbols. Same shape as `block_layered`: closed vocabulary, size-capped,
  string enums, zero free-form code or URLs.
- Pipeline unchanged and non-negotiable: local edit → `validator/` + `hive-validation/`
  (CF-6) → human review queue (CF-8) → approval receipt (CF-2 hash-bound) → live loader
  (CF-7, **stays disabled** until its separate production gate).
- Top-world assets are *display-layer only*: they may never alter geometry, collision,
  adjacency, routes, or economy values. Geometry stays byte-identical, exactly as Phase 8A
  proved with 6 blocks.

## 5. Arcade builder

Requirement: creators build whole arcades. **CF-1…CF-8 already is the arcade builder
pipeline** — `arcade-sdk/` (package template + size budget), `arcade-importer/`,
`arcade-sandbox/`, schemas, validator, moderation, approval. What's missing is the
**assembled builder UX**, not new trust machinery:

- **Arcade Builder app** (`arcade/creator/arcade-builder/`, new): pick a floor layout
  (closed set), place cabinets from approved cabinet packages, attach an approved block
  style — emits a single `arcade_package` that the existing importer/validator already
  understands. No new package kind unless the schema genuinely can't express layout;
  prefer extending `arcade_package` additively.
- Sandbox-first: every build runs in `arcade-sandbox/` locally. Submission still ends at
  the CF-8 human review queue. Live placement in a district interior remains behind CF-7's
  disabled loader and its own production gate.

## 6. Creators earn — the agent payment system (doctrine-bounded)

This is the part the old plan never had, and the part with hard guardrails already on
record (Phase 9 economy doctrine, ADR-040): the shipped economy is **non-cash**
(tickets/prizes/achievements), it is minors-facing, and it has **never been legally
reviewed** — the G-MINORS/G-MONEY/G-CSAM/G-UGC gates are open for counsel. So "creators
earn" lands in three rungs, each gated:

**Rung 1 — recognition (allowed now, doctrine-aligned).** Block-collective recognition
only, per Phase 9 doctrine: when a creator's approved cabinet/asset is played, the
*block* accrues visible recognition (plays, district event spotlights, "built by the
harbor crew" flavor). No per-player attribution (deferred by ADR-009), no balances owed
to a person.

**Rung 2 — agent ledger accounts (simulator-first, the hive-node-as-agent design).**
Each hive node (DO) is modeled as an **agent** with an account in the ledger:

- Identity: agent id = node id (`arcade-room:<roomId>`, `city-room:<blockId>`). Creator
  packages bind to a node, never to a human identity — keeps it PII-free.
- Payment primitive: a ledger entry between agent accounts (e.g., a played round routes a
  fixed ticket fraction from the room agent to the cabinet-package agent). Append-only,
  capped per round, auditable — the same `ledger.mjs` shape that already records ticket
  history.
- **Where it gets built first: the HiveWorld simulator, not production.** Per doctrine,
  all economy mechanics are simulator-first. HiveWorld nodes already mirror DOs as fold
  reducers; agent accounts + transfer events + anti-extraction checks (AE-1…AE-13) get
  proven there, with convergence and abuse scenarios, before any production proposal.

**Rung 3 — real-world creator payout (blocked).** Cash-out of any kind requires counsel
sign-off on the open legal gates first. Nothing in rungs 1–2 may create a balance that
implies a cash claim. The word "buy" still does not appear in this product.

This gives the sentence in the original ask a precise meaning: *each hive-server node is
an agent in the hive world, and the agent payment system is the ticket ledger operating
between agent accounts — simulated first, recognition-only in production, cash never
without the legal gates closing.*

## 7. Build ladder (each rung independently gated)

| Rung | Scope | Gate | Status |
|---|---|---|---|
| W-1 | Zone accents + map fast-travel/waypoints (client/display-only, §3 items) | normal PR review | ✅ BUILT (`city-world-map.mjs` + scene wiring; smoke green) |
| W-2 | District Asset Editor (CF-3.5, local-only like all CF editors) | normal PR review | ✅ BUILT (`creator/district-editor/`; smoke green) |
| W-3 | Arcade Builder UX over existing CF pipeline | normal PR review | ✅ BUILT (`creator/arcade-builder/`; smoke green) |
| W-4 | Agent-ledger sim: node-as-agent accounts + bounded transfers + AE checks | lab module, prod-import forbidden | ✅ BUILT (`arcade/hiveworld-agents/agent-ledger.mjs`; 15 tests) |
| W-5 | Rung-1 recognition in production (block-collective, display-only) | operator authorization | gated |
| W-6 | Any production agent-ledger transfer | sim evidence + operator authorization | gated |
| W-7 | CF-7 live loader enable; creator content in live world | separate production gate (unchanged) | gated |
| W-8 | Cash earning | legal counsel sign-off on G-MINORS/G-MONEY/G-UGC/G-CSAM | gated |

See ADR-041 in `docs/PROJECT_CHARTER.md` for the W-1…W-4 implementation record.

**Standing constraints:** dry-run byte-identical for client-only rungs; no new DO classes
without a migration plan; `LIVE_WORLD_LOADER_ENABLED` stays false through W-1…W-6;
geometry stays byte-identical through W-1/W-2.
