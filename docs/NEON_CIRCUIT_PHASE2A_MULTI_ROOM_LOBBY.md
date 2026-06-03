# Neon Circuit — Phase 2a: Multi-Room Arcade Lobby

## Summary

Phase 2a is the first Phase 2 product sprint. It adds **room selection** and
**multiple room instances** to the Neon Circuit arcade without changing the core
game economy or adding any world/decentralized features. The product loop becomes:

```
open arcade → choose a room → join → play cabinets in that room →
tickets / inventory / challenges / feed are scoped to that room/session →
switch room safely → state boundaries stay isolated
```

This is the first step toward a living arcade world — but **not** HiveWorld.

## Branch / base

- Branch: `feat/neon-circuit-phase2a-multi-room-lobby`
- Base: `feat/neon-circuit-phase1l-neon-grid` @ `29f13c3` (the Phase 1 release candidate)
- **Stacked** on the unmerged Phase 1 RC. It cannot open cleanly against `main`
  until PR #4 and Phases 1f–1l land. No push / PR / merge was performed.

## Scope

- Three configured rooms (`main-floor`, `neon-training`, `late-night-circuit`),
  each a **fully isolated state namespace**.
- A lobby protocol + a lobby UI to list and switch rooms.
- All Phase 1 authority (occupancy, rounds, tickets, ledger, Prize Counter,
  inventory/equips, Challenge Board, achievements, public feed) is now room-scoped.
- Backwards compatible: a client with no `?room=` lands in `main-floor`; the legacy
  `main` room id maps to `main-floor`.

## Non-goals (explicit)

```
no global accounts
no cross-room inventory
no cross-room economy
no real money
no crypto
no blockchain
no token/NFT mechanics
no cash-out
no staking/yield/resale
no gambling/wagering
no HiveWorld bridge
no AR/geospatial layer
no land ownership
no production account inventory
```

## Room model

`workers/arcade/src/rooms.mjs` is the authoritative room catalog. Each room:

```
room_id, display_name, description, status, capacity, theme,
created_at, updated_at, ruleset_version, catalog_profile, visibility
```

| room | capacity | theme | cabinets |
|---|---|---|---|
| main-floor | 32 | neon | all three active |
| neon-training | 16 | training | all three active (same ticket rules) |
| late-night-circuit | 32 | midnight | all three active, separate state |

All three rooms run the **same** cabinets and the **same** (unchanged) ticket
formulas. Their state is independent.

## Room routing

The Worker (`index.ts`) resolves the optional, untrusted `?room=<id>` for
defense-in-depth + logging and forwards every `/arcade/ws` upgrade to a single
shared Durable Object instance (`idFromName("arcade")`). The DO is the **authority**
for room validation + binding. One shared DO hosts all rooms as **isolated state
namespaces** (`state.rooms[roomId] = { machines, ticketState }`), which keeps
cross-room population aggregation + isolation simple for the configured room set.
Per-room DO sharding is a documented future scaling step.

Rules enforced server-side:

- A socket is bound to exactly one room on join; all state + broadcasts are scoped
  to that room (`broadcastRoom(roomId, …)`).
- Room ids are sanitized (`[a-z0-9-]`, bounded length) — path traversal / weird ids
  are rejected.
- An explicit invalid room id → `room_join_rejected { reason: "invalid_room" }`;
  a missing room id → default `main-floor` (backwards compatible).
- The legacy `main` id aliases to `main-floor`.
- Capacity is enforced (`room_join_rejected { reason: "room_full" }`).
- Reconnecting with the same `?room=` returns to the same room's state.
- State never leaks across rooms (proven by tests).

## Lobby protocol

```
client → server: room_list_request, join_room, room_join_request,
                 room_leave_request, room_state_request
server → client: room_list, room_joined, room_join_rejected, room_left,
                 room_state, room_population
```

`room_list` / `room_joined` carry only public-safe metadata (room id, display name,
description, status, capacity, population, theme, cabinet_summary). They never
include private player data, ledgers, balances, inventory, challenge state, or raw
connection ids.

## Lobby UI

`arcade/arcade-lobby.js` + `arcade/arcade-lobby.css`: a room list panel (opened from
the HUD room chip) showing each room's population, capacity, description, and
cabinet count, with an Enter/Full/“You are here” control. It forwards intent only;
the server validates joins, owns populations, and scopes state. Mobile-first; shows
the connection state, the current room, and a clear error on join rejection. The
floor auto-joins `main-floor` for backwards compatibility / tests.

## Client room switching

`neon-circuit-room-client.js` binds to a room (from `?room=`, default `main-floor`).
`switchRoom(roomId)`:

1. closes the current socket cleanly,
2. **bumps a connection generation id** so any in-flight old-room responses are
   ignored (stale messages can never corrupt the new room's UI),
3. connects to the selected room and re-joins.

On (re)connect the server re-sends the new room's balance / ticket-state /
cosmetic-state / challenge-progress / achievement-state / feed / inventory /
ledger / catalogs, so the floor's room-scoped UI is fully refreshed; transient
round ids are cleared by the floor.

## Room-scoped state

Per room and fully isolated: cabinet occupancy, rounds, ticket balances, ledger,
Prize Counter inventory, cosmetic equip state, Challenge Board progress, achievement
claims, and the public event feed. The cabinet/adapter render state is page-global
(the same three cabinets exist in every room) — Neon Grid is still activated through
the adapter/import path once per page.

## Backwards compatibility

- No `?room=` → `main-floor`; legacy `join_room { roomId: "main" }` → `main-floor`.
- All existing Phase 1 tests pass unchanged (214 product unit tests; two-client +
  frame-contract browser flows) against the multi-room server.

## Privacy model

The room list + populations are public-safe aggregates only. A player's balance,
ledger, inventory, and challenge state are owner-only and room-scoped; the feed
carries only public-safe summaries. Other clients in the same room see only public
state (occupancy, equipped cosmetics, the feed); other rooms see nothing.

## Validation plan

```bash
node --test tests/arcade/*.test.mjs                 # 224 (214 Phase 1 + 10 rooms)
bash tests/arcade/run-frame-contract.sh             # FRAME CONTRACT: PASS
bash tests/arcade/run-two-client.sh                 # TWO-CLIENT: PASS (backwards compat)
bash tests/arcade/run-multi-room.sh                 # MULTI-ROOM: PASS (dev shim)
# Node 22 real Worker/DO:
cd workers/arcade && npm run dev                     # wrangler dev on :8787
BASE_URL=http://localhost:8080 WS_URL=ws://localhost:8787/arcade/ws \
  bash tests/arcade/run-multi-room.sh                # MULTI-ROOM: PASS (real DO)
wrangler deploy --dry-run                            # bundle clean
```

## Known limitations

```
room/session state only (no durable account state)
no global account identity
no cross-room inventory / economy
room list is static / configured (no public matchmaking)
no moderation / admin room tools beyond validation
single shared DO instance for all rooms (per-room DO sharding is future scaling)
cross-room population is exact only because all rooms share one DO
no HiveWorld bridge
```

## Next phase options

- Phase 2b: per-room DO sharding + a lightweight room registry/coordinator for
  population aggregation at scale; room lifecycle (create/reset/admin) tooling.
- Mirror the multi-room semantics in the HiveWorld simulator (see
  `docs/HIVEWORLD_PHASE2A_SIMULATOR_TODO.md`).
- Track D (account/identity readiness) remains gated behind multi-room.
