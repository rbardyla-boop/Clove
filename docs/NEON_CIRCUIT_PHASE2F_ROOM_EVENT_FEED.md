# Neon Circuit — Phase 2f: Live Room Feed Event Announcements

## Summary

Phase 2e added deterministic scheduled room events but **deferred** live feed
transitions (the DO has a 30s alarm; the dev shim has no timer, so alarm-driven
announcements would diverge). Phase 2f closes that gap by emitting public-safe feed
announcements when scheduled room events start, end, or change their featured cabinet —
with **no** rewards, multipliers, economy, accounts, or HiveWorld bridge.

The product loop is now:

```
room schedule changes (deterministic from roomId + time)
→ a room access point (request or alarm) checks the per-room transition tracker
→ if the active event id / featured cabinet changed since last announced:
     append a public-safe entry to the room feed + broadcast it (once)
→ clients see live room_event_started / room_event_ended / featured_cabinet_changed
→ featured cabinet state stays display-only; no ticket/prize/challenge values change
```

### How the 2e parity problem is solved

Transition detection is a **pure function of (previous tracker state + roomId + now)**
with **id-based dedup**. The SAME engine runs on the ArcadeRoom DO, the dev shim, and
the unit tests, driven at deterministic access points. Whoever checks first announces a
transition once; later checks at the same clock see the dedup ids and emit nothing. So
the DO and shim converge on identical feed content regardless of who triggers the check —
the divergence that forced the 2e deferral is gone. The DO alarm is an *additional,
idempotent* trigger that keeps events live in production even with no client requests.

## Branch / base

- Branch: `feat/neon-circuit-phase2f-room-event-feed`
- Base: `feat/neon-circuit-phase2e-room-events` @ `fe74c2e` (stacked, local-only)

## Scope

- Public-safe feed announcements for scheduled room-event transitions: `room_event_started`,
  `room_event_ended`, `featured_cabinet_changed`.
- Deterministic, deduplicated, room-scoped, bounded by the existing feed limit.
- Exact DO ↔ dev-shim parity; a dev-gated test-only clock makes transitions testable.

## Non-goals (explicit)

- no event rewards
- no ticket multipliers
- no event payout changes
- no dynamic user-created events
- no event ops console
- no global accounts
- no cross-room inventory
- no cross-room economy
- no real money
- no crypto
- no blockchain
- no token/NFT mechanics
- no cash-out
- no staking / yield / resale
- no gambling / wagering
- no HiveWorld bridge (product Worker/DO stays separate from `arcade/hiveworld-sim/`)
- no AR / geospatial layer
- no land ownership
- no production account inventory

## Event transition model

Pure, in `workers/arcade/src/room-events.mjs`:

- `initialEventTracker()` → `{ active, started_announced_id, ended_announced_id,
  featured_announced_event_id, checked_at }` (public-safe; persisted per partition).
- `deriveRoomEventTransitions(prevState, roomId, now)` → `{ transitions, state, changed }`.
- `roomEventFeedEntryForTransition(transition)` → existing feed envelope (`type`,
  `actorPublicId: 'system'`, `summary`, `source`).
- `publicRoomEventSummary(type, snapshot)` → non-monetary copy.
- `ROOM_EVENT_FEED_TYPES = { started: 'room_event_started', ended: 'room_event_ended',
  featured_changed: 'featured_cabinet_changed' }`.

Transition rules (deterministic):

```
no active → active            => started
active → same active          => none
active → different active     => ended(old) + started(new) [+ featured_changed if the
                                  featured cabinet differs and is non-null]
```

Each transition object: `transition_type`, `event_id`, `room_id`, `display_name`,
`featured_cabinet_id`, `featured_cabinet_type`, `occurred_at`, `public_safe_summary`.
No private/economy fields.

## Dedupe model

The tracker stores the last event ids a `started` / `ended` was announced for, plus the
event id a `featured_changed` was announced for, plus a compact public snapshot of the
active event (so an `ended` can be announced for the *previous* event after it rotates
out). Re-checking at the same clock returns no transitions (`changed: false`). A room
**reset** installs a fresh tracker (`newPartition`), so an old event never replays — the
current event is re-announced once after reset, then deduped.

## Feed integration

Transitions are appended to the **existing** public event feed (`events.mjs` `appendEvent`,
bounded by `MAX_EVENTS = 50`) and broadcast as the existing `arcade_event` message. They
are `public_safe: true`, `actor_public_id: 'system'`, and carry no player id, balance,
ledger, inventory, challenge progress, token, connection id, or DO id. Copy examples:
`Pulse Hour started.` / `Pulse Hour ended.` / `Signal Sprint Relay is now featuring Signal Sprint.`

## Trigger points

`ArcadeRoom.checkAndAnnounceRoomEvents(roomId)` (append→persist→broadcast, deduped) runs at:

- `room_events_request`, `room_state_request`, `cabinet_catalog_request` (request-driven —
  the shared, parity-safe path);
- the ~30s room `alarm` (production liveness; idempotent);
- the test-only `__test_set_event_now`.

It is **not** run on join: the joiner already gets the feed snapshot, and its post-join
`room_events_request` (Phase 2e) drives the check — so the joiner never double-renders.

## Registry vs room DO boundary

Unchanged from the preferred architecture: the **RoomRegistry** still derives current/next
event for the public room list (metadata aggregator); the **room DO** derives and announces
its own room-scoped feed transitions (the feed lives in room gameplay state). The registry
was not modified in Phase 2f.

## Client feed rendering

No new panel. The Challenge Board feed renderer is type-agnostic (renders `e.summary`), so
the three new types render automatically; `challenge-board.css` adds dot colours for them.
The floor exposes `__neon.setEventNow` / `__neon.feed` for browser validation only.

## Dev-shim parity

`dev-shim.mjs` mirrors the DO exactly: per-room `eventTracker` + `eventClockOverride`,
`checkAndAnnounceRoomEvents(roomId)`, and the same trigger points + `__test_set_event_now`.
Same pure engine ⇒ byte-identical feed semantics.

## Test-time clock handling

A TEST-ONLY absolute event-clock override:

- DO: `__test_set_event_now { nowMs }`, accepted **only** when `env.ENVIRONMENT ===
  "development"` (true under `wrangler dev` via `wrangler.toml [vars]`; a production deploy
  sets it otherwise → override OFF). In-memory, not persisted.
- Shim: always honoured (the shim is a test-only process), per-room.
- It shifts **only** room-event schedule derivation (transition detection / current-next /
  catalog featured) — never ticket/round authority, balances, or any economy. It is not
  admin-token based and is unavailable to normal production clients.

## Tests

- `tests/arcade/room-event-transitions.test.mjs` — 14 pure tests: transition engine
  (started/ended/featured), dedup / no-spam, reset re-announce-once, multi-room
  independence, public-safety + non-monetary copy, and feed integration (correct types,
  bounded, system-authored, public-safe).
- `tests/arcade/room-event-feed.spec.mjs` + `run-room-event-feed.sh` — browser validation
  on shim + real DO: pin window 3 → started; repeated requests add nothing; pin window 4 →
  exactly ended + started + featured_changed; re-request + late joiner add nothing; no
  money copy; zero console errors.
- Regression: frame-contract, two-client, room-admin, room-health, room-presence-ux,
  room-events all unchanged and green.

## Manual validation

- `node --test tests/arcade/*.test.mjs` → 297/297.
- `bash tests/arcade/run-room-event-feed.sh` (+ the six existing browser scripts) → PASS.
- `wrangler deploy --dry-run` bundle clean.
- Real Worker/DO (`wrangler dev`, Node 22): feed transitions emit once + dedup via the
  dev-gated clock.

## Known limitations

- Static schedule only — no user-created event calendar.
- Transition detection is heartbeat/request driven, not a global cron; in production the
  ~30s alarm bounds announcement latency to a single tick.
- No reward / multiplier / payout effects (by design).
- HiveWorld v0.6 mirror deferred (`docs/HIVEWORLD_V0_6_ROOM_EVENT_FEED_TODO.md`).

## Next phase options

- Phase 2g: `room_event_upcoming` pre-roll announcements (low risk; same dedup model).
- Operator-tunable schedules (still static catalog, no user-created events).
- HiveWorld v0.6 mirror of this phase.
