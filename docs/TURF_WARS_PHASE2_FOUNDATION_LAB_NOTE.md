# Turf Wars — Phase 2 Foundation Lab Note (O1/O2-agnostic slice)

**Status: LAB ONLY · PROD-DENYLISTED · DESIGN-PHASE PROTOTYPE.** This records the **O1/O2-agnostic**
slice of Phase 2 (deterministic attack simulator + one-op fraud-proof) — only the parts that do **not**
depend on the two open design decisions. It is **not** a production-readiness claim, **not** counsel
approval, **not** a charter override, **not** a minors-safety clearance, and **not** a live-pilot
approval. The parent plan is [NEON_CIRCUIT_TURF_WARS_PHASE2_PLAN.md](NEON_CIRCUIT_TURF_WARS_PHASE2_PLAN.md);
the roadmap stays DRAFT/DESIGN-ONLY and **Phase 0 legal/safety counsel remains BLOCKING** for any live or
minors-facing use. Builds on the Phase 1 substrate (ADR-050).

## Why only a slice

Phase 2's two hardest questions are open and were **not resolved before building** (per the operator's
sequencing): **O1** — how the settlement *seed* is bound (commit-reveal) so neither party can grind it;
**O2** — the fraud-proof *liveness* window, especially when the victim is offline. The keystone
settlement depends on both. So this build implements everything that is independent of O1/O2 and leaves
them as explicit, documented seams — never baked in.

## What is built (under `arcade/hiveworld-agents/turf-wars/`, prod-denylisted)

| Module | What it proves |
|---|---|
| `attack-plan.mjs` | Closed, Ed25519-signed attack-plan grammar: bounded moves (closed intensity enum, ≤16 moves) against the defender's structures; strict per-field schema + forbidden-content scan; tampered moves → `hash_mismatch`, foreign signature → `bad_signature`, unknown key → `unknown_plan_key`. |
| `scorch.mjs` | The **reversible, cosmetic** loss model: a bounded per-structure overlay (`SCORCH_CAP`) that **self-heals to empty** over ticks. Pure/immutable — never mutates the base or its inputs. |
| `attack-sim.mjs` | The deterministic fixed interpreter: `simulateAttack(baseSnapshot, signedPlan, seed) → outcome` (seeded LCG only, no entropy), plus `verifyAttackOutcome` — the **one-op fraud-proof** recompute primitive. Verifies the Phase-1 base snapshot + the plan; a forged digest or wrong seed fails. |
| `ops.mjs` / `block-log.mjs` | `record_attack_result` **promoted** from reserved → a structurally-validated op (closed schema + signature); the fold records it as **settlement-deferred** (`settlement_deferred_pending_o1_o2`) and mutates nothing. |
| `attack-evidence.mjs` | The **D-matrix** (D1–D10) seeded + byte-identical replay. |

### Adversarial D-matrix (all PASS, multi-seed, byte-identical replay)

D1 valid attack deterministic · D2 forged outcome → fraud-proof rejects · D3 tampered base rejected ·
D4 tampered/foreign-signed plan rejected · D6 replay determinism (+ duplicate op deduped) · D8 scorch
bounded + reversible · D9 no value transfer (base untouched, reward bounded, no transfer op) · D10 base
snapshot immutable across simulation · DRAR combat op structurally valid but settlement-deferred.

**Explicitly DEFERRED (listed in the pack's `deferred`, not faked as passing):**
- **D5 seed-grinding resistance** → depends on **O1** (commit-reveal seed binding). The seed is a bare
  parameter here.
- **D7 offline-victim liveness** → depends on **O2** (fraud-proof liveness window). No settlement timing
  is built here.

**Tests:** `tests/arcade/turf-wars-attack-{plan,sim,evidence}.test.mjs` + the updated Phase-1
`turf-wars-log` / `turf-evidence` (the `record_attack_result` promotion) + the extended
`tests/creator/turf-wars-prod-denylist.test.mjs` (now covers all 10 lab modules).

### One latent Phase-1 bug fixed in passing
`scanForbidden`'s `string_too_long` cap (>64) would have rejected the content-address (71-char) and
Ed25519-signature (128-char) fields of a *valid* `publish_base_snapshot` op — a latent Phase-1 defect no
test exercised (no test folded a real publish op). The cap now allows long **hex / content-address**
strings (the closed schema already pins those fields) while still rejecting long **free text**.

## Hard invariants held (independent of O1/O2)
- The defender's **signed base snapshot is never mutated** (D10) — scorch is a separate overlay.
- **No transfer / cash-out / marketplace** op exists; an attack yields a **bounded, non-cash** reward
  that is minted by **nothing here** (settlement is deferred), and moves none of the defender's value (D9).
- Scorch is **bounded and reversible** — no permanent destruction (D8).
- Authority = **replay determinism**; the fraud-proof is a one-op recompute (D1/D2), no referee.

## What is NOT built
- No live exposure, no network/transport, no availability fabric (DHT/gossip = **Phase 3**).
- No safety quorum / render-gate (**Phase 4**); no live pilot (**Phase 5**).
- No settlement wiring (applying an outcome to a block) — that is the O1/O2-gated step.
- No economy with cash value, IAP, marketplace, ownership transfer, or minors-facing surface.

## What unblocks the rest of Phase 2
Resolve **O1** (settlement-seed commit-reveal + a hostile proof against grinding, D5) and **O2**
(fraud-proof liveness window for an offline victim, D7) as design constraints; then a separately-gated
step wires `record_attack_result` settlement (scorch application) into the fold behind those rules. All
of it stays lab-only and prod-denylisted; **Phase 0 legal/safety counsel remains the hard gate before
anything live or minors-facing.**
