# CloveLearn / Neon Circuit — Project Charter

This file records **significant architectural decisions** (per the project
engineering rule). Newest first.

---

## ADR-003 — Neon Circuit economic doctrine: lock the shape, defer the numbers

**Date:** 2026-06-01
**Status:** Accepted
**Area:** `docs/NEON_CIRCUIT_ECONOMIC_DOCTRINE.md`; builds on ADR-002.

### Context
The arcade needs a credible closed-loop economy that survives both a bot swarm and a
compliance audit, without drifting into crypto/tokenomics. Prior framing used
crypto/agent jargon and over-strong claims ("structurally incapable") for behavior no
code yet rejects.

### Decision
Adopt a doctrine with the defensive spine **Play = abundance, Governance = scarcity,
Creators = contractual royalties, Agents = advisory only**, and **lock the shape while
deferring every number** to simulator tuning. Captured in
`docs/NEON_CIRCUIT_ECONOMIC_DOCTRINE.md` as a public manifesto + launch-constraints +
an auditable enforcement-status map.

**Locked (doctrine):** tickets non-transferable & account-bound; tickets carry zero
governance weight; no tradable token at launch; creator pay is contractual royalty
accounting, never yield; agents advise, humans/community approve; absolute ban on
cash-out, loot boxes, staking, leverage, pay-to-win; Builder Reputation only from
accepted work; no single metric controls money/governance/payout.

**Open (parameters, deferred to the HiveWorld testbed):** daily ticket-eligible scores
per cabinet; Proof-of-Rest multiplier range; Player Daily Earning Cap; royalty
attribution weights; Community Development Pool splits/caps; reputation decay rate.

### Language & honesty discipline
- Use **"designed not to support"** for product intent; reserve **"enforced at the
  economy event layer"** for constraints actually rejected in code.
- The doctrine's §9 map tags every locked claim **ENFORCED (sim)** /
  **ENFORCED BY ABSENCE** / **DESIGN INTENT**. A claim is promoted to ENFORCED only
  when its subsystem exists *and* a rejection test exists; production promotion still
  requires a fresh security/compliance review (ADR-002).

### Enforced today (simulator), unchanged by this ADR
Ticket/good non-transferability + account-binding, the `FORBIDDEN_EVENT_TYPES`
boundary (transfer/cashout/stake/yield/resale/token-trade rejected before any
reducer), internal-only credits (faucet test-mode-gated), bounded spend, and
advisory-only `agent_intent` (records intent, never authoritative). Builder
Reputation, Proof-of-Rest, creator royalties, the daily cap, the full advisory gate
chain, and Sybil resistance are **design intent only** — not yet modeled in code.

### Consequences
- This is a docs-only decision; no economy subsystem was added or changed
  (`node --test tests/hiveworld/*.test.mjs` 113/113 still pass).
- Future economy work has a single source of truth for what is locked vs tunable, and
  a promotion rule that forbids silent over-claiming.

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
