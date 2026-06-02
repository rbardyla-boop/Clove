# HiveWorld v0.6 — Room Event Feed Transitions Mirror (TODO, deferred)

> **Status:** NOT implemented in the Phase 2f product workflow. This doc specifies how a
> later, separate HiveWorld workflow should mirror Neon Circuit **Phase 2f — Live Room
> Feed Event Announcements** into the CRDT-log simulator. Do **not** implement this on the
> product branch, and do **not** bridge HiveWorld into the product Worker/DO.

## Context

- Product source of truth: `feat/neon-circuit-phase2f-room-event-feed` (stacked on 2e
  `fe74c2e`), `docs/NEON_CIRCUIT_PHASE2F_ROOM_EVENT_FEED.md`.
- Simulator parity branch to fork from: `feat/hiveworld-v0-5-room-events` @ `2a61a2f`
  (closes parity through Phase 2e). v0.5 already reserved the transition sideband keys.
- Simulator lives only under `arcade/hiveworld-sim/` + `tests/hiveworld/`. Mirror, not a
  bridge. Suggested branch: `feat/hiveworld-v0-6-room-event-feed` (local-only).

## What to mirror

### 1. Pure transition engine (tick clock)

Port `deriveRoomEventTransitions` / `initialEventTracker` / `roomEventFeedEntryForTransition`
/ `publicRoomEventSummary` / `ROOM_EVENT_FEED_TYPES` from
`workers/arcade/src/room-events.mjs` into the sim's `arcade/hiveworld-sim/core/phase1/room-events.mjs`,
using the simulator's logical TICK instead of ms. The dedup tracker (`active` snapshot +
`started_announced_id` / `ended_announced_id` / `featured_announced_event_id`) is identical.

### 2. room_event_started / room_event_ended / featured_cabinet_changed

v0.5 reserved these on the `weather` (room-wide) / `discovery` (featured) sidebands in
`ROOM_EVENT_SIDEBAND` but did NOT emit them. v0.6 should EMIT them: fold a per-room
transition tracker into CRDT-log state (or compute it as a deterministic projection over
the heartbeat/observe tick) and append public-safe feed entries via the sim feed.

### 3. Transition dedupe

Mirror the id-based dedup: re-deriving at the same tick adds nothing. A room reset installs
a fresh tracker (re-announce current once, then dedup). Prove no feed spam across repeated
observations and across a reset/generation bump.

### 4. Feed boundedness + privacy

Entries ride the sim feed (bounded) and are public-safe (system-authored, no actor ids /
balances / ledger / inventory / tokens). Reuse the sim's `feedIsPublicSafe` / `PRIVATE_FIELD_RE`.

### 5. Weather/discovery sideband transitions

Mirror `sidebandForRoomEvent` so emitted transitions map: room-wide start/end → `weather`,
featured change → `discovery`. Tighten the v0.5 "reserved, not emitted" note to "emitted".

### 6. Deterministic event-window scenario

Extend `roomEventWindowShowcase` (or add `roomEventFeedShowcase`): advance the logical tick
across a window boundary and assert exactly one `room_event_started`, then
`room_event_ended` + `room_event_started` + `featured_cabinet_changed`, with no duplicates
on repeated observation — the tick-clock analog of the product browser test.

### 7. Privacy checks

Assert transition payloads + feed entries leak no private/fold state.

## Guardrails

- Keep the product branch and simulator branch separate; never import HiveWorld into the
  product Worker/DO, and never touch `arcade/hiveworld-sim/` from a product branch.
- No economy changes, no rewards, no multipliers — mirror the display-only boundary.
- Keep the existing simulator tests green (167 at v0.5); add the v0.6 transition/feed tests.

## Acceptance (when the v0.6 workflow runs)

- Sim transition engine parity-equivalent to product `deriveRoomEventTransitions`.
- start/end/featured feed entries emitted, deduped, bounded, public-safe.
- Deterministic window scenario proves no spam across a boundary + reset.
- All sim tests + UI smoke green; product + game untouched; local-only commit.
