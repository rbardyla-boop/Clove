# CloveLearn / Neon Circuit — Project Charter

This file records **significant architectural decisions** (per the project
engineering rule). Newest first.

---

## ADR-002 — HiveWorld v0 is a bounded simulator, not a product jump

**Date:** 2026-05-31
**Status:** Accepted
**Area:** `arcade/hiveworld-sim/`, `tests/hiveworld/`, `docs/HIVEWORLD_V0_TESTBED.md`

### Context
The "Sideband CRDT Log / radio-fabric" idea proposes a decentralized living
arcade world (player-carried agents, self-hosted rooms, mesh replication, logical
radio sidebands, world-space slots, digital goods). Taken directly to product
this is an enormous, partly speculative leap with real-money, AR and crypto
hazards.

### Decision
Build the idea as a **local, deterministic proof harness** first — a
simulator/testbed under `arcade/hiveworld-sim/` — instead of a production system.
The harness:

- implements the Sideband CRDT Log, player/room nodes, slots, internal economy,
  cabinet sim, mesh fault injection, and a debug/spectrum UI;
- proves convergence, recovery, desync detection and adversarial rejection via an
  automated test suite (`tests/hiveworld/`, run with `node --test`);
- has **zero runtime dependencies** and runs entirely locally.

### Hard guardrails (enforced in code, not just docs)
- No real cryptocurrency, tokens, staking, yield, gambling, resale, or cash-out.
  Transfer/cash-out/stake/yield/resale event types are in `FORBIDDEN_EVENT_TYPES`
  and refused at the fabric boundary; digital goods are account-bound with no
  transfer reducer.
- No real-world land ownership — world-space "slots" are temporary, expiring,
  revocable game-layer permissions over opaque cell ids.
- No literal RF/radio; "sidebands" are logical state-class channels.
- No blockchain, no external paid services, no accounts/cloud auth, no AR, no
  private user data.
- Signatures are deterministic **mocks** behind a `sign`/`verify` interface so a
  real keypair scheme can replace them without touching the protocol.

### Relationship to canonical authority
The simulator **mirrors** the Phase-1b occupancy model (Cloudflare Worker +
Durable Object in `workers/arcade/`) — one occupant, monotonic `rev`, stale-lock
timeout — to allow comparison. It is **not** the canonical authority and is not
deployed. Promoting any HiveWorld capability toward production requires a fresh
security/compliance review.

### Consequences
- We get an inspectable, reproducible answer to "can this architecture hold?"
  before committing product effort.
- The canonical arcade (Phase 1b–1d) is untouched; the testbed is purely
  additive under a clearly separated directory.
- Future work (real transport bridge, real keypairs, log compaction, Sybil
  resistance, persistence, AR) is documented as explicitly NOT implemented.
