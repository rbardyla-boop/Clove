# Neon Circuit — Phase 5D: Push-on-Change District Presence

Phase 5C made the district's per-block **population + health** live, but **pull-based**: the
client polled `city_blocks_request` on a ~12 s timer to refresh it. Phase 5D removes that poll —
the server **pushes a bounded, public-safe presence delta** to a block's connected clients only
when a public per-block summary actually changes, so the district panel updates live without
polling. The 5C goal ("Push-on-change presence updates") is now delivered.

This is **delivery only**. No new economy, accounts, ownership, gameplay, DO, or migration. The
authority model is unchanged.

## Goal

```text
CityRoom presence changes  →  CityRegistry receives/derives public-safe district presence
→  connected clients receive push-on-change district presence deltas
→  lobby/district UI updates without polling  →  fall back to request/refresh if the stream is quiet
```

## What changed from Phase 5C

- **New pure module `arcade/city/city-district-presence.mjs`** — deterministic delta helpers,
  reused unchanged by the DO, the dev-shim, the tests, and the browser scene:
  - `districtPresenceSnapshot(presence, now)` → `{ cityId → { population, health, population_is_estimated } }`,
    derived via the **same** Phase 5C `cityPresenceEntry` policy (no duplicated freshness thresholds).
  - `diffDistrictPresence(prev, next)` → the **bounded** (≤ block count), sorted list of changed blocks.
  - `buildPresenceDelta(changed, now)` → the public-safe wire payload, **re-projected through a field
    allowlist** (`city_id`, `population`, `health`, `population_is_estimated`) — the public-safety choke point.
  - `deriveDistrictPresenceDelta(prevSnapshot, presence, now)` → `{ snapshot, delta }`, `delta = null`
    when nothing changed (coalesced). DO and shim share this, so their push behavior is identical.
  - `mergePresenceDelta(manifest, delta)` → a **new** manifest with the changed blocks' live fields
    updated (client side); ignores unknown `city_id`s; never mutates input.
- **`CityRoom` (`workers/arcade/src/city-room.ts`)** — after each existing `reportPresence()` refresh
  (join / leave / 30 s alarm keepalive), calls `broadcastDistrictPresence()`, which diffs against the
  last-pushed snapshot and broadcasts `t: "city_district_presence"` **only on change**. No new route,
  no new socket, no new state persisted, no migration. The registry stays the DO-to-DO coordinator.
- **Dev-shim (`workers/arcade/city-dev-shim.mjs`)** — single-process parity: one global presence view
  drives one delta fan-out to every socket on join / leave / sweep (each client merges by `city_id`).
- **Client (`arcade/city/city-net.js`, `city-scene.js`, `city.css`)** — routes the new message,
  applies the delta with `mergePresenceDelta`, shows a subtle `◦ live` / `refresh` indicator, and
  **replaces the 12 s poll with a slow degraded-only safety net** (re-request once only if no
  push/manifest arrived within 45 s).

## Authority / isolation model (unchanged)

Per-block `CityRoom` DOs stay isolated; the `CityRegistry` stays the single coordinator reached
**only DO-to-DO**, holding only per-block counts + freshness timestamps. The delta is built from the
**same** `presenceCache` the `city_blocks` manifest already is — it can never expose anything the
manifest does not. Clients **cannot author** presence: they send no presence message; the server
derives every count. The reporting path remains **fail-open** (a registry error keeps the last cache).

## Message schema

The existing `t: "city_blocks"` district manifest **is** the initial snapshot (sent on join and on
the manual `city_blocks_request` fallback). Phase 5D adds one additive message:

```js
{ t: "city_district_presence",
  schema_version: 1,
  district_id: "neon-district-01",
  kind: "district_presence_delta",
  changed_at: <ms>,
  blocks: [ { city_id, population, health, population_is_estimated } ],  // changed blocks only
  public_safe: true }
```

No `current_city_id` in the delta — the client keeps its own from the last full manifest, so one
delta fans out identically to every socket. No `SCHEMA_VERSION` bump: the message is additive and
old clients ignore an unknown `t`.

## Push cadence / coalescing

- **Same-block** join/leave → delta is **immediate** (piggybacks the existing join/leave path).
- **Cross-block** population/health change → surfaces on the next **30 s alarm tick** (the existing
  heartbeat keepalive cadence — `STALE_SWEEP_MS`, deliberately unchanged to avoid raising DO load).
- A delta is emitted **only on an actual change** (deep-equal on the 3 live fields); identical → no
  message. Delta size is bounded to ≤ `CITY_IDS.length` (3) blocks.

## Reconnect / fallback

Reconnect → fresh `city_join` → a full `city_blocks` re-baselines the client; the server resets its
push baseline whenever it sends a manifest, so the first post-join delta is correct. If connected but
no push/manifest arrives within 45 s, the client shows a degraded `refresh` indicator and re-requests
once (the manual `requestBlocks()` path still exists). Old clients without the handler keep working
via the full-manifest path.

## Public-safety model

Delta fields are the same public-safe subset 5C exposes — a COUNT + health + an estimated flag,
never player ids, connection/socket ids, balances, ledger, inventory, account ids, admin tokens, or
DO internals. `buildPresenceDelta` re-projects every block through the allowlist, so a stray field
can never reach the wire even if a caller passes one (asserted by unit + browser tests). No
economy/ownership/marketplace copy. No telemetry/tracking.

## Validation commands

```bash
node --test tests/arcade/*.test.mjs                  # full unit suite incl. city-district-presence (12 new)
node tests/arcade/check-production-config.mjs         # PASS (config unchanged; no new migration)
node scripts/check-city-build-size.mjs                # PASS (GTA-80 budget)
bash tests/arcade/run-city-district-presence.sh       # NEW: push-without-polling, two clients
bash tests/arcade/run-city-presence.sh                # 5C presence still green
bash tests/arcade/run-city-district.sh                # district discovery/routing still green
( cd workers/arcade && wrangler deploy --dry-run --outdir dist )
```

## Known limitations

- **Cross-block deltas are bounded by the 30 s alarm tick, not instant.** A block learns other
  blocks' changes only when it refreshes presence on its keepalive; same-block changes are immediate.
  Instant cross-DO fan-out would require registry→CityRoom reverse calls — a much larger change,
  deliberately out of scope for this slice.
- **Dev-shim is more immediate than the DO for cross-block** (single process, no 30 s tick) — it is a
  parity twin, not a timing model. The real DO cadence is validated on staging (deploy in the loop).
- No new DO, migration, route, or persisted state — nothing to roll back beyond the additive message.

## Explicit non-goals

No production deploy, credentials, or `wrangler login`. No real money / crypto / token / NFT /
staking / yield / resale / gambling / marketplace / ownership / rent / income / payout / economy. No
accounts / OAuth / profiles. No third-party telemetry/tracking. No new DO, migration, or client-facing
registry socket. No cross-block inventory/economy. No formula / reward / schedule / Host-Rank /
Stewardship / Block-Trial changes. No HiveWorld bridge, no `arcade/hiveworld-sim/`, no `game/*`. No map
expansion, combat, vehicles, or NPCs.

## Next phases

- **District activity feed — delivered in Phase 5E**
  ([NEON_CIRCUIT_PHASE5E_DISTRICT_ACTIVITY_FEED.md](NEON_CIRCUIT_PHASE5E_DISTRICT_ACTIVITY_FEED.md)):
  turns these presence deltas + route results + arrivals into a readable, public-safe, client-derived
  district activity feed with cross-block transition polish (no server/protocol change).
- Optional instant cross-block fan-out (registry→CityRoom notify) if the 30 s cross-block cadence
  proves too coarse in practice — same public-safe, no-economy doctrine.
