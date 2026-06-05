# Neon Circuit HiveWorld — v0 / v0.1 / v0.2 Simulator / Testbed

A **local, zero-dependency protocol simulator** for the Neon Circuit HiveWorld
Sideband CRDT Log. This is a **proof harness, not a product** — no real crypto,
no money, no cash-out, no resale, no staking, no land ownership, no network.

**v0.1 — Phase 1 arcade parity:** the simulator mirrors the real Phase 1 arcade
(three cabinets, server-authoritative rounds, ticket formulas, ledger, Prize
Counter, Challenge Board, achievements, public feed, Cabinet Frame Contract,
Adapter SDK / dynamic import loader) in [`core/phase1/`](core/phase1/) +
[`core/reducers/arcade.mjs`](core/reducers/arcade.mjs).

**v0.2 — multi-room parity:** the arcade world slice is now PARTITIONED BY ROOM
(`createArcadeWorld` / `arcadeRoom`), so tickets/ledger/inventory/challenges/feed
are isolated per room — mirroring the per-room product Durable Objects. It
**mirrors** the product; it never bridges into the production Worker/DO and is
never deployed.

**v0.3–v0.9 — Phase 2 parity:** room presence health (v0.3), smart-lobby presence
UX (v0.4), deterministic scheduled room events + featured-cabinet annotations
(v0.5), **live room-event feed transitions** (v0.6), **pre-roll "upcoming"
announcements** (v0.7), **operator-tunable event presentation** (v0.8), and
**live-ops per-room presentation overrides** (v0.9). v0.6 emits `room_event_started`
/ `room_event_ended` / `featured_cabinet_changed` via a `room_event_transition_check`
fabric event + a deduped per-room transition tracker; v0.7 adds `room_event_upcoming`
(a pre-roll when the next event is within `PREROLL_LEAD_TICKS` of starting); v0.8 makes
the presentation operator-tunable (validated config via the sim ctx — pre-roll lead,
show flags, public `presentation` payload); v0.9 adds a per-room display-only override
(effective = ctx base ⊕ override) via a room-authored `room_presentation_override_set`
fabric event — the tick-clocked mirror of product Phase 2f / 2g / 2h / 2i.

**v1.0 — city/district foundation (Phase 5A–5E mirror):** the simulator now understands the
multi-block **district** — a static line of three blocks (`downtown-01 — harbor-02 — skyline-03`)
with per-block display identity, **bounded cross-block routing** (an actor moves ONLY after a
source-block-authorized `city_route_confirmed` + `city_block_arrived`; a forged/non-adjacent confirm
can never teleport), a **public-safe presence summary** (`district_presence_delta`, private payload
fields stripped), and a **bounded, deduped district activity feed**. New fabric events ride
`presence` (`city_player_joined`/`city_player_left`/`district_presence_delta`) and `event_log`
(`city_route_requested`/`city_route_confirmed`/`city_route_rejected`/`city_block_arrived`/
`district_activity_derived`). All deterministic — duplicated / out-of-order delivery folds to the same
fingerprint. Lab mirror only: no economy, accounts, ownership, money, networking, or product bridge.

**v1.1 — city systems deep mirror (Phase 4C–4G):** on the v1.0 district substrate, five product
city systems are folded — each public-safe with its safety posture ENFORCED in the fold: **4C** an
append-only, FIFO-bounded (50), monotonic-seq, sanitized **city world log**; **4D** a
**non-authoritative** per-block pressure/mood (derived display only); **4E** a **non-cash** Host Rank
(tier + support signal, no economic field); **4F** **constrained + reversible** Block Stewardship (a
CLOSED allowlist of palette/sign-variant/intensity, gated by Host Rank, reset → default); **4G** an
**instanced, non-destructive** Block Trial (never touches the public block). All deterministic —
reorder/dup delivery folds to the same fingerprint. Lab mirror only: no money/ownership/bridge.

**v1.2 — presence push + activity cadence (Phase 5C/5D/5E timing):** adds the TIMED, PARTIAL view the
fold was missing. `state.district.blocks` stays the registry AGGREGATE (5C); a new per-block
`pushedView` is what each block has PUSHED to its clients — its own entry IMMEDIATE (5D same-block),
other blocks only as of its last ALARM (`city_presence_alarm`, the 30-tick = 30s analog; 5D cross-block
bound). A leave drops to 0 with no ghost; the 5E activity feed follows the push cadence (cross-block
items derive at the observing block's alarm). All deterministic — delayed/duplicated/out-of-order
cadence events fold to the same fingerprint. Lab mirror only.

Full write-ups: [`docs/HIVEWORLD_V1_0_CITY_DISTRICT_FOUNDATION.md`](../../docs/HIVEWORLD_V1_0_CITY_DISTRICT_FOUNDATION.md)
· [`docs/HIVEWORLD_V1_1_CITY_SYSTEMS_DEEP_MIRROR.md`](../../docs/HIVEWORLD_V1_1_CITY_SYSTEMS_DEEP_MIRROR.md)
· [`docs/HIVEWORLD_V1_2_PRESENCE_CADENCE_MIRROR.md`](../../docs/HIVEWORLD_V1_2_PRESENCE_CADENCE_MIRROR.md) [`docs/HIVEWORLD_V0_TESTBED.md`](../../docs/HIVEWORLD_V0_TESTBED.md)
· [`docs/HIVEWORLD_V0_1_PHASE1_PARITY.md`](../../docs/HIVEWORLD_V0_1_PHASE1_PARITY.md)
· [`docs/HIVEWORLD_V0_2_MULTI_ROOM.md`](../../docs/HIVEWORLD_V0_2_MULTI_ROOM.md)
· [`docs/HIVEWORLD_V0_6_ROOM_EVENT_FEED.md`](../../docs/HIVEWORLD_V0_6_ROOM_EVENT_FEED.md)
· [`docs/HIVEWORLD_V0_7_ROOM_EVENT_UPCOMING.md`](../../docs/HIVEWORLD_V0_7_ROOM_EVENT_UPCOMING.md)
· [`docs/HIVEWORLD_V0_8_EVENT_PRESENTATION.md`](../../docs/HIVEWORLD_V0_8_EVENT_PRESENTATION.md)
· [`docs/HIVEWORLD_V0_5_ROOM_EVENTS.md`](../../docs/HIVEWORLD_V0_5_ROOM_EVENTS.md)
· [`docs/HIVEWORLD_V0_6_ROOM_EVENT_FEED.md`](../../docs/HIVEWORLD_V0_6_ROOM_EVENT_FEED.md)

## Layout

```
arcade/hiveworld-sim/
├── core/
│   ├── rng.mjs            seeded deterministic PRNG (no Math.random anywhere)
│   ├── hash.mjs           canonical stringify, content hashing, MOCK signatures
│   ├── sidebands.mjs      the 11 logical channels + behaviour classes
│   ├── events.mjs         event envelope factory + structural validation
│   ├── log.mjs            Sideband CRDT Log: append-only set, dedup, canonical order
│   ├── state-util.mjs     world-state shape, immutable helpers, fingerprint
│   ├── world.mjs          fold engine (ordered events -> world view)
│   ├── reducers/          one pure reducer file per state class
│   ├── node.mjs           base HiveNode (source chain, replica, validate, emit)
│   ├── agent.mjs          PlayerAgentNode
│   ├── room.mjs           RoomBaseStation (fast authority + recovery-by-replay)
│   ├── pulse-tap.mjs      deterministic headless Pulse Tap round
│   └── simulator.mjs      HiveSimulator: topology, faults, reports
├── scenarios/canned.mjs   6 reproducible scenarios (incl. 10-agent/1000-tick churn)
├── hiveworld-testbed.html debug + radio-spectrum UI
└── hiveworld-debug.mjs    UI controller (DOM glue only)
```

## Run the tests

```bash
node --test ../../tests/hiveworld/*.test.mjs   # from this dir
# or from repo root:
node --test tests/hiveworld/*.test.mjs
```

## Run the UI

```bash
# from repo root, any static server that serves .mjs as JS:
npx serve -p 5173 .
# open http://localhost:5173/arcade/hiveworld-sim/hiveworld-testbed.html
```

## Relationship to the canonical authority

The canonical, shippable Neon Circuit occupancy authority is the Phase-1b
Cloudflare Worker + Durable Object in [`workers/arcade/`](../../workers/arcade/).
This simulator **mirrors** that occupancy model (one occupant, monotonic `rev`,
stale-lock timeout) so the architecture can be stress-tested, but it does **not**
replace it and is not deployed.
