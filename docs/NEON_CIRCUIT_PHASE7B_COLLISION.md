# Neon Circuit — Phase 7B: Collision / Walkable Boundaries

**Status:** implemented, local-only, **no deploy**. First explicit City Gameplay Kernel layer.
**Parents:** `docs/NEON_CIRCUIT_GAMEPLAY_CHARTER.md`, `docs/NEON_CIRCUIT_CITY_GAMEPLAY_KERNEL.md` §2.
**Not:** combat · vehicles · pathfinding/navmesh · physics engine · economy · ownership · accounts.

## What 7B adds

The city already had server-authoritative collision since Phase 4A (`city-block.mjs`: world bounds +
building/prop AABBs, wall-sliding, in `resolveCollision` → `predictStep`). Phase 7B **formalizes the
walkable boundary as a kernel layer** without reimplementing that collision — a new pure module
`arcade/city/city-collision.mjs` that **composes** the existing primitives and adds:

```
BLOCKED_ZONES               keep-out rectangles distinct from solid buildings (per-block, frozen)
isInBlockedZone(x,y,ctx,r)  circle-vs-zone test (ctx = city id OR an explicit zones array)
isPointWalkable(x,y,ctx,r)  in-bounds + clear of buildings (existing) AND clear of blocked zones
clampToWalkable(from,to,ctx) resolveCollision (bounds+buildings) then axis-slide out of zones
segmentIntersectsBlocked(a,b,ctx) segment-vs-zone (anti-tunnel test for fast movers)
nearestSafePoint(x,y,ctx)   push an unsafe point to the nearest walkable point (bounded spiral)
safeSpawnPoint(ctx,seed)    deterministic, guaranteed-walkable spawn (skips zones)
safeArrivalPoint(ctx)       deterministic, guaranteed-walkable arrival point per block
```

`ctx` is a city id (live use) **or** an explicit zones array (tests/fixtures), so the blocked-zone
logic is fully testable without touching live data.

## What collision owns vs. what is display-only

| Concern | Owner today |
|---|---|
| World bounds + building/prop collision | **Server-authoritative** (unchanged — `resolveCollision` in `predictStep`, run by the CityRoom DO and the dev-shim). |
| Blocked zones (new) | **Model-ready + client-enforced for feel** in 7B. The live `BLOCKED_ZONES` set is **empty**; the capability is implemented and fixture-tested. |
| Safe spawn / arrival points | Pure model; server-ready. |
| The eased on-screen avatar position | Display-only (client). A 7B guard snaps the *eased* avatar to a walkable point so it never visually clips a wall/zone during interpolation. |

**The client never becomes the permanent source of truth.** The server already owns accepted positions
for bounds + buildings. The new module is **server-ready**: the CityRoom DO can import it unchanged, and
populating a block's `BLOCKED_ZONES` enforces consistently on server + client because both run the same
shared step (`predictStep`/`resolveCollision`). Until then, blocked zones are a client-feel + tested
capability — see "Authority" below.

## Why the live blocked-zone set is empty (no fake wiring)

Wiring real blocked zones into the live layout changes live movement once deployed. To keep 7B
**byte-identical at the Worker** (no migration, no live-feel surprise, dry-run `195.09 KiB` unchanged)
and avoid disrupting existing spawns/portal/routes/specs, the live `BLOCKED_ZONES` set is intentionally
empty. This is a deliberate, documented state — the capability is real and tested (fixtures), not a
placeholder. Populating a block's zones is a one-line data addition that then enforces on server+client
via the shared step; doing so is a follow-up driven by an actual gameplay need (e.g. an event stage).

## What 7E will server-confirm

Phase 7E adds server-confirmed interaction *receipts* for actions (arcade entry, travel, etc.). 7B is the
boundary model those interactions sit on; if/when blocked zones gate an interaction, 7E's server check is
where "are you actually in a walkable, eligible spot?" is confirmed against the canonical position.

## Why no combat / vehicle physics

Per the charter's hard non-goals: no weapons, vehicles, or vehicle combat. Collision stays deterministic
AABB + wall-slide — enough for a legible walkable city, cheap (GTA-80 size budget), and replay-deterministic
so client prediction reproduces the server exactly. No Rapier/navmesh/pathfinding.

## Validation

```
node --test tests/arcade/city-collision.test.mjs          # 16 pure unit tests
bash  tests/arcade/run-city-collision.sh                  # 16-check browser smoke (real move-to-wall + in-browser kernel)
node --test tests/arcade/*.test.mjs                        # 584 arcade unit (568 + 16), green
bash  tests/arcade/run-city-authority.sh                  # existing client regression — green (city-scene.js edit safe)
node  scripts/check-city-build-size.mjs                    # 0.795 MB / 0.217 gz — GTA-80 within
cd workers/arcade && wrangler deploy --dry-run             # 195.09 KiB / 42.84 gz — byte-identical (no Worker change)
```

Files: `arcade/city/city-collision.mjs` (new pure kernel), `arcade/city/city-scene.js` (display guard +
import), `tests/arcade/city-collision.test.mjs`, `tests/arcade/city-collision.spec.mjs`,
`tests/arcade/run-city-collision.sh`, this doc, `docs/PROJECT_CHARTER.md` (ADR-025). No Worker/DO, no
migration, no economy/ownership/accounts.
