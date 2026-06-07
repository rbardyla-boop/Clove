# Phase 8 — District Scale Plan

**Status:** **PLAN ONLY** — no code, no deploy, no migration, no config flip in this phase.
**Boundary:** **`LIVE_WORLD_LOADER_ENABLED` stays `false`; CF-7 is NOT enabled in Phase 8.** Package-backed / live-loaded districts are a later, separately-authorized, staging-only gate that Phase 8 only *designs*, never opens.
**Framing (kept cold):** *Scale the city around the proven Phase 7 kernel and the closed CF-1→CF-8 creator trust boundary.* Not a decentralized economy, not a hosting economy, not live UGC.
**Hard non-goals:** no economy, ownership, rent, paid hosting, accounts, marketplace, payout, token, NFT, transfer, or cash-out; no production deploy; no CF-7 enablement; HiveWorld untouched.
**Parents:** `docs/PROJECT_CHARTER.md` (ADR-034), `docs/CREATOR_FOUNDATION_CF7_LIVE_LOADER.md`, `docs/CREATOR_FOUNDATION_CF8_REVIEW_QUEUE.md`, `docs/CREATOR_FOUNDATION_CF7_CF8_LIVE_LOADER_PLAN.md`, the Phase 7 kernel arc (ADR-025…027).

---

## 0. Why Phase 8 can be planned now

Phase 7 shipped the city gameplay kernel — walkable boundary (7B), interaction zones (7A), and server-confirmed interaction receipts (7E), all staging-proven on real workerd. The creator pipeline is complete **CF-1 → CF-8**, and **CF-7** — the operator-approved live loader — exists as a *closed, disabled machine* that rejects by default (a perfect approval still returns `live_world_loader_not_enabled`). The roadmap puts the creator/live-loader trust boundary **before** city scale, not after. That boundary is now a machine, not a concept, so scale can finally be designed *around a real gate*.

This plan therefore designs **how the city scales while the live loader stays closed.** The default for every tier is **static config** — the same model `arcade/city/city-block.mjs` + `arcade/city/city-district.mjs` ship today (4 blocks, one district, a frozen non-linear 4-ring, `SCHEMA_VERSION = 8`). Package-backed districts are a later, human-cleared, staging-only possibility; Phase 8 designs *how that would work*, it does not enable it.

> **Grounding.** Every threshold and number below is anchored to the real code. The current shipped topology is **4 blocks in a non-linear ring** (`city-district.mjs:38-43`, Phase 6D), not the older 3-block line that appears in some prose. Where a value must be measured before it can be fixed, the plan says **"to measure"** and names the measurement in *§7 — Open Measurements & Deferred Items*.

### What this plan delivers

1. **Scale Topology** — block/district scale model, CityRoom naming, CityRegistry limits + sharding trigger.
2. **Presence at Scale** — the interest-management trigger.
3. **Asset Packs & Data Model** — CF-5 packs into district composition; static config vs approved-package data; asset-pack bounds for larger maps.
4. **Deferred Staging Candidate Path** — how an approved package could *later* enter staging via CF-7 (not yet) + the operator workflow.
5. **Rollback & Kill-Switch** — for (future) package-backed districts.
6. **Performance, GTA-80 Budget Impact & Cross-Device Smoke Matrix.**
7. **Open Measurements & Deferred Items** — to-measure thresholds (with protocol) + items deferred to Phase 8B.
8. **Non-Goals, Sequencing & the Next Fork** (A: implement Phase 8A static scale — B: enable CF-7 staging).

---

## 1. Scale Topology — block/district model, CityRoom naming, CityRegistry limits & sharding trigger

> **Phase boundary.** This section is PLAN ONLY. It DESIGNS how scale would later work; it ships no code, no migration, no deploy, no config flip. `LIVE_WORLD_LOADER_ENABLED` STAYS `false` and CF-7 is NOT enabled here — package-backed districts are a later, human-cleared, staging-verified gate, not part of this topology plan. The default for everything below is **STATIC CONFIG** (the same model that ships today in `arcade/city/city-block.mjs` + `arcade/city/city-district.mjs`). No economy, ownership, rent, accounts, or marketplace appears in any tier. HiveWorld is untouched; the canonical authority remains per-block `CityRoom` (`workers/arcade/src/city-room.ts`) + cross-block `CityRegistry` (`workers/arcade/src/city-registry.ts`).

### 0. What we are generalizing (the proven kernel)

Today's shipped topology, anchored to the real files:

- **4 blocks**, one district. `CITY_ROOMS` is a frozen 4-entry list in `arcade/city/city-block.mjs:167-172` (`downtown-01`, `harbor-02`, `skyline-03`, `foundry-04`), each `capacity: 24`. `CITY_IDS` is derived from it (`city-block.mjs:173`).
- **1 district**, `DISTRICT_ID = 'neon-district-01'` (`city-district.mjs:26`), with a frozen non-linear **4-ring** `ADJACENCY` (`city-district.mjs:38-43`).
- **Per-block DO**: each block is its own `CityRoom` via `idFromName(cityId)`. The routing helper `resolveCityRoomId()` is **defined** in `arcade/city/city-block.mjs:202` and **called** from `workers/arcade/src/index.ts:57` and `workers/arcade/src/city-room.ts:190-191`. Adding a block adds **no DO class and no migration** — the source comment at `city-block.mjs:163-164` states this explicitly.
- **1 coordinator**: a single `CityRegistry` instance via `idFromName("city-registry")` (`city-room.ts:146`), reached only DO-to-DO, holding `cityHeartbeats: Record<string, CityBeat>` where each beat is `{population, last_seen_at}` (`city-registry.ts:19-24`).

The Phase 8 task is to make the **district dimension** scale (more blocks, more districts, richer adjacency) **without** touching the per-block authority kernel and **without** the registry fan-out becoming the bottleneck the grounding facts flag.

> Note on grounding: the SUMMARY block refers to "the current 3-block line"; the real frozen config is **4 blocks in a non-linear ring** (`city-district.mjs:38-43`, Phase 6D). This plan generalizes the **4-ring**, which is the actual shipped state.

---

### 1. Block / district scale model (STATIC CONFIG, 8A baseline)

**Generalization: `D` districts × `B` blocks, with a per-district adjacency graph.**

The current model is a degenerate case: `D = 1`, `B = 4`, adjacency = one 4-cycle. We generalize along two axes while keeping every block byte-identical in geometry (a hard invariant from the grounding facts — "per-block geometry/portals/spawns must stay byte-identical across blocks or it breaks shared collision authority").

**1a. Naming scheme (static, declarative).**
Today a block id is a flat slug (`downtown-01`). For `D > 1` we make the district explicit in the id without breaking the existing 4 ids:

- Block id form: `<district-slug>-<block-slug>-NN`, e.g. `neon-downtown-01`. The existing 4 ids (`downtown-01` … `foundry-04`) are grandfathered as district `neon-district-01`'s members (no rename in 8A — rename would break `sanitizeCityId`-keyed storage and every CF package `target_city_id`, which is a frozen 5-value set `downtown-01|harbor-02|skyline-03|foundry-04|generic` in `creator-tokens.mjs:41`).
- A new `DISTRICTS` frozen catalog parallel to `CITY_ROOMS`, each entry `{ district_id, district_name, block_ids:[…], adjacency:{…} }`. `ADJACENCY` (`city-district.mjs:38-43`) becomes per-district and is **still a frozen static object**, not dynamic.

**1b. Adjacency beyond a ring.**
The routing layer already enforces "directly-adjacent only" via `validateRouteRequest()` → `areAdjacent()` (`city-district.mjs:148-157`, `57-59`), which is graph-shape-agnostic. So richer intra-district graphs (a 2×2 grid = 4 nodes/4 edges, a 3×3 grid = 9 nodes/12 edges, a hub-and-spoke) require **only a different frozen `adjacency` object** — zero authority-code change. Cross-district routing is **out of scope for 8A**: districts are isolated islands; traveling between districts is a later design (would need a district-level adjacency object and a `validateDistrictRoute`, kept equally static and bounded).

**1c. Concrete 8A target and bounds.**

| Quantity | Today (real) | 8A static target | Hard rationale / cap source |
|---|---|---|---|
| Districts `D` | 1 | 1 (unchanged) | 8A is "scale the existing district," not multi-district |
| Blocks `B` | 4 | up to **9** (3×3 grid OR two rings) | Keeps `districtManifest` broadcast small; see §3 trigger |
| Capacity/block | 24 (`city-block.mjs:168-171`) | 24 (unchanged) | Per-DO cap; do **not** raise — snapshot fan-out per block grows with occupancy |
| District events | `WINDOW_MS=300000`, `ANNOUNCE_MAX=8` (`city-district-events.mjs:36,38`) | unchanged | `blockForWindow(index)` calls `pick(CITY_IDS, index)` (`city-district-events.mjs:153-154`), which already generalizes over any `B` |
| Activity feed | `ACTIVITY_FEED_MAX=16` (`city-district-activity.mjs:28`) | unchanged | Bounded regardless of `B` |

`B = 9` is the **8A ceiling**, not an arbitrary number: it is the largest block count where (a) the full adjacency graph in `city_blocks` stays small (9 nodes is still a few hundred bytes), and (b) cold-DO seed ordering stays `O(B)` per the grounding-fact constraint ("seed must be O(1) per block, not a scan; currently O(4) … fine at current scale"). Past `B = 9` the manifest-broadcast risk (§3) is real and we switch strategy rather than just enlarging the list.

**8A touches:** `arcade/city/city-block.mjs` (`CITY_ROOMS` list grows), `arcade/city/city-district.mjs` (`ADJACENCY` becomes the chosen static graph), tests under `tests/arcade/city-district*.test.mjs` and `tests/arcade/city-block*.test.mjs`. It does **NOT** touch `city-room.ts`, `city-registry.ts`, `wrangler.toml` migrations, or any CF-* file. Byte-identical geometry is preserved (only `display_name`/`theme`/labels differ, exactly as Phase 5B already does via `publicLayout`).

---

### 2. CityRoom naming / district-sharding model

**Decision for 8A: keep per-block `idFromName(cityId)`. Do not coalesce or geo-shard.**

The grounding facts explicitly describe the alternative ("a per-district shard would coalesce multiple blocks into one DO … or shard by geography") and enumerate the five things it would touch: `idFromName` scheme, `CityRoom` state schema, `reportPresence` cadence/aggregation, stewardship/style storage, and trial instance scoping. That is a **storage/broadcast-layer redesign** of `city-room.ts`. We do **not** pay that cost in 8A because the pure authority (`city-block.mjs`) already scales and the per-block DO model has zero coordination cost between blocks.

**Naming model as `B` grows (8A → 8B staged):**

- **8A (static, ≤9 blocks):** `idFromName(cityId)` unchanged. New block ids slot into `CITY_ROOMS`. Each is its own DO; no new DO class, no migration (consistent with `wrangler.toml:36-43` where v3=`CityRoom`, v4=`CityRegistry` and the comment in `city-block.mjs:163-164` that "adding blocks adds no DO class and needs no migration").
- **8B (only if a single district outgrows ~9 blocks AND we still want one district):** introduce a **district-scoped registry** (see §3) — still **not** coalescing blocks into one DO. Block→DO mapping stays `idFromName(cityId)`; what changes is which *registry* a block reports to (`idFromName("city-registry/<district_id)")`).
- **Coalescing blocks into one per-district DO is explicitly REJECTED** for the foreseeable plan: it would re-introduce a single hot DO holding all players in a district, contradicting the per-block 24-cap isolation that makes snapshot fan-out bounded. We only revisit it if a future product requirement needs cross-block-in-one-instance physics, which Phase 8 does not.

**8B touches (if triggered):** `city-room.ts` (the `idFromName("city-registry")` literal at line 146 becomes a per-district name), `city-registry.ts` (instance-per-district), and `wrangler.toml` (no new binding — same `CityRegistry` class, just more named instances; **no migration**, because DO instances of an existing class need none). The pure layers (`city-district.mjs`, `city-district-presence.mjs`) are unaffected.

---

### 3. CityRegistry scale limits & the explicit SHARDING TRIGGER

**Current single-registry load (real numbers).**
One `CityRegistry` instance receives a heartbeat from every `CityRoom` on join/leave **and** on each `STALE_SWEEP_MS = 30_000` (30s) alarm tick (`city-room.ts:70, 142-157`; `city-registry.ts:51-60`). Each heartbeat is one DO-to-DO `fetch` carrying `{cityId, population}` and echoing back the whole `cityHeartbeats` map. State is `Record<string, {population:number, last_seen_at:number}>` — **tiny**: at `B = 4`, four entries.

So the registry's steady-state write load is bounded by:

```
heartbeats/sec  ≈  B / 30   (alarm-driven baseline)  +  join/leave events
```

At `B = 4` that is ~0.13 alarm-writes/sec baseline. At `B = 9`, ~0.3/sec. Both are negligible. The registry is **not** the near-term bottleneck; the grounding facts confirm the registry "becomes a bottleneck" only "with 100+ blocks."

**The real fan-out cost is on the CityRoom side, not the registry.**
`broadcastDistrictPresence()` (`city-room.ts:166-170`) and the `districtManifest()` it derives (`city-district.mjs:127-139`) build a `blocks:[…]` array of length `B` and an `adjacency` map of `B` keys, then push to every connected socket on change. This is `O(B × sockets_in_block)` per push. The grounding-fact SCALE RISK names exactly this: "District manifest and adjacency graph must stay declarative and bounded; growing to many blocks/districts means don't broadcast full graph if it grows large."

**Explicit, measurable SHARDING / STRATEGY-CHANGE TRIGGERS.**
Three independent triggers; whichever fires first forces the named change. Numbers are anchored to the mapped caps; where the grounding facts give no measured value I say **to measure** rather than invent.

| # | Trigger (measured threshold) | Why this threshold | Forced change |
|---|---|---|---|
| **T1 — Manifest size** | `B > 9` in one district, i.e. the `blocks[]`+`adjacency` payload in `city_blocks` would exceed a **to-measure byte budget** (target: keep manifest well under the existing per-message norms; the Worker bundle is 200.80 KiB / 44.10 KiB gz per the budget facts, but the **per-message** manifest budget is **to measure** — there is no mapped cap for a single `city_blocks` payload). | 9 blocks is the static ceiling from §1c; beyond it the full-graph broadcast is the risk the facts flag. | **Stop broadcasting the full graph.** Send only the current block + its `adjacentBlocks()` neighbours (defined at `city-district.mjs:51-54`) and let clients lazy-request distant blocks via the existing `city_blocks_request`. Touches `city-district.mjs` (a `partialManifest`) + client; **not** the registry. |
| **T2 — Registry entry count** | `B (× D) > 64` total heartbeat entries across all districts served by one registry. | 64 is the repeated bound throughout the codebase: `isPlainData` arrays ≤64, objects ≤64 keys (`validation-report.mjs:21,26`); aligning the registry-entry cap to the same number keeps one mental model. (This is a **chosen** cap, not a measured DO limit — the true `CityRegistry` storage/CPU limit is **to measure** on workerd.) | **Split CityRegistry per district**: instance name `"city-registry/<district_id>"` instead of the single `"city-registry"` (`city-room.ts:146`). Each district registry holds ≤ its own `B` entries. No new DO class, no migration. |
| **T3 — Heartbeat/alarm load** | A single registry's heartbeat-handling, or a single CityRoom's 30s sweep, exceeds its **time budget** — concretely: the `STALE_SWEEP_MS=30_000` alarm in any DO cannot complete its presence report + sweep within one tick, OR registry `fetch` p99 latency climbs such that `reportPresence()` regularly times out (it is fail-open: `city-room.ts:154-156`). Exact ms budget is **to measure** under load on workerd. | The facts state the revisit trigger is "single registry alarm sweep exceeding time budget" — this is the load-based, not count-based, version of the same split. | Same split as T2 (per-district registries), **plus** consider raising `STALE_SWEEP_MS` for low-churn blocks (display-only timing; does not affect authority). |

**Order of defense (cheapest first):** T1's *partial-manifest* fix is preferred over any sharding, because it removes the dominant `O(B)` cost without touching the DO topology at all. Registry splitting (T2/T3) is the second line and is itself cheap (more instances of the same class, no migration). Coalescing into per-district DOs is never the answer to these triggers.

---

### 4. Staged rollout

| Stage | Default | Scope | Files touched | Gate to next |
|---|---|---|---|---|
| **8A** | **STATIC CONFIG** | 1 district, grow `B` from 4 → up to 9 via static `CITY_ROOMS` + chosen static `ADJACENCY`; geometry byte-identical | `city-block.mjs`, `city-district.mjs`, `tests/arcade/city-*` | All existing unit + city-block + district smoke green; `check-city-build-size.mjs` still PASS (today 0.810 MB / 80 MB) |
| **8B** | STATIC CONFIG | Partial-manifest broadcast (T1) once `B` approaches 9; *only if needed* per-district `CityRegistry` instances (T2/T3) | `city-district.mjs` (+ client) for T1; `city-room.ts` registry-name + `city-registry.ts` for T2/T3 | Measured manifest byte budget + registry entry/latency thresholds (the **to-measure** numbers above) recorded before any split |
| **(later, gated)** | not in Phase 8 | Multi-district `D > 1`, cross-district routing; *separately,* package-backed/live-loaded districts behind CF-7 | — | A real package-loading use case **and** a separate human-cleared, staging-verified CF-7 enablement gate. **Not designed here beyond the naming hooks in §1a.** |

Every stage keeps `LIVE_WORLD_LOADER_ENABLED=false`, adds no DO migration (block/registry-instance growth needs none — `wrangler.toml:27-43` v1–v4 stay frozen), and introduces no economy/ownership/account surface.

---

### 5. Falsifiable / how we'd know it's wrong

- **If geometry must diverge per block** (a real product wants block-specific collision, not just labels), the "byte-identical geometry, `B` is free" premise breaks — shared collision authority (`city-block.mjs` + `city-collision.mjs`) would fork per block, and §1's "more blocks = more static entries" model is wrong. Falsifier: any requirement that changes `BUILDINGS`/`SPAWN_POINTS`/`PORTALS` per `cityId`.
- **If the registry is the bottleneck before the manifest is** (measured registry `fetch` p99 or sweep time blows up at `B` well below 9), then T2/T3 should fire before T1, inverting the "fix the manifest first" order. Falsifier: load test showing registry CPU/latency saturating while manifest payload is still small.
- **If a single `city_blocks` payload at `B = 9` is already too large** (the **to-measure** byte budget is smaller than the 9-block graph), then `B = 9` is the wrong static ceiling and the partial-manifest (T1) must land *before* 8A grows past ~6 blocks. Falsifier: measured `districtManifest()` output bytes at `B = 9` exceeding the recorded per-message budget.
- **If `idFromName(cityId)` collides or mis-resolves** as ids gain the `<district>-<block>` prefix (e.g. `sanitizeCityId`'s 48-char / `[a-z0-9-]` bound at `city-block.mjs:193-194` rejects a longer compound id), the §1a naming scheme is wrong and ids must stay flat. Falsifier: a `resolveCityRoomId` round-trip test failing on a prefixed id.
- **If per-district registry splitting needs a migration** (contrary to the claim that new *instances* of an existing `CityRegistry` class need none), then T2/T3 are more expensive than stated and must be re-planned. Falsifier: workerd/wrangler requiring a `[[migrations]]` tag bump to spin up `"city-registry/<district_id>"` instances of the already-migrated `CityRegistry` class.

**Relevant files:** `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city-block.mjs`, `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city-district.mjs`, `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city-district-presence.mjs`, `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city-district-events.mjs`, `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/arcade/city/city-district-activity.mjs`, `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/workers/arcade/src/city-room.ts`, `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/workers/arcade/src/city-registry.ts`, `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/workers/arcade/wrangler.toml`, `/home/thebackhand/Downloads/clovelearn_v3_final_deploy/scripts/check-city-build-size.mjs`.

---

## 2. Presence at Scale — interest management trigger

### Scope and what stays true

This section designs *when* and *how* the city would switch from today's broadcast-all district presence to **interest-scoped** presence, and nothing more. It is PLAN ONLY for Phase 8. It does not flip `LIVE_WORLD_LOADER_ENABLED`, does not touch CF-7, ships no code, and adds no economy/ownership/accounts. The Phase 7 movement kernel and the closed creator boundary are assumed unchanged; presence scoping is designed *around* them.

The invariant that must survive every variant below is the existing **public-safe presence-delta allowlist**. In `arcade/city/city-district-presence.mjs`, `buildPresenceDelta` (line 86) re-projects every block through the three live public fields (`population`, `health`, `population_is_estimated`) before anything reaches the wire, so a delta is structurally incapable of carrying player ids, balances, ledger, inventory, socket/connection ids, or account ids. **Interest management changes WHICH blocks a client is told about and HOW OFTEN — never WHAT a block's projection contains.** Scoping is a filter over an already-public, already-count-only stream.

### Today's fan-out shape (the thing we are bounding)

Two distinct fan-outs exist; only one is the scale risk.

1. **District presence delta** (`workers/arcade/src/city-room.ts`): `broadcastDistrictPresence` (line 166) calls `deriveDistrictPresenceDelta` and, when `r.delta` is non-null, `this.broadcast({ t: "city_district_presence", ... })` (line 169). `broadcast` iterates `this.sockets.keys()` (line 477). The delta payload is bounded — `diffDistrictPresence` emits at most `CITY_IDS.length` entries (one per block; currently **4**) — but it is sent to **every socket on the block** on every public summary change. Per-block presence cost is therefore `O(C_per_block)` message-sends, where each message carries a payload of `O(B)` entries. Across all blocks sweeping simultaneously the worst case is `B × capacity` = 4 × 24 = **96 message-sends per sweep**, each carrying up to 4 block entries. This is the path interest management targets *at higher block counts*, where B grows and every block's sockets each receive a wider payload — not at today's B=4.
2. **Position snapshot** (`broadcastSnapshot`, line 472–473) is per-block, occupancy-bounded, and capped by the **24**-player capacity; it is out of scope here (a separate "snapshot fan-out / interest" trigger covers single-block occupancy and is not reached at capacity 24).

So the presence fan-out that grows with the *map* (not with single-block occupancy) is the district-presence delta, and it grows on two axes: **block count B** (payload breadth per message) and **client count C** per block (message count per sweep).

### The interest-management trigger (the measured threshold)

The trigger is defined on the **district presence map**, because that is the structure whose breadth scales with the map. Switch from broadcast-all to interest-scoped when ANY of the following measured conditions holds. Numbers in brackets are anchored to mapped constants; numbers marked **to measure** are deliberately not invented.

- **T1 — Block-count breadth.** When blocks-per-district **B > 12**. Rationale: a delta payload is at most `CITY_IDS.length` entries; the manifest `adjacency` map (`districtManifest`, `city-district.mjs:127`) and `blocks` array are both `O(B)`. The grounding "District manifest and adjacency graph must stay declarative and bounded… don't broadcast full graph if it grows large" is the stated revisit cue. **12** is chosen as **3× the current 4-block ring** — far enough to give 8A headroom, small enough that the full graph is still cheap below it. The exact CPU/payload knee is **to measure** against the Worker bundle and the `SNAP_REQ_MIN_MS = 250` request floor (`city-room.ts:71`).
- **T2 — Per-tick fan-out.** When the per-block presence fan-out — `(occupants_on_block)` message-sends per block, each carrying `O(B)` entries, summed across the district per ~30 s alarm sweep — exceeds a measured Worker CPU/wall budget for one `broadcastDistrictPresence` cycle. The sweep cadence is fixed by `STALE_SWEEP_MS = 30_000` (`city-room.ts:70`) and the freshness windows `CITY_HEARTBEAT_TTL_MS = 30_000` / `CITY_STALE_TTL_MS = 90_000` (`city-district.mjs:64–65`); the per-cycle budget itself is **to measure** (we do not have a measured ms-per-broadcast number in the grounding facts).
- **T3 — Tracked-entity ceiling.** When total tracked live entities across the district — `Σ population` over blocks, bounded today by `B × 24` — exceeds the point where a single `CityRegistry` heartbeat sweep (the `idFromName('city-registry')` coordinator, `city-registry.ts:51–60`) cannot complete inside its alarm window. The grounding names this directly: "single CityRegistry DO fronting all district clients is potential bottleneck… revisit trigger is block count exceeding threshold or single registry alarm sweep exceeding time budget." The sweep-time budget is **to measure** on the real DO.

The **first** of T1/T2/T3 to trip is the trigger; T1 (a static config count) is the one we can evaluate without live load, so it is the **8A design gate**. T2/T3 are runtime gates that only become evaluable once a district is configured past 4 blocks, and they are explicitly **to measure**.

### Scoping model (what "interest-scoped" means here)

When the trigger fires, a client no longer receives the whole-district diff. Instead it receives presence only for its **interest set**, computed from data the server already owns and already treats as public:

- **Primary scope — adjacent-district (graph-local).** A client's interest set = its current block + that block's `adjacentBlocks(cityId)` (`city-district.mjs:51`). This reuses the **frozen, symmetric, public-safe** `ADJACENCY` graph (lines 38–43) that already governs routing — no new topology, no new authority. For the current ring, "current + 2 neighbours" is 3 of 4 blocks; the saving only appears once B grows, which is exactly the regime the trigger selects. This is the **8A baseline scope** because it is purely a filter over the existing manifest and adjacency, needs no new field, and is the only scope that is meaningful without per-player viewport data.
- **Secondary scope — cap-N-nearest (graph distance).** When even the adjacency frontier is large (high-degree graphs at large B), bound the interest set to the **N** graph-nearest blocks by BFS over `ADJACENCY`, N a small static config value (e.g. start at the adjacency degree, **to measure** for the chosen large-B topology). This keeps the per-client delta payload size `O(N)` instead of `O(B)`.
- **Viewport scope is explicitly deferred.** A literal screen/viewport interest set would require the server to reason about client camera state. That is more coupling than Phase 8A should take and is not needed while districts are graph-of-blocks rather than one continuous world. Viewport scoping is a **later, separate** design item, not the 8A baseline.

Authority is unchanged in all scopes: `CityRegistry` stays the DO-to-DO coordinator (never client-facing, `city-registry.ts:51–60`), each `CityRoom` stays its block's authority, and scoping is applied at the **broadcast/projection boundary inside `CityRoom`** (the same place `broadcast` already filters to `this.sockets.keys()`), not in the pure diff module.

### Where the change lands (and where it must not)

- **Pure layer stays whole-district.** `diffDistrictPresence` / `buildPresenceDelta` / `deriveDistrictPresenceDelta` in `arcade/city/city-district-presence.mjs` keep producing the canonical full-district diff. Interest scoping is a **filter applied after** the pure diff, so `buildPresenceDelta`'s re-projection (line 86) still runs on every block before anything reaches a socket. The allowlist therefore cannot be bypassed by scoping.
- **A new pure helper** (e.g. `interestScopedBlocks(manifestOrDelta, currentCityId, scope)` living alongside the existing functions, design-only) would take the canonical diff plus the client's server-owned `boundCityId` and return the subset for that client's interest set — pure, deterministic, allowlist-preserving, unit-testable like its neighbours.
- **The DO boundary** (`broadcastDistrictPresence`, `city-room.ts:166–170`) would, above the trigger, send each socket only its scoped subset instead of the shared payload. Below the trigger it sends the shared payload exactly as today (zero behavioral change at 4 blocks).
- **Dev-shim parity is mandatory.** `workers/arcade/city-dev-shim.mjs` mirrors the DO broadcast (lines 59–63). Any scoping must be added in the shared pure helper so DO and shim stay byte-identical, exactly as Phase 5D did.

### Degradation / fallback

- **Below the trigger:** broadcast-all (today's behavior). No client ever loses district-wide presence while B ≤ 12 and the runtime budgets hold.
- **Scope-resolution failure (unknown/garbage `boundCityId`, empty interest set):** fall back to the client's **own block only**, never to "send nothing" and never to "send everything." Own-block presence is always available because the client is admitted there by that block's authority. This is fail-safe: the worst case is a client temporarily sees only its own block's count, which is strictly less information, never more, and never private.
- **Registry unavailable (T3 regime):** the existing fail-open already applies — `presenceCache` missing → blocks read `unknown/0` via `cityPresenceEntry` (`city-district.mjs:82–92`), flagged `population_is_estimated:true`. Interest scoping inherits this: a scoped client of a degraded registry sees estimated counts for its interest set, identical semantics to today, just narrower breadth.
- **Reconnect / re-baseline:** on join, `handleJoin` already sends the full manifest then a delta (`city-room.ts:284–288`). Under scoping, the join manifest can stay full (it is `O(B)` and bounded by T1's own gate) while *ongoing* deltas are scoped; this preserves the "a (re)connect always sees the public-safe district manifest" contract (line 285) without flooding steady-state.

### Staging (8A-first)

- **8A (this plan):** define T1 = **B > 12** as the design gate; specify adjacent-district as the baseline scope; specify the pure-helper-plus-DO-boundary placement; keep the 4-block ring on broadcast-all (no behavioral change ships). Add T2/T3 as **to-measure** runtime gates with named budgets but no invented numbers.
- **8B+ (later, gated):** only if/when a district is actually configured past 4 blocks would T2/T3 be instrumented and the cap-N-nearest secondary scope be tuned. Any move past static config (e.g. package-backed districts) remains the separately gated, human-cleared, staging-verified path — out of scope here.

### Falsifiable / how we'd know it's wrong

- **The trigger is too late** if, *before* B reaches 12, a single `broadcastDistrictPresence` cycle or one `CityRegistry` alarm sweep is measured exceeding its per-cycle/alarm budget at realistic occupancy. Measure: per-broadcast wall/CPU time and registry sweep duration on the real DO (both **to measure** — not in current facts). If T2/T3 trip well below T1's B=12, lower T1.
- **The trigger is too early / unnecessary** if measured broadcast and sweep cost stay flat well past B=12 at full `B × 24` occupancy. Then T1's constant is too conservative and should rise (it costs only manifest breadth, not safety, to raise it).
- **The scope model is wrong** if adjacent-district scoping makes the district feel "dead" — i.e., users demonstrably need non-adjacent block presence for the product's discovery loop. Signal: discovery/travel behavior that depends on seeing far blocks' populations. If so, cap-N-nearest with larger N (or a later viewport model) is required instead of pure adjacency.
- **The invariant is violated** (hard fail, blocks the design) if any scoped payload can be shown to carry a field outside the three live public fields re-projected by `buildPresenceDelta`. Test: assert every scoped delta, like every full delta, passes the same re-projection; a scoped delta that differs from `buildPresenceDelta`'s output on anything but *which blocks are present* is a defect, not a tuning question.

### Referenced files

- `arcade/city/city-district-presence.mjs` — pure presence diff + allowlist re-projection (`buildPresenceDelta` line 86, `deriveDistrictPresenceDelta`)
- `arcade/city/city-district.mjs` — `ADJACENCY` (lines 38–43), `adjacentBlocks` (line 51), `districtManifest` (line 127), `cityPresenceEntry` (line 82), freshness windows (lines 64–65)
- `arcade/city/city-block.mjs` — `CITY_IDS`, per-block capacity 24
- `workers/arcade/src/city-room.ts` — `broadcastDistrictPresence` (lines 166–170), `broadcast` (line 477), `STALE_SWEEP_MS`/`SNAP_REQ_MIN_MS` (lines 70–71), join re-baseline (lines 284–288)
- `workers/arcade/src/city-registry.ts` — single `idFromName('city-registry')` coordinator (lines 51–60)
- `workers/arcade/city-dev-shim.mjs` — DO-parity presence broadcast (lines 59–63, mandatory mirror)

---

## 3. Asset Packs & Data Model — CF-5 packs into district composition; static config vs approved-package data

### 0. Scope and hard invariants (restated, non-negotiable)

This section designs *how a CF-5 asset pack would compose a larger district* and *where the static-config / approved-package-data line sits*. It is **PLAN ONLY** for Phase 8. No code, no migration, no deploy, no flag flip.

- **Phase 8A baseline = STATIC CITY CONFIG ONLY.** The district that ships/scales in 8A is the existing static topology in `arcade/city/city-district.mjs` and `arcade/city/city-block.mjs`. No district surface is package-backed in 8A.
- **`LIVE_WORLD_LOADER_ENABLED` STAYS `false`.** CF-7 is not enabled here. A CF-5 pack is a *local, offline, approved-hash-only composition* (`no_live_world_load: true` is a required constraint, defined in `arcade/creator/schemas/asset-pack-schema.mjs:35-39` (`REQUIRED_CONSTRAINTS` object, `no_live_world_load` at line 37), enforced in `arcade/creator/validator/validate-asset-pack.mjs:95-101`). Nothing in this section auto-loads a pack into a CityRoom DO.
- **Package-backed district data is a LATER, gated possibility** — never the 8A baseline, never auto-loaded. Any later step routes through the full CF-1..CF-8 validated/approved chain and the closed CF-7 loader, and is a separate human-cleared, staging-verified gate that only opens once a real package-loading use case exists.
- **No economy, ownership, rent, accounts, marketplace, payout, token, NFT.** A pack tile's `target_city_id` is a static *routing hint*, never an ownership claim. The CF-5 schema and validator already reject economy/ownership vocabulary via `FORBIDDEN_TERMS_RE` (`arcade/creator/validator/validate-asset-pack.mjs:48,53`).
- **HiveWorld untouched.** CityRoom-per-block + CityRegistry-cross-block stays the canonical authority model.

A CF-5 pack is **authoring/composition data**, not runtime authority. It describes *which approved block-restyle package would appear where on a tiled map*, for a **local map viewer** (`resolveAssetPack` in `arcade/creator/validator/validate-asset-pack.mjs:115`). The district's geometry, collision, presence, and routing remain owned by the static city kernel regardless of any pack.

---

### 1. How a CF-5 pack composes a district (within mapped bounds)

A CF-5 pack today (`arcade/creator/schemas/asset-pack-schema.mjs`) is a **bounded tiled grid** where each tile references an *already-approved, hash-addressed* block package:

- `grid: { cols, rows }`, each `1..MAX_COLS` / `1..MAX_ROWS` = `1..8` (schema lines 14-15; range validated at `validate-asset-pack.mjs:64-65`).
- `tiles[]`, `1..MAX_TILES = 32` (schema line 16), each unique `(gx, gy)` within grid bounds (validator lines 80-83).
- Each tile: `{ gx, gy, package_hash, package_kind }` where `package_kind ∈ {block_style, block_layered}` (`TILE_PACKAGE_KINDS`, schema line 21) and `package_hash` is `sha256:<64hex>` (`HASH_RE`, schema line 24).
- **The core CF-5 rule** (validator lines 86-91): every tile hash must `resolveApprovedPackage(registry, hash)` to a CF-2 `operator_approved_local` entry whose `package_kind` matches. An empty/invalid registry approves zero tiles — **fail-closed**.
- Whole pack ≤ `PACK_SIZE_MAX_BYTES = 8192` (8 KiB) over canonical JSON (validator lines 34-35).

**Composition mapping (8A, static-only).** A pack is a *design artifact that mirrors the static district*, not a thing the live district reads:

1. The static district has **4 blocks** in a non-linear ring (`ADJACENCY`, `city-district.mjs:38-43`): `downtown-01 ↔ harbor-02 ↔ skyline-03 ↔ foundry-04 ↔ downtown-01`. A pack tile's `target_city_id` (carried on the underlying `block_style`/`block_layered` package, `TARGET_CITY_IDS = [downtown-01, harbor-02, skyline-03, foundry-04, generic]`) is the *hint* of which static block a restyle was designed for.
2. A pack lays those approved restyle packages onto a grid for **local preview only**. The `resolveAssetPack` path returns renderable tiles only for hashes that are approved-local, present in the local package store, and whose recomputed canonical hash matches (tamper check) — `validate-asset-pack.mjs:110-120`. This never touches `CityRoom`, `CityRegistry`, the dev shim, or any DO.
3. **Geometry never comes from the pack.** Even where a tile renders a `block_layered` restyle, the block's collision/spawn/portal geometry is the byte-identical static `CITY_BLOCK` (`city-block.mjs`, WORLD 1000×1000, 4 buildings, 6 spawns, 1 portal). A pack can only re-skin; it cannot move a wall. This is the load-bearing invariant that keeps shared collision authority valid across blocks.

So in 8A: a pack is the **map-design view of the static district**. The district renders from static config; the pack is a parallel, offline composition that *references the same approved restyle packages* a human might later (under a separate gate) propose for those blocks.

---

### 2. Asset-pack bounds for larger maps (scaled up, anchored to current bounds)

The current pack is deliberately *"a SMALL local composition, not a world"* (schema comment, `asset-pack-schema.mjs:13`). A district-scale composition needs a **larger but still hard-bounded** profile. Rather than relax the existing `city_asset_pack` (which protects CF-5's "small composition" guarantee and the 256-entry CF-2 registry it resolves against), the plan is a **separate, additively-versioned pack profile** for district maps. The existing `city_asset_pack` bounds are **frozen**.

**Proposed `city_district_map` profile (PLAN — not implemented in 8A):**

| Bound | Current `city_asset_pack` | Proposed `city_district_map` | Rationale / anchor |
|---|---|---|---|
| `MAX_COLS` / `MAX_ROWS` | 8 / 8 | **16 / 16** | One static district = 4 blocks. A 16×16 grid (256 cells) gives ~64 cells per block headroom for a multi-block layout without becoming "a world". Anchored as 2× current edge. |
| `MAX_TILES` | 32 | **256** | = grid cells (16×16) and = `MAX_ENTRIES` of the CF-2 approved-package registry (`approved-package-registry.mjs:16`) and the CF-7 live-registry (`live-registry.mjs:27`). A pack can never reference more distinct approved packages than the registry can hold — keeps the resolve loop O(registry). |
| `PACK_SIZE_MAX_BYTES` | 8192 (8 KiB) | **65536 (64 KiB)** | 8× current, anchored to the largest existing package budget (`arcade_game` hard max 64 KiB, `arcade-game-package-schema.mjs:16`). 256 tiles × ~32 B of canonical `{gx,gy,hash,kind}` ≈ 8 KiB of tile data; 64 KiB leaves generous structural headroom while staying nowhere near the GTA-80 client budget (current city client = 0.810 MB of 80 MB). |
| Distinct blocks referenced | n/a (single-block compositions) | **≤ static block count (4)** + `generic` | A district map references the *4 real blocks* only; tiles outside those `target_city_id`s (except `generic`) are rejected. Grows only when the static block count grows (see §4 trigger). |
| `MAX_SYMBOLS` per layered tile | 6 (`block-layered-package-schema.mjs:26`) | **6 (unchanged)** | Per-block visual composability bound stays; a district map does not relax per-package limits — it only places more *already-bounded* packages. |
| `TILE_PACKAGE_KINDS` | `block_style`, `block_layered` | **unchanged** | No new tile kinds. No `arcade_game` tiles (games are cabinets, not map cells). |
| Deny-by-default keys / forbidden terms / `no_live_world_load` | enforced — `FORBIDDEN_TERMS_RE` at `validate-asset-pack.mjs:48,53`; `scanSafety` at line 36; `REQUIRED_CONSTRAINTS` defined in `asset-pack-schema.mjs:35-39`, enforced in validator at lines 95-101 | **enforced identically** | The larger profile inherits *every* CF-5 safety gate verbatim. Scaling the grid does not scale the trust surface. |

**Why a new profile, not a relaxed CF-5:** flattening the limits on `city_asset_pack` would silently raise the blast radius of every existing 8 KiB pack and break the "small composition" contract that CF-5 docs and tests assert. An additive `city_district_map` profile (its own `pack_kind`, its own schema constant file under `arcade/creator/schemas/`) keeps CF-5 byte-frozen and isolates the larger bounds behind their own validator and review — same pattern CF-3 used to add `block_layered` without touching `block_style`.

**Still bounded, still offline.** Even at 256 tiles / 64 KiB, the district-map pack carries `no_external_assets`, `approved_hashes_only`, and `no_live_world_load` as required-true constraints. It resolves only against the CF-2 approved-local registry, renders only in the local map viewer, and never reaches a DO.

---

### 3. Static city config vs approved-package data — the explicit line (per surface)

**Phase 8A column is authoritative now.** The "Could later become approved-package data" column is a **gated possibility only** — it describes what a *future, separate, human-cleared, CF-7-routed* step could move to package data, and what would never move. Nothing in this column is auto-loaded; everything in it would enter through CF-1 schema → CF-2 approval → CF-6 hive validation → CF-8 human review → (only then, under a separate gate) CF-7.

| District surface | Owner file(s) | **8A: STATIC CITY CONFIG** | Could LATER become approved-package data (gated, never auto) | **Must STAY static (never package-backed)** |
|---|---|---|---|---|
| **Block geometry** (WORLD 1000×1000, 4 buildings, 6 spawns, 1 portal, collision AABB, walkable boundary) | `arcade/city/city-block.mjs`, `arcade/city/city-collision.mjs` | Static, byte-identical across all 4 blocks | — | **STAY STATIC.** Shared collision authority + per-block identity both depend on byte-identical geometry; package data cannot move a wall/spawn/portal. Hard invariant. |
| **Block style / restyle** (palette, facade, sign, symbols, windows, roof, lighting zones) | `arcade/city/city-block.mjs` (default style), CF-1 `block-package-schema.mjs`, CF-3 `block-layered-package-schema.mjs` | Static per-block default style (`defaultBlockStyle`, Phase 5B) | **Yes** — this is the *only* surface CF-5 packs describe. A `block_style`/`block_layered` package (≤8 KiB / ≤12 KiB, closed tokens, ≤6 symbols, ≤4 zones) approved through CF-1→CF-8 *could* later supply a block's skin. Renders from static token→hex lookup; package carries tokens only. | Token→hex lookup, glow multipliers, decal/window/roof *shape geometry* stay static config (`creator-tokens.mjs`); package supplies only closed-token *selections*. |
| **Landmarks / labels** (DATA SPIRE, HARBOR CONTROL, etc.) | `arcade/city/city-block.mjs` (`BLOCK_LABELS`, Phase 5B) | Static per-block label overlay on byte-identical geometry | **Possibly** — a label string *could* later be a screened free-text field of an approved package (CF-8 screens `display_name`/`operator_note` for profanity/slurs/harassment/impersonation/PII). | Label *positions/anchors* stay static geometry. Only the screened string could vary, and only post-CF-8. |
| **Interaction zones** (5 kinds: `arcade_entry`, `block_travel`, `district_event`, `activity_board`, `block_preview`) | `arcade/city/city-interactions.mjs` (`INTERACTION_KINDS` frozen, `FORBIDDEN_RE`, validators) | Static, server-defined regions; deny-by-default kinds | **No (recommend STAY static)** | **STAY STATIC.** Zones gate server actions (portal entry, block travel, Phase 7E receipts validated against server-owned position). Zone count must stay small/static so per-input `nearestInteractionZone` stays O(zones). Package-spawned zones would be a new attack surface against the receipt/route authority — out of scope, keep static. |
| **District manifest & adjacency** (`DISTRICT_ID`, `ADJACENCY` ring, route validation) | `arcade/city/city-district.mjs` (`ADJACENCY:38-43`, `validateRouteRequest:148`) | Static, frozen, symmetric ring; routes server-validated | **No (recommend STAY static)** | **STAY STATIC.** `validateRouteRequest` is the bounded-teleport guard and is *reused verbatim* by the Phase 7E receipt builder. Topology must remain declarative/frozen; making adjacency package-driven would let untrusted data reshape routing authority. |
| **Presence / population / health** (heartbeat cadence, eviction) | `city-district.mjs` (TTLs lines 64-65), `workers/arcade/src/city-room.ts`, `workers/arcade/src/city-registry.ts` | Static cadence (30s healthy / 90s offline), public-aggregate count only | **No** | **STAY STATIC + RUNTIME-OWNED.** Presence is live DO authority, never authoring data. A pack is design-time; it has no presence concept. |
| **Activity feed / district events** (12 activity types, 5 event types, windows) | `city-district-activity.mjs`, `city-district-events.mjs` | Static type lists + deterministic schedule (clamped env config only) | **No** | **STAY STATIC.** Deterministic, display-only, derived from wall clock + static manifest. Not package-shaped. |
| **The pack itself** (which approved restyle goes on which grid cell) | CF-5 `asset-pack-schema.mjs` / `city_district_map` (proposed) | n/a in 8A runtime (local viewer only) | **Yes** — the pack *is* the candidate package-data layer, but it composes only the *block-style surface* above, never geometry/zones/topology | The pack can reference only CF-2 approved-local hashes; it cannot introduce a new block, move geometry, or define a zone. |

**The line, in one sentence:** *Everything that is authority — geometry, collision, interaction zones, routing/adjacency, presence — stays static city config and runtime DO authority. The single surface that could later be package-backed is the per-block visual restyle, and only via the CF-1..CF-8 → (gated) CF-7 chain.*

---

### 4. Staging (8A-first) and concrete triggers

- **8A:** Static config only. District scale is achieved by static block/topology config in `city-district.mjs` + `city-block.mjs`. CF-5 packs (and any `city_district_map` profile) exist purely as **offline authoring + local-viewer** artifacts. No district surface reads a pack. `LIVE_WORLD_LOADER_ENABLED` stays `false`.
- **Trigger to even *design* the `city_district_map` profile in detail:** a real, stated map-authoring use case (e.g., an operator wants to lay out a multi-block district visually before hand-porting selections into static config). Until then, the bounds in §2 are a plan, not a schema.
- **Trigger to consider *any* package-backed block style at runtime (LATER, separate gate):** the static block count grows past **4** *and* hand-maintaining per-block static default styles becomes the bottleneck — *to measure* (we have no current pain; 4 static styles are trivial). Even then, enablement is the full CF-7 ladder under a human-cleared, staging-verified gate, not a config flip here.
- **Registry/scale guardrail:** `MAX_TILES` for the district profile is pinned to the **256** CF-2 registry ceiling so a district map can never reference more approved packages than exist; the resolve loop stays bounded by the registry, not by grid area.

---

### 5. Falsifiable / how we'd know it's wrong

This design is **wrong / must be revised** if any of the following turns out true:

1. **Geometry leaks into a pack.** If a `city_district_map` tile (or any CF-5 pack) can affect block geometry, collision, spawns, or portals — not just the token-restyle surface — the static/approved line is broken (shared collision authority would diverge per block). Falsifier: a pack field that changes anything in `city-block.mjs` WORLD/BUILDINGS/SPAWN_POINTS/PORTALS or `city-collision.mjs` walkable area.
2. **A pack reaches a DO in 8A.** If `CityRoom`, `CityRegistry`, or the dev shim ever reads a pack/`package_hash` in Phase 8A, the "static-config only / offline composition" claim is false. Falsifier: any reference to `resolveAssetPack`, `city_asset_pack`, or `city_district_map` in `workers/arcade/src/city-room.ts` or `workers/arcade/city-dev-shim.mjs`.
3. **`MAX_TILES` exceeds the registry ceiling.** If the district-map `MAX_TILES` is set above the CF-2 registry `MAX_ENTRIES` (256, `approved-package-registry.mjs:16`), a pack could reference unresolvable hashes and the O(registry) bound is gone. Falsifier: `MAX_TILES > 256`.
4. **Forbidden vocabulary or `no_live_world_load:false` passes.** If the larger profile does not inherit `FORBIDDEN_TERMS_RE` / `scanSafety` / required `no_live_world_load`/`approved_hashes_only` constraints verbatim, the scaled pack relaxed the trust surface. Falsifier: a 16×16 pack validating with an economy term in `pack_id`/`display_name`, or with `no_live_world_load !== true`.
5. **Interaction zones or adjacency become package-driven.** If routing (`validateRouteRequest`/`ADJACENCY`) or interaction zones (`INTERACTION_KINDS`) end up reading package data, untrusted data is reshaping authority. Falsifier: a pack field that adds/removes a zone or an adjacency edge.
6. **Bounds are guessed, not measured.** The growth trigger ("static block count > 4 *and* per-block style maintenance is the bottleneck") is *to measure* — if we cite a concrete player/block number we don't have, that number is invented and the trigger is unsound.

**Files referenced:** `arcade/creator/schemas/asset-pack-schema.mjs`, `arcade/creator/validator/validate-asset-pack.mjs`, `arcade/creator/schemas/block-layered-package-schema.mjs`, `arcade/creator/schemas/block-package-schema.mjs`, `arcade/creator/schemas/arcade-game-package-schema.mjs`, `arcade/creator/schemas/creator-tokens.mjs`, `arcade/creator/approval/approved-package-registry.mjs`, `arcade/creator/approval/live-registry.mjs`, `arcade/creator/approval/live-loader.mjs`, `arcade/city/city-district.mjs`, `arcade/city/city-block.mjs`, `arcade/city/city-collision.mjs`, `arcade/city/city-interactions.mjs`, `arcade/city/city-district-activity.mjs`, `arcade/city/city-district-events.mjs`, `workers/arcade/src/city-room.ts`, `workers/arcade/src/city-registry.ts`, `workers/arcade/city-dev-shim.mjs`, `scripts/check-city-build-size.mjs`.

---

## 4. Deferred Staging Candidate Path — how an approved package could later enter staging via CF-7 (not yet) + operator workflow

**Status: DESIGN ONLY. LIVE_WORLD_LOADER_ENABLED stays false in Phase 8. No package enters staging under CF-7 during Phase 8. The trigger to actually execute this path is a later, separate operator authorization that requires a concrete use case to exist first.**

---

### Why this path is deferred and not Phase 8

The CF-7 live loader (`arcade/creator/approval/live-loader.mjs`) is shipped permanently disabled via the module constant `LIVE_WORLD_LOADER_ENABLED = false` in `arcade/creator/approval/approved-loader.mjs`. This constant is the single shared gate imported by both the CF-2 loader and CF-7 loader. Phase 8 is a scale plan for the existing city and block topology; it does not create any package-loading use case that would justify opening the staging path. The path below exists as a design record so that when a use case does arise, the precondition chain and operator steps are already specified and reviewable — not assembled ad hoc under time pressure.

The actual trigger for this path is an explicit, separate operator authorization worded as: **"AUTHORIZED: ENABLE CF-7 STAGING CANDIDATE FOR PACKAGE \<hash\>"** naming the specific package, followed by staging-environment verification before that flag ever ships anywhere.

---

### Precondition chain — what must be true before the path opens

Every item below is a hard gate. The chain is sequential; no later item can substitute for an earlier one. Items map to CF-7 loader gates `[0]–[9]` in `live-loader.mjs`.

**P1 — A concrete use case exists.**
The package-loading path must solve a stated problem in the live city. "We want to see if it works" is not sufficient. The use case must name a target_city_id (one of `downtown-01`, `harbor-02`, `skyline-03`, `foundry-04`, or `generic` per `creator-tokens.mjs`) and the block rendering surface where the package would render, so the staging test can verify the exact visual outcome rather than loading into the void.

**P2 — CF-1/CF-3 package body is valid and hashed.**
The package must pass the canonical validator for its kind: `validateBlockPackage` (block_style, 8 KiB budget), `validateBlockLayeredPackage` (block_layered, 12 KiB budget), or `validateArcadePackage` (arcade_game, 64 KiB budget). The canonical hash is computed by `packageHash()` from `arcade/creator/validator/package-hash.mjs` (sorted-key canonical JSON, SHA-256). This hash is the identity anchor for every subsequent artifact.

**P3 — CF-2 local approval receipt exists and binds the hash.**
`buildApprovalReceipt()` in `arcade/creator/approval/approval-receipt.mjs` must have been called with `approval_status='operator_approved_local'` and `live_world_authorized` hard-wired to `false`. The resulting `receipt_hash` (SHA-256 over the receipt body, excluding the hash field itself) is the value `local_receipt_hash` in the later CF-7 live receipt. This receipt must be in the CF-2 approved-package registry (`arcade/creator/approval/approved-package-registry.mjs`) with `approval_status='operator_approved_local'`, `live_world_authorized=false`, and under the 256-entry (`MAX_ENTRIES`) registry cap.

**P4 — CF-6 hive validation verdict is valid.**
`buildHiveReceipt()` in `arcade/creator/hive-validation/hive-service.mjs` must have returned `verdict='valid'` for this package hash. The verdict receipt carries `status='local_validation_only'` (hard invariant) and `live_world_authorized=false` (hard invariant). `isReceiptIntact()` must verify the `receipt_hash` over the verdict body. This hash becomes `hive_verdict_receipt_hash` in the CF-7 live receipt. CF-6 grants zero live trust; its role is to confirm the package body was clean at a known point in time.

**P5 — CF-8 human review reaches `approved_for_live_candidate`.**
A review record must be created via `createReviewRecord()` in `arcade/creator/moderation/review-queue.mjs` binding the CF-2 `receipt_hash` and a `validator_report_hash`. A human reviewer must then call `decideReview()` with `to_state='approved_for_live_candidate'`, attesting all five `REQUIRED_REVIEW_CRITERIA`: `['profanity', 'slurs', 'harassment', 'impersonation', 'pii']` over the free-text fields `display_name`, `package_id`, and `operator_note`. The resulting `free_text_digest` (SHA-256 of the canonical encoding of those three string values) is frozen at this point. Any subsequent edit to those three strings breaks the digest and invalidates the live receipt — a full re-review is required. The record's `live_world_authorized` stays `false`; `isLiveCandidate()` returns true only when `state='approved_for_live_candidate'`, `free_text_reviewed=true`, `free_text_cleared=true`, and `revoked_at=null`.

**P6 — CF-7 live receipt is built.**
`buildLiveApprovalReceipt()` in `arcade/creator/approval/live-approval-receipt.mjs` is called with the CF-8 `reviewRecord` (must satisfy `isLiveCandidate()`), the `localReceiptHash` from P3, the `hiveVerdictReceiptHash` from P4, and `stagingVerified=true`. The function derives `live_world_authorized=true` — this is the only place in the codebase that emits that value at the receipt layer, and it is derived, not accepted as a parameter. The resulting `receipt_hash` seals the `LIVE_BODY_KEYS` fields. The `free_text_digest` from P5 is embedded in this receipt verbatim, creating the F3 binding.

**P7 — Live registry entry is created.**
`buildLiveRegistry()` in `arcade/creator/approval/live-registry.mjs` creates or updates a `creator_approved_live_packages` registry containing an entry for this `package_hash` with `approval_status='operator_approved_live'`, `live_world_authorized=true`, `revoked=false`, and a matching `live_approval_id`. The `revocation_epoch` must be a non-negative integer, initialized to `0` for a first entry and incremented on any revocation. The `registry_hash` seals the body. The registry must stay under 256 entries (`MAX_ENTRIES`).

**P8 — Client-side persisted monotonic epoch is initialized.**
The CF-7 loader gate `[8]` in `live-loader.mjs` has no default for `highestSeenEpoch` and intentionally fails with `epoch_source_unavailable` if the caller does not supply a valid non-negative integer. The client (or operator tooling) must persist the highest-seen `revocation_epoch` locally before the first load attempt. For a first-time staging run, this is initialized to `0` and must match or be below the registry's current `revocation_epoch`. The storage mechanism (localStorage, operator config file, or equivalent) must be specified before the path opens; this is "to measure" in terms of the exact implementation surface.

**P9 — Kill-switch is confirmed OFF.**
`killSwitchEngaged()` in `live-loader.mjs` returns true for any value other than the exact boolean `false` sentinel (`KILL_SWITCH_OFF = false` at line 47). The kill-switch input to `loadLivePackage()` must be explicitly passed as `false`. Any other value — `undefined`, `null`, `0`, the string `'false'` — leaves the kill-switch engaged. This must be a conscious operator choice, not a default.

**P10 — LIVE_WORLD_LOADER_ENABLED is flipped to true.**
This is the module constant in `arcade/creator/approval/approved-loader.mjs` line 31. It is not a runtime config flag, not an environment variable, and not a wrangler.toml var. Changing it requires a source edit, a new build, and a deliberate staging-only deploy. It must not be changed in the production Worker. The constant is re-exported by `live-loader.mjs` (line 44) so both loader files share the single value. Note: because `approved-loader.mjs` also uses this constant to gate the `LIVE_WORLD` mode of `loadApprovedPackage()` (line 53 of that file), flipping it to `true` in a staging build simultaneously opens the CF-2 `LIVE_WORLD` mode and the CF-7 live-loader path. The staging branch must be audited for any call sites of `loadApprovedPackage({mode:'live_world'})` in addition to `loadLivePackage()`.

---

### Operator workflow — step-by-step for one staging candidate

The following describes the sequence an operator follows to take a single package through the deferred staging path. Each step maps to one or more preconditions above and one or more CF-7 loader gates.

**Step 1: Confirm a use case exists and name the target (P1)**

Write a short use-case statement naming: the package kind, the `target_city_id`, the block DO that would render it (`CityRoom` identified by `idFromName(cityId)` in `workers/arcade/src/city-room.ts`), and the observable behavior to verify on staging. File this with the authorization request. Without a named use case, the path does not open.

**Step 2: Validate the package and record the canonical hash (P2)**

Run the appropriate validator locally:

- block_style: `validateBlockPackage()` from `arcade/creator/validator/validate-block-package.mjs`
- block_layered: `validateBlockLayeredPackage()` from `arcade/creator/validator/validate-block-layered-package.mjs`
- arcade_game: `validateArcadePackage()` from `arcade/creator/validator/validate-arcade-package.mjs`

Compute the canonical hash via `packageHash()`. Record the `sha256:<64hex>` string. This hash must remain stable; any mutation to the package body — including key reordering — invalidates all downstream artifacts and requires restarting from this step.

Verify the package body passes the `isJsonClean()` check (gate `[2]` in `live-loader.mjs`): no `undefined`, `NaN`, `Infinity`, functions, symbols, or non-plain objects. Check nesting depth stays under 64 levels and arrays under 64 elements (the `isPlainData()` limit in `arcade/creator/validator/validation-report.mjs` is the stricter bound at 8 levels and 64 elements per container).

**Step 3: Build the CF-2 local approval receipt and register it (P3)**

Call `buildApprovalReceipt()` from `arcade/creator/approval/approval-receipt.mjs` with:
- `packageHash`: the hash from Step 2
- `packageKind`: the package kind
- `status`: `'operator_approved_local'`
- `operatorNote`: free-text up to 200 characters (`NOTE_MAX`)

The returned receipt has `live_world_authorized: false` (CF-2 invariant, no parameter can change this). Record the `receipt_hash` value — this is the `local_receipt_hash` to be embedded in the CF-7 live receipt.

Add the package to the CF-2 approved-package registry via `arcade/creator/approval/approved-package-registry.mjs` with `approval_status='operator_approved_local'`, `live_world_authorized=false`. Confirm the registry is under 256 entries.

At this point, the package is eligible for `LOCAL_PREVIEW` mode only via `loadApprovedPackage()` in `approved-loader.mjs`. The `LIVE_WORLD` mode still rejects unconditionally.

**Step 4: Run CF-6 hive validation and record the verdict receipt hash (P4)**

Run `buildHiveReceipt()` from `arcade/creator/hive-validation/hive-service.mjs` against the package. Confirm `verdict='valid'`. The receipt carries `status='local_validation_only'` and `live_world_authorized=false` as hard invariants — if either is wrong, the CF-6 module has been modified and must be audited before proceeding.

Run `isReceiptIntact()` to confirm the `receipt_hash` verifies. Record the `receipt_hash` value as `hive_verdict_receipt_hash` for the CF-7 live receipt.

Note: a valid CF-6 verdict proves the package body was structurally clean. It does not screen free text (display_name, package_id, operator_note) for human-safety violations. That is CF-8's job.

**Step 5: Submit to CF-8 review and await human screening (P5)**

Call `createReviewRecord()` from `arcade/creator/moderation/review-queue.mjs` with:
- `package_hash`: from Step 2
- `package_kind`: the package kind
- `receipt_hash`: the CF-2 receipt hash from Step 3
- `validator_report_hash`: the CF-6 verdict receipt hash from Step 4
- `free_text`: object with the exact `display_name`, `package_id`, and `operator_note` strings as they will appear in the live world

The `free_text_digest` is computed at record creation time as SHA-256 of the canonical encoding of those three values. Any subsequent change to those strings breaks the digest. The record enters `state='pending'`.

A human reviewer reads the three free-text fields and checks them against all five `REQUIRED_REVIEW_CRITERIA`: profanity, slurs, harassment, impersonation, pii. These are not automated — the automated `FORBIDDEN_CONTENT_RE` and `FORBIDDEN_TERMS_RE` regexes already blocked code injection, economy terms, and URL patterns at validation time (Steps 2 and 4), but they do not catch context-dependent harmful language.

If the reviewer approves, call `decideReview()` with:
- `to_state`: `'approved_for_live_candidate'`
- `free_text_reviewed`: `true`
- `free_text_cleared`: `true`
- `review_criteria`: all five criteria listed
- `reviewer_ref`: opaque human identity string (non-empty)
- `note`: up to 280 characters (`NOTE_MAX` in `review-queue.mjs`)

Confirm `isLiveCandidate(record)` returns `true`. The record's `live_world_authorized` is `false` — CF-8 grants zero live authority.

**Step 6: Build the CF-7 live receipt (P6)**

Call `buildLiveApprovalReceipt()` from `arcade/creator/approval/live-approval-receipt.mjs` with:
- `reviewRecord`: the CF-8 record from Step 5 (must pass `isLiveCandidate()`)
- `localReceiptHash`: the CF-2 receipt hash from Step 3 (sha256: format)
- `hiveVerdictReceiptHash`: the CF-6 verdict receipt hash from Step 4 (sha256: format)
- `stagingVerified`: `true`
- `expiresAt`: `null` for no TTL, or a future ISO timestamp for a time-bounded staging test
- `liveApprovalId`: a unique operator-assigned string (auto-generated from hash+timestamp if omitted)

The function derives `live_world_authorized: true` on the receipt body. This is the only place in the codebase that emits this value at the receipt layer. The `free_text_digest` from Step 5 is embedded verbatim (F3 binding). The resulting `receipt_hash` seals all `LIVE_BODY_KEYS` fields.

Store the live receipt. Confirm `validateLiveApprovalReceipt()` returns `ok: true`.

**Step 7: Build the live registry and initialize the revocation epoch (P7)**

Call `buildLiveRegistry()` from `arcade/creator/approval/live-registry.mjs` with the entry:
- `package_hash`: from Step 2
- `package_kind`: the package kind
- `live_approval_id`: matching the value in the live receipt from Step 6
- `approval_status`: `'operator_approved_live'`
- `live_world_authorized`: `true`
- `approved_live_at`: ISO timestamp
- `expires_at`: matching the `expiresAt` in the live receipt (null or ISO)
- `revoked`: `false`, `revoked_at`: `null`, `revoke_reason`: `null`

Pass `revocationEpoch = 0` for a first entry. The `registry_hash` seals the body. Confirm `validateLiveRegistry()` returns `ok: true`. Confirm `resolveLiveApprovedPackage(registry, packageHash, Date.now())` returns the entry.

**Step 8: Initialize the persisted monotonic epoch on the client (P8)**

Before the first staging load attempt, the component calling `loadLivePackage()` must supply `highestSeenEpoch`. For the first run this is `0`. Store this value in a durable local location (localStorage key, operator config file, or equivalent). The storage mechanism must be documented before the path opens.

After each successful `loadLivePackage()` call, update the stored value to `Math.max(stored, result.revocation_epoch)`. This ensures a revocation (which increments `revocation_epoch` in the registry) can never be undone by replaying an older registry snapshot — the monotonic gate at loader gate `[8]` would reject the older epoch.

**Step 9: Flip LIVE_WORLD_LOADER_ENABLED — staging build only (P10)**

This is the only step that touches source code. In `arcade/creator/approval/approved-loader.mjs` line 31, change:

```js
export const LIVE_WORLD_LOADER_ENABLED = false;
```

to `true`. This change must be in a staging-only branch. It must not be merged to `main` until a separate, later production authorization is given. The change is a source-level decision, not a config toggle, so it is visible in git diff and cannot be silently introduced via environment variables or wrangler.toml.

Important: because `approved-loader.mjs` uses this same constant to gate `loadApprovedPackage()` in `LIVE_WORLD` mode (line 53 of that file), flipping the constant to `true` also opens the CF-2 loader's `LIVE_WORLD` branch in addition to the CF-7 live-loader path. Audit all call sites of `loadApprovedPackage({mode:'live_world'})` in the staging build before deploying.

Build the staging Worker bundle. Verify `LIVE_WORLD_LOADER_ENABLED` imports as `true` in the bundle before deploying to the staging environment (`neon-arcade-mesh-staging` in `workers/arcade/wrangler.toml` `[env.staging]`).

**Step 10: Pass the kill-switch — confirm and call (P9)**

When calling `loadLivePackage()` from `arcade/creator/approval/live-loader.mjs`, pass `killSwitch: false` explicitly. This is the exact boolean `false` sentinel (`KILL_SWITCH_OFF = false` at line 47). Any other value — `undefined`, `null`, `0`, the string `'false'` — triggers `kill_switch_engaged` at gate `[0]` and the load is rejected. This is intentional: the kill-switch must be an active choice, not a default.

**Step 11: Execute the staging load and verify all ten gates pass**

Call `loadLivePackage()` with the full set of artifacts assembled above:
- `package`: the validated package body
- `liveReceipt`: from Step 6
- `liveRegistry`: from Step 7
- `localReceipt`: the CF-2 receipt from Step 3
- `hiveReceipt`: the CF-6 verdict receipt from Step 4
- `reviewRecord`: the CF-8 record from Step 5
- `killSwitch`: `false`
- `highestSeenEpoch`: the persisted epoch from Step 8
- `now`: current epoch-ms
- `enabled`: `true` (only because `LIVE_WORLD_LOADER_ENABLED` was flipped in Step 9)

The loader will re-resolve every artifact at load time, recompute all hashes, and re-run the canonical validator — it trusts no stored conclusion. Gate order is: `[0]` kill-switch, `[1]` enabled, `[2]` JSON-clean, `[3]` live receipt valid, `[4]` package body valid, `[5]` hash binds, `[6]` CF-2/CF-6/CF-8 bindings resolve, `[7]` live registry eligible, `[8]` epoch monotonic, `[9]` staging_verified. A successful return is `{ ok: true, live_world_authorized: true, revocation_epoch, live_approval_id, package }`.

Update the persisted `highestSeenEpoch` to `result.revocation_epoch` after each successful load.

**Step 12: Verify the observable staging behavior**

Check the specific behavior named in the use case from Step 1 against the target block (identified by `cityId` → `CityRoom` DO via `idFromName(cityId)` in `workers/arcade/src/city-room.ts`). The staging environment must be `ENVIRONMENT=staging` (not `development`) so `__test_set_event_now` hooks are correctly rejected. Confirm no economy, ownership, or account data is surfaced. Confirm the rendered output is display-only. Record the staging smoke result.

**Step 13: Set staging_verified to true on the registry entry (already true from Step 6)**

The `staging_verified: true` flag was set at CF-7 live receipt build time (`stagingVerified=true` in Step 6). Gate `[9]` in the loader checks `liveReceipt.staging_verified === true` as defense-in-depth — `validateLiveApprovalReceipt()` at gate `[3]` already rejects a false value, so gate `[9]` is a redundant fast-fail that survives future receipt-validator changes. No additional action is needed here; this step is an explicit confirmation that the flag was correctly set.

---

### Revocation procedure

If the staging test reveals a problem, or if the package needs to be pulled before a future production path opens:

1. Call `buildLiveRegistry()` with the entry's `revoked` field set to `true`, `revoked_at` set to the current ISO timestamp, `revoke_reason` set to a string, and `revocationEpoch` incremented by 1 from the previous value.
2. Distribute the updated registry. Any client that has seen `revocation_epoch = N` will reject a registry with `revocation_epoch < N` at gate `[8]` (`registry_epoch_rollback`). This means a revocation cannot be undone by replaying an older registry snapshot.
3. `resolveLiveApprovedPackage()` will return `null` for the revoked entry from this point forward.
4. The CF-8 review record may be transitioned to `revoked` state via `decideReview()` with `to_state='revoked'` (allowed only from `approved_for_live_candidate`; `revoked` is terminal).

---

### What stays unchanged in Phase 8

- `LIVE_WORLD_LOADER_ENABLED` remains `false` in `arcade/creator/approval/approved-loader.mjs`. Phase 8 does not touch this constant.
- The `neon-arcade-mesh-production` Worker is not involved. The staging environment (`neon-arcade-mesh-staging`) is the boundary for this deferred path.
- `CityRoom` DOs (`workers/arcade/src/city-room.ts`) are not modified to accept package-backed rendering. Phase 8 scales the static block topology; package-backed/live-loaded districts are a later, separately gated possibility that requires its own design once Phase 8 is stable.
- No economy, ownership, accounts, marketplace, payout, token, NFT, transfer, or cash-out mechanics are introduced at any step above.
- HiveWorld (`arcade/hiveworld-sim/`) is not touched.
- The Phase 7 kernel (collision authority in `arcade/city/city-collision.mjs`, interaction receipts in `arcade/city/city-interaction-receipts.mjs`) is not modified.

---

### Falsifiable — how we would know this design is wrong

- If `loadLivePackage()` succeeds with `enabled = false` (the shipped constant), the CF-7 loader has a bug at gate `[1]`. Test: call `loadLivePackage()` with all valid artifacts but `enabled` omitted — it must return `{ ok: false, reason: 'live_world_loader_not_enabled' }`.
- If `buildLiveApprovalReceipt()` accepts a `reviewRecord` with `state` other than `approved_for_live_candidate`, gate `[6]` will fail at load time with `not_a_live_candidate`. The receipt should not have been constructable; the build function in `live-approval-receipt.mjs` checks `reviewRecord.state !== 'approved_for_live_candidate'` and returns errors.
- If the `revocation_epoch` can decrease across registry updates without triggering `registry_epoch_rollback` at gate `[8]`, the monotonic guarantee is broken. Test: pass a registry with `revocation_epoch = 0` when `highestSeenEpoch = 1` — it must return `{ ok: false, reason: 'registry_epoch_rollback' }`.
- If any of the three free-text strings (`display_name`, `package_id`, `operator_note`) are edited after the CF-8 `free_text_digest` is computed, the `free_text_digest` in the review record will not match the one embedded in the live receipt at gate `[6]` (`free_text_digest_mismatch`). This is the F3 binding; verifiable by mutating one character in `operator_note` and re-running the loader.
- If `staging_verified` is `false` on the live receipt, both `validateLiveApprovalReceipt()` at gate `[3]` and the explicit check at gate `[9]` reject the load. If only one of these fires, one of the gates has been silently removed.
- If the path above was executed and the staging Worker build shows `LIVE_WORLD_LOADER_ENABLED = false` in the bundle, Step 9 was not completed. `node -e "import('./arcade/creator/approval/approved-loader.mjs').then(m => console.log(m.LIVE_WORLD_LOADER_ENABLED))"` must print `true` on a staging build and `false` on main.

---

## 5. Rollback & Kill-Switch — for package-backed districts

**Phase scope: PLAN ONLY. No code, no deploy, no CF-7 enablement, no production change.**

This section designs the rollback and kill-switch model for the future state in which a district block's visual configuration is derived from an operator-approved package loaded through the CF-7 live loader. In Phase 8A, that state does not exist: `LIVE_WORLD_LOADER_ENABLED = false` (module constant in `arcade/creator/approval/approved-loader.mjs` line 31, imported and re-exported by `arcade/creator/approval/live-loader.mjs` line 44). Every control below is designed around that constant staying `false` as the shipped default, and designed so the controls are already semantically correct before CF-7 is ever enabled.

---

### Baseline: Static Config Is Always the Fail-Closed Default

The current city block configuration is fully static: block geometry, portal placement, landmark labels, adjacency, and per-block default styles all live in `arcade/city/city-block.mjs` and `arcade/city/city-district.mjs`. The `defaultBlockStyle(boundCityId)` call in `workers/arcade/src/city-room.ts` line 115 seeds stewardship from static config every time a cold CityRoom DO initializes (within `ensureInitialized`, which reads stored stewardship at line 112 and falls back to `defaultBlockStyle` when absent).

**Rollback to static config is therefore the zero-cost default for any block whose package-backed render fails, is revoked, or is never approved.** No operator action is required to "roll back" a block that was never package-backed. This is the 8A baseline: all four blocks (downtown-01, harbor-02, skyline-03, foundry-04) render from `defaultBlockStyle` until a human-cleared, loader-verified, live-registry-listed package is explicitly activated for a specific block.

The fail-closed guarantee must be maintained in the future loading path: if `loadLivePackage` returns `{ ok: false, ... }` for any reason, the CityRoom DO falls through to `defaultBlockStyle(this.boundCityId)` exactly as today. The package-backed render path is an additive overlay, not a replacement of the static authority. The DO's `cityStewardship` storage key (read at `workers/arcade/src/city-room.ts` line 112, written at line 122, with the defaultBlockStyle fallback assignment at line 115) must be updated only on a successful load result; a failed result leaves the key unchanged and the block continues rendering its last valid static or previously-approved state.

---

### Control 1 — Kill-Switch (CF-7 Gate 0, Exact Sentinel)

**Mechanism.** The CF-7 live loader at `arcade/creator/approval/live-loader.mjs` lines 99–100 checks the kill-switch before any other binding logic:

```
if (killSwitchEngaged(killSwitch)) return reject('kill_switch_engaged');
```

`killSwitchEngaged(v)` returns `true` unless `v === false` exactly (line 52). The off-sentinel is `KILL_SWITCH_OFF = false` (line 47). Any other value — `undefined`, `0`, `null`, the string `"false"`, an object — engages the switch.

**Operator action for instant global kill.** The operator sets the kill-switch value to anything that is not the exact boolean `false`. Because the check is `v !== false`, this requires no new constant, no deploy, and no DO restart. The kill-switch is passed as a parameter to `loadLivePackage`; in the future wiring design, this value must be read from a single source of truth (a Cloudflare Worker environment variable, a KV flag, or an env-bound constant in `workers/arcade/src/city-room.ts`) so changing it in one place halts all package-backed renders across all four CityRoom DOs simultaneously.

**Blast radius.** Global. A kill-switch engagement stops every package-backed render in every block in every district. All blocks fall back to `defaultBlockStyle` on next request. There is no per-district or per-block kill-switch in this model; the global kill-switch is the emergency stop and should always be reachable without a deploy.

**Rationale.** The kill-switch is fail-closed by design: the sentinel is the absence of danger, not the presence of a permission. A missing or corrupted config value cannot accidentally re-enable a killed loader.

---

### Control 2 — Single-Package Revocation via the Live Registry

**Mechanism.** `arcade/creator/approval/live-registry.mjs` `resolveLiveApprovedPackage` (lines 115–122) returns `null` for any entry where `revoked === true`, or where `expires_at != null && Date.parse(expires_at) <= now`. The CF-7 loader at line 146 rejects with `'not_live_approved'` when this resolution returns null.

**Operator action for single-package revocation.** The operator updates the live registry (`creator_approved_live_packages`) to set `revoked: true` and `revoked_at: <ISO timestamp>` on the entry whose `package_hash` matches the target package, then increments `revocation_epoch` by at least 1 and recomputes `registry_hash` via `buildLiveRegistry` / `liveRegistryHash`. The sealed registry is then served to clients and DO-side loaders.

**Blast radius.** Single package, all blocks. Because the live registry is keyed by `package_hash` (not by block), revoking one package hash stops that package from rendering in every block where it was active — but leaves all other package-backed or static-config blocks unaffected. A targeted revocation (one bad package, three unaffected blocks) is possible without touching the kill-switch.

**Post-revocation block state.** After a revocation, the CityRoom DO for any affected block must revert to `defaultBlockStyle(this.boundCityId)` on the next stewardship evaluation cycle (the same path as the cold-init case). The DO must not cache a stale loaded package past a successful revocation event. The exact cache invalidation trigger — whether it is a push notification, a DO alarm wake (the existing `STALE_SWEEP_MS = 30_000` alarm in `city-room.ts` line 70), or a client-driven `city_blocks_request` that re-resolves the registry — is a design detail to resolve in the CF-7 enablement phase, but the fallback destination is `defaultBlockStyle` in all cases.

---

### Control 3 — Monotonic Revocation Epoch (Rollback Prevention)

**Mechanism.** CF-7 gate 8 in `arcade/creator/approval/live-loader.mjs` lines 153–156:

```
if (!Number.isInteger(highestSeenEpoch) || highestSeenEpoch < 0) return reject('epoch_source_unavailable');
if (!(Number.isInteger(liveRegistry.revocation_epoch) && liveRegistry.revocation_epoch >= highestSeenEpoch)) {
  return reject('registry_epoch_rollback', { ... });
}
```

The caller (the future CityRoom DO loading path) is required to persist the highest epoch it has ever seen and pass it as `highestSeenEpoch`. There is intentionally no default (the comment in `live-loader.mjs` lines 151–153 explains this directly: defaulting to 0 makes the gate fail-open). A registry snapshot whose `revocation_epoch` is below the persisted highest value is rejected.

**Operator action.** None required after a revocation. The epoch mechanism is automatic: once a CityRoom DO has loaded a registry at epoch `N`, it will never accept a registry at epoch `< N`. This means an older, pre-revocation registry snapshot cannot be replayed by an attacker or an expired CDN cache to resurrect a revoked package.

**Persistence requirement.** The CityRoom DO must persist `highestSeenEpoch` in its Cloudflare Durable Object storage (the same `ctx.storage` already used for the `cityStewardship` key at lines 112 and 122). It must update this value on every successful live registry validation where the incoming epoch is higher. Loss of this value (DO eviction, storage corruption) would reset the gate to the last-written value or, if the key is absent, to a configurable safe default chosen at design time. The safe default must not be 0 in a production environment where epoch > 0 has already been established; the implementation design must address this (e.g., store the epoch pessimistically: if absent, refuse to load a package-backed district until a human-verified epoch is supplied out of band).

**Blast radius.** Per-registry. All CityRoom DOs share the same live registry payload. An epoch increment in the registry propagates globally when each DO next resolves the registry. There is no per-district epoch; the monotonic guarantee is city-wide.

---

### Control 4 — Per-District Revert to Static Config (Operator-Level Targeting)

**Mechanism.** The CityRoom DO stores stewardship per block under the `cityStewardship` storage key (read at `workers/arcade/src/city-room.ts` line 112, written at line 122, with `defaultBlockStyle` fallback at line 115). A loaded package result would be written here on a successful `loadLivePackage` call. Clearing this key, or writing a value that `evaluateStewardship` recognizes as the default, causes the DO to fall back to `defaultBlockStyle(this.boundCityId)` on the next evaluation.

**Operator action.** Write a null or absent `cityStewardship` storage key to the CityRoom DO for one specific block (e.g., the `downtown-01` CityRoom, identified via `idFromName('downtown-01')` binding). This is per-block because each block is a separate CityRoom DO instance with its own storage namespace. Targeted per-block revert without disturbing the other three blocks is structurally possible within the existing DO sharding model.

**Blast radius.** One block out of four. Operators can revert `downtown-01` to static config without touching `harbor-02`, `skyline-03`, or `foundry-04`. This is the minimum blast-radius control, used when a specific block's package render needs to be pulled while the rest of the district continues normally.

**Relation to kill-switch.** Per-district revert is a surgical tool; the kill-switch is the emergency stop. The correct escalation sequence is:

1. Identify the bad package hash — revoke via live registry (Control 2), increment epoch (Control 3).
2. If one block is affected and the revocation is confirmed, optionally clear that block's stewardship key (Control 4) to accelerate the fallback without waiting for an alarm cycle.
3. If the scope of the issue is unclear or multi-block, engage the kill-switch (Control 1) immediately, then investigate.

---

### Interaction with `LIVE_WORLD_LOADER_ENABLED = false`

All four controls are designed to work correctly regardless of the enabled state. In the shipped Phase 8A state:

- `LIVE_WORLD_LOADER_ENABLED = false` means `loadLivePackage` rejects at gate 1 (`'live_world_loader_not_enabled'`) before any registry, epoch, or kill-switch logic is reached.
- Controls 2, 3, and 4 operate on the live registry and DO storage, which can be maintained and updated without enabling the loader.
- The kill-switch (Control 1) is a no-op when the loader is already disabled but is designed to engage first when enabled, providing defense-in-depth.

The controls are therefore testable in their current disabled state: the live registry and epoch persistence structures can be exercised in unit tests by passing `enabled: true` as an explicit parameter to `loadLivePackage` (the parameter exists specifically for this, per the JSDoc comment at lines 84–88 of `live-loader.mjs`), without the `LIVE_WORLD_LOADER_ENABLED` module constant ever changing.

---

### Summary Table

| Control | Granularity | Operator Action | Mechanism File | Fail-Closed? |
|---|---|---|---|---|
| Kill-switch | Global (all blocks, all districts) | Set kill-switch to any non-`false` value | `live-loader.mjs` line 100 | Yes — exact sentinel required |
| Live-registry revocation | Single package (all blocks where active) | Set `revoked: true`, increment `revocation_epoch`, recompute `registry_hash` | `live-registry.mjs` lines 115–122; `live-loader.mjs` line 146 | Yes — `null` result rejects |
| Monotonic epoch gate | City-wide registry freshness | Automatic after epoch increment; DO persists highest-seen epoch | `live-loader.mjs` lines 153–156 | Yes — no default for missing epoch |
| Per-block static-config revert | Single CityRoom DO | Clear or absent `cityStewardship` key in target block's DO storage | `city-room.ts` lines 112/115/122; `city-block.mjs` `defaultBlockStyle` | Yes — absent key falls to static default |

---

### Falsifiable / How We'd Know It's Wrong

- If `killSwitchEngaged(undefined)` returns `false`, the kill-switch is broken. Verify: `undefined !== false` is `true`, so `killSwitchEngaged(undefined)` returns `true`. The kill-switch is engaged by any non-`false` value, including `undefined`.
- If `resolveLiveApprovedPackage(registry, hash, now)` returns a non-null entry for a `revoked: true` entry, the revocation logic is broken. This is directly testable against the code at `live-registry.mjs` line 119.
- If a CityRoom DO accepts a live registry at `revocation_epoch: 2` after having previously accepted one at `revocation_epoch: 5`, the epoch gate is broken. This would be caught by a unit test passing `highestSeenEpoch: 5` with a registry at epoch `2`.
- If clearing `cityStewardship` from a block's DO storage causes the block to render with a stale loaded package rather than `defaultBlockStyle`, the revert path is broken. This is verifiable by inspection of the stewardship initialization path in `city-room.ts` at lines 112–115.
- If the curated upload script (`scripts/build-curated-client-upload.mjs`) allows `arcade/creator/` content to reach the production static asset set, the CF boundary is broken. The script currently exits non-zero if `arcade/creator/*` appears in the output, as enforced by `FORBIDDEN_UPLOAD_PREFIXES` (declared at line 35 of that script).

---

## 6. Performance, GTA-80 Budget Impact & Cross-Device Smoke Matrix

### Hard Constraints Restated

Phase 8 is PLAN-ONLY. No code, no deploy, no migration, no production change in this phase. LIVE_WORLD_LOADER_ENABLED stays false. The creator trust boundary (CF-1..CF-8) and the closed CF-7 loader are not touched by this section. No economy, ownership, marketplace, or accounts are introduced at any scale tier.

---

### 1. GTA-80 Budget Impact Projection

#### Current Baseline (anchored to `scripts/check-city-build-size.mjs`)

The GTA-80 meter (`BUDGET_MB = 80`, `STRETCH_GZIP_MB = 34`) counts only what the browser downloads to play the city: everything under `arcade/city/` plus `scripts/three.min.js`. Source, tests, docs, node_modules, git, dev tooling, and the Worker are excluded from the meter by design.

| Metric | Current (Phase 7) | Source |
|---|---|---|
| Files counted | 23 | `check-city-build-size.mjs` output |
| Total uncompressed | 0.810 MB | same |
| Total gzipped | 0.223 MB | same |
| GTA-80 budget used | 1.01% | 0.810 / 80 MB |
| GTA-34 stretch used | 0.66% | 0.223 / 34 MB |
| Worker bundle (uncompressed) | 200.80 KiB (205,628 bytes) | `workers/arcade/dist/index.js` |
| Worker bundle (gzipped) | 44.10 KiB (45,167 bytes) | gzip of same |
| Worker dry-run (uncompressed) | 187.10 KiB | pre-flight in `PRODUCTION_ROLLOUT_PLAN.md` |
| Worker dry-run (gzipped) | 40.74 KiB | same |

The budget has ~79.2 MB uncompressed and ~33.8 MB gzipped headroom before the nominal limit. At 1% utilization, scale is not a current threat — but the projection below defines where to watch.

#### Per-District Client Budget Envelope

The GTA-80 meter scope must expand if Phase 8A adds a second district (static config only — this is the 8A baseline). Each new district adds:

- A new HTML entry page (e.g., `arcade/city-district-02/index.html`) and its CSS: estimated 5-15 KiB uncompressed per district (to measure; derive from current `arcade/city/index.html` + associated CSS once Phase 8A geometry is drafted).
- Zero additional shared `.mjs` modules if the new district reuses the existing pure authority modules (`arcade/city/city-block.mjs`, `arcade/city/city-district.mjs`, `arcade/city/city-collision.mjs`, etc.) — the current design requires byte-identical geometry across blocks, so no new geometry modules are needed at the block level.
- Zero increase to `scripts/three.min.js` (shared vendored renderer, static).
- Additional block-specific label overrides and theme tokens in `arcade/city/city-block.mjs`: these are inline frozen constants, ~1-2 KiB per new block set (to measure).
- Layered-editor creator packages (CF-3: `SIZE_BUDGET_BYTES = 12288`, 12 KiB each) are excluded from the GTA-80 meter by the curated upload script's `FORBIDDEN_UPLOAD_PREFIXES = ['arcade/creator/', ...]` rule in `scripts/build-curated-client-upload.mjs`. Creator pipeline files must not enter the meter.

**Projected budget impact per district tier:**

| Scale tier | New blocks | Estimated GTA-80 increment | Estimated GTA-34 increment | Notes |
|---|---|---|---|---|
| Phase 8A baseline (static config) | 1 new district (~4 new blocks) | +60-120 KiB uncompressed | +15-30 KiB gzipped | Reuses all shared modules; only new entry pages + label constants |
| Phase 8B (2 districts, 8 blocks) | 4 additional blocks | +60-120 KiB | +15-30 KiB | Same basis |
| Scale ceiling before GTA-80 concern (rough) | ~650+ new districts (~2600+ blocks) | approaches 80 MB | depends on asset delta | Not a real risk at planned Phase 8 scope |
| Scale ceiling before GTA-34 concern (rough) | ~1100+ new districts | approaches 34 MB gzip | — | Not a real risk at planned Phase 8 scope |

Incremental estimates above are coarse. Run `node scripts/check-city-build-size.mjs` after any new district entry page is committed to get the real number. The script exits 0 by default; use `--strict` to enforce the gate in CI.

**Trip-wire (GTA-80 budget):** Trigger a manual review if a single commit pushes the uncompressed total above 10 MB (currently 0.810 MB). This is a 12x margin before the 80 MB nominal budget and a signal that something unexpected (a large asset, an unintended inclusion, or a copied game asset) entered the meter scope. Trip-wire for GTA-34: review if gzipped total exceeds 5 MB.

#### Worker Bundle Budget Envelope

The Worker (`workers/arcade/src/index.ts` compiled to `dist/index.js`) currently measures 200.80 KiB uncompressed and 44.10 KiB gzipped. Phase 8 scale plans that affect the Worker:

- Each new district block is a new `CityRoom` DO binding entry in `wrangler.toml`. The binding declaration is a few bytes of TOML — no bundle size impact.
- New blocks do not require new Worker source code if the existing `CityRoom` DO handles any block via `idFromName(cityId)` and the pure authority modules (`arcade/city/city-block.mjs`) are extended in-place by adding new entries to `CITY_ROOMS` and `BLOCK_LABELS`. Each new block entry in those frozen arrays adds ~200-500 bytes to the bundle (to measure).
- A second district with 4 new blocks would add an estimated <5 KiB to the Worker bundle — negligible.
- If Phase 8 introduces a new DO class (e.g., a `DistrictRegistry` to shard the existing `CityRegistry` DO bottleneck identified in the scale risks), that would add a new migration tag (v5+) and a new class binding. No migration-tag addition happens in Phase 8 plan-only; this is flagged as a design decision that requires human-cleared staging verification before any implementation phase.

**Trip-wire (Worker bundle):** Review if a Worker dry-run (`wrangler deploy --env production --dry-run`) exceeds 400 KiB uncompressed. The current gap (200.80 KiB vs 400 KiB) provides a 2x headroom. Cloudflare's Worker size limit is 10 MB uncompressed (1 MB compressed); the current Worker is 2% of the hard limit, so this is not a near-term risk.

---

### 2. Performance Budget

The performance budget is organized by layer: client rendering, presence messaging, and DO CPU/heartbeat.

#### 2a. Client Rendering (browser, all devices)

| Metric | Target | Rationale | Trip-wire |
|---|---|---|---|
| Rendering FPS (city block, active play) | 60 fps sustained | `SNAPSHOT_INTERVAL_MS = 50` ms (20 Hz server hint) sets the minimum meaningful update rate; 60 fps client-side is GPU-compositor idle on modern devices | Investigate if DevTools profiler shows main-thread blocking >16 ms per frame during normal play (no animations, no transition) |
| Rendering FPS (low-end mobile, 360x640) | 30 fps sustained | Established by `mobile-playtest.spec.mjs` viewport (`{width:360, height:640, deviceScaleFactor:2, isMobile:true, hasTouch:true, reducedMotion:'reduce'}`) — note that spec loads `arcade/index.html` (the arcade floor), not `arcade/city/index.html` (the city page); a city-page equivalent mobile check targeting `arcade/city/index.html` is a gap that Phase 8A implementation must address | If main-thread blocking events appear in a Playwright trace at 360×640 on the city page, the "30 fps on low-end mobile" target requires investigation |
| Time to interactive (city page, cold load) | < 2 s | GTA-34 total is 0.223 MB gzip; at a 5 Mbps mobile connection this is ~360 ms transfer; rendering + parse should be well under 2 s | > 2 s on a throttled (3G) Lighthouse profile is a trip-wire |
| Layout shift (city join → play) | CLS < 0.1 | Standard Core Web Vitals target; the city scene is canvas-based so layout shift from DOM reflows should be minimal | Any non-trivial CLS detected via Playwright `page.evaluate(() => performance.getEntriesByType('layout-shift'))` |
| Input → visual response latency | < 100 ms (p95) | `MIN_INPUT_INTERVAL_MS = 33` ms (30 Hz cap) + `SNAPSHOT_INTERVAL_MS = 50` ms server hint + network RTT; 100 ms p95 is achievable on low-latency connections | To measure via timestamp delta between synthetic input injection and canvas update in spec |
| Scene module count (GTA-80 meter files) | < 50 files | Current 23 files; doubling blocks roughly doubles the count; 50 is a generous ceiling before file-count overhead warrants a bundling review | Run `node scripts/check-city-build-size.mjs` and inspect the file count row |

#### 2b. Presence Messaging (per CityRoom DO)

All numbers are derived from constants in `arcade/city/city-block.mjs` and `arcade/city/city-district.mjs`.

| Metric | Current value | Phase 8A target | Trip-wire |
|---|---|---|---|
| Snapshot broadcast cadence | `SNAPSHOT_INTERVAL_MS = 50` ms (20 Hz hint) | Unchanged for 8A | If server alarm drift causes snapshots to arrive at >100 ms intervals under load, investigate DO alarm scheduling |
| Presence heartbeat period (per block) | `STALE_SWEEP_MS = 30_000` ms (30 s, `workers/arcade/src/city-room.ts` line 70), `CITY_HEARTBEAT_TTL_MS = 30_000` ms | Unchanged for 8A; one alarm per CityRoom DO | If alarm callbacks take >1 s (to measure via DO wall-clock logging) at peak occupancy (24 players per block), alarm cadence is impacted |
| DO-to-DO heartbeat (CityRoom → CityRegistry) | One POST per block per sweep (~30 s) | With N blocks: N POSTs per 30 s sweep into the single `CityRegistry` DO (`idFromName('city-registry')`) | The grounding facts flag `CityRegistry` as a single-instance coordinator: at 4 blocks, 4 POSTs per 30 s sweep is trivial. **The scale risk is real at 100+ blocks**: 100 POSTs per 30 s into one DO = ~3.3 req/s. Cloudflare DO handles this today; above 500 blocks (~16 req/s into one DO), design a shard or hierarchical registry before implementing |
| Presence delta fan-out (Phase 5D) | On-change only (coalesced); at most `CITY_IDS.length = 4` entries per delta | For N blocks: delta carries at most N entries; broadcast to all sockets on that block | Fan-out is O(sockets on that block) per delta. At 24 players per block × 50 ms snapshot cadence, peak outbound is 24 × (presence delta JSON size ≈ 200 bytes) × (delta frequency ≈ once per 30 s sweep) ≈ trivial. Trip-wire: if a single block has > 24 simultaneous connections (above capacity cap), investigate |
| Client-requested message rate floor | `SNAP_REQ_MIN_MS = 250` ms (4 req/s per socket, `workers/arcade/src/city-room.ts` line 71) | Unchanged; any new request type in Phase 8 must also be gated behind this floor | A new message type added without the rate gate is a scale regression |
| Input rate cap | `MIN_INPUT_INTERVAL_MS = 33` ms (~30 Hz, `arcade/city/city-block.mjs` line 32) | Unchanged | If client-side input is fired faster than 33 ms, the DO silently ignores position advance but still advances `lastSeq` — this is correct behavior, not a regression |

#### 2c. Durable Object CPU / Heartbeat

The pure authority module (`arcade/city/city-block.mjs`) runs `predictStep` + `resolveCollision` on every accepted input on the DO. Per the movement constants: `MAX_SPEED = 220` units/s, `MAX_DT_MS = 250` ms, `PLAYER_RADIUS = 12` units, `MAX_INPUT_BACKLOG = 120`. The AABB collision check is against 4 buildings + 2 props = 6 fixed obstacles (`OBSTACLES` array, `arcade/city/city-block.mjs` lines 111-114). At 24 players × 30 Hz inputs, the DO handles 720 `predictStep` calls per second, each with 6 AABB tests — O(1) per call, O(players × obstacles) per tick. This is CPU-light at 4-block scale.

| Metric | Phase 8A concern | Design guidance |
|---|---|---|
| `predictStep` + `resolveCollision` throughput | At 24 players per block, 720 calls/s per DO, 6 obstacles — no concern | Adding more obstacles per block (e.g., new buildings in a second district geometry) increases this proportionally. The frozen `OBSTACLES` array must stay small and static; do not dynamically generate obstacles from package data |
| `stalePlayerIds` sweep | O(player count) per 30 s alarm; at 24 players per block, trivial | At higher capacity (if capacity constant is raised in a future phase), re-evaluate |
| Block Trial `stepTrial` | One in-memory, ephemeral trial per `CityRoom` DO; no persistence | Phase 8 planning must not expand trial scope to cross-block (that requires a new DO) |
| Event log growth | Per `workers/arcade/src/city-room.ts`, append-only, no pruning specified | **Known scale risk from the grounding facts**: the event log grows unbounded. Phase 8 must include a retention policy design decision. For 8A planning, specify a maximum retained event count (e.g., 500 events per block log) and a pruning trigger. The exact threshold is to measure based on DO storage benchmarks |
| DO cold-start (new block) | Per-block `ensureInitialized()` in `workers/arcade/src/city-room.ts`; seed ordering from `seedPlayer` / `safeSpawnPoint` is O(1) per block | Safe at N blocks; cold-start time is to measure on Cloudflare workerd for a new geometry |

---

### 3. Cross-Device Smoke Matrix

This matrix builds directly on the existing verified harness (phone+PC multiplayer confirmed live 2026-06-05) and the Playwright cached-chromium model used across all specs.

**Harness infrastructure (existing, reused):**

- Arcade smoke: `tests/arcade/two-client.spec.mjs` + `tests/arcade/run-two-client.sh` (dual `chromium` contexts, `dev-shim.mjs` on port 8787; tests arcade ticket authority, NOT city blocks)
- City block smoke: `tests/arcade/city-block.spec.mjs` + `tests/arcade/run-city-block.sh` (city-dev-shim on port 8788, `workers/arcade/city-dev-shim.mjs`)
- City district smoke: `tests/arcade/city-district.spec.mjs` + `tests/arcade/run-city-district.sh` (city-dev-shim on port 8788; covers cross-block routing and district manifest)
- City district presence: `tests/arcade/city-district-presence.spec.mjs` + `tests/arcade/run-city-district-presence.sh`
- City district events: `tests/arcade/city-district-events.spec.mjs` + `tests/arcade/run-city-district-events.sh`
- City interaction receipts: `tests/arcade/city-interaction-receipts.spec.mjs` + `tests/arcade/run-city-interaction-receipts.sh`
- Mobile playtest: `tests/arcade/mobile-playtest.spec.mjs` + `tests/arcade/run-mobile-playtest.sh` (viewport 360×640, `deviceScaleFactor:2`, `isMobile:true`, `hasTouch:true`, `reducedMotion:'reduce'`; **note: loads `arcade/index.html`, the arcade floor — not the city page**; city-page mobile coverage is a gap)
- Remote smoke: `tests/arcade/remote-smoke.spec.mjs` + `tests/arcade/run-remote-smoke.sh` (environment-driven: `BASE_URL`, `WS_URL`, `API_URL`)
- Creator editor smokes: `tests/creator/layered-editor.spec.mjs` + `tests/creator/run-layered-editor.sh` (offline, port 8098); `tests/creator/block-editor.spec.mjs` + `tests/creator/run-block-editor.sh` (offline, port 8099, CF-1 block-style editor)
- Playwright resolution: `createRequire(process.env.PW_REQUIRE_BASE || import.meta.url)` pattern, consistent across all specs

**Notation:** "shim" = local `city-dev-shim.mjs` (reuses production `CityRoom` pure authority unchanged). "staging" = `neon-arcade-mesh-staging` Worker. "production" = `neon-arcade-mesh-production` Worker on `clovelearn.io`.

#### Phase 8A Smoke Matrix

| # | Device / Viewport | Browser | Environment | District count | Block count | Scenario | Pass criteria | Existing harness |
|---|---|---|---|---|---|---|---|---|
| S1 | Desktop 1440×900 | Chromium (headless) | shim | 1 (neon-district-01) | 4 (downtown-01, harbor-02, skyline-03, foundry-04) | Cross-block route: client A joins downtown-01, requests route to harbor-02 (adjacent), receives `city_route_result {ok:true}`; district manifest lists all 4 blocks | Route confirm received; manifest `blocks.length === 4`; non-adjacent route rejected with `ok:false` | `city-district.spec.mjs` via `run-city-district.sh` |
| S2 | Mobile 360×640 | Chromium (headless) | shim | 1 | 4 | Arcade floor mobile: join arcade, walk, tap controls ≥40 px, no JS errors, no overflow (**note: tests `arcade/index.html`, not city page**; city-page mobile coverage is a gap requiring a new spec for Phase 8A) | No overflow; all controls accessible; no `pageerror` events | `mobile-playtest.spec.mjs` via `run-mobile-playtest.sh` |
| S3 | Desktop 1440×900 | Chromium (headless) | shim | 1 | 4 | District event display: event window fires, `district_event_active` arrives in activity feed, `district_event_upcoming` pre-roll appears ~60 s before window | Feed contains event entries; no server error | `city-district-events.spec.mjs` via `run-city-district-events.sh` |
| S4 | Desktop 1440×900 | Chromium (headless) | shim | 1 | 4 | Presence delta push: player joins block A, player B (different block) sees population count change; `city_district_presence` delta of kind `district_presence_delta` with `public_safe:true` received | Delta received; no private/economy fields in payload | `city-district-presence.spec.mjs` via `run-city-district-presence.sh` |
| S5 | Desktop 1440×900 | Chromium (headless) | shim | 1 | 4 | Interaction receipt: player at portal zone sends `city_interaction_request`, receives `city_interaction_receipt` with `accepted:true` and `action_kind:'arcade_entry'`; receipt does not carry economy fields | Receipt present; no `balance`/`ledger`/`inventory` fields | `city-interaction-receipts.spec.mjs` via `run-city-interaction-receipts.sh` |
| S6 | Desktop 1440×900 | Chromium (headless) | staging | 1 | 4 | Remote smoke: `/arcade/health` returns 200; `ENVIRONMENT=staging` hook rejection confirmed; no admin surface without token | All `remote-smoke.spec.mjs` assertions pass | `remote-smoke.spec.mjs` via `run-remote-smoke.sh` |
| S7 | Real phone (iOS Safari) | Safari (manual) | production | 1 | 4 | Operator confirms: phone + PC see each other in same block; cross-block travel via portal; presence counter updates | Operator sign-off (matches the 2026-06-05 production launch proof) | Manual; documented in `docs/PRODUCTION_ROLLOUT_PLAN.md` |
| S8 | Real phone (Android Chrome) | Chrome (manual) | production | 1 | 4 | Same as S7; verify touch controls, no overflow, district event banner visible | Operator sign-off | Manual |

**Phase 8A additions (new district, static config only):**

When Phase 8A adds a second district, the matrix extends with these rows before any code merges to main:

| # | Device / Viewport | Browser | Environment | District count | Block count | Scenario | Pass criteria |
|---|---|---|---|---|---|---|---|
| S9 | Desktop 1440×900 | Chromium (headless) | shim | 2 | up to 8 | `check-city-build-size.mjs` run post-commit: GTA-80 meter shows new file count and stays under 10 MB trip-wire | Script exits 0; total uncompressed < 10 MB |
| S10 | Desktop 1440×900 | Chromium (headless) | shim | 2 | up to 8 | District manifest shows all new blocks; cross-district route accepted for valid adjacent pair; non-adjacent pair rejected | `blocks` array length = total block count; route result `ok:true` for adjacent pair; `ok:false` with reason for non-adjacent |
| S11 | Desktop 1440×900 | Chromium (headless) | shim | 2 | up to 8 | `CityRegistry` heartbeat: all new blocks report to single `city-registry` DO; manifest returns correct population for each new block | Manifest `blocks` array length = total block count; no `unknown` health entries within 35 s of shim start |
| S12 | Mobile 360×640 | Chromium (headless) | shim | 2 | up to 8 | City-page mobile check on new district's `arcade/city/index.html` (or equivalent entry page): no overflow, tap targets ≥40 px, no JS errors; this is a new spec not covered by existing `mobile-playtest.spec.mjs` | No overflow; no `pageerror`; tap targets reachable |
| S13 | Desktop 1440×900 | Chromium (headless) | staging | 2 | up to 8 | Remote smoke against staging with new blocks deployed; `wrangler deploy --env staging --dry-run` passes 400 KiB Worker bundle trip-wire | Remote smoke green; dry-run under 400 KiB |

#### CF Creator Smoke (maintained alongside city smoke, separate environment)

| # | Device / Viewport | Browser | Environment | Scenario | Pass criteria | Harness |
|---|---|---|---|---|---|---|
| C1 | Desktop 1440×900 | Chromium (headless) | offline (port 8098) | CF-3 layered editor: load, render procedural preview, local validation flips VALID→BLOCKED, no off-host requests | All checks pass; no `pageerror`; no requests to non-localhost | `tests/creator/layered-editor.spec.mjs` via `run-layered-editor.sh` |
| C2 | Desktop 1440×900 | Chromium (headless) | offline (port 8098) | CF-2 approved local preview loads with matching receipt; rejects mismatched receipt (`sample-layered.mismatch-receipt.json`) | Preview renders on match; error state on mismatch; no submit/upload surface | `tests/creator/layered-editor.spec.mjs` via `run-layered-editor.sh` |
| C3 | Desktop 1440×900 | Chromium (headless) | offline (port 8098) | CF-3 layered editor: no `LIVE_WORLD_LOADER_ENABLED=true` path exposed in UI; no submit button; no live-world surface | UI contains no submit/upload controls; `loadLivePackage` not reachable from the page | `tests/creator/layered-editor.spec.mjs` via `run-layered-editor.sh` |

The CF creator smoke rows are not affected by district count; they run independently of the city shim.

#### Regression Gate

All Phase 8 plan-only design outputs that later become implementations must keep these baselines green before merging to main:

- `node --test tests/arcade/*.test.mjs` — arcade unit gate (currently 608 tests)
- `node --test tests/creator/*.test.mjs` — creator unit gate (currently 169 tests; covers CF-1 through CF-8)
- `node scripts/check-city-build-size.mjs` — GTA-80 meter (advisory; `--strict` for CI opt-in)
- `node scripts/build-curated-client-upload.mjs` — curated upload dry-run; must not include `arcade/creator/*`
- `node tests/arcade/check-production-config.mjs` — production safety assertions

---

### 4. Falsifiable / How We Would Know It Is Wrong

- **GTA-80 projection wrong:** Run `node scripts/check-city-build-size.mjs` after adding the first Phase 8A new-district files. If the increment exceeds 120 KiB per district set, the "60-120 KiB per district" estimate is wrong and the per-district envelope must be revised before further scale is planned.
- **Worker bundle projection wrong:** Run `wrangler deploy --env staging --dry-run` after adding new `CITY_ROOMS` entries. If the uncompressed bundle grows by more than 5 KiB per 4-block set, the "< 5 KiB" estimate is wrong.
- **`CityRegistry` heartbeat load projection wrong:** If the 4-block dev shim's presence sweep takes more than 1 s wall-clock (observable via shim console logs), the "trivial at 4 blocks" claim is wrong and the registry bottleneck concern activates earlier than the 500-block threshold in the table above.
- **Mobile render FPS target wrong:** Run a Playwright trace against `arcade/city/index.html` at 360×640 (this requires a new spec — the existing `mobile-playtest.spec.mjs` targets `arcade/index.html` and does not cover the city page). If main-thread blocking events appear in the trace, the "30 fps on low-end mobile" target requires a geometry or rendering change before the Phase 8A plan is declared complete.
- **Cross-district presence delta wrong:** If S11 shows any block returning `health: 'unknown'` for longer than `CITY_STALE_TTL_MS = 90_000` ms after the dev shim has been running for > 90 s, the single-registry DO-to-DO heartbeat path is not scaling correctly even at small block counts.

---

## 7. Open Measurements & Deferred Items

Plan-only. These are the values that must be **measured** before Phase 8A implementation fixes them — each with the harness that would measure it — plus the items explicitly **deferred** to Phase 8B. Nothing here is implemented; this section exists so no threshold above is mistaken for a benchmarked fact, and so the deferrals are stated rather than silent.

### 8.1 To-measure thresholds (each with a measurement protocol)

| Threshold | Where it gates | Plan-only measurement protocol (8A implementation task, not done here) |
|---|---|---|
| `broadcastDistrictPresence` per-broadcast wall/CPU time | Presence interest-management trigger (§2) | Instrument the function in the dev-shim parity twin (`workers/arcade/city-dev-shim.mjs`) + under `wrangler dev` (workerd); drive synthetic populations at B=4, 9, 16, 24; record ms and message count per broadcast; set the trigger at the measured point where per-tick fan-out exceeds the §2 budget. |
| CityRegistry heartbeat-sweep duration | Registry sharding trigger T2 (§1·§3) | Synthesize N city heartbeats in `CityRegistry`; time the sweep/eviction pass at N = 4, 16, 64, 128, 256; shard when the sweep exceeds the DO alarm budget. |
| `city_blocks` manifest payload bytes at B = 9 / 16 | Manifest-size trigger T1 (§1) | Serialize `districtManifest()` (`city-district.mjs:127`) at synthetic B; assert the payload stays under the socket-message budget; T1 fires at the measured B that approaches it. |
| Worker CPU per `predictStep` block at scale | DO CPU budget (§6) | Profile `predictStep` under load per block; confirm the per-DO CPU envelope holds as block population approaches `capacity = 24`. |
| Event-log retention cap (the suggested 500/block) | DO storage (§6) | Currently asserted without a storage benchmark — measure DO storage bytes per event and set the cap from the measured DO storage envelope before fixing 500 (or any number). |

### 8.2 Deferred to Phase 8B (named here, not designed here)

- **Cross-district routing (D > 1).** Phase 8A ships **D = 1** (one district, more blocks). How a player moves *between districts* — the inter-district transfer protocol and adjacency-across-districts — is **Phase 8B**. 8A's block→DO authority and intra-district routing are unchanged; the multi-district layer sits above them and is designed separately once 8A is proven.
- **City-page mobile smoke spec (S12).** The cross-device matrix (§6) requires a mobile city-page smoke, but its concrete spec file, port, harness shell, and assertions are an **8A implementation deliverable**, named here, not authored in this plan (the existing `mobile-playtest.spec.mjs` targets the arcade floor, `arcade/index.html`, not `arcade/city/index.html`).
- **Package-backed district data.** Remains a later, gated possibility (§3, §4, §5). Phase 8A is **static config only**; no district draws its geometry/labels/zones from an approved package until — at the earliest — a separately-authorized **ENABLE CF-7 STAGING** gate with a real use case.

---

## 8. Non-Goals, Sequencing & the Next Fork

**Framing.** Phase 8 is District Scale — scale the city around the proven Phase 7 kernel and the closed CF-1..CF-8 creator trust boundary. Phase 8 does not move the boundary; it designs the city so that boundary can survive scale.

---

### 8.1 Explicit Non-Goals

Phase 8 does NOT introduce, plan for, or leave hooks for any of the following. If a design choice requires one of these, that is a signal the design is wrong.

**Economic, ownership, and marketplace mechanics — permanently excluded:**
- Economy, ownership, rent, paid hosting, marketplace, accounts, payout, token, NFT, transfer, or cash-out — not now, not as a commented-out stub, not as a "future placeholder."
- These terms are already blocked at the package-validation layer by `FORBIDDEN_TERMS_RE` in `arcade/creator/validator/validation-report.mjs` (line 34: `buy`, `sell`, `trade`, `rent`, `rental`, `own`, `owner`, `ownership`, `profit`, `payout`, `payment`, `wager`, `bet`, `loot`, `raid`, `steal`, `stake`, `staking`, `yield`, `crypto`, `token`, `nft`, `market`, `marketplace`, `landlord`, `tenant`, `income`, `cashout`, `jackpot`, `multiplier`, `boost`, `reward`, `earn`, `prize`, `bonus`, `withdraw`, `price`). Phase 8 does not add exceptions to this list.

**Live-loader and CF-7 — explicitly not touched in Phase 8:**
- `LIVE_WORLD_LOADER_ENABLED` stays `false` in `arcade/creator/approval/approved-loader.mjs:31` (the single module-constant source of truth imported by the CF-7 loader at `arcade/creator/approval/live-loader.mjs:36`). Phase 8 does not flip this constant.
- Phase 8 does not enable CF-7. It does not wire a persisted `highestSeenEpoch` source. It does not add any DO or Worker routing for live package delivery. It does not run `wrangler deploy` with a live-enabled build.
- Enabling CF-7 for staging is a separate, later, human-cleared, staging-verified gate that only opens after Phase 8 has produced a real package-loading use case — and only then, by an explicit operator authorization that is out of scope here.

**Production changes — none in Phase 8:**
- No `wrangler deploy --env production`. No new DO migration tag (current is `v4`; see `workers/arcade/wrangler.toml` lines 27–43). No new routes added to `[env.production.routes]` (current four narrow patterns: `/arcade/ws*`, `/arcade/city/ws*`, `/arcade/rooms*`, `/arcade/health*`). No SCHEMA_VERSION bump beyond v8 (current, `arcade/city/city-block.mjs:54`) unless Phase 8A design produces an additive wire change — and even then, deploy is a separate gate.
- HiveWorld is untouched. The product Worker/DO authority model (`CityRoom` per-block, `CityRegistry` cross-block in `workers/arcade/src/city-room.ts` and `workers/arcade/src/city-registry.ts`) is the canonical authority and Phase 8 does not redesign it.

---

### 8.2 Sequencing Rationale: Kernel and Creator Boundary Before Scale

The ordering is a trust dependency, not just a roadmap preference.

**Why kernel before scale.**
Phase 7 (now on `main`) delivered the gameplay kernel: `isPointWalkable` + `clampToWalkable` + `nearestSafePoint` in `arcade/city/city-collision.mjs` (the Phase 7B walkable boundary, ADR-025), server-confirmed interaction receipts (`buildInteractionReceipt` in `arcade/city/city-interaction-receipts.mjs`, Phase 7E, ADR-027), and the full interaction-zone model (`arcade/city/city-interactions.mjs`, Phase 7A, ADR-026). These govern every player position in every block. Scaling the city by adding blocks, districts, or package-rendered content before the per-block collision and interaction authority is proven would mean scaling unverified authority. The 4-block ring (downtown-01, harbor-02, skyline-03, foundry-04 in `ADJACENCY` at `arcade/city/city-district.mjs:38–43`) and the per-block `CityRoom` DO model are the kernel Phase 8 scales around.

**Why creator/loader boundary before live-world scale.**
CF-1..CF-8 are recorded in `docs/PROJECT_CHARTER.md` (ADR-021 through ADR-033, with Phase 7 gameplay ADRs 024–027 interleaved in that range). They built the closed pipeline in order: schema → hash → local approval → CF-2 loader (deny-by-default) → layered packages → arcade importer → asset-pack composition → hive validation → human-review queue → live-loader machine (shipped disabled). Each step was grounded by the previous one. The pipeline's invariant — "nothing player-authored enters the live world without re-validation at load, hash binding, kill-switch, human review, and live-registry eligibility" — is only meaningful if Phase 8 scale decisions obey it. Adding a second district or expanding block capacity before the pipeline is closed would create a surface that the pipeline would then have to retroactively protect. Building the scale around the closed boundary is the correct dependency order.

**What Phase 8 inherits as fixed invariants:**
- Per-block capacity: 24 players (`arcade/city/city-block.mjs:167–172`, all four `CITY_ROOMS` entries).
- Per-block collision authority: deterministic AABB with `MAX_SPEED = 220`, `MAX_DT_MS = 250ms`, `PLAYER_STALE_MS = 45_000ms` — server-owned, not client-supplied.
- `CityRegistry` is single-instance, addressed via `ns.idFromName("city-registry")` in `workers/arcade/src/city-room.ts:146`, DO-to-DO only, never client-facing. Phase 8A stays within this model; a registry redesign is a separate, measured decision triggered by a concrete scale threshold.
- `arcade/creator/**` is excluded from the curated upload by `FORBIDDEN_UPLOAD_PREFIXES` in `scripts/build-curated-client-upload.mjs:35–49`. Phase 8 does not relax this.
- `check-production-config.mjs` (`tests/arcade/check-production-config.mjs`) verifies `ENVIRONMENT=production`, `ADMIN_ENABLED=false`, no leaked `ADMIN_TOKEN`, all four DO bindings, migrations v1–v4. Any Phase 8 production path must still pass this gate.

---

### 8.3 Scale Thresholds That Phase 8A Must Stay Below

Phase 8A is static-config scale (new blocks and/or a second district added via static declarations in `arcade/city/city-district.mjs` (ADJACENCY map), `arcade/city/city-block.mjs` (CITY_ROOMS array, geometry), and `workers/arcade/wrangler.toml` (DO bindings, migrations if a new DO class is needed) — no package-backed content, no CF-7 enablement). Three known scale risks from the codebase constrain how far 8A may go before a design fork is required:

**CityRegistry fan-out.** A single `CityRegistry` DO fronts all blocks. It receives one heartbeat per block per 30-second sweep (`STALE_SWEEP_MS = 30_000` in `workers/arcade/src/city-room.ts:70`). At 4 blocks this is trivially bounded. The trigger for reconsidering the single-registry model is: block count growing to the point where a single alarm sweep cannot complete within the 30-second heartbeat window, or where the registry's presence-map broadcast fan-out measurably degrades WS latency for connected clients. The specific block count at which this triggers is "to measure" under load; 8A should not assume safety beyond the 4-block baseline without a measured test.

**Zone count per block.** `nearestInteractionZone` in `arcade/city/city-interactions.mjs:96` is O(zones per block). The current zone count per block is small and static. Phase 8A must keep zones per block small and static (configured, not dynamically spawned) to preserve this property. The block count ceiling for Phase 8A without measuring zone-test cost is the current 4-block baseline; adding more blocks multiplies zone tests linearly.

**District manifest broadcast.** `districtManifest` in `arcade/city/city-district.mjs:127` sends the full block graph on every join. At 4 blocks the payload is small. If Phase 8A adds significantly more blocks (order of magnitude), the manifest broadcast should be reconsidered before shipping, not after.

Phase 8A should document its chosen block count and zone-per-block counts explicitly so these can be compared against the thresholds when they are measured.

---

### 8.4 The Clean Post-Plan Fork

Phase 8 planning concludes with two mutually exclusive next steps. These are not sequential; they are alternative gates. The operator chooses one based on what Phase 8A planning has produced and whether Phase 8B prerequisites are met.

---

**Fork A — IMPLEMENT PHASE 8A (static/config city scale, no live package load)**

Prerequisites:
- Phase 8 plan document is complete and reviewed.
- The desired additional blocks or second district are describable entirely as static configuration changes in `arcade/city/city-district.mjs` (ADJACENCY map), `arcade/city/city-block.mjs` (CITY_ROOMS array, geometry), and `workers/arcade/wrangler.toml` (DO bindings, migrations if a new DO class is needed) — no package-backed content, no CF-7 enablement.
- A unit-test expansion plan for the new topology exists (current baseline: block-adjacency and route-validation tests in `tests/arcade/city-district.test.mjs`).
- `LIVE_WORLD_LOADER_ENABLED` remains `false`. `check-production-config.mjs` still passes. Curated upload still excludes `arcade/creator/**`.

What 8A delivers: a larger static city (more blocks and/or a second named district) operating entirely on the proven per-block DO model, with no package-backed rendering, no live loader changes, and no economy. This is the minimal-risk next step.

Gate: `AUTHORIZED: IMPLEMENT PHASE 8A`

---

**Fork B — ENABLE CF-7 STAGING (one controlled approved package into the staging environment)**

This fork is NOT the next step after Phase 8 planning unless ALL of the following are independently true:

1. **A real package-loading use case exists.** Phase 8A (or an equivalent approved feature) has produced a specific block or district where a `block_style` or `block_layered` package would visibly improve the live city in a way static config cannot — and that use case has been documented and reviewed. "Because CF-7 exists" is not a use case.
2. **The CF-7 10-gate chain (gates 0–9) is end-to-end exercised locally.** `loadLivePackage` in `arcade/creator/approval/live-loader.mjs` has been driven through a complete local test run (all 10 gates pass for at least one real `block_style` or `block_layered` package, including a real `creator_live_approval_receipt` built from a real CF-8 approved-for-live-candidate record, a real `creator_approved_live_packages` registry entry, and a non-null `highestSeenEpoch` persisted from a prior run).
3. **`highestSeenEpoch` is wired from a durable client-side store.** CF-7 gate 8 requires `highestSeenEpoch` from the caller with no default (the deliberate fail-open prevention at `arcade/creator/approval/live-loader.mjs:153`). Enabling CF-7 without a persisted epoch source makes the monotonic rollback gate meaningless. The storage mechanism (e.g., `localStorage`, a DO key, a Worker KV entry) must be specified and its durability properties confirmed before Fork B is authorized.
4. **The staging environment (`neon-arcade-mesh-staging`, `[env.staging]` in `workers/arcade/wrangler.toml:138–171`) is up and has passed the current remote smoke harness.** Fork B requires a live staging target that already works, not a staging environment stood up at the same time as CF-7 enablement.
5. **Operator makes an explicit decision.** Fork B is not a technical conclusion; it is an authorization. The gate is: `AUTHORIZED: ENABLE CF-7 STAGING`.

What Fork B does not include: production deployment, economy or ownership mechanics, any relaxation of `FORBIDDEN_TERMS_RE`, any new DO migration beyond the current v4 tag, or any change to the `LIVE_WORLD_LOADER_ENABLED` constant in `arcade/creator/approval/approved-loader.mjs:31` without simultaneously satisfying all of the above.

---

### 8.5 Falsifiable: How We Would Know This Is Wrong

The sequencing and non-goals in this section are falsifiable by the following observations:

- **Wrong if** a Phase 8A design requires adding any entry to `INTERACTION_KINDS` (`arcade/city/city-interactions.mjs:20–26`) that matches `FORBIDDEN_RE` or the economy vocabulary in `FORBIDDEN_TERMS_RE`. That would mean the scale design embedded economic mechanics, violating the non-goal.
- **Wrong if** the districtManifest broadcast or CityRegistry heartbeat sweep is measurably slow under Phase 8A's chosen block count — meaning the threshold assessment in 8.3 underestimated scale cost. The fix is to reduce block count or redesign the registry before shipping, not after.
- **Wrong if** Fork B is reached and `highestSeenEpoch` has no specified durable source — meaning gate 8 of `loadLivePackage` would accept any epoch, making the monotonic rollback guarantee vacuous. The live loader's test suite catches this in unit tests (`tests/creator/live-loader.test.mjs`), but the absence of a wired client-side store is a runtime gap not covered by those tests.
- **Wrong if** Phase 8A's static block additions require a new `arcade/city/city-block.mjs` geometry variant. Geometry must remain byte-identical across all blocks (Phase 5B invariant, grounded in `publicLayout(cityId)` using the same base geometry with only landmark labels overlaid). A geometry fork would break the shared collision authority between `predictStep` (server) and the browser scene.
