# Project Charter — Architectural Decision Record

Significant architectural decisions are recorded here (per `.claude/rules/engineering.md`).
Newest first.

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
