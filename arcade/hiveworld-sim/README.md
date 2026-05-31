# Neon Circuit HiveWorld — v0 Simulator / Testbed

A **local, zero-dependency protocol simulator** for the Neon Circuit HiveWorld
Sideband CRDT Log. This is a **proof harness, not a product** — no real crypto,
no money, no cash-out, no resale, no staking, no land ownership, no network.

Full write-up: [`docs/HIVEWORLD_V0_TESTBED.md`](../../docs/HIVEWORLD_V0_TESTBED.md)

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
