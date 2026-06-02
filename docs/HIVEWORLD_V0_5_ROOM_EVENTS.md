# HiveWorld v0.5 — Room Events / Scheduled Cabinet Rotations Mirror

Status: **IMPLEMENTED** on `feat/hiveworld-v0-5-room-events` (from v0.4
`feat/hiveworld-v0-4-presence-ux` @ `6ec22fc`). Mirrors product **Phase 2e**
(`feat/neon-circuit-phase2e-room-events` @ `fe74c2e`,
`docs/NEON_CIRCUIT_PHASE2E_ROOM_EVENTS.md`) into the simulator, per the parity rule
(product step → simulator mirror → next product step).

The simulator is a **mirror, not a bridge** — it never imports or talks to the product
Worker/DO, and the product never imports the simulator. Local-only; no push/PR/merge.

## What it mirrors

Product Phase 2e added server-authoritative, deterministic, **display-only** scheduled
room events: each room rotates through a static event list that highlights a cabinet or
a room activity, derived purely from `roomId` + a wall-clock ms window. v0.5 ports the
model into the simulator using the simulator's logical **TICK** clock (the only
difference is the unit: ticks here, ms there).

New: `arcade/hiveworld-sim/core/phase1/room-events.mjs` (PURE, zero-dep):

- `EVENT_WINDOW_TICKS = 20`, `slot = (windowIndex + phase) mod k` — same rotation shape
  as the product, desynced per room by `phase`.
- `EVENT_SCHEDULES` — the same 3 rooms / schedule keys / event types / featured cabinet
  ids / phases as the product (`main-floor` 0, `neon-training` 1, `late-night-circuit` 2).
- `getCurrentRoomEvent` / `getNextRoomEvent` / `getRoomEventSchedule` /
  `deriveEventStatus` — `nowTick`-injectable, deterministic, no drift.
- `roomEventPublic` / `attachRoomEvents(presenceList, nowTick)` — enrich the v0.3 folded
  presence list with `current_event` / `next_event` / `event_ends_in_ticks` /
  `event_starts_in_ticks` / `featured_cabinet_id` + `event_ruleset_version`
  (`arcade-events/1`, same string as product).
- `annotateCatalogForRoom` — display-only `is_featured` / `featured_reason` /
  `featured_event_id` on the current event's featured cabinet; fail-safe otherwise.
- `roomEventListPayload` — current + next + one-rotation schedule.

Featured-cabinet resolution uses the sim catalog (`isLiveTicketed` + `getCabinet`),
matching the product's `isPlayableCabinet` fail-safe.

### Recommendation parity

`room-recommend.mjs` gains the Phase 2e display helpers (reading the server/sim-attached
`current_event`): `roomEventBadge`, `roomNextEventLabel`, `roomEventWarmupHint`,
`formatEventCountdown` (tick spans, e.g. `12t`). No money/economy framing.

### Sideband mapping

`sideband-map.mjs` adds `ROOM_EVENT_SIDEBAND` + `sidebandForRoomEvent`: a room-wide
scheduled event maps to the ambient **weather** channel (alongside room_mood /
room_health); the featured-cabinet **annotation** maps to **discovery** (alongside
cabinet_catalog). Scheduled events are a deterministic PROJECTION (like room health),
not raw fabric events the fold ingests, so they map conceptually rather than being folded.

### Scenario

`scenarios/phase1.mjs` adds `roomEventWindowShowcase`: three healthy rooms heartbeat at
tick 22 so a test can observe two adjacent event windows (window 1 ≈ tick 24, window 2 ≈
tick 41) while presence stays fresh — proving events enrich the canonical folded presence
list and flip across windows.

## Hard boundary (mirrors the product)

Events are PRESENTATION ONLY. They never change ticket formulas, prize costs, ledger
values, challenge criteria, inventory value, cabinet availability, or any cross-room
economy. No event reward, no ticket multiplier. The module adds **no fold authority** and
touches no private/fold state — economy-neutral by construction.

## Feed transitions — DEFERRED (mirrors the product)

Product Phase 2e defers live `room_event_started/ended` feed announcements to keep its
DO/shim feed parity. v0.5 keeps the mirror faithful and also defers them: the `weather`
channel keys (`room_event_started` / `room_event_ended`) are **reserved** in
`ROOM_EVENT_SIDEBAND` but **not emitted**. The deterministic `event_id` (stable within a
window, flips across) is the documented transition basis a future v0.6 could fold and emit
(the simulator's logical tick makes a window-boundary scenario straightforward).

## Tests

`tests/hiveworld/phase2-room-events.test.mjs` — 25 tests mirroring the product Phase 2e
unit suite, adapted to ticks: schedule determinism, current/next/status, room desync,
window bounds, unknown-room safety, featured resolution, public-safety, presence-list
enrichment (incl. closed/maintenance preserved + no leak), catalog annotation (incl.
economy-neutrality + fail-safe), feed-transition basis, sideband mapping, the display
helpers, and the `roomEventWindowShowcase` scenario (window flip + recommendations +
public-safety + deterministic fingerprint).

## Validation

- `node --test tests/hiveworld/*.test.mjs` → **167/167** (142 baseline + 25 new).
- UI smoke (`tests/hiveworld/run-ui-smoke.sh`) → PASS, zero console/page errors.
- Guardrail grep clean (only the pre-existing `privacyBoundaryLoop` "forbidden cashout"
  rejection comment + the non-goal "no ticket multiplier" comment).
- Product Worker/DO untouched; `game/*` untouched; no product↔sim bridge.

## Files

- `arcade/hiveworld-sim/core/phase1/room-events.mjs` (new)
- `arcade/hiveworld-sim/core/phase1/room-recommend.mjs` (event helpers)
- `arcade/hiveworld-sim/core/phase1/sideband-map.mjs` (room-event sideband map)
- `arcade/hiveworld-sim/scenarios/phase1.mjs` (`roomEventWindowShowcase`)
- `tests/hiveworld/phase2-room-events.test.mjs` (new)
- `docs/HIVEWORLD_V0_5_ROOM_EVENTS.md` (this doc)

## Parity status

Simulator parity is now **CLOSED through product Phase 2e**. The next product sprint
(operator direction) is **Phase 2f — Live Room Feed Event Announcements**, which would
close the one deferred item; its simulator mirror would become HiveWorld v0.6.
