# Neon Circuit — Phase 2h: Operator-Tunable Event Presentation

## Summary

Phase 2e–2g built the event system (rotations → live start/end/featured feed → pre-roll).
Phase 2h makes its **presentation** operator-tunable and adds a live countdown — strictly
**display-only**. An operator can tune, via server env (validated + clamped), how events are
presented; nothing touches tickets, prizes, challenges, identity, authority, or economy.

What it adds:

1. **Configurable pre-roll lead** — `EVENT_PREROLL_LEAD_MS` changes how far ahead the next
   event is announced as `upcoming` + flagged `event_upcoming`.
2. **Live countdown refresh** — the floor pre-roll shows a live `m:ss` countdown that ticks
   down (refresh interval = `EVENT_COUNTDOWN_REFRESH_MS`).
3. **Event card polish** — gentle pulse on the live pre-roll countdown (reduced-motion safe);
   `show_next_event` / `show_featured_chip` flags toggle the next-event preview + featured chip.
4. **Operator/static config validation** — every value is validated + clamped to safe bounds,
   falling back to defaults on any bad value (fail-safe).

## Branch / base

- Branch: `feat/neon-circuit-phase2h-event-presentation`
- Base: `feat/neon-circuit-phase2g-room-event-upcoming` @ `5f5015e` (stacked, local-only)

## Scope

- A validated, env-driven, display-only presentation config (room-events.mjs).
- The config threaded into the pre-roll logic + surfaced on the room list / `room_events`.
- Floor live `m:ss` countdown + flag-gated previews; lobby flag-gating + polish.

## Non-goals (explicit)

- no rewards, no ticket multipliers, no payout/economy changes
- no prize cost / challenge reward changes; no authority/identity changes
- no dynamic user-created events; no per-user/per-request tuning (operator/server config only)
- no real money / crypto / blockchain / token / NFT
- no cash-out / staking / yield / resale / gambling / wagering
- no HiveWorld bridge (product stays separate from `arcade/hiveworld-sim/`)
- no AR / geospatial / land ownership; no global accounts / cross-room economy

## Config model

Pure, in `workers/arcade/src/room-events.mjs`:

| key | env | default | bounds |
|-----|-----|---------|--------|
| `preroll_lead_ms` | `EVENT_PREROLL_LEAD_MS` | 120000 (2 min) | 10s … window−1s |
| `countdown_refresh_ms` | `EVENT_COUNTDOWN_REFRESH_MS` | 1000 | 250ms … 60s |
| `show_next_event` | `EVENT_SHOW_NEXT` | true | bool |
| `show_featured_chip` | `EVENT_SHOW_FEATURED` | true | bool |

- `resolveEventPresentation(overrides)` — pure, validates + clamps numeric values, coerces
  booleans, returns a **frozen** config; any bad/missing value falls back to the default.
- `eventPresentationFromEnv(env)` — reads the `EVENT_*` keys (same validation).
- `publicPresentation(config)` — the public-safe block surfaced to clients (display hints).

Defaults exactly reproduce Phase 2g behaviour, so the function-signature additions
(`config = DEFAULT_EVENT_PRESENTATION`) are fully backward-compatible.

## Server integration

- `deriveRoomEventTransitions(prev, roomId, now, config)` — the pre-roll branch uses
  `config.preroll_lead_ms`.
- `roomEventPublic` / `roomEventListPayload` / `attachRoomEvents(…, config)` — `event_upcoming`
  uses the configured lead; the payloads carry a public `presentation` block.
- **ArcadeRoom DO**, **RoomRegistry DO**, and the **dev shim** each resolve the config once
  from env (`eventPresentationFromEnv`) and thread it — so the room list + `room_events` every
  client sees carry the same operator config. Same operator surface as `ADMIN_ENABLED` (env;
  a production deploy sets it via wrangler vars; absent → defaults).

## Client (floor + lobby)

- **Floor** (`neon-circuit-floor.js`): stores `presentation` from `room_events`, anchors a
  client-clock `prerollDeadline`, and runs a live timer (`setInterval(countdown_refresh_ms)`)
  that re-renders `⏳ Up next in {m:ss} · {next}`. Honors `show_next_event` (next line) +
  `show_featured_chip` (featured cabinet tile). Exposes `__neon.eventPresentation()` /
  `__neon.eventCountdownMs()` for validation.
- **Lobby** (`arcade-lobby.js` + `room-recommend.mjs`): `formatPrerollCountdown` (`m:ss`);
  honors `show_next_event` / `show_featured_chip`; gentle pre-roll pulse (reduced-motion safe).

## Tests

- `tests/arcade/event-presentation.test.mjs` — 9 pure tests: defaults, validation/clamping,
  boolean coercion, frozen config, env parsing, the config-threaded pre-roll (wider lead fires
  earlier), `event_upcoming` honoring the lead, the public `presentation` block, and the
  `m:ss` formatter.
- `tests/arcade/event-presentation.spec.mjs` + `run-event-presentation.sh` — browser (shim +
  real DO) with a CUSTOM `EVENT_COUNTDOWN_REFRESH_MS`: the operator config flows
  env → config → `room_events` → client, and the floor live countdown ticks DOWN over real time.
- Regression: frame-contract, two-client, room-admin, room-health, room-presence-ux,
  room-events, room-event-feed, room-event-upcoming all unchanged and green.

## Manual validation

- `node --test tests/arcade/*.test.mjs` → 317/317.
- `bash tests/arcade/run-event-presentation.sh` (+ the eight existing browser scripts) → PASS.
- `wrangler deploy --dry-run` bundle clean.
- Real Worker/DO (`wrangler dev`, Node 22): presentation config surfaced; live countdown ticks.

## Known limitations

- Operator config is server/env-driven and static per deploy — no live ops console / hot reload.
- The floor live countdown is a client timer anchored to the server snapshot; it ticks locally
  and refreshes whenever `room_events` arrives (no per-second server round-trips).
- The lobby room list is served by the registry at real time (the lobby pre-roll is a snapshot,
  not a per-second ticker).
- No reward / multiplier / payout effects (by design).
- HiveWorld v0.8 mirror deferred (`docs/HIVEWORLD_V0_8_EVENT_PRESENTATION_TODO.md`).

## Next phase options

- A live ops surface for presentation config (still server-gated, display-only).
- Per-room presentation overrides (still operator config, not per-user).
- HiveWorld v0.8 mirror of this phase.
