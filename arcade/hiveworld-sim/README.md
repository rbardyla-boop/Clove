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

**v0.3–v0.7 — Phase 2 parity:** room presence health (v0.3), smart-lobby presence
UX (v0.4), deterministic scheduled room events + featured-cabinet annotations
(v0.5), **live room-event feed transitions** (v0.6), and **pre-roll "upcoming"
announcements** (v0.7). v0.6 emits `room_event_started` / `room_event_ended` /
`featured_cabinet_changed` via a `room_event_transition_check` fabric event + a
deduped per-room transition tracker; v0.7 adds `room_event_upcoming` (a pre-roll
when the next event is within `PREROLL_LEAD_TICKS` of starting) — the tick-clocked
mirror of product Phase 2f / 2g.

Full write-ups: [`docs/HIVEWORLD_V0_TESTBED.md`](../../docs/HIVEWORLD_V0_TESTBED.md)
· [`docs/HIVEWORLD_V0_1_PHASE1_PARITY.md`](../../docs/HIVEWORLD_V0_1_PHASE1_PARITY.md)
· [`docs/HIVEWORLD_V0_2_MULTI_ROOM.md`](../../docs/HIVEWORLD_V0_2_MULTI_ROOM.md)
· [`docs/HIVEWORLD_V0_6_ROOM_EVENT_FEED.md`](../../docs/HIVEWORLD_V0_6_ROOM_EVENT_FEED.md)
· [`docs/HIVEWORLD_V0_7_ROOM_EVENT_UPCOMING.md`](../../docs/HIVEWORLD_V0_7_ROOM_EVENT_UPCOMING.md)
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
