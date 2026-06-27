# Turf Wars — Phase 1 Lab Note: Signed-CRDT Substrate

**Status: LAB ONLY · PROD-DENYLISTED · DESIGN-PHASE PROTOTYPE.** This records what the Phase 1
substrate proves and — just as importantly — what it deliberately does **not** build. It is **not** a
production-readiness claim, **not** counsel approval, **not** a charter override, **not** a minors-safety
clearance, and **not** a live-pilot approval. The parent roadmap
([NEON_CIRCUIT_TURF_WARS_ROADMAP.md](NEON_CIRCUIT_TURF_WARS_ROADMAP.md)) remains **DRAFT / DESIGN-ONLY**
and charter-illegal until a Phase 0 counsel ruling plus a charter-superseding ADR clear the bounded
version. Phases 1–4 are lab-only and buildable in parallel with that legal review; **Phase 5 (live
pilot) waits on counsel + operator sign-off.**

## Where it lives (and why it cannot ship)

All code is under `arcade/hiveworld-agents/turf-wars/`, which is already covered by the existing
`arcade/hiveworld-agents/` entry in `FORBIDDEN_UPLOAD_PREFIXES` (the W-4 simulator lab denylist). It is
therefore excluded from the curated production upload **by construction** — no new denylist entry was
required, and `tests/creator/turf-wars-prod-denylist.test.mjs` pins the property. It is imported by no
Worker / Durable Object / client path. `LIVE_WORLD_LOADER_ENABLED` is untouched and remains `false`.

## What Phase 1 proves (deterministic, dependency-free, pure)

| Module | Proves |
|---|---|
| `identity.mjs` | Per-device **Ed25519** keypair; player id = `tw1:` + hash of the public key. No accounts, no login, no PII, no server identity. Deterministic fixture keys from a seed. Valid sig verifies; wrong key / tampered message / tampered or malformed sig all fail. |
| `canonical.mjs` | One canonical byte encoding (reuses the shipped `package-hash` `canonicalize`) + synchronous sha256 → `sha256:` content addresses. |
| `ops.mjs` | **Closed** op vocabulary (`init_block`, `build_structure`, `upgrade_structure`, `collect_resource`, `publish_base_snapshot`, `join_crew`) and **closed** structure model (5 kinds, deterministic cost/production/max-level). Strict per-type schemas + a defense-in-depth scan reject free text, URLs, markup, and code fields. `record_attack_result` is **reserved and rejected** (Phase 2). Op hash integrity + Ed25519 signature verification. |
| `block-log.mjs` | Signed, hash-chained, append-only op log → **pure deterministic fold**. Chain membership (crypto + authority) is order-independent → **convergent**: shuffled/duplicated delivery folds to the same fingerprint. Tamper → `hash_mismatch`; forged sig → `bad_signature`; wrong prev → `chain_break`; missing seq → `seq_gap`; duplicate seq → `fork_detected` (lowest hash wins); replay → idempotent no-op; foreign writer → `not_owner`. Bounded **non-cash counters** (`flux`, `cores`): no negative balance, capped flux mint with clamping, one collect per `(structure, tick)`. **There is no transfer / trade / sell / cash-out op** — value cannot leave a block. |
| `snapshot.mjs` | Content-addressed, **host-signed** snapshots. Identical state → identical address; one flipped byte → different address + failed signature. A cached record **verifies offline** with no access to the signer (the "reach a block whose host is offline" property). |
| `turf-evidence.mjs` | The **C1–C10** adversarial matrix + a seeded scenario builder + a timestamp-free replay artifact. |

**Tests:** 48 new assertions across `tests/arcade/turf-wars-{identity,log,snapshot,evidence}.test.mjs`
and `tests/creator/turf-wars-prod-denylist.test.mjs`. Full repo unit suite: **1199/1199 green.**
Production-config gate, city build-size gate, and curated-upload gate: all PASS.

### Adversarial matrix (C1–C10, all PASS, multi-seed, byte-identical replay)

C1 valid chain accepted · C2 payload tamper rejected · C3 signature mismatch rejected · C4 overmint
rejected (flux cap) · C5 negative balance rejected · C6 unknown op rejected · C7 fork/gap rejected ·
C8 snapshot tamper rejected · C9 forbidden content + reserved combat op rejected · C10
production-denylist proven.

## Post-review hardening (PR #103 review close-out)

The PR #103 review returned ACCEPT-WITH-FINDINGS (0 critical, 0 high, 4 medium). All four mediums were closed in a follow-up commit — three were missing hostile-test coverage for behavior that already passed, one was a fail-closed strictness improvement:

- **Envelope strictness (M1):** `verifyOp` now rejects any op carrying an unknown **top-level** key (`unknown_op_key`), before signature verification, via the closed `OP_ENVELOPE_KEYS` set. Previously only *payload* keys were strictly closed; an extra top-level field was inert in the Phase-1 fold (the hash/signature only cover the 8 signable core keys) but could have been read unverified by a future Phase-3 gossip consumer. Now it fails closed.
- **Type-tamper / actor-tamper tests (M2, M3):** added — a mutated `.type` is rejected (`*_shape` or `hash_mismatch`) and a mutated `.actor` is rejected (`hash_mismatch`); neither is ever applied.
- **Reachable max-level cap (M4):** `resource_node.maxLevel` lowered 5 → **3** so the ceiling is reachable within the starter grant (build 5 + upgrade 5 + upgrade 10 = exactly 20 starter cores) — a reachable cap is an enforceable, testable cap. The over-cap upgrade is now exercised and rejected `max_level`. (Other kinds' core costs exceed the starter grant before level 5, so their ceilings remain latent — a tightening, never a loosening.)
- The snapshot owner-binding test was tightened to pin the exact `owner_mismatch` reason.

## What Phase 1 deliberately does NOT build

- **No combat / attack settlement.** `record_attack_result` is reserved and rejected. Attack
  simulation + the one-op fraud-proof is **Phase 2**.
- **No availability fabric.** No DHT, no gossip transport, no peer cache wiring — snapshots are proven
  cacheable/verifiable in-process only. **Phase 3.**
- **No safety quorum / render-gate.** The M-of-N reviewer quorum + dark-by-default client render-gate
  is **Phase 4** and remains the one lightly-trusted, non-central, safety-only layer the roadmap keeps.
- **No multi-writer crews.** Phase 1 is single-writer (owner-authoritative). `join_crew` records the
  owner's crew affiliation only; multi-writer crew gossip rides on the Phase 3 fabric.
- **No network, no transport, no persistence, no UI, no live exposure, no economy with cash value.**
- **No browser parity yet** — the lab uses `node:crypto`; Web Crypto `subtle` Ed25519 parity is a later
  step (interoperable algorithm, not proven here).

## The honest limit (carried from the roadmap)

Signatures prove an op's **origin**, never its **policy-compliance**. Decentralization does not by
itself solve minors-safety: that is why the design keeps a non-central safety layer (Phase 4) and why
**Phase 0 legal/safety counsel is a hard gate** before any live or minors-facing use. This substrate
moves none of that gate.

## What Phase 2 needs next

1. A deterministic **attack simulator** = pure function of `(signed base snapshot, signed attack plan,
   seed)`, reusing the Free Sandbox interpreter as the execution model.
2. **Optimistic execution + a one-op fraud-proof** so a forged outcome fails to fold (no referee).
3. The `record_attack_result` op moves from *reserved* to *implemented*, with reversible/cosmetic-only
   "scorch" (the base snapshot is never mutated or deleted).
4. An expanded hostile matrix (forged base, forged plan, replayed settlement, offline-victim settle).

All Phase 2 work stays lab-only and prod-denylisted, in parallel with the Phase 0 legal review.
