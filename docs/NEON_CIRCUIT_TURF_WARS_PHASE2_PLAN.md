# Turf Wars — Phase 2 Plan: Deterministic Attack Simulator + One-Op Fraud-Proof

**Status: DESIGN-ONLY · LAB-ONLY · NOT AUTHORIZED TO BUILD.** This is a planning document for Phase 2 of
the Turf Wars roadmap. It authorizes no implementation, no production exposure, no live combat, no
minors-facing use, and no economy. It does **not** supersede the live gameplay charter and does **not**
satisfy or substitute for the **Phase 0 legal/safety counsel review, which remains BLOCKING** for any
live or minors-facing use. Building Phase 2 requires a separate explicit gate; even then it stays
lab-only and prod-denylisted exactly like Phase 1 (recorded in ADR-050). It does not claim counsel
approval, charter override, minors-safety clearance, or production readiness.

Builds on: Phase 1 signed-CRDT substrate (`arcade/hiveworld-agents/turf-wars/`, merged PR #103 /
`c9c11b5`, ADR-050). Parent design: `docs/NEON_CIRCUIT_TURF_WARS_ROADMAP.md` (design-only, unpushed
`docs/turf-wars-roadmap` @ `f0fcfa5`).

## The problem Phase 2 solves

In a decentralized turf-control game with **no central server and no referee**, an attack (player A
raids player B's block) must settle such that:

1. the outcome is a **deterministic, independently recomputable** function of public, signed inputs;
2. a cheater **cannot forge** a favorable result that other peers will accept;
3. the **defender can be offline** — you attack a *signed snapshot*, not a live host;
4. **no authority adjudicates** — disputes resolve by math, not by a judge;
5. "loss" is **reversible and cosmetic only** — a base is never destroyed, transferred, or drained.

Phase 1 already gives the trust primitives (Ed25519 identity, signed hash-chained logs, content-addressed
host-signed snapshots, a convergent fold, bounded non-cash counters). Phase 2 adds the **settlement**
layer on top, reusing those primitives without weakening any of them.

## The attack model (deterministic, refereeless)

Attack outcome is a **pure function**:

```
simulateAttack(signedBaseSnapshot, signedAttackPlan, seed) -> outcome
```

- **`signedBaseSnapshot`** — the defender's Phase-1 snapshot record (already content-addressed +
  host-signed + offline-verifiable via `verifySnapshot`). The attack runs against this immutable
  snapshot; the defender need not be online.
- **`signedAttackPlan`** — a closed-vocabulary, Ed25519-signed sequence of attacker moves (e.g. a bounded
  list of `{ target_structure_id, action }` from a closed action enum). No free text, no code — same
  closed-vocab discipline as Phase 1 ops; reuse `scanForbidden` + strict per-type schemas.
- **`seed`** — a deterministic, verifiable-but-not-attacker-chosen value (see Open Decision O1). The seed
  is what stops "grind the RNG until I win".
- **`outcome`** — a bounded, deterministic **scorch** result: which of the defender's structures are
  cosmetically scorched and by how much, plus the attacker's bounded reward. Reversible by construction
  (see invariants).

The **execution engine is the existing Free Sandbox deterministic interpreter**
(`arcade/creator/.../free-sandbox-interpreter.mjs`) — already a closed-vocab, deterministic, sandboxed
graph evaluator with no `Date.now`/`Math.random`/network. Modeling the attack as a fixed interpreter over
a closed move/defense vocabulary means the outcome is reproducible by anyone with the three public inputs,
and adds **no new trust surface** (the same property that made Creator Freedom v1 safe — ADR-048).

## Anti-cheat: optimistic execution + one-op fraud-proof (the keystone)

No referee adjudicates. Instead:

1. The attacker publishes a `record_attack_result` op carrying the three input references (base snapshot
   address, attack-plan hash, seed) and a digest of the claimed outcome, signed.
2. Settlement is **optimistic** — peers provisionally accept it.
3. **Anyone** can recompute `simulateAttack(base, plan, seed)` and, if the claimed outcome digest does not
   match the recomputed one, publish a **single counter-op (the fraud-proof)** that any peer can verify in
   one deterministic evaluation. A proven-fraudulent result is rejected and gossiped as revoked.

Forged *inputs* already fail by Phase-1 invariants: a tampered base snapshot fails `verifySnapshot`
(`address_mismatch`/`bad_signature`); an unsigned/forged plan fails `verifyOp`; a wrong seed yields a
different, falsifiable outcome. So the attacker can only lie about the *output*, and the output is
one-shot recomputable — making the lie cheap to disprove and expensive to attempt. **Authority =
replay-determinism**, exactly as in Phase 1.

## The `record_attack_result` op (reserved in Phase 1 → designed here)

Phase 1 reserves and rejects `record_attack_result` (`reserved_for_phase2`). Phase 2 designs its closed
schema. Sketch (subject to the open decisions below):

```
record_attack_result payload (closed, no free text/URL/code):
  base_address      content address of the defender's signed base snapshot
  plan_hash         content address of the signed attack plan
  seed              the deterministic settlement seed (commit-reveal derived — O1)
  outcome_digest    content address of the canonical computed outcome
  attacker          (carried by the op envelope `actor`)
```

**Reversibility / cosmetic-only invariants (hard, fold-enforced — never relaxed):**

- the defender's **base snapshot is never mutated, transferred, or deleted** — scorch is a separate,
  bounded, *decaying* overlay gauge, exactly the shape of the existing non-cash decaying counters;
- **no transfer of structures or counters** between players — Phase 1's "no transfer/cash-out op exists"
  property is preserved; an attack yields the attacker a bounded non-cash reward minted under the same
  cap discipline, it does not *move* the defender's value;
- scorch is **bounded and self-healing** (decays to zero over ticks), so no permanent destruction;
- an attack that would inflate state, drain a balance below zero, or exceed scorch bounds **fails to
  fold** — same bounded-counter invariants as Phase 1.

## Reuse map (mostly wiring, little net-new)

| Need | Reuse |
|---|---|
| Identity / signatures | Phase 1 `identity.mjs` (Ed25519) |
| Canonical bytes / content addresses | Phase 1 `canonical.mjs` (reuses shipped `package-hash`) |
| Base snapshot (immutable, offline-verifiable) | Phase 1 `snapshot.mjs` |
| Signed op envelope + closed vocab + `scanForbidden` | Phase 1 `ops.mjs` |
| Fold / bounded counters / convergence | Phase 1 `block-log.mjs` |
| Attack execution engine | Free Sandbox deterministic interpreter (closed-vocab, sandboxed) |
| Adversarial harness pattern (C-matrix, seeded LCG, replay artifact) | `turf-evidence.mjs` + HiveWorld `attention-stress`/`attention-evidence` |

## Expanded hostile matrix (design target — extends Phase 1 C1–C10)

- **D1** valid attack settles deterministically; recompute matches.
- **D2** forged outcome digest → fraud-proof rejects in one op.
- **D3** forged/tampered base snapshot → `address_mismatch`/`bad_signature` (Phase 1).
- **D4** unsigned/forged attack plan → `verifyOp` rejection.
- **D5** seed grinding → seed is commit-reveal-bound, not attacker-chosen (O1); grinding is detectable/invalid.
- **D6** replayed settlement (same attack twice) → idempotent / rejected.
- **D7** offline-victim settlement → bounded fraud-proof window so an absent defender is not robbed (O2).
- **D8** scorch overflow / permanent-loss attempt → bounded + reversible invariant holds; over-bound fails to fold.
- **D9** value-transfer attempt via attack → no transfer op exists; reward is capped mint, base untouched.
- **D10** non-reversible / base-mutation attempt → rejected; base snapshot is immutable by construction.

## What Phase 2 deliberately does NOT build

- No live exposure, no real combat against live players, no network/transport — all lab-only, prod-denylisted.
- No **availability fabric** (DHT/gossip/peer cache) — that is **Phase 3**, and it is what actually
  *delivers* attacks between peers; Phase 2 proves settlement in-process only.
- No **safety quorum / render-gate** — **Phase 4**.
- No **live pilot** — **Phase 5**, counsel + operator gated.
- No economy with cash value, IAP, marketplace, ownership transfer, or minors-facing surface.

## Open decisions (operator/counsel input needed before building)

- **O1 — settlement seed.** How is `seed` made deterministic *and* unpredictable-but-verifiable without a
  referee? Leading candidate: a **commit-reveal** binding both parties' signed commitments (attacker's
  plan commitment + defender's snapshot) so neither can grind it. Needs design + a hostile proof (D5).
- **O2 — fraud-proof liveness vs. offline victims.** If the defender is offline, who raises the
  fraud-proof, and within what window, so a truthful-but-absent defender is never settled against unfairly
  (D7)? This is the dominant open risk of refereeless settlement.
- **O3 — attack cost.** Does attacking spend the attacker's bounded `flux`/`cores`? (Anti-spam vs. pace.)
- **O4 — defense semantics.** How do `defense_decoy` (and other defensive structures) deterministically
  affect the outcome, within the closed interpreter vocabulary?
- **O5 — scorch bounds + decay curve.** Exact bounds and self-heal rate (reversibility is non-negotiable;
  the numbers are tunable).
- **O6 — multi-attacker / concurrent attacks** on one base snapshot — ordering + convergence.

## Boundary (unchanged from Phase 1)

Lab-only; prod-denylisted under the existing `arcade/hiveworld-agents/` upload prefix; imported by no
production path; `LIVE_WORLD_LOADER_ENABLED` stays `false`; no Worker/DO/D1/R2/migration/secret/config.
**Phase 0 legal/safety counsel remains the hard gate before anything live or minors-facing — Phase 2
moves none of it.**

## If/when authorized — proposed first build slice

A single lab module `attack-sim.mjs` + `attack-evidence.mjs` proving D1–D10 deterministically (seeded,
byte-identical replay), with `record_attack_result` implemented behind the same prod-denylist, reversibility
and bounded-scorch invariants fold-enforced and unit-tested, and two independent fresh-context verifiers —
the same rigor ladder Phase 1 passed. No live exposure; the availability fabric that would actually deliver
attacks is a separate later phase.
