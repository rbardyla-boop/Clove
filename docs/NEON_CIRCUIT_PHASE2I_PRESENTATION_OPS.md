# Neon Circuit — Phase 2i: Live-Ops Per-Room Presentation Overrides

## Summary

Phase 2h made the event **presentation** operator-tunable via server env (one config for the
whole deploy). Phase 2i adds a **live-ops surface**: an admin can set, preview, and clear a
**per-room** presentation override at runtime — no redeploy — and every surface reflects that
room's *effective* config (env base ⊕ override). Strictly **display-only**: an override changes
only how events are presented (pre-roll lead, countdown refresh, show flags); it never touches
tickets, prizes, challenges, identity, authority, the deterministic event schedule, or economy.

What it adds:

1. **Per-room override store** — the `RoomRegistry` DO owns `presentationOverrides` (one
   sanitized partial per room), persisted alongside `statusOverrides`.
2. **Four both-gated admin ops** — `set_presentation`, `clear_presentation`,
   `preview_presentation`, `presentation_diagnostics` (same dev-flag **AND** token gate as
   every other admin op).
3. **Effective config everywhere** — the room list, each room's `room_events`, and the floor
   pre-roll/countdown all resolve `effective = mergeEventPresentation(envBase, override)`.
4. **Live-ops lobby panel** — per-room inputs (pre-roll / countdown / show flags) with
   Preview / Apply / Reset, an override/base marker per room, and a registry-wide diagnostics
   readout.

## Branch / base

- Branch: `feat/neon-circuit-phase2i-presentation-ops`
- Base: `feat/neon-circuit-phase2h-event-presentation` @ `6367bea` (stacked, local-only)

## Scope

- A pure override model (sanitize + merge) layered on the Phase 2h config (room-events.mjs).
- Registry-owned per-room override store + four admin ops + a `/registry/presentation` read.
- ArcadeRoom resolves its room's effective config (DO→registry, fail-open to env base).
- Client admin methods + a lobby live-ops panel; the floor reflects overrides automatically.

## Non-goals (explicit)

- no rewards, no ticket multipliers, no payout/economy changes
- no prize cost / challenge reward changes; no authority/identity changes
- no schedule changes — an override is presentation-only and never shifts start/end/featured
- no per-user / per-request tuning (admin-set, room-scoped operator config only)
- no real money / crypto / blockchain / token / NFT
- no cash-out / staking / yield / resale / gambling / wagering
- no HiveWorld bridge (product stays separate from `arcade/hiveworld-sim/`)
- no AR / geospatial / land ownership; no global accounts / cross-room economy

## Override model

Pure, in `workers/arcade/src/room-events.mjs` (layered on the Phase 2h config):

- `PRESENTATION_KEYS` — the four tunable fields an override may carry
  (`preroll_lead_ms`, `countdown_refresh_ms`, `show_next_event`, `show_featured_chip`).
- `sanitizeEventPresentationOverride(override)` — returns the partial **safe to store**: only
  the keys the admin actually set, each validated + clamped. **Invalid values are dropped**
  (not coerced to a default), so a bad key falls through to the base rather than persisting a
  default. Empty/garbage → `{}` (i.e. "no override").
- `mergeEventPresentation(base, override)` — `effective = resolve({ ...base, ...sanitized })`;
  missing override keys fall through to `base`; the result is re-validated, clamped, and frozen.
- `attachRoomEvents(list, now, config)` — `config` may now be a **resolver** `(roomId) => config`
  (per-room effective) or a plain config object (backward-compatible with Phase 2e/2h callers).
  The top-level `presentation` stays the base; each room entry carries its own `presentation`.

## Server integration

- **RoomRegistry DO** (`room-registry.ts`): owns `presentationOverrides` (persisted);
  `effectivePresentation(roomId) = mergeEventPresentation(eventPresentationFromEnv(env), override)`.
  - `/registry/list` passes a per-room resolver to `attachRoomEvents`.
  - `/registry/presentation?room=` returns the room's public effective config + `has_override`.
  - `/registry/admin` handles the four new ops (after the same `checkAdmin` both-gate):
    `presentation_diagnostics` (registry-wide: per-room `{override, effective}` + base),
    `preview_presentation` (sanitize + return effective, **no persist**), `set_presentation`
    (sanitize; empty → delete; else store; persist), `clear_presentation` (delete; persist).
- **ArcadeRoom DO** (`arcade-room.ts`): `effectivePresentation(roomId)` fetches the room's
  effective config from the registry (DO→DO) and **fails open** to `eventPresentationFromEnv`.
  It threads that config into `room_events` payloads and `checkAndAnnounceRoomEvents`
  (pre-roll feed), and forwards the `override` field on admin ops. Schedule derivation stays
  pure + deterministic, so a registry blip only reverts the *display dressing* to default.
- **dev shim** (`dev-shim.mjs`): mirrors the override store + four ops + per-room resolver so
  the browser suite exercises the identical semantics under Node 18.

## Client (floor + lobby)

- **Room client** (`neon-circuit-room-client.js`): `adminSetPresentation` /
  `adminClearPresentation` / `adminPreviewPresentation` / `adminPresentationDiagnostics` —
  forward intent only; the server gates + sanitizes.
- **Lobby** (`arcade-lobby.js` + `.css`): a per-room **Live ops · presentation** sub-panel in
  the admin row — pre-roll / countdown number inputs (pre-filled from the room's effective
  config, placeholder = base), show-next / show-featured checkboxes, and Preview / Apply /
  Reset buttons. An `override` / `base` marker per room, a registry-wide diagnostics readout,
  and a preview/apply/clear result line. Read-only ops (preview, diagnostics) don't trigger a
  room-list refresh, so operator-typed inputs aren't wiped.
- **Floor** (`neon-circuit-floor.js`): unchanged — it already consumes `room_events`'
  `presentation` block, which now carries the room's **effective** config, so the pre-roll
  lead, countdown refresh, and show flags reflect the override automatically.

## Tests

- `tests/arcade/presentation-overrides.test.mjs` — 14 pure tests: sanitize (only set+valid
  keys, drop invalid, clamp), merge (fall-through, non-default base, frozen/clamped), the
  resolver-capable `attachRoomEvents` (per-room effective vs base top-level; backward-compat),
  per-room isolation, schedule-invariance (override never shifts transitions), public-safety,
  and the new admin op set.
- `tests/arcade/admin.test.mjs` — the exact admin-op list updated to the 7 ops (3 + 4 new).
- `tests/arcade/presentation-overrides.spec.mjs` + `run-presentation-overrides.sh` — browser
  (shim + real DO) admin flow: wrong-token rejected; apply → that room's floor reflects the
  wider lead (fires `upcoming` earlier) + the show flag; a different room is unaffected at the
  same clock; preview doesn't persist; diagnostics report per-room override/effective; the
  lobby panel renders per-room controls + the override marker; clear reverts to base.
- Regression: frame-contract, two-client, multi-room, room-admin, room-health,
  room-presence-ux, room-events, room-event-feed, room-event-upcoming, event-presentation —
  all unchanged and green.

## Manual validation

- `node --test tests/arcade/*.test.mjs` → 331/331.
- `bash tests/arcade/run-presentation-overrides.sh` (+ the existing browser scripts) → PASS.
- `esbuild` bundle of `src/index.ts` clean; real Worker/DO (`wrangler dev`, Node 22) →
  per-room override applied/cleared; floor + diagnostics reflect the effective config.

## Known limitations

- Overrides are admin-set + room-scoped — still operator config, never per-user/per-request.
- The ArcadeRoom resolves the registry effective config per event-bearing request (DO→DO);
  on a registry blip it fails open to the env base (display reverts to default; schedule is
  unaffected).
- The lobby room list is a registry snapshot at real time; the live `m:ss` floor countdown is
  a client timer anchored to the latest `room_events` (no per-second server round-trips).
- No reward / multiplier / payout effects (by design).
- HiveWorld v0.9 mirror deferred (`docs/HIVEWORLD_V0_9_PRESENTATION_OPS_TODO.md`).

## Next phase options

- An audit trail / history for presentation overrides (who/when, still display-only).
- Scheduled override windows (operator-set, time-boxed) layered on the same store.
- HiveWorld v0.9 mirror of this phase.
