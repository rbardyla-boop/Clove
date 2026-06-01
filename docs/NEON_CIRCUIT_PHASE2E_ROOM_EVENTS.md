# Neon Circuit — Phase 2e: Room Events / Scheduled Cabinet Rotations

## Summary

Phase 2d turned the room-presence infrastructure into smart lobby behaviour. Phase 2e
makes the rooms feel **alive** by adding server-authoritative, deterministic,
**display-only** scheduled room events:

- Each room rotates through a static list of events (Pulse Hour, Signal Sprint Relay,
  Training Focus, Late Night Circuit, …).
- An event highlights a cabinet (`featured_cabinet`) or a room-wide activity
  (`training_focus`, `late_night_theme`).
- The lobby shows an event badge + countdown + next-event preview per room; the floor
  shows a current-event banner and highlights the featured cabinet tile; the cabinet
  catalog is annotated with a display-only `is_featured` marker.

Events are a **pure function of `roomId` + server time** (a fixed wall-clock window
bucket). The RoomRegistry DO, each ArcadeRoom DO, the dev shim, and the unit tests all
compute the same current/next event for the same `now`, so the events a client sees are
exactly the events the server derives. `now` is always injected, so tests use a fake
clock and never depend on the real time of day.

**Hard economy boundary:** events never touch a ticket formula, a prize cost, a ledger
value, a challenge criterion, inventory value, a cabinet's availability/status, or any
cross-room economy. There is no event reward and no ticket multiplier. The annotation
layer only *adds* display fields — it is economy-neutral by construction.

## Branch / base

- Branch: `feat/neon-circuit-phase2e-room-events`
- Base: `feat/neon-circuit-phase2d-presence-ux` @ `9ed77df` (stacked, local-only)

## Scope

- Server-authoritative, deterministic, room-scoped scheduled events.
- Display-only effects: lobby cards, floor banner, featured cabinet tile + catalog
  annotation, room activity labels, event-aware recommendation/warmup copy.
- A read-only `room_events_request → room_events` protocol message (current + next +
  one-rotation schedule).
- Exact parity between the production Worker/DO path and the local dev shim (both call
  the same pure `room-events.mjs`).

## Non-goals (explicit)

- no dynamic user-created events
- no ticket multipliers
- no event rewards
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

## Room event model

`workers/arcade/src/room-events.mjs` (PURE, runtime-agnostic). Each public-safe event:

| field | meaning |
|-------|---------|
| `event_id` | `roomId:schedule_key:windowIndex` — stable within a window, flips across windows |
| `room_id` | owning room |
| `event_type` | `featured_cabinet` \| `room_warmup` \| `quiet_room_prompt` \| `training_focus` \| `late_night_theme` |
| `display_name`, `description` | display copy |
| `status` | `upcoming` \| `active` \| `ended` \| `disabled` |
| `featured_cabinet_id`, `featured_cabinet_type` | the highlighted cabinet (or null for room-wide events) |
| `starts_at`, `ends_at`, `duration_ms` | window bounds (absolute ms) |
| `schedule_key`, `sort_order` | schedule identity |
| `visibility` (`public`), `public_safe` (`true`) | safety flags |
| `ruleset_version` | `arcade-events/1` |

## Static schedule

`EVENT_SCHEDULES` (one ordered rotation per room, desynced by a per-room `phase`):

```
main-floor (phase 0):
  Pulse Hour          → featured pulse-tap-01
  Signal Sprint Relay → featured signal-sprint-01
  Neon Grid Rush      → featured neon-grid-01

neon-training (phase 1):
  Training Focus → room-wide (training_focus, no cabinet)
  Pulse Practice → featured pulse-tap-01 (training_focus)
  Grid Basics    → featured neon-grid-01 (training_focus)

late-night-circuit (phase 2):
  Late Night Circuit → room-wide (late_night_theme)
  Signal Afterdark   → featured signal-sprint-01 (late_night_theme)
  Neon Grid Rush     → featured neon-grid-01 (featured_cabinet)
```

## Current/next event derivation

Window length: `EVENT_WINDOW_MS = 20 min`. For a room with `k` events and `phase`:

```
windowIndex = floor(now / EVENT_WINDOW_MS)
slot        = (windowIndex + phase) mod k
current     = events[slot],  window [windowIndex*W, (windowIndex+1)*W)
next        = events[((windowIndex+1) + phase) mod k], starting at the next window
```

Deterministic, no random drift, no background cron. Helpers: `getCurrentRoomEvent`,
`getNextRoomEvent`, `getRoomEventSchedule`, `deriveEventStatus`, `roomEventPublic`,
`roomEventListPayload`.

## Registry integration

`RoomRegistry` (`/registry/list`, `/registry/health`) wraps the Phase 2c presence
payload with `attachRoomEvents(list, now)`, adding per room: `current_event`,
`next_event`, `event_ends_in_ms`, `event_starts_in_ms`, `featured_cabinet_id`, plus a
top-level `event_ruleset_version`. Closed/maintenance rooms still show their event but
remain join-disabled; stale/offline health is computed independently (unchanged).

## Catalog annotations

`annotateCatalogForRoom(catalog, roomId, now)` marks **only** the current event's
featured cabinet with display-only `is_featured` / `featured_reason` /
`featured_event_id`; all other cabinets get `is_featured: false`. It never changes
`status`, `ticket_enabled`, `ruleset_version`, or any formula. Fail-safe: an
unknown/not-playable featured cabinet (or a room-wide event) marks nothing.

## Lobby UI

`arcade-lobby.js` + `arcade-lobby.css`: each room card shows an event badge (`Featured
now` / `Training focus` / `Room event`) with the event name and a "`Nm` left"
countdown, a `Next event · …` preview line, and an event-aware warmup hint for quiet
joinable rooms. Recommendation chips carry an event sub-label. Copy avoids any
money/bonus framing.

## Floor UI

`neon-circuit-floor.js` + `index.html` + `neon-circuit.css`: a current-event banner
under the wall tag (kind label + name + countdown + next preview), and a `★ FEATURED`
highlight on the event-featured cabinet tile. Both are display-only; occupancy, play,
and awards are unchanged.

## Protocol messages

- Client → server: `room_events_request` (read-only; the client cannot set events,
  status, or featured cabinet, and cannot trigger rewards).
- Server → client: `room_events` `{ room_id, event_ruleset_version, current_event,
  next_event, schedule }`.
- Existing `room_list` and `cabinet_catalog` are enriched additively (no breaking
  change for Phase 2d clients).

## Dev-shim parity

`dev-shim.mjs` imports the same `room-events.mjs` and applies `attachRoomEvents` to its
`room_list` (both the normal and `__test_set_heartbeat_age` paths),
`annotateCatalogForRoom` to its `cabinet_catalog`, and answers `room_events_request`
identically — so dev-shim and real Worker/DO are byte-equivalent for the tested flows.

## Tests

- `tests/arcade/room-events.test.mjs` — 25 unit tests: schedule determinism, current/
  next/status, room desync, public-safety, registry enrichment, catalog annotation
  (incl. economy-neutrality + fail-safe), feed-transition basis (deferred), and the
  client display helpers.
- `tests/arcade/room-events.spec.mjs` + `run-room-events.sh` — browser validation:
  floor banner, featured tile, featured cabinet plays + awards normally, lobby event
  badges + next preview, event survives a room switch, no money copy, no console
  errors.
- Regression: frame-contract, two-client, room-admin, room-health, room-presence-ux
  all unchanged and green.

## Manual validation

- `node --test tests/arcade/*.test.mjs` → 283/283.
- `bash tests/arcade/run-room-events.sh` (+ the four existing browser scripts) → PASS.
- `wrangler deploy --dry-run` bundle clean.
- Real Worker/DO (`wrangler dev`, Node 22): room list + catalog carry events; featured
  cabinet awards unchanged.

## Known limitations

- Static schedule only — no user-created events, no ops console for editing, not a
  calendar system.
- No global-account personalization.
- No event rewards or ticket multipliers.
- **Live room-feed event start/end announcements are deferred** (see below).
- HiveWorld mirror deferred to v0.5 (`docs/HIVEWORLD_V0_5_ROOM_EVENTS_TODO.md`).

### Why feed transitions are deferred

The spec's preferred feed approach stores `last_announced_event_id` per room and
announces once when a heartbeat/alarm notices a new active event. The ArcadeRoom DO has
a ~30s alarm; the dev shim has **no** timer. Announcing on a tick would make the DO and
shim feeds diverge (the DO would announce idle window flips the shim never sees),
breaking the strict transport parity the browser tests rely on. Per §5's explicit
allowance, Phase 2e carries event state in the room list + `room_events` read + catalog
annotation, and defers live feed transitions. The deterministic `event_id` (stable
within a window, flips across windows) is the transition basis a future phase can build
on once the shim grows an equivalent tick or the feed is sourced from the registry.

## Next phase options

- Phase 2f: live room-feed event start/end announcements (registry-sourced, parity-safe).
- Operator-tunable schedules (still static catalog, no user-created events).
- HiveWorld v0.5 mirror of this phase.
