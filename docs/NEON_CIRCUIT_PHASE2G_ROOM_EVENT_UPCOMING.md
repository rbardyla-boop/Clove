# Neon Circuit — Phase 2g: Room Event Upcoming / Pre-Roll Announcements

## Summary

Phase 2f announced room events when they start, end, or change their featured cabinet.
Phase 2g adds a **pre-roll**: a one-time public-safe `room_event_upcoming` feed
announcement when the next event is within a short lead of starting, plus a live "Up next
in …" countdown on the floor and lobby. It extends the event system **without** changing
authority, tickets, prizes, identity, or economy.

```
next event is within PREROLL_LEAD_MS of starting
→ the room feed gets one room_event_upcoming announcement (deduped per event window)
→ the floor / lobby show "Up next in {countdown} · {next event}"
→ when the window flips, the existing started/ended/featured announcements fire
→ no ticket formula, prize cost, or challenge value changes
```

## Branch / base

- Branch: `feat/neon-circuit-phase2g-room-event-upcoming`
- Base: `feat/neon-circuit-phase2f-room-event-feed` @ `144ba01` (stacked, local-only)

## Scope (narrow, by design)

- `room_event_upcoming` pre-roll feed announcement, deduped once per next-event window.
- Public-safe feed entry (system-authored), bounded by the existing feed limit.
- Lobby + floor "Up next in …" countdown copy.
- `event_upcoming` + `event_starts_in_ms` on the room list + `room_events` payloads.

## Non-goals (explicit)

- no event rewards
- no ticket multipliers
- no ticket/payout/economy changes
- no prize cost or challenge reward changes
- no authority / identity changes
- no dynamic user-created events
- no real money / crypto / blockchain / token / NFT
- no cash-out / staking / yield / resale / gambling / wagering
- no HiveWorld bridge (product stays separate from `arcade/hiveworld-sim/`)
- no AR / geospatial / land ownership
- no global accounts / cross-room inventory / cross-room economy

## Pre-roll model

Pure, in `workers/arcade/src/room-events.mjs`:

- `PREROLL_LEAD_MS = 2 min` — how long before the next event begins it is "upcoming".
- `ROOM_EVENT_FEED_TYPES.upcoming = 'room_event_upcoming'`.
- `initialEventTracker` gains `upcoming_announced_id` (dedup: the next-event id a pre-roll
  was announced for). `?? null` migrates pre-2g persisted trackers.
- `deriveRoomEventTransitions` gains a pre-roll branch: if the next event exists, starts in
  the future, is within `PREROLL_LEAD_MS`, and has not been pre-roll-announced, it pushes an
  `upcoming` transition (summary: `"{next} is up next."`) and advances `upcoming_announced_id`.
- `publicRoomEventSummary` handles `upcoming`.
- `roomEventPublic` (room list) and `roomEventListPayload` (`room_events`) gain
  `event_upcoming` (boolean) alongside the existing `event_starts_in_ms`.

Because the room DO + dev shim already append **every** derived transition through
`roomEventFeedEntryForTransition`, the `upcoming` transition propagates to the feed on both
runtimes with **no server wiring change** — the pure model carries it.

## Dedupe model

`upcoming_announced_id` tracks the next-event id a pre-roll was announced for; re-checking
in the same pre-roll window emits nothing. The pre-roll for event E and the later `started`
for E are separate dedup ids, so a window gets one pre-roll then one start. A room reset
installs a fresh tracker (`upcoming_announced_id: null`), so the current next event can
pre-roll once more, then deduped.

## Feed integration

`room_event_upcoming` rides the existing public feed (`appendEvent`, `MAX_EVENTS = 50`),
`actor_public_id: 'system'`, `public_safe: true` — no player id, balance, ledger, inventory,
challenge progress, token, or connection id. Copy: `Signal Sprint Relay is up next.`

## Trigger points

Unchanged from Phase 2f: `checkAndAnnounceRoomEvents` runs at `room_events_request`,
`room_state_request`, `cabinet_catalog_request`, the ~30s alarm, and the test clock. The
pre-roll fires on whichever access/alarm first observes the room inside the pre-roll lead,
once (deduped). In production the ~30s alarm bounds pre-roll latency to a single tick.

## Client (floor + lobby)

- **Floor** (`neon-circuit-floor.js`): `room_events` carries `event_upcoming` +
  `event_starts_in_ms`; the next-event banner line becomes `⏳ Up next in {countdown} ·
  {next}` (with `data-preroll`) when upcoming, else the plain `Next · {next}`. The countdown
  is the server snapshot (`event_starts_in_ms`), refreshed whenever `room_events` arrives.
- **Lobby** (`arcade-lobby.js` + `room-recommend.mjs` `roomUpcomingPreroll`): when the room
  list's `event_upcoming` is set, the card's next-event line shows the pre-roll countdown
  chip. (In production the registry serves the room list at real time; the lobby chip is
  driven by that.)
- Feed renders `room_event_upcoming` via the existing type-agnostic renderer;
  `challenge-board.css` adds a dot colour. No new UI panel.

## Test-time clock handling

Unchanged from Phase 2f: the dev-gated `__test_set_event_now` (DO: `ENVIRONMENT ===
"development"`; shim: always) advances the room-event schedule so the pre-roll is
deterministically testable. It shifts **only** schedule derivation — never ticket/round
authority or economy.

## Tests

- `tests/arcade/room-event-upcoming.test.mjs` — 11 pure tests: pre-roll detection + dedup,
  first-observation started+upcoming, window-flip after pre-roll, dedup-advances-per-event,
  `event_upcoming` payload flag, feed-entry shaping, summary, the `roomUpcomingPreroll`
  lobby helper, and non-monetary copy.
- `tests/arcade/room-event-upcoming.spec.mjs` + `run-room-event-upcoming.sh` — browser
  validation (shim + real DO): normal window shows no pre-roll; the pre-roll lead flips the
  floor to "Up next in …", sets `event_upcoming`, and adds one `room_event_upcoming` feed
  entry (no duplicate on re-request); no money copy; zero console errors.
- Regression: frame-contract, two-client, room-admin, room-health, room-presence-ux,
  room-events, room-event-feed all unchanged and green.

## Manual validation

- `node --test tests/arcade/*.test.mjs` → 308/308.
- `bash tests/arcade/run-room-event-upcoming.sh` (+ the seven existing browser scripts) → PASS.
- `wrangler deploy --dry-run` bundle clean.
- Real Worker/DO (`wrangler dev`, Node 22): pre-roll announces once + the floor countdown
  renders via the dev-gated clock.

## Known limitations

- Static schedule only; pre-roll lead is a fixed `PREROLL_LEAD_MS` (2 min).
- The floor pre-roll countdown is a server snapshot refreshed on `room_events` (not a
  per-second ticking timer); the ~30s alarm refreshes it in production.
- The lobby pre-roll chip is driven by the registry room list (real time), so it is
  validated via the pure `roomUpcomingPreroll` helper rather than the test clock.
- No reward / multiplier / payout effects (by design).
- HiveWorld v0.7 mirror deferred (`docs/HIVEWORLD_V0_7_ROOM_EVENT_UPCOMING_TODO.md`).

## Next phase options

- Operator-tunable pre-roll lead (still static catalog, no user-created events).
- Per-second live floor countdown (client timer) if desired.
- HiveWorld v0.7 mirror of this phase.
