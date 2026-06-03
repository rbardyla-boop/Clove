# HiveWorld v0.7 — Room Event Upcoming / Pre-Roll Mirror (TODO, deferred)

> **Status:** NOT implemented in the Phase 2g product workflow. This doc specifies how a
> later, separate HiveWorld workflow should mirror Neon Circuit **Phase 2g — Room Event
> Upcoming / Pre-Roll Announcements** into the CRDT-log simulator. Do **not** implement this
> on the product branch, and do **not** bridge HiveWorld into the product Worker/DO.

## Context

- Product source of truth: `feat/neon-circuit-phase2g-room-event-upcoming` (stacked on 2f
  `144ba01`), `docs/NEON_CIRCUIT_PHASE2G_ROOM_EVENT_UPCOMING.md`.
- Simulator parity branch to fork from: `feat/hiveworld-v0-6-room-event-feed` @ `ded8c70`
  (closes parity through Phase 2f). Suggested branch: `feat/hiveworld-v0-7-room-event-upcoming`.
- Simulator lives only under `arcade/hiveworld-sim/` + `tests/hiveworld/`. Mirror, not a bridge.

## What to mirror

### 1. Pre-roll detection (tick clock)

Port the Phase 2g additions from `workers/arcade/src/room-events.mjs` into the sim's
`core/phase1/room-events.mjs`, on the TICK clock:

- `PREROLL_LEAD_TICKS` (the tick analog of `PREROLL_LEAD_MS = 2 min`; pick a value < the
  20-tick window, e.g. 2–4 ticks).
- `ROOM_EVENT_FEED_TYPES.upcoming = 'room_event_upcoming'`.
- `initialRoomEventTracker` gains `upcoming_announced_id`.
- `deriveRoomEventTransitions` gains the pre-roll branch (next event within the lead, not
  yet announced → push `upcoming`; advance `upcoming_announced_id`).
- `publicRoomEventSummary` handles `upcoming` ("… is up next.").
- `roomEventPublic` / `roomEventListPayload` gain `event_upcoming`.

### 2. Reducer + feed

The existing `room_event_transition_check` reducer already appends every derived transition,
so `room_event_upcoming` propagates with **no reducer change** (verify). The `applyRoomEventTransitions`
helper must carry `upcoming_announced_id`.

### 3. Sideband

Add `room_event_upcoming → weather` to `ROOM_EVENT_FEED_SIDEBAND` / `ROOM_EVENT_SIDEBAND`
(pre-roll is a room-wide ambient observation, like started/ended).

### 4. Scenario

Extend `roomEventFeedTransitionShowcase` (or add `roomEventPrerollShowcase`): observe a
window, then a pre-roll tick before the next window, then the flip — assert exactly one
`room_event_upcoming` then the `ended/started/featured` flip, deduped, converged.

### 5. Privacy + convergence

Reuse `feedIsPublicSafe` / `PRIVATE_FIELD_RE`; assert the pre-roll feed entry is
system-authored + public-safe, and that out-of-order observation still converges.

## Guardrails

- Keep the product and simulator branches separate; never import HiveWorld into the product
  Worker/DO, and never touch `arcade/hiveworld-sim/` from a product branch.
- No economy changes, no rewards, no multipliers — mirror the display-only boundary.
- Keep the existing simulator tests green (187 at v0.6); add the v0.7 pre-roll tests.

## Acceptance (when the v0.7 workflow runs)

- Sim pre-roll detection parity-equivalent to product `deriveRoomEventTransitions`.
- `room_event_upcoming` emitted once per next-event window, deduped, bounded, public-safe.
- Deterministic pre-roll scenario converges; fingerprint stable.
- All sim tests + UI smoke green; product + game untouched; local-only commit.
