# Neon Circuit — Phase 2c: Room Presence Reliability + Room Profiles

## Summary

Phase 2b sharded the arcade into one `ArcadeRoom` Durable Object per room plus a
single `RoomRegistry` coordinator DO. Rooms could *report* a population, but the
system had no notion of room **health** over time: a room DO that went away left
ghost population behind, and there was no operational visibility into a room.

Phase 2c hardens room presence and adds light product polish:

1. **Room heartbeat** — each `ArcadeRoom` DO reports a full heartbeat to the
   registry on join / leave / disconnect / reset and on its existing ~30s alarm tick.
2. **Stale population eviction** — the registry stamps each heartbeat with a
   receive-clock `last_seen_at` and derives freshness; stale rooms are flagged and
   expired rooms have their population evicted to 0 (no ghost population).
3. **Room health** — `healthy | stale | offline | closed | maintenance | unknown`,
   surfaced in the room list.
4. **Per-room catalog/ruleset profiles** — presentation-only labels
   (`standard` / `training` / `late-night`); they never alter economics.
5. **Registry health endpoint** — `GET /arcade/rooms/health`.
6. **Admin diagnostics** — a both-gated (`diagnostics`) admin op returning
   per-room operational counts.
7. **Lobby health display** — health badges, freshness, profile labels, and a
   warning for degraded rooms.

## Branch / base

- Branch: `feat/neon-circuit-phase2c-room-presence-health`
- Base: `feat/neon-circuit-phase2b-room-sharding` @ `cfa7ffd` (stacked, local-only)
- Simulator mirror (separate branch): `feat/hiveworld-v0-3-room-health` (from
  `feat/hiveworld-v0-2-multi-room`).

## Scope

Reliability + product polish on top of the existing per-room DO sharding. No change
to the sharding model, ticket formulas, cabinet frames, or the adapter import
security model. The coordinator owns room metadata / health / population summaries
only; the room DO still owns all gameplay state.

## Non-goals (explicit)

- no dynamic room creation
- no global accounts
- no cross-room inventory
- no cross-room economy
- no real money
- no crypto
- no blockchain
- no token/NFT mechanics
- no cash-out
- no staking/yield/resale
- no gambling/wagering
- no HiveWorld bridge (the simulator mirror lives on its own branch; nothing in the
  product Worker/DO path imports or talks to HiveWorld)
- no AR/geospatial layer
- no land ownership
- no production account inventory

## Heartbeat model

Each `ArcadeRoom` DO is bound to exactly one room (per-room sharding from 2b). It
reports a heartbeat to the registry (`POST /registry/report`) with these public-safe
fields (NO player ids):

```
room_id, schema_version, generation, population, capacity, status,
last_activity_at, reported_at, active_connections, active_rounds, occupied_cabinets
```

Heartbeats are reported on **join**, **leave / disconnect**, **reset**, and on the
existing **stale-lock alarm** (~30s), which doubles as a heartbeat tick. The alarm
self-reschedules, so a live (or recently-live) room keeps itself `healthy`; a room
that goes quiet eventually ages to `stale` then `offline`.

The registry stamps each stored heartbeat with its own receive-clock
`last_seen_at` — the **authoritative freshness timestamp** (so it does not trust a
reporting room's clock for staleness).

## Stale population policy

Constants (in `workers/arcade/src/rooms.mjs`):

```
ROOM_HEARTBEAT_TTL_MS = 30_000   // fresh window
ROOM_STALE_TTL_MS     = 90_000   // beyond this → offline + population evicted
```

| freshness (age of last_seen_at) | health   | population shown            |
|---------------------------------|----------|-----------------------------|
| ≤ 30s                           | healthy  | reported (not estimated)    |
| 30s – 90s                       | stale    | last reported, **estimated**|
| > 90s                           | offline  | **0** (evicted), estimated  |
| never reported                  | unknown  | 0, estimated                |

This prevents ghost population: a room whose DO has stopped reporting drops to 0
rather than showing a frozen count forever.

## Room health states

`deriveRoomHealth(status, lastSeenAgeMs)` is a pure function:

- `status = closed` → `closed`
- `status = maintenance` → `maintenance`
- otherwise (open): `healthy` / `stale` / `offline` / `unknown` by freshness above.

Admin status always wins for health (a closed room reads `closed` regardless of
heartbeat freshness).

## Room profiles

Each static room carries `profile_id`, `catalog_profile`, `ruleset_profile`, and an
optional `profile_label`:

| room                | profile_id | catalog_profile | ruleset_profile | label      |
|---------------------|------------|-----------------|-----------------|------------|
| main-floor          | standard   | standard        | standard        | —          |
| neon-training       | training   | training        | standard        | Training   |
| late-night-circuit  | late-night | standard        | standard        | Late Night |

Profiles are **presentation only**. The round/ticket authority resolves every
formula from the cabinet catalog by machine id, independent of room/profile, so
identical rounds award identical tickets in every room (proven in
`tests/arcade/rooms-health.test.mjs`). Profiles may affect labels, help text, theme,
and cabinet ordering — never ticket formulas, prize costs, rewards, or inventory.

## Registry health endpoint

`GET /arcade/rooms/health` (Worker → `RoomRegistry` `/registry/health`):

```json
{ "ok": true, "service": "neon-arcade-room-registry", "phase": "2c",
  "schema_version": 1, "rooms": [ /* public-safe presence entries with health */ ] }
```

Public-safe: no tokens, connection ids, balances, ledger, inventory, or challenge
state.

## Admin diagnostics

A new admin op `diagnostics` (alongside `reset` / `set_status`) returns per-room
operational detail:

```
room_id, status, health, generation, reset_generation, population,
last_reported_at, last_seen_at, last_activity_at,
active_connection_count, active_round_count, occupied_cabinet_count
```

Gated by the SAME Phase 2b rule — both `ADMIN_ENABLED === 'true'` AND a matching
`ADMIN_TOKEN`. The token is never logged, never returned, and never present in any
public room state. Diagnostics carry no player ids / balances / ledger / inventory.

## Client lobby changes

The lobby (`arcade/arcade-lobby.js` + `.css`) now shows, per room: a **health
badge**, a **profile label** chip, and population **freshness** (a `~` prefix +
tooltip when estimated). Join gating is driven by **status** (closed/maintenance
disable the Enter button); a `stale`/`offline` room shows a warning but stays
joinable, because it is still configured open and a fresh join re-instantiates its
authority (avoiding a deadlock where an idle room could never be re-entered). The
admin panel gains a **Diagnostics** button that renders the per-room table after the
token is supplied.

## Dev-shim parity

`workers/arcade/dev-shim.mjs` models the registry heartbeat store, records a
heartbeat on join/leave/reset, serves the Phase 2c presence list, supports the
`diagnostics` admin op, and adds a **TEST-ONLY** `__test_set_heartbeat_age` hook that
ages a room's stored heartbeat so the stale/offline policy can be exercised
deterministically. The same pure `deriveRoomHealth` / `roomPresenceEntry` /
`roomDiagnosticsList` code runs in both the shim and the real registry, so tested
flows are byte-identical.

## Tests

- **Unit** (`node --test tests/arcade/*.test.mjs`): **247 pass** (was 230). New
  `tests/arcade/rooms-health.test.mjs` (16) covers heartbeat public-safety, the
  stale/offline eviction policy, all six health states, profiles (incl. proof that
  profiles do not change ticket awards), and the diagnostics shape + privacy.
  `tests/arcade/admin.test.mjs` extended for the `diagnostics` op + gating.
- **Frame contract** (`run-frame-contract.sh`): PASS.
- **Browser, dev-shim**: `run-two-client.sh` PASS, `run-room-admin.sh` PASS, new
  `run-room-health.sh` PASS (15 checks: health in list, freshness, profile labels,
  stale + offline eviction via the test hook, diagnostics gating + privacy,
  maintenance reject, zero console errors).
- **Browser, real Worker/DO** (`wrangler dev`, Node 22): two-client PASS, room-admin
  PASS, room-health PASS for health-in-list / profile labels / diagnostics
  gating+privacy / `GET /arcade/rooms/health` 2c envelope / maintenance reject /
  zero console errors. See the limitation note below.

## Manual validation

```
# dev shim (Node 18 OK)
node --test tests/arcade/*.test.mjs
PW_REQUIRE_BASE=<playwright>/package.json bash tests/arcade/run-room-health.sh

# real Worker/DO (Node 22)
nvm use 22 && cd workers/arcade && npm run dev   # :8787, --var ADMIN_ENABLED:true --var ADMIN_TOKEN:<t>
curl -s http://127.0.0.1:8787/arcade/rooms/health | jq
```

## Known limitations

- Static room list — no dynamic creation, no matchmaking.
- Health is heartbeat-derived, not full observability.
- Population is eventually consistent (aggregated via the coordinator heartbeat).
- Admin token is operational gating, **not** user auth — no accounts, no login.
- No global profile, no cross-room inventory/economy.
- The HiveWorld simulator mirror remains on its own branch and is never bridged
  into the product Worker/DO path.
- The stale/offline policy is the conservative product choice (degraded rooms warn
  but remain joinable so they can self-heal). A future phase could add explicit
  health-gated routing or auto-pause.

## Next phase options

- **Phase 2d**: registry-driven presence eviction of dead sockets, or per-room
  ruleset/catalog *profiles that legitimately reorder/hide cabinets* (still
  formula-neutral).
- Health-aware room recommendation in the lobby ("busiest healthy room").
- Persisted heartbeat history for an admin status timeline.
