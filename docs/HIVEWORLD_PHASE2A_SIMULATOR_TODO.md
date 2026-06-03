# HiveWorld Simulator — Phase 2a Multi-Room Follow-Up (TODO)

## Why this is a doc, not code

Phase 2a (Multi-Room Arcade Lobby) was implemented on the **product** branch
`feat/neon-circuit-phase2a-multi-room-lobby`. The HiveWorld simulator lives on a
**separate** branch (`feat/hiveworld-v0-1-phase1-parity` @ `fb4dde8`) and is the
Phase 2 lab baseline. This sprint deliberately did **not** modify
`arcade/hiveworld-sim/` from the product branch — the product branch must never
accidentally absorb HiveWorld code, and the simulator must stay a clean baseline.

So this is a tracked follow-up: after Phase 2a lands (or on the simulator branch),
the simulator should be updated to mirror the new multi-room semantics.

## What the simulator already proves (Phase 1 parity)

The simulator (`arcade/hiveworld-sim/core/phase1/*`) already mirrors a single
room's arcade: catalog, three cabinets, server-authoritative rounds, ticket
formulas, ledger, Prize Counter, challenges, achievements, public feed, frame
contract, adapter SDK / import loader. Authority lives in the canonical fold.

## What Phase 2a adds that the simulator should mirror

1. **Multiple rooms as isolated state namespaces.** The world fold already keys
   occupancy by `room_id` (`state.rooms[roomId].machines`). Extend the same
   partitioning to the Phase 2a `arcade` slice: key balances / ledger / inventory /
   equips / challenge progress / achievements / feed by `room_id` (e.g.
   `arcade.rooms[roomId] = { balances, ledger, ... }`), and scope the arcade
   reducers to the event's `room_id`.

2. **Room catalog parity.** Port `workers/arcade/src/rooms.mjs` into
   `core/phase1/rooms.mjs` (the three configured rooms + `resolveRoomId` +
   `roomListPayload`). It is pure and zero-dependency, so it ports cleanly.

3. **Room-scoped isolation scenarios + tests.** Mirror
   `tests/arcade/rooms.test.mjs` + the multi-room browser flow as deterministic
   simulator scenarios:
   - earning in `main-floor` does not affect `neon-training`;
   - a badge in one room is not owned in another;
   - occupancy is per-room (busy in one room, free in another);
   - the feed in room A never shows room B events;
   - reconnect/replay converges per room.

4. **Sideband mapping note.** Room joins/leaves map to the `presence` /
   `discovery` sidebands; the existing arcade event types simply gain a `room_id`
   scope. No new sidebands are required.

## Hard boundaries for the follow-up

- Do this on the **simulator** branch, never the product branch.
- No HiveWorld V1, no production Worker/DO bridge, no AR/geospatial, no money/crypto.
- Keep the simulator a mirror, not the canonical authority.

## Status

- [ ] Port `rooms.mjs` into the simulator.
- [ ] Partition the `arcade` slice by `room_id`.
- [ ] Scope the arcade reducers + agent helpers by room.
- [ ] Add multi-room isolation scenarios + tests.
- [ ] Update `docs/HIVEWORLD_V0_1_PHASE1_PARITY.md` to a v0.2 note.

> Until this lands, the simulator remains a faithful **single-room** mirror of the
> arcade — which is correct for the Phase 1 baseline and does not block Phase 2a.
