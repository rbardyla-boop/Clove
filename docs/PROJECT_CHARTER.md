# Project Charter — Architectural Decision Record

Significant architectural decisions are recorded here (per `.claude/rules/engineering.md`).
Newest first.

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
