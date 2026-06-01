# HiveWorld v0.3 — Room Health Mirror

Status: **IMPLEMENTED** on this branch (`feat/hiveworld-v0-3-room-health`). The mirror
landed on top of this spec: room heartbeats, stale-population eviction, health states,
room profiles, registry health, admin diagnostics, sideband mapping, and a
deterministic `roomHealthLifecycle` scenario. Product Phase 2c
(`feat/neon-circuit-phase2c-room-presence-health` @ `ca7a66d`) was the source of
truth. This doc is retained as the implementation spec/checklist.

The simulator is intentionally a **mirror, not a bridge** — it never imports or
talks to the product Worker/DO, and the product never imports the simulator.

## Outcome (what shipped)

- `core/phase1/rooms.mjs`: tick TTLs (`ROOM_HEARTBEAT_TTL_TICKS=30`,
  `ROOM_STALE_TTL_TICKS=90`), `deriveRoomHealth`, `isJoinableHealth`, `roomProfile`,
  `roomPresenceEntry`/`roomPresenceListPayload`, `roomDiagnosticsEntry`/`List`,
  `effectiveStatus`/`isRoomStatus`, `canAdmin`, + profile fields.
- `core/phase1/round-authority.mjs`: `activeRoundCount`.
- `core/reducers/registry.mjs` (new): `room_heartbeat` / `room_status_set` /
  `room_reset`, folding the `roomRegistry` slice (heartbeats + statusOverrides +
  generations); admin ops both-gated (ctx.adminEnabled + room authority).
- `core/state-util.mjs`: `roomRegistry` slice + fingerprint coverage + `adminEnabled`.
- `core/events.mjs` / `reducers/index.mjs` / `phase1/sideband-map.mjs`: the three
  events registered on presence/moderation.
- `core/room.mjs`: `heartbeat` / `setStatus` / `resetRoom` builders.
- `scenarios/phase1.mjs`: `roomHealthLifecycle`.
- Tests: `tests/hiveworld/phase2-room-health.test.mjs` (17) + extended sideband-map
  (2). Full sim suite **132 green**; UI smoke PASS; deterministic + convergent.

---

## Original spec (retained): what Phase 2c added to the product (the thing to mirror)

Product source of truth: `workers/arcade/src/rooms.mjs`,
`workers/arcade/src/room-registry.ts`, `workers/arcade/src/arcade-room.ts`, and
`docs/NEON_CIRCUIT_PHASE2C_ROOM_PRESENCE_HEALTH.md`.

1. **Heartbeat** — each room reports `{ room_id, schema_version, generation,
   population, capacity, status, last_activity_at, reported_at, active_connections,
   active_rounds, occupied_cabinets }` to the coordinator on join/leave/reset and on
   a ~30s tick. The coordinator stamps `last_seen_at` (its own receive clock).
2. **Stale eviction** — `ROOM_HEARTBEAT_TTL_MS=30_000`, `ROOM_STALE_TTL_MS=90_000`.
   fresh→population shown; stale→estimated; offline(>90s)→population 0 (evicted).
3. **Health** — `deriveRoomHealth(status, lastSeenAgeMs)` →
   `healthy|stale|offline|closed|maintenance|unknown` (admin status wins).
4. **Profiles** — `profile_id` / `catalog_profile` / `ruleset_profile` /
   `profile_label`; presentation only, never alters ticket formulas.
5. **Registry health** — public-safe presence list + envelope.
6. **Admin diagnostics** — both-gated (`diagnostics` op) per-room operational counts.

## Where to put it in the simulator

The sim mirrors the product modules under `arcade/hiveworld-sim/core/phase1/` and
folds events via `core/reducers/*` keyed by room (`arcadeRoom`/`withArcadeRoom` from
`core/phase1/round-authority.mjs`). Concrete tasks:

### 1. `core/phase1/rooms.mjs` (sim)
Port the pure additions from the product `rooms.mjs`:
- constants `ROOM_HEARTBEAT_TTL_MS`, `ROOM_STALE_TTL_MS`, `HEARTBEAT_SCHEMA_VERSION`,
  `ROOM_HEALTHS`;
- `deriveRoomHealth`, `isJoinableHealth`, `roomProfile`, `roomPresenceEntry`,
  `roomPresenceListPayload`, `roomDiagnosticsEntry`, `roomDiagnosticsList`;
- add `profile_id` / `ruleset_profile` / `profile_label` to the sim `ROOMS`
  (main-floor=standard, neon-training=training/"Training", late-night-circuit=
  late-night/"Late Night").
These are pure copies — keep them byte-aligned with the product so behavior matches.

### 2. Registry/health state in the world
The sim has no separate coordinator DO; model a `registry` slice on the world
state holding `heartbeats: { roomId -> heartbeat }` + `statusOverrides`. Add a
reducer (e.g. `core/reducers/presence.mjs` already exists — extend it, or add
`core/reducers/registry.mjs`) that:
- on `arcade_join` / `arcade_leave` / `arcade_reset` / a `tick` event, recomputes the
  room's heartbeat from the per-room arcade partition (population = distinct agents in
  room, active_rounds via the round registry, occupied_cabinets, generation) and
  stamps `last_seen_at = tick`;
- exposes a deterministic `now`/`tick` clock so staleness is reproducible.

### 3. Sideband mapping (`core/phase1/sideband-map.mjs`)
Add health/heartbeat events to `PHASE1_EVENT_SIDEBAND` + `PHASE1_PRODUCT_MAP`
(e.g. `room_heartbeat → ['ambient_presence','room_mood']`, `room_health_changed →
['weather']`). Keep `PRIVATE_FIELD_RE` passing — heartbeats/diagnostics must remain
public-safe (no balance/ledger/inventory/agent ids leaking into the feed).

### 4. Reset generation
Mirror the product: `arcade_reset` bumps a per-room `generation` carried in the
arcade partition and reported in the heartbeat.

### 5. Scenario (`scenarios/phase1.mjs`)
Add `roomHealthLifecycle` (or similar): agents join main-floor (→ healthy), advance
the deterministic clock past `ROOM_STALE_TTL_MS` with no activity (→ stale → offline,
population evicted to 0), then a new join restores healthy. Include a
maintenance-status leg (admin sets maintenance → health maintenance, joins rejected).
Must be deterministic + convergent across nodes (CRDT-log replay).

### 6. Tests (`tests/hiveworld/`)
- `phase2-room-health.test.mjs` (new): mirror the product
  `tests/arcade/rooms-health.test.mjs` groups — heartbeat public-safety, stale/offline
  eviction, the six health states, profiles (incl. award-equality across rooms),
  diagnostics shape + privacy.
- extend `phase1-sideband-map.test.mjs` for the new health sidebands.
- keep the existing **113** sim tests green.
- run: `node --test tests/hiveworld/*.test.mjs`.

### 7. Testbed UI (`hiveworld-testbed.html` + `hiveworld-debug.mjs`)
Optionally render the active agent's room health/freshness, mirroring the product
lobby badge. Keep the UI smoke test (`tests/hiveworld/run-ui-smoke.sh`) green.

## Acceptance

- existing 113 simulator tests remain green;
- new room-health tests pass;
- scenarios deterministic/convergent;
- privacy boundaries preserved (`feedIsPublicSafe` / `PRIVATE_FIELD_RE`);
- no product Worker/DO bridge introduced;
- commit locally: `feat(hiveworld): mirror room health semantics` (no push/PR/merge).

## Non-goals (unchanged from product Phase 2c)

no dynamic room creation · no global accounts · no cross-room inventory/economy ·
no real money/crypto/blockchain/token/NFT · no cash-out/staking/yield/resale ·
no gambling/wagering · no HiveWorld→product bridge · no AR/geospatial · no land
ownership · no production account inventory.
