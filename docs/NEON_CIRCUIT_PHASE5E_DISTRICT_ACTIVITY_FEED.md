# Neon Circuit — Phase 5E: District Activity Feed + Cross-Block Transition Polish

Phase 5D made district presence **push on change**, but the player still had to infer *what* changed
from raw counts. Phase 5E turns those already-public-safe, already-server-authored facts into a
readable **District Activity** feed — "Downtown became active.", "Routing to Skyline confirmed.",
"Arrived in Skyline." — and tightens the route/arrival feedback so cross-block travel reads clearly.

This is a **display-only, client-derived** layer. It adds **no** server message, Durable Object,
migration, route, or protocol field, and **no** economy/ownership/account mechanics.

## Goal

Answer, public-safely: *what happened in the district, where, is it safe, can I route there?* — without
exposing player identities, socket/connection/account ids, balances, inventory, admin data, tokens, or
any private block internals.

## What changed from Phase 5D

- **New pure module `arcade/city/city-district-activity.mjs`** — deterministic helpers, reused by the
  browser scene and the unit tests:
  - `classifyBlockChange(prev, next)` → the single most salient public change type (became active/empty
    > presence stale/restored > population shift), from public fields only.
  - `deriveActivitiesFromDelta(delta, manifest, now)` → activity items from a 5D presence delta,
    comparing each changed block to the **current** manifest (pre-merge); bounded, no mutation.
  - `activityForRouteRequested` / `activityForRouteResult` / `activityForArrival` → route + arrival items.
  - `activityItem(...)` → builds each item through a **field allowlist** (`city_id, type, occurred_at,
    label, severity` + fixed envelope) = the public-safety choke point; fails safe (null) on unknown types.
  - `appendActivity(feed, item, max)` → newest-first, **coalesces against the head** by `(type, city_id)`,
    bounded to 16; never mutates the input.
- **Client (`arcade/city/city-scene.js`, `city.css`)** — derives activity from the messages it already
  receives (presence deltas, route results, welcome/arrival) and the Travel button; renders a bounded
  **DISTRICT ACTIVITY** sub-section inside the district panel (newest-first, ≤8 shown, `textContent`
  only). The district panel is now height-bounded + scrollable so the feed never overflows. Transition
  copy is clearer ("traveling to Harbor…", route blocked, "Arrived in Harbor.").

## Authority / isolation model (unchanged)

The `CityRegistry` stays the DO-to-DO presence coordinator; each `CityRoom` stays its block's authority
and owns all route/presence truth. **The activity feed is client-derived display only** — nothing
canonical reads it back, and there is **no client→server activity append path**. Old clients that ignore
it keep working unchanged.

### Why client-side derivation (the decision)

The client already receives every underlying fact the feed needs — `city_district_presence` deltas
(5D, server-authored + public-safe), `city_route_result` (5A, server-validated), and `city_welcome`
(arrival). A server-side `city_district_activity` message would be **redundant wire traffic + new
attack surface for no authority gain** (activity is inherently a display projection; route/presence
truth is unaffected either way). Client derivation is the smaller, safer path and meets the bar: it is
clearly derived UI, nothing depends on it, tests prove private-field stripping, and the server still
owns the truth.

## Activity event schema

```js
{ schema_version: 1,
  kind: "district_activity",
  activity_id: "neon-district-01:<type>:<city_id>:<occurred_at>",
  district_id: "neon-district-01",
  city_id: "downtown-01",
  type: "block_became_active",
  occurred_at: 1234567890,
  label: "Downtown became active.",   // observational; only a STATIC display name is interpolated
  severity: "good",                     // info | good | warn
  public_safe: true }
```

Allowed types: `block_population_changed`, `block_health_changed`, `block_became_active`,
`block_became_empty`, `block_presence_stale`, `block_presence_restored`, `route_requested`,
`route_confirmed`, `block_arrived`. A blocked route is **not** a feed type — it is surfaced transiently
in the route-status line and leaves the player in their current block.

## Public-safety / privacy policy

Inputs are already public-safe (population, health, city_id, static display_name). `activityItem`
re-projects every item through the allowlist, so a stray/private field can never reach an item even if a
caller passes one (unit + browser tested). Labels come from a fixed table; the only interpolated value is
a block's static display name. No player/socket/connection/account ids, balances, inventory, admin,
tokens, or economy. No third-party telemetry/tracking.

## Dedupe / coalescing

`appendActivity` coalesces consecutive same-`(type, city_id)` items against the head (collapsing rapid
repeats, e.g. a flurry of population shifts) and bounds the buffer to 16; presence deltas are already
coalesced upstream by 5D. The panel shows the newest ≤8.

## Reconnect / backfill behavior

`city_blocks` remains the authoritative snapshot. The activity feed is **local display history**: it
resets on reload and seeds a single arrival item for the current block on (re)connect. It does **not**
invent server-side history. A plain auto-reconnect to the same block logs nothing; a traveled-to arrival
logs "Arrived in X."

## Client fallback

If the push stream pauses, the feed simply stops growing — **no new polling is introduced**. The Phase
5D degraded presence indicator and manual refresh still apply. The feed never blocks rendering.

## Validation commands

```bash
node --test tests/arcade/*.test.mjs                  # full unit suite incl. city-district-activity (14 new)
node tests/arcade/check-production-config.mjs         # PASS (no server/config change)
node scripts/check-city-build-size.mjs                # PASS (GTA-80 budget)
bash tests/arcade/run-city-district-activity.sh       # NEW: activity feed + transition polish (20 checks)
bash tests/arcade/run-city-district-presence.sh       # 5D push still green
bash tests/arcade/run-city-district.sh                # routing/discovery still green
( cd workers/arcade && wrangler deploy --dry-run --outdir dist )
```

## Known limitations

- **Activity is local display history**, not a server log — it resets on reload and is not shared across
  clients (by design; nothing canonical depends on it).
- Cross-block activity inherits the Phase 5D cadence: same-block changes surface immediately, cross-block
  within the existing 30 s alarm tick.
- **Pre-existing right-column panel overlap** (District `top:336` vs Block Trial `top:332`, both Phase
  4G/5A) can let the trial placeholder sit over the Travel button; the button handler is wired and works
  (the smoke fires it directly). Repositioning those panels is out of Phase 5E scope.

## Explicit non-goals

No production/staging deploy, no `wrangler login`/credentials, no Phase 5F. No real money / crypto /
token / NFT / staking / yield / resale / gambling / marketplace / ownership / rent / income / payout /
economy. No accounts / OAuth / profiles. No third-party telemetry/tracking. No new DO, migration, route,
or server message; no client→server activity path. No cross-block economy/inventory. No formula / reward
/ schedule / Host-Rank / Stewardship / Block-Trial rule changes. No HiveWorld bridge, no
`arcade/hiveworld-sim/`, no `game/*`. No combat/vehicles/NPCs.

## Next phases

- Optional: a server-authored, bounded district activity log if cross-client shared history is ever
  wanted (would be additive + public-safe), under the same no-economy doctrine.
