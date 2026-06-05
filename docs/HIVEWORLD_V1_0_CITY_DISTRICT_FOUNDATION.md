# HiveWorld v1.0 — City/District Mirror Foundation

The HiveWorld simulator mirrored the product's arcade/room line through v0.9 (Phase 1 + Phase 2a–2i).
The product has since grown a **city/district era** (Phase 4A–4G city arc, Phase 5A–5E multi-block
district). **v1.0 opens the city/district line in the simulator** — as a deterministic **lab / proof
harness**, not a product bridge. It establishes the primitives (city blocks, district topology, an
append-only event mapping, cross-block routing as event semantics, public-safe presence + activity)
without attempting full Phase 4C–4G parity.

## Goal

Let the simulator reason about city blocks, district topology, server-authored public-safe city facts,
per-block isolation, cross-block routing, and district activity — and prove they converge deterministically
under delayed / duplicated / out-of-order delivery.

## Why v1 begins now

v0.x mirrored the arcade/room product line. The district era is a new product surface with new invariants
(per-block authority, bounded routing, public-safe presence/activity) that don't fit the room model — so it
starts a new major version. v1.0 is intentionally **foundational**: it lands the district semantics +
deterministic replay; the deeper 4C–4G and 5C/5D cadence mirrors are v1.1+.

## What changed from v0.9

- **New sim-local pure modules** (`core/phase1/`), mirroring the product but **never importing**
  `arcade/city/*` (that would be a bridge):
  - `city-blocks.mjs` — static district config: 3 blocks (downtown-01 / harbor-02 / skyline-03), each with
    display name + theme; `isKnownBlock`/`getBlock` (mirror of product Phase 5A/5B).
  - `district.mjs` — line adjacency (downtown — harbor — skyline), `validateRoute` (known + adjacent + not
    same), `publicBlockSummary` (allowlist: `city_id`/`display_name`/`theme`/`population`/`health`/`adjacent`;
    offline → no ghost population), `districtManifest` (mirror of Phase 5A routing + 5C summary).
  - `district-activity.mjs` — `activityItem` (allowlist-projected, fail-safe on unknown types),
    `activityForPresence` (became active/empty / health transitions), `appendActivity` (newest-first,
    coalesces against the head by `(type, city_id)`, bounded to 16) — mirror of product Phase 5E.
  - `city-events.mjs` — the `CITY_EVENT_SIDEBAND` map + builder helpers (so scenarios stay readable without
    editing `agent.mjs` / `room.mjs`).
- **New reducer** `core/reducers/district.mjs` — folds district topology, per-actor current block, route
  status, per-block public presence summaries, the bounded activity feed, and a rejected-route counter.
- **3-place registration** (the fabric's coverage rule): 8 new types in `core/events.mjs` `EVENT_SPECS`,
  handlers in `core/reducers/index.mjs`, and a matching sideband in `CITY_EVENT_SIDEBAND`. `state-util.mjs`
  adds `state.district` to the initial state **and the convergence fingerprint**.
- **Scenarios** (`scenarios/city-district.mjs`) + a **testbed panel** (`hiveworld-testbed.html` /
  `hiveworld-debug.mjs`) + UI-smoke coverage.

## Authority / isolation model (mirror)

Each **block** is an authority node (a `RoomBaseStation` whose id === the `cityId`, so it can sign that
block's events). The product's model is preserved:
- **Location authority:** an actor's current block changes **only** on a `city_block_arrived` that follows a
  source-block-authored `city_route_confirmed`. The `city_route_confirmed` reducer **re-validates** adjacency
  + that the actor is at the stated source + that a matching request is pending — so a **forged or
  non-adjacent confirm can never teleport an actor**.
- **Per-block isolation:** each block's reported public summary lives under `state.district.blocks[cityId]`;
  a block signs only its own `district_presence_delta` (`actor_id === cityId`).
- **No bridge:** the simulator never imports product `arcade/city/*` and never touches the live Worker/DO.

## City block model

`neon-district-01` with three static blocks: `downtown-01` (Downtown / downtown-magenta), `harbor-02`
(Harbor / harbor-cyan), `skyline-03` (Skyline / skyline-amber), capacity 16 each. Static + bounded for v1.0.

## District topology model

A **line**: `downtown-01 — harbor-02 — skyline-03`. So downtown↔skyline are **not** directly routable (you
route through harbor). Adjacency is symmetric and bounded; routing is adjacent-only.

## Append-only event-log mapping (sidebands)

| event type | sideband | role |
|---|---|---|
| `city_player_joined` / `city_player_left` | `presence` | per-actor block location (ephemeral) |
| `district_presence_delta` | `presence` | block-authored public population + health |
| `city_route_requested` | `event_log` | actor intent |
| `city_route_confirmed` / `city_route_rejected` | `event_log` | source-block authority decision |
| `city_block_arrived` | `event_log` | arrival (honoured only after a confirm) |
| `district_activity_derived` | `event_log` | optional explicitly-logged public-safe activity item |

This is a **deterministic sideband mirror**, not a radio-wave implementation sprint — it reuses the existing
`presence` (ephemeral) and `event_log` (persistent) channels; no new sideband classes were added.

## Cross-block routing semantics

`city_route_requested` (actor) → records intent. `city_route_confirmed` (source block, re-validated) → status
`confirmed`; an invalid/forged confirm is **rejected by the fold**. `city_route_rejected` (source block) →
records a rejection + bumps the counter + a safe activity item, no location change. `city_block_arrived`
(actor) → moves the actor **only** if a confirmed route to that block exists.

## District activity semantics

A bounded (16), newest-first, deduped public-safe feed. Items are derived during the fold from presence
changes (`activityForPresence`) and route/arrival reducers, plus an optional explicitly-logged
`district_activity_derived`. Every item is allowlist-projected (`city_id`/`type`/`occurred_tick`/`label`/
`severity`); labels are observational (no economy/ownership copy).

## Public-safety / privacy model

`district_presence_delta` stores **only** the allowlisted `{population, health, last_seen_tick}` — injected
private payload fields (player ids, balances, socket/admin tokens) are dropped at the fold. Activity items and
public summaries are allowlist-projected. Actor ids live only in the raw event envelope (the source chain),
never in a public summary or the activity feed. Tests assert no private data survives the fold.

## Deterministic replay / convergence model

Events fold over the canonical `SidebandCRDTLog`: dedupe by content-addressed `event_id`, sort to one total
order (`logical_tick → actor_id → seq → content_hash`), then fold via pure reducers. Because the fold is a
pure function of the ordered set, **delayed / duplicated / out-of-order delivery converges to the same
fingerprint**. The `state.district` slice is part of `stateFingerprint`, so district divergence is detectable.

## Validation commands

```bash
node --test tests/hiveworld/*.test.mjs        # 248 (231 v0.9 + 17 new city/district)
bash tests/hiveworld/run-ui-smoke.sh           # testbed UI smoke incl. the city panel
```

## Known limitations

- v1.0 is **foundation only** — it does not mirror the full Phase 4C–4G city event log / scheduler /
  Host Rank / Stewardship / Block Trial, nor the Phase 5C/5D presence *cadence* (30 s alarm); those are v1.1+.
- District activity is derived in the fold (deterministic) rather than client-side; the product's 5E feed is a
  client display projection. The sim models the same public-safe outcome, not the client/server split.
- Health can be reported explicitly by a block (so scenarios can drive transitions) and is also derivable from
  freshness; v1.0 uses the reported value when present.

## v1.1 / v1.2 roadmap

- **v1.1** — mirror Phase 4C city event log / scheduler / Host Rank / Stewardship / Block Trial more deeply.
- **v1.2** — model district presence-push + activity-feed cadence (the 5C/5D/5E timing).
- **v1.3** — sideband / radio-fabric visualization for multi-block activity.

## Explicit non-goals

No product bridge, no live Worker/DO connection, no real networking, no real crypto/keypairs, no accounts,
no money / blockchain / token / NFT / staking / yield / resale / cash-out / gambling / wagering / marketplace
/ paid hosting / transferable goods, no ownership / rent / income / payout / land / block sale, no
unconstrained UGC or asset upload, no AR/geospatial, no real persistence beyond the harness, no Phase 6, no
changes to product ticket formulas / Host Rank scoring / Stewardship eligibility / Block Trial rules.
