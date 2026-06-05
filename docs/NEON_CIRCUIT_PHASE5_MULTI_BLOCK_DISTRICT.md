# Neon Circuit — Phase 5A: Multi-Block District Foundation

Phase 5A grows the city from a single isolated block into the smallest useful **district**
of multiple blocks, while preserving every Phase 4 authority and safety boundary. It is a
foundation: discovery + bounded routing + per-block isolation. It is **not** an economy,
MMO, marketplace, or HiveWorld-bridge phase.

## Goal

Prove the city is no longer one block: players can **discover** the blocks in a district,
**travel** between adjacent blocks, and each block stays **server-authoritative** with its
own event log / scheduler / Host Rank / stewardship / trial state. A shared, public-safe
registry exposes block summaries. No block can mutate another.

## What changed from Phase 4G

- `arcade/city/city-block.mjs` — `CITY_ROOMS` expands from **1 → 3** blocks
  (`downtown-01`, `harbor-02`, `skyline-03`). `SCHEMA_VERSION` **6 → 7** (additive).
- New pure module `arcade/city/city-district.mjs` — district manifest, adjacency/topology,
  public-safe block summaries, and bounded route validation. No state, no async, no economy.
- `workers/arcade/src/city-room.ts` + `workers/arcade/city-dev-shim.mjs` — additive
  `city_blocks` (pushed on join) + `city_blocks_request` + `city_route_request` /
  `city_route_result`. Rate-limited per socket. **No new DO, no new migration.**
- `arcade/city/city-net.js` — `requestBlocks()`, `requestRoute()`, and a clean `switchCity()`
  that reconnects to a new block without auto-reconnecting to the old one.
- `arcade/city/city-scene.js` + `index.html` + `city.css` — a city-OS **District panel**
  (current block + adjacent blocks + Travel control + route status). textContent + buttons only.

## Authority model (unchanged, extended)

Players send **intent**; the server owns **truth**. Each block is its own `CityRoom`
Durable Object, addressed by `idFromName(city_id)` — so per-block isolation is **structural**
(a DO physically cannot read or write another block's storage). Adding blocks adds no DO
class and needs no migration.

The client may request: block list, route to block. The server decides: which blocks exist,
which block a player is in (the route URL fixes `boundCityId`; the join payload cannot
re-bind it), whether a route is valid, and the public block summary. The client may **never**
author block membership, route truth, block state, Host Rank, stewardship, trial outcome,
economy, ownership, inventory, or reward.

## District / block model

One district (`neon-district-01`) of three blocks. Topology is a **line**:
`downtown-01 — harbor-02 — skyline-03`, so `downtown ↔ skyline` are **not** adjacent (you
route through harbor). Each block is the existing `CityRoom` DO; for 5A all blocks share the
base layout and differ by public metadata (name/theme). Bespoke per-block layouts are deferred.

## Registry / discovery model

`districtManifest(currentCityId)` returns a **static, public-safe** manifest:
`{ district_id, district_name, current_city_id, blocks:[summary], adjacency }`. Each block
summary is `{ city_id, display_name, theme, capacity, adjacent }` — **no population, no
player ids, no balances/ledger/inventory, no economy, no ownership**. It is pushed on join
and on `city_blocks_request`. Live population/health is deferred to 5B (the existing
RoomRegistry heartbeat pattern is the template).

## Routing / transition model

A transition is **reconnect to a different block's DO**, server-confirmed at both ends:

1. Client sends `city_route_request { target_city_id }` to its current block.
2. The block validates against the pure district graph: the target must be a **known** block
   **adjacent** to the server-owned source, and not the source itself
   (`validateRouteRequest`). It returns `city_route_result { ok, target_city_id, ws_hint }`
   or `{ ok:false, reason }`. **No block state is mutated.**
3. On `ok`, the client reconnects (`switchCity`) to the target block, whose authority
   admits the player via the normal `city_join`. A client can never forge cross-block
   membership: membership is being joined to a specific DO, which only that DO grants.

Reason codes: `unknown_source`, `invalid_target`, `unknown_block`, `same_block`, `not_adjacent`.

## Public-safety model

Discovery is static config; routing is server-validated; summaries are public-safe by
construction. The District panel renders with `textContent` + button elements only (no
`innerHTML`), and carries no money/ownership/claim copy. Forged `city_blocks` / route facts
from a client are rejected (`unknown_type`); an untrusted `target_city_id` is sanitized
(`sanitizeCityId`) and adjacency-checked before use.

## Size-budget result

`node scripts/check-city-build-size.mjs` → **0.729 MB uncompressed / 0.195 MB gzipped**
(within the 80 MB / 34 MB budgets). Worker bundle `178.16 KiB / 38.33 KiB gz` (additive
handlers; no new dependency, no new asset).

## Validation commands

```bash
node --test tests/arcade/*.test.mjs                 # 500/500
node tests/arcade/check-production-config.mjs        # PASS
node scripts/check-city-build-size.mjs               # PASS
bash tests/arcade/run-city-district.sh               # NEW — district smoke
bash tests/arcade/run-city-block.sh                  # + all Phase 4 city specs
bash tests/arcade/run-two-client.sh
bash tests/arcade/run-frame-contract.sh
( cd workers/arcade && wrangler deploy --dry-run --outdir dist )
```

## Known limitations

- All blocks share the base layout (bespoke per-block worlds deferred to 5B).
- Discovery is static — no live population/health yet (deferred to 5B).
- Topology is a fixed 3-block line; the adjacency graph is configuration, not data-driven.
- Travel is district-panel-driven; in-world inter-block portals are not implemented.

## Explicit non-goals

No real money, crypto, blockchain, token/NFT, staking/yield/resale/cash-out, gambling/
wagering, marketplace, prize cash value, transferable goods, paid hosting, land/block
ownership, rent/income/payout, accounts/OAuth, persistent global profile, cross-block
inventory or economy, HiveWorld bridge, `arcade/hiveworld-sim`, unrelated `game/*`, combat/
weapons/police/vehicle physics/LLM NPCs. No deploy, no credentials. No change to arcade
ticket formulas, prize costs, challenge rewards, event schedules, Host Rank scoring,
stewardship eligibility, or Block Trial rules.

## Next phases

- **5B** — live block population/health in discovery (registry-style heartbeats); bespoke
  per-block layouts/themes; optional in-world inter-block portals.
- Beyond — richer district topology, scheduled cross-block events (display-only), all within
  the same per-block-authority, no-economy doctrine.
