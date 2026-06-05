# Neon Circuit — Phase 6D: Fourth Block + Non-Linear District Topology

**Status:** implemented on `feat/neon-circuit-phase6d-fourth-block`. Builds on Phase 6C (`ee3308e`).
No new DO class, **no migration**, no new route.

## Goal

Prove the district can **grow** without rewriting routing / presence / activity / event systems: add a
fourth block (**Foundry**) and make the topology **non-linear** (a ring with two paths between
opposite blocks). Map topology only — no ownership, rent, market, or economy.

## The fourth block

`city-block.mjs` `CITY_ROOMS` gains:

```js
{ city_id: 'foundry-04', display_name: 'Foundry Block', capacity: 24, theme: 'forge-ember' }
```

- **Geometry is byte-identical** across blocks (shared `CITY_BLOCK`); Foundry only adds per-block
  landmark labels (`FORGE STACK` / `EMBER CANTEEN` / `FREIGHT LINE`) and a per-block default style
  (`forge-ember`: amber arcade + magenta forge glow), exactly like the Phase 5B identity for the
  other blocks. Each block is its own `CityRoom` DO via `idFromName(city_id)` → **adding a block adds
  no DO class and needs no migration**.

## Non-linear topology (the ring)

`city-district.mjs` `ADJACENCY` becomes a 4-block **ring**:

```text
downtown — harbor — skyline — foundry — downtown
```

```js
downtown-01: [harbor-02, foundry-04]
harbor-02:   [downtown-01, skyline-03]   // UNCHANGED from Phase 5A — preserves prior routes
skyline-03:  [harbor-02, foundry-04]
foundry-04:  [downtown-01, skyline-03]
```

- **Non-linear / more than one path:** opposite blocks (downtown↔skyline, harbor↔foundry) are **not**
  directly adjacent, and downtown reaches skyline **two ways** — via harbor *or* via foundry.
- **Backward-compatible:** harbor's neighbours are unchanged, and downtown↔skyline stays non-adjacent,
  so every Phase 5A route assertion (and live route) still holds. Foundry only **adds** edges.
- Routing stays **server-validated and bounded**: `validateRouteRequest` accepts only direct edges;
  `harbor → foundry` (opposite corners) is rejected `not_adjacent`; unknown/garbage still rejected.

## What did NOT change

- No new DO class, **no migration**, no new route, no new server message type, no `SCHEMA_VERSION`
  bump (a 4-block manifest is the same shape as a 3-block one; old clients render whatever blocks
  arrive). Presence, the district activity feed, and the event schedule are all block-agnostic (they
  iterate the manifest / `CITY_IDS`), so they pick up Foundry automatically.
- No block mutates another block; cross-block isolation stays structural (one DO per block).

## Authority

`validateRouteRequest` (server) still owns routing; the target block's `CityRoom` still
authoritatively admits the player. The fourth block is public map topology — no ownership, rent,
income, market, or economy.

## Validation

```bash
node --test tests/arcade/*.test.mjs                  # full suite: 568 pass (+4 Phase 6D ring tests)
bash tests/arcade/run-city-district.sh               # 4 blocks + foundry offered + harbor→foundry rejected
bash tests/arcade/run-city-district-presence.sh      # presence delta covers the 4th block
bash tests/arcade/run-city-district-activity.sh      # activity feed narrates the 4th block
bash tests/arcade/run-city-district-events.sh        # event schedule rotates over 4 blocks
bash tests/arcade/run-city-stewardship.sh            # foundry default style is valid
( cd workers/arcade && wrangler deploy --dry-run --outdir dist )   # 195.09 KiB / 42.84 KiB gz
node scripts/check-city-build-size.mjs               # ≈0.783 / 0.212 MB gz
```

Unit tests prove the routing math (foundry routes accepted from downtown/skyline, rejected from
harbor); the browser smoke proves the 4th block renders, is offered from downtown, and that the
harbor→foundry direct route is rejected. A live route *into* foundry reuses the exact travel path
proven for harbor (same code for any adjacent target).

## Known limitations

- The renderer geometry is shared across all blocks (per the existing Phase 5B design); Foundry is
  distinguished by labels + default style, not bespoke geometry. Bespoke per-block layouts remain out
  of scope (and would be a larger, separate effort).

## Non-goals (unchanged)

No ownership/rent/income/market/economy; no block sale/claim; no new DO class/migration/route; no new
arcade cabinet or game; no HiveWorld bridge; no `game/*` changes; no production deploy.
