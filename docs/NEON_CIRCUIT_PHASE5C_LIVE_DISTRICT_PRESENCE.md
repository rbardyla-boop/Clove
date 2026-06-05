# Neon Circuit — Phase 5C: Live District Presence

Phase 5A made the city a district (discovery + routing); 5B gave each block its own identity.
Phase 5C makes the district feel **alive**: discovery now shows each block's **live population
and health**, so you can see where players are before you travel.

This is the first **cross-block** coordination in the city — and it is done with a dedicated
coordinator Durable Object (mirroring the proven arcade `RoomRegistry`/Phase 2c pattern), with
public-safe counts only. Per-block authority, safety boundaries, and economy posture are unchanged.

## Goal

Each `city_blocks` manifest carries, per block, a public-safe `population` count + `health`
(`healthy`/`stale`/`offline`/`unknown`) with stale-population eviction (no ghost population) —
sourced from a coordinator that each block heartbeats to. The district panel shows "N here".

## Authority / isolation model

Per-block CityRoom DOs remain isolated (one per `city_id`); none can see another block's state.
A new **`CityRegistry` Durable Object** is the single coordinator: each CityRoom reports its own
occupancy COUNT (a heartbeat), and reads back the public-safe presence map. It is reached **only
DO-to-DO** (never by a client) and holds **no private player data** — only per-block counts and
registry-stamped freshness timestamps. Health + the stale-population policy are derived by the
pure `city-district.mjs` layer (`deriveCityHealth`, `cityPresenceEntry`). The reporting path is
**fail-open**: if the registry is unbound/unreachable, the manifest falls back to static
(`population 0` / `unknown`) — discovery and routing keep working.

## What changed from Phase 5B

- New pure presence in `arcade/city/city-district.mjs`: `deriveCityHealth`, `cityPresenceEntry`
  (stale-population eviction), and `districtManifest(currentCityId, presence)` enriches each block
  summary with `population` + `health` + `population_is_estimated`. Omitting `presence` is the 5A/5B
  static behavior (back-compat).
- New DO `workers/arcade/src/city-registry.ts` (`CityRegistry`): `POST /city-registry/heartbeat`
  (DO-to-DO) + `GET /city-registry/presence`. Additive migration **v4** (`new_sqlite_classes:
  ["CityRegistry"]`) + `CITY_REGISTRY` binding in all three env blocks; exported from `index.ts`.
  It never touches the arcade or city-room DOs.
- `CityRoom` reports occupancy on join/leave/alarm and on a `city_blocks_request`, caching the
  echoed presence map; the manifest is enriched from that cache. The dev-shim (single process)
  computes the cross-block population locally for headless parity.
- Client: the district panel shows a live "N here" per block (dim for stale/offline); the client
  refreshes presence on a ~12s timer.

## Freshness model

Heartbeat windows mirror Phase 2c: `≤30s` healthy, `30–90s` stale (last count kept, flagged
estimated), `>90s` offline (population evicted to 0). A block reports on join/leave + a ~30s alarm
keepalive, so a quiet-but-populated block stays healthy; a hibernated/empty block ages to
offline/0. Cross-block freshness is bounded by each block's report cadence.

## Public-safety model

The heartbeat and presence map carry only a COUNT + a timestamp — never player ids, connection
ids, balances, ledger, inventory, or any private data (asserted by tests). Population is a public
aggregate, exactly like the arcade `RoomRegistry` exposes room population. No economy/ownership.

## Size-budget result

`node scripts/check-city-build-size.mjs` → **0.735 MB / 0.197 MB gzipped** (within budget).
Worker bundle `183.78 KiB / 39.85 KiB gz`.

## Validation commands

```bash
node --test tests/arcade/*.test.mjs                 # 510/510 (+ presence + config-fixture)
node tests/arcade/check-production-config.mjs        # PASS (incl. v4/CityRegistry)
node scripts/check-city-build-size.mjs               # PASS
bash tests/arcade/run-city-presence.sh               # two clients, cross-block presence
bash tests/arcade/run-city-district.sh               # + all Phase 4 city specs
( cd workers/arcade && wrangler deploy --dry-run --outdir dist )
```

## Known limitations

- **Cross-DO validated locally + on staging, not by the dev-shim alone.** The dev-shim computes
  presence in-process; the real CityRoom↔CityRegistry DO-to-DO path is unit-tested + must be
  verified on staging (the deploy is in the loop). This is deliberate — a cross-DO path can only
  be proven end-to-end on real `workerd`.
- Presence is pull-based (on join + ~12s client refresh + a 30s registry keepalive), not pushed —
  population can lag by up to the report cadence. A push-on-change broadcast is a future option.
- Adds one DO + a v4 migration (additive `new_sqlite_classes`; provisioned on the next deploy).

## Explicit non-goals

No real money / crypto / token / NFT / staking / yield / marketplace / ownership / rent / income /
economy. No third-party telemetry/tracking (presence is internal, public-safe occupancy counts).
No accounts. No cross-block inventory or economy. No HiveWorld bridge, no `game/*`. No authority/
collision change. No credentials.

## Next phases

- Push-on-change presence updates (broadcast `city_blocks` when a block's occupancy changes).
- Richer district topology / scheduled cross-block events (display-only), same per-block-authority,
  no-economy doctrine.
