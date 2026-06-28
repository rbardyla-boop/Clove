# Turf Wars — O1/O2 Settlement Design (the unblocker before settlement build)

**Status: DESIGN — LAB-ONLY · DESIGN-PHASE.** This resolves the two open settlement decisions (O1 seed /
commit-reveal, O2 fraud-proof liveness for offline victims) that the Phase 2 plan
([NEON_CIRCUIT_TURF_WARS_PHASE2_PLAN.md](NEON_CIRCUIT_TURF_WARS_PHASE2_PLAN.md)) left open and that gate the
settlement build. It authorizes nothing live. It does **not** supersede the live gameplay charter, does
**not** claim counsel approval, charter override, minors-safety clearance, or production readiness, and does
**not** satisfy or substitute for the **Phase 0 legal/safety counsel review, which remains BLOCKING** for any
live or minors-facing use. Settlement stays lab-only and prod-denylisted exactly like the Phase 1 substrate
(ADR-050) and the Phase 2 foundation (merged `828f33c`).

This is a **design + lab-mechanism** document, written to the project research-evidence rule: it separates
what the lab **proves** from what it **assumes/defers**, and states what would falsify each claim.

## What was open

- **O1 — settlement seed.** The attack outcome `simulateAttack(base, plan, seed)` is deterministic, so if
  either party can choose/grind `seed` they can grind the outcome ("retry the RNG until I win"). D5 (seed
  grinding) was deferred because the Phase 2 foundation took `seed` as a bare parameter.
- **O2 — fraud-proof liveness vs. an offline victim.** Settlement is refereeless and the defender is offline
  (you attack a *signed snapshot*, not a live host). If raising the fraud-proof required the victim
  specifically, an absent-but-honest defender could be settled against unfairly. D7 was deferred.

## O1 — resolution: two-input commit-reveal with a post-commit beacon

The settlement seed is bound to three things, none of which a single party can grind:

```
seed_commit      = sha256(attacker_seed)                         // published BEFORE the beacon exists
beacon           = entropy neither party controls, fixed AFTER the commit   // O1 residual, see below
settlement_seed  = sha256("turf-wars/settle/v1" || base_address || plan_hash || attacker_seed || beacon)
```

Flow:

1. **Commit (a prior op).** The attacker folds a separate **`attack_commit` op** at an EARLIER sequence,
   carrying only `seed_commit = sha256(attacker_seed)` — **no reveal, no beacon**. The fold records it; a
   later `settle_attack` that has no matching prior `attack_commit` **fails to fold** (`no_prior_commit`).
   This makes "commit before settle" a real, enforced ordering invariant, not just a convention.
2. **Beacon.** A public `beacon` value that did **not exist at commit time** and that neither the attacker
   nor the defender controls becomes available.
3. **Reveal + derive.** The attacker's `settle_attack` reveals `attacker_seed`; the fold checks
   `sha256(reveal) == seed_commit` of the prior commit and derives the single `settlement_seed`. The outcome
   is then the existing pure `simulateAttack(base, plan, settlement_seed)`.

### Why this stops grinding (D5)

- The attacker is **locked** to one `attacker_seed` by the prior `attack_commit` op (enforced in-fold). To
  settle they must reveal a seed that hashes to that commit; they cannot forward-enumerate reveals at settle
  time, and they cannot reveal a different seed (`sha256(reveal) != seed_commit` fails). Because
  `settlement_seed` also binds the `beacon` that did not exist at commit time, the attacker cannot have
  chosen `attacker_seed` to bias the outcome.
- The defender contributes nothing choosable at settlement time: `base_address` is the content address of a
  snapshot they signed earlier, and `plan_hash` is the attacker's signed plan. The defender cannot grind.
- **Therefore neither party can grind the outcome — given a beacon fixed after the commit (the residual).**

### O1 honest residual (what the lab does NOT prove)

The lab takes `beacon` as an **explicit input** and proves the *binding* is grind-resistant given a fair,
post-commit beacon. It does **not** manufacture a decentralized fair beacon. In a single-writer
owner-authoritative chain the block owner controls their own future log head, so the beacon must come from
**outside either party's control** — a cross-block hash-chain checkpoint at a future sequence height, or a
**Phase-4 quorum beacon**. Producing that beacon is **Phase 3/4 work, deferred**. This residual **includes the bounded multi-commit
(K-of-N) vector**: an attacker can fold several `attack_commit` ops with different seeds before the beacon
and then settle with whichever yields the best outcome — a bounded grind (K seeds, each costing a chain op),
not unbounded enumeration. So the fair-beacon definition must also fix **when the commit window closes**
relative to beacon publication. **Falsifier:** if a beacon source lets the attacker predict the beacon, or
keep committing after it is known, or the defender choose it, grind-resistance fails — the production beacon
binding must be reviewed against exactly that.

## O2 — resolution: delegable fraud-proof (liveness does not depend on the victim)

The attack outcome is a **pure function of public, signed inputs** (the defender's content-addressed,
host-signed base snapshot; the attacker's signed plan; the commit-reveal-derived seed). Therefore the
fraud-proof — "the claimed outcome digest does not match the deterministic recompute" — can be produced and
verified by **anyone holding the public inputs**, not only the victim.

```
verifySettlement(baseRecord, plan, settlementClaim) -> bool      // any peer recomputes; no victim needed
proveFraud(baseRecord, plan, settlementClaim) -> fraudProof|null  // any peer; one-op, deterministic
```

- Settlement is **optimistic**: a settlement is provisionally accepted, then becomes final only after a
  bounded **challenge window** (counted in logical ticks / sequence heights — deterministic, no wall clock)
  passes with **no valid fraud-proof**.
- Within the window, **any honest peer** that holds the defender's signed snapshot can recompute and, on
  mismatch, produce a one-op fraud-proof that any other peer verifies in a single deterministic evaluation.
  A proven-fraudulent settlement is thus **detectable and provable by any peer**. *Applying* that revocation
  — writing it into the owner's **single-writer** log when the owner is offline — requires the
  multi-writer/availability layer (**O6 / Phase 3**); the lab proves the detection/proof, not the cross-peer
  application.

### Why an offline victim is protected (D7)

Because verification needs only the **public signed inputs** and not the defender's participation, liveness
is **delegable**: an absent-but-honest defender is defended by **any** honest peer (or a Phase-4 quorum)
holding their snapshot. The victim does not have to be online to be protected.

### O2 honest residual (what the lab does NOT prove)

The lab proves the **mechanism**: a forged settlement against an offline defender is caught and revoked by a
**third party** (neither attacker nor defender) using only the public inputs, and the challenge window is a
deterministic tick count. It does **not** prove that ≥1 honest peer is actually watching within the window —
that is the **availability fabric (Phase 3)** (peer cache / gossip that delivers snapshots and settlements)
and the **safety quorum (Phase 4)**. **Falsifier:** if no honest peer holds the snapshot within the window,
a forged settlement could finalize — so Phase 3/4 must guarantee snapshot availability and at least
honest-minority watching before any live use.

## Settlement effect — invariants (hard, unchanged from Phase 1/2; never relaxed)

A settled attack produces **only** bounded, reversible, cosmetic **scorch** — and nothing else:

- the defender's **base snapshot is never mutated, transferred, or deleted**; scorch is a **separate**,
  bounded, **self-healing** overlay (`scorch.mjs`), keyed by structure id;
- **no transfer of structures or counters** between players — Phase 1's "no transfer/cash-out op exists"
  property is preserved by construction (no such op is added);
- **no per-person reward credit.** `attacker_reward` stays a bounded, non-cash **display** number; settlement
  credits it to **no persistent per-player balance** — consistent with ADR-009 / the Phase 9 doctrine that
  recognition is **block-collective, never per-person** (per-player attribution stays deferred);
- scorch is **bounded and integer** (`scorchBoundsHold`) and **decays to zero** over ticks — no permanent
  destruction; a settlement carrying out-of-bounds scorch **fails to fold**.

## Optimistic fold integration (how settlement enters a block log)

Following the plan's optimistic model, a new **`settle_attack`** op (distinct from the foundation's
`record_attack_result`, which stays settlement-deferred) carries the settlement inputs and a
**bounds-checked carried scorch map**; the fold **applies** that scorch to a separate `scorch` overlay
(via `applyScorch`) and records the settlement — it does **not** recompute (the single-block fold has only
content addresses, not the base/plan objects). **Correctness vs. the deterministic recompute is the
fraud-proof's job** (`verifySettlement` / `proveFraud`), exactly the optimistic-execution + one-op
fraud-proof design. The fold's guarantees are: a matching **prior `attack_commit`** (else `no_prior_commit`),
valid signature (`verifyOp`), valid commit↔reveal (`bad_seed_commit`), and scorch **within bounds**; anything
else fails to fold. (A known split: the fold trusts the *carried* scorch within bounds; cross-checking it
against the recompute is the fraud-proof's role, and scorch is cosmetic/reversible/non-cash, so an
under-stated carry has no economic effect.)

### Deferred here (O6 / Phase 3, stated, not faked)

- **Who commits the settlement op into a shared, multi-writer log**, and multi-writer convergence on one base
  snapshot (concurrent attacks) — **O6**, deferred to **Phase 3**. The lab proves the settlement *mechanism*
  and the scorch *application/reversibility* in a single-block, in-process setting.
- The **beacon source** (O1 residual) and **honest-peer availability** (O2 residual) — **Phase 3/4**.

## What the lab build proves (the D-matrix promotions)

- **D5 (was deferred → PASS):** commit-reveal binding is grind-resistant — a reveal must match the commit;
  the settlement seed depends on a post-commit beacon; the attacker cannot select a seed to bias the outcome
  after committing.
- **D7 (was deferred → PASS):** delegable liveness — a forged settlement against an **offline** defender is
  detected and revoked by a **third party** using only public signed inputs.
- Plus settlement-specific claims: scorch applied in-fold is bounded + reversible (self-heals), the base is
  untouched, no value/counter is transferred, and `attacker_reward` is credited to nothing.

## Boundary (unchanged)

Lab-only; prod-denylisted under the existing `arcade/hiveworld-agents/` upload prefix; imported by no
production path; `LIVE_WORLD_LOADER_ENABLED` stays `false`; no Worker/DO/D1/R2/migration/secret/config.
**Phase 0 legal/safety counsel remains the hard gate before anything live or minors-facing — this design
moves none of it.**
