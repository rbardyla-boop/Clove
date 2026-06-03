# Neon Circuit — Phase 2b: Per-Room DO Sharding + Registry + Room Lifecycle

## Summary

Phase 2b scales the Phase 2a multi-room arcade and adds operator tooling:

1. **Per-room Durable Object sharding** — each room is now its OWN `ArcadeRoom`
   instance (`idFromName(roomId)`), so rooms scale independently and are isolated
   by construction (one DO = one room).
2. **A `RoomRegistry` coordinator DO** — a single instance that aggregates
   cross-room population (room DOs report join/leave) and owns admin status
   overrides. Reached only DO-to-DO; clients never touch it directly.
3. **Room lifecycle tooling (static rooms)** — admins can **reset** a room (wipe
   its state) and **set status** (open / closed / maintenance) to gate new joins.
   No dynamic room creation; the configured room set is unchanged.

This reverses the Phase 2a single-DO-partitioned design (which was chosen for
simplicity) now that population aggregation has a dedicated coordinator.

## Branch / base

- Branch: `feat/neon-circuit-phase2b-room-sharding`
- Base: `feat/neon-circuit-phase2a-multi-room-lobby` @ `d5c9574`
- **Stacked** on the unmerged Phase 2a / Phase 1 RC. No push / PR / merge performed.

## Scope

- Worker routes `/arcade/ws?room=<id>` to `idFromName(roomId)` (per-room DO).
- `RoomRegistry` DO: `populations` + `statusOverrides`; DO-to-DO endpoints
  `/registry/report`, `/registry/list`, `/registry/status`, `/registry/admin`.
- `ArcadeRoom` (still hosts one room's state) learns its bound room from the routed
  `?room=`, reports population to the registry, enforces status per join, and
  forwards admin ops to the registry.
- Room lifecycle: `reset` (wipe a room) + `set_status` (open/closed/maintenance).
- Admin gating: **dev flag (`ADMIN_ENABLED`) AND admin token (`ADMIN_TOKEN`)** —
  defense in depth; admin is OFF unless BOTH are configured. The token is a
  server-side secret, NEVER committed.
- Lobby UI: room status badges + a gated admin panel (token + per-room reset/status).

## Non-goals (explicit)

```
no global accounts
no production auth provider (admin = operational gating only)
no dynamic / user-created rooms (the room set is static config)
no cross-room inventory / economy
no real money, crypto, blockchain, token/NFT, cash-out
no staking/yield/resale, gambling/wagering
no HiveWorld bridge
no AR/geospatial layer
no land ownership
no production account inventory
```

## Architecture

```
client --ws ?room=X--> Worker --idFromName(X)--> ArcadeRoom[X]  (one DO per room)
                                                     |  report population / fetch status / forward admin
                                                     v  (DO-to-DO)
                                                 RoomRegistry  (single coordinator)
                                                     |  reset → ArcadeRoom[X] /admin/reset (DO-to-DO)
```

- **Room isolation** is structural: different rooms are different DO instances.
- **Population** is aggregated by the registry (each room DO POSTs its live count
  on join/leave). `room_list_request` makes the room DO fetch `/registry/list`.
- **Status** is read from the registry per join (`/registry/status?room=X`); a
  `closed`/`maintenance` room rejects the next join (`room_join_rejected`). The
  registry status check is **fail-open**: a registry outage never locks players out.
- **Reset** is forwarded by the registry to the target room DO, which wipes its
  partition (occupancy + tickets + ledger + inventory + challenges + feed) and
  pushes fresh state + a `room_reset` to its connected players.

## Admin gating

`workers/arcade/src/admin.mjs` (`checkAdmin`): an op is allowed ONLY when
`ADMIN_ENABLED === 'true'` AND a non-empty `ADMIN_TOKEN` secret matches the
caller's token. Gating is centralized in the `RoomRegistry` (the coordinator);
room DOs forward the raw op (with the token) and relay the result.

Configure the token out-of-band (never in the repo):

```
prod: wrangler secret put ADMIN_TOKEN
dev:  wrangler dev --var ADMIN_ENABLED:true --var ADMIN_TOKEN:<token>
test: ADMIN_ENABLED=true ADMIN_TOKEN=<token> node workers/arcade/dev-shim.mjs
```

## Lobby protocol additions

```
client → server: room_admin { op: 'reset'|'set_status', roomId, status?, token }
server → client: room_admin_result { ok, op, roomId, status?, reason? }
                 room_reset { roomId }   (broadcast to a reset room's players)
room_list now includes the effective (admin-overridden) status per room.
```

## Backwards compatibility

- No `?room=` → main-floor; legacy `join_room { roomId: "main" }` → main-floor.
- All Phase 1 + Phase 2a tests pass unchanged (occupancy / rounds / tickets /
  ledger / Prize Counter / challenges / achievements / feed / adapters / frame /
  reconnect / privacy / multi-room isolation / safe switching).

## Validation

```bash
node --test tests/arcade/*.test.mjs                 # 230 (Phase 1/2a + 6 admin/status)
bash tests/arcade/run-frame-contract.sh             # PASS
bash tests/arcade/run-two-client.sh                 # PASS (backwards compat)
bash tests/arcade/run-multi-room.sh                 # PASS (isolation + switching)
bash tests/arcade/run-room-admin.sh                 # PASS (gating + reset + status)
# Node 22 real Worker/DO (per-room DOs + registry, DO-to-DO):
wrangler dev --var ADMIN_ENABLED:true --var ADMIN_TOKEN:<token>
ADMIN_TEST_TOKEN=<token> BASE_URL=... WS_URL=ws://localhost:8787/arcade/ws \
  bash tests/arcade/run-multi-room.sh ; bash tests/arcade/run-room-admin.sh
wrangler deploy --dry-run                            # bundle clean (2 DO classes)
```

## Known limitations

```
static configured rooms (no dynamic/user-created rooms)
admin is operational gating (dev flag + token), not an auth/accounts system
population is eventually-consistent (room DOs report deltas to the registry)
per-join registry status fetch adds one DO-to-DO call per join (fine at this scale)
single RoomRegistry instance (a global hot path; shard/partition it if needed later)
no moderation tooling beyond reset/status
no HiveWorld bridge
```

## Next phase options

- Registry sharding / a population gossip layer if room count or churn grows.
- Room lifecycle history / audit log for admin ops.
- Mirror Phase 2a/2b multi-room semantics into the HiveWorld simulator
  (`docs/HIVEWORLD_PHASE2A_SIMULATOR_TODO.md`).
- Track D (account/identity readiness), still gated behind multi-room.
