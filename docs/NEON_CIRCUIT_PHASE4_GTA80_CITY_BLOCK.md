<!-- Follow-up: Phase 4B hardens the player/network feel — see
docs/NEON_CIRCUIT_PHASE4B_CITY_AUTHORITY_POLISH.md (input-replay reconciliation,
remote snapshot interpolation, minimap, portal polish). -->

# Neon Circuit — Phase 4A: City Block Vertical Slice ("GTA-80 Challenge")

**Status:** implemented, local-only (branch `feat/neon-circuit-phase4-gta80-city-block`).
**Scope:** the first vertical slice of a living, edge-authoritative top-down city world.
The Neon Circuit arcade becomes **one interior** inside a larger city block.

This is **not** a GTA clone. The original 1997 top-down GTA is used only as a *design
constraint and historical reference*: readable overhead streets, small assets, strong
systems, emergent chaos. No Rockstar assets, names, maps, characters, missions, or art.

---

## 1. The historical constraint — why 80 MB

GTA1's PC system requirements listed an **80 MB hard-disk footprint**. Phase 4 adopts
that as the budget for the production static **playable city client**:

> *1997 shipped a top-down city crime game in 80 MB. In 2026 we fit a networked,
> edge-authoritative, living-city prototype inside the same footprint.*

- **GTA-80 (budget):** playable city client ≤ **80 MB uncompressed**.
- **GTA-34 (stretch):** compressed playable artifact ≤ **34 MB**.
- CD-image/archive sizes (e.g. 723 MB) are explicitly **not** the target — they are
  packaging artifacts, not the clean installed footprint.

**Measured (this slice):** `node scripts/check-city-build-size.mjs` →
**0.631 MB uncompressed / 0.161 MB gzipped** (8 files; the bulk is the shared, already-
vendored `scripts/three.min.js`). The slice uses ~0.8 % of the GTA-80 budget.

### Size doctrine
The client is **all procedural geometry** (rectangles/roads/buildings drawn from a data
manifest) + a tiny amount of JS/CSS. No asset packs, texture bloat, or unbounded
audio/video. Any future dependency must justify its build-size impact. The size meter is
**advisory** (it never blocks CI unless run with `--strict`).

---

## 2. Product goal

One living city block connected to the existing Neon Circuit arcade:

- one top-down, orthographic, retro-readable city block;
- one playable avatar with immediate-feeling movement;
- a glowing **arcade entrance portal** that transitions into the existing arcade floor;
- roads / sidewalks / building massing / parked-car scaffolding;
- visible connection/authority status;
- mobile-aware, responsive layout;
- real **server-authoritative multiplayer** presence on the proven Worker + Durable
  Object mesh.

The pillar: **the arcade is no longer the whole game — it is one interior inside the city.**

---

## 3. Authority model — players send intent, the server owns truth

| Client owns | CityRoom (Durable Object) owns |
|---|---|
| rendering, orthographic camera | accepted **canonical** player position |
| input capture (keyboard + touch) | room/block membership + spawn assignment |
| client-side prediction + reconciliation | movement clamp (server-clock `dt`) |
| remote-player interpolation | deterministic AABB collision / walkable bounds |
| UI, audio/visual effects | **server-validated** portal transition truth |
| | server timestamps + accepted sequence number |
| | disconnect + stale-player eviction |

**Critical rule (enforced + tested):** no message carries an absolute position, velocity,
inventory, or reward. `city_input` carries **only** a unit direction intent (`dx,dy`), a
sequence number, and a client timestamp. The server computes every accepted position from
*its own* last canonical position, the **server clock** `dt` (the client `ts` is used only
for ordering/telemetry), a `MAX_SPEED` clamp, and collision — all in the shared pure core
`arcade/city/city-block.mjs`. A delayed or oversized input cannot teleport (the `dt` is
clamped to `MAX_DT_MS`); a malicious `dx`/`x`/`y` payload is unit-clamped or ignored.

The client predicts locally for responsiveness using the *same* pure movement/collision
functions, then **reconciles toward the authoritative snapshot** — small drift eases,
large divergence snaps back — so the server visibly wins.

### Isolation (why the arcade cannot regress)
`CityRoom` is a **separate Durable Object class** (per-block sharded via
`idFromName(cityId)`). It **never** talks to the `RoomRegistry` and **never** touches
arcade occupancy/ticket/economy state. The existing `ArcadeRoom`/`RoomRegistry` code is
unchanged. The only additive edits to shared files are: a new route + binding + export in
the Worker entry, a v3 DO migration in `wrangler.toml`, and a `CityRoom` assertion in the
production-config gate.

---

## 4. Protocol additions (versioned `city_*`)

Routed at `/arcade/city/ws?city=<id>` → `CityRoom` shard. Subprotocol `arcade`.

**Inbound (client → server)**
| Message | Payload | Meaning |
|---|---|---|
| `city_join` | `{ playerId, cityId? }` | join the block; seeds a spawn |
| `city_input` | `{ seq, ts, dx, dy }` | **intent only** (no position) |
| `city_snapshot_request` | — | request the current roster snapshot |
| `city_portal_enter` | `{ portalId }` | request a portal transition (server-gated) |
| `city_leave` | — | leave the block |
| `heartbeat` | — | liveness refresh |

**Outbound (server → client)**
| Message | Payload |
|---|---|
| `city_welcome` | `{ cityId, you, players[], layout, tick }` |
| `city_snapshot` | `{ cityId, serverTime, players:[{ id, x, y, facing, seq }] }` |
| `city_player_joined` / `city_player_left` | `{ id, … }` |
| `city_portal_ok` | `{ portalId, target }` |
| `city_error` | `{ code, message }` |

Snapshots are public-safe (id + rounded position + facing + last accepted seq) — never any
private liveness field. Snapshot cadence is bounded by the server-enforced per-player input
rate (`MIN_INPUT_INTERVAL_MS`); a coarse alarm evicts stale players.

---

## 5. Visual direction

Cold, machine-governed "city OS": dark asphalt, hard lane geometry, readable building
silhouettes, a glowing magenta arcade doorway, cyan self-marker, amber others, and a
top-bar **CITY OS** HUD with a live authority-status pill. GTA-1-inspired overhead
readability with entirely original geometry. Renderer: **Three.js orthographic** (vendored
global, no bundler) with a **2D `<canvas>` fallback** on the same layout if WebGL is
absent or its context fails — so the city is always playable.

---

## 6. Deferred doctrine (documentation only — no code in 4A)

These define the *future* direction so the slice has a clear story. All are **non-cash**
and explicitly out of scope for 4A.

- **Host Rank** — a non-cash reputation for players who support the city (hosting events,
  keeping a block healthy). No paid hosting, no payouts, no real-money mechanics ever.
- **Block Stewardship** — players may earn the *right to customize* a block within
  validated rules. This is **stewardship, not hard ownership**. The persistent public city
  must remain **non-griefable**: customization happens inside server-validated bounds.
- **Constrained editor** — a future, rules-bounded editor (unlocked via Host Rank /
  Stewardship), never free-form UGC that could break the public city.
- **Instanced block battles** — any competitive "block battle" must be **instanced and
  non-destructive** to the live public city (Clash-of-Clans-style, deferred), never a
  mechanic that damages other players' persistent space.

### Game-loop doctrine (future)
- **Moment-to-moment:** move through the city, enter the arcade, interact with block
  portals; (later) job hooks, hazards, vehicles.
- **Session:** (later) earn tickets/rep/materials, improve block standing.
- **Daily:** (later) check your block, host events, respond to city pressure.
- **Weekly/seasonal:** (later) block rankings, instanced block battles, seasonal asset
  packs, city scars/events.

---

## 7. Non-goals (4A)

Full city; full GTA clone; combat/weapons/police; real vehicle physics/driving (parked
cars are **static scaffold props** only); LLM NPCs; paid hosting; crypto/token/NFT;
real-money economy; marketplace; OAuth/accounts; free-form UGC editor; block battles;
persistent inventory; procedural world generation; CDN/DB/queue replacements; production
deploy. No arcade economy expansion — the city carries **no** tickets/prizes/rewards.

---

## 8. Files

**New — pure core (single source of truth):** `arcade/city/city-block.mjs`
(layout manifest, spawn selection, input normalization, speed clamp, AABB collision,
portal detection, snapshot shape, and the join/input/leave/portal authority reducers).

**New — server transports (thin wrappers over the pure core):**
`workers/arcade/src/city-room.ts` (`CityRoom` DO) and `workers/arcade/city-dev-shim.mjs`
(Node parity twin for local/browser tests).

**New — client:** `arcade/city/index.html`, `city-scene.js`, `city-net.js`,
`city-render-three.js`, `city-render-canvas2d.js`, `city.css`.

**New — tooling/tests/docs:** `scripts/check-city-build-size.mjs`,
`tests/arcade/city-block.test.mjs`, `tests/arcade/city-protocol.test.mjs`,
`tests/arcade/city-block.spec.mjs`, `tests/arcade/run-city-block.sh`, this doc.

**Modified — additive only:** `workers/arcade/src/index.ts` (route + `CITY_ROOM` binding +
export), `workers/arcade/wrangler.toml` (CityRoom binding + v3 migration in dev/production/
staging), `tests/arcade/check-production-config.mjs` + `production-config.test.mjs`
(CityRoom assertions), `docs/PROJECT_CHARTER.md` (ADR).

---

## 9. Validation commands

```bash
# unit (pure helpers + authority reducers) + full arcade regression
node --test tests/arcade/*.test.mjs

# production-config safety gate (now also asserts the CityRoom v3 migration)
node tests/arcade/check-production-config.mjs

# GTA-80 advisory size meter (add --strict to fail over 80 MB)
node scripts/check-city-build-size.mjs

# city browser smoke (Playwright; set PW_REQUIRE_BASE to a playwright install)
PW_REQUIRE_BASE=/path/to/pkg/with/playwright bash tests/arcade/run-city-block.sh

# arcade regression (proves the arcade is untouched)
bash tests/arcade/run-two-client.sh
bash tests/arcade/run-frame-contract.sh

# Worker bundle check (Node >=22; no deploy, no login)
cd workers/arcade && npx wrangler deploy --dry-run --outdir dist
```

---

## 10. Known limitations

- Reconciliation is "predict + ease/snap toward the server", not full input replay
  (a Phase 4B refinement). It is correct and demonstrably server-authoritative, but a
  high-latency client may see occasional small corrections.
- Snapshots broadcast on accepted input (bounded by the input rate), not a fixed
  coalescing tick. Fine for a small block; a fixed-tick coalescer is a 4B option.
- Headless WebGL is flaky, so the browser smoke forces the 2D renderer (`?renderer=2d`);
  the Three.js path is exercised in real browsers.
- City player positions persist on membership changes + the coarse alarm, not on every
  input, so a cold DO reload may lose <30 s of movement (the client reconciles on the next
  snapshot). Acceptable for an ephemeral world layer.
- One static block, one portal, two scaffold (non-driveable) parked cars.

---

## 11. Next phases

- **4B** — input-replay reconciliation; richer Three.js / WebGPU; vehicle prototype;
  minimap/radar; Rapier physics (deferred from 4A in favor of the minimal AABB layer).
- **4C** — append-only world event log.
- **4D** — Hive Scheduler (city pressure / event scheduling).
- **4E** — Host Rank (non-cash node-support reputation).
- **4F** — Block Stewardship + constrained-editor manifest.
- **4G** — instanced block-battle prototype.

**HiveWorld mirror:** deferred. Per the simulator-parity convention, a HiveWorld city-block
mirror (`hiveworld-sim`) would follow as a docs-only TODO; **no** `hiveworld-sim` code is
touched in this slice.
