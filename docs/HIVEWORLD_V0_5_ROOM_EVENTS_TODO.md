# HiveWorld v0.5 — Room Events Mirror (TODO, deferred)

> **Status:** NOT implemented in the Phase 2e product workflow. This doc specifies how a
> later, separate HiveWorld workflow should mirror Neon Circuit **Phase 2e — Room Events
> / Scheduled Cabinet Rotations** into the local CRDT-log simulator. Do **not** implement
> this on the product branch, and do **not** bridge HiveWorld into the product Worker/DO.

## Context

- Product source of truth: `feat/neon-circuit-phase2e-room-events` (stacked on 2d
  `9ed77df`), `docs/NEON_CIRCUIT_PHASE2E_ROOM_EVENTS.md`.
- Simulator parity branch to fork from: `feat/hiveworld-v0-4-presence-ux` @ `6ec22fc`
  (closes parity through Phase 2d).
- Simulator lives only under `arcade/hiveworld-sim/` + `tests/hiveworld/`. It **mirrors,
  does not replace**, Phase-1b authority. Zero-dep `.mjs`, deterministic harness.
- Suggested branch: `feat/hiveworld-v0-5-room-events` (local-only; no push/PR/merge).

## What to mirror

### 1. Room event schedules (pure, deterministic)

Port the deterministic schedule model from `workers/arcade/src/room-events.mjs` into a
sim-local module (e.g. `arcade/hiveworld-sim/room-events.mjs`):

- `EVENT_WINDOW_MS` window buckets; `slot = (windowIndex + phase) mod k`.
- Same `EVENT_SCHEDULES` shape (3 rooms, per-room `phase`, `featured_cabinet_id`).
- `getCurrentRoomEvent` / `getNextRoomEvent` / `getRoomEventSchedule` /
  `deriveEventStatus`, all `now`-injectable.
- Keep it PURE — no fold authority, no private state. Events are a function of room id
  + logical time only.

### 2. Featured cabinet sideband mapping

Mirror `featured_cabinet_id → featured_cabinet_type` resolution against the sim's
cabinet catalog, with the same fail-safe (unknown/not-playable → null, event still
shows). This is a **sideband annotation** in the sim's room-list projection — it must
not feed back into any reducer or economy fold.

### 3. Room event feed events (deferred in product → keep deferred here)

Product Phase 2e **defers** live `room_event_started/ended` feed transitions to preserve
DO/shim parity. The simulator MAY model the transition deterministically (it has a
logical tick and no parity constraint), but to stay a faithful mirror, **default to
deferred**. If implemented as a v0.5 stretch:

- Fold a `last_announced_event_id` per room generation into CRDT-log state.
- Emit one `room_event_started` log entry when the deterministic `event_id` changes.
- Add a deterministic event-window scenario that advances logical time across a window
  boundary and asserts exactly one announcement (no spam) + public-safety.

### 4. Catalog annotations

Mirror `annotateCatalogForRoom`: the sim's cabinet-catalog projection gains display-only
`is_featured` / `featured_reason` / `featured_event_id`. Assert it does **not** alter any
ticket/economy fold, cabinet availability, or reward.

### 5. Event recommendation behaviour

Mirror the Phase 2e additions to `room-recommend` (sim copy): `roomEventBadge`,
`roomNextEventLabel`, `roomEventWarmupHint`, `formatEventCountdown`, reading the
sim-attached `current_event`. Add a `roomRecommendationShowcase`-style scenario that
exercises event-aware copy.

### 6. Deterministic event-window scenarios

Add scenarios that pin a fake `now`/tick to specific windows and assert:
- current/next selection + status,
- room desync by phase,
- window-flip changes `event_id`,
- public-safe projection (no private fold state leaks).

### 7. Privacy checks

Reuse the sim's privacy assertions: event projections carry no actor ids, balances,
ledgers, inventory, or tokens — only display fields.

## Guardrails

- Keep the product branch and the simulator branch separate; never import HiveWorld into
  the product Worker/DO, and never touch `arcade/hiveworld-sim/` from a product branch.
- No economy changes, no rewards, no multipliers — mirror the display-only boundary.
- Target test count: extend the v0.4 sim suite (142 tests) with the room-event schedule,
  catalog-annotation, recommendation, and window scenarios; keep all existing green.

## Acceptance (when the v0.5 workflow runs)

- Sim room-event schedule deterministic + parity-equivalent to product `room-events.mjs`.
- Catalog annotation + recommendation copy mirrored, economy-neutral.
- Feed transition either deferred (documented) or modelled with a window scenario.
- All sim tests + UI smoke green; product + game untouched; local-only commit.
