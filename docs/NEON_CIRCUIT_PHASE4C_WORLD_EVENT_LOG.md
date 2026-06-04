<!-- Follow-up: Phase 4D adds the Hive Scheduler that reads this event log to produce
non-authoritative city pressure — see docs/NEON_CIRCUIT_PHASE4D_HIVE_SCHEDULER.md. -->

# Neon Circuit — Phase 4C: Append-Only World Event Log + In-Place Arcade Interior Portal

**Status:** implemented, local-only (branch `feat/neon-circuit-phase4c-world-event-log`, off Phase 4B `2fa0be4`).
**Goal:** add the first durable-feeling living-world primitive — a **server-authored append-only city
event log** — and replace the full-page portal navigation with a **server-confirmed in-place
arcade-interior overlay**. This is the bridge from "city movement demo" to "living-world substrate."

Builds on [NEON_CIRCUIT_PHASE4B_CITY_AUTHORITY_POLISH.md](NEON_CIRCUIT_PHASE4B_CITY_AUTHORITY_POLISH.md).
Core rule unchanged: **players send intent, the server owns truth.**

## 1. What changed from Phase 4B

| Area | Phase 4B | Phase 4C |
|---|---|---|
| World facts | none | **server-authored append-only event log** (joins, leaves, portal req/accept/reject, interior open/close) |
| Portal transition | full-page `location.assign('/arcade/')` | **in-place same-origin iframe interior** (close → back to city) |
| Event history | none | recent log sent on (re)join + live `city_event` broadcasts + `city_events_request` |
| Protocol | `SCHEMA_VERSION` 1 | `SCHEMA_VERSION` **2** (additive; no-dt 4A/4B inputs still valid) |

Additive and backward-compatible. The pure player-movement core is unchanged; the DO/shim gain the log.

## 2. Authority model

The event log records **only server-accepted facts**. Every event's id, sequence, timestamp, type, and
payload are assigned by the server (`appendCityEvent`); the client can request and display, **never
author**. There is no inbound handler that accepts a client event — a forged `city_event` gets the
standard `unknown_type` `city_error`. Portal eligibility and interior-open are server-gated exactly as
before; the in-place interior can only open after a server `city_portal_ok` (which requires the player's
**canonical** position to be inside the zone).

## 3. Append-only world event log (`arcade/city/city-events.mjs`, pure)

`createEventLog()` → `{ events: [], seq: 0 }`. `appendCityEvent(log, { type, cityId, actorPublicId,
payload, now })` assigns a monotonic `seq`, derives `event_id = ` `cityId:seq:type`, and returns a frozen
public-safe event; the log is FIFO-bounded to `MAX_CITY_EVENTS = 50` while `seq` keeps climbing (ids never
collide across pruning). `recentEvents` / `cityEventsPayload` expose the recent tail with `schema_version`.

### Event schema
```js
{
  schema_version: 2,
  event_id: "downtown-01:42:city_portal_enter_accepted",
  seq: 42,
  city_id: "downtown-01",
  type: "city_portal_enter_accepted",
  server_time: 1234567890,
  actor_public_id: "city-player-abc123",   // the existing public/session-safe city id, or null
  payload: { portalId: "arcade", target: "/arcade/" },  // allowlist-filtered
  public_safe: true
}
```

### Event types (4C)
`city_player_joined`, `city_player_left`, `city_portal_enter_requested`, `city_portal_enter_accepted`,
`city_portal_enter_rejected`, `city_arcade_interior_opened`, `city_arcade_interior_closed`.
**No per-move logging** (no frame spam).

### Public-safety / privacy
`sanitizeEventPayload` keeps only an allowlist of public-safe scalars (`portalId`, `target`, `reason`) and
drops everything else, so no balance/ledger/inventory/admin/raw-connection data can ride an event. The only
identifier is the public city player id already exposed in snapshots.

### Retention / bounding
Bounded to the most recent 50 events (FIFO), pruned deterministically on every append; `seq` is monotonic
so ordering and id-uniqueness survive pruning. The log lives in DO state (persisted under storage key
`cityEvents`, separate from player `cityState`); it survives reconnect while the DO lives. Tests prove
boundedness and monotonicity.

## 4. CityRoom integration ([city-room.ts](../workers/arcade/src/city-room.ts) + dev shim)

The DO appends server-authored events at join / last-socket leave / alarm eviction / portal
request-accept-reject / interior open-close, broadcasts each as a live `city_event`, sends the recent log
in a `city_events` message on (re)join, and answers `city_events_request` (rate-limited like snapshots).
Route-bound `cityId`, playerId validation, and the disconnect "emit leave once" guarantee are preserved.
The Node city dev shim mirrors all of this over the same pure module.

### Protocol additions (additive; SCHEMA_VERSION → 2)
- Client → server: `city_events_request`, `city_portal_close_request`, and `city_portal_enter_request`
  (alias of the existing `city_portal_enter`, so 4B clients keep working).
- Server → client: `city_events` (recent list), `city_event` (single live event). `city_portal_ok` /
  `city_error` unchanged.
- Backward compatibility: a 4A/4B client that only sends `city_join` / `city_input` (with or without `dt`)
  / `city_snapshot_request` / `city_leave` works unchanged; unknown messages still fail safe.

## 5. In-place arcade interior portal (same-origin iframe — Option 1, the safest)

On a server `city_portal_ok`, the client opens an in-page overlay hosting a **same-origin iframe to
`/arcade/`** — the existing arcade floor runs unchanged and isolated (no postMessage bridge, no cross-frame
authority mixing, no balances/inventory passed). A "Return to city" button (and `Esc`) sends
`city_portal_close_request` and closes the overlay; the city WS stays alive behind it (the player remains in
the zone). Same-origin navigation guard retained (`target.startsWith('/')`); iframe `onerror` reveals a
fallback link to `/arcade/`. Reduced-motion + mobile-safe. In `?test=1` the iframe uses a tiny `srcdoc`
placeholder (the real `/arcade/` needs the arcade WS) so the smoke is deterministic.

## 6. City event UI

A small bounded "CITY OS · WORLD LOG" panel (`#cityEventLog`, ~14 rows) renders public-safe summary text
from `city_events`/`city_event` (deduped by `event_id`, `textContent` only — no injection). Mobile-safe,
kept clear of the minimap (top-right) and joystick (bottom-right). No money copy, no heavy animation.

## 7. Size-budget result (GTA-80)

`node scripts/check-city-build-size.mjs` → **0.660 MB uncompressed / 0.172 MB gzipped** — within GTA-80
(≤80 MB) and the GTA-34 (≤34 MB gz) stretch. Procedural additions only; no assets, no new dependencies.

## 8. Validation commands

```bash
node --test tests/arcade/*.test.mjs            # pure event-log + all existing (437 green)
node tests/arcade/check-production-config.mjs
node scripts/check-city-build-size.mjs
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-event-log.sh   # NEW 4C smoke
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-authority.sh   # 4B regression
PW_REQUIRE_BASE=/path/to/playwright bash tests/arcade/run-city-block.sh       # 4A regression
bash tests/arcade/run-two-client.sh ; bash tests/arcade/run-frame-contract.sh # arcade regression
cd workers/arcade && npx wrangler deploy --dry-run --outdir dist              # Node 22; no deploy
```

## 9. Known limitations

- The event log lives in DO state (bounded, persisted); it is **per-block** and not a cross-room or
  long-term archive — that is intentional for 4C (the 4D scheduler reads the recent log, not history).
- Interior is a same-origin iframe of the existing `/arcade/`; a deeper embedded-module integration is out
  of scope (Option 2 deferred). Headless smoke uses a `srcdoc` placeholder; real use loads `/arcade/`.
- `actor_public_id` is the existing public city player id; there are no accounts/identity beyond that.

## 10. Deferred roadmap — 4D–4G (forward seams, documented only; NOT built here)

The append-only log is the seam these later phases read from. None are implemented in 4C.

- **4D — Hive Scheduler:** reads the append-only world/city events; schedules **non-authoritative** city
  pressure; proposes display-only or server-reviewed events; never owns frame-by-frame physics; never
  bypasses CityRoom authority. Future messages: `city_scheduler_tick`, `city_pressure_suggested`,
  `city_event_scheduled`.
- **4E — Host Rank (non-cash):** reputation for healthy hosting/support, derived from server-observed and/or
  scheduler-reviewed events — never client claims. No payout, staking, real-money reward, or marketplace.
- **4F — Block Stewardship + constrained editor:** players may earn **limited, manifest-validated,
  reversible** customization rights — *stewardship, not ownership*; the public city cannot be griefed.
- **4G — Instanced, non-destructive block battles:** instanced; no destructive edits to the live public
  city; no gambling/wagering; no paid entry; cosmetic/non-cash outcomes only if later approved.

## 11. Non-goals (4C)

No 4D–4G systems; no map expansion, missions, police, combat, weapons, vehicles, NPCs/AI; no
crypto/cash-out/gambling/marketplace/paid-hosting/token/NFT/transferable goods; no accounts/OAuth; no
cross-room economy; no persistent inventory; no free-form UGC editor; no public land ownership; no HiveWorld
bridge; no deploy/credentials/push; no history rewrite. No change to arcade ticket formulas, prize costs,
challenge rewards, event schedules, or economy behavior. No-dt city inputs remain valid.
