# HiveWorld v0.2 — Multi-Room Parity

## Summary

v0.2 mirrors the product **Phase 2a/2b multi-room** semantics into the HiveWorld
simulator. The simulator's arcade world slice is now **partitioned by room**, so
tickets / ledger / inventory / equips / challenges / feed are fully ISOLATED per
room — exactly like the per-room product Durable Objects. Occupancy was already
room-keyed. This is a simulator/testbed update on the HiveWorld branch; it does NOT
touch the product Worker/DO and adds no money/crypto/account features.

## Branch / base

- Branch: `feat/hiveworld-v0-2-multi-room`
- Base: `feat/hiveworld-v0-1-phase1-parity` @ `fb4dde8` (the Phase 1 arcade-parity baseline)
- Separate from the product branches. No push / PR / merge.

## What changed from v0.1

v0.1 mirrored a SINGLE room's arcade. v0.2 partitions it:

- `core/phase1/round-authority.mjs`: `createArcade()` is now the single-room
  SUBSTATE; new `createArcadeWorld()` (`{ rooms: {} }`) is the world slice, with
  pure `arcadeRoom(world, roomId)` (read) + `withArcadeRoom(world, roomId, sub)`
  (immutable write). Default room `room:main`.
- `core/reducers/arcade.mjs`: every arcade reducer scopes to the event's `room_id`
  partition (read the room substate → run the pure function → write it back under
  the same room).
- `core/agent.mjs`: `redeemArcadePrize` / `equipCosmetic` / `unequipCosmetic` /
  `claimChallenge` now carry the agent's current room; the `arcade*` accessors read
  a per-room partition.
- `core/state-util.mjs`: the world starts with `createArcadeWorld()`.
- `core/phase1/rooms.mjs` (new): the product room catalog (3 rooms) + public-safe
  room list, ported.
- `scenarios/phase1.mjs`: new `multiRoomIsolation` scenario (A earns + redeems in
  main-floor, earns separately in neon-training; B occupies a cabinet in one room
  while it stays free in the other).
- Testbed UI: the Phase 1 panel renders the active agent's CURRENT-room partition.

## Parity proven

`tests/hiveworld/phase2-multi-room.test.mjs`:

- the room catalog mirrors the product (3 rooms, public-safe list);
- the arcade world slice is a per-room partition; `arcadeRoom`/`withArcadeRoom` are
  pure + isolated;
- tickets / inventory / challenges are isolated per room (earning in main-floor
  does not affect neon-training; a badge in one room is not owned in another);
- occupancy is per-room (a cabinet busy in one room is free in another);
- the public feed is isolated per room (no cross-room leakage);
- the multi-room scenario converges + is deterministic.

## Tests

- All 107 v0.1 simulator tests remain green (updated to read the `room:main`
  partition where they inspect arcade state).
- 6 new multi-room isolation tests. **Total: 113 unit tests.**
- The Playwright testbed UI smoke passes with per-room rendering.

```bash
node --test tests/hiveworld/*.test.mjs            # 113 pass
PW_REQUIRE_BASE=<playwright/package.json> bash tests/hiveworld/run-ui-smoke.sh
```

## Known limitations

- Still a mirror, not the canonical authority; keep in sync if product formulas
  change.
- Room status/admin (Phase 2b reset + open/closed/maintenance) is modelled in the
  product, not yet in the simulator — a v0.3 follow-up.
- Single-process simulator (no real DO sharding); it models the SEMANTICS of
  per-room isolation, not the transport.

## Non-goals

```
no product Worker/DO bridge
no HiveWorld V1
no AR/geospatial layer
no real money, crypto, blockchain, token/NFT, cash-out
no staking/yield/resale, gambling/wagering
no land ownership
no production account inventory
```
