# HiveWorld v0.6 — Room Event Feed Mirror

Status: **IMPLEMENTED** on `feat/hiveworld-v0-6-room-event-feed` (from v0.5
`feat/hiveworld-v0-5-room-events` @ `2a61a2f`). Mirrors product **Phase 2f — Live Room
Feed Event Announcements** (`feat/neon-circuit-phase2f-room-event-feed` @ `144ba01`,
`docs/NEON_CIRCUIT_PHASE2F_ROOM_EVENT_FEED.md`) into the CRDT simulator. This implements
the product-branch `docs/HIVEWORLD_V0_6_ROOM_EVENT_FEED_TODO.md`.

The simulator is a **mirror, not a bridge** — it never imports or talks to the product
Worker/DO, and the product never imports the simulator. Local-only; no push/PR/merge.

## Relationship to Product Phase 2f

Phase 2f added live feed announcements when scheduled room events start, end, or change
their featured cabinet. In the product, transition detection runs on request/alarm access
points with id-based dedup. The simulator is a **deterministic CRDT-log fold**, so v0.6
expresses the same semantics as an explicit fabric event (`room_event_transition_check`)
folded by a reducer — and convergence comes for free from the canonical fold.

## What changed from v0.5

v0.5 added the deterministic schedule + reserved the transition sideband keys but did
**not** emit transitions. v0.6 emits them:

- **Transition engine** (`core/phase1/room-events.mjs`): tick-clocked port of the product
  Phase 2f engine — `ROOM_EVENT_FEED_TYPES`, `initialRoomEventTracker(generation)`,
  `deriveRoomEventTransitions(prev, roomId, observeTick)`, `applyRoomEventTransitions`,
  `roomEventFeedEntryForTransition`, `publicRoomEventSummary`. Each transition carries
  `occurred_tick` + `sideband`.
- **Fabric event** `room_event_transition_check` (sideband `weather`) registered in
  `core/events.mjs` (EVENT_SPECS) + `core/reducers/index.mjs` (HANDLERS), with a builder
  `room.observeRoomEvents(observeTick, atTick)`.
- **Reducer** `room_event_transition_check` in `core/reducers/arcade.mjs`: validates the
  room id, room authority, and `observe_tick`; applies a monotonic no-op for stale/backward
  observations; derives transitions from the per-room tracker; appends public-safe feed
  entries; updates the tracker.
- **Per-room tracker** lives in each room's arcade partition (`createArcade(generation)`),
  so it participates in `stateFingerprint` and is reset-safe (`room_reset` installs a fresh
  partition carrying the bumped generation).
- **Sideband map** (`core/phase1/sideband-map.mjs`): `room_event_transition_check → weather`;
  emitted `room_event_started/ended → weather`, `featured_cabinet_changed → discovery`.

## Transition tracker

Public-safe, per room (in `arcade.rooms[roomId].eventTracker`):

```
active                          // snapshot { event_id, display_name, featured_cabinet_id, featured_cabinet_type } | null
started_announced_id            // dedup: last event id a 'started' was announced for
ended_announced_id              // dedup: last event id an 'ended' was announced for
featured_announced_event_id     // dedup: event id a 'featured_changed' was announced for
last_transition_checked_tick    // monotonic guard (forward-only observation)
generation                      // reset/generation safety
```

`active.event_id` is the sprint's `last_active_event_id`; `active.featured_cabinet_id` is
`last_featured_cabinet_id`. No actor ids, balances, ledger, inventory, or connection ids.

## Transition detection

```
no active → active            => started
active → same active          => none
active → different active      => ended(old) + started(new) [+ featured_changed if featured differs]
```

Each transition: `transition_type`, `event_id`, `room_id`, `display_name`,
`featured_cabinet_id`, `featured_cabinet_type`, `occurred_tick`, `public_safe_summary`,
`sideband`. Deterministic + idempotent (re-deriving at the same tick yields none).

## Feed entries

Appended to the per-room bounded public feed (`feed.mjs` `appendFeed`, `MAX_EVENTS = 50`):
`event_type` ∈ {`room_event_started`, `room_event_ended`, `featured_cabinet_changed`},
`actor_public_id: 'system'`, `source: 'room_events'`, `public_safe: true`. Copy:
`Pulse Hour started.` / `Pulse Hour ended.` / `Signal Sprint Relay is now featuring Signal Sprint.`

## Sideband mapping

| event / feed type | sideband |
|-------------------|----------|
| `room_event_transition_check` (trigger) | `weather` |
| `room_event_started` | `weather` |
| `room_event_ended` | `weather` |
| `featured_cabinet_changed` | `discovery` |

## Deterministic scenarios

- `roomEventFeedTransitionShowcase` — main-floor observes window 3 (→ started), the same
  window (→ none), window 4 (→ ended + started + featured_changed), a stale backward tick
  (→ monotonic no-op), and window 4 again (→ none). Folded feed = exactly four public-safe
  announcements; `canonicalFingerprint` stable across reruns; `finalConverged = true`.
- `multiRoomEventFeedIsolation` — three rooms each observe their own window; each room's
  transitions land only in that room's feed (room-scoped).

Both appear in the testbed scenario runner (the `sel-p1-scenario` dropdown auto-populates
from `PHASE1_SCENARIOS`).

## Replay / convergence

The Sideband CRDT Log folds canonically (by logical tick, then event id), so the same set
of `room_event_transition_check` events converges to the same feed + tracker regardless of
arrival/publish order. The monotonic guard (`observe_tick < last_transition_checked_tick →
no-op`) makes stale/out-of-order observations harmless. Proven by a reordered-publish test
asserting an identical `canonicalFingerprint` + `finalConverged`.

## Privacy model

Transition payloads + feed entries carry no actor/agent ids, balances, ledger, inventory,
challenge progress, admin tokens, connection ids, or signatures. The only actor identity is
`system`. Asserted with `PRIVATE_FIELD_RE` + `feedIsPublicSafe`.

## Tests

`tests/hiveworld/phase2-room-event-feed.test.mjs` — 20 tests: pure transitions (A), feed
integration through the fold (B), event-fabric validation + monotonic no-op + out-of-order
convergence + sideband mapping (C), and the two scenarios (D). Total simulator suite:
**187** (167 baseline + 20 new).

## Known limitations

- Static schedule only; no user-created event calendar.
- Transition checks are explicit simulation observations (`room_event_transition_check`),
  not a wall-clock cron — deliberate, since the simulator advances by logical tick.
- No reward / multiplier / payout effects (display-only).
- The testbed surfaces the new scenarios + their feed entries via the existing runner +
  feed panel; a dedicated current/next-event + observe-tick control panel is **deferred**
  (the proof harness validates semantics via tests/scenarios).
- Product and simulator remain separate (mirror, not a bridge).

## Non-goals

- no product Worker/DO bridge
- no HiveWorld V1
- no event rewards
- no ticket multipliers
- no payout changes
- no real money
- no crypto
- no blockchain
- no token/NFT mechanics
- no cash-out
- no staking / yield / resale
- no gambling / wagering
- no AR / geospatial layer
- no land ownership
- no production account inventory

## Next mirror / product step

Simulator parity is now **CLOSED through product Phase 2f**. The next product sprint
(operator direction) would be **Phase 2g** (e.g. `room_event_upcoming` pre-roll
announcements); its simulator mirror would become HiveWorld v0.7. Not started here.
