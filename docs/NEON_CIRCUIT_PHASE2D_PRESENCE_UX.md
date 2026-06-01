# Neon Circuit — Phase 2d: Room Presence UX + Smart Lobby Routing

## Summary

Phase 2c built the room-presence *infrastructure* (heartbeats, stale/offline health,
profiles, registry health, admin diagnostics). Phase 2d turns that infrastructure
into better **player-facing lobby behaviour** — without adding any server surface.

It adds, all derived purely client-side from the already-public Phase 2c room list:

1. **Activity summaries** — a per-room liveliness label (Busy / Lively / Active /
   Empty / Quiet / Offline / Closed / Maintenance).
2. **Smart recommendations** — busiest healthy room, the training room, and a quiet
   room to revive; each is a one-click "smart join".
3. **Presence-driven sorting** — active healthy rooms first, then empty, then degraded
   (stale/offline), then closed/maintenance last.
4. **Health-aware join** — recommendations only ever target joinable (`open`) rooms;
   closed/maintenance stay disabled (from Phase 2c).
5. **Empty/stale room recovery UX** — an actionable hint ("be the first" / "joining
   will wake it up") on quiet or degraded rooms, which remain joinable so they
   self-heal on the next join.

## Branch / base

- Branch: `feat/neon-circuit-phase2d-presence-ux`
- Base: `feat/neon-circuit-phase2c-room-presence-health` @ `ca7a66d` (stacked, local-only)

## Architecture decision: client-only, no server change

Recommendations / activity / sorting are **pure functions of already-public fields**
(`status`, `health`, `population`, `capacity`, `profile_id`). The same room list
every client receives yields identical results everywhere, so there is **no server
authority, no protocol change, and no new private data** to leak. Concretely:

- `workers/` is **untouched** — the Worker/DO bundle is byte-identical to the
  validated Phase 2c build.
- The pure logic lives in `arcade/room-recommend.mjs` (a Pages-served browser module;
  the browser cannot import `workers/` in production). It is unit-tested with `node`
  and stays mirror-ready for a future HiveWorld v0.4.

This is deliberately conservative: it is presentation/UX over existing data, not a
new system.

## What shipped

- **`arcade/room-recommend.mjs`** (new, pure): `isJoinable`, `roomActivity`,
  `recommendRooms` (busiest / training / revive), `sortRoomsForLobby`,
  `roomRecoveryHint`.
- **`arcade/arcade-lobby.js`**: imports the pure helpers; renders a "Recommended"
  banner (smart-join chips), per-card activity chips, presence-sorted order (the
  stored list is left as-received — `getRooms()` unchanged), and recovery hints that
  replace the Phase 2c generic warning with actionable copy. Join gating is unchanged
  (status-driven; closed/maintenance disabled; stale/offline warn-but-joinable).
- **`arcade/arcade-lobby.css`**: styles for the recommendations banner + activity
  chips (reuses the Neon palette; respects `prefers-reduced-motion`).

## Activity + recommendation rules (deterministic)

- `roomActivity`: closed/maintenance → status; offline/stale/unknown → degraded;
  healthy → `empty` (pop 0) / `busy` (≥75% capacity or ≥24) / `lively` (≥3 or ≥25%) /
  `active`.
- `recommendRooms`: **busiest** = most-populated healthy+open+not-full room excluding
  the current room; **training** = the `training`-profile room if joinable + not full;
  **revive** = a healthy but empty room (excludes current). Ties break by `room_id`.
- `sortRoomsForLobby`: rank active-healthy → empty-healthy → stale/unknown → offline →
  closed/maintenance; within a rank, higher population first, then `room_id`.

## Non-goals (explicit)

- no dynamic room creation
- no accounts / global identity
- no cross-room inventory
- no cross-room economy
- no real money / crypto / blockchain / token / NFT
- no cash-out / staking / yield / resale
- no gambling / wagering
- no HiveWorld bridge
- no AR / geospatial layer
- no land ownership
- no production account inventory
- no server/Worker/DO/protocol change
- **not** a "dead-socket eviction" sprint — Phase 2c already owns heartbeat/stale
  handling; Phase 2d only surfaces it as better lobby behaviour.

## Tests

- **Unit** (`node --test tests/arcade/*.test.mjs`): **258 pass** (was 247; +11 in
  `tests/arcade/room-recommend.test.mjs` — activity levels, recommendation selection
  incl. exclude-current/full/closed, deterministic sorting, recovery hints, privacy).
- **Frame contract**: PASS.
- **Browser, dev-shim**: new `run-room-presence-ux.sh` PASS (activity chips render,
  presence sorting, recommendation chip present + never the current room, smart-join
  routes the player, zero console errors). Regression: `run-two-client.sh`,
  `run-room-admin.sh`, `run-room-health.sh`, `run-frame-contract.sh` all PASS.
- **Real Worker/DO**: not re-run — `workers/` is unchanged, so the server behaves
  exactly as in the Phase 2c real-DO validation; the new code is pure client UX that
  runs against any room-list source.

## Manual validation

```
node --test tests/arcade/*.test.mjs
PW_REQUIRE_BASE=<playwright>/package.json bash tests/arcade/run-room-presence-ux.sh
```

## Known limitations

- Recommendations are heuristic (population/health), not personalized — no accounts.
- Activity/health are derived from heartbeat-fed presence (eventually consistent).
- A room with no recommendation chips (e.g. you're already in the only busy room)
  simply shows none — the banner hides itself.
- Static room list (no dynamic creation/matchmaking) — unchanged from Phase 2a–2c.

## Next phase options

- **HiveWorld v0.4** — mirror these pure presence-UX helpers into the simulator
  (per the parity rule: product step → simulator mirror → next product step).
- Personalized hints once/if identity ever exists (out of current scope).
- Server-published activity rollups if a non-lobby consumer ever needs them
  (currently unnecessary — client derivation suffices).
