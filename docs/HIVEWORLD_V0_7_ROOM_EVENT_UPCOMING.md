# HiveWorld v0.7 — Room Event Upcoming / Pre-Roll Mirror

Status: **IMPLEMENTED** on `feat/hiveworld-v0-7-room-event-upcoming` (from v0.6
`feat/hiveworld-v0-6-room-event-feed` @ `ded8c70`). Mirrors product **Phase 2g — Room
Event Upcoming / Pre-Roll Announcements** (`feat/neon-circuit-phase2g-room-event-upcoming`
@ `5f5015e`, `docs/NEON_CIRCUIT_PHASE2G_ROOM_EVENT_UPCOMING.md`) into the CRDT simulator.
This implements the product-branch `docs/HIVEWORLD_V0_7_ROOM_EVENT_UPCOMING_TODO.md`.

The simulator is a **mirror, not a bridge** — it never imports or talks to the product
Worker/DO, and the product never imports the simulator. Local-only; no push/PR/merge.

## Relationship to Product Phase 2g

Phase 2g added a pre-roll: a one-time `room_event_upcoming` feed announcement when the next
scheduled event is within `PREROLL_LEAD_MS` (2 min) of starting, plus a live countdown.
v0.7 mirrors this on the simulator's TICK clock.

## What changed from v0.6

v0.6 emitted `room_event_started` / `room_event_ended` / `featured_cabinet_changed` via the
`room_event_transition_check` fabric event + reducer. v0.7 adds the pre-roll:

- `core/phase1/room-events.mjs`:
  - `PREROLL_LEAD_TICKS = 2` (the tick analog of the product's 2-min lead — 1/10 of the
    20-tick window).
  - `ROOM_EVENT_FEED_TYPES.upcoming = 'room_event_upcoming'`;
    `ROOM_EVENT_FEED_SIDEBAND.room_event_upcoming = 'weather'`.
  - `initialRoomEventTracker` gains `upcoming_announced_id` (dedup; `?? null` migrates
    pre-0.7 trackers); `applyRoomEventTransitions` carries it.
  - `deriveRoomEventTransitions` gains a pre-roll branch: if the next event exists, starts in
    the future, is within `PREROLL_LEAD_TICKS`, and has not been pre-roll-announced, it pushes
    an `upcoming` transition (`"{next} is up next."`).
  - `publicRoomEventSummary` handles `upcoming`.
  - `roomEventPublic` + `roomEventListPayload` gain `event_upcoming` (alongside the existing
    `event_starts_in_ticks`).
- `core/phase1/sideband-map.mjs`: `ROOM_EVENT_SIDEBAND.room_event_upcoming = 'weather'`.

**No reducer change.** The v0.6 `room_event_transition_check` reducer already appends every
derived transition through `roomEventFeedEntryForTransition`, so `room_event_upcoming`
propagates to the per-room feed automatically (proven by the fold tests).

## Pre-roll dedupe

`upcoming_announced_id` tracks the next-event id pre-rolled; re-deriving in the same pre-roll
window emits nothing. The pre-roll for event E and the later `started` for E are separate
dedup ids, so a window gets one pre-roll then one start. A room reset installs a fresh tracker
(`upcoming_announced_id: null`), so the current next event can pre-roll once more, then deduped.

## Feed entry

`room_event_upcoming` rides the per-room bounded feed (`appendFeed`, `MAX_EVENTS = 50`),
`actor_public_id: 'system'`, `source: 'room_events'`, `public_safe: true`. Copy:
`Signal Sprint Relay is up next.`

## Scenario

`roomEventPrerollShowcase` — main-floor observes window 3 (Pulse Hour started), a pre-roll tick
before window 4 (Signal Sprint Relay "is up next."), the same pre-roll window again (no
duplicate), then the window-4 flip (ended + started + featured). The folded feed holds the five
public-safe announcements **in order** — started, upcoming, ended, started, featured —
proving the pre-roll precedes the start and dedupes. `canonicalFingerprint` stable across reruns;
`finalConverged = true`. It appears in the testbed scenario runner (the `sel-p1-scenario`
dropdown auto-populates from `PHASE1_SCENARIOS`). The v0.6 `roomEventFeedTransitionShowcase`
is unchanged (so its exact 4-entry assertion still holds).

## Replay / convergence

Unchanged from v0.6: the Sideband CRDT Log folds canonically, so the same set of observation
events converges to the same feed + tracker regardless of arrival order. Proven by a
reordered-publish pre-roll test asserting an identical `canonicalFingerprint` + `finalConverged`.

## Privacy model

The pre-roll transition + feed entry carry no actor/agent ids, balances, ledger, inventory,
challenge progress, tokens, connection ids, or signatures. The only actor identity is `system`.
Asserted with `PRIVATE_FIELD_RE` + `feedIsPublicSafe`.

## Tests

`tests/hiveworld/phase2-room-event-upcoming.test.mjs` — 15 tests: pure pre-roll detection +
dedup, first-observation started+upcoming, window-flip after pre-roll, dedup-advances-per-event,
`apply` carrying `upcoming_announced_id`, `event_upcoming` payload flag, feed-entry shaping +
sideband, fold propagation (no reducer change), out-of-order convergence, and the
`roomEventPrerollShowcase` scenario. Total simulator suite: **202** (187 baseline + 15 new).
(The v0.6 feed-types assertion was relaxed to per-key checks so the added `upcoming` type does
not break it.)

## Known limitations

- Static schedule only; the pre-roll lead is a fixed `PREROLL_LEAD_TICKS` (2 ticks).
- Pre-roll checks are explicit simulation observations (`room_event_transition_check`), not a
  wall-clock cron — deliberate (the simulator advances by logical tick).
- No reward / multiplier / payout effects (display-only).
- Product and simulator remain separate (mirror, not a bridge).

## Non-goals

- no product Worker/DO bridge
- no HiveWorld V1
- no event rewards / ticket multipliers / payout changes
- no real money / crypto / blockchain / token / NFT
- no cash-out / staking / yield / resale / gambling / wagering
- no AR / geospatial layer / land ownership
- no global accounts / cross-room inventory / cross-room economy

## Next mirror / product step

Simulator parity is now **CLOSED through product Phase 2g**. The next product sprint (operator
direction) would be **Phase 2h — Operator-Tunable Event Presentation** (display-only:
configurable pre-roll lead, live countdown refresh, event card polish); its simulator mirror
would become HiveWorld v0.8. Not started here.
